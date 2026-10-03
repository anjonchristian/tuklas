import { NextResponse } from "next/server";
import { allSessions, costTotalPhp, sessionMinutes } from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = allSessions();
  const today = new Date().toDateString();

  const active = all.filter((s) => s.state === "active").length;
  const todays = all.filter((s) => new Date(s.startedAt).toDateString() === today);

  return NextResponse.json({
    version: process.env.npm_package_version ?? "0.1.0",
    activeSessions: active,
    sessionsToday: todays.length,
    minutesToday: Number(todays.reduce((sum, s) => sum + sessionMinutes(s), 0).toFixed(2)),
    costTodayPhp: Number(todays.reduce((sum, s) => sum + costTotalPhp(s), 0).toFixed(4)),
    providers: {
      llm: (process.env.LLM_API_KEY ?? process.env.OPENCODE_API_KEY) ? "opencode-go" : "mock",
      tts: process.env.ELEVENLABS_API_KEY ? "live" : "browser-fallback",
      vision: (process.env.VISION_API_KEY ?? process.env.OPENCODE_API_KEY ?? process.env.LLM_API_KEY)
        ? "live"
        : "mock",
    },
  });
}
