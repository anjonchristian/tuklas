# SPEC 01 — Tutor session (Agora agent + mother-tongue teaching)

**Kiro slug:** `tutor-session` · Files: `requirements.md`, `design.md`, `tasks.md`
**Depends on:** SPEC 03 (caps, minutes meter, session log)

---

## requirements.md

### Introduction
A real-time spoken tutoring session. The learner taps start, an Agora Conversational AI agent joins the channel, and the tutor talks with the child in their mother tongue. The child can interrupt at any point. Our own LLM endpoint holds the teaching method, so the pedagogy is ours and versioned in our repo — Agora carries the voice.

### Requirement 1 — One-tap session start
**WHEN** the learner taps the start button **THE SYSTEM SHALL** provision an agent and connect the learner to the channel.
**Acceptance criteria**
- Agent provisioned server-side via our own route; keys never reach the client.
- Learner hears the tutor's greeting within 3 s of tapping, on 4G.
- A failed start retries once, then falls back to text-only mode (Requirement 9).

### Requirement 2 — The tutor speaks the mother tongue
**WHEN** the session starts **THE SYSTEM SHALL** greet and teach in the learner's configured home language.
**Acceptance criteria**
- Home language is a profile setting chosen once, changeable in one tap, defaulting from the device locale where possible.
- The tutor never answers in English unless the learner asks for it.
- Subject terms are taught in Filipino or English *after* the mother-tongue explanation.
- A language-lock check runs on the first two turns; a violation triggers one retry with a stricter instruction, and the event is logged.

### Requirement 3 — Real conversation, with interruption
**WHEN** the learner speaks while the tutor is talking **THE SYSTEM SHALL** stop the tutor's speech and listen.
**Acceptance criteria**
- Barge-in stops playback within ~300 ms.
- Background noise, a sibling's voice, or a cough does not end the learner's turn prematurely.
- Silence for 5 s prompts the tutor to re-ask once in simpler words, then wait.

### Requirement 4 — One step per turn (hint policy)
**WHEN** the tutor responds **THE SYSTEM SHALL** give **one step** toward the answer and finish with a question back to the learner.
**Acceptance criteria**

| Learner asks | Tutor does | Tutor never does |
|---|---|---|
| "Ano ang sagot?" | Names the skill, does step one, asks for step two | Gives the final answer |
| "Paano ito gawin?" | One worked step, then "ikaw naman" | Completes the whole task |
| "Tama ba ito?" | Confirms or corrects with reasoning | Says only right/wrong |
| "Ano ang meaning ng salita?" | Explains in the mother tongue, uses it in a new sentence | — |

- Maximum 2 sentences per turn; over-long output is truncated server-side.
- A post-filter rejects turns that state a final answer for a numbered item.

### Requirement 5 — "Try it back"
**WHEN** a step is completed **THE SYSTEM SHALL** ask the learner to say the next step or repeat the idea in their own words.
**Acceptance criteria**
- The prompt appears at least once every two steps.
- The learner's response is acknowledged warmly regardless of correctness.
- The session log records whether a try-back occurred.

### Requirement 6 — Transcript, no recording
**WHEN** a session runs **THE SYSTEM SHALL** keep a **text** transcript for the session and **SHALL NOT** store any audio.
**Acceptance criteria**
- Transcript is visible to the learner, and to the teacher through the class view.
- No audio file of the learner or tutor is written to storage by us at any point.
- The privacy statement, in the home language, states plainly that audio streams through the voice provider during the session and is not retained.

### Requirement 7 — Session limits, announced kindly
**WHEN** a session approaches its limit **THE SYSTEM SHALL** warn once and then close the session gracefully.
**Acceptance criteria**
- Default 10 minutes; warning at 8 minutes in the home language ("malapit na tayong matapos").
- At the limit the tutor summarises what was covered and says when to return.
- Minutes consumed are recorded to the meter; the next session starts where the last one ended.

### Requirement 8 — Providers configured per language
**WHEN** a session starts **THE SYSTEM SHALL** select ASR, LLM and TTS per the learner's language from server-side configuration.
**Acceptance criteria**
- Our own OpenAI-compatible LLM endpoint is always the LLM, so prompts and policy stay in our repo.
- Voice selection is per language and per provider, configurable by env without a redeploy.
- Provider failure for one language does not break others.

### Requirement 9 — Degrade, never dead-end
**WHEN** a component fails **THE SYSTEM SHALL** degrade in this order: audio-only → text-only conversation → "come back later" message.
**Acceptance criteria**
- Agent start failure → text-only mode with the same tutor prompt.
- RTC degradation → continue as typed conversation.
- Both failing → friendly message in the home language plus the minutes remaining.

### Requirement 10 — Accessible controls
**WHEN** the session screen is used **THE SYSTEM SHALL** be operable one-handed by a child who cannot read.
**Acceptance criteria**
- Mic, stop, and repeat controls ≥64 px, thumb-reachable, distinct shapes.
- Every control has an icon plus a TalkBack label in the home language.
- Session state is communicated visually and by sound, never by colour alone.

### Requirement 11 — Session log
**WHEN** a session ends **THE SYSTEM SHALL** record a structured log.
**Acceptance criteria**
- Fields: profile id, page or topic, start, end, minutes, turn count, languages used, try-backs, flagged turns, cost.
- No names, no audio, no images.
- Feeds the minutes meter and the teacher list.

### Requirement 12 — Parent-visible disclosure
**WHEN** a profile is created **THE SYSTEM SHALL** show a one-screen, plain-language statement of what is and is not stored.
**Acceptance criteria**
- Home language, Grade-3 reading level, no legal jargon.
- States: audio is not recorded; transcript is kept; images are discarded; nickname only.
- One tap to delete everything.

---

## design.md

### Agent provisioning (server-side)
```
POST /api/tutor/start
  body: { profileId, subject, topic, homeLang, level }
  does: 1) cap check (SPEC 03)  2) create channel + agent token
        3) start Agora Conversational AI agent with:
             asr:  { provider: per homeLang, language: homeLang }
             llm:  { url: OUR /api/tutor/llm, model: configured, systemPrompt: teaching prompt }
             tts:  { provider: per homeLang, voice: voiceFor(homeLang) }
             turnDetection: { interrupt: true, silenceTimeoutMs: 5000 }
        4) return { channel, token, appId, expiresAt }
  note: exact field names must be confirmed against current Agora CAI docs on day one.
```

### Our LLM endpoint (the teaching brain)
```
POST /api/tutor/llm        (OpenAI-compatible /v1/chat/completions shape)
System prompt skeleton:
  You are a patient tutor for a Grade {level} learner in the Philippines.
  You ALWAYS explain in {homeLang}. You teach the term in {targetLang} after explaining.
  You give ONE step, then ask the learner for the next step. Maximum 2 sentences.
  You never give the final answer to a numbered problem. You never rank, compare,
  shame, or mention grades. No politics, religion, money or family topics.
  Subject: {subject}. Topic: {topic}. Context from the child's page: {pageContext}.
Post-filter: reject turns >2 sentences, or turns stating a final answer pattern.
```

### Session state machine
```
idle → provisioning → greeting → conversing ⇄ listening → warning → closing → logged
                         ↘ text-only (fallback)         ↘ error (retry once)
```

### Latency budget
| Step | Target |
|---|---|
| Tap → greeting | ≤3 s |
| Learner stops speaking → tutor starts | ≤1.2 s |
| Barge-in stop | ≤300 ms |
| Minute warning | at 8:00 |

### Config
```
AGORA_APP_ID, AGORA_APP_CERT, AGORA_AGENT_ROLE,
LLM_PROVIDER_URL, LLM_API_KEY, LLM_MODEL,
ASR_PROVIDER_{LANG}, TTS_PROVIDER_{LANG}, VOICE_{LANG},
SESSION_MINUTES=10, WARN_AT_MINUTES=8
```

---

## tasks.md
- [ ] 1. **Hello-world agent in the channel before anything else** (hour 0–1 gate)
- [ ] 2. `POST /api/tutor/start` with cap check and agent provisioning
- [ ] 3. Client: `agora-rtc-sdk-ng` join, mic publish, speaker playback
- [ ] 4. Verify barge-in works; tune stop latency
- [ ] 5. `POST /api/tutor/llm` OpenAI-compatible endpoint with the teaching prompt
- [ ] 6. **ASR quality test for Cebuano and Ilocano on child speech** (fallback plan ready)
- [ ] 7. Mother-tongue language lock with one retry and an event log
- [ ] 8. One-step policy + 2-sentence truncation + final-answer post-filter
- [ ] 9. "Try it back" prompt every ≤2 steps, logged
- [ ] 10. Session timer: warning at 8 min, graceful close at 10 min
- [ ] 11. Text transcript view (session-scoped, no audio stored)
- [ ] 12. Degradation ladder: audio-only → text-only → come back later
- [ ] 13. Accessibility pass: 64 px controls, icons, TalkBack labels in the home language
- [ ] 14. Session log with minutes, turns, try-backs, flags, cost
- [ ] 15. Parent disclosure screen in the home language + one-tap deletion
- [ ] 16. Rehearse a full session on the floor phone over venue wifi; record a backup run
