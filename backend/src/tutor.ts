import { getLanguage } from "./languages";

export const MATH_OPERATIONS: Record<string, { add: string; subtract: string; multiply: string; divide: string }> = {
  fil: { add: "dagdag", subtract: "bawas", multiply: "times", divide: "hati" },
  ceb: { add: "idugang", subtract: "kuhaan", multiply: "pil-on", divide: "bahin" },
  ilo: { add: "inayon", subtract: "ikkaten", multiply: "pilo", divide: "bingay" },
  war: { add: "dugang", subtract: "kuha", multiply: "pil-on", divide: "bahin" },
  hil: { add: "dugang", subtract: "kuha", multiply: "pil-on", divide: "bahin" },
};

export interface PromptParams {
  homeLang: string;
  level: number;
  subject: string;
  topic: string;
  pageContext?: string;
  reteach?: { skill: string; wrongAnswer?: string | null; problem?: string | null }[];
}

/**
 * The teaching brain. The model returns JSON so we can log the child's errors
 * as skills (the Error Notebook) instead of throwing them away in chat history.
 */
export function buildSystemPrompt(params: PromptParams): string {
  const lang = getLanguage(params.homeLang);
  const ops = MATH_OPERATIONS[lang.code] ?? MATH_OPERATIONS.fil;
  const target = "Filipino and English";

  const lines = [
    `You are a patient tutor for a Grade ${params.level} learner in the Philippines.`,
    `You ALWAYS explain in ${lang.label}. You teach the term in ${target} after explaining.`,
    ``,
    `Teaching method (follow exactly):`,
    `1. Give ONE step toward the answer, then stop. Never solve the whole problem.`,
    `2. End every turn with a question that asks the learner for the next step.`,
    `3. Keep your spoken reply to at most TWO short sentences.`,
    `4. NEVER state the result of a computation, not even a step's result. Leave results blank: "= ___".`,
    `5. If the learner is wrong, correct the reasoning kindly, never the child. Never rank or shame.`,
    ``,
    `Cognitive code-switching: reason and encourage in ${lang.label}; switch to ${target} for the technical`,
    `terms and symbols (addition, subtraction, the operation names). Blend them like a bilingual teacher.`,
    ``,
    `Mathematics: speak operations as everyday words (${ops.add}, ${ops.subtract}, ${ops.multiply}, ${ops.divide}).`,
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

  if (params.reteach && params.reteach.length > 0) {
    lines.push(
      ``,
      `The learner previously got these skills wrong (your Error Notebook). If they have no page in`,
      `front of them, silently re-teach the OLDEST one first, one step at a time:`,
      ...params.reteach.map(
        (e, i) =>
          `  ${i + 1}. ${e.skill}${e.problem ? ` — problem: ${e.problem}` : ""}${
            e.wrongAnswer ? ` (they answered "${e.wrongAnswer}")` : ""
          }`,
      ),
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
    hil: `Kumusta! Handa ka na bala magtuon sang ${topic}?`,
    bcl: `Kumusta! Andam ka na daw na mag-adal nin ${topic}?`,
    pam: `Kumusta! Makasagana ka na bang magaral ning ${topic}?`,
    pag: `Kumusta! Sikat ka la ya mamasa ed ${topic}?`,
  };
  return greetings[lang.code] ?? greetings.fil;
}

/** A short note to the parent, in the home language, on what to ask at home. */
export function buildParentNotePrompt(params: {
  homeLang: string;
  childName?: string;
  skills: string[];
  level: number;
}): string {
  const lang = getLanguage(params.homeLang);
  return [
    `You write a short note from an AI tutor to a parent in the Philippines.`,
    `Child: ${params.childName ?? "your child"} (Grade ${params.level}).`,
    params.skills.length
      ? `Skills the child is still learning: ${params.skills.join(", ")}.`
      : `The child is doing well; pick one recent topic to review.`,
    ``,
    `Write 2-3 short sentences, in ${lang.label}, telling the parent exactly what to ask at home`,
    `and how — a concrete question using everyday objects. Warm and plain: no jargon, no grades, no shaming.`,
    `Plain text only, no markdown.`,
  ].join("\n");
}

/** Three sentences the child can say in class tomorrow to ask for help. */
export function buildClassScriptPrompt(params: { homeLang: string; skills: string[]; level: number }): string {
  const lang = getLanguage(params.homeLang);
  return [
    `Write THREE short sentences a Grade ${params.level} child can say in class tomorrow, in ${lang.label},`,
    `to ask their teacher for help.`,
    params.skills.length ? `Focus on: ${params.skills.join(", ")}.` : `Pick a common math or reading skill.`,
    `Plain, polite, encouraging. Return only the three sentences, no markdown.`,
  ].join("\n");
}

export interface GradeResult {
  isAnswer: boolean;
  correct: boolean | null;
  expected: string;
  skill: string;
}

/** The grader is a separate, focused call so the Error Notebook is trustworthy. */
export function buildGradePrompt(params: {
  level: number;
  pageContext?: string;
  tutorPrompt?: string;
  focusProblem?: string;
  answer: string;
}): string {
  return [
    `You are grading a Grade ${params.level} learner in the Philippines.`,
    params.pageContext
      ? `The page the learner is working on: ${params.pageContext}`
      : `No page is open; grade against the problem or the tutor's question.`,
    params.focusProblem ? `Problem in focus (from an earlier mistake): ${params.focusProblem}` : ``,
    params.tutorPrompt ? `The tutor just said: ${params.tutorPrompt}` : ``,
    `The learner said: "${params.answer}"`,
    ``,
    `Return ONLY minified JSON: {"is_answer": boolean, "correct": boolean|null, "expected": string, "skill": string}`,
    `- is_answer: true only if the learner stated a numeric result for the problem.`,
    `- correct: true if that result is right, false if wrong, null when is_answer is false.`,
    `- expected: the correct result as text.`,
    `- skill: a short label for the sub-skill (e.g. "addition within 10").`,
    `Be strict: a wrong number is false. Do not hedge.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseGradeJson(raw: string): GradeResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const p = JSON.parse(match[0]) as {
        is_answer?: boolean;
        correct?: boolean | null;
        expected?: string;
        skill?: string;
      };
      return {
        isAnswer: p.is_answer === true,
        correct: typeof p.correct === "boolean" ? p.correct : null,
        expected: typeof p.expected === "string" ? p.expected : "",
        skill: typeof p.skill === "string" ? p.skill.slice(0, 80) : "general",
      };
    } catch {
      // fall through
    }
  }
  return { isAnswer: false, correct: null, expected: "", skill: "general" };
}

const ASK_BACK: Record<string, string> = {
  fil: "Ikaw naman, ano ang susunod?",
  ceb: "Ikaw naman, unsa ang sunod?",
  ilo: "Sika naman, ania ti sumaruno?",
  war: "Ikaw naman, ano an sunod?",
};

const LEAK_PATTERNS = [
  { re: /\b(?:ang\s+)?(?:tubag|sagot|answer)\s*(?:kay|is|ay|mao|:|=)?\s*-?\d+/gi, reason: "answer_phrase", to: " " },
  { re: /=\s*-?\d+/g, reason: "computed_result", to: "= ___" },
  { re: /\b(?:busa|kaya|therefore|so|thus)\s*[,:]?\s*-?\d+/gi, reason: "result_clause", to: " " },
];

export interface FilterResult {
  text: string;
  flagged: boolean;
  reasons: string[];
}

function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
}

function mergeInterjections(sentences: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < sentences.length; i += 1) {
    const words = sentences[i].trim().split(/\s+/).filter(Boolean).length;
    if (words <= 2 && i + 1 < sentences.length) {
      merged.push(`${sentences[i]} ${sentences[i + 1]}`.trim());
      i += 1;
    } else {
      merged.push(sentences[i]);
    }
  }
  return merged;
}

/** Server-side hint policy: block answer leaks, cap at two sentences, keep the ask-back. */
export function enforceHintPolicy(raw: string, homeLang: string): FilterResult {
  let text = raw;
  const reasons: string[] = [];
  for (const { re, reason, to } of LEAK_PATTERNS) {
    const next = text.replace(re, to);
    if (next !== text) {
      reasons.push(`blocked_${reason}`);
      text = next;
    }
  }
  text = text.replace(/\s+/g, " ").trim();

  if (!/[a-z]/i.test(text)) {
    return { text: ASK_BACK[homeLang] ?? ASK_BACK.fil, flagged: true, reasons: [...reasons, "fallback_hint"] };
  }

  let sentences = mergeInterjections(splitSentences(text));
  if (sentences.length > 2) {
    reasons.push("truncated_to_two_sentences");
    const q = sentences.findIndex((s) => s.trim().endsWith("?"));
    sentences = q === sentences.length - 1 && q >= 1 ? [sentences[q - 1], sentences[q]] : sentences.slice(0, 2);
  }
  let out = sentences.join(" ");
  if (!out.includes("?")) out = `${sentences[0] ?? ""} ${ASK_BACK[homeLang] ?? ASK_BACK.fil}`.trim();
  return { text: out, flagged: reasons.length > 0, reasons };
}
