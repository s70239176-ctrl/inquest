import { useState } from "react";
import { hasContract, listBounties } from "../lib/chain.ts";
import { formatDeadline, formatGen, timeLeft } from "../lib/format.ts";
import { useLoad, useNow } from "../hooks.ts";
import { Chip, Empty, ErrorBox, Skeleton, Stat } from "../components/Ui.tsx";

const PAGE = 20;

export function Bounties() {
  const [offset, setOffset] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const now = useNow();
  const { data, error, loading, reload } = useLoad(() => (hasContract ? listBounties(offset, PAGE) : Promise.resolve(null)), [offset]);

  const items = (data?.items ?? []).filter((b) => !onlyOpen || (b.status === "OPEN" && b.deadline > now));
  const locked = (data?.items ?? []).reduce((a, b) => a + b.pool, 0n);
  const claims = (data?.items ?? []).reduce((a, b) => a + b.claimCount, 0);
  const waiting = (data?.items ?? []).reduce((a, b) => a + b.pendingCount, 0);

  return (
    <>
      <h1>A bug isn't real until it repros.</h1>
      <p className="lede">
        Inquest pays a bug bounty only when a jury of independent validators agrees that a <b>public writeup</b> proves an in-scope,
        non-duplicate bug. The pool and the rubric are locked on-chain. No admin, no moderator, no backend model. If the jury cannot
        decide, no GEN moves.
      </p>

      <div className="steps" aria-label="How it works">
        <div>
          <div className="n">01</div>
          <div className="t">Lock a bounty</div>
          <div className="d">A project locks GEN and a frozen rubric: scope, duplicates, severity bars.</div>
        </div>
        <div>
          <div className="n">02</div>
          <div className="t">Submit a writeup</div>
          <div className="d">A researcher posts one public URL and a small bond. Nothing runs against any target.</div>
        </div>
        <div>
          <div className="n">03</div>
          <div className="t">The jury reads it</div>
          <div className="d">Each validator fetches the page itself and answers five fixed fields. Prose is never compared.</div>
        </div>
        <div>
          <div className="n">04</div>
          <div className="t">A table settles it</div>
          <div className="d">Pay, slash or refund from those fields only, and only once the verdict finalizes.</div>
        </div>
      </div>

      <h2>Live bounties</h2>
      {data && (
        <div className="grid" style={{ marginBottom: 14 }}>
          <Stat k="Bounties" v={data.total} />
          <Stat k="GEN locked" v={formatGen(locked)} s="in the pools shown" />
          <Stat k="Claims" v={claims} s={`${waiting} waiting for a verdict`} />
        </div>
      )}

      <div className="row between" style={{ margin: "6px 0 10px" }}>
        <div className="row">
          <button className={onlyOpen ? "ghost small" : "small"} onClick={() => setOnlyOpen(false)}>
            All
          </button>
          <button className={onlyOpen ? "small" : "ghost small"} onClick={() => setOnlyOpen(true)}>
            Open
          </button>
        </div>
        <a href="#/create">
          <button className="small">Create a bounty</button>
        </a>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={4} />}
      {data && items.length === 0 && (
        <Empty>
          {data.items.length === 0 ? (
            <>No bounties yet. <a href="#/create">Create the first one.</a></>
          ) : (
            <>No open bounties on this page.</>
          )}
        </Empty>
      )}
      {items.length > 0 && (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Bounty</th>
                <th className="num">Pool (GEN)</th>
                <th className="num hide-sm">High (GEN)</th>
                <th className="hide-sm">Claims</th>
                <th>Closes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const closed = b.status !== "OPEN" || b.deadline <= now;
                return (
                  <tr className="hover" key={b.id}>
                    <td>
                      <a href={`#/b/${b.id}`}>{b.title}</a>
                      <div className="sub">#{b.id}</div>
                    </td>
                    <td className="num">{formatGen(b.pool)}</td>
                    <td className="num hide-sm">{formatGen(b.highPayout)}</td>
                    <td className="hide-sm">
                      {b.claimCount}
                      {b.pendingCount > 0 && <span className="sub"> · {b.pendingCount} waiting</span>}
                    </td>
                    <td className="nowrap">
                      <span title={formatDeadline(b.deadline)}>{timeLeft(b.deadline, now)}</span>
                    </td>
                    <td>
                      <Chip value={closed && b.status === "OPEN" ? "CLOSED" : b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > PAGE && (
        <div className="actions">
          <button className="ghost small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            Newer
          </button>
          <button className="ghost small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
            Older
          </button>
        </div>
      )}
    </>
  );
}
