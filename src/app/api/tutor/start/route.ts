import { NextResponse } from "next/server";
import { getLanguage, isLangCode, type LangCode } from "@/lib/tutor/languages";
import { buildGreeting } from "@/lib/tutor/prompt";
import { addTurn, checkStartCaps, createSession, minutesSnapshot } from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    profileId?: string;
    nickname?: string;
    homeLang?: string;
    level?: number;
    subject?: string;
    topic?: string;
  };

  const profileId = (body.profileId ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const caps = checkStartCaps(profileId);
  if (!caps.ok) {
    return NextResponse.json({ error: caps.reason, retryAfter: caps.retryAfter }, { status: 429 });
  }

  const requestedLang = body.homeLang ?? "";
  const homeLang: LangCode = isLangCode(requestedLang) ? requestedLang : "fil";
  const subject = body.subject?.trim() || "Math";
  const topic = body.topic?.trim() || "addition";

  const session = createSession({
    profileId,
    nickname: body.nickname?.trim() || "Learner",
    homeLang,
    level: Number(body.level) || 1,
    subject,
    topic,
  });

  const greeting = buildGreeting(homeLang, topic);
  addTurn(session.id, { speaker: "tutor", text: greeting, lang: homeLang });

  return NextResponse.json({
    sessionId: session.id,
    greeting,
    language: getLanguage(homeLang),
    minutes: minutesSnapshot(session),
  });
}
