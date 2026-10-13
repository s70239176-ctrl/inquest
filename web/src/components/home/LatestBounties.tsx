import { ArrowRight } from "lucide-react";
import type { Bounty } from "../../lib/types.ts";
import { ErrorBox, Skeleton } from "../Ui.tsx";
import { BountyList } from "../bounties/BountyList.tsx";

/** The first technical surface: dark, dense, searchable. Shows the newest bounties and links to the full list. */
export function LatestBounties({
  bounties,
  total,
  now,
  loading,
  error,
  onRetry,
}: {
  bounties: Bounty[] | null;
  total: number;
  now: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section id="latest" className="scroll-mt-20 bg-app-bg text-app-text" aria-labelledby="latest-title">
      <div className="mx-auto max-w-page px-5 py-16 lg:py-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-gold">Live on-chain</p>
            <h2 id="latest-title" className="!m-0 mt-3 font-serif !text-[38px] !font-normal !normal-case !leading-[1.05] !tracking-tight !text-app-text sm:!text-[46px]">
              Latest bounties
            </h2>
          </div>
          <a href="#/bounties" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold !text-gold hover:no-underline">
            View all {total > 0 ? `${total} ` : ""}bounties <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>

        {error && <ErrorBox message={error} onRetry={onRetry} />}
        {loading && !bounties && <Skeleton rows={4} />}
        {bounties && <BountyList bounties={bounties} now={now} limit={5} />}
      </div>
    </section>
  );
}
