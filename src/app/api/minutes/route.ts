import { NextResponse } from "next/server";
import { getSession, minutesSnapshot } from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  return NextResponse.json(minutesSnapshot(session));
}
