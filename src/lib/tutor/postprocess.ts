export interface FilterResult {
  text: string;
  flagged: boolean;
  reasons: string[];
}

/** Turns that hand over a final answer outright (spec 01, Requirement 4). */
const FINAL_ANSWER_PATTERNS: RegExp[] = [
  /(?:ang\s+tubag|ang\s+sagot|the\s+answer|answer\s+is|sagot\s+ay|tubag\s+mao)\s*(?:kay|is|ay|:)?\s*-?\d+/i,
  /(?:busa|therefore|so)\s+[^.]*\b(?:ang\s+tubag|the\s+answer|sagot|tubag)\b[^.]*\d+/i,
];

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
 * Enforces the hint policy server-side, so it cannot be talked around in the
 * client: at most two sentences, and no outright final answer. The final
 * question (the "ask back") is preserved, never the thing that gets cut.
 */
export function enforceHintPolicy(raw: string, hasPageContext: boolean): FilterResult {
  const reasons: string[] = [];
  let flagged = false;

  const sentences = mergeInterjections(splitSentences(raw));
  let kept = sentences;
  if (sentences.length > 2) {
    reasons.push("truncated_to_two_sentences");
    const questionIndex = sentences.findIndex((s) => s.trim().endsWith("?"));
    if (questionIndex === sentences.length - 1 && questionIndex >= 1) {
      // Keep the meaningful step and the "ask back", drop the lead-in.
      kept = [sentences[questionIndex - 1], sentences[questionIndex]];
    } else {
      kept = sentences.slice(0, 2);
    }
  }
  const text = kept.join(" ");

  if (hasPageContext) {
    for (const pattern of FINAL_ANSWER_PATTERNS) {
      if (pattern.test(text)) {
        flagged = true;
        reasons.push("possible_final_answer");
        break;
      }
    }
  }

  return { text, flagged, reasons };
}
