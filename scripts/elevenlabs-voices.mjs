import fs from "node:fs";
import path from "node:path";

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return null;
  const match = fs.readFileSync(envPath, "utf8").match(/^\s*ELEVENLABS_API_KEY=(.+)$/m);
  return match ? match[1].trim() : null;
}

const key = loadKey();
if (!key) {
  console.error("No ELEVENLABS_API_KEY found (env or .env.local).");
  process.exit(1);
}

const headers = { "xi-api-key": key };

async function get(url) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function row(v) {
  return [
    (v.name ?? "?").slice(0, 26).padEnd(26),
    v.voice_id ?? "?",
    (v.category ?? "").padEnd(12),
    (v.language ?? v.labels?.language ?? "").padEnd(8),
    (v.gender ?? v.labels?.gender ?? "").padEnd(7),
    (v.accent ?? v.labels?.accent ?? v.labels?.description ?? "").slice(0, 16),
  ].join(" | ");
}

try {
  const sub = await get("https://api.elevenlabs.io/v1/user/subscription");
  console.log(`Tier: ${sub.tier}  chars: ${sub.character_count}/${sub.character_limit}`);
} catch (err) {
  console.log("subscription:", String(err).slice(0, 120));
}

console.log("\n== Your voices (includes defaults) ==");
try {
  const mine = await get("https://api.elevenlabs.io/v1/voices");
  console.log("count:", mine.voices.length);
  for (const v of mine.voices) console.log(row(v));
} catch (err) {
  console.log("failed:", String(err).slice(0, 200));
}

const searches = [
  ["Filipino (language=fil)", "https://api.elevenlabs.io/v1/shared-voices?language=fil&page_size=30"],
  ["Tagalog search", "https://api.elevenlabs.io/v1/shared-voices?search=tagalog&page_size=30"],
  ["Cebuano search", "https://api.elevenlabs.io/v1/shared-voices?search=cebuano&page_size=30"],
  ["Bisaya search", "https://api.elevenlabs.io/v1/shared-voices?search=bisaya&page_size=30"],
  ["Filipino accent", "https://api.elevenlabs.io/v1/shared-voices?accent=filipino&page_size=30"],
];

for (const [label, url] of searches) {
  console.log(`\n== ${label} ==`);
  try {
    const data = await get(url);
    if (!data.voices?.length) console.log("(none)");
    for (const v of data.voices ?? []) {
      console.log(row(v));
      if (v.preview_url) console.log("   preview:", v.preview_url);
    }
  } catch (err) {
    console.log("failed:", String(err).slice(0, 200));
  }
}
