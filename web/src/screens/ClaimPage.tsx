import { useState } from "react";
import { appeal, appealInfo, getClaim, readTx, recallResolveTx, rememberResolveTx, sendTx } from "../lib/chain.ts";
import { describeError } from "../lib/decode.ts";
import { formatDate, formatGen, hostOf, shortAddr } from "../lib/format.ts";
import { useLoad, useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Chip, Copy, ErrorBox, KV, Skeleton, Stat, TxStatus } from "../components/Ui.tsx";
import type { Claim } from "../lib/types.ts";

function Tile({ k, value, kind }: { k: string; value: string; kind: "t" | "f" | "n" }) {
  return (
    <div>
      <div className="k">{k}</div>
      <div className={`v ${kind}`}>{value}</div>
    </div>
  );
}

const bool = (v: boolean | null): { value: string; kind: "t" | "f" | "n" } =>
  v === null ? { value: "—", kind: "n" } : v ? { value: "true", kind: "t" } : { value: "false", kind: "f" };

function explain(c: Claim): string {
  if (c.status === "PENDING") return "No verdict yet.";
  if (!c.evidenceAvailable) return "The jury could not load a technical writeup at this URL, so nothing was judged. The bond is returned.";
  if (!c.demonstrated) return "The page does not itself show the bug (behavior, a concrete reproduction and the cause). The bond goes to the project.";
  if (!c.inScope) return "A bug was shown, but the frozen rubric does not cover it. The bond goes to the project.";
  if (c.duplicateOf !== null) return `Same root cause as claim ${c.duplicateOf}, which was accepted first. No payout; the bond is returned.`;
  if (c.severity === "none") return "Real and in scope, but below the lowest severity bar in the rubric. No payout; the bond is returned.";
  return `Demonstrated, in scope and original. It clears the ${c.severity} bar, so that band's amount is paid and the bond is returned.`;
}

export function ClaimPage({ id }: { id: number }) {
  const { signer, connectWallet, useDemoAccount } = useSession();
  const claim = useLoad(() => getClaim(id), [id]);
  const tx = useTx();
  const [hash, setHash] = useState<string | null>(() => recallResolveTx(id));
  const [pasted, setPasted] = useState("");
  const [appealMsg, setAppealMsg] = useState<string | null>(null);
  const [appealBusy, setAppealBusy] = useState(false);

  const c = claim.data;
  const resolved = c?.status === "RESOLVED";
  const info = useLoad(async () => (resolved && hash ? appealInfo(hash) : null), [resolved, hash]);
  const settle = useLoad(async () => (resolved && hash ? ((await readTx(hash))?.status ?? null) : null), [resolved, hash]);

  if (claim.error) return <ErrorBox message={claim.error} onRetry={claim.reload} />;
  if (!c) return <Skeleton rows={5} />;

  async function resolve() {
    if (!signer) return;
    const out = await tx.run((onPhase) =>
      sendTx(signer, "resolve_claim", [BigInt(id)], 0n, onPhase, (h) => {
        rememberResolveTx(id, h);
        setHash(h);
      }),
    );
    if (out) {
      claim.reload();
      info.reload();
      settle.reload();
    }
  }

  async function doAppeal(charge: bigint) {
    if (!signer || !hash) return;
    setAppealBusy(true);
    setAppealMsg(null);
    try {
      await appeal(signer, hash, charge);
      setAppealMsg("Appeal submitted to the protocol. A larger jury re-runs the round; reload this page after it settles.");
      info.reload();
    } catch (e) {
      setAppealMsg(describeError(e));
    } finally {
      setAppealBusy(false);
    }
  }

  const finalized = settle.data === "FINALIZED";
  const ev = bool(c.evidenceAvailable);
  const dem = bool(c.demonstrated);
  const sc = bool(c.inScope);
  const paid = c.payout > 0n;

  return (
    <>
      <p className="muted" style={{ margin: "18px 0 0" }}>
        <a href={`#/b/${c.bountyId}`}>← Bounty #{c.bountyId}</a>
      </p>
      <div className="row between">
        <h1 style={{ margin: "6px 0" }}>Claim #{c.id}</h1>
        <span className="row" style={{ gap: 6 }}>
          <Chip value={c.status} />
          {resolved && <Chip value={c.bondOutcome} />}
        </span>
      </div>
      <div className="panel tight row between">
        <KV k="Researcher">
          <Copy text={c.researcher} label={shortAddr(c.researcher)} />
        </KV>
        <KV k="Writeup">
          <a href={c.url} target="_blank" rel="noreferrer noopener">
            {hostOf(c.url, 52)}
          </a>
        </KV>
        <KV k="Bond">{formatGen(c.bond, 6)} GEN</KV>
      </div>

      <h2>The jury's answer: five fields, nothing else</h2>
      <div className="verdict">
        <Tile k="evidence_available" {...ev} />
        <Tile k="demonstrated" {...dem} />
        <Tile k="in_scope" {...sc} />
        <Tile
          k="duplicate_of"
          value={!resolved ? "—" : c.duplicateOf === null ? "null" : `claim ${c.duplicateOf}`}
          kind={!resolved || c.duplicateOf === null ? "n" : "f"}
        />
        <Tile k="severity" value={c.severity ?? "—"} kind={c.severity && c.severity !== "none" ? "t" : "n"} />
      </div>
      <p className="muted">{explain(c)}</p>

      {!resolved && (
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            <b>Waiting for a verdict.</b> Anyone can start the jury. Each validator fetches the writeup itself and answers the five fields; if
            they cannot agree, nothing moves and you can try again.
          </p>
          <div className="actions" style={{ marginTop: 8 }}>
            {signer ? (
              <button disabled={tx.busy} onClick={resolve}>
                Resolve claim
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
      <TxStatus state={tx.state} doneText="Verdict recorded." />

      <h2>Settlement</h2>
      <div className="panel">
        <ol className="timeline">
          <li className="done">
            <div className="t">Submitted</div>
            <div className="d">{formatDate(c.createdAt)} · bond locked in the contract</div>
          </li>
          <li className={resolved ? "done" : "now"}>
            <div className="t">{resolved ? "Jury verdict recorded" : "Waiting for the jury"}</div>
            <div className="d">{resolved ? `${formatDate(c.resolvedAt)} · provisional until it finalizes` : "Not resolved yet"}</div>
          </li>
          <li className={finalized ? "done" : resolved ? "now" : ""}>
            <div className="t">{finalized ? "Finalized: GEN moved" : "Finalization"}</div>
            <div className="d">
              {resolved
                ? finalized
                  ? paid
                    ? `${formatGen(c.payout)} GEN paid to the researcher${c.bondOutcome === "RETURNED" ? ", bond returned" : ""}.`
                    : c.bondOutcome === "SLASHED"
                      ? "Bond kept by the project. No payout."
                      : "Bond returned. No payout."
                  : hash
                    ? "GEN moves only when the verdict finalizes. Until then it can still be appealed."
                    : "GEN moves only when the verdict finalizes."
                : "Nothing moves before a verdict."}
            </div>
          </li>
        </ol>
        {resolved && (
          <div className="grid" style={{ marginTop: 6 }}>
            <Stat k="Payout" v={`${formatGen(c.payout)}`} s="GEN" />
            <Stat k="Bond" v={c.bondOutcome === "RETURNED" ? "returned" : c.bondOutcome === "SLASHED" ? "slashed" : "—"} />
            <Stat k="Resolve tx" v={hash ? <Copy text={hash} label={shortAddr(hash)} /> : "unknown here"} s={settle.data ?? undefined} />
          </div>
        )}
      </div>

      {resolved && (
        <>
          <h2>Protocol appeal</h2>
          <div className="panel">
            {!hash && (
              <>
                <p style={{ marginTop: 0 }} className="muted">
                  The appeal belongs to the resolve transaction, which this browser did not send. Paste its id to check the appeal window.
                </p>
                <input value={pasted} placeholder="0x…" onChange={(e) => setPasted(e.target.value.trim())} aria-label="Resolve transaction id" />
                <div className="actions">
                  <button
                    className="ghost small"
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
            {hash && info.loading && !info.data && <Skeleton rows={1} />}
            {hash && info.error && <ErrorBox message={info.error} onRetry={info.reload} />}
            {hash && info.data && !info.data.appealable && (
              <p style={{ margin: 0 }} className="muted">
                The appeal window is closed: this verdict is final.
              </p>
            )}
            {hash && info.data?.appealable && info.data.charge !== null && (
              <>
                <p style={{ marginTop: 0 }}>
                  The appeal window is <b>open</b>. If you think the jury got it wrong, the protocol can re-run the round with more validators. The
                  appeal charge is set by the protocol and is separate from the claim bond:{" "}
                  <span className="acc mono">{formatGen(info.data.charge, 6)} GEN</span>.
                </p>
                <p className="hint">Inquest has no court of its own and no text box for an argument: the protocol re-judges the same page.</p>
                <div className="actions">
                  {signer ? (
                    <button disabled={appealBusy} onClick={() => doAppeal(info.data!.charge!)}>
                      Appeal
                    </button>
                  ) : (
                    <button onClick={connectWallet}>Connect wallet</button>
                  )}
                </div>
              </>
            )}
            {appealMsg && <div className="tx">{appealMsg}</div>}
          </div>
        </>
      )}
    </>
  );
}
