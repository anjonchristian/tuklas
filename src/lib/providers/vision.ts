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

const BASE_URL = process.env.VISION_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.VISION_MODEL ?? "deepseek-v4-flash-vision-exp";
const USER_AGENT = process.env.OPENCODE_USER_AGENT ?? "tuklas/0.1.0";
const MAX_TOKENS = Number(process.env.VISION_MAX_TOKENS) || 1500;
/** Extraction is mechanical; skip the model's chain-of-thought to avoid empty output. */
const REASONING_EFFORT = process.env.VISION_REASONING_EFFORT ?? "none";

const VISION_PROMPT = `Extract ALL text from this page in reading order. Preserve numbers and equations exactly.
Detect numbered items and return them as an array. Return JSON:
{ "text": string, "items": [{ "number": string, "text": string }], "confidence": number }.
Do not solve anything. Do not add words that are not on the page.`;

function mockExtraction(): VisionResult {
  const items: ExtractedItem[] = [
    { number: "1", text: "3 + 4 = ___" },
    { number: "2", text: "8 - 2 = ___" },
    { number: "3", text: "5 + 5 = ___" },
  ];
  return {
    text: items.map((i) => `${i.number}. ${i.text}`).join("   "),
    items,
    confidence: 0.92,
    mocked: true,
  };
}

function parseJson(raw: string): VisionResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<VisionResult>;
    if (typeof parsed.text !== "string") return null;
    return {
      text: parsed.text,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      mocked: false,
    };
  } catch {
    return null;
  }
}

export async function extractPage(imageDataUrl: string, sessionId?: string): Promise<VisionResult> {
  const apiKey =
    process.env.VISION_API_KEY ?? process.env.OPENCODE_API_KEY ?? process.env.LLM_API_KEY;
  if (!apiKey) return mockExtraction();

  const conversation = sessionId ?? `tuklas-${Date.now().toString(36)}`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": USER_AGENT,
      "x-opencode-session": conversation,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      reasoning_effort: REASONING_EFFORT,
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
  const parsed = parseJson(data.choices?.[0]?.message?.content ?? "");
  return parsed ?? mockExtraction();
}
