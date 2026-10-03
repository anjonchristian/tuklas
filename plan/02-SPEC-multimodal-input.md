# SPEC 02 — Multimodal input: typed questions and page scanning

**Kiro slug:** `multimodal-input` · Files: `requirements.md`, `design.md`, `tasks.md`
**Depends on:** SPEC 01 (session, teaching prompt), SPEC 03 (cost accounting, caps)

---

## requirements.md

### Introduction
A child who cannot read should not have to type, but some can, and many have a worksheet in front of them. This spec adds two inputs to the spoken session: a text box, and a camera. A scanned page — a module page, a worksheet, a homework problem — is extracted to text and dropped **into the conversation**, so the tutor teaches *that* problem rather than a generic one.

### Requirement 1 — Typed question
**WHEN** the learner types a question **THE SYSTEM SHALL** inject it into the session as a learner turn and answer it aloud, with the text shown.
**Acceptance criteria**
- Text box is secondary to the mic but always reachable in one tap.
- Submission is one tap; no keyboard-only navigation.
- The tutor's answer is spoken in the home language and displayed as text.
- Typed questions count against the daily question allowance (SPEC 03).

### Requirement 2 — Scan a page into the conversation
**WHEN** the learner photographs a page **THE SYSTEM SHALL** extract the text and inject it as context for the session.
**Acceptance criteria**
- Capture is one tap with a frame guide; retake and "use this" actions.
- Extracted text is injected as a learner turn: *"Ito ang nasa pahina ko…"* followed by the text.
- A side panel shows the extracted text so the learner or teacher can check it.
- The tutor's next turn must reference the scanned content explicitly, not a generic topic.

### Requirement 3 — Worksheet mode
**WHEN** the scanned page contains numbered items **THE SYSTEM SHALL** ask which item the learner needs help with before teaching.
**Acceptance criteria**
- Numbered items are detected from the extracted text; if detection is uncertain, the tutor simply asks.
- The learner can answer by voice ("number three") or by tapping the item number in the side panel.
- The tutor then works only on that item.

### Requirement 4 — Math spoken in the mother tongue
**WHEN** the subject is mathematics **THE SYSTEM SHALL** speak operations in the home language rather than reading symbols aloud.
**Acceptance criteria**
- Operations use everyday words: *idugang* (add), *kuhaan* (subtract), *pil-on* (times), *bahin* (divide) — with the Filipino/English term taught alongside.
- Worked one step at a time, out loud, with the child repeating the step back.
- Numbers are read naturally in the home language, not digit by digit.
- Word problems are re-told in the home language before any computation.

### Requirement 5 — Hint policy applies to scans too
**WHEN** the scanned item is homework **THE SYSTEM SHALL** apply the same one-step-and-a-question policy as SPEC 01 Requirement 4.
**Acceptance criteria**
- The post-filter rejects any turn stating the final answer for a numbered item.
- A test case exists: scan a homework item and confirm the tutor does not produce the answer.
- "Ano ang sagot?" on a scanned item produces a hint, not the answer.

### Requirement 6 — Correct the extraction in one tap
**WHEN** the extracted text is wrong **THE SYSTEM SHALL** let the learner or teacher edit it before or during teaching.
**Acceptance criteria**
- Editing is per line, with large targets; the tutor is told about the correction.
- Corrections invalidate any cached extraction for that image hash (SPEC 03).
- An uncorrected extraction is never presented as authoritative.

### Requirement 7 — Privacy of scanned pages
**WHEN** an image is scanned **THE SYSTEM SHALL** discard it after extraction unless a teacher explicitly opts in to keeping that page.
**Acceptance criteria**
- No image of a child is captured, encouraged or stored.
- Prompts carry page text only — no faces, no names, no location.
- Extracted text is associated with a nickname and profile id, never a full name.

### Requirement 8 — Scan cost is accounted separately
**WHEN** a scan is processed **THE SYSTEM SHALL** record a vision cost event distinct from voice minutes.
**Acceptance criteria**
- Cost events carry `kind: "vision"` with model, tokens and peso cost, or `cached: true` with zero cost.
- The meter shows vision spend separately from voice minutes.
- A repeat scan of the same page is a cache hit and costs nothing.

### Requirement 9 — Failure handling
**WHEN** a scan fails **THE SYSTEM SHALL** degrade rather than dead-end.
**Acceptance criteria**
- Blurry, dark or distant images produce a retake prompt naming the reason.
- Extraction failure offers: type the problem, or say it aloud — both keep the session alive.
- Nothing in the scan flow interrupts the audio session.

### Requirement 10 — Latency with a live session running
**WHEN** a scan is processed mid-session **THE SYSTEM SHALL** keep the conversation responsive.
**Acceptance criteria**
- The tutor acknowledges the scan within 1 s ("tingnan ko…") and speaks to it within 8 s cold.
- Voice session stays connected and interruptible throughout.
- Progress is visible; no blank screen, no mute button.

### Requirement 11 — Multiple pages, bounded
**WHEN** several pages are scanned in one session **THE SYSTEM SHALL** accept up to three.
**Acceptance criteria**
- Each page is labelled in the side panel; the learner taps one to make it the active context.
- The active page is stated in the session log.
- Beyond three, the app asks the learner to finish with the current page first.

### Requirement 12 — Language handling on scans
**WHEN** the scanned text is in Filipino or English **THE SYSTEM SHALL** teach it in the learner's home language.
**Acceptance criteria**
- Extracted target-language text is preserved for display; explanation is in the home language.
- Key terms from the page are repeated in the target language so the child recognises them in class.

---

## design.md

### Endpoints
```
POST /api/scan
  body: { profileId, sessionId, imageDataUrl }
  1) pHash the image → cache lookup (pages.image_hash)
  2) miss → one vision call: extract text, detect numbered items, keep layout order
  3) insert as a learner turn into the session context
  4) return { pageId, cached, text, items[], costPhp }
POST /api/turn
  body: { sessionId, kind: "typed"|"scan", text }
  → appends to session context so the agent's next turn sees it
```

### Injection format (what the agent receives)
```
[LEARNER CONTEXT — scanned page, subject: math, grade 1]
Ania ang tubag sa numero 3? (worksheet items 1–5 detected)
--- page text begins ---
1. 3 + 4 = ___      2. 8 - 2 = ___      3. 5 + 5 = ___
--- page text ends ---
```

### Vision prompt (single call, cached)
```
System: Extract ALL text from this page in reading order. Preserve numbers and equations
exactly. Detect numbered items and return them as an array. Return JSON:
{ text, items: [{number, text}], language, confidence }.
Do not solve anything. Do not add words that are not on the page.
```

### UI states
`idle · camera · uploading · extracting · reviewing(text side panel) · active-context · retake(reason)`

### Interaction with the live agent
- The scan is injected as conversation context, never as a channel event, so the tutor's spoken turn naturally refers to it.
- If the learner interrupts while the scan is processing, the interruption wins; the scan lands in the context for the next turn.

---

## tasks.md
- [ ] 1. Text input box with one-tap submit, wired to the live session context
- [ ] 2. Scan capture with frame guide, retake/use actions, client-side downscale to 1024 px
- [ ] 3. `POST /api/scan` with pHash cache lookup before any vision call
- [ ] 4. Vision extraction prompt returning text + numbered items + confidence
- [ ] 5. Injection into the session context as a learner turn (format above)
- [ ] 6. Side panel: extracted text, editable per line, active-page selector
- [ ] 7. Worksheet mode: "which number?" by voice or tap, then teach only that item
- [ ] 8. Math-in-mother-tongue prompt rules (operations, numbers, word problems) with the term pairs
- [ ] 9. Hint-policy post-filter applied to scanned homework + the live test case
- [ ] 10. Vision cost events recorded separately; repeat scans hit the cache at zero cost
- [ ] 11. Failure ladder: retake → type it → say it
- [ ] 12. Latency: acknowledge within 1 s, teach within 8 s, session stays interruptible
- [ ] 13. Corrections invalidate the cached extraction and notify the tutor
- [ ] 14. Privacy pass: images discarded after extraction; no faces; nickname only
- [ ] 15. Demo rehearsal: judge photographs a real worksheet and is asked "which number?" before any teaching
