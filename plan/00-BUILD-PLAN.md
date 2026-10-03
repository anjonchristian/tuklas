# BUILD PLAN — Mother-tongue voice tutor (Agora)

Rebuilt Oct 3, 2026, ~16:55 UTC. **Submission closes Oct 4, 03:00 UTC (~10 h).** Agora is in, offline is out, and the product is a tutor that teaches in the child's mother tongue.

---

## 1. The product in one paragraph

A child opens the app and talks to a tutor that speaks their mother tongue — Cebuano, Ilocano, Waray, Tagalog — and teaches the subject in front of them, math included. The tutor speaks; the child speaks back and can interrupt. The child can type a question, or **scan a page of their worksheet** so the tutor works through the actual problem they are stuck on. Explanations come in the home language, the subject terms come in Filipino and English. It is a conversation, not a worksheet.

**Barrier (unchanged, and it still carries the pitch): language.** RA 12027 / DO 35 s. 2025 moved K–3 instruction to Filipino and English while most learners speak another language at home. 91% of 10-year-olds cannot read an age-appropriate text. The tutor closes the gap by teaching *in the language the child actually thinks in*.

---

## 2. Architecture

```
Next.js (App Router + Turbopack, Tailwind + shadcn)
   │  agora-rtc-sdk-ng  → joins the channel, plays/publishes audio
   │
   ├── POST /api/tutor/start   → creates the Agora Conversational AI agent
   │      { channel, agentToken, asr, llm(custom), tts, turnDetection }
   │
   ├── POST /api/tutor/llm     → OUR OpenAI-compatible endpoint (custom LLM)
   │      holds the teaching prompt, the hint policy, the page context,
   │      the language rules, and the caps. Agora calls this.
   │
   ├── POST /api/scan          → image → OCR/vision → text → injected as a turn
   ├── POST /api/ask           → typed question → injected as a turn
   ├── GET  /api/minutes       → minutes meter (session, learner, class, day)
   └── GET  /api/teacher/[code]→ what each child could not do alone
```

**The important design choice:** Agora's Conversational AI agent is configured with **our own OpenAI-compatible LLM endpoint**. Agora orchestrates the real-time voice pipeline (ASR → LLM → TTS, with barge-in); *we* own the system prompt, the teaching method, the safety rules and the cost accounting. Never let the tutor's policy live inside a vendor dashboard where you cannot version it.

**Providers behind the agent:** ASR, LLM and TTS are selected per language. Keep Filipino/English on a well-supported provider; for Cebuano and Ilocano, **test ASR quality in the first hour** and, if weak, fall back to "child speaks Filipino, tutor answers in the mother tongue" — which still delivers the pedagogical point.

---

## 3. Mother-tongue teaching method (the actual invention)

Most "AI tutors" translate. This one **teaches in the mother tongue** with a deliberate method encoded in the system prompt:

1. **Explain in the home language**, always. Never answer in English unless asked.
2. **Name the concept in Filipino/English** after explaining it in the mother tongue — the child needs the term for class.
3. **Math stays concrete and spoken**: no symbols read aloud as symbols ("plus" becomes "idugang" — *add these*), worked one step at a time, with a question back after every step.
4. **One step per turn.** Never solve the whole problem. This is the hint policy, and it is also good pedagogy.
5. **"Try it back"** — after each step the tutor asks the child to say the next step out loud. That's how you know it landed.
6. **Never rank, compare, shame, or mention grades.**

---

## 4. Cost — stated once, honestly, then designed around

Agora CAI is quoted at **$0.0265/min** (RaftLabs, Feb 2026) rising to **$0.10/min** (trtc.io comparison, May 2026), with a minimum monthly base fee mentioned on Agora's own CAI pricing page. ASR, LLM and TTS bill on top.

| Stack | Per 10-min session | Per learner / year | Per class (40) / year |
|---|---|---|---|
| Lean | ₱28 | ₱1,120 | **₱44,800** |
| Mid | ₱45 | ₱1,792 | **₱71,680** |
| Heavy | ₱84 | ₱3,360 | **₱134,400** |

*(1 session/week, 40 weeks. The cached-content approach we specced earlier was ₱1,434 per class per year — so voice tutoring is 31×–94× more expensive. Worth knowing before a judge asks.)*

**Two designs keep "minimal cost" alive:**
- **Minutes, not sessions, are the unit.** Hard server-side caps: **10 minutes per session, 3 sessions per learner per week (30 min)**. The **Minutes Meter** shows the learner, class and school their minutes — the successor to the Zero Meter, and the honest answer to "what does this cost us?"
- **Voice where it matters.** Voice for explanation, conversation and "try it back". **Cached audio and text for everything repetitive** — reading a page aloud, vocabulary drills, number names. That is the hybrid that took ₱71,680 down to ₱21,504 per class in my model, and it is a deliberately defensible choice rather than a limitation.

---

## 5. Ten hours, hour by hour

| Hours | Work | Owner |
|---|---|---|
| 0–1 | Next.js + Turbopack + Tailwind + shadcn; Agora keys; **a raw agent that says hello in the channel** — nothing else until this works | Francis |
| 1–2 | `POST /api/tutor/start` + client channel join; verify barge-in | Francis |
| 2–3 | **Custom LLM endpoint** with the mother-tongue teaching prompt; **test Cebuano and Ilocano ASR quality here** | Rob |
| 3–4.5 | Conversation screen: talk, interrupt, transcript, "try it back" prompt | Francis |
| 4.5–6 | **Scan input**: upload → OCR → injected into the conversation + side panel showing extracted text | Jamey + Rob |
| 6–7 | Typed questions; math-in-mother-tongue prompt tuning on a real Grade 1–3 problem | Jamey |
| 7–8 | **Minutes Meter** + server-side caps + session log | Rob |
| 8–9 | Teacher/parent list; privacy pass; latency pass; language check on three real questions | Jamey |
| 9–9.5 | Rehearse twice on the floor phone with venue wifi; record a backup run; deck; submission | all |

**Cut order:** teacher list → typed input → image scan → Cebuano (ship Filipino + one mother tongue).
**Never cut:** the agent answering in the mother tongue, barge-in, the minutes meter. Those three *are* the product.

---

## 6. Demo (three minutes)

1. Judge taps the mic and **speaks to the tutor in Cebuano or Filipino** — the tutor answers in the mother tongue.
2. Judge **interrupts mid-sentence**; the tutor stops and listens. (Say why: real conversation, which is what a child needs.)
3. Judge **scans a worksheet problem**; the tutor works step one, then asks the child for step two — **it does not solve it**.
4. Point at the **Minutes Meter**: 3.4 minutes used, cap 10, class total today.
5. Close: *"Every other tutor makes a Filipino child learn in a language they don't think in. This one teaches math in the language they do."*

---

## 7. Judge Q&A

- **"Why Agora?"** Real-time voice with interruption handling is the only way a five-year-old can use a tutor: they can't type, and turn-based voice feels like a call centre. Agora gives sub-second conversational voice; we own the teaching policy.
- **"What does it cost?"** Quoted per minute, so we meter minutes: 10 per session, 3 sessions a week, visible on screen. A class of forty is roughly ₱44,800–₱134,400 a year at published Agora rates — real money, which is exactly why the meter and the caps exist, and why repetitive practice uses cached audio instead of live minutes.
- **"Doesn't the child just get answers?"** The tutor gives one step and asks the child for the next. There is a written policy and a test case; demo it live on a scanned problem.
- **"What about privacy?"** No recordings retained by us, no audio stored, nickname only; the audio streams through Agora during the session and is not kept.
- **"Which languages?"** Filipino and English fully; one or two mother tongues tested tonight, expanding by adding a language pack, not by rewriting code.
- **"Why not offline?"** We chose conversational voice, which needs a connection. We say that plainly instead of pretending otherwise.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Cebuano/Ilocano ASR on **child** speech | Test in hour 3. Fallback: child speaks Filipino, tutor answers in the mother tongue |
| Latency feels sluggish | Tune turn detection; keep answers to 1–2 sentences; measure first-audio time |
| Agora agent config eats the clock | Build the hello-world agent in hour 0–1 before anything else; use Agora's sample as the starting point |
| Venue wifi | Record a clean run during hour 9 as backup; pre-warm if the agent supports it |
| Cost drift during development | Minutes meter from hour 7; caps enforced server-side from the start |
| Vendor minimum monthly fee | Verify on Agora's pricing page before quoting any number in the deck |
