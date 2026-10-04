import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  // Per-session usage counters (to back the cost claim with real data).
  llmTokens: integer("llm_tokens").notNull().default(0),
  ttsChars: integer("tts_chars").notNull().default(0),
  ttsCachedChars: integer("tts_cached_chars").notNull().default(0),
  sttSeconds: doublePrecision("stt_seconds").notNull().default(0),
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
    intervalDays: integer("interval_days").notNull().default(0),
    problem: text("problem"),
    expected: text("expected"),
    wrongAnswer: text("wrong_answer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({
    byProfile: index("error_events_profile").on(t.profileId, t.status),
    uniqueSkill: uniqueIndex("error_events_profile_skill").on(t.profileId, t.skill),
  }),
);

/** Persistent TTS cache, keyed by sha256(text|voice|model). Makes replays free across restarts. */
export const ttsCache = pgTable("tts_cache", {
  hash: text("hash").primaryKey(),
  mime: text("mime").notNull(),
  audioBase64: text("audio_base64").notNull(),
  chars: integer("chars").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
  llmTokens: number;
  ttsChars: number;
  ttsCachedChars: number;
  sttSeconds: number;
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
  intervalDays: number;
  problem: string | null;
  expected: string | null;
  wrongAnswer: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  nextDueAt: Date;
  resolvedAt: Date | null;
}

export interface UsageDelta {
  llmTokens?: number;
  ttsChars?: number;
  ttsCachedChars?: number;
  sttSeconds?: number;
}

export interface Repo {
  upsertProfile(p: { id: string; nickname: string; homeLang: string; level: number; classId?: string | null }): Promise<ProfileRow>;
  getProfile(id: string): Promise<ProfileRow | undefined>;
  createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "llmTokens" | "ttsChars" | "ttsCachedChars" | "sttSeconds" | "state" | "scanCount" | "pageContext">): Promise<SessionRow>;
  getSession(id: string): Promise<SessionRow | undefined>;
  setSessionPage(id: string, pageContext: string, scanCount: number): Promise<void>;
  endSession(id: string, minutesUsed: number): Promise<void>;
  addTurn(t: Omit<TurnRow, "id" | "createdAt">): Promise<TurnRow>;
  recentTurns(sessionId: string, limit: number): Promise<TurnRow[]>;
  sessionsToday(profileId: string): Promise<number>;
  minutesThisWeek(profileId: string): Promise<number>;
  /** Errors whose next_due_at has passed — the spaced re-teach queue. */
  dueErrors(profileId: string, limit: number): Promise<ErrorRow[]>;
  listOpenErrors(profileId: string): Promise<ErrorRow[]>;
  listSessions(profileId: string, limit: number): Promise<SessionRow[]>;
  recordError(e: {
    profileId: string;
    skill: string;
    subject: string;
    wrongAnswer?: string | null;
    problem?: string | null;
    expected?: string | null;
  }): Promise<void>;
  resolveError(profileId: string, skill: string): Promise<void>;
  /** Persistent TTS cache keyed by sha256(text|voice|model) — makes replays free across restarts. */
  getCachedAudio(hash: string): Promise<{ audioBase64: string; mime: string } | undefined>;
  putCachedAudio(hash: string, audioBase64: string, mime: string, chars: number): Promise<void>;
  /** Increment the per-session usage counters. No-op when the session is unknown. */
  addUsage(sessionId: string, delta: UsageDelta): Promise<void>;
}

const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Spaced-repetition ladder, in days: 1 → 3 → 7 → 14 → 30. */
const REVIEW_LADDER = [1, 3, 7, 14, 30];
function nextInterval(prev: number): number {
  return REVIEW_LADDER.find((v) => v > prev) ?? REVIEW_LADDER[REVIEW_LADDER.length - 1];
}

// ── In-memory repo (local dev, no DATABASE_URL) ─────────────────────────────
class MemoryRepo implements Repo {
  private profiles = new Map<string, ProfileRow>();
  private sessions = new Map<string, SessionRow>();
  private turns: TurnRow[] = [];
  private errors = new Map<string, ErrorRow>();
  private tts = new Map<string, { audioBase64: string; mime: string }>();
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
  async createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "llmTokens" | "ttsChars" | "ttsCachedChars" | "sttSeconds" | "state" | "scanCount" | "pageContext">) {
    const row: SessionRow = { ...s, id: id("ses"), pageContext: null, scanCount: 0, minutesUsed: 0, llmTokens: 0, ttsChars: 0, ttsCachedChars: 0, sttSeconds: 0, state: "active", startedAt: new Date(), endedAt: null };
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
    const now = Date.now();
    return [...this.errors.values()]
      .filter((e) => e.profileId === profileId && e.nextDueAt.getTime() <= now)
      .sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime())
      .slice(0, limit);
  }
  async listOpenErrors(profileId: string) {
    return [...this.errors.values()]
      .filter((e) => e.profileId === profileId && e.status === "open")
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }
  async recordError(e: {
    profileId: string;
    skill: string;
    subject: string;
    wrongAnswer?: string | null;
    problem?: string | null;
    expected?: string | null;
  }) {
    const k = this.key(e.profileId, e.skill);
    const now = new Date();
    const existing = this.errors.get(k);
    if (existing) {
      existing.attempts += 1;
      existing.status = "open";
      existing.intervalDays = 0;
      existing.lastSeenAt = now;
      existing.nextDueAt = now;
      existing.wrongAnswer = e.wrongAnswer ?? existing.wrongAnswer;
      existing.problem = e.problem ?? existing.problem;
      existing.expected = e.expected ?? existing.expected;
    } else {
      this.errors.set(k, {
        id: id("err"),
        profileId: e.profileId,
        skill: e.skill,
        subject: e.subject,
        status: "open",
        attempts: 1,
        intervalDays: 0,
        problem: e.problem ?? null,
        expected: e.expected ?? null,
        wrongAnswer: e.wrongAnswer ?? null,
        createdAt: now,
        lastSeenAt: now,
        nextDueAt: now,
        resolvedAt: null,
      });
    }
  }
  async resolveError(profileId: string, skill: string) {
    const e = this.errors.get(this.key(profileId, skill));
    if (e) {
      const interval = nextInterval(e.intervalDays);
      e.status = "resolved";
      e.intervalDays = interval;
      e.resolvedAt = new Date();
      e.nextDueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
    }
  }
  async listSessions(profileId: string, limit: number) {
    return [...this.sessions.values()]
      .filter((s) => s.profileId === profileId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }
  async getCachedAudio(hash: string) {
    return this.tts.get(hash);
  }
  async putCachedAudio(hash: string, audioBase64: string, mime: string) {
    // Bound the in-memory cache; evict the oldest insertion first.
    if (this.tts.size >= 400) {
      const oldest = this.tts.keys().next().value;
      if (oldest) this.tts.delete(oldest);
    }
    this.tts.set(hash, { audioBase64, mime });
  }
  async addUsage(sessionId: string, delta: UsageDelta) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.llmTokens += delta.llmTokens ?? 0;
    s.ttsChars += delta.ttsChars ?? 0;
    s.ttsCachedChars += delta.ttsCachedChars ?? 0;
    s.sttSeconds += delta.sttSeconds ?? 0;
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
  async createSession(s: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "minutesUsed" | "llmTokens" | "ttsChars" | "ttsCachedChars" | "sttSeconds" | "state" | "scanCount" | "pageContext">) {
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
      .where(and(eq(errorEvents.profileId, profileId), lte(errorEvents.nextDueAt, new Date())))
      .orderBy(asc(errorEvents.nextDueAt))
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
  async listSessions(profileId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.profileId, profileId))
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
    return rows as SessionRow[];
  }
  async recordError(e: {
    profileId: string;
    skill: string;
    subject: string;
    wrongAnswer?: string | null;
    problem?: string | null;
    expected?: string | null;
  }) {
    await this.db
      .insert(errorEvents)
      .values({
        id: id("err"),
        profileId: e.profileId,
        skill: e.skill,
        subject: e.subject,
        problem: e.problem ?? null,
        expected: e.expected ?? null,
        wrongAnswer: e.wrongAnswer ?? null,
      })
      .onConflictDoUpdate({
        target: [errorEvents.profileId, errorEvents.skill],
        set: {
          status: "open",
          lastSeenAt: new Date(),
          nextDueAt: new Date(),
          intervalDays: 0,
          attempts: sql`${errorEvents.attempts} + 1`,
          problem: e.problem ?? null,
          expected: e.expected ?? null,
          wrongAnswer: e.wrongAnswer ?? null,
        },
      });
  }
  async resolveError(profileId: string, skill: string) {
    const [row] = await this.db
      .select()
      .from(errorEvents)
      .where(and(eq(errorEvents.profileId, profileId), eq(errorEvents.skill, skill)))
      .limit(1);
    if (!row) return;
    const interval = nextInterval((row as ErrorRow).intervalDays);
    await this.db
      .update(errorEvents)
      .set({
        status: "resolved",
        intervalDays: interval,
        resolvedAt: new Date(),
        nextDueAt: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
      })
      .where(and(eq(errorEvents.profileId, profileId), eq(errorEvents.skill, skill)));
  }
  async getCachedAudio(hash: string) {
    const [row] = await this.db.select().from(ttsCache).where(eq(ttsCache.hash, hash)).limit(1);
    return row ? { audioBase64: row.audioBase64, mime: row.mime } : undefined;
  }
  async putCachedAudio(hash: string, audioBase64: string, mime: string, chars: number) {
    await this.db.insert(ttsCache).values({ hash, audioBase64, mime, chars }).onConflictDoNothing();
  }
  async addUsage(sessionId: string, delta: UsageDelta) {
    await this.db
      .update(sessions)
      .set({
        llmTokens: sql`${sessions.llmTokens} + ${delta.llmTokens ?? 0}`,
        ttsChars: sql`${sessions.ttsChars} + ${delta.ttsChars ?? 0}`,
        ttsCachedChars: sql`${sessions.ttsCachedChars} + ${delta.ttsCachedChars ?? 0}`,
        sttSeconds: sql`${sessions.sttSeconds} + ${delta.sttSeconds ?? 0}`,
      })
      .where(eq(sessions.id, sessionId));
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
