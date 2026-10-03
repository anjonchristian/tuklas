import { createHash } from "node:crypto";
import { getLanguage } from "@/lib/tutor/languages";

export interface TtsResult {
  audioBase64: string;
  mime: string;
  cached: boolean;
  chars: number;
  mocked: boolean;
}

/** Cache by sha256(text + voice + model) — the single biggest cost lever (spec 04, §5). */
const audioCache = new Map<string, { audioBase64: string; mime: string }>();

/** Fallback voice id so TTS works with just an API key (overridable per language). */
const FALLBACK_VOICE = process.env.ELEVENLABS_DEFAULT_VOICE ?? "Xb7hH8MSUJpSbSDYk0k2"; // Alice — Clear, Engaging Educator (premade)

function voiceFor(homeLang: string): { voiceId: string; model: string } | null {
  const lang = getLanguage(homeLang);
  if (lang.voice.provider !== "elevenlabs") return null;
  const voiceId = process.env[lang.voice.voiceEnv] || FALLBACK_VOICE;
  return { voiceId, model: lang.voice.model };
}

export async function synthesize(text: string, homeLang: string): Promise<TtsResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voice = voiceFor(homeLang);

  // No voice configured: the client falls back to the browser's speech synthesis.
  if (!voice || !voice.voiceId) return null;

  const key = createHash("sha256").update(`${text}|${voice.voiceId}|${voice.model}`).digest("hex");
  const hit = audioCache.get(key);
  if (hit) {
    return { ...hit, cached: true, chars: text.length, mocked: false };
  }

  if (!apiKey) {
    // Voice id configured but no key: still let the client fall back.
    return null;
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: voice.model }),
    },
  );

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status} ${await res.text()}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const entry = { audioBase64: buffer.toString("base64"), mime: "audio/mpeg" };
  audioCache.set(key, entry);
  return { ...entry, cached: false, chars: text.length, mocked: false };
}
