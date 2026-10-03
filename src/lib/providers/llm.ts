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
/** The tutor only needs a one-line reply; disable the model's chain-of-thought. */
const REASONING_EFFORT = process.env.LLM_REASONING_EFFORT ?? "none";

/** Demo replies that still follow the teaching method (one step + a question back). */
const MOCK_REPLIES: Record<string, string[]> = {
  fil: [
    "Sige, tulungan kita. Ang tawag dito ay **addition** — dagdagin natin ang 4 sa 3. Ikaw naman, pila kaya lahat?",
    "Magaling! Ito naman ay **subtraction** — kuhaan natin ang 2 sa 8. Ano kaya ang natitira?",
  ],
  ceb: [
    "Sige, tabangan tika. Ang tawag ani mao ang **addition** — idugang nato ang 4 sa 3. Ikaw naman, pila kaha tanan?",
    "Maayo! Kini mao ang **subtraction** — kuhaon nato ang 2 sa 8. Pila kaha ang mahabilin?",
  ],
  ilo: [
    "Sige, tulungan ka. Ti maawagan daytoy ket **addition** — inayon tayo ti 4 iti 3. Sika naman, mano kadi amin?",
  ],
  war: [
    "Sige, buligan tika. An tawag hini amo an **addition** — dugangon naton an 4 ha 3. Ikaw naman, pira ba ngatanan?",
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
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.4,
      max_tokens: MAX_TOKENS,
      reasoning_effort: REASONING_EFFORT,
    }),
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
