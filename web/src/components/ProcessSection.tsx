import { FileSearch, Gavel, Lock, Send } from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  n: string;
  title: string;
  body: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Lock a bounty",
    body: "A project locks $GEN and a frozen rubric covering scope, duplicates and severity bars.",
    icon: <Lock size={18} aria-hidden="true" />,
  },
  {
    n: "02",
    title: "Submit a writeup",
    body: "A researcher posts a public URL and a small bond. Nothing runs against the target.",
    icon: <Send size={18} aria-hidden="true" />,
  },
  {
    n: "03",
    title: "Jury review",
    body: "Independent validators fetch the page and answer 5 fixed fields on-chain. Prose is never compared.",
    icon: <FileSearch size={18} aria-hidden="true" />,
  },
  {
    n: "04",
    title: "On-chain settlement",
    body: "Payout, slash or refund executes automatically once the verdict finalizes.",
    icon: <Gavel size={18} aria-hidden="true" />,
  },
];

export function ProcessSection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-line py-14" aria-labelledby="process-title">
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">How it works</p>
        <h2 id="process-title" className="!mb-0 !mt-3 !text-[32px] font-serif font-semibold normal-case leading-tight tracking-tight text-ink !tracking-tight sm:!text-4xl">
          Four steps from claim to settlement.
        </h2>
        <p className="mt-3 text-ink-soft">
          If the jury cannot decide, no money moves. Every transfer waits for the verdict to finalize.
        </p>
      </div>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="bg-paper-card p-6 transition-colors hover:bg-white">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-semibold text-accent">{s.n}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">{s.icon}</span>
            </div>
            <h3 className="mt-5 text-[17px] font-semibold text-ink">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
