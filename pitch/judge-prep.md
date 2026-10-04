# Tuklas — Judge Prep Sheet

Notes to memorise, the demo beats, and answers to the questions judges actually ask.
Companion to `pitch/deck.md` (slides + 2-minute script) and `pitch/index.html` (deck).

---

## 1. The pitch in three lengths

**10 seconds**
> Tuklas is a voice tutor that teaches Philippine elementary learners in their mother tongue — it works the problem in front of them, one step at a time, and remembers every mistake.

**30 seconds**
> Nine in ten Filipino 10-year-olds can't read an age-appropriate text, and most learners are taught in a language they don't think in. Tuklas is a browser voice tutor that speaks Cebuano, Filipino and 30+ Philippine languages, works from a photo of the child's own worksheet, and never gives the answer — it gives one step and asks the child for the next. Every mistake becomes a skill it re-teaches on a spaced schedule. Free to the learner, no per-seat license.

**60 seconds** — the 30-second version plus: "It's built for elementary learners (Grades 1–6) on shared, low-end phones. No install, no account, a nickname is enough. And because we cache every spoken line and cap each session server-side, a school can see exactly what it costs per class."

---

## 2. Facts to memorise

| Fact | Value |
|---|---|
| Learning poverty | **~9 in 10** Filipino 10-year-olds can't read an age-appropriate text *(World Bank)* |
| Math | **76th of 81** *(PISA 2022)* |
| Policy | **RA 12027 / DepEd Order 35 s. 2025** moved K–3 instruction to Filipino & English while most learners speak another language at home |
| Audience | **Elementary, Grades 1–6** — public schools + ALS centres |
| Languages | **34 Philippine languages** catalogued; **natural voice** for Tagalog & Cebuano today |
| Method | **One step per turn**, then asks the child back — never the answer |
| Memory | **Error Notebook** — errors → skills → spaced re-teach at **1 · 3 · 7 · 14 · 30 days** |
| Caps | **10 min/session · 30 min/week · 3 scans/session · 3 sessions/day** (server-enforced) |
| Cost | Free to the learner, no per-seat; **low and bounded**, not ₱0 |
| Stack | Next.js · Express + TypeScript · OpenCode Go (DeepSeek V4.1 + vision) · ElevenLabs (voice + Scribe STT) · Supabase Postgres · **Render** |

**Stack in one line:** Next.js front end over an Express + TypeScript API; DeepSeek V4.1 grades the answer and tutors; ElevenLabs speaks; Supabase stores; Render hosts.

---

## 3. Demo beats (what to say)

Full script in `pitch/deck.md`. The four beats that must land:

1. **Mother tongue** — "It answers in Cebuano; the math terms come in Filipino and English so she recognises them in class."
2. **It withholds the answer** — "Notice: one step, then *'Ikaw naman, unsa ang sunod?'* It never hands over the result."
3. **It remembers** — open Flashcards: "Every mistake is a skill, not a chat line. It returns on a spaced schedule. ChatGPT forgets her."
4. **Honest cost** — "Free to the learner. Running it isn't free — cached audio and server-side caps keep it low and bounded, and the meter shows the real per-session counters."

---

## 4. Golden rules — never say these

- ❌ **"It works offline."** Voice is server-side (STT, LLM, TTS). It needs a connection. (Offline lesson packs are roadmap only.)
- ❌ **"It's ₱0 to run."** Free to the learner, yes; inference and voice cost money. Say *low and bounded*.
- ❌ **"It's on AWS."** It runs on **Render + Supabase**. Don't imply otherwise.
- ❌ **"Amazon Quick / Kiro built it."** Be precise: Kiro was used for spec-driven planning; Quick and AWS were not used.
- ❌ **"It speaks 34 languages with a real voice."** Two have a natural voice today (Tagalog, Cebuano); the rest teach by text/browser voice.
- ❌ **"It's proven to raise scores."** Say what you can measure, and that a pilot is next.

---

## 5. Judge Q&A

### A. Problem & impact

**"Why does the Philippines need this specifically?"**
Because the barrier is language, not effort. About 9 in 10 10-year-olds can't read an age-appropriate text, and the K–3 policy teaches in Filipino and English while most children speak another language at home. A child is asked to learn in a language they don't yet think in. That's the gap Tuklas closes.

**"Isn't this just a tutoring app? There are many."**
The method is the difference. Most tools translate or answer; Tuklas **withholds the answer** — one step, then it asks the child for the next — and it **keeps a curriculum memory** of each child's errors. That memory is the product.

**"How do you know it's needed in elementary specifically?"**
Reading and math foundations are laid in Grades 1–6. If a child doesn't build them there, everything after compounds. We start where the policy shift and the reading gap collide — the early elementary years — and the product serves Grades 1–6.

### B. Differentiation

**"How is this different from ChatGPT?"**
Four things: it **withholds the answer** instead of giving it; it **speaks the mother tongue** (ChatGPT has no Cebuano voice); it **works from the child's own worksheet**; and it **remembers** — the Error Notebook. And no account, no typing, no per-seat.

**"What's your moat? The model is a commodity."**
Right, the LLM is commodity — so we don't compete there. The moat is the **pedagogy encoded server-side** (one-step hint policy + the Error Notebook), the **language packs as data** (adding a language is data, not a rewrite), and the **cost model** (cached voice + caps). Plus distribution into DepEd/ALS, where a per-class cost statement matters.

**"Why not just use Khan Academy / an existing platform?"**
They're built for schools with connectivity, devices and English. Tuklas is built for a shared low-end phone, a child who can't read yet, and a language those platforms don't speak.

### C. How it works / tech

**"Walk me through a turn."**
The child speaks (or taps a number pad). Server-side STT transcribes. A focused **grader** call returns `{correct, skill, expected}` — so every mistake is logged as a skill. Then a **tutor** call replies with one step and a question back. A server-side policy blocks answer leaks and caps replies at two sentences. Speech is generated in the mother tongue and cached.

**"Why a separate grader call?"**
So the Error Notebook is trustworthy. Grading is its own narrow job; numeric answers are also checked deterministically by comparing numbers, so we don't rely on the model to "decide" correctness.

**"What stops it from giving the answer or hallucinating math?"**
A server-side **hint policy** strips computed results (`= 5` → `= ___`), blocks answer phrases, and truncates to two sentences ending in a question. For numeric answers, correctness is a deterministic compare, not a model judgement. It's not perfect, which is why replies are short and a pilot with human review is the next step.

**"How does the worksheet scan work?"**
A vision model extracts the page text and numbered items; the scan is injected as a turn so the tutor works *that* item. Images are discarded after extraction.

**"What's the latency?"**
Turn-based, roughly 2–4 seconds per turn, with a visible "thinking" state. Cached audio replays in under ~200 ms. We chose turn-based over a real-time agent deliberately: it removed the riskiest integration and is fine for a child.

**"Why a browser, not a native app?"**
No install, no app-store approval, works on a shared low-end phone, one URL. That's reach on the devices these children actually have.

### D. Learning & efficacy

**"How do you measure that learning is happening?"**
Two signals today: the **Error Notebook** (each skill's attempts, interval, and resolution) and session/turn data. A skill that was wrong and later resolved is evidence of re-learning. What we don't have yet is a controlled study — that's the honest next step: a pilot with a comparison group, measuring the same skills.

**"What's your spaced-repetition schedule and why?"**
1, 3, 7, 14, 30 days. A wrong answer opens the skill; a correct answer moves it up the ladder; a miss resets it. It's the standard spacing that balances retention and forgetting, and it's cheap to run offline in the database.

**"Does it replace the teacher?"**
No. It's a **zero-teacher-minute** tool for the hours a teacher can't be one-to-one — and it hands the child three sentences to ask the teacher for help, and the parent a note for home. It makes the people around the child more useful, not redundant.

### E. Cost & sustainability

**"What does it cost a school?"**
Free to the learner, **no per-seat license**. Running it is low and bounded: audio is cached by hash (so repeats are free across restarts), and caps limit each session. Every session records LLM tokens, TTS characters and speech seconds, so we can produce a real cost statement per class — set unit prices and it becomes a ₱ estimate.

**"So is it ₱0?"**
No — and we say so. The learner pays nothing; the operator pays for inference and voice. The design goal is to keep that low and *visible*, not to pretend it's zero.

**"What's the cost driver?"**
Voice, not the LLM. TTS dominates the bill, which is exactly why we cache aggressively — greetings, feedback, number names, operation words, and every repeated phrase. The LLM is a rounding error next to speaking.

**"What's the business model / who pays?"**
No per-seat. Realistic paths: DepEd/division procurement, LGU and NGO programmes, and ALS centres. The per-class cost statement is the artifact that makes that procurement conversation concrete.

**"Why should this keep existing after the hackathon?"**
Because the cost model scales flat-ish with caching, coverage grows by adding language packs (not rebuilding), and the buyers already exist (DepEd, LGUs, NGOs). The roadmap — teacher view, mastery map, regional speech, offline packs — deepens the same wedge.

### F. Privacy, ethics, safety

**"What data do you collect on children?"**
A nickname only — no full name, no account. Postgres has **Row Level Security** enabled. Images are discarded after extraction; audio isn't stored by us. Speech is sent to ElevenLabs for STT/TTS, so we disclose that audio leaves the device to the provider.

**"Is that compliant with the Data Privacy Act?"**
The design is built to minimise personal data (nickname only, RLS, no stored audio), but a real school deployment would require guardian consent and a formal RA 10173 review. We say that plainly rather than claiming compliance we haven't filed.

**"Is the content safe and age-appropriate for a 6-year-old?"**
The system prompt forbids ranking, comparison, shaming, or grades, and corrects the *reasoning*, never the child. Replies are capped at two short sentences. Human review of outputs in a pilot is the next step.

**"What about bias / accuracy of the mother-tongue text?"**
The tutor always answers in the home language and teaches the formal term in Filipino/English. We spot-check with native speakers; a Philippine-tuned regional model is on the roadmap. We don't claim every dialect is perfect today.

### G. Feasibility, scale, ops

**"What breaks at 10,000 learners?"**
Voice cost and latency. Mitigations are already in the design: persistent audio cache, server-side caps, and a stateless container that can scale horizontally. Next step at that scale is autoscaling and self-hosting/voice alternatives to reduce per-character cost.

**"What if the network is bad?"**
Voice needs a connection; we don't pretend otherwise. The UI degrades gracefully, and offline lesson packs (cached audio for a week) are the roadmap answer for no-connection weeks.

**"What's the biggest technical risk?"**
Regional speech recognition on **child** speech — Cebuano and Ilocano are harder than Filipino. Our fallback is real: the child can speak Filipino and the tutor still answers in the mother tongue. The pedagogy survives.

**"Why did you drop the real-time voice agent (Agora)?"**
Turn-based removed the riskiest piece — agent provisioning, channel tokens, provider config — and saved hours. What we gave up is barge-in (interrupting mid-sentence). For a young child, turn-based voice is workable; we say so instead of pretending the difference isn't there.

### H. Kiro / Quick / AWS (hackathon-specific)

**"How did you use Kiro?"**
Kiro shaped the build: the product was planned as Kiro specs (requirements / design / tasks) — the tutor session, multimodal input, minutes & caps, and the architecture swap from a real-time agent to a turn-based DeepSeek + ElevenLabs loop — so the teaching method, the one-step safety policy and the cost caps were written and versioned before any code.

**"And Amazon Quick / AWS?"**
Be direct: **we didn't use Amazon Quick, and we're not on AWS.** The API runs as a Docker container on **Render**, data is **Supabase Postgres**, the image is built and pushed to GHCR by GitHub Actions. We chose those for a fast, low-cost deploy on a hackathon clock — and because the API is a standard container, it can move to AWS (ECS/App Runner, RDS, Polly, Transcribe, Bedrock) without a rewrite if a division requires it.

*(Do not claim Quick or AWS usage. If the organisers require it, say what you'd use them for, not that you did.)*

### I. Adoption & go-to-market

**"How do you get this into schools?"**
Start with a single division and a small pilot; the per-class cost statement and the teacher view (what each child couldn't do alone) are what a division needs to say yes. Language coverage is data, so expansion follows demand.

**"Who's the buyer vs the user?"**
User: the child (and the parent at home). Buyer: the school/division, an LGU, or an NGO/ALS programme. That's why the cost statement and teacher view matter as much as the child UI.

**"What's the wedge that gets you in the door?"**
The language barrier is a policy-level problem (RA 12027 / DO 35). A tool that teaches in the mother tongue *and* produces a defensible per-class cost is an easy pilot to justify.

### J. Team

**"Who's on the team, and who did what?"**
Anjon Christian M. Paderez (Team Representative), Rob Godwin B. Raymundo, Francis Luiji R. Llanto, Jamey Felisha Arguelles. *(Fill in who owned frontend, backend, voice/data, and content before you present.)*

### K. Curveballs

**"If this is so good, why hasn't anyone built it?"**
They've built pieces. The hard part isn't the model — it's the mother-tongue pedagogy, the cost model for voice, and the distribution into public schools. We're betting on those three, not on the model.

**"What will you cut if you don't have time?"**
Teacher view → typed input → image scan → extra languages. Never cut: answering in the mother tongue, the one-step method, the Error Notebook, and the cost meter.

**"What's the one thing you'd change if you started over?"**
We'd test **Cebuano child-speech recognition** in hour one. It's the highest-risk assumption, and it shapes the language strategy.

**"What's next, in one sentence?"**
A pilot in one division, with a teacher view that shows what each child couldn't do alone, and a mastery map across weeks.

---

## 6. Time-buying phrases (when you don't know)

- "Great question — the honest answer is…" *(then give what you do know)*
- "We chose X for speed on a hackathon clock; at scale we'd move to Y."
- "We haven't measured that yet. Here's how we'd measure it."
- "I'd rather be accurate than impressive on that one."

---

## 7. If you only remember five things

1. **Language is the barrier**, not effort.
2. **It withholds the answer** — one step, then asks the child.
3. **The Error Notebook** remembers what the child got wrong.
4. **Free to the learner, low and bounded to run** — not ₱0.
5. **Kiro for specs; Render + Supabase at runtime; not AWS, not Quick.**
