import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  // Supabase (project: tulay, ap-southeast-1)
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  opencodeApiKey: process.env.OPENCODE_API_KEY ?? process.env.LLM_API_KEY ?? "",
  llmBaseUrl: process.env.LLM_PROVIDER_URL ?? "https://opencode.ai/zen/go/v1",
  llmModel: process.env.LLM_MODEL ?? "deepseek-v4.1-flash",
  llmMaxTokens: num(process.env.LLM_MAX_TOKENS, 1500),
  llmReasoningEffort: process.env.LLM_REASONING_EFFORT ?? "none",
  visionModel: process.env.VISION_MODEL ?? "deepseek-v4-flash-vision-exp",
  userAgent: process.env.OPENCODE_USER_AGENT ?? "tuklas/0.1.0",

  elevenLabsKey: process.env.ELEVENLABS_API_KEY ?? "",
  defaultVoice: process.env.ELEVENLABS_DEFAULT_VOICE ?? "Xb7hH8MSUJpSbSDYk0k2",

  caps: {
    minutesPerSession: num(process.env.CAP_MIN_PER_SESSION, 10),
    minutesPerWeek: num(process.env.CAP_MIN_PER_WEEK, 30),
    scansPerSession: num(process.env.CAP_SCANS_PER_SESSION, 3),
    sessionsPerDay: num(process.env.CAP_SESSIONS_PER_DAY, 3),
  },

  // Optional unit prices — only used to turn the usage counters into an estimate.
  // 0 means "not priced"; the raw counters are still reported.
  price: {
    llmPerMTok: num(process.env.PRICE_LLM_PER_MTOK, 0),
    ttsPerMChar: num(process.env.PRICE_TTS_PER_MCHAR, 0),
    sttPerMin: num(process.env.PRICE_STT_PER_MIN, 0),
  },

  prewarmTts: (process.env.PREWARM_TTS ?? "1") !== "0",
};

export type Env = typeof env;
