import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Languages, Mic, ScanLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATS = [
  {
    value: "9 in 10",
    label: "Filipino 10-year-olds who cannot read an age-appropriate text",
    source: "World Bank, learning poverty",
  },
  {
    value: "76th / 81",
    label: "Philippines' rank in Mathematics",
    source: "PISA 2022",
  },
  {
    value: "Most",
    label: "learners speak a language at home that school does not teach in",
    source: "K–3 language policy",
  },
];

const STEPS = [
  {
    icon: Mic,
    title: "Tap and talk",
    body: "The learner speaks. No keyboard, no reading required — a voice tutor a young child can actually use.",
  },
  {
    icon: Languages,
    title: "It teaches in the mother tongue",
    body: "Explanations come in Cebuano or Filipino. The subject terms are taught in Filipino and English, so the child recognises them in class.",
  },
  {
    icon: ScanLine,
    title: "Scan the worksheet",
    body: "Photograph the page. The tutor works the exact problem the child is stuck on — one step at a time, not the whole answer.",
  },
];

const METHOD = [
  {
    title: "One step per turn",
    body: "The tutor never hands over the answer. It gives a single step, then asks the learner for the next one.",
  },
  {
    title: "\u201cTry it back\u201d",
    body: "After each step the learner says the next part in their own words. That is how you know it landed.",
  },
  {
    title: "Built for underfunded classrooms",
    body: "Minutes are capped and shown on screen. Repetitive practice uses cached audio, so cost stays honest and low.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
            <Image src="/tuklas-icon.png" alt="Tuklas" width={28} height={28} className="rounded-md" priority />
            Tuklas
          </Link>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#method" className="hover:text-foreground">
              Method
            </a>
            <a href="#who" className="hover:text-foreground">
              For schools
            </a>
          </div>
          <Link href="/app" className={cn(buttonVariants({ size: "sm" }))}>
            Open the tutor
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">
            Mother-tongue voice tutor · Philippines
          </p>
          <h1 className="font-heading mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Every child should learn in the language they think in.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Tuklas is a voice tutor that teaches math — and more — in Cebuano, Filipino, and other
            mother tongues. Speak to it, interrupt it, scan the worksheet in front of you. No typing
            required.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/app" className={cn(buttonVariants({ size: "lg" }))}>
              Open the tutor
              <ArrowRight />
            </Link>
            <a href="#how" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              See the method
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            Speech by ElevenLabs · Reasoning via OpenCode Go · No per-seat license
          </p>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div key={stat.value}>
                <p className="font-mono text-3xl font-semibold text-foreground">{stat.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground/70">{stat.source}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            A conversation, not a worksheet.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {"Most “AI tutors” translate. This one teaches in the mother tongue, turn by turn."}
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="rounded-xl border p-5">
                <step.icon className="size-5 text-primary" />
                <h3 className="font-heading mt-4 text-base font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="method" className="border-t bg-muted/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              The teaching method is the invention.
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {METHOD.map((item) => (
                <div key={item.title}>
                  <h3 className="font-heading text-base font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="who" className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">Who it is for</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Public schools, ALS centres, and self-directed learners — anyone the current tools leave
            behind because of cost or language.
          </p>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-xl border bg-muted/40 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-xl font-semibold">Try it with a real problem.</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a language, tap the mic, and scan a worksheet page.
              </p>
            </div>
            <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "shrink-0")}>
              Open the tutor
              <ArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 font-mono text-xs text-muted-foreground">
          <span>Tuklas — learning in the mother tongue</span>
          <span>Educational Crisis track</span>
        </div>
      </footer>
    </div>
  );
}
