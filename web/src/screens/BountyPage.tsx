import { useState } from "react";
import { getBounty, hasContract, listClaims, sendTx, rememberResolveTx } from "../lib/chain.ts";
import { formatDate, formatGen, hostOf, shortAddr, timeLeft } from "../lib/format.ts";
import { splitRubric } from "../lib/rubric.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Chip, Copy, Empty, ErrorBox, KV, Skeleton, Stat, TxStatus } from "../components/Ui.tsx";

const URL_RE = /^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/;

export function BountyPage({ id }: { id: number }) {
  const { signer, me, connectWallet, useDemoAccount } = useSession();
  const now = useNow();
  const bounty = useLoad(() => getBounty(id), [id]);
  const claims = useLoad(() => listClaims(id, "", 0, 20), [id]);
  const tx = useTx();
  const [url, setUrl] = useState("");

  const b = bounty.data;
  if (bounty.error) return <ErrorBox message={bounty.error} onRetry={bounty.reload} />;
  if (!b) return <Skeleton rows={5} />;

  const isProject = me !== "" && me === b.project;
  const ended = b.status !== "OPEN" || now > b.deadline;
  const open = !ended && b.pool > 0n;
  const urlOk = URL_RE.test(url) && url.length <= 300;
  const pendingMine = (claims.data?.items ?? []).some((c) => c.researcher === me && c.status === "PENDING");
  const myClaims = (claims.data?.items ?? []).filter((c) => c.researcher === me).length;

  const refresh = () => {
    bounty.reload();
    claims.reload();
  };

  async function submitClaim() {
    if (!signer || !b) return;
    const out = await tx.run((onPhase) => sendTx(signer, "submit_claim", [BigInt(id), url.trim()], b.bond, onPhase));
    if (out && !out.error) {
      setUrl("");
      refresh();
    }
  }

  async function act(fn: "cancel" | "withdraw") {
    if (!signer) return;
    const out = await tx.run((onPhase) => sendTx(signer, fn, [BigInt(id)], 0n, onPhase));
    if (out && !out.error) refresh();
  }

  async function resolve(claimId: number) {
    if (!signer) return;
    const out = await tx.run((onPhase) =>
      sendTx(signer, "resolve_claim", [BigInt(claimId)], 0n, onPhase, (h) => rememberResolveTx(claimId, h)),
    );
    if (out) refresh();
  }

  const status = ended && b.status === "OPEN" ? "CLOSED" : b.status;

  return (
    <>
      <p className="muted" style={{ margin: "18px 0 0" }}>
        <a href="#/">← Bounties</a> · #{b.id}
      </p>
      <div className="row between">
        <h1 style={{ margin: "6px 0" }}>{b.title}</h1>
        <Chip value={status} />
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Stat k="Pool remaining" v={`${formatGen(b.pool)}`} s="GEN" />
        <Stat k="Claim bond" v={formatGen(b.bond, 6)} s="GEN, returned unless slashed" />
        <Stat k="Closes" v={timeLeft(b.deadline, now)} s={formatDate(b.deadline)} />
        <Stat k="Claims" v={b.claimCount} s={`${b.pendingCount} waiting · ${b.acceptedIds.length} paid`} />
      </div>

      <div className="panel tight row between" style={{ marginTop: 12 }}>
        <KV k="Project">
          <Copy text={b.project} label={shortAddr(b.project)} />
        </KV>
        <KV k="Repository (context only)">
          <a href={b.repoUrl} target="_blank" rel="noreferrer noopener">
            {hostOf(b.repoUrl, 44)}
          </a>
        </KV>
      </div>

      <h2>What it pays</h2>
      <div className="grid">
        <Stat k="High" v={formatGen(b.highPayout)} s="GEN" />
        <Stat k="Medium" v={formatGen(b.mediumPayout)} s="GEN" />
        <Stat k="Low" v={formatGen(b.lowPayout)} s="GEN" />
      </div>
      <p className="hint">Absolute amounts, capped by what remains. Between two bands the jury pays the lower.</p>

      <h2>Frozen rubric</h2>
      {splitRubric(b.rubric).map((s, i) => (
        <details className="rubric" key={s.label} open={i === 0 || s.label === "Severity bars"}>
          <summary>{s.label}</summary>
          <div className="body pre">{s.body}</div>
        </details>
      ))}

      <h2>Submit a claim</h2>
      {!open ? (
        <Empty>{ended ? "This bounty is closed to new claims." : "The pool is empty."}</Empty>
      ) : isProject ? (
        <Empty>The project cannot claim its own bounty.</Empty>
      ) : (
        <div className="panel">
          <p className="muted" style={{ marginTop: 0 }}>
            One public https URL to a writeup. It must show the behavior, a concrete reproduction and the cause. The jury reads that page and
            earlier accepted writeups on this bounty, and follows no other link.
          </p>
          <label htmlFor="url">Writeup URL</label>
          <input id="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
          {url !== "" && !urlOk && <div className="hint err">Use one https URL: no credentials, port, IP address or local host.</div>}
          <div className="hint">
            Bond <span className="acc mono">{formatGen(b.bond, 6)} GEN</span> · {myClaims} of 3 claims used by you on this bounty
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
              Cancel works only before the deadline with zero claims. Withdraw (slashed bonds plus any leftover pool) opens after the deadline,
              or once the bounty is depleted, and only when no claim is waiting.
            </p>
          </div>
        </>
      )}
      <TxStatus state={tx.state} />

      <h2>Claims</h2>
      {claims.error && <ErrorBox message={claims.error} onRetry={claims.reload} />}
      {claims.loading && !claims.data && <Skeleton rows={3} />}
      {claims.data && claims.data.items.length === 0 && <Empty>No claims yet.</Empty>}
      {claims.data && claims.data.items.length > 0 && (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Researcher</th>
                <th className="hide-sm">Writeup</th>
                <th>Verdict</th>
                <th className="num">Paid (GEN)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {claims.data.items.map((c) => (
                <tr className="hover" key={c.id}>
                  <td>
                    <a href={`#/c/${c.id}`}>{c.id}</a>
                  </td>
                  <td className="mono">{shortAddr(c.researcher)}{c.researcher === me && <span className="sub"> · you</span>}</td>
                  <td className="hide-sm muted">{hostOf(c.url, 38)}</td>
                  <td>
                    {c.status === "PENDING" ? (
                      <Chip value="PENDING" />
                    ) : (
                      <span className="row" style={{ gap: 6 }}>
                        <Chip value={c.severity} />
                        <Chip value={c.bondOutcome} />
                      </span>
                    )}
                  </td>
                  <td className="num">{formatGen(c.payout)}</td>
                  <td>
                    {c.status === "PENDING" && (
                      <button className="small" disabled={tx.busy || !signer} onClick={() => resolve(c.id)} title={signer ? "Start the jury" : "Connect or use the demo account"}>
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
