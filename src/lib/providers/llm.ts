import { getLanguage } from "@/lib/tutor/languages";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  mocked: boolean;
}

const BASE_URL = process.env.LLM_PROVIDER_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.LLM_MODEL ?? "deepseek-v4.1-flash";
/** OpenCode Go requires clients to identify themselves with a non-generic user agent. */
const USER_AGENT = process.env.OPENCODE_USER_AGENT ?? "tuklas/0.1.0";
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 1500;

/** Demo replies that still follow the teaching method (one step + a question back). */
const MOCK_REPLIES: Record<string, string[]> = {
  fil: [
    "Sige, tulungan kita. Unang hakbang: dagdagin natin ang 3 at 4, kaya 7. Ano sa tingin mo ang susunod nating gawin?",
    "Magaling! Ngayon, tingnan natin ang bawas. Ilan ang natitira kapag kinuha natin ang 2 sa 8?",
  ],
  ceb: [
    "Sige, tabangan tika. Unang lakang: idugang nato ang 3 ug 4, so 7. Unsa sa imong hunahuna ang sunod natong buhaton?",
    "Maayo! Karon, tan-awon nato ang kuhaan. Pila ang mahabilin kung kuhaon nato ang 2 sa 8?",
  ],
  ilo: [
    "Sige, tulungan ka. Umuna nga addang: inayon tayo ti 3 ken 4, isu a 7. Ania ti pagarupem a sumaruno?",
  ],
  war: [
    "Sige, buligan tika. Una nga tikang: dugangon naton an 3 ngan 4, salit 7. Ano sa imo hunahuna an sunod?",
  ],
};

function mockReply(messages: LlmMessage[], homeLang: string): string {
  const lang = getLanguage(homeLang);
  const pool = MOCK_REPLIES[lang.code] ?? MOCK_REPLIES.fil;
  const userTurns = messages.filter((m) => m.role === "user").length;
  return pool[userTurns % pool.length];
}

export async function chatComplete(
  messages: LlmMessage[],
  homeLang = "fil",
  sessionId?: string,
): Promise<LlmResult> {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENCODE_API_KEY;

  if (!apiKey) {
    return {
      text: mockReply(messages, homeLang),
      model: "mock",
      promptTokens: 0,
      completionTokens: 0,
      mocked: true,
    };
  }

  // A stable per-conversation id keeps OpenCode Go routing and prompt caching efficient.
  const conversation = sessionId ?? `tuklas-${Date.now().toString(36)}`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": USER_AGENT,
      "x-opencode-session": conversation,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, max_tokens: MAX_TOKENS }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? "",
    model: data.model ?? MODEL,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    mocked: false,
  };
}
