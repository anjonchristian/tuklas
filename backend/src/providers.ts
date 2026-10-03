import { createHash, randomUUID } from "node:crypto";
import { env } from "./env";
import { getLanguage } from "./languages";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI-compatible chat completion against OpenCode Go. */
export async function chatComplete(
  messages: ChatMessage[],
  conversationId: string,
): Promise<{ text: string; model: string; tokens: number; mocked: boolean }> {
  if (!env.opencodeApiKey) {
    return { text: "", model: "mock", tokens: 0, mocked: true };
  }

  const res = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.opencodeApiKey}`,
      "User-Agent": env.userAgent,
      "x-opencode-session": conversationId || `tuklas-${randomUUID()}`,
    },
    body: JSON.stringify({
      model: env.llmModel,
      messages,
      temperature: 0.4,
      max_tokens: env.llmMaxTokens,
      reasoning_effort: env.llmReasoningEffort,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? "",
    model: data.model ?? env.llmModel,
    tokens: data.usage?.total_tokens ?? 0,
    mocked: false,
  };
}

export interface ExtractedItem {
  number: string;
  text: string;
}

export interface VisionResult {
  text: string;
  items: ExtractedItem[];
  confidence: number;
  mocked: boolean;
}

const VISION_PROMPT = `Extract ALL text from this page in reading order. Preserve numbers and equations exactly.
Detect numbered items and return them as an array. Return JSON:
{ "text": string, "items": [{ "number": string, "text": string }], "confidence": number }.
Do not solve anything. Do not add words that are not on the page.`;

/** Extract text from a worksheet image (data URL) using the vision model. */
export async function extractPage(imageDataUrl: string, sessionId: string): Promise<VisionResult> {
  if (!env.opencodeApiKey) {
    const items: ExtractedItem[] = [
      { number: "1", text: "3 + 4 = ___" },
      { number: "2", text: "8 - 2 = ___" },
    ];
    return { text: items.map((i) => `${i.number}. ${i.text}`).join("   "), items, confidence: 0.9, mocked: true };
  }

  const res = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.opencodeApiKey}`,
      "User-Agent": env.userAgent,
      "x-opencode-session": sessionId || `tuklas-${randomUUID()}`,
    },
    body: JSON.stringify({
      model: env.visionModel,
      temperature: 0,
      max_tokens: env.llmMaxTokens,
      reasoning_effort: env.llmReasoningEffort,
      messages: [
        { role: "system", content: VISION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the page as JSON." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Vision request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as Partial<VisionResult>;
      if (typeof parsed.text === "string") {
        return {
          text: parsed.text,
          items: Array.isArray(parsed.items) ? parsed.items : [],
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
          mocked: false,
        };
      }
    } catch {
      // fall through
    }
  }
  return { text: raw, items: [], confidence: 0.4, mocked: false };
}

export interface TtsResult {
  audioBase64: string;
  mime: string;
  cached: boolean;
  chars: number;
}

/** Speech-to-text via ElevenLabs Scribe. Auto-detects the spoken language. */
export async function transcribe(
  audio: Buffer,
  mime: string,
): Promise<{ text: string; language: string }> {
  if (!env.elevenLabsKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mime }), "audio.webm");
  form.append("model_id", "scribe_v1");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsKey },
    body: form,
  });

  if (!res.ok) throw new Error(`STT failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { text?: string; language_code?: string };
  return { text: data.text?.trim() ?? "", language: data.language_code ?? "" };
}

const audioCache = new Map<string, { audioBase64: string; mime: string }>();

/** Synthesize speech with ElevenLabs. Returns null to signal "use browser voice". */
export async function synthesize(text: string, homeLang: string): Promise<TtsResult | null> {
  const lang = getLanguage(homeLang);
  if (lang.voice.provider !== "elevenlabs" || !env.elevenLabsKey) return null;

  const voiceId = process.env[lang.voice.voiceEnv] || env.defaultVoice;
  const model = lang.voice.model;
  const key = createHash("sha256").update(`${text}|${voiceId}|${model}`).digest("hex");

  const hit = audioCache.get(key);
  if (hit) return { ...hit, cached: true, chars: text.length };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": env.elevenLabsKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
    },
  );

  if (!res.ok) throw new Error(`TTS request failed: ${res.status} ${await res.text()}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const entry = { audioBase64: buffer.toString("base64"), mime: "audio/mpeg" };
  audioCache.set(key, entry);
  return { ...entry, cached: false, chars: text.length };
}
