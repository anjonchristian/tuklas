# Tuklas — Backend (Express + TypeScript)

The tutor API: mother-tongue voice tutoring with an **Error Notebook** (mistakes
become skills that get re-taught).

## Layout
```
src/index.ts     Express app (cors, json)
src/routes.ts    /health, /api/tutor/start, /tutor/turn, /scan, /session/end, /notebook/:id
src/store.ts     Drizzle schema + repo (Postgres, or in-memory when DATABASE_URL is empty)
src/tutor.ts     teaching prompt, grader prompt, hint policy, greetings
src/providers.ts OpenCode Go (LLM + vision) and ElevenLabs (TTS)
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

## Database — Supabase
Project **tulay** (`jnfegvodjkqsqectopfb`, `ap-southeast-1`). The schema is already
applied as migration `init_tuklas_schema`:
`classes`, `profiles`, `sessions`, `turns`, `error_events`.

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
```
With no policies, the anon key is denied everywhere while the server (owner) keeps
full access. Use the service-role key server-side if a REST path is ever needed.

## Deploy
- **Render**: `render.yaml` (rootDir `backend`). Set `DATABASE_URL`,
  `OPENCODE_API_KEY`, `ELEVENLABS_API_KEY` in the dashboard.
- **Docker**: `.github/workflows/backend-docker.yml` builds and pushes
  `ghcr.io/<owner>/<repo>/backend` on push to `main`.
