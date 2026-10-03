import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { extractPage, type VisionResult } from "@/lib/providers/vision";
import {
  addTurn,
  CAPS,
  getSession,
  minutesSnapshot,
  recordCost,
  RATES,
} from "@/lib/tutor/store";

export const dynamic = "force-dynamic";

/** Repeat scans of the same page are a cache hit and cost nothing (spec 02, Req 8). */
const scanCache = new Map<string, VisionResult>();

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string; imageDataUrl?: string };
  const sessionId = body.sessionId ?? "";
  const imageDataUrl = body.imageDataUrl ?? "";

  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.state !== "active") {
    return NextResponse.json({ error: "Session has ended" }, { status: 409 });
  }
  if (!imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected an image data URL" }, { status: 400 });
  }
  if (session.scanCount >= CAPS.scansPerSession) {
    return NextResponse.json(
      { error: `Hanggang ${CAPS.scansPerSession} pages lang bawat session.`, capped: true },
      { status: 429 },
    );
  }

  session.scanCount += 1;

  const hash = createHash("sha256").update(imageDataUrl).digest("hex");
  const cached = scanCache.get(hash);
  let result: VisionResult;
  let wasCached = false;

  if (cached) {
    result = cached;
    wasCached = true;
  } else {
    try {
      result = await extractPage(imageDataUrl, session.id);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Hindi mabasa ang pahina. Subukan ulit, o i-type ang problema.",
          detail: err instanceof Error ? err.message.slice(0, 240) : "vision error",
        },
        { status: 502 },
      );
    }
    scanCache.set(hash, result);
  }

  session.pageContext = result.text;
  addTurn(session.id, {
    speaker: "learner",
    text: `Ito ang nasa pahina ko… ${result.text}`,
    lang: session.homeLang,
  });

  if (!result.mocked) {
    recordCost(session.id, {
      kind: "vision",
      model: process.env.VISION_MODEL ?? "vision",
      units: 1,
      costPhp: wasCached ? 0 : RATES.visionPerCall,
      cached: wasCached,
    });
  }

  return NextResponse.json({
    text: result.text,
    items: result.items,
    confidence: result.confidence,
    mocked: result.mocked,
    cached: wasCached,
    minutes: minutesSnapshot(session),
  });
}
