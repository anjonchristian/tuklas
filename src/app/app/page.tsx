"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, ImageUp, Mic, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

interface Minutes {
  sessionMin: number;
  sessionCap: number;
  learnerWeekMin: number;
  learnerWeekCap: number;
  classDayMin: number;
  classDayCostPhp: number;
}

interface ScanItem {
  number: string;
  text: string;
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

export default function TutorPage() {
  const [phase, setPhase] = useState<"setup" | "session">("setup");
  const [nickname, setNickname] = useState("Learner");
  const [homeLang, setHomeLang] = useState<LangCode>("ceb");
  const [level, setLevel] = useState(1);
  const [subject] = useState("Math");
  const [topic, setTopic] = useState("addition");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [interim, setInterim] = useState("");
  const [textInput, setTextInput] = useState("");
  const [pageText, setPageText] = useState<string | null>(null);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const profileIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

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
    async (text: string) => {
      if (!sessionId || !text.trim() || busy) return;
      setBusy(true);
      setStatus("thinking");
      setError(null);
      setTurns((prev) => [...prev, { speaker: "learner", text }]);
      try {
        const res = await fetch("/api/tutor/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, text }),
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
          subject,
          topic,
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
  }, [nickname, homeLang, level, subject, topic, playReply]);

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
    setPageText(null);
    setScanItems([]);
    setMinutes(null);
    setStatus("idle");
  }, [sessionId]);

  const toggleMic = useCallback(() => {
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getAncestorSpeechCtor();
    if (!Ctor) {
      setError("Hindi supported ng browser ang voice input. Pwede kang mag-type sa ibaba.");
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
    recognition.onerror = () => {
      setInterim("");
      setStatus("idle");
    };
    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  }, [status, homeLang, sendTurn]);

  const handleScan = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      setError(null);
      setBusy(true);
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
        setPageText(data.text);
        setScanItems(data.items ?? []);
        setMinutes(data.minutes);
        setTurns((prev) => [
          ...prev,
          { speaker: "learner", text: "Ito ang nasa pahina ko… (nakita na ng tutor)" },
        ]);
      } catch {
        setError("Hindi mabasa ang larawan. Subukan ulit.");
      } finally {
        setBusy(false);
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

  const activeLangs = LANGUAGE_CODES.map((code) => LANGUAGES[code]);

  if (phase === "setup") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
        <Link href="/" className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <ArrowLeft className="size-3.5" /> Tuklas
        </Link>
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Set up the tutor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the language the learner thinks in. The tutor will teach in it.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Mother tongue
          </label>
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

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="nickname" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Nickname
            </label>
            <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="level" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Grade
            </label>
            <Input
              id="level"
              type="number"
              min={1}
              max={6}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="topic" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Topic
            </label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button size="lg" onClick={start} className="w-full">
          Start talking
        </Button>
        <p className="font-mono text-xs text-muted-foreground">
          No install. No account. Works on a phone browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
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

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-0 md:grid-cols-[1fr_300px]">
        <section className="flex min-h-0 flex-col border-r">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {turns.map((turn, index) => (
              <div
                key={index}
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
                  turn.speaker === "tutor"
                    ? "bg-muted"
                    : "ml-auto bg-primary text-primary-foreground",
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">
                  {turn.speaker === "tutor" ? "Tutor" : "Learner"}
                </p>
                <p className="mt-1">{turn.text}</p>
              </div>
            ))}
            {interim ? (
              <div className="max-w-[85%] rounded-lg bg-primary/70 px-4 py-2.5 text-sm text-primary-foreground">
                {interim}
              </div>
            ) : null}
            {status === "thinking" ? (
              <div className="max-w-[85%] rounded-lg bg-muted px-4 py-2.5">
                <p className="shimmer text-sm">Nag-iisip…</p>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="border-t px-6 py-4">
            <div className="flex items-center gap-3">
              <Button
                size="icon-lg"
                onClick={toggleMic}
                disabled={busy}
                className={cn("size-16 rounded-full", status === "listening" && "bg-destructive hover:bg-destructive/80")}
              >
                {status === "listening" ? <Square /> : <Mic />}
              </Button>
              <label
                className={cn(buttonVariants({ size: "icon-lg" }), "size-16 cursor-pointer rounded-full")}
                title="Scan with camera"
              >
                <Camera />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onFile}
                />
              </label>
              <label
                className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "cursor-pointer")}
                title="Upload an image"
              >
                <ImageUp />
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
              <div className="flex-1">
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
                  placeholder="O mag-type ng tanong…"
                  className="min-h-11"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void sendTurn(textInput);
                  setTextInput("");
                }}
                disabled={busy || !textInput.trim()}
              >
                Send
              </Button>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {status === "listening"
                ? "Nakikinig… magsalita ngayon."
                : "Tap the mic and talk, or scan the page."}
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6 px-6 py-6">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Minutes
            </h2>
            {minutes ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>This session</span>
                    <span className="font-mono">
                      {minutes.sessionMin.toFixed(1)} / {minutes.sessionCap}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (minutes.sessionMin / minutes.sessionCap) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>This week</span>
                  <span className="font-mono">
                    {minutes.learnerWeekMin.toFixed(1)} / {minutes.learnerWeekCap}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Class today</span>
                  <span className="font-mono">
                    {minutes.classDayMin.toFixed(1)} min · ₱{minutes.classDayCostPhp.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Page context
            </h2>
            {pageText ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">{pageText}</p>
                {scanItems.map((item) => (
                  <p key={item.number} className="font-mono text-xs">
                    {item.number}. {item.text}
                  </p>
                ))}
              </div>
            ) : scanning ? (
              <p className="shimmer mt-3 text-xs">Binabasa ang pahina…</p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Scan or upload a page and the tutor will teach from it.
              </p>
            )}
          </div>

          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Method
            </h2>
            <p className="mt-3 text-xs text-muted-foreground">
              One step per turn. The tutor asks the learner for the next step, and never hands over
              the final answer.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
