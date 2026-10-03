import { NextResponse } from "next/server";
import { costTotalPhp, endSession, getSession, minutesSnapshot, sessionMinutes } from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string };
  const session = getSession(body.sessionId ?? "");
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });

  endSession(session.id);

  return NextResponse.json({
    summary: {
      minutes: Number(sessionMinutes(session).toFixed(2)),
      turns: session.turns.length,
      questions: session.questionCount,
      scans: session.scanCount,
      flagged: session.turns.filter((t) => t.flagged).length,
      costPhp: Number(costTotalPhp(session).toFixed(4)),
    },
    minutes: minutesSnapshot(session),
  });
}
