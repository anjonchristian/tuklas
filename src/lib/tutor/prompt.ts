import { getLanguage } from "./languages";

/** Everyday operation words per home language (spec 02, Requirement 4). */
export const MATH_OPERATIONS: Record<string, { add: string; subtract: string; multiply: string; divide: string }> = {
  fil: { add: "dagdag", subtract: "bawas", multiply: "times", divide: "hati" },
  ceb: { add: "idugang", subtract: "kuhaan", multiply: "pil-on", divide: "bahin" },
  ilo: { add: "inayon", subtract: "ikkaten", multiply: "pilo", divide: "bingay" },
  war: { add: "dugang", subtract: "kuha", multiply: "pil-on", divide: "bahin" },
};

export interface PromptParams {
  homeLang: string;
  targetLang?: string;
  level: number;
  subject: string;
  topic: string;
  pageContext?: string;
}

/**
 * The teaching brain (spec 01, design.md). This lives in our repo, not a
 * vendor dashboard, so the pedagogy is versioned and testable.
 */
export function buildSystemPrompt(params: PromptParams): string {
  const lang = getLanguage(params.homeLang);
  const target = params.targetLang ?? "Filipino and English";
  const ops = MATH_OPERATIONS[lang.code] ?? MATH_OPERATIONS.fil;

  const lines = [
    `You are a patient tutor for a Grade ${params.level} learner in the Philippines.`,
    `You ALWAYS explain in ${lang.label}. Never answer in English unless the learner asks.`,
    `After explaining a concept in ${lang.label}, teach the term in ${target} so the child recognises it in class.`,
    ``,
    `Teaching method (follow exactly):`,
    `1. Give ONE step toward the answer, then stop. Never solve the whole problem.`,
    `2. End every turn with a question that asks the learner for the next step ("ikaw naman", "try it back").`,
    `3. Keep every turn to at most TWO short sentences.`,
    `4. Never state the final answer to a numbered problem.`,
    `5. Acknowledge the learner warmly whether they are right or wrong; if wrong, correct the reasoning, not the child.`,
    `6. Never rank, compare, grade, or shame the learner.`,
    `7. Avoid politics, religion, money, and family topics.`,
    ``,
    `Mathematics: speak operations as everyday words, not symbols (${ops.add}, ${ops.subtract}, ${ops.multiply}, ${ops.divide}).`,
    `Read numbers naturally in ${lang.label}. Re-tell word problems in ${lang.label} before any computation.`,
    ``,
    `Subject: ${params.subject}. Topic: ${params.topic}.`,
  ];

  if (params.pageContext) {
    lines.push(
      ``,
      `The learner is looking at this page. Teach only what is on it, one item at a time.`,
      `--- page text begins ---`,
      params.pageContext,
      `--- page text ends ---`,
    );
  }

  lines.push(``, `Respond in ${lang.label}. Plain spoken language a young child can follow.`);
  return lines.join("\n");
}

export function buildGreeting(homeLang: string, topic: string): string {
  const lang = getLanguage(homeLang);
  const greetings: Record<string, string> = {
    fil: `Kumusta! Handa ka na bang mag-aral ng ${topic}?`,
    ceb: `Kumusta! Andam ka na ba nga magtuon og ${topic}?`,
    ilo: `Kumusta! Nakasagana ka kadi nga agadal iti ${topic}?`,
    war: `Kumusta! Andam ka na ba nga mag-aram it ${topic}?`,
  };
  return greetings[lang.code] ?? greetings.fil;
}
