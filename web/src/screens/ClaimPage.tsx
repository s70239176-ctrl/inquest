import { useState } from "react";
import { appeal, appealInfo, getClaim, recallResolveTx, rememberResolveTx, sendTx } from "../lib/chain.ts";
import { formatGen, shortAddr } from "../lib/format.ts";
import { useLoad, useTx } from "../hooks.ts";
import { useWallet } from "../wallet-context.ts";
import { ErrorBox, KV, Loading, Pill, TxStatus } from "../components/Ui.tsx";

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "true" : "false");

export function ClaimPage({ id }: { id: number }) {
  const { account, connect } = useWallet();
  const claim = useLoad(() => getClaim(id), [id]);
  const tx = useTx();
  const [hash, setHash] = useState<string | null>(() => recallResolveTx(id));
  const [pasted, setPasted] = useState("");
  const [appealMsg, setAppealMsg] = useState<string | null>(null);
  const [appealBusy, setAppealBusy] = useState(false);

  const c = claim.data;
  const appealable = useLoad(
    async () => (c && c.status === "RESOLVED" && hash ? appealInfo(hash) : null),
    [c?.status, hash],
  );

  if (claim.error) return <ErrorBox message={claim.error} onRetry={claim.reload} />;
  if (!c) return <Loading what="claim" />;

  async function resolve() {
    if (!account) return connect();
    const out = await tx.run((onPhase) =>
      sendTx(account, "resolve_claim", [BigInt(id)], 0n, onPhase, (h) => {
        rememberResolveTx(id, h);
        setHash(h);
      }),
    );
    if (out) claim.reload();
  }

  async function doAppeal(charge: bigint) {
    if (!account || !hash) return;
    setAppealBusy(true);
    setAppealMsg(null);
    try {
      await appeal(account, hash, charge);
      setAppealMsg("Appeal submitted to the protocol. The round is re-run by a larger jury; this page updates after it settles.");
      appealable.reload();
    } catch (e) {
      setAppealMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAppealBusy(false);
    }
  }

  const info = appealable.data;
  return (
    <>
      <h1>Claim {c.id} <Pill value={c.status} /></h1>
      <p><a href={`#/b/${c.bountyId}`}>← Bounty {c.bountyId}</a></p>
      <div className="box grid">
        <KV k="Researcher">{shortAddr(c.researcher)}</KV>
        <KV k="Bond">{formatGen(c.bond, 6)} GEN</KV>
        <KV k="Writeup"><a href={c.url} target="_blank" rel="noreferrer noopener">{c.url.replace(/^https:\/\//, "").slice(0, 48)}</a></KV>
      </div>

      {c.status === "PENDING" ? (
        <>
          <h2>Waiting for a verdict</h2>
          <p className="muted">
            Anyone can start the jury. Validators each fetch the writeup themselves and answer five fixed fields; if they cannot agree,
            nothing moves.
          </p>
          <div className="actions">
            <button disabled={tx.busy} onClick={resolve}>{account ? "Resolve claim" : "Connect wallet"}</button>
          </div>
        </>
      ) : (
        <>
          <h2>The five fields</h2>
          <table>
            <tbody>
              <tr><td>evidence_available</td><td className="mono">{yesNo(c.evidenceAvailable)}</td></tr>
              <tr><td>demonstrated</td><td className="mono">{yesNo(c.demonstrated)}</td></tr>
              <tr><td>in_scope</td><td className="mono">{yesNo(c.inScope)}</td></tr>
              <tr><td>duplicate_of</td><td className="mono">{c.duplicateOf === null ? "null" : <a href={`#/c/${c.duplicateOf}`}>claim {c.duplicateOf}</a>}</td></tr>
              <tr><td>severity</td><td className="mono"><Pill value={c.severity} /></td></tr>
            </tbody>
          </table>
          <h2>Settlement</h2>
          <div className="box grid">
            <KV k="Payout">{formatGen(c.payout)} GEN</KV>
            <KV k="Bond"><Pill value={c.bondOutcome} /></KV>
            <KV k="Resolve tx">{hash ? <span title={hash}>{shortAddr(hash)}</span> : "unknown to this browser"}</KV>
          </div>
          <p className="hint">GEN moves when the resolve transaction finalizes. Until then the verdict is provisional.</p>

          <h2>Protocol appeal</h2>
          {!hash && (
            <>
              <p className="muted">
                The appeal belongs to the resolve transaction, which this browser did not send. Paste its transaction id to check the
                appeal window.
              </p>
              <input value={pasted} placeholder="0x…" onChange={(e) => setPasted(e.target.value.trim())} />
              <div className="actions">
                <button
                  className="ghost"
                  disabled={!/^0x[0-9a-fA-F]{64}$/.test(pasted)}
                  onClick={() => {
                    rememberResolveTx(id, pasted);
                    setHash(pasted);
                  }}
                >
                  Check appeal window
                </button>
              </div>
            </>
          )}
          {hash && appealable.loading && !info && <Loading what="appeal window" />}
          {hash && appealable.error && <ErrorBox message={appealable.error} onRetry={appealable.reload} />}
          {hash && info && !info.appealable && (
            <p className="muted">The appeal window is closed. This verdict is final, or the protocol will not take an appeal on it.</p>
          )}
          {hash && info && info.appealable && info.charge !== null && (
            <>
              <p>
                The appeal window is open. If you think the jury got it wrong, the protocol can re-run the round with more validators.
                The appeal charge is set by the protocol and is separate from the claim bond:{" "}
                <span className="acc mono">{formatGen(info.charge, 6)} GEN</span>.
              </p>
              <div className="actions">
                <button disabled={appealBusy} onClick={() => (account ? doAppeal(info.charge!) : connect())}>
                  {account ? "Appeal" : "Connect wallet"}
                </button>
              </div>
            </>
          )}
          {appealMsg && <div className="tx">{appealMsg}</div>}
        </>
      )}
      <TxStatus state={tx.state} />
    </>
  );
}
