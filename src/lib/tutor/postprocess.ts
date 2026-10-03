export interface FilterResult {
  text: string;
  flagged: boolean;
  reasons: string[];
}

/** A question that pushes the thinking back to the learner, per language. */
const ASK_BACK: Record<string, string> = {
  fil: "Ikaw naman, ano ang susunod?",
  ceb: "Ikaw naman, unsa ang sunod?",
  ilo: "Sika naman, ania ti sumaruno?",
  war: "Ikaw naman, ano an sunod?",
};

function askBack(homeLang: string): string {
  return ASK_BACK[homeLang] ?? ASK_BACK.fil;
}

/**
 * Patterns that give the answer away. Volatile numbers are replaced, not just
 * flagged, because "never state the answer" is a product promise (spec 01).
 */
const LEAK_PATTERNS: { re: RegExp; reason: string; replacement: string }[] = [
  // "ang tubag kay 7", "the answer is 7", "sagot ay 7"
  {
    re: /\b(?:ang\s+)?(?:tubag|sagot|answer)\s*(?:kay|is|ay|mao|:|=)?\s*-?\d+/gi,
    reason: "answer_phrase",
    replacement: " ",
  },
  // "3 + 4 = 7" -> "3 + 4 = ___"
  { re: /=\s*-?\d+/g, reason: "computed_result", replacement: "= ___" },
  // "so 7", "busa 7", "therefore 7"
  {
    re: /\b(?:busa|kaya|therefore|so|thus|equals?)\s*[,:]?\s*-?\d+/gi,
    reason: "result_clause",
    replacement: " ",
  },
];

function redactAnswer(raw: string): { text: string; reasons: string[] } {
  let out = raw;
  const reasons: string[] = [];
  for (const { re, reason, replacement } of LEAK_PATTERNS) {
    const next = out.replace(re, replacement);
    if (next !== out) {
      reasons.push(reason);
      out = next;
    }
  }
  return { text: out.replace(/\s+/g, " ").trim(), reasons };
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => s.length > 0);
}

/** Praise and acknowledgements ("Magaling!", "Sige!") shouldn't count as a sentence. */
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

/**
 * Enforces the hint policy server-side so it cannot be talked around in the
 * client: block answer leaks, keep at most two sentences, and always preserve
 * a question back to the learner.
 */
export function enforceHintPolicy(raw: string, homeLang = "fil"): FilterResult {
  const reasons: string[] = [];

  const { text: redacted, reasons: leakReasons } = redactAnswer(raw);
  for (const leak of leakReasons) reasons.push(`blocked_${leak}`);
  const flagged = leakReasons.length > 0;

  if (!/[a-z]/i.test(redacted)) {
    return { text: askBack(homeLang), flagged: true, reasons: [...reasons, "fallback_hint"] };
  }

  let sentences = mergeInterjections(splitSentences(redacted));
  if (sentences.length > 2) {
    reasons.push("truncated_to_two_sentences");
    const questionIndex = sentences.findIndex((s) => s.trim().endsWith("?"));
    if (questionIndex === sentences.length - 1 && questionIndex >= 1) {
      sentences = [sentences[questionIndex - 1], sentences[questionIndex]];
    } else {
      sentences = sentences.slice(0, 2);
    }
  }

  let text = sentences.join(" ");
  if (!text.includes("?")) {
    text = `${sentences[0] ?? ""} ${askBack(homeLang)}`.trim();
  }

  return { text, flagged, reasons };
}
