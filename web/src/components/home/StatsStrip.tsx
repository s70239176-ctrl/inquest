import { formatGen } from "../../lib/format.ts";

export interface ProtocolStats {
  totalBounties: number;
  acceptingBounties: number;
  claimsJudged: number;
  claimsTotal: number;
  gen: bigint;
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="px-1 py-5 sm:px-6 sm:first:pl-0">
      <div className="font-serif text-[44px] leading-none tracking-tight text-ivory-ink sm:text-[52px]">{value}</div>
      <div className="mt-2 text-[13px] font-semibold text-ivory-ink">{label}</div>
      <div className="text-[12px] text-ivory-muted">{note}</div>
    </div>
  );
}

/** Four numbers, all read from the contract. While loading, or when no contract is configured, they show an em dash. */
export function StatsStrip({ stats }: { stats: ProtocolStats | null }) {
  const n = (v: number | undefined) => (stats ? v!.toLocaleString() : "—");
  return (
    <section className="bg-ivory text-ivory-ink" aria-label="Live protocol figures">
      <dl className="mx-auto m-0 grid max-w-page grid-cols-2 divide-ivory-line border-t border-ivory-line px-5 sm:grid-cols-4 sm:divide-x">
        <Stat value={n(stats?.totalBounties)} label="Bounties" note="created on-chain" />
        <Stat value={n(stats?.acceptingBounties)} label="Accepting reports" note="open and funded" />
        <Stat
          value={stats ? (stats.claimsTotal === 0 ? "0" : `${stats.claimsJudged}/${stats.claimsTotal}`) : "—"}
          label="Claims judged"
          note="verdict recorded"
        />
        <Stat value={stats ? formatGen(stats.gen, 2) : "—"} label="GEN in pools" note="locked in the contract" />
      </dl>
    </section>
  );
}
