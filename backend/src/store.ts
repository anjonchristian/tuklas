import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { env } from "./env";

// ── Schema ──────────────────────────────────────────────────────────────────
export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  classId: text("class_id"),
  nickname: text("nickname").notNull(),
  homeLang: text("home_lang").notNull().default("fil"),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  homeLang: text("home_lang").notNull(),
  level: integer("level").notNull().default(1),
  pageContext: text("page_context"),
  scanCount: integer("scan_count").notNull().default(0),
  minutesUsed: doublePrecision("minutes_used").notNull().default(0),
  state: text("state").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const turns = pgTable("turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  speaker: text("speaker").notNull(),
  text: text("text").notNull(),
  lang: text("lang"),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** The Error Notebook: every mistake is a skill with a state, not a chat line. */
export const errorEvents = pgTable(
  "error_events",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    skill: text("skill").notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("open"), // open | resolved
    attempts: integer("attempts").notNull().default(1),
    wrongAnswer: text("wrong_answer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({ byProfile: index("error_events_profile").on(t.profileId, t.status) }),
);

// ── Types ───────────────────────────────────────────────────────────────────
export interface ProfileRow {
  id: string;
  classId: string | null;
  nickname: string;
  homeLang: string;
  level: number;
  createdAt: Date;
}
export interface SessionRow {
  id: string;
  profileId: string;
  subject: string;
  topic: string;
  homeLang: string;
  level: number;
  pageContext: string | null;
  scanCount: number;
  minutesUsed: number;
  state: string;
  startedAt: Date;
  endedAt: Date | null;
}
export interface TurnRow {
  id: string;
  sessionId: string;
  speaker: "learner" | "tutor";
  text: string;
  lang: string | null;
  flagged: boolean;
  createdAt: Date;
}
export interface ErrorRow {
  id: string;
  profileId: string;
  skill: string;
  subject: string;
  status: string;
  attempts: number;
  wrongAnswer: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

export interface Repo {
  upsertProfile(p: { id: string; nickname: string; homeLang: string; level: number; classId?: string | null }): Promise<ProfileRow>;
  getProfile(id: string): Promise<ProfileRow | undefined>;
  createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "state" | "scanCount" | "pageContext">): Promise<SessionRow>;
  getSession(id: string): Promise<SessionRow | undefined>;
  setSessionPage(id: string, pageContext: string, scanCount: number): Promise<void>;
  endSession(id: string, minutesUsed: number): Promise<void>;
  addTurn(t: Omit<TurnRow, "id" | "createdAt">): Promise<TurnRow>;
  recentTurns(sessionId: string, limit: number): Promise<TurnRow[]>;
  sessionsToday(profileId: string): Promise<number>;
  minutesThisWeek(profileId: string): Promise<number>;
  /** Oldest open errors first — the spaced re-teach queue. */
  dueErrors(profileId: string, limit: number): Promise<ErrorRow[]>;
  listOpenErrors(profileId: string): Promise<ErrorRow[]>;
  recordError(e: { profileId: string; skill: string; subject: string; wrongAnswer?: string | null }): Promise<void>;
  resolveError(profileId: string, skill: string): Promise<void>;
}

const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── In-memory repo (local dev, no DATABASE_URL) ─────────────────────────────
class MemoryRepo implements Repo {
  private profiles = new Map<string, ProfileRow>();
  private sessions = new Map<string, SessionRow>();
  private turns: TurnRow[] = [];
  private errors = new Map<string, ErrorRow>();
  private key(profileId: string, skill: string) {
    return `${profileId}::${skill.toLowerCase()}`;
  }

  async upsertProfile(p: { id: string; nickname: string; homeLang: string; level: number; classId?: string | null }) {
    const existing = this.profiles.get(p.id);
    const row: ProfileRow = existing ?? { ...p, classId: p.classId ?? null, createdAt: new Date() };
    row.nickname = p.nickname;
    row.homeLang = p.homeLang;
    row.level = p.level;
    this.profiles.set(p.id, row);
    return row;
  }
  async getProfile(profileId: string) {
    return this.profiles.get(profileId);
  }
  async createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "state" | "scanCount" | "pageContext">) {
    const row: SessionRow = { ...s, id: id("ses"), pageContext: null, scanCount: 0, minutesUsed: 0, state: "active", startedAt: new Date(), endedAt: null };
    this.sessions.set(row.id, row);
    return row;
  }
  async getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }
  async setSessionPage(sessionId: string, pageContext: string, scanCount: number) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.pageContext = pageContext;
      s.scanCount = scanCount;
    }
  }
  async endSession(sessionId: string, minutesUsed: number) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.state = "ended";
      s.endedAt = new Date();
      s.minutesUsed = minutesUsed;
    }
  }
  async addTurn(t: Omit<TurnRow, "id" | "createdAt">) {
    const row: TurnRow = { ...t, id: id("turn"), createdAt: new Date() };
    this.turns.push(row);
    return row;
  }
  async recentTurns(sessionId: string, limit: number) {
    return this.turns.filter((t) => t.sessionId === sessionId).slice(-limit);
  }
  async sessionsToday(profileId: string) {
    const start = startOfToday().getTime();
    return [...this.sessions.values()].filter((s) => s.profileId === profileId && s.startedAt.getTime() >= start).length;
  }
  async minutesThisWeek(profileId: string) {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...this.sessions.values()]
      .filter((s) => s.profileId === profileId && s.startedAt.getTime() >= since)
      .reduce((sum, s) => sum + s.minutesUsed, 0);
  }
  async dueErrors(profileId: string, limit: number) {
    return [...this.errors.values()]
      .filter((e) => e.profileId === profileId && e.status === "open")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }
  async listOpenErrors(profileId: string) {
    return [...this.errors.values()]
      .filter((e) => e.profileId === profileId && e.status === "open")
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }
  async recordError(e: { profileId: string; skill: string; subject: string; wrongAnswer?: string | null }) {
    const k = this.key(e.profileId, e.skill);
    const existing = this.errors.get(k);
    if (existing) {
      existing.attempts += 1;
      existing.status = "open";
      existing.lastSeenAt = new Date();
      existing.wrongAnswer = e.wrongAnswer ?? existing.wrongAnswer;
    } else {
      this.errors.set(k, {
        id: id("err"),
        profileId: e.profileId,
        skill: e.skill,
        subject: e.subject,
        status: "open",
        attempts: 1,
        wrongAnswer: e.wrongAnswer ?? null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        resolvedAt: null,
      });
    }
  }
  async resolveError(profileId: string, skill: string) {
    const e = this.errors.get(this.key(profileId, skill));
    if (e) {
      e.status = "resolved";
      e.resolvedAt = new Date();
    }
  }
}

// ── Drizzle repo (Supabase / Neon Postgres) ─────────────────────────────────
class DrizzleRepo implements Repo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async upsertProfile(p: { id: string; nickname: string; homeLang: string; level: number; classId?: string | null }) {
    const [row] = await this.db
      .insert(profiles)
      .values({ id: p.id, nickname: p.nickname, homeLang: p.homeLang, level: p.level, classId: p.classId ?? null })
      .onConflictDoUpdate({ target: profiles.id, set: { nickname: p.nickname, homeLang: p.homeLang, level: p.level } })
      .returning();
    return row as ProfileRow;
  }
  async getProfile(profileId: string) {
    const [row] = await this.db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    return row as ProfileRow | undefined;
  }
  async createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "state" | "scanCount" | "pageContext">) {
    const [row] = await this.db.insert(sessions).values({ ...s, id: id("ses") }).returning();
    return row as SessionRow;
  }
  async getSession(sessionId: string) {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return row as SessionRow | undefined;
  }
  async setSessionPage(sessionId: string, pageContext: string, scanCount: number) {
    await this.db.update(sessions).set({ pageContext, scanCount }).where(eq(sessions.id, sessionId));
  }
  async endSession(sessionId: string, minutesUsed: number) {
    await this.db.update(sessions).set({ state: "ended", endedAt: new Date(), minutesUsed }).where(eq(sessions.id, sessionId));
  }
  async addTurn(t: Omit<TurnRow, "id" | "createdAt">) {
    const [row] = await this.db.insert(turns).values({ ...t, id: id("turn") }).returning();
    return row as TurnRow;
  }
  async recentTurns(sessionId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, sessionId))
      .orderBy(desc(turns.createdAt))
      .limit(limit);
    return (rows as TurnRow[]).reverse();
  }
  async sessionsToday(profileId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.profileId, profileId), gte(sessions.startedAt, startOfToday())));
    return row?.count ?? 0;
  }
  async minutesThisWeek(profileId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [row] = await this.db
      .select({ sum: sql<number>`coalesce(sum(${sessions.minutesUsed}), 0)::float` })
      .from(sessions)
      .where(and(eq(sessions.profileId, profileId), gte(sessions.startedAt, since)));
    return row?.sum ?? 0;
  }
  async dueErrors(profileId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(errorEvents)
      .where(and(eq(errorEvents.profileId, profileId), eq(errorEvents.status, "open")))
      .orderBy(asc(errorEvents.createdAt))
      .limit(limit);
    return rows as ErrorRow[];
  }
  async listOpenErrors(profileId: string) {
    const rows = await this.db
      .select()
      .from(errorEvents)
      .where(and(eq(errorEvents.profileId, profileId), eq(errorEvents.status, "open")))
      .orderBy(desc(errorEvents.lastSeenAt));
    return rows as ErrorRow[];
  }
  async recordError(e: { profileId: string; skill: string; subject: string; wrongAnswer?: string | null }) {
    await this.db
      .insert(errorEvents)
      .values({
        id: id("err"),
        profileId: e.profileId,
        skill: e.skill,
        subject: e.subject,
        wrongAnswer: e.wrongAnswer ?? null,
      })
      .onConflictDoNothing();
    // Bump attempts / reopen if a row for this skill already exists.
    await this.db
      .update(errorEvents)
      .set({ status: "open", lastSeenAt: new Date(), attempts: sql`${errorEvents.attempts} + 1` })
      .where(and(eq(errorEvents.profileId, e.profileId), eq(errorEvents.skill, e.skill)));
  }
  async resolveError(profileId: string, skill: string) {
    await this.db
      .update(errorEvents)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(errorEvents.profileId, profileId), eq(errorEvents.skill, skill)));
  }
}

export function makeRepo(): Repo {
  if (!env.databaseUrl) {
    console.warn("[tuklas] DATABASE_URL not set — using in-memory store (data resets on restart).");
    return new MemoryRepo();
  }
  const client = postgres(env.databaseUrl, { prepare: false });
  return new DrizzleRepo(drizzle(client));
}
