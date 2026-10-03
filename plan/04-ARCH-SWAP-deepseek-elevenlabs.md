# 04 — Architecture swap: DeepSeek v4.1 + ElevenLabs, no Agora

**Decision:** replace the Agora Conversational AI agent with a **turn-based** loop — browser mic → STT → **DeepSeek v4.1** → **ElevenLabs** TTS → playback. Specs 01–03 stay; this file lists exactly what changes so nobody re-reads the whole pack.

**Verdict: do it.** With ~10 hours left, this removes the single riskiest piece (real-time agent provisioning, channel tokens, provider config) and saves roughly 3 hours of integration work. What you give up is barge-in.

---

## 1. What you lose, stated plainly

| Agora gave you | Turn-based gives you |
|---|---|
| Interrupt the tutor mid-sentence (barge-in, ~300 ms) | The learner waits for the tutor to finish, then speaks |
| Sub-second turn-taking, phone-call feel | A 2–4 s round trip per turn |
| A "judge interrupts it live" demo beat | That beat is gone — replace it (see §6) |

For a six-year-old, turn-based voice is workable. It is not as magical, and you should say so rather than pretend the difference doesn't exist.

---

## 2. The new loop

```
[hold-to-talk or tap-to-talk]
   → MediaRecorder captures the learner's turn
   → STT: browser Web Speech API (free) or Whisper API (~₱0.50/turn)
   → POST /api/tutor/turn  { sessionId, text }
        → assemble context: teaching prompt + page context (if scanned) + last 6 turns
        → DeepSeek v4.1 chat completion
        → post-filter: 2 sentences max, no final answers
        → serve audio: cached clip if this exact sentence was spoken before,
          otherwise ElevenLabs → store → return
   → play audio while the text appears
   → update minutes/characters meter, append the turn to the transcript
```

**Latency budget:** STT ≤1.5 s · LLM first token ≤1 s · TTS ≤1.5 s (cached ≤200 ms) · **total ≤4 s**, with a visible "thinking" character in between.

---

## 3. What changes in each spec

**`01-SPEC-tutor-session.md`**
- Requirement 1 (session start): no agent provisioning. A session is a row in `sessions`; the channel, tokens and Agora keys disappear.
- Requirement 3 (barge-in): **replace** with tap-to-talk / hold-to-talk turns, with a clear "your turn" indicator. Keep the 5 s silence prompt.
- Requirement 8 (providers): now `STT_PROVIDER`, `LLM_MODEL=deepseek-v4.1`, `ELEVENLABS_VOICE_{LANG}` — all server-side env.
- Everything else stands unchanged: mother-tongue lock, one-step policy, try-it-back, transcript, limits, degradation, accessibility, session log.

**`02-SPEC-multimodal-input.md`**
- Requirement 10 (latency mid-session): no live channel to protect; the scan can simply be processed between turns.
- Requirement 2: the scan is injected as a learner turn — unchanged, actually simpler now.
- Everything else stands.

**`03-SPEC-minutes-caps-and-teacher.md`**
- Requirement 4 (cost accounting): meters become **characters of TTS**, **LLM tokens**, and **STT minutes** rather than voice-transport minutes.
- Requirement 2 (minute accounting): keep minutes as the learner-facing unit for the cap, but compute the cost from characters and tokens.
- Rates in env become `RATE_TTS_PHP_PER_1K_CHARS`, `RATE_LLM_PHP_PER_1K_TOKENS`, `RATE_STT_PHP_PER_MIN`.
- Caps stay: 10 min/session, 30 min/week — they are now your quality-of-experience control as much as a cost control.
- Everything else stands.

**Drop entirely:** `AGORA_APP_ID`, `AGORA_APP_CERT`, `AGORA_AGENT_ROLE`, agent provisioning, channel tokens, turn-detection tuning.

---

## 4. Cost model (TTS is the driver, not the LLM)

Per 10-minute session — tutor speaks ~6,000 characters, learner speaks ~300 words:

| Component | Cost per session | Per class (40) per school year |
|---|---|---|
| **ElevenLabs TTS** at ~$0.06/1k chars | **₱20** | **₱32,400** |
| ElevenLabs at ~$0.15/1k chars | ₱50 | ₱80,800 |
| ElevenLabs at ~$0.30/1k chars | ₱101 | ₱161,300 |
| **DeepSeek v4.1 (LLM)** | **₱0.09–₱0.31** | ₱143–₱497 |
| Browser Web Speech (STT) | ₱0 | ₱0 |
| Whisper (STT) | ₱0.50 | ₱800 |

**Three conclusions that matter for the pitch:**
1. **The LLM is effectively free** — a rounding error next to the voice. DeepSeek is not the cost problem; speaking is.
2. **ElevenLabs is 99% of your bill.** So: cache aggressively, and consider a *hybrid voice*: ElevenLabs for explanation and encouragement, and the browser's free OS voice for drills, number names and repeated phrases. That is the same "voice where it matters" rule, now applied to characters instead of minutes.
3. **You have no per-minute transport and no Agora minimum base fee** — which is the real saving, and it removes the $500/month caution.

**Verify before quoting:** current ElevenLabs per-character rates for your plan, and DeepSeek's published token rates.

---

## 5. Cache rules that cut the TTS bill hardest

A tutor repeats itself constantly. Cache by `sha256(text + voice + rate)`:
- greetings, "subukan mo ulit", "magaling!", transitions, praise, cloze prompts
- number names, operation words (*idugang*, *kuhaan*, *pil-on*), times tables
- every sentence of a scanned page read aloud
- the three suggested questions and their canned answers

Only genuinely novel explanation text pays. In a typical session that turns ~6,000 characters into maybe 2,500 paid ones.

---

## 6. Demo changes

Replace the lost barge-in beat with these, in order:
1. Judge **talks to the tutor in Cebuano or Filipino** — answer comes back in the mother tongue.
2. Judge **scans a worksheet problem**; the tutor asks *"which number?"*, then works **step one only** and asks the child for step two.
3. Show the child **answering in their own words** and the tutor responding to what they actually said — that is the interactivity, and it still lands.
4. Point at the meter: characters spoken, tokens used, pesos today, and the cache hits at ₱0.
5. Close: *"Every other tutor makes a Filipino child learn in a language they don't think in."*

---

## 7. Two honest notes

- **Ditching Agora forfeits the Voice First championship track** (build with Agora tech). Confirm with the organizers whether that matters to you — in the Educational Crisis track it does not.
- **The browser's Web Speech API is server-based in Chrome**, so voice is transcribed by the browser's speech service. Disclose that in the privacy screen instead of claiming nothing leaves the device. Agora had the same property; neither is offline, and that is now your accepted trade-off.

---

## 8. Hour-0 checks before you build anything else

1. **DeepSeek v4.1 in Cebuano and Ilocano:** ask it to explain "3 + 4" step by step in Cebuano, then in Ilocano. If the mother tongue is weak, fall back to Filipino-only output with the child speaking Filipino — the pedagogy survives.
2. **ElevenLabs Filipino/Cebuano voice quality on one paragraph** — three voices, pick one, keep it consistent.
3. **One round trip end to end:** speak → transcript → DeepSeek → ElevenLabs audio playing. Time it. If that loop works in the first hour, the rest is UI.
