import { listBounties, listClaims, sendTx } from "../lib/chain.ts";
import { formatGen, hostOf } from "../lib/format.ts";
import { useLoad, useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Chip, Copy, Empty, ErrorBox, Skeleton, TxStatus } from "../components/Ui.tsx";

export function Mine() {
  const { signer, me, connectWallet, useDemoAccount } = useSession();
  const tx = useTx();
  const bounties = useLoad(async () => (me ? listBounties(0, 20) : null), [me]);
  const claims = useLoad(async () => (me ? listClaims(0, me, 0, 20) : null), [me]);

  if (!signer) {
    return (
      <>
        <h1>Mine</h1>
        <p className="lede">Connect to see the bounties you created and the claims you submitted.</p>
        <div className="actions">
          <button onClick={connectWallet}>Connect wallet</button>
          <button className="ghost" onClick={useDemoAccount}>
            Use demo account
          </button>
        </div>
      </>
    );
  }

  const mine = bounties.data?.items.filter((b) => b.project === me) ?? [];

  async function withdraw(id: number) {
    if (!signer) return;
    const out = await tx.run((onPhase) => sendTx(signer, "withdraw", [BigInt(id)], 0n, onPhase));
    if (out && !out.error) bounties.reload();
  }

  return (
    <>
      <h1>Mine</h1>
      <p className="lede">
        <Copy text={me} label={me} />
      </p>
      <TxStatus state={tx.state} doneText="Withdrawn." />

      <h2>Bounties I created</h2>
      {bounties.error && <ErrorBox message={bounties.error} onRetry={bounties.reload} />}
      {bounties.loading && !bounties.data && <Skeleton rows={2} />}
      {bounties.data && mine.length === 0 && (
        <Empty>
          None among the 20 newest bounties. <a href="#/create">Create one.</a>
        </Empty>
      )}
      {mine.length > 0 && (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Bounty</th>
                <th>Status</th>
                <th className="num">Pool</th>
                <th className="num">Withdrawable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mine.map((b) => (
                <tr className="hover" key={b.id}>
                  <td>
                    <a href={`#/b/${b.id}`}>{b.title}</a>
                    <div className="sub">{b.claimCount} claims · {b.pendingCount} waiting</div>
                  </td>
                  <td>
                    <Chip value={b.status} />
                  </td>
                  <td className="num">{formatGen(b.pool)}</td>
                  <td className="num">{formatGen(b.withdrawable)}</td>
                  <td>
                    <button className="small" disabled={tx.busy || b.withdrawable === 0n} onClick={() => withdraw(b.id)}>
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Claims I submitted</h2>
      {claims.error && <ErrorBox message={claims.error} onRetry={claims.reload} />}
      {claims.loading && !claims.data && <Skeleton rows={2} />}
      {claims.data && claims.data.items.length === 0 && <Empty>No claims yet. Pick a bounty and submit a writeup.</Empty>}
      {claims.data && claims.data.items.length > 0 && (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Claim</th>
                <th>Writeup</th>
                <th>Verdict</th>
                <th className="num">Paid (GEN)</th>
              </tr>
            </thead>
            <tbody>
              {claims.data.items.map((c) => (
                <tr className="hover" key={c.id}>
                  <td>
                    <a href={`#/c/${c.id}`}>#{c.id}</a>
                    <div className="sub">
                      <a href={`#/b/${c.bountyId}`}>bounty {c.bountyId}</a>
                    </div>
                  </td>
                  <td className="muted">{hostOf(c.url, 40)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
