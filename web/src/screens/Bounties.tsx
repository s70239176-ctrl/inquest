import { useState } from "react";
import { hasContract, listBounties } from "../lib/chain.ts";
import { useLoad, useNow } from "../hooks.ts";
import { ErrorBox, Skeleton } from "../components/Ui.tsx";
import { HeroSection, type HeroMetrics } from "../components/HeroSection.tsx";
import { ProcessSection } from "../components/ProcessSection.tsx";
import { BountyTable } from "../components/BountyTable.tsx";

const PAGE = 20;

export function Bounties() {
  const [offset, setOffset] = useState(0);
  const now = useNow();
  const { data, error, loading, reload } = useLoad(() => (hasContract ? listBounties(offset, PAGE) : Promise.resolve(null)), [offset]);

  const items = data?.items ?? [];
  const active = items.filter((b) => b.status === "OPEN" && b.deadline > now && b.pool > 0n);
  const claimsTotal = items.reduce((a, b) => a + b.claimCount, 0);
  const claimsJudged = items.reduce((a, b) => a + (b.claimCount - b.pendingCount), 0);

  const metrics: HeroMetrics = {
    totalBounties: data ? data.total : null,
    activeBounties: data ? active.length : null,
    claimsJudged: data ? claimsJudged : null,
    claimsTotal: data ? claimsTotal : null,
    genLocked: data ? items.reduce((a, b) => a + b.pool, 0n) : null,
  };

  return (
    <>
      <HeroSection metrics={metrics} preview={active.slice(0, 3)} now={now} />
      <ProcessSection />

      <section id="bounties" className="scroll-mt-24 border-t border-line py-14" aria-labelledby="bounties-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">The feed</p>
            <h2 id="bounties-title" className="!mb-0 !mt-3 font-serif !text-[32px] font-semibold normal-case leading-tight !tracking-tight text-ink sm:!text-4xl">
              Open bounties and inspections.
            </h2>
          </div>
          <a
            href="#/create"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-accent-hover hover:no-underline"
          >
            Create a bounty
          </a>
        </div>

        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={4} />}
        {data && <BountyTable bounties={items} now={now} />}

        {data && data.total > PAGE && (
          <div className="mt-4 flex gap-2">
            <button className="ghost small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Newer
            </button>
            <button className="ghost small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
              Older
            </button>
          </div>
        )}
      </section>
    </>
  );
}
