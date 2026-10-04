# Tuklas — Pitch Deck

**Track:** Educational Crisis · *Shift to Lean Open Learning* · Philippines
**Format:** 2 min pitch + 2 min Q&A. Live deck: `pitch/index.html` (arrow keys / click).
**Live:** https://tuklas.tnf-ex.tech/
**One-line thesis:** *A chatbot forgets your child. This one remembers.*

---

## Slide 1 — Title
> **It teaches in the language they think in.**

**Notes:** Open with the product, not the problem. Tuklas (Filipino: *to discover*) is a
voice tutor that teaches in the child's mother tongue, from the worksheet in their hand.
It needs a connection — voice is server-side — so never imply it runs offline.

## Slide 2 — The problem
- **~9 in 10** Filipino 10-year-olds can't read an age-appropriate text *(World Bank)*
- **76th / 81** in Math *(PISA 2022)*
- **₱0** what an underfunded classroom can spend on per-seat AI

**Notes:** edtech didn't fail for lack of ideas — it shipped cloud bills, per-seat
licenses and "requires fast internet" to barangays that have none.

## Slide 3 — Why not just ChatGPT?
> **A chatbot forgets your child. This one remembers.**
- A chatbot **gives the answer**; a tutor must **withhold it**.
- A child **can't read or type** — this is a spoken lesson.
- ChatGPT **doesn't speak** Waray / Ilocano / Cebuano.
- **No accounts, no data** — nickname only.
- Runs where ChatGPT **can't**: low-end shared phone, spotty data, priced for a school.

**Notes:** This is the slide that wins or loses the Q&A. Everything after proves it.

## Slide 4 — The product
- **Voice-first**, mother tongue.
- **Their own worksheet** — scan a page, teach that problem.
- **Code-switching**: reasoning in the home language, the formal term in Filipino/English.
- **One step per turn** — never the answer.
- **Tap to answer** — a number pad, so it works in *every* language, even without ASR.

Live example: *“Tan-awa: 3 + 4 = ___. Pila man kaha tanan kung imong idugang ang 4 sa 3?”*

## Slide 5 — The Error Notebook (the spine)
`wrong answer → skill logged → spaced re-teach → mastered`

> “Balikan natin: **9 - 4 = ___**.”

**Notes:** Every mistake is a **skill**, not a chat line. Returning opens with the child's
own old mistakes. Errors → skills → spaced re-teach. This is the difference between a
conversation and a tutor.

## Slide 6 — Flashcards
- Made from **the child's own mistakes**, spoken in their language.
- Spaced **1 · 3 · 7 · 14 · 30 days**. *Got it* schedules out; *Missed it* returns tomorrow.

## Slide 7 — Home & class
- **Note for home** (mother tongue): *“Naa koy 7 ka mansanas, gihatag ang 3, pila na lang?”*
- **Class script**: three sentences the child can say to ask for help tomorrow.

## Slide 8 — Lean by design
**Free to the learner; low and bounded to run — not “₱0”.**
- No per-seat license, no account: a school pays nothing per child.
- Each new step costs a little LLM + voice; we record tokens, TTS characters and speech seconds.
- Cached audio (keyed by hash, persisted) makes repeats free across restarts and instances.
- Server-side caps: 10 min/session · 30 min/week · 3 scans/session · 3 sessions/day.
- The usage endpoint returns the real counters; set unit prices for a ₱ estimate per class.

**Notes:** Say plainly that inference and speech are not free — we make the cost *visible and
bounded* instead of claiming zero. This is the honest version of “lean”.

## Slide 9 — Under the hood
Next.js · Express + TypeScript (Docker → GHCR → Render) · OpenCode Go (DeepSeek V4.1 +
vision) · ElevenLabs (v3 Cebuano, v2 Tagalog) · Supabase Postgres (RLS on, Drizzle).

## Slide 10 — The 2-minute demo
`scan → tap/say an answer → tutor refuses the answer, gives one step → note for home → tomorrow: “Balikan natin…”`

## Slide 11 — Roadmap
Teacher view · Mastery map · Philippine-tuned regional speech · Offline packs.

## Slide 12 — Team
- **Anjon Christian M. Paderez** — Team Representative
- **Rob Godwin B. Raymundo**
- **Francis Luiji R. Llanto**
- **Jamey Felisha Arguelles**

**Notes:** Name the team, then hand straight to the live site — no slides needed past this point.

## Slide 13 — Close
> **Every child should learn in the language they think in.**

---

# The 2-minute script (word-for-word)

**[0:00–0:15] Cold open**
“This is a worksheet. A child who can't read yet opens our app, scans it, and a tutor
starts teaching — in Cebuano, their mother tongue. Watch.”

**[0:15–0:45] The demo beat**
*(scan a real page)* “It reads the page: `9 - 4 = ___`. The tutor says *‘Balikan natin:
9 - 4’* — let's revisit last week's mistake.” *(child taps or says an answer.)*
“Notice: it does **not** give the answer. One step, then it asks the child back.
That's the whole product — a tutor, not a chatbot.”

**[0:45–1:15] The spine**
“Every mistake becomes a **skill** in an Error Notebook, scheduled at 1, 3, 7, 14, 30 days.
When she comes back tomorrow, this is the first thing she sees. ChatGPT forgets her.
This remembers. And it hands her mother a note, in Cebuano, telling her exactly what to
ask at home tonight.”

**[1:15–1:45] Lean**
“It runs in a browser on a shared low-end phone. No install, no account, no per-seat
license — free to the learner. Running it isn't free: each new spoken step costs a little
inference and voice, so we cache every clip by hash and cap each session server-side — and
we show the real per-session counters on screen. It works today in Tagalog and Cebuano with
a real voice; for the other thirty-plus languages the answer pad means a Waray child can
still learn — speech for those is our next milestone.”

**[1:45–2:00] Close**
“Nine in ten Filipino ten-year-olds can't read an age-appropriate text, and the tools
meant to help are built for schools that can afford the cloud. Every child should learn
in the language they think in — and no child should be forgotten by the tool that
teaches them.”

---

# Q&A prep

- **“How is this different from ChatGPT?”** A chatbot gives the answer and forgets the
  child. We withhold the answer, teach in the mother tongue by voice, work from their own
  page, and keep a lasting Error Notebook. No account, no per-seat.
- **“Does it really work offline?”** Voice needs a connection today. Repeated audio is
  cached for ₱0 replays, and *offline lesson packs* are on the roadmap. We say this
  plainly instead of pretending otherwise.
- **“Which languages?”** Teaching content in 30+ Philippine languages; **natural voice**
  in Tagalog and Cebuano; regional speech recognition is the next milestone.
- **“What does it cost a school?”** No per-seat license — free to the learner. Running it
  is low and bounded, not ₱0: cached audio (persisted, so repeats are free) plus
  server-side caps (10 min/session, 30 min/week, 3 scans/session, 3 sessions/day). Every
  session records LLM tokens, TTS characters and speech seconds, so we can produce a real
  cost statement per class — set unit prices and it becomes a ₱ estimate.
- **“Privacy?”** Nickname only, no full names, no audio stored, RLS enabled, images
  discarded after extraction — plain-language disclosure in the home language.
- **“Doesn't the child just get answers?”** No — a server-side policy gives one step and
  asks for the next; we can demo it live on a scanned problem.
- **“Team / stack?”** Anjon Christian M. Paderez (Team Representative), Rob Godwin B. Raymundo,
  Francis Luiji R. Llanto, Jamey Felisha Arguelles — built as a one-weekend sprint. Stack: Next.js +
  Express/TypeScript (Docker → GHCR → Render), OpenCode Go (DeepSeek V4.1 + vision), ElevenLabs voice,
  Supabase Postgres with RLS.
- **“Where can we try it?”** [tuklas.tnf-ex.tech](https://tuklas.tnf-ex.tech/) — open the tutor, pick a
  language, scan a page or use the number pad.
