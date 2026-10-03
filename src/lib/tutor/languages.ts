export type LangCode = "fil" | "ceb" | "ilo" | "war";

export interface LanguageConfig {
  code: LangCode;
  /** Endonym, shown to the learner. */
  label: string;
  englishName: string;
  region: string;
  /** Tutor voice (ElevenLabs). Cebuano needs Eleven v3; Ilocano/Waray have no production voice yet. */
  voice: {
    provider: "elevenlabs" | "none";
    /** ElevenLabs model id; Cebuano requires eleven_v3. */
    model: string;
    voiceEnv: string;
    elevenLang: string | null;
  };
  /** Learner speech (Web Speech API in the browser). */
  asr: {
    bcp47: string;
    webSpeechSupported: boolean;
    note?: string;
  };
  /** Fallback when no ElevenLabs key is configured. */
  browserVoice: string;
  status: "ready" | "beta" | "planned";
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  fil: {
    code: "fil",
    label: "Filipino",
    englishName: "Filipino / Tagalog",
    region: "Nationwide",
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
      note: "No browser Cebuano ASR. Falls back to Filipino recognition; the tutor still answers in Cebuano.",
    },
    browserVoice: "fil-PH",
    status: "beta",
  },
  ilo: {
    code: "ilo",
    label: "Ilocano",
    englishName: "Ilocano",
    region: "Ilocos, Cagayan Valley",
    voice: { provider: "none", model: "eleven_v3", voiceEnv: "VOICE_ILO", elevenLang: null },
    asr: { bcp47: "fil-PH", webSpeechSupported: false, note: "Roadmap." },
    browserVoice: "fil-PH",
    status: "planned",
  },
  war: {
    code: "war",
    label: "Waray",
    englishName: "Waray-Waray",
    region: "Eastern Visayas",
    voice: { provider: "none", model: "eleven_v3", voiceEnv: "VOICE_WAR", elevenLang: null },
    asr: { bcp47: "fil-PH", webSpeechSupported: false, note: "Roadmap." },
    browserVoice: "fil-PH",
    status: "planned",
  },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LangCode[];

export function isLangCode(value: string): value is LangCode {
  return LANGUAGE_CODES.includes(value as LangCode);
}

export function getLanguage(code: string): LanguageConfig {
  return isLangCode(code) ? LANGUAGES[code] : LANGUAGES.fil;
}
