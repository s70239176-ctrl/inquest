import { ArrowRight, CheckCircle2, Shield } from "lucide-react";
import { NETWORK } from "../lib/chain.ts";
import { formatGen, timeLeft } from "../lib/format.ts";
import type { Bounty } from "../lib/types.ts";

export interface HeroMetrics {
  totalBounties: number | null;
  activeBounties: number | null;
  claimsJudged: number | null;
  claimsTotal: number | null;
  genLocked: bigint | null;
}

function Metric({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="sm:border-l sm:border-line sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <div className="font-mono text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{value}</div>
      <div className="mt-0.5 text-[12px] font-medium text-ink-soft">{label}</div>
      {hint && <div className="text-[11px] text-ink-soft/70">{hint}</div>}
    </div>
  );
}

const shown = (n: number | null) => (n === null ? "—" : n.toLocaleString());

/** Status pill for the dark preview card. */
function Pill({ children, tone }: { children: string; tone: "amber" | "green" | "zinc" }) {
  const tones = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    green: "border-green-500/40 bg-green-500/10 text-green-400",
    zinc: "border-zinc-600 bg-zinc-800 text-zinc-300",
  } as const;
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

export function HeroSection({ metrics, preview, now }: { metrics: HeroMetrics; preview: Bounty[]; now: number }) {
  return (
    <section className="grid gap-8 py-10 lg:grid-cols-12 lg:gap-10 lg:py-16" aria-labelledby="hero-title">
      {/* Left: editorial copy (7 cols) */}
      <div className="lg:col-span-7">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">The on-chain bug bounty protocol</p>
        <h1
          id="hero-title"
          className="!m-0 mt-4 font-serif text-[44px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[68px]"
        >
          Evidence.
          <br />
          Validators.
          <br />
          <em className="font-medium italic text-accent">True security.</em>
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          Inquest pays bounties only when independent validators agree that a <strong className="font-semibold text-ink">public writeup</strong>{" "}
          proves an in-scope, non-duplicate bug. A bug isn&apos;t real until it repros.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#bounties"
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse no-underline transition-colors hover:bg-black hover:no-underline"
          >
            Explore Bounties <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-lg border border-ink/20 px-5 py-3 text-sm font-semibold text-ink no-underline transition-colors hover:border-ink hover:no-underline"
          >
            How It Works
          </a>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4" aria-label="Live protocol metrics">
          <Metric value={shown(metrics.totalBounties)} label="Total bounties" />
          <Metric value={shown(metrics.activeBounties)} label="Active bounties" />
          <Metric
            value={metrics.claimsTotal ? `${shown(metrics.claimsJudged)}/${shown(metrics.claimsTotal)}` : "—"}
            label="Claims judged"
            hint="settled by a verdict"
          />
          <Metric value={metrics.genLocked === null ? "—" : formatGen(metrics.genLocked, 2)} label="GEN in pools" hint="locked on-chain" />
        </dl>
      </div>

      {/* Right: dark contrast panel (5 cols) */}
      <aside className="relative overflow-hidden rounded-2xl bg-editorial p-6 text-ink-inverse shadow-card sm:p-8 lg:col-span-5" aria-label="Live bounties preview">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 85% 0%, rgba(217,119,6,0.22) 0%, rgba(217,119,6,0) 70%), radial-gradient(50% 40% at 0% 100%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-dark bg-editorial-panel px-2.5 py-1 font-mono text-[10.5px] text-ink-inverse-soft">
              <Shield size={12} className="text-accent" aria-hidden="true" />
              {NETWORK}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-inverse-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" /> live
            </span>
          </div>

          <p className="mt-8 font-mono text-[12px] font-medium uppercase leading-relaxed tracking-[0.2em] text-ink-inverse">
            Real projects.
            <br />
            Real evidence.
            <br />
            <span className="text-accent">On-chain.</span>
          </p>

          <div className="mt-8 rounded-xl border border-line-dark bg-editorial-panel/90">
            <div className="flex items-center justify-between border-b border-line-dark px-4 py-3">
              <span className="text-[13px] font-semibold">Open bounties</span>
              <a href="#bounties" className="inline-flex items-center gap-1 text-[12px] text-ink-inverse-soft no-underline hover:text-ink-inverse hover:no-underline">
                View all <ArrowRight size={12} aria-hidden="true" />
              </a>
            </div>
            {preview.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-inverse-soft">No open bounties yet.</p>
            ) : (
              <ul className="divide-y divide-line-dark">
                {preview.map((b) => (
                  <li key={b.id}>
                    <a
                      href={`#/b/${b.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-ink-inverse no-underline transition-colors hover:bg-white/5 hover:no-underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">{b.title}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-inverse-soft">
                          {b.claimCount} {b.claimCount === 1 ? "submission" : "submissions"} · {timeLeft(b.deadline, now)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-[13px] font-semibold">{formatGen(b.pool)} GEN</span>
                        {b.pendingCount > 0 ? <Pill tone="amber">Jury review</Pill> : <Pill tone="green">Accepting reports</Pill>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-5 flex items-center gap-2 text-[12px] text-ink-inverse-soft">
            <CheckCircle2 size={14} className="text-accent" aria-hidden="true" />
            Pools and rubrics are frozen on-chain. No admin key.
          </p>
        </div>
      </aside>
    </section>
  );
}
