import { useState } from "react";
import { getBounty, hasContract, listClaims, sendTx } from "../lib/chain.ts";
import { formatDeadline, formatGen, shortAddr, timeLeft } from "../lib/format.ts";
import { splitRubric } from "../lib/rubric.ts";
import { useLoad, useTx } from "../hooks.ts";
import { useWallet } from "../wallet-context.ts";
import { ErrorBox, KV, Loading, Pill, TxStatus } from "../components/Ui.tsx";

const hostOf = (u: string) => u.replace(/^https:\/\//, "").slice(0, 60);

export function BountyPage({ id }: { id: number }) {
  const { account, connect } = useWallet();
  const bounty = useLoad(() => getBounty(id), [id]);
  const claims = useLoad(() => listClaims(id, "", 0, 20), [id]);
  const tx = useTx();
  const [url, setUrl] = useState("");

  const b = bounty.data;
  if (bounty.error) return <ErrorBox message={bounty.error} onRetry={bounty.reload} />;
  if (!b) return <Loading what="bounty" />;

  const me = account?.toLowerCase() ?? "";
  const isProject = me !== "" && me === b.project;
  const now = Math.floor(Date.now() / 1000);
  const open = b.status === "OPEN" && now <= b.deadline && b.pool > 0n;
  const urlOk = /^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/.test(url) && url.length <= 300;

  const refresh = () => {
    bounty.reload();
    claims.reload();
  };

  async function submitClaim() {
    if (!account) return connect();
    const out = await tx.run((onPhase) => sendTx(account, "submit_claim", [BigInt(id), url.trim()], b!.bond, onPhase));
    if (out && !out.error) {
      setUrl("");
      refresh();
    }
  }

  async function act(fn: "cancel" | "withdraw") {
    if (!account) return connect();
    const out = await tx.run((onPhase) => sendTx(account, fn, [BigInt(id)], 0n, onPhase, undefined));
    if (out && !out.error) refresh();
  }

  return (
    <>
      <h1>{b.title} <Pill value={b.status} /></h1>
      <div className="box grid">
        <KV k="Pool">{formatGen(b.pool)} GEN</KV>
        <KV k="Claim bond">{formatGen(b.bond, 6)} GEN</KV>
        <KV k="Deadline">{formatDeadline(b.deadline)} · {timeLeft(b.deadline)}</KV>
        <KV k="Project">{shortAddr(b.project)}</KV>
        <KV k="Claims">{b.claimCount} ({b.pendingCount} waiting)</KV>
        <KV k="Repository"><a href={b.repoUrl} target="_blank" rel="noreferrer noopener">{hostOf(b.repoUrl)}</a></KV>
      </div>

      <h2>Payouts</h2>
      <table>
        <thead><tr><th>Band</th><th className="num">Pays (GEN)</th></tr></thead>
        <tbody>
          <tr><td>High</td><td className="num">{formatGen(b.highPayout)}</td></tr>
          <tr><td>Medium</td><td className="num">{formatGen(b.mediumPayout)}</td></tr>
          <tr><td>Low</td><td className="num">{formatGen(b.lowPayout)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Absolute amounts, capped by what is left in the pool. Between two bands the jury pays the lower.</p>

      <h2>Frozen rubric</h2>
      {splitRubric(b.rubric).map((s) => (
        <div className="box" key={s.label}>
          <div className="muted">{s.label}</div>
          <div className="pre">{s.body}</div>
        </div>
      ))}

      <h2>Submit a claim</h2>
      {open && !isProject ? (
        <>
          <p className="muted">
            One public https writeup URL. It must show the behavior, a concrete reproduction and the cause. The jury reads that page
            and prior accepted writeups on this bounty; it follows no other links. Bond: <span className="acc mono">{formatGen(b.bond, 6)} GEN</span>,
            returned unless the claim is not demonstrated or is out of scope.
          </p>
          <input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
          <div className="actions">
            <button disabled={tx.busy || !hasContract || (!!account && !urlOk)} onClick={submitClaim}>
              {account ? `Submit with ${formatGen(b.bond, 6)} GEN bond` : "Connect wallet"}
            </button>
          </div>
        </>
      ) : (
        <p className="muted">
          {isProject ? "The project cannot claim its own bounty." : b.status !== "OPEN" ? "This bounty is closed." : "This bounty is not accepting claims."}
        </p>
      )}

      {isProject && (
        <>
          <h2>Project</h2>
          <div className="actions">
            <button className="danger" disabled={tx.busy || b.status !== "OPEN" || now > b.deadline || b.claimCount > 0} onClick={() => act("cancel")}>
              Cancel and return pool
            </button>
            <button disabled={tx.busy || b.withdrawable === 0n} onClick={() => act("withdraw")}>
              Withdraw {formatGen(b.withdrawable)} GEN
            </button>
          </div>
          <p className="hint">
            Cancel works only before the deadline with zero claims. Withdraw (slashed bonds plus any leftover pool) opens after the
            deadline, or when the bounty is depleted, once no claim is waiting.
          </p>
        </>
      )}
      <TxStatus state={tx.state} />

      <h2>Claims</h2>
      {claims.error && <ErrorBox message={claims.error} onRetry={claims.reload} />}
      {claims.loading && !claims.data && <Loading what="claims" />}
      {claims.data && claims.data.items.length === 0 && <p className="muted">No claims yet.</p>}
      {claims.data && claims.data.items.length > 0 && (
        <table>
          <thead>
            <tr><th>#</th><th>Researcher</th><th className="hide-sm">Writeup</th><th>Result</th><th className="num">Paid (GEN)</th></tr>
          </thead>
          <tbody>
            {claims.data.items.map((c) => (
              <tr className="row" key={c.id}>
                <td><a href={`#/c/${c.id}`}>{c.id}</a></td>
                <td className="mono">{shortAddr(c.researcher)}</td>
                <td className="hide-sm muted">{hostOf(c.url)}</td>
                <td>{c.status === "PENDING" ? <Pill value="PENDING" /> : <><Pill value={c.severity} /> <Pill value={c.bondOutcome} /></>}</td>
                <td className="num">{formatGen(c.payout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
