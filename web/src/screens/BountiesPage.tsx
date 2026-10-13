import { Plus } from "lucide-react";
import { NETWORK, hasContract } from "../lib/chain.ts";
import { useBountyFeed } from "../hooks.ts";
import { BountyList } from "../components/bounties/BountyList.tsx";
import { ErrorBox, Skeleton } from "../components/Ui.tsx";
import { useSession } from "../wallet-context.ts";
import { shortAddr } from "../lib/format.ts";

/** Functional application screen: dark, dense, searchable. */
export function BountiesPage() {
  const { data, error, loading, reload, now } = useBountyFeed(20);
  const { signer } = useSession();

  return (
    <>
      <p className="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-app-soft">
        <a href="#/" className="!text-app-soft hover:!text-app-text">Inquest</a> / Bounties
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="!mb-1 !mt-2">Bounties</h1>
          <p className="lede">Browse and track bug bounty programs on the {NETWORK}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-app-line bg-app-surface px-3 py-1.5 font-mono text-[11.5px] text-app-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${signer ? "bg-ok" : "bg-neutral"}`} aria-hidden="true" />
            {signer ? `${signer.kind === "sandbox" ? "demo " : ""}${shortAddr(signer.address)}` : "read-only"}
          </span>
          <a href="#/create">
            <button className="small !inline-flex !items-center !gap-1.5">
              <Plus size={14} aria-hidden="true" /> Create a bounty
            </button>
          </a>
        </div>
      </div>

      <div className="mt-7">
        {!hasContract && <ErrorBox message="No contract is configured for this build." />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading && !data && <Skeleton rows={5} />}
        {data && <BountyList bounties={data.items} now={now} />}
        {data && data.total > data.items.length && (
          <p className="mt-3 text-[12.5px] text-app-soft">Showing the newest {data.items.length} of {data.total} bounties.</p>
        )}
      </div>
    </>
  );
}
