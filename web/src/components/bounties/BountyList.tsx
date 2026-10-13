import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { formatDeadline, formatGen, shortAddr, timeLeft } from "../../lib/format.ts";
import type { Bounty } from "../../lib/types.ts";
import {
  MAX_CLAIMS,
  SORTS,
  STATUS_FILTERS,
  bountyPhase,
  claimFill,
  matchesStatus,
  scopeExcerpt,
  searchBounties,
  sortBounties,
  type SortKey,
  type StatusFilter,
} from "../../lib/view.ts";
import { StatusPill } from "../ui/StatusPill.tsx";

function Progress({ b }: { b: Bounty }) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline gap-1.5 font-mono text-[12.5px] text-app-text">
        {b.claimCount}
        <span className="text-app-soft">/ {MAX_CLAIMS}</span>
        {b.pendingCount > 0 && <span className="ml-1 text-[11px] text-pending">{b.pendingCount} in review</span>}
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-app-line" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_CLAIMS} aria-valuenow={b.claimCount} aria-label="Claims submitted">
        <div className="h-full rounded-full bg-gold/80" style={{ width: `${claimFill(b)}%` }} />
      </div>
    </div>
  );
}

function Action({ b, now }: { b: Bounty; now: number }) {
  const accepting = bountyPhase(b, now).bucket === "accepting";
  return (
    <a
      href={`#/b/${b.id}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors hover:no-underline ${
        accepting ? "border-gold/60 bg-gold/10 !text-gold hover:bg-gold/20" : "border-app-line !text-app-text hover:border-app-soft"
      }`}
    >
      {accepting ? "Submit a report" : "Inspect"}
      <ArrowRight size={14} aria-hidden="true" />
    </a>
  );
}

export function BountyList({
  bounties,
  now,
  limit,
  toolbar = true,
  emptyAction,
}: {
  bounties: Bounty[];
  now: number;
  /** Show at most this many rows (the homepage preview). */
  limit?: number;
  toolbar?: boolean;
  emptyAction?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const counts = useMemo(() => {
    const m: Record<StatusFilter, number> = { all: bounties.length, accepting: 0, review: 0, settled: 0 };
    for (const b of bounties) m[bountyPhase(b, now).bucket] += 1;
    return m;
  }, [bounties, now]);

  const rows = useMemo(() => {
    const filtered = searchBounties(bounties, query).filter((b) => matchesStatus(b, status, now));
    const sorted = sortBounties(filtered, sort, now);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [bounties, query, status, sort, now, limit]);

  const filtering = query.trim() !== "" || status !== "all";

  return (
    <div>
      {toolbar && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative !m-0 block flex-1">
              <span className="sr-only">Search bounties</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-soft" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, id, project address or scope"
                className="!pl-9 !pr-9"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="!absolute !right-2 !top-1/2 !-translate-y-1/2 !rounded !bg-transparent !p-1 !text-app-soft hover:!bg-transparent hover:!text-app-text"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="!m-0 block sm:w-48">
              <span className="sr-only">Sort bounties</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort bounties">
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const on = status === f.id;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStatus(f.id)}
                  className={`!rounded-full !border !px-3.5 !py-1 !text-[12.5px] !font-medium ${
                    on ? "!border-gold !bg-gold/10 !text-gold" : "!border-app-line !bg-transparent !text-app-soft hover:!border-app-soft hover:!bg-transparent hover:!text-app-text"
                  }`}
                >
                  {f.label}
                  <span className="ml-1.5 font-mono text-[11px] opacity-70">{counts[f.id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-app-line bg-app-surface px-6 py-12 text-center">
          <p className="m-0 text-app-text">{filtering ? "No bounty matches this search." : "No bounties yet."}</p>
          <p className="mt-1 text-[13px] text-app-soft">
            {filtering ? "Try a different word, or clear the filters." : "Be the first to lock a pool and a rubric."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {filtering && (
              <button className="ghost small" onClick={() => { setQuery(""); setStatus("all"); }}>
                Clear filters
              </button>
            )}
            {!filtering && emptyAction !== false && (
              <a href="#/create">
                <button className="small">Create a bounty</button>
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop and tablet: dense table */}
          <div className="hidden overflow-hidden rounded-lg border border-app-line bg-app-surface md:block">
            <table>
              <thead className="bg-app-raised/60">
                <tr>
                  <th scope="col">Bounty</th>
                  <th scope="col" className="num">Pool (GEN)</th>
                  <th scope="col">Reports</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const phase = bountyPhase(b, now);
                  const scope = scopeExcerpt(b.rubric, 110);
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-app-raised/60">
                      <td className="max-w-[26rem] !py-4">
                        <a href={`#/b/${b.id}`} className="font-semibold !text-app-text hover:!text-gold hover:no-underline">
                          {b.title}
                        </a>
                        {scope && <div className="mt-1 line-clamp-1 text-[12.5px] text-app-soft">{scope}</div>}
                        <div className="mt-1 font-mono text-[11px] text-app-soft">
                          #{b.id} · {shortAddr(b.project)}
                        </div>
                      </td>
                      <td className="num !py-4 text-[15px] font-medium text-app-text">{formatGen(b.pool)}</td>
                      <td className="!py-4">
                        <Progress b={b} />
                      </td>
                      <td className="!py-4">
                        <StatusPill label={phase.label} tone={phase.tone} />
                        <div className="mt-1 text-[11px] text-app-soft" title={formatDeadline(b.deadline)}>
                          {timeLeft(b.deadline, now)}
                        </div>
                      </td>
                      <td className="!py-4 text-right">
                        <Action b={b} now={now} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
            {rows.map((b) => {
              const phase = bountyPhase(b, now);
              const scope = scopeExcerpt(b.rubric, 90);
              return (
                <li key={b.id} className="rounded-lg border border-app-line bg-app-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <a href={`#/b/${b.id}`} className="text-[15px] font-semibold leading-snug !text-app-text hover:no-underline">
                      {b.title}
                    </a>
                    <StatusPill label={phase.label} tone={phase.tone} />
                  </div>
                  {scope && <p className="mt-1.5 text-[12.5px] text-app-soft">{scope}</p>}
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-wider text-app-soft">Pool</dt>
                      <dd className="m-0 font-mono text-[14px] text-app-text">{formatGen(b.pool)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-wider text-app-soft">Reports</dt>
                      <dd className="m-0 font-mono text-[14px] text-app-text">{b.claimCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-wider text-app-soft">Closes</dt>
                      <dd className="m-0 font-mono text-[14px] text-app-text">{timeLeft(b.deadline, now)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <Action b={b} now={now} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
