import { NextResponse } from "next/server";
import { chatComplete, type LlmMessage } from "@/lib/providers/llm";
import { synthesize } from "@/lib/providers/tts";
import { enforceHintPolicy } from "@/lib/tutor/postprocess";
import { buildSystemPrompt } from "@/lib/tutor/prompt";
import {
  addTurn,
  getSession,
  minutesSnapshot,
  recordCost,
  RATES,
  sessionMinutes,
  CAPS,
} from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string; text?: string };
  const sessionId = body.sessionId ?? "";
  const text = (body.text ?? "").trim();

  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.state !== "active") {
    return NextResponse.json({ error: "Session has ended" }, { status: 409 });
  }
  if (!text) return NextResponse.json({ error: "Empty turn" }, { status: 400 });

  // Hard cap, enforced before any billable work (spec 03, Req 3).
  if (sessionMinutes(session) >= CAPS.minutesPerSession) {
    return NextResponse.json(
      {
        error: `Tapos na ang session (${CAPS.minutesPerSession} min). Balik ulit!`,
        capped: true,
        minutes: minutesSnapshot(session),
      },
      { status: 429 },
    );
  }

  session.questionCount += 1;
  addTurn(session.id, { speaker: "learner", text, lang: session.homeLang });

  const systemPrompt = buildSystemPrompt({
    homeLang: session.homeLang,
    level: session.level,
    subject: session.subject,
    topic: session.topic,
    pageContext: session.pageContext,
  });

  const history: LlmMessage[] = session.turns.slice(-6).map((t) => ({
    role: t.speaker === "learner" ? "user" : "assistant",
    content: t.text,
  }));

  const llm = await chatComplete(
    [{ role: "system", content: systemPrompt }, ...history],
    session.homeLang,
    session.id,
  );

  const filtered = enforceHintPolicy(llm.text, Boolean(session.pageContext));
  addTurn(session.id, {
    speaker: "tutor",
    text: filtered.text,
    lang: session.homeLang,
    flagged: filtered.flagged,
  });

  if (!llm.mocked) {
    recordCost(session.id, {
      kind: "llm",
      model: llm.model,
      units: llm.promptTokens + llm.completionTokens,
      costPhp: ((llm.promptTokens + llm.completionTokens) / 1000) * RATES.llmPer1kTokens,
      cached: false,
    });
  }

  let audio: { base64: string; mime: string; cached: boolean } | null = null;
  try {
    const tts = await synthesize(filtered.text, session.homeLang);
    if (tts) {
      audio = { base64: tts.audioBase64, mime: tts.mime, cached: tts.cached };
      recordCost(session.id, {
        kind: "tts",
        model: session.homeLang,
        units: tts.chars,
        costPhp: tts.cached ? 0 : (tts.chars / 1000) * RATES.ttsPer1kChars,
        cached: tts.cached,
      });
    }
  } catch {
    // TTS failure must not break the turn; the client falls back to browser speech.
    audio = null;
  }

  return NextResponse.json({
    reply: {
      text: filtered.text,
      lang: session.homeLang,
      flagged: filtered.flagged,
      reasons: filtered.reasons,
    },
    audio,
    mocked: { llm: llm.mocked },
    minutes: minutesSnapshot(session),
  });
}
