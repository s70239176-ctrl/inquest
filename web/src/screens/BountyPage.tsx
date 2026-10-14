import { useState } from "react";
import { ArrowRight, ExternalLink, Gavel, ShieldCheck } from "lucide-react";
import { CONTRACT, getBounty, getParams, hasContract, listClaims, readJury, recallResolveTx, rememberResolveTx, sendTx } from "../lib/chain.ts";
import { fingerprintUrl, isHash } from "../lib/fingerprint.ts";
import { formatDate, formatGen, hostOf, shortAddr, timeLeft } from "../lib/format.ts";
import { splitRubric } from "../lib/rubric.ts";
import { bountyPhase, claimStanding, queueState, scopeExcerpt, MAX_CLAIMS } from "../lib/view.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Copy, ErrorBox, KV, Skeleton, Stat, TxStatus } from "../components/Ui.tsx";
import { StatusPill } from "../components/ui/StatusPill.tsx";
import { Tabs, panelProps, type TabDef } from "../components/ui/Tabs.tsx";
import type { Bounty, Claim } from "../lib/types.ts";

const URL_RE = /^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/;

type TabId = "overview" | "rubric" | "writeups" | "jury" | "activity";
const TAB_IDS: TabId[] = ["overview", "rubric", "writeups", "jury", "activity"];
const asTab = (t: string | undefined): TabId => (TAB_IDS.includes(t as TabId) ? (t as TabId) : "overview");

const PHASE_EXPLAIN: Record<string, string> = {
  "Rubric locked": "The rubric and pool are frozen and no report has been filed yet.",
  "Accepting reports": "Researchers can file reports until the deadline or until the pool is empty.",
  "Jury review": "At least one report is waiting for the independent jury. Reports are judged in the order they were filed. The project can withdraw only what is beyond the reserve for waiting reports.",
  Settled: "The pool has been fully paid out.",
  Closed: "The deadline has passed. No new reports are accepted.",
  Cancelled: "The project cancelled this bounty before any report was filed and took its pool back.",
};

/* ------------------------------------------------------------------ jury card */

function VoteDot({ vote }: { vote: string }) {
  const tone = vote === "agree" ? "bg-ok" : vote === "disagree" ? "bg-adverse" : "bg-neutral";
  return <span className={`inline-block h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />;
}

const heading = "m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-soft";

/** Evidence, validator assessments and the finalized verdict, kept visibly apart. Votes are read live from the node. */
function JuryCard({ claim }: { claim: Claim }) {
  const [hash, setHash] = useState<string | null>(() => recallResolveTx(claim.id));
  const [pasted, setPasted] = useState("");
  const [asked, setAsked] = useState(false);
  const jury = useLoad(async () => (asked && hash ? readJury(hash) : null), [asked, hash]);
  const standing = claimStanding(claim);
  const resolved = claim.status === "RESOLVED";
  const f = (v: boolean | null) => (v === null ? "—" : v ? "true" : "false");
  const agree = jury.data?.votes.filter((v) => v.vote === "agree").length ?? 0;
  const disagree = jury.data?.votes.filter((v) => v.vote === "disagree").length ?? 0;

  return (
    <article className="rounded-lg border border-app-line bg-app-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-app-line px-4 py-3">
        <div className="flex items-center gap-3">
          <a href={`#/c/${claim.id}`} className="font-mono text-[13px] font-semibold !text-app-text">
            Claim #{claim.id}
          </a>
          <StatusPill label={standing.label} tone={standing.tone} />
        </div>
        <span className="font-mono text-[11.5px] text-app-soft">{shortAddr(claim.researcher)}</span>
      </header>

      <div className="grid divide-app-line md:grid-cols-3 md:divide-x">
        {/* 1 evidence */}
        <div className="p-4">
          <h4 className={heading}>1 · Submitted evidence</h4>
          <a href={claim.url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex max-w-full items-start gap-1.5 break-all text-[13px] !text-gold">
            {hostOf(claim.url, 64)} <ExternalLink size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-2 text-[12px] text-app-soft">Filed {formatDate(claim.createdAt)}. Bond {formatGen(claim.bond, 6)} GEN.</p>
          <p className="m-0 mt-1 break-all font-mono text-[11px] text-app-soft" title="sha256 of the page text the researcher committed to">
            commitment {claim.evidenceHash.slice(0, 16)}…{claim.evidenceHash.slice(-6)}
          </p>
          <p className="text-[12px] text-app-soft">
            {claim.evidenceState === "changed"
              ? "The page no longer matches this commitment."
              : claim.evidenceState === "withdrawn"
                ? "The page stayed unreachable on every spaced retry."
                : claim.evidenceState === "unavailable"
                  ? `The page could not be loaded (attempt ${claim.attempts}). It will be retried.`
                  : "Read only by the validators. Nothing from the page is stored on-chain."}
          </p>
        </div>

        {/* 2 validators */}
        <div className="border-t border-app-line p-4 md:border-t-0">
          <h4 className={heading}>2 · Validator assessments</h4>
          {!resolved ? (
            <p className="mt-2 text-[12.5px] text-app-soft">Not judged yet.</p>
          ) : !hash ? (
            <div className="mt-2">
              <p className="m-0 text-[12.5px] text-app-soft">This browser did not send the resolve transaction. Paste its id to read the votes.</p>
              <input value={pasted} onChange={(e) => setPasted(e.target.value.trim())} placeholder="0x…" aria-label={`Resolve transaction id for claim ${claim.id}`} className="!mt-2 !text-[12px]" />
              <button
                className="ghost small mt-2"
                disabled={!/^0x[0-9a-fA-F]{64}$/.test(pasted)}
                onClick={() => {
                  rememberResolveTx(claim.id, pasted);
                  setHash(pasted);
                  setAsked(true);
                }}
              >
                Read votes
              </button>
            </div>
          ) : !asked ? (
            <button className="ghost small mt-2" onClick={() => setAsked(true)}>
              Load validator votes
            </button>
          ) : jury.loading && !jury.data ? (
            <Skeleton rows={2} />
          ) : jury.error ? (
            <ErrorBox message={jury.error} onRetry={jury.reload} />
          ) : jury.data ? (
            <div className="mt-2">
              <p className="m-0 text-[13px] text-app-text">
                <span className="font-mono">{agree}</span> agreed
                {disagree > 0 && (
                  <>
                    , <span className="font-mono">{disagree}</span> disagreed
                  </>
                )}
                <span className="text-app-soft">
                  {" "}
                  · {jury.data.rounds} round{jury.data.rounds === 1 ? "" : "s"}
                </span>
                {jury.data.appealed && <span className="text-pending"> · appealed</span>}
              </p>
              <ul className="m-0 mt-2 list-none space-y-1 p-0">
                {jury.data.votes.map((v) => (
                  <li key={v.validator} className="flex items-center gap-2 font-mono text-[11.5px] text-app-soft">
                    <VoteDot vote={v.vote} />
                    {shortAddr(v.validator)}
                    <span className="text-app-text">{v.vote}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-app-soft">Transaction {jury.data.status}. “Idle” means a validator was not needed once the others agreed.</p>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-app-soft">Transaction not found.</p>
          )}
        </div>

        {/* 3 verdict */}
        <div className="border-t border-app-line p-4 md:border-t-0">
          <h4 className={heading}>3 · Recorded verdict</h4>
          {!resolved ? (
            <p className="mt-2 text-[12.5px] text-app-soft">Waiting for the jury.</p>
          ) : (
            <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
              <dt className="text-app-soft">evidence_available</dt>
              <dd className="m-0">{f(claim.evidenceAvailable)}</dd>
              <dt className="text-app-soft">demonstrated</dt>
              <dd className="m-0">{f(claim.demonstrated)}</dd>
              <dt className="text-app-soft">in_scope</dt>
              <dd className="m-0">{f(claim.inScope)}</dd>
              <dt className="text-app-soft">duplicate_of</dt>
              <dd className="m-0">{claim.duplicateOf === null ? "null" : `claim ${claim.duplicateOf}`}</dd>
              <dt className="text-app-soft">severity</dt>
              <dd className="m-0 text-gold">{claim.severity}</dd>
              <dt className="text-app-soft">payout</dt>
              <dd className="m-0">{formatGen(claim.payout)} GEN</dd>
              <dt className="text-app-soft">bond</dt>
              <dd className="m-0">{claim.bondOutcome.toLowerCase()}</dd>
            </dl>
          )}
        </div>
      </div>
      <footer className="border-t border-app-line px-4 py-2.5 text-right">
        <a href={`#/c/${claim.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold !text-gold">
          Open claim <ArrowRight size={13} aria-hidden="true" />
        </a>
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------ activity */

interface Event {
  at: number;
  title: string;
  detail: string;
  tone: "gold" | "green" | "red" | "gray";
}

function Activity({ b, claims, idp }: { b: Bounty; claims: Claim[]; idp: string }) {
  const events: Event[] = [{ at: b.createdAt, title: "Bounty created", detail: `${shortAddr(b.project)} locked the pool and froze the rubric.`, tone: "gold" }];
  for (const c of claims) {
    events.push({ at: c.createdAt, title: `Claim #${c.id} filed`, detail: `${shortAddr(c.researcher)} posted a writeup and a ${formatGen(c.bond, 6)} GEN bond.`, tone: "gray" });
    if (c.status === "EXPIRED") {
      events.push({ at: c.resolvedAt, title: `Claim #${c.id}: expired`, detail: "No verdict within the waiting window. The bond was returned and the queue moved on.", tone: "gray" });
    }
    if (c.status === "RESOLVED") {
      const st = claimStanding(c);
      events.push({
        at: c.resolvedAt,
        title: `Claim #${c.id}: ${st.label.toLowerCase()}`,
        detail:
          c.payout > 0n
            ? `${formatGen(c.payout)} GEN scheduled to the researcher; bond returned.`
            : c.evidenceState === "changed"
              ? "The page changed after it was committed to. Bond slashed to the project."
              : c.evidenceState === "withdrawn"
                ? "The page stayed unreachable on every retry. Bond slashed to the project."
                : c.bondOutcome === "SLASHED"
                  ? "Bond slashed to the project. No payout."
                  : "Bond returned. No payout.",
        tone: st.tone === "green" ? "green" : st.tone === "red" ? "red" : "gray",
      });
    }
  }
  events.sort((a, z) => z.at - a.at);
  const dot = { gold: "bg-gold", green: "bg-ok", red: "bg-adverse", gray: "bg-neutral" } as const;

  return (
    <div {...panelProps(idp, "activity")} className="outline-none">
      <div className="panel tight row between">
        <KV k="Contract">
          <Copy text={CONTRACT} label={shortAddr(CONTRACT)} />
        </KV>
        <KV k="Bounty id">#{b.id}</KV>
        <KV k="Network">GenLayer Studionet</KV>
      </div>

      <h2>Timeline</h2>
      <ol className="m-0 list-none border-l border-app-line p-0 pl-5">
        {events.map((e, i) => (
          <li key={i} className="relative pb-5">
            <span className={`absolute -left-[25.5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-app-bg ${dot[e.tone]}`} aria-hidden="true" />
            <div className="text-[13.5px] font-semibold text-app-text">{e.title}</div>
            <div className="text-[12.5px] text-app-soft">{e.detail}</div>
            <div className="mt-0.5 font-mono text-[11px] text-app-soft">{formatDate(e.at)}</div>
          </li>
        ))}
      </ol>
      <p className="hint">Verdicts are provisional until their resolve transaction finalizes, and GEN moves only then. Open a claim to see its settlement status.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export function BountyPage({ id, tab }: { id: number; tab?: string }) {
  const { signer, me, connectWallet, useDemoAccount } = useSession();
  const now = useNow();
  const bounty = useLoad(() => getBounty(id), [id]);
  const claims = useLoad(() => listClaims(id, "", 0, 20), [id]);
  const tx = useTx();
  const [judging, setJudging] = useState(false);
  const [url, setUrl] = useState("");
  const [manualHash, setManualHash] = useState<string | null>(null);
  const [fpError, setFpError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const params = useLoad(() => getParams(), []);
  const active = asTab(tab);

  const b = bounty.data;
  if (bounty.error) return <ErrorBox message={bounty.error} onRetry={bounty.reload} />;
  if (!b) return <Skeleton rows={6} />;

  const list = claims.data?.items ?? [];
  const isProject = me !== "" && me === b.project;
  const phase = bountyPhase(b, now);
  const ended = b.status !== "OPEN" || now > b.deadline;
  const open = !ended && b.pool > 0n;
  const urlOk = URL_RE.test(url) && url.length <= 300;
  const pendingMine = list.some((c) => c.researcher === me && c.status === "PENDING");
  const myClaims = list.filter((c) => c.researcher === me).length;

  const go = (t: TabId) => {
    window.location.hash = t === "overview" ? `#/b/${id}` : `#/b/${id}/${t}`;
  };
  const refresh = () => {
    bounty.reload();
    claims.reload();
  };

  async function submitClaim() {
    if (!signer || !b) return;
    setJudging(false);
    setNote(null);
    // The researcher commits to what the page says right now. If this browser cannot read it, they can paste a fingerprint
    // computed with `npm run fingerprint -- <url>` (the same code, run in node).
    let hash = manualHash !== null && manualHash !== "" ? manualHash.trim() : "";
    if (hash === "") {
      try {
        hash = (await fingerprintUrl(url.trim())).hash;
        setFpError(null);
      } catch (e) {
        setFpError(e instanceof Error ? e.message : String(e));
        setManualHash((m) => m ?? "");
        return;
      }
    }
    if (!isHash(hash)) {
      setFpError("The fingerprint must be 64 lowercase hex characters.");
      return;
    }
    const out = await tx.run((onPhase) => sendTx(signer, "submit_claim", [BigInt(id), url.trim(), hash], b.bond, onPhase));
    if (out && !out.error) {
      setUrl("");
      setManualHash(null);
      refresh();
    }
  }

  async function expire(claimId: number) {
    if (!signer) return;
    setJudging(false);
    const out = await tx.run((onPhase) => sendTx(signer, "expire_claim", [BigInt(claimId)], 0n, onPhase));
    if (out && !out.error) {
      setNote(`Claim #${claimId} expired. The bond was returned and the queue moved on.`);
      refresh();
    }
  }

  async function act(fn: "cancel" | "withdraw") {
    if (!signer) return;
    setJudging(false);
    const out = await tx.run((onPhase) => sendTx(signer, fn, [BigInt(id)], 0n, onPhase));
    if (out && !out.error) refresh();
  }

  async function resolve(claimId: number) {
    if (!signer) return;
    setJudging(true);
    const out = await tx.run((onPhase) => sendTx(signer, "resolve_claim", [BigInt(claimId)], 0n, onPhase, (h) => rememberResolveTx(claimId, h)));
    if (out?.result === "unavailable") {
      setNote(`Claim #${claimId}: the page could not be loaded. Nothing was judged and nothing was lost. It will be retried after the wait shown in the table.`);
    }
    if (out) refresh();
  }

  const tabs: TabDef<TabId>[] = [
    { id: "overview", label: "Overview" },
    { id: "rubric", label: "Frozen rubric" },
    { id: "writeups", label: "Submitted writeups", badge: b.claimCount },
    { id: "jury", label: "Jury review", badge: b.pendingCount > 0 ? `${b.pendingCount} open` : undefined },
    { id: "activity", label: "On-chain activity" },
  ];
  const idp = "bounty";

  return (
    <>
      <p className="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-app-soft">
        <a href="#/" className="!text-app-soft hover:!text-app-text">Inquest</a> /{" "}
        <a href="#/bounties" className="!text-app-soft hover:!text-app-text">Bounties</a> / #{b.id}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="!mb-2 !mt-2">{b.title}</h1>
          <p className="lede !mt-0">{scopeExcerpt(b.rubric, 200)}</p>
        </div>
        <div className="pt-2">
          <StatusPill label={phase.label} tone={phase.tone} />
        </div>
      </div>

      <div className="mt-6">
        <Tabs tabs={tabs} active={active} onChange={go} label="Bounty sections" idPrefix={idp} />
      </div>

      <TxStatus state={tx.state} judging={judging} />

      <div className="animate-rise pt-6" key={active}>
        {active === "overview" && (
          <div {...panelProps(idp, "overview")} className="outline-none">
            <div className="stat-grid">
              <Stat k="Pool remaining" v={formatGen(b.pool)} s="GEN" />
              <Stat k="Claim bond" v={formatGen(b.bond, 6)} s="GEN, returned unless slashed" />
              <Stat k="Closes" v={timeLeft(b.deadline, now)} s={formatDate(b.deadline)} />
              <Stat k="Reports" v={`${b.claimCount} / ${MAX_CLAIMS}`} s={`${b.pendingCount} in review · ${b.acceptedIds.length} paid`} />
            </div>

            <div className="mt-4 rounded-lg border border-app-line bg-app-surface p-4">
              <p className="m-0 text-[13.5px] text-app-text">
                <b>{phase.label}.</b> <span className="text-app-soft">{PHASE_EXPLAIN[phase.label]}</span>
              </p>
            </div>

            <h2>What it pays</h2>
            <div className="stat-grid">
              <Stat k="High" v={formatGen(b.highPayout)} s="GEN" />
              <Stat k="Medium" v={formatGen(b.mediumPayout)} s="GEN" />
              <Stat k="Low" v={formatGen(b.lowPayout)} s="GEN" />
            </div>
            <p className="hint">Absolute amounts, capped by what remains. Between two bands the jury pays the lower.</p>

            <h2>Program</h2>
            <div className="panel tight row between">
              <KV k="Project">
                <Copy text={b.project} label={shortAddr(b.project)} />
              </KV>
              <KV k="Repository (context only)">
                <a href={b.repoUrl} target="_blank" rel="noreferrer noopener">
                  {hostOf(b.repoUrl, 44)}
                </a>
              </KV>
              <KV k="Created">{formatDate(b.createdAt)}</KV>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {open && !isProject && (
                <button onClick={() => go("writeups")} className="!inline-flex !items-center !gap-2">
                  Submit a report <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
              <button className="ghost" onClick={() => go("rubric")}>
                Read the frozen rubric
              </button>
            </div>

            {isProject && (
              <>
                <h2>Project controls</h2>
                <div className="panel">
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button className="danger" disabled={tx.busy || b.status !== "OPEN" || now > b.deadline || b.claimCount > 0} onClick={() => act("cancel")}>
                      Cancel and return pool
                    </button>
                    <button disabled={tx.busy || b.withdrawable === 0n} onClick={() => act("withdraw")}>
                      Withdraw {formatGen(b.withdrawable)} GEN
                    </button>
                  </div>
                  <p className="hint">
                    Cancel works only before the deadline with zero reports. Withdraw (slashed bonds plus any leftover pool) opens after the
                    deadline, or once the bounty is depleted. A reserve of {formatGen(b.reserved)} GEN stays locked for reports still waiting, so
                    withdrawing never leaves a researcher unpaid.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {active === "rubric" && (
          <div {...panelProps(idp, "rubric")} className="outline-none">
            <div className="flex items-center gap-2 text-[13px] text-app-soft">
              <ShieldCheck size={16} className="text-gold" aria-hidden="true" />
              Frozen at creation. No admin can edit it, and the jury judges every report against exactly this text.
            </div>
            <div className="mt-4">
              {splitRubric(b.rubric).map((s) => (
                <details className="rubric" key={s.label} open>
                  <summary>{s.label}</summary>
                  <div className="body pre">{s.body}</div>
                </details>
              ))}
            </div>
          </div>
        )}

        {active === "writeups" && (
          <div {...panelProps(idp, "writeups")} className="outline-none">
            <h2 className="!mt-0">File a report</h2>
            {!open ? (
              <div className="empty">{ended ? "This bounty is closed to new reports." : "The pool is empty."}</div>
            ) : isProject ? (
              <div className="empty">The project cannot file a report on its own bounty.</div>
            ) : (
              <div className="panel">
                <p className="muted" style={{ marginTop: 0 }}>
                  One public https URL. The page must show the behavior, a concrete reproduction and the cause. Your report is committed to
                  what the page says now (a fingerprint of its text): if it is edited afterwards, or taken down, the bond is lost. The jury
                  reads that page and every earlier accepted writeup on this bounty, and follows no other link.
                </p>
                <label htmlFor="url">Writeup URL</label>
                <input id="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
                {url !== "" && !urlOk && <div className="hint err">Use one https URL: no credentials, port, IP address or local host.</div>}
                {fpError && <div className="hint err">{fpError}</div>}
                {manualHash !== null && (
                  <>
                    <label htmlFor="fp">Evidence fingerprint (sha256, 64 hex characters)</label>
                    <input id="fp" value={manualHash} placeholder="paste the output of: npm run fingerprint -- <url>" onChange={(e) => setManualHash(e.target.value.trim().toLowerCase())} />
                  </>
                )}
                <div className="hint">
                  Bond <span className="acc mono">{formatGen(b.bond, 6)} GEN</span> · you have used {myClaims} of 3 reports here
                  {pendingMine && " · one of yours is waiting for a verdict"}
                </div>
                <div className="actions">
                  {signer ? (
                    <button disabled={tx.busy || !hasContract || !urlOk || pendingMine || myClaims >= 3} onClick={submitClaim}>
                      Submit with {formatGen(b.bond, 6)} GEN bond
                    </button>
                  ) : (
                    <>
                      <button onClick={connectWallet}>Connect wallet</button>
                      <button className="ghost" onClick={useDemoAccount}>
                        Use demo account
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {note && <div className="tx">{note}</div>}
            <h2>Submitted writeups</h2>
            {b.pendingCount > 1 && <p className="hint">Reports are judged in the order they were filed, so a later copy can never be judged ahead of the original.</p>}
            {claims.error && <ErrorBox message={claims.error} onRetry={claims.reload} />}
            {claims.loading && !claims.data && <Skeleton rows={3} />}
            {claims.data && list.length === 0 && <div className="empty">No reports yet.</div>}
            {list.length > 0 && (
              <div className="tbl">
                <table>
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Writeup</th>
                      <th>Status</th>
                      <th className="num">Paid (GEN)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => {
                      const st = claimStanding(c);
                      return (
                        <tr key={c.id} className="hover">
                          <td>
                            <a href={`#/c/${c.id}`}>#{c.id}</a>
                            <div className="sub">
                              {shortAddr(c.researcher)}
                              {c.researcher === me && " · you"}
                            </div>
                          </td>
                          <td className="max-w-[18rem]">
                            <a href={c.url} target="_blank" rel="noreferrer noopener" className="block truncate !text-app-text hover:!text-gold">
                              {hostOf(c.url, 48)}
                            </a>
                            <div className="sub">{formatDate(c.createdAt)}</div>
                          </td>
                          <td>
                            <StatusPill label={st.label} tone={st.tone} />
                          </td>
                          <td className="num">{formatGen(c.payout)}</td>
                          <td className="text-right">
                            {(() => {
                              const q = queueState(c, b.headClaimId, params.data?.retryGap ?? 0, now);
                              if (q.state === "head")
                                return (
                                  <button className="small" disabled={tx.busy || !signer} onClick={() => resolve(c.id)} title={signer ? "Start the jury" : "Connect or use the demo account"}>
                                    Resolve
                                  </button>
                                );
                              if (q.state === "expirable")
                                return (
                                  <button className="small ghost" disabled={tx.busy || !signer} onClick={() => expire(c.id)} title="Waited too long for a verdict: return the bond and move the queue on">
                                    Expire
                                  </button>
                                );
                              if (q.state === "retry-wait") return <span className="sub">retry in {Math.ceil(q.waitSeconds / 60)} min</span>;
                              if (q.state === "waiting") return <span className="sub">waits for #{b.headClaimId}</span>;
                              return null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {active === "jury" && (
          <div {...panelProps(idp, "jury")} className="outline-none">
            <p className="m-0 flex items-center gap-2 text-[13px] text-app-soft">
              <Gavel size={16} className="text-gold" aria-hidden="true" />
              Each report shows the evidence, what the validators voted, and the verdict the contract recorded: three different things.
            </p>
            {claims.loading && !claims.data && <Skeleton rows={3} />}
            {claims.data && list.length === 0 && <div className="empty mt-4">No report has been filed, so there is nothing to judge yet.</div>}
            <div className="mt-4 flex flex-col gap-4">
              {list.map((c) => (
                <JuryCard key={c.id} claim={c} />
              ))}
            </div>
          </div>
        )}

        {active === "activity" && <Activity b={b} claims={list} idp={idp} />}
      </div>
    </>
  );
}
