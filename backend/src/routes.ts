import { Router } from "express";
import { z } from "zod";
import { env } from "./env";
import { getLanguage } from "./languages";
import { chatComplete, extractPage, synthesize, type ChatMessage } from "./providers";
import { buildGradePrompt, buildGreeting, buildSystemPrompt, enforceHintPolicy, parseGradeJson, type GradeResult } from "./tutor";
import { makeRepo, type Repo } from "./store";

const repo: Repo = makeRepo();

function sessionMinutes(startedAt: Date, endedAt: Date | null) {
  const end = endedAt ? endedAt.getTime() : Date.now();
  return Math.min((end - startedAt.getTime()) / 60000, env.caps.minutesPerSession);
}

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    database: env.databaseUrl ? "postgres" : "memory",
    providers: {
      llm: env.opencodeApiKey ? "opencode-go" : "mock",
      tts: env.elevenLabsKey ? "elevenlabs" : "browser-fallback",
    },
    caps: env.caps,
  });
});

// ── Start a session: cap-check, then open with the Error Notebook ───────────
router.post("/api/tutor/start", async (req, res) => {
  const schema = z.object({
    profileId: z.string().min(1),
    nickname: z.string().optional(),
    homeLang: z.string().optional(),
    level: z.number().optional(),
    subject: z.string().optional(),
    topic: z.string().optional(),
    classId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { profileId } = parsed.data;

  const [sessionsToday, weekMinutes] = await Promise.all([
    repo.sessionsToday(profileId),
    repo.minutesThisWeek(profileId),
  ]);
  if (sessionsToday >= env.caps.sessionsPerDay) {
    return res.status(429).json({ error: `Naabot na ang ${env.caps.sessionsPerDay} sessions ngayong araw.` });
  }
  if (weekMinutes >= env.caps.minutesPerWeek) {
    return res.status(429).json({ error: `Naubos na ang linggong oras (${env.caps.minutesPerWeek} min).` });
  }

  const homeLang = parsed.data.homeLang && getLanguage(parsed.data.homeLang) ? parsed.data.homeLang : "fil";
  const subject = parsed.data.subject?.trim() || "Math";
  const topic = parsed.data.topic?.trim() || "Addition";
  const level = parsed.data.level ?? 1;

  await repo.upsertProfile({
    id: profileId,
    nickname: parsed.data.nickname?.trim() || "Learner",
    homeLang,
    level,
    classId: parsed.data.classId ?? null,
  });

  const session = await repo.createSession({
    profileId,
    subject,
    topic,
    homeLang,
    level,
  });

  const reteach = await repo.dueErrors(profileId, 3);
  let greeting = buildGreeting(homeLang, topic);
  if (reteach.length > 0) {
    greeting = `${greeting} Balikan natin ang dati nimong lisod: ${reteach[0].skill}.`;
  }
  await repo.addTurn({ sessionId: session.id, speaker: "tutor", text: greeting, lang: homeLang, flagged: false });

  res.json({
    sessionId: session.id,
    greeting,
    reteach: reteach.map((e) => ({ skill: e.skill, attempts: e.attempts })),
    language: { code: homeLang, label: getLanguage(homeLang).label },
    minutes: { sessionMin: 0, cap: env.caps.minutesPerSession },
  });
});

// ── A turn: judge the answer, log the error, reply, speak ───────────────────
router.post("/api/tutor/turn", async (req, res) => {
  const schema = z.object({ sessionId: z.string().min(1), text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { sessionId, text } = parsed.data;

  const session = await repo.getSession(sessionId);
  if (!session) return res.status(404).json({ error: "Unknown session" });
  if (session.state !== "active") return res.status(409).json({ error: "Session ended" });

  const minutes = sessionMinutes(session.startedAt, session.endedAt);
  if (minutes >= env.caps.minutesPerSession) {
    return res.status(429).json({ error: `Tapos na ang session (${env.caps.minutesPerSession} min).` });
  }

  const [history, reteach] = await Promise.all([
    repo.recentTurns(sessionId, 6),
    repo.dueErrors(session.profileId, 3),
  ]);

  const system = buildSystemPrompt({
    homeLang: session.homeLang,
    level: session.level,
    subject: session.subject,
    topic: session.topic,
    pageContext: session.pageContext ?? undefined,
    reteach: reteach.map((e) => ({ skill: e.skill, wrongAnswer: e.wrongAnswer })),
  });

  const lastTutor = [...history].reverse().find((t) => t.speaker === "tutor")?.text;

  // 1) Grade the child's answer in a focused call — the Error Notebook depends on it.
  let grade: GradeResult = { isAnswer: false, correct: null, expected: "", skill: "general" };
  try {
    const graded = await chatComplete(
      [
        {
          role: "system",
          content: buildGradePrompt({
            level: session.level,
            pageContext: session.pageContext ?? undefined,
            tutorPrompt: lastTutor,
            answer: text,
          }),
        },
        { role: "user", content: text },
      ],
      `${session.id}-grade`,
    );
    grade = parseGradeJson(graded.text);
  } catch {
    // grading failure must not break the turn
  }

  // 2) Generate the tutoring reply, told whether the child was right or wrong.
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history.map((t) => ({ role: t.speaker === "learner" ? ("user" as const) : ("assistant" as const), content: t.text })),
    ...(grade.isAnswer
      ? [
          {
            role: "system" as const,
            content: `[grade] The learner answered "${text}" — ${grade.correct ? "correct" : "incorrect"}${
              grade.expected ? ` (expected ${grade.expected})` : ""
            }. ${
              grade.correct
                ? "Acknowledge warmly and move to the next step; still never state the final answer."
                : "Gently correct the reasoning, one step, and never state the answer."
            }`,
          },
        ]
      : []),
    { role: "user", content: text },
  ];

  const completion = await chatComplete(messages, session.id);
  const filtered = enforceHintPolicy(completion.text, session.homeLang);

  await repo.addTurn({ sessionId, speaker: "learner", text, lang: session.homeLang, flagged: false });
  await repo.addTurn({ sessionId, speaker: "tutor", text: filtered.text, lang: session.homeLang, flagged: filtered.flagged });

  // ── Error Notebook writes ──
  if (grade.isAnswer && grade.correct === false) {
    await repo.recordError({
      profileId: session.profileId,
      skill: grade.skill,
      subject: session.subject,
      wrongAnswer: text,
    });
  } else if (grade.isAnswer && grade.correct === true) {
    await repo.resolveError(session.profileId, grade.skill);
  }

  let audio: { base64: string; mime: string; cached: boolean } | null = null;
  try {
    const tts = await synthesize(filtered.text, session.homeLang);
    if (tts) audio = { base64: tts.audioBase64, mime: tts.mime, cached: tts.cached };
  } catch {
    audio = null;
  }

  res.json({
    reply: { text: filtered.text, lang: session.homeLang, flagged: filtered.flagged },
    judgement: { isAnswer: grade.isAnswer, correct: grade.correct, skill: grade.skill },
    audio,
    mocked: { llm: completion.mocked },
    minutes: { sessionMin: Number(minutes.toFixed(2)), cap: env.caps.minutesPerSession },
  });
});

// ── Scan a worksheet page into the session ─────────────────────────────────
router.post("/api/scan", async (req, res) => {
  const schema = z.object({ sessionId: z.string().min(1), imageDataUrl: z.string().startsWith("data:image/") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Expected an image data URL" });
  const { sessionId, imageDataUrl } = parsed.data;

  const session = await repo.getSession(sessionId);
  if (!session) return res.status(404).json({ error: "Unknown session" });
  if (session.scanCount >= env.caps.scansPerSession) {
    return res.status(429).json({ error: `Hanggang ${env.caps.scansPerSession} pages lang bawat session.` });
  }

  try {
    const result = await extractPage(imageDataUrl, session.id);
    await repo.setSessionPage(session.id, result.text, session.scanCount + 1);
    await repo.addTurn({ sessionId, speaker: "learner", text: `Ito ang nasa aking pahina: ${result.text}`, lang: session.homeLang, flagged: false });
    res.json({ text: result.text, items: result.items, confidence: result.confidence, mocked: result.mocked });
  } catch (err) {
    res.status(502).json({ error: "Hindi mabasa ang pahina. Subukan ulit, o i-type ang problema.", detail: String(err).slice(0, 200) });
  }
});

router.post("/api/session/end", async (req, res) => {
  const schema = z.object({ sessionId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const session = await repo.getSession(parsed.data.sessionId);
  if (!session) return res.status(404).json({ error: "Unknown session" });
  const minutes = sessionMinutes(session.startedAt, session.endedAt);
  await repo.endSession(session.id, Number(minutes.toFixed(2)));
  const open = await repo.listOpenErrors(session.profileId);
  res.json({ minutes: Number(minutes.toFixed(2)), openErrors: open.length });
});

// ── The Error Notebook ─────────────────────────────────────────────────────
router.get("/api/notebook/:profileId", async (req, res) => {
  const errors = await repo.listOpenErrors(req.params.profileId);
  res.json({
    profileId: req.params.profileId,
    openErrors: errors.map((e) => ({ skill: e.skill, subject: e.subject, attempts: e.attempts, lastSeenAt: e.lastSeenAt })),
  });
});
