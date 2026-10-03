"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, Camera, ImageUp, Mic, Square } from "lucide-react";
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

function getAncestorSpeechCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

interface StoredProfile {
  id: string;
  nickname: string;
  homeLang: LangCode;
}

function readProfile(): StoredProfile {
  const fallback: StoredProfile = {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    nickname: "Learner",
    homeLang: "ceb",
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

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const profileIdRef = useRef<string>("");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const sendTurn = useCallback(
    async (text: string, image?: string) => {
      if (!sessionId || (!text.trim() && !image) || busy) return;
      setBusy(true);
      setStatus("thinking");
      setError(null);
      setTurns((prev) => [...prev, { speaker: "learner", text, image }]);
      try {
        const res = await fetch("/api/tutor/turn", {
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

  const start = useCallback(async () => {
    setError(null);
    setStatus("thinking");
    const profile = readProfile();
    profileIdRef.current = profile.id;
    try {
      const res = await fetch("/api/tutor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          nickname,
          homeLang,
          level,
          subject: subject === "Other" ? customSubject.trim() || "General" : subject,
          topic: topic || "General",
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
        JSON.stringify({ id: profileIdRef.current, nickname, homeLang }),
      );
      setSessionId(data.sessionId);
      setTurns([{ speaker: "tutor", text: data.greeting }]);
      setMinutes(data.minutes);
      setPhase("session");
      playReply(data.greeting, null);
    } catch {
      setError("Hindi makapagsimula. Subukan ulit.");
      setStatus("idle");
    }
  }, [nickname, homeLang, level, subject, topic, customSubject, playReply]);

  const end = useCallback(async () => {
    if (!sessionId) return;
    window.speechSynthesis?.cancel();
    await fetch("/api/session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setPhase("setup");
    setSessionId(null);
    setTurns([]);
    setMinutes(null);
    setStatus("idle");
  }, [sessionId]);

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

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, imageDataUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Hindi mabasa ang pahina.");
          return;
        }
        setMinutes(data.minutes);
        setScanning(false);
        // Put the page into the conversation so the tutor teaches from it.
        await sendTurn("Ito ang nasa aking pahina. Tabangi ko niini.", imageDataUrl);
      } catch {
        setError("Hindi mabasa ang larawan. Subukan ulit.");
      } finally {
        setScanning(false);
      }
    },
    [sessionId, sendTurn],
  );

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleScan(file);
      event.target.value = "";
    },
    [handleScan],
  );

  const activeLangs = LANGUAGE_CODES.map((code) => LANGUAGES[code]);

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
              <div className="grid grid-cols-2 gap-2">
                {activeLangs.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    disabled={lang.status === "planned"}
                    onClick={() => setHomeLang(lang.code)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      homeLang === lang.code ? "border-primary bg-primary/5" : "hover:bg-muted",
                      lang.status === "planned" && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="block text-sm font-medium">{lang.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {lang.status === "planned" ? "Coming soon" : lang.region}
                    </span>
                  </button>
                ))}
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
            <Button onClick={start} disabled={!stepValid || busy}>
              Start talking
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-heading text-sm font-semibold">
            Tuklas
          </Link>
          <Badge variant="outline" className="font-mono">
            {LANGUAGES[homeLang].label} · Grade {level}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={end}>
          End session
        </Button>
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
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendTurn(textInput);
                    setTextInput("");
                  }
                }}
                placeholder="Type a question, or attach a photo of the worksheet…"
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
                    void sendTurn(textInput);
                    setTextInput("");
                  }}
                  disabled={busy || scanning || !textInput.trim()}
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
    </div>
  );
}
