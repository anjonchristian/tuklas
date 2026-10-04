import { env } from "./env";
import type { SessionRow } from "./store";

export interface UsageView {
  llmTokens: number;
  ttsChars: number;
  ttsCachedChars: number;
  sttSeconds: number;
  /** Estimated pesos for this session, or null when prices are not configured. */
  costPhp: number | null;
  priced: boolean;
}

/**
 * Turn the raw per-session counters into a view. Prices are optional: when no
 * `PRICE_*` env is set, we report the counters and `costPhp: null` rather than
 * pretending the cost is zero.
 */
export function usageView(session: SessionRow | undefined): UsageView {
  const llmTokens = session?.llmTokens ?? 0;
  const ttsChars = session?.ttsChars ?? 0;
  const ttsCachedChars = session?.ttsCachedChars ?? 0;
  const sttSeconds = session?.sttSeconds ?? 0;
  const { llmPerMTok, ttsPerMChar, sttPerMin } = env.price;
  const priced = llmPerMTok > 0 || ttsPerMChar > 0 || sttPerMin > 0;
  const costPhp = priced
    ? Number(
        (
          (llmTokens / 1_000_000) * llmPerMTok +
          (ttsChars / 1_000_000) * ttsPerMChar +
          (sttSeconds / 60) * sttPerMin
        ).toFixed(4),
      )
    : null;
  return { llmTokens, ttsChars, ttsCachedChars, sttSeconds, costPhp, priced };
}
