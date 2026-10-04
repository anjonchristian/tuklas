# Tuklas — Backend (Express + TypeScript)

The tutor API: mother-tongue voice tutoring with an **Error Notebook** (mistakes
become skills that get re-taught).

## Layout
```
src/index.ts     Express app (cors, json) + TTS prewarm at boot
src/routes.ts    /health, /api/tutor/start, /tutor/turn, /scan, /stt, /session/end, /session/:id/usage, /notebook/:id
src/context.ts   one repo instance + the persistent TTS cache adapter
src/store.ts     Drizzle schema + repo (Postgres, or in-memory when DATABASE_URL is empty)
src/tutor.ts     teaching prompt, grader prompt, hint policy, greetings
src/providers.ts OpenCode Go (LLM + vision) and ElevenLabs (TTS + Scribe STT)
src/usage.ts     per-session usage counters → optional ₱ estimate
src/prewarm.ts   pre-bake fixed strings (greetings, ask-back) for voiced languages
src/languages.ts Philippine language catalogue
```

## Local dev
```bash
npm install
cp .env.example .env   # fill OPENCODE_API_KEY, ELEVENLABS_API_KEY, DATABASE_URL
npm run dev            # http://localhost:8080 (or PORT)
npm run typecheck
```

Without `DATABASE_URL` the server uses an in-memory store (data resets on restart),
so you can run and demo with zero database setup.

## Cost: cached audio + honest counters

The pitch says *"free to the learner, bounded and low to run"* — this is how that
is made true rather than asserted.

- **Persistent TTS cache.** Every spoken string is keyed by
  `sha256(text|voice|model)` and stored in `tts_cache`. An in-process L1 Map sits
  in front of it. A replay is therefore free **across restarts and instances**,
  not just within one process. `synthesize(text, lang, ttsCache)` is the only path.
- **Prewarm.** At boot, `prewarmTts()` bakes the fixed strings (greetings, the
  ask-back) for every language with a real ElevenLabs voice, so the first learner
  hits a warm cache. Disable with `PREWARM_TTS=0`.
- **Usage counters.** Each session accumulates `llm_tokens`, `tts_chars` (billed
  only on a cache miss), `tts_cached_chars` (the free replays), and `stt_seconds`.
  Read them at `GET /api/session/:id/usage`, and they are included in the
  `/turn`, `/session/end` and `/session/:id` responses.
- **Optional pricing.** Set `PRICE_LLM_PER_MTOK`, `PRICE_TTS_PER_MCHAR` and
  `PRICE_STT_PER_MIN` to turn the counters into an estimated ₱ cost. With none set,
  `costPhp` is `null` — we report the raw counters instead of claiming ₱0.


## Database — Supabase
Project **tulay** (`jnfegvodjkqsqectopfb`, `ap-southeast-1`). The schema is already
applied as migration `init_tuklas_schema`:
`classes`, `profiles`, `sessions`, `turns`, `error_events` — plus `tts_cache`
(persistent audio) and the per-session usage columns added later.

Set `DATABASE_URL` to the **pooled** connection string (Project → Connect →
Connection pooling), then:
```bash
npm run db:push     # only if you change the schema (drizzle-kit)
```

### Row Level Security
The server connects as the `tuklas_app` role (login + `BYPASSRLS`) over
`DATABASE_URL`, so it is not affected by RLS. But the tables are also reachable
through the Supabase REST API with the publishable key. Enable RLS to close that off:
```sql
alter table public.classes      enable row level security;
alter table public.profiles     enable row level security;
alter table public.sessions     enable row level security;
alter table public.turns        enable row level security;
alter table public.error_events enable row level security;
alter table public.tts_cache    enable row level security;
```
With no policies, the anon key is denied everywhere while the server (owner) keeps
full access. Use the service-role key server-side if a REST path is ever needed.

## Deploy
- **Render**: `render.yaml` (rootDir `backend`). Set `DATABASE_URL`,
  `OPENCODE_API_KEY`, `ELEVENLABS_API_KEY` in the dashboard.
- **Docker**: `.github/workflows/backend-docker.yml` builds and pushes
  `ghcr.io/<owner>/<repo>/backend` on push to `main`.
