export type LangCode = string;
export type VoiceStatus = "ready" | "beta" | "planned";
export type LangGroup = "major" | "regional";

export interface LanguageConfig {
  code: LangCode;
  /** Endonym, shown to the learner. */
  label: string;
  englishName: string;
  region: string;
  group: LangGroup;
  /** Tutor voice. Only Tagalog (multilingual v2/v3) and Cebuano (v3) have a real ElevenLabs voice. */
  voice: {
    provider: "elevenlabs" | "none";
    model: string;
    voiceEnv: string;
    elevenLang: string | null;
  };
  /** Learner speech (Web Speech API in the browser). Only fil-PH exists today. */
  asr: {
    bcp47: string;
    webSpeechSupported: boolean;
    note?: string;
  };
  /** Fallback when there is no ElevenLabs voice. */
  browserVoice: string;
  status: VoiceStatus;
}

interface Seed {
  code: string;
  label: string;
  englishName: string;
  region: string;
  group: LangGroup;
}

/**
 * Philippine languages. "Major" are the eight most-spoken; "Regional" adds the
 * rest. Add a line here to support another language — everything else derives.
 */
const SEEDS: Seed[] = [
  // ── Major regional dialects ──
  { code: "ilo", label: "Ilocano", englishName: "Ilocano / Ilokano", region: "Ilocos, Cagayan Valley", group: "major" },
  { code: "hil", label: "Hiligaynon", englishName: "Hiligaynon / Ilonggo", region: "Western Visayas", group: "major" },
  { code: "bcl", label: "Bicolano", englishName: "Bicolano / Central Bikol", region: "Bicol Region", group: "major" },
  { code: "war", label: "Waray-Waray", englishName: "Waray-Waray", region: "Eastern Visayas", group: "major" },
  { code: "pam", label: "Kapampangan", englishName: "Kapampangan", region: "Pampanga, Central Luzon", group: "major" },
  { code: "pag", label: "Pangasinan", englishName: "Pangasinan", region: "Pangasinan", group: "major" },
  // ── Other regional languages ──
  { code: "cbk", label: "Chavacano", englishName: "Chavacano", region: "Zamboanga, Cavite", group: "regional" },
  { code: "tsg", label: "Tausug", englishName: "Tausug", region: "Sulu, Basilan", group: "regional" },
  { code: "mrw", label: "Maranao", englishName: "Maranao", region: "Lanao", group: "regional" },
  { code: "mdh", label: "Maguindanaon", englishName: "Maguindanaon", region: "Maguindanao", group: "regional" },
  { code: "krj", label: "Kinaray-a", englishName: "Kinaray-a", region: "Antique", group: "regional" },
  { code: "akl", label: "Aklanon", englishName: "Aklanon", region: "Aklan", group: "regional" },
  { code: "sgd", label: "Surigaonon", englishName: "Surigaonon", region: "Surigao", group: "regional" },
  { code: "msb", label: "Masbateño", englishName: "Masbateño", region: "Masbate", group: "regional" },
  { code: "rol", label: "Romblomanon", englishName: "Romblomanon", region: "Romblon", group: "regional" },
  { code: "ibg", label: "Ibanag", englishName: "Ibanag", region: "Cagayan", group: "regional" },
  { code: "itv", label: "Itawis", englishName: "Itawis", region: "Cagayan", group: "regional" },
  { code: "ivv", label: "Ivatan", englishName: "Ivatan", region: "Batanes", group: "regional" },
  { code: "kne", label: "Kankanaey", englishName: "Kankanaey", region: "Cordillera", group: "regional" },
  { code: "ifk", label: "Ifugao", englishName: "Tuwali Ifugao", region: "Ifugao", group: "regional" },
  { code: "bnc", label: "Bontoc", englishName: "Bontoc", region: "Mountain Province", group: "regional" },
  { code: "xsb", label: "Sambal", englishName: "Sambal", region: "Zambales", group: "regional" },
  { code: "cyo", label: "Cuyonon", englishName: "Cuyonon", region: "Palawan", group: "regional" },
  { code: "plw", label: "Palawano", englishName: "Palawano", region: "Palawan", group: "regional" },
  { code: "agn", label: "Agutaynen", englishName: "Agutaynen", region: "Palawan", group: "regional" },
  { code: "yka", label: "Yakan", englishName: "Yakan", region: "Basilan", group: "regional" },
  { code: "sml", label: "Sama", englishName: "Sama / Bajau", region: "Sulu, Tawi-Tawi", group: "regional" },
  { code: "iln", label: "Iranun", englishName: "Iranun", region: "Lanao, Maguindanao", group: "regional" },
  { code: "tbl", label: "T'boli", englishName: "T'boli", region: "South Cotabato", group: "regional" },
  { code: "bps", label: "Blaan", englishName: "Blaan", region: "South Cotabato, Sarangani", group: "regional" },
  { code: "syb", label: "Subanen", englishName: "Subanen", region: "Zamboanga Peninsula", group: "regional" },
  { code: "mbt", label: "Manobo", englishName: "Manobo", region: "Agusan, Bukidnon", group: "regional" },
];

function seedConfig(seed: Seed): LanguageConfig {
  return {
    ...seed,
    voice: {
      provider: "none",
      model: "eleven_v3",
      voiceEnv: `VOICE_${seed.code.toUpperCase()}`,
      elevenLang: null,
    },
    asr: {
      bcp47: "fil-PH",
      webSpeechSupported: false,
      note: "Browser Filipino ASR; the tutor still answers in this language.",
    },
    browserVoice: "fil-PH",
    status: "beta",
  };
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  fil: {
    code: "fil",
    label: "Tagalog",
    englishName: "Tagalog / Filipino",
    region: "Nationwide",
    group: "major",
    voice: {
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voiceEnv: "VOICE_FIL",
      elevenLang: "fil",
    },
    asr: { bcp47: "fil-PH", webSpeechSupported: true },
    browserVoice: "fil-PH",
    status: "ready",
  },
  ceb: {
    code: "ceb",
    label: "Cebuano",
    englishName: "Cebuano / Bisaya",
    region: "Central Visayas, Mindanao",
    group: "major",
    voice: {
      provider: "elevenlabs",
      // Cebuano is only in the Eleven v3 language set (multilingual v2 has no Cebuano).
      model: "eleven_v3",
      voiceEnv: "VOICE_CEB",
      elevenLang: "ceb",
    },
    asr: {
      bcp47: "fil-PH",
      webSpeechSupported: false,
      note: "No browser Cebuano ASR. Speak Filipino; the tutor still answers in Cebuano.",
    },
    browserVoice: "fil-PH",
    status: "ready",
  },
  ...Object.fromEntries(SEEDS.map((seed) => [seed.code, seedConfig(seed)])),
};

export const LANGUAGE_CODES: LangCode[] = Object.keys(LANGUAGES);

export function isLangCode(value: string): value is LangCode {
  return value in LANGUAGES;
}

export function getLanguage(code: string): LanguageConfig {
  return LANGUAGES[code] ?? LANGUAGES.fil;
}
