<p align="center">
  <img src="pitch/icon.png" alt="Tuklas" width="88" />
</p>

<h1 align="center">Tuklas</h1>

<p align="center">
  <strong>A mother-tongue voice tutor for underfunded Philippine classrooms.</strong><br />
  It teaches from the worksheet in the child's hand — one step at a time — and remembers what they got wrong.
</p>

<p align="center">
  <a href="https://tuklas.tnf-ex.tech/"><strong>tuklas.tnf-ex.tech</strong></a>
</p>

<p align="center">
  <a href="https://tuklas.tnf-ex.tech/"><img alt="Live" src="https://img.shields.io/badge/Live-tuklas.tnf--ex.tech-2E7D32?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" /></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&amp;logo=nextdotjs&amp;logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&amp;logo=react&amp;logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" />
  <img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&amp;logo=tailwindcss&amp;logoColor=white" />
  <img alt="shadcn/ui" src="https://img.shields.io/badge/shadcn%2Fui-000000?style=flat-square" />
  <br />
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node_20+-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" />
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?style=flat-square&amp;logo=express&amp;logoColor=white" />
  <img alt="Drizzle ORM" src="https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&amp;logo=postgresql&amp;logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&amp;logo=supabase&amp;logoColor=white" />
  <br />
  <img alt="ElevenLabs" src="https://img.shields.io/badge/ElevenLabs-000000?style=flat-square" />
  <img alt="OpenCode Go" src="https://img.shields.io/badge/OpenCode_Go-DeepSeek_V4.1-6E56CF?style=flat-square" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&amp;logo=docker&amp;logoColor=white" />
  <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&amp;logo=githubactions&amp;logoColor=white" />
  <img alt="Render" src="https://img.shields.io/badge/Render-000000?style=flat-square" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&amp;logo=vercel&amp;logoColor=white" />
</p>

---

**Tuklas** (Filipino: *to discover*) is a voice-first AI tutor that teaches in the language a child
actually thinks in. A learner scans their worksheet, speaks their answer, and the tutor walks them
through **one step at a time** — never handing over the answer. Every mistake is logged as a **skill**
in an *Error Notebook* and re-taught on a spaced schedule, so the tutor remembers the child across
sessions, flashcards, and even a note to their parents.

> [!IMPORTANT]
> A chatbot forgets your child. This one remembers what they got wrong last Tuesday, re-teaches it on
> Thursday, tells their mother in Cebuano what to ask at home, and gives them three sentences to use in
> class tomorrow.

## Why not just use a general chatbot?

| | General chatbot | Tuklas |
|---|---|---|
| Goal | Gives the answer | **Withholds it** — one step, then asks the child back |
| Input | Typing, reading | **Voice + a number pad** — a child who can't read can use it |
| Language | Text in a few languages | **Speaks** Tagalog & Cebuano; teaches 30+ Philippine languages |
| Source | Free chat | **The child's own page** (scanned worksheet) |
| Memory | Forgets | **Error Notebook** — errors → skills → spaced re-teach |
| Access | Account, modern phone, data | **Browser, no account**, low-end shared device |

## Features

- **Mother-tongue voice tutoring** — the tutor speaks and listens in the learner's language
  (Language: Tagalog, Cebuano, and 32 more Philippine languages; the eight most-spoken are listed first).
- **Worksheet scanning** — photograph a page; the tutor teaches *that* problem.
- **Cognitive code-switching** — reasons in the home language, teaches the formal term in Filipino/English.
- **One-step hint policy** — a server-side filter blocks answer leaks and caps replies; the child is always asked for the next step.
- **The Error Notebook** — every mistake becomes a skill, scheduled with spaced repetition (1 · 3 · 7 · 14 · 30 days).
- **Flashcards** — generated from the child's *own* mistakes, spoken aloud, graded *Got it / Missed it*.
- **Note for home** — a plain-language note to the parent, in the mother tongue, on what to practise at home.
- **Class script** — three sentences the child can say in class to ask for help.
- **History & resume** — past lessons with full transcripts; returning learners skip onboarding.
- **Tap-to-answer number pad** — answers work in every language, even without speech recognition.
- **Server-enforced caps** — minutes, scans and sessions are limited so a school knows what it costs.

## How it works

### The Error Notebook

```
child answers wrong → grader returns { correct: false, skill, expected }
                    → error_events row (status open, next_due_at = now)
                    → next session opens by re-teaching it
                    → correct answer → resolveError (interval 1/3/7/14/30 days)
```

This is the spine: a *curriculum memory* no chat transcript has.

### A turn

```
learner (voice → STT, or keypad)
      │
      ▼
grader call ── correct? skill? expected? ──► Error Notebook
      │
      ▼
tutor call ── one step + a question back ──► hint policy ──► text
      │
      ▼
ElevenLabs TTS ──► audio (cached by sha256)
```

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  frontend/  (Next.js)   │  HTTP  │   backend/  (Express + TS)    │
│  landing · tutor wizard │ ─────► │  /tutor · /scan · /stt ·      │
│  session · flashcards   │        │  /flashcards · /parent-note   │
└─────────────────────────┘        └───────────────┬──────────────┘
                                                    │
                       ┌────────────────────────────┼───────────────────────────┐
                       ▼                            ▼                           ▼
              OpenCode Go (DeepSeek V4.1)     ElevenLabs (voice)         Supabase Postgres
              LLM + vision (page scan)        TTS + Scribe STT           errors · sessions · turns
```

| Layer | Choice |
|---|---|
| Interface | Next.js 16 (App Router), Tailwind v4, shadcn/ui |
| API | Express + TypeScript, Dockerized, Drizzle ORM |
| Reasoning + vision | OpenCode Go — DeepSeek V4.1 Flash, vision for page scans |
| Voice | ElevenLabs — `eleven_v3` (Cebuano), `multilingual_v2` (Tagalog), Scribe STT |
| Data | Supabase Postgres (RLS enabled) |
| Hosting | Render (API), Vercel-ready frontend |
| CI | GitHub Actions → builds & pushes the API image to GHCR |

## Getting started

### Prerequisites

- Node.js 20+
- An [OpenCode Go](https://opencode.ai) API key (LLM + vision)
- An [ElevenLabs](https://elevenlabs.io) API key (voice — free tier works)
- Optional: a Supabase Postgres database (the backend runs in-memory without one)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill OPENCODE_API_KEY and ELEVENLABS_API_KEY
npm run dev               # http://localhost:8080
```

> [!NOTE]
> Without `DATABASE_URL` the API uses an in-memory store, so you can run and demo with zero
> database setup. Data resets on restart.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL points at the backend
npm run dev                  # http://localhost:3000
```

Open [http://localhost:3000/app](http://localhost:3000/app). Start a session, scan a worksheet
(or use the number pad), answer, and open **Flashcards** to see the Error Notebook in action.

> [!TIP]
> Voice input uses **server-side STT**, so it works in any browser with `MediaRecorder`. The
> browser's built-in speech recognition (which depends on Google's servers) is not required.

## Configuration

All backend configuration lives in `backend/.env` (see `backend/.env.example`).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **pooled** Postgres connection string (empty → in-memory) |
| `OPENCODE_API_KEY` | OpenCode Go key for the LLM and vision |
| `LLM_MODEL` | `deepseek-v4.1-flash` (or `deepseek-v4-pro` for harder reasoning) |
| `ELEVENLABS_API_KEY` | Voice: TTS and Scribe speech-to-text |
| `VOICE_FIL`, `VOICE_CEB` | ElevenLabs voice IDs per language |
| `CAP_MIN_PER_SESSION`, `CAP_MIN_PER_WEEK`, `CAP_SCANS_PER_SESSION`, `CAP_SESSIONS_PER_DAY` | Server-enforced caps |
| `CORS_ORIGIN` | Allowed origin(s) for the web app |

## Database

The schema (created by `backend/src/store.ts` and applied to Supabase) covers
`classes`, `profiles`, `sessions`, `turns`, and `error_events`.

```bash
cd backend
npm run db:push     # apply the Drizzle schema to DATABASE_URL
```

> [!NOTE]
> Row Level Security is enabled on every table. The server connects as a dedicated app role that
> bypasses RLS; the public (publishable) key is denied, so the tables are not exposed over the
> Supabase REST API.

## Deployment

- **API → Render.** `backend/render.yaml` deploys the service (`rootDir: backend`) with a health
  check at `/health`. Set `DATABASE_URL`, `OPENCODE_API_KEY`, `ELEVENLABS_API_KEY` in the dashboard.
- **Container image.** `.github/workflows/backend-docker.yml` builds `backend/Dockerfile` and pushes
  `ghcr.io/<owner>/<repo>/backend:latest` on every push to `main` (cache enabled).

```bash
docker build -t tuklas-api ./backend
docker run -p 8080:8080 --env-file ./backend/.env tuklas-api
```

## Project structure

```
frontend/   Next.js UI — landing page, tutor wizard, session, flashcards, history
backend/    Express + TypeScript API — tutor, grading, Error Notebook, voice, vision
pitch/      12-slide pitch deck (index.html) + deck.md with speaker notes
plan/       Build specs (product, session, multimodal input, cost, architecture)
.github/    CI — backend Docker image → GHCR
```

## Roadmap

- **Teacher view** — a class code that shows what each child couldn't do alone.
- **Mastery map** — a skill tree (locked · learning · mastered) across weeks.
- **Regional speech** — broaden STT coverage and a Philippine-tuned model for lower-resource languages.
- **Offline lesson packs** — download a week of cached audio to learn with no connection.
- **Kulturang Konteksto** — localise a problem into the child's own world (*palengke*, *mangga*, jeepney fares).

## Pitch & demo

- **Live site:** [tuklas.tnf-ex.tech](https://tuklas.tnf-ex.tech/)
- **Deck:** [`pitch/index.html`](pitch/index.html) — open in a browser (arrow keys / click).
- **Speaker notes & 2-minute script:** [`pitch/deck.md`](pitch/deck.md).

## Team

- **Anjon Christian M. Paderez** — Team Representative
- **Rob Godwin B. Raymundo**
- **Francis Luiji R. Llanto**
- **Jamey Felisha Arguelles**
