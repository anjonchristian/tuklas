import { env } from "./env";
import { ttsCache } from "./context";
import { synthesize } from "./providers";
import { LANGUAGES } from "./languages";
import { ASK_BACK, buildGreeting } from "./tutor";

const TOPICS = ["Addition", "Subtraction", "Multiplication", "Division"];

/**
 * Pre-bake the fixed strings (greetings, ask-back prompts) for every language
 * with a real voice, so the first learner of each hits a warm cache. Runs once
 * at boot; safe to skip with PREWARM_TTS=0.
 */
export async function prewarmTts(): Promise<void> {
  if (!env.prewarmTts || !env.elevenLabsKey) return;
  const langs = Object.values(LANGUAGES).filter((l) => l.voice.provider === "elevenlabs");
  let generated = 0;
  let failed = 0;
  let cachedChars = 0;
  for (const lang of langs) {
    const texts = [...TOPICS.map((t) => buildGreeting(lang.code, t)), ASK_BACK[lang.code] ?? ASK_BACK.fil];
    for (const text of texts) {
      try {
        const result = await synthesize(text, lang.code, ttsCache);
        if (result) {
          cachedChars += result.chars;
          if (!result.cached) generated += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }
  console.log(`[tuklas] tts prewarm: ${generated} generated, ${cachedChars} chars warm, ${failed} failed`);
}
