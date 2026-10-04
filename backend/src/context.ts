import { makeRepo, type Repo } from "./store";
import type { AudioCache } from "./providers";

// One repo instance for the whole process, plus the persistent TTS cache that
// backs the "cached audio replays cost nothing" claim.
export const repo: Repo = makeRepo();

export const ttsCache: AudioCache = {
  get: (hash) => repo.getCachedAudio(hash),
  put: (hash, audioBase64, mime, chars) => repo.putCachedAudio(hash, audioBase64, mime, chars),
};
