"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUp, Camera, ImageUp, Layers, LogOut, Mic, Square } from "lucide-react";
import { Attachment, AttachmentMedia } from "@/components/ui/attachment";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, LANGUAGE_CODES, type LangCode } from "@/lib/tutor/languages";
import { apiGet, apiPost, apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface ChatTurn {
  speaker: "learner" | "tutor";
  text: string;
  image?: string;
}

interface Minutes {
  sessionMin: number;
  sessionCap: number;
  learnerWeekMin: number;
  learnerWeekCap: number;
  classDayMin: number;
  classDayCostPhp: number;
}

interface NotebookError {
  skill: string;
  subject: string;
  attempts: number;
  intervalDays: number;
  nextDueAt: string;
}

interface HistorySession {
  id: string;
  subject: string;
  topic: string;
  state: string;
  minutes: number;
  startedAt: string;
}

function getAncestorSpeechCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

interface StoredProfile {
  id: string;
  nickname: string;
  homeLang: LangCode;
  level: number;
  subject: string;
  topic: string;
}

function readProfile(): StoredProfile {
  const fallback: StoredProfile = {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    nickname: "Learner",
    homeLang: "ceb",
    level: 1,
    subject: "Math",
    topic: "",
  };
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem("tuklas_profile");
  if (!stored) {
    window.localStorage.setItem("tuklas_profile", JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<StoredProfile>;
    return {
      id: parsed.id ?? fallback.id,
      nickname: parsed.nickname ?? fallback.nickname,
      homeLang:
        parsed.homeLang && parsed.homeLang in LANGUAGES
          ? (parsed.homeLang as LangCode)
          : fallback.homeLang,
      level: typeof parsed.level === "number" ? parsed.level : fallback.level,
      subject: typeof parsed.subject === "string" ? parsed.subject : fallback.subject,
      topic: typeof parsed.topic === "string" ? parsed.topic : fallback.topic,
    };
  } catch {
    return fallback;
  }
}

const GRADE_OPTIONS = Array.from({ length: 6 }, (_, index) => ({
  label: `Grade ${index + 1}`,
  value: String(index + 1),
}));

const SUBJECTS: { label: string; value: string; topics: string[] }[] = [
  {
    label: "Math",
    value: "Math",
    topics: ["Addition", "Subtraction", "Multiplication", "Division", "Fractions", "Word problems"],
  },
  { label: "Science", value: "Science", topics: ["Plants", "Animals", "Matter", "Weather", "The solar system"] },
  { label: "English", value: "English", topics: ["Reading", "Vocabulary", "Grammar", "Spelling"] },
  { label: "Filipino", value: "Filipino", topics: ["Pagbasa", "Talasalitaan", "Gramatika", "Pagsulat"] },
  { label: "Araling Panlipunan", value: "Araling Panlipunan", topics: ["Kasaysayan", "Heograpiya", "Pamahalaan"] },
  { label: "MAPEH", value: "MAPEH", topics: ["Music", "Arts", "Physical Education", "Health"] },
  { label: "Other school subject", value: "Other", topics: [] },
];

/** A custom subject must look like a school subject (spec: school-related only). */
const SCHOOL_SUBJECT_KEYWORDS = [
  "math", "algebra", "geometry", "trigonometry", "calculus", "statistics", "arithmetic",
  "science", "physics", "chemistry", "biology", "earth", "astronomy", "space",
  "english", "grammar", "reading", "writing", "literature", "spelling", "vocabulary", "comprehension",
  "filipino", "tagalog", "cebuano", "ilocano", "waray", "mother tongue",
  "araling", "history", "kasaysayan", "geography", "heograpiya", "economics", "civics", "government",
  "mapeh", "music", "arts", "art", "physical education", "pe", "health", "sports",
  "tle", "ict", "computer", "technology", "livelihood", "agriculture", "home economics", "cookery",
  "values", "esp", "edukasyon", "accounting", "business", "entrepreneurship", "research",
];

function isSchoolSubject(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 2) return false;
  return SCHOOL_SUBJECT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export default function TutorPage() {
  const [phase, setPhase] = useState<"setup" | "session">("setup");
  const [nickname, setNickname] = useState("Learner");
  const [homeLang, setHomeLang] = useState<LangCode>("ceb");
  const [level, setLevel] = useState(1);
  const [subject, setSubject] = useState("Math");
  const [topic, setTopic] = useState("");
  const [step, setStep] = useState(0);
  const [customSubject, setCustomSubject] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [interim, setInterim] = useState("");
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<NotebookError[]>([]);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [openSession, setOpenSession] = useState<{
    id: string;
    turns: { speaker: string; text: string }[];
  } | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const [flashcards, setFlashcards] = useState<
    { skill: string; problem: string | null; expected: string | null }[]
  >([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flashBusy, setFlashBusy] = useState(false);
  const [answered, setAnswered] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const profileIdRef = useRef<string>("");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMemory = useCallback(async () => {
    const id = profileIdRef.current;
    if (!id) return;
    try {
      const [nb, hist] = await Promise.all([
        apiGet<{ openErrors: NotebookError[] }>(`/api/notebook/${id}`),
        apiGet<{ sessions: HistorySession[] }>(`/api/history/${id}`),
      ]);
      setNotebook(nb.openErrors ?? []);
      setHistory(hist.sessions ?? []);
    } catch {
      // backend not reachable yet; the tutor still works once it is
    }
  }, []);

  // Restore the learner's settings and memory on mount.
  useEffect(() => {
    const profile = readProfile();
    profileIdRef.current = profile.id;
    queueMicrotask(() => {
      setNickname(profile.nickname);
      setHomeLang(profile.homeLang);
      setLevel(profile.level);
      setSubject(profile.subject);
      setTopic(profile.topic);
    });
    void refreshMemory();
  }, [refreshMemory]);

  const playReply = useCallback(
    (text: string, audio: { base64: string; mime: string } | null) => {
      setStatus("speaking");
      if (audio) {
        const element = new Audio(`data:${audio.mime};base64,${audio.base64}`);
        element.onended = () => setStatus("idle");
        void element.play().catch(() => setStatus("idle"));
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANGUAGES[homeLang]?.browserVoice ?? "fil-PH";
        utterance.onend = () => setStatus("idle");
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        return;
      }
      setStatus("idle");
    },
    [homeLang],
  );

  const getParentNote = useCallback(async () => {
    setNoteBusy(true);
    try {
      const data = await apiPost<{ text: string; audio: { base64: string; mime: string } | null }>(
        "/api/parent-note",
        { profileId: profileIdRef.current },
      );
      setNote(data.text);
      playReply(data.text, data.audio);
    } catch {
      setNote("Hindi makuha ang note. Subukan ulit.");
    } finally {
      setNoteBusy(false);
    }
  }, [playReply]);

  const loadSession = useCallback(async (id: string) => {
    setHistoryBusy(true);
    setOpenSession({ id, turns: [] });
    try {
      const data = await apiGet<{ turns: { speaker: string; text: string }[] }>(`/api/session/${id}`);
      setOpenSession({ id, turns: data.turns ?? [] });
    } catch {
      setOpenSession({ id, turns: [] });
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[homeLang]?.browserVoice ?? "fil-PH";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [homeLang],
  );

  const openFlashcards = useCallback(async () => {
    try {
      const data = await apiGet<{
        cards: { skill: string; problem: string | null; expected: string | null }[];
      }>(`/api/flashcards/${profileIdRef.current}`);
      const cards = data.cards ?? [];
      setFlashcards(cards);
      setCardIndex(0);
      setRevealed(false);
      setAnswered(0);
      setFlashOpen(true);
      const first = cards[0];
      if (first) speak(first.problem ?? first.skill);
    } catch {
      setNote("Hindi makuha ang flashcards. Subukan ulit.");
    }
  }, [speak]);

  const answerCard = useCallback(
    async (correct: boolean) => {
      const card = flashcards[cardIndex];
      if (!card) return;
      setFlashBusy(true);
      try {
        await apiPost("/api/flashcard", {
          profileId: profileIdRef.current,
          skill: card.skill,
          subject,
          correct,
        });
      } catch {
        // keep going even if the write fails
      }
      setAnswered((n) => n + 1);
      const next = cardIndex + 1;
      setCardIndex(next);
      setRevealed(false);
      setFlashBusy(false);
      const upcoming = flashcards[next];
      if (upcoming) speak(upcoming.problem ?? upcoming.skill);
    },
    [flashcards, cardIndex, subject, speak],
  );

  const sendTurn = useCallback(
    async (text: string, image?: string) => {
      if (!sessionId || (!text.trim() && !image) || busy) return;
      setBusy(true);
      setStatus("thinking");
      setError(null);
      setTurns((prev) => [...prev, { speaker: "learner", text, image }]);
      try {
        const res = await fetch(apiUrl("/api/tutor/turn"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            text: text || "Ito ang nasa aking pahina. Tabangi ko niini.",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Hindi natuloy ang sagot.");
          setMinutes(data.minutes ?? minutes);
          setStatus("idle");
          return;
        }
        setTurns((prev) => [...prev, { speaker: "tutor", text: data.reply.text }]);
        setMinutes(data.minutes);
        playReply(data.reply.text, data.audio ?? null);
      } catch {
        setError("May problema sa koneksyon. Subukan ulit.");
        setStatus("idle");
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, minutes, playReply],
  );

  const start = useCallback(async (overrides?: { subject?: string; topic?: string }) => {
    setError(null);
    setStatus("thinking");
    const profile = readProfile();
    profileIdRef.current = profile.id;
    const usedSubject = overrides?.subject ?? subject;
    const usedTopic = overrides?.topic ?? topic;
    try {
      const res = await fetch(apiUrl("/api/tutor/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          nickname,
          homeLang,
          level,
          subject: usedSubject === "Other" ? customSubject.trim() || "General" : usedSubject,
          topic: usedTopic || "General",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hindi makapagsimula.");
        setStatus("idle");
        return;
      }
      window.localStorage.setItem(
        "tuklas_profile",
        JSON.stringify({
          id: profileIdRef.current,
          nickname,
          homeLang,
          level,
          subject,
          topic,
        }),
      );
      setSessionId(data.sessionId);
      setTurns([{ speaker: "tutor", text: data.greeting }]);
      setMinutes(data.minutes);
      setPhase("session");
      playReply(data.greeting, data.audio ?? null);
    } catch {
      setError("Hindi makapagsimula. Subukan ulit.");
      setStatus("idle");
    }
  }, [nickname, homeLang, level, subject, topic, customSubject, playReply]);

  const end = useCallback(async () => {
    if (!sessionId) return;
    window.speechSynthesis?.cancel();
    await fetch(apiUrl("/api/session/end"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setPhase("setup");
    setSessionId(null);
    setTurns([]);
    setMinutes(null);
    setStatus("idle");
    void refreshMemory();
  }, [sessionId, refreshMemory]);

  const toggleMic = useCallback(async () => {
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    if (!window.isSecureContext) {
      setError(
        "Kailangan ng https o localhost para sa mikropono. Buksan ang http://localhost:3000.",
      );
      return;
    }
    const Ctor = getAncestorSpeechCtor();
    if (!Ctor) {
      setError(
        "Hindi sinusuportahan ng browser na ito ang voice input. Gamitin ang Chrome o Edge, o mag-type sa ibaba.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setError("Hindi ma-access ang mikropono. Payagan ang microphone sa browser, o mag-type.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = LANGUAGES[homeLang]?.asr.bcp47 ?? "fil-PH";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      setInterim(text);
      if (isFinal) {
        setInterim("");
        recognition.stop();
        void sendTurn(text.trim());
      }
    };
    recognition.onerror = (event) => {
      setInterim("");
      setStatus("idle");
      const code = event.error;
      if (code === "no-speech") setError("Wala akong narinig. Subukan ulit.");
      else if (code === "not-allowed" || code === "service-not-allowed")
        setError("Hindi pinayagan ang mikropono. Payagan ito sa browser at subukan ulit.");
      else if (code === "audio-capture") setError("Walang nakita na mikropono.");
      else if (code === "network") setError("May problema sa network para sa voice input.");
      else setError(`Voice input error: ${code}`);
    };
    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setError(null);
    setStatus("listening");
    recognition.start();
  }, [status, homeLang, sendTurn]);

  const handleScan = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      setError(null);
      setScanning(true);
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

        // Stage the image as a pending attachment; it is sent with the next message.
        setPendingImage(imageDataUrl);

        const res = await fetch(apiUrl("/api/scan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, imageDataUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Hindi mabasa ang pahina.");
          setPendingImage(null);
          return;
        }
        setMinutes(data.minutes);
      } catch {
        setError("Hindi mabasa ang larawan. Subukan ulit.");
        setPendingImage(null);
      } finally {
        setScanning(false);
      }
    },
    [sessionId],
  );

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleScan(file);
      event.target.value = "";
    },
    [handleScan],
  );

  const languageOptions = LANGUAGE_CODES.map((code) => ({
    label: LANGUAGES[code].label,
    value: code,
  }));

  const flashcardsOverlay = flashOpen ? (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-6 backdrop-blur">
      {flashcards.length === 0 || cardIndex >= flashcards.length ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Deck finished
          </p>
          <p className="font-heading text-2xl font-semibold">
            {answered > 0 ? `${answered} cards reviewed. Nice work!` : "Nothing due right now."}
          </p>
          <Button
            onClick={() => {
              setFlashOpen(false);
              void refreshMemory();
            }}
          >
            Close
          </Button>
        </div>
      ) : (
        <>
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Card {cardIndex + 1} / {flashcards.length} · {flashcards[cardIndex].skill}
          </p>
          <div className="mt-6 flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border bg-card p-10 text-center shadow-sm">
            <p className="font-heading text-4xl font-semibold tracking-tight">
              {flashcards[cardIndex].problem ?? flashcards[cardIndex].skill}
            </p>
            <button
              type="button"
              onClick={() => speak(flashcards[cardIndex].problem ?? flashcards[cardIndex].skill)}
              className="font-mono text-xs text-muted-foreground underline underline-offset-2"
            >
              Play again
            </button>
            {revealed ? (
              <p className="font-heading text-3xl text-primary">
                {flashcards[cardIndex].expected ?? "—"}
              </p>
            ) : (
              <Button variant="outline" onClick={() => setRevealed(true)}>
                Show answer
              </Button>
            )}
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => void answerCard(false)} disabled={flashBusy}>
              Missed it
            </Button>
            <Button onClick={() => void answerCard(true)} disabled={flashBusy}>
              Got it
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setFlashOpen(false);
              void refreshMemory();
            }}
            className="mt-5 font-mono text-xs text-muted-foreground underline underline-offset-2"
          >
            Close
          </button>
        </>
      )}
    </div>
  ) : null;

  if (phase === "setup") {
    const isCustom = subject === "Other";
    const topics = SUBJECTS.find((item) => item.value === subject)?.topics ?? [];
    const customValid = !isCustom || isSchoolSubject(customSubject);
    const stepValid =
      step === 0
        ? nickname.trim().length > 0
        : step === 1
          ? true
          : Boolean(subject) &&
            (isCustom ? customValid && customSubject.trim().length > 0 : Boolean(topic));

    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <Link href="/" className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <ArrowLeft className="size-3.5" /> Tuklas
        </Link>

        {history.length > 0 && !showWizard ? (
          <div className="mt-8 flex flex-col gap-6">
            <div>
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Welcome back
              </p>
              <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight">
                Kumusta, {nickname}!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {LANGUAGES[homeLang].label} · Grade {level}
                {subject ? ` · ${subject}` : ""}
                {topic ? ` · ${topic}` : ""}
              </p>
            </div>

            {notebook.length > 0 ? (
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  We still need to fix
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {notebook.map((e) => (
                    <li key={e.skill} className="text-sm">
                      {e.skill}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                onClick={() => {
                  setStep(2);
                  setShowWizard(true);
                }}
              >
                Start new session
              </Button>
              <Button size="lg" variant="outline" onClick={() => void start()}>
                Continue: {subject}
                {topic ? ` · ${topic}` : ""}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => void openFlashcards()}>
                Practice flashcards{notebook.length > 0 ? ` (${notebook.length})` : ""}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => void getParentNote()}
                disabled={noteBusy}
              >
                {noteBusy ? "Writing…" : "Note for home"}
              </Button>
            </div>
            {note ? <p className="text-sm">{note}</p> : null}

            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                History
              </p>
              {history.map((s) => (
                <div key={s.id} className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => void loadSession(s.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span>
                      {s.subject} · {s.topic}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleString()} · {Math.round(s.minutes ?? 0)} min
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                  </button>
                  {openSession?.id === s.id ? (
                    <div className="flex flex-col gap-2 border-t px-3 py-2">
                      {historyBusy ? (
                        <p className="shimmer text-xs">Binubuksan…</p>
                      ) : openSession.turns.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No transcript.</p>
                      ) : (
                        openSession.turns.map((t, i) => (
                          <p key={i} className="text-xs">
                            <span className="font-mono text-muted-foreground uppercase">
                              {t.speaker}:{" "}
                            </span>
                            {t.text}
                          </p>
                        ))
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 w-fit"
                        onClick={() => void start({ subject: s.subject, topic: s.topic })}
                      >
                        Practice again
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>

        <div className="mt-8 flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="mt-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Step {step + 1} of 3
        </p>

        <div className="mt-8 flex-1">
          {step === 0 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  Who is learning?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  A nickname is enough. No account, no full name.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="nickname"
                  className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
                >
                  Nickname
                </label>
                <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Grade level
                </label>
                <Select
                  items={GRADE_OPTIONS}
                  value={String(level)}
                  onValueChange={(value) => setLevel(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {GRADE_OPTIONS.map((grade) => (
                        <SelectItem key={grade.value} value={grade.value}>
                          {grade.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  Which language does the learner think in?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  The tutor teaches in this language and pairs the formal terms in Filipino and English.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Mother tongue
                </label>
                <Select
                  items={languageOptions}
                  value={homeLang}
                  onValueChange={(value) => setHomeLang(String(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {LANGUAGES[code].label} — {LANGUAGES[code].region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {LANGUAGES[homeLang]?.status === "ready"
                    ? "Natural tutor voice available."
                    : "The tutor answers in this language; the voice uses the browser's Filipino voice for now."}
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">What subject?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  School subjects only. Pick a topic, or choose “Other” for a custom one.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Subject
                </label>
                <Select
                  items={SUBJECTS.map((item) => ({ label: item.label, value: item.value }))}
                  value={subject}
                  onValueChange={(value) => {
                    setSubject(String(value));
                    setTopic("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SUBJECTS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {isCustom ? (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="custom-subject"
                    className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
                  >
                    Custom subject
                  </label>
                  <Input
                    id="custom-subject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g. Algebra, Chemistry, Reading"
                  />
                  {customSubject.trim() && !customValid ? (
                    <p className="text-xs text-destructive">
                      Only school subjects are allowed — try Math, Science, English, or Filipino.
                    </p>
                  ) : null}
                </div>
              ) : topics.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    Topic
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTopic(item)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          topic === item ? "border-primary bg-primary/5" : "hover:bg-muted",
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((current) => current + 1)} disabled={!stepValid}>
              Next
            </Button>
          ) : (
            <Button onClick={() => void start()} disabled={!stepValid || busy}>
              Start session
            </Button>
          )}
        </div>
          </>
        )}

        {flashcardsOverlay}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-heading text-sm font-semibold">
            <Image src="/tuklas-icon.png" alt="Tuklas" width={22} height={22} className="rounded" />
            <span className="hidden sm:inline">Tuklas</span>
          </Link>
          <Badge variant="outline" className="hidden font-mono sm:inline-flex">
            {LANGUAGES[homeLang].label} · Grade {level}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openFlashcards()}
            title="Flashcards"
          >
            <Layers />
            <span className="hidden sm:inline">Flashcards</span>
          </Button>
          <Button variant="outline" size="sm" onClick={end} title="End session">
            <LogOut />
            <span className="hidden sm:inline">End session</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <MessageScrollerProvider autoScroll>
              <MessageScroller>
                <MessageScrollerViewport className="px-6 py-6">
                  <MessageScrollerContent>
                    {turns.map((turn, index) => (
                      <MessageScrollerItem
                        key={`${turn.speaker}-${index}`}
                        messageId={`turn-${index}`}
                        scrollAnchor={turn.speaker === "learner"}
                      >
                        <Message align={turn.speaker === "learner" ? "end" : "start"}>
                          <MessageContent>
                            {turn.image ? (
                              <Attachment size="sm" orientation="vertical">
                                <AttachmentMedia variant="image">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={turn.image} alt="Worksheet page" />
                                </AttachmentMedia>
                              </Attachment>
                            ) : null}
                            {turn.text ? (
                              <Bubble
                                align={turn.speaker === "learner" ? "end" : "start"}
                                variant={turn.speaker === "learner" ? "default" : "muted"}
                              >
                                <BubbleContent>
                                  {turn.speaker === "tutor" ? (
                                    <Markdown>{turn.text}</Markdown>
                                  ) : (
                                    turn.text
                                  )}
                                </BubbleContent>
                              </Bubble>
                            ) : null}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}
                    {interim ? (
                      <MessageScrollerItem messageId="interim">
                        <Message align="end">
                          <MessageContent>
                            <Bubble align="end" variant="secondary">
                              <BubbleContent>{interim}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                    {status === "thinking" ? (
                      <MessageScrollerItem messageId="thinking">
                        <Message align="start">
                          <MessageContent>
                            <Bubble align="start" variant="muted">
                              <BubbleContent>
                                <span className="shimmer">Nag-iisip…</span>
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                    {error ? (
                      <MessageScrollerItem messageId="error">
                        <Message align="start">
                          <MessageContent>
                            <Bubble align="start" variant="destructive">
                              <BubbleContent>{error}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          <div className="border-t p-4">
            <div className="rounded-2xl border bg-background p-2 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
              {pendingImage ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImage} alt="Attachment" className="size-12 rounded object-cover" />
                  <span className="text-xs text-muted-foreground">
                    {scanning ? "Binabasa ang pahina…" : "Nakalakip na larawan"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="ml-auto font-mono text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const image = pendingImage ?? undefined;
                    setPendingImage(null);
                    void sendTurn(textInput, image);
                    setTextInput("");
                  }
                }}
                placeholder={
                  pendingImage
                    ? "Add a note with the photo (optional)…"
                    : "Type a question, or attach a photo of the worksheet…"
                }
                className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={busy || scanning}
                    title="Attach an image"
                  >
                    <ImageUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={busy || scanning}
                    title="Take a photo"
                  >
                    <Camera />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void toggleMic();
                    }}
                    disabled={busy || scanning}
                    title={status === "listening" ? "Stop listening" : "Speak"}
                    className={cn(
                      status === "listening" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                    )}
                  >
                    {status === "listening" ? <Square /> : <Mic />}
                  </Button>
                </div>
                <Button
                  size="icon"
                  onClick={() => {
                    const image = pendingImage ?? undefined;
                    setPendingImage(null);
                    void sendTurn(textInput, image);
                    setTextInput("");
                  }}
                  disabled={busy || scanning || (!textInput.trim() && !pendingImage)}
                  title="Send"
                >
                  <ArrowUp />
                </Button>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {status === "listening"
                ? "Nakikinig… magsalita ngayon."
                : "Attach a photo of the worksheet, tap the mic, or type."}
            </p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFile}
            />
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </section>
      </div>
      {flashcardsOverlay}
    </div>
  );
}
