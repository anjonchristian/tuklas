import type { LangCode } from "./languages";

export type Speaker = "learner" | "tutor";
export type CostKind = "llm" | "tts" | "stt" | "vision";

export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
  lang: string;
  createdAt: number;
  flagged?: boolean;
}

export interface CostEvent {
  kind: CostKind;
  model: string;
  units: number;
  costPhp: number;
  cached: boolean;
  createdAt: number;
}

export interface Session {
  id: string;
  profileId: string;
  nickname: string;
  homeLang: LangCode;
  targetLang: string;
  level: number;
  subject: string;
  topic: string;
  startedAt: number;
  endedAt?: number;
  state: "active" | "ended";
  turns: Turn[];
  pageContext?: string;
  scanCount: number;
  questionCount: number;
  costEvents: CostEvent[];
}

export interface Caps {
  minutesPerSession: number;
  minutesPerWeek: number;
  scansPerSession: number;
  sessionsPerDay: number;
}

function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const CAPS: Caps = {
  minutesPerSession: numEnv("CAP_MIN_PER_SESSION", 10),
  minutesPerWeek: numEnv("CAP_MIN_PER_WEEK", 30),
  scansPerSession: numEnv("CAP_SCANS_PER_SESSION", 3),
  sessionsPerDay: numEnv("CAP_SESSIONS_PER_DAY", 3),
};

export const RATES = {
  llmPer1kTokens: numEnv("RATE_LLM_PHP_PER_1K_TOKENS", 0.35),
  ttsPer1kChars: numEnv("RATE_TTS_PHP_PER_1K_CHARS", 3.3),
  sttPerMin: numEnv("RATE_STT_PHP_PER_MIN", 0),
  visionPerCall: numEnv("RATE_VISION_PHP_PER_CALL", 0.3),
};

/** In-memory store. Swap for Drizzle/Postgres (spec 03, Req 1) without touching callers. */
const sessions = new Map<string, Session>();

export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateSessionInput {
  profileId: string;
  nickname: string;
  homeLang: LangCode;
  targetLang?: string;
  level: number;
  subject: string;
  topic: string;
}

export function createSession(input: CreateSessionInput): Session {
  const session: Session = {
    id: newId("ses"),
    profileId: input.profileId,
    nickname: input.nickname,
    homeLang: input.homeLang,
    targetLang: input.targetLang ?? "Filipino and English",
    level: input.level,
    subject: input.subject,
    topic: input.topic,
    startedAt: Date.now(),
    state: "active",
    turns: [],
    scanCount: 0,
    questionCount: 0,
    costEvents: [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function addTurn(sessionId: string, turn: Omit<Turn, "id" | "createdAt">): Turn | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const full: Turn = { ...turn, id: newId("turn"), createdAt: Date.now() };
  session.turns.push(full);
  return full;
}

export function recordCost(sessionId: string, event: Omit<CostEvent, "createdAt">): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.costEvents.push({ ...event, createdAt: Date.now() });
}

export function endSession(id: string): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.endedAt = Date.now();
  session.state = "ended";
  return session;
}

/** Minutes consumed, from the server clock (spec 03, Req 2). */
export function sessionMinutes(session: Session): number {
  const end = session.endedAt ?? Date.now();
  const minutes = (end - session.startedAt) / 60000;
  return Math.min(minutes, CAPS.minutesPerSession);
}

export function costTotalPhp(session: Session): number {
  return session.costEvents.reduce((sum, e) => sum + e.costPhp, 0);
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

export function profileSessions(profileId: string): Session[] {
  return [...sessions.values()].filter((s) => s.profileId === profileId);
}

export function allSessions(): Session[] {
  return [...sessions.values()];
}

export function minutesThisWeek(profileId: string): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return profileSessions(profileId)
    .filter((s) => s.startedAt >= weekAgo)
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
}

export function sessionsToday(profileId: string): number {
  return profileSessions(profileId).filter((s) => isSameDay(s.startedAt, Date.now())).length;
}

export interface CapCheck {
  ok: boolean;
  reason?: string;
  retryAfter?: number;
}

export function checkStartCaps(profileId: string): CapCheck {
  if (sessionsToday(profileId) >= CAPS.sessionsPerDay) {
    return {
      ok: false,
      reason: `Naabot na ang ${CAPS.sessionsPerDay} sessions ngayong araw. Balik bukas.`,
      retryAfter: 3600,
    };
  }
  if (minutesThisWeek(profileId) >= CAPS.minutesPerWeek) {
    return {
      ok: false,
      reason: `Naubos na ang linggong oras (${CAPS.minutesPerWeek} min). Balik sa Lunes.`,
      retryAfter: 3600,
    };
  }
  return { ok: true };
}

export interface MinutesSnapshot {
  sessionMin: number;
  sessionCap: number;
  learnerWeekMin: number;
  learnerWeekCap: number;
  classDayMin: number;
  classDayCostPhp: number;
}

export function minutesSnapshot(session: Session): MinutesSnapshot {
  const sameProfile = profileSessions(session.profileId);
  const daySessions = sameProfile.filter((s) => isSameDay(s.startedAt, Date.now()));
  return {
    sessionMin: Number(sessionMinutes(session).toFixed(2)),
    sessionCap: CAPS.minutesPerSession,
    learnerWeekMin: Number(minutesThisWeek(session.profileId).toFixed(2)),
    learnerWeekCap: CAPS.minutesPerWeek,
    classDayMin: Number(daySessions.reduce((sum, s) => sum + sessionMinutes(s), 0).toFixed(2)),
    classDayCostPhp: Number(daySessions.reduce((sum, s) => sum + costTotalPhp(s), 0).toFixed(4)),
  };
}
