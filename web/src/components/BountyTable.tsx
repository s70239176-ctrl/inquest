import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { formatDeadline, formatGen, shortAddr, timeLeft } from "../lib/format.ts";
import type { Bounty } from "../lib/types.ts";

type Filter = "all" | "active" | "review" | "settled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "review", label: "Under Review" },
  { id: "settled", label: "Settled" },
];

type Tone = "amber" | "green" | "zinc" | "red";

/** The one place a bounty's on-screen phase is derived: from contract fields only. */
export function bountyPhase(b: Bounty, now: number): { filter: Exclude<Filter, "all">; label: string; tone: Tone } {
  if (b.pendingCount > 0) return { filter: "review", label: "Jury review", tone: "amber" };
  if (b.status === "CANCELLED") return { filter: "settled", label: "Cancelled", tone: "red" };
  if (b.status === "DEPLETED") return { filter: "settled", label: "Pool paid out", tone: "zinc" };
  if (now > b.deadline) return { filter: "settled", label: "Closed", tone: "zinc" };
  if (b.claimCount === 0) return { filter: "active", label: "Rubric locked", tone: "green" };
  return { filter: "active", label: "Accepting reports", tone: "green" };
}

const TONES: Record<Tone, string> = {
  amber: "border-amber-600/30 bg-accent-soft text-accent-hover",
  green: "border-green-700/25 bg-green-700/10 text-green-800",
  zinc: "border-line bg-paper-2 text-ink-soft",
  red: "border-red-700/25 bg-red-700/10 text-red-800",
};

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${TONES[tone]}`}>
      {label}
    </span>
  );
}

export function BountyTable({ bounties, now }: { bounties: Bounty[]; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () => bounties.map((b) => ({ b, phase: bountyPhase(b, now) })).filter((r) => filter === "all" || r.phase.filter === filter),
    [bounties, filter, now],
  );
  const count = (f: Filter) => (f === "all" ? bounties.length : bounties.filter((b) => bountyPhase(b, now).filter === f).length);

  return (
    <div>
      <div role="tablist" aria-label="Filter bounties" className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.id)}
              className={`!rounded-full !px-4 !py-1.5 text-[13px] ${
                on ? "!bg-ink !text-ink-inverse hover:!bg-black" : "!border !border-line !bg-white !font-medium !text-ink-soft hover:!border-ink hover:!bg-white hover:!text-ink"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 font-mono text-[11px] ${on ? "text-ink-inverse-soft" : "text-ink-soft/70"}`}>{count(f.id)}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-paper-card shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[640px]">
            <thead className="bg-paper-2/60">
              <tr>
                <th scope="col" className="!px-5 !py-3">Project</th>
                <th scope="col" className="num !px-5">Pool ($GEN)</th>
                <th scope="col" className="!px-5">Submissions</th>
                <th scope="col" className="!px-5">Status</th>
                <th scope="col" className="!px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="!px-5 !py-10 text-center text-ink-soft">
                    {bounties.length === 0 ? (
                      <>
                        No bounties yet.{" "}
                        <a href="#/create" className="font-medium">
                          Create the first one
                        </a>
                        .
                      </>
                    ) : (
                      "Nothing in this view."
                    )}
                  </td>
                </tr>
              )}
              {rows.map(({ b, phase }) => (
                <tr key={b.id} className="group transition-colors hover:bg-white">
                  <td className="!px-5 !py-4">
                    <a href={`#/b/${b.id}`} className="font-semibold text-ink no-underline hover:text-accent hover:no-underline">
                      {b.title}
                    </a>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-soft">
                      #{b.id} · by {shortAddr(b.project)}
                    </div>
                  </td>
                  <td className="num !px-5 !py-4 font-mono font-semibold text-ink">{formatGen(b.pool)}</td>
                  <td className="!px-5 !py-4 text-ink">
                    <span className="font-mono">{b.claimCount}</span>
                    {b.pendingCount > 0 && <span className="ml-1.5 text-[12px] text-ink-soft">· {b.pendingCount} awaiting verdict</span>}
                  </td>
                  <td className="!px-5 !py-4">
                    <StatusPill label={phase.label} tone={phase.tone} />
                    <div className="mt-1 text-[11px] text-ink-soft" title={formatDeadline(b.deadline)}>
                      {timeLeft(b.deadline, now)}
                    </div>
                  </td>
                  <td className="!px-5 !py-4 text-right">
                    <a
                      href={`#/b/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink no-underline transition-colors hover:border-ink hover:no-underline"
                    >
                      {phase.filter === "active" ? "Submit" : "View"}
                      {phase.filter === "active" ? <ArrowRight size={14} aria-hidden="true" /> : <ExternalLink size={13} aria-hidden="true" />}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
