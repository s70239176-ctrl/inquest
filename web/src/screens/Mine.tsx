import { listBounties, listClaims, sendTx } from "../lib/chain.ts";
import { formatGen, shortAddr } from "../lib/format.ts";
import { useLoad, useTx } from "../hooks.ts";
import { useWallet } from "../wallet-context.ts";
import { ErrorBox, Loading, Pill, TxStatus } from "../components/Ui.tsx";

export function Mine() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const me = account?.toLowerCase() ?? "";
  const bounties = useLoad(async () => (me ? listBounties(0, 20) : null), [me]);
  const claims = useLoad(async () => (me ? listClaims(0, me, 0, 20) : null), [me]);

  if (!account) {
    return (
      <>
        <h1>Mine</h1>
        <p className="muted">Connect a wallet to see your bounties and claims.</p>
        <button onClick={connect}>Connect wallet</button>
      </>
    );
  }

  const mine = bounties.data?.items.filter((b) => b.project === me) ?? [];

  async function withdraw(id: number) {
    const out = await tx.run((onPhase) => sendTx(account!, "withdraw", [BigInt(id)], 0n, onPhase));
    if (out && !out.error) bounties.reload();
  }

  return (
    <>
      <h1>Mine <span className="muted mono">{shortAddr(account)}</span></h1>
      <TxStatus state={tx.state} />

      <h2>Bounties I created</h2>
      {bounties.error && <ErrorBox message={bounties.error} onRetry={bounties.reload} />}
      {bounties.loading && !bounties.data && <Loading what="bounties" />}
      {bounties.data && mine.length === 0 && <p className="muted">None in the 20 newest bounties.</p>}
      {mine.length > 0 && (
        <table>
          <thead><tr><th>Title</th><th>Status</th><th className="num">Pool</th><th className="num">Withdrawable</th><th /></tr></thead>
          <tbody>
            {mine.map((b) => (
              <tr className="row" key={b.id}>
                <td><a href={`#/b/${b.id}`}>{b.title}</a></td>
                <td><Pill value={b.status} /></td>
                <td className="num">{formatGen(b.pool)}</td>
                <td className="num">{formatGen(b.withdrawable)}</td>
                <td><button disabled={tx.busy || b.withdrawable === 0n} onClick={() => withdraw(b.id)}>Withdraw</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Claims I submitted</h2>
      {claims.error && <ErrorBox message={claims.error} onRetry={claims.reload} />}
      {claims.loading && !claims.data && <Loading what="claims" />}
      {claims.data && claims.data.items.length === 0 && <p className="muted">No claims yet.</p>}
      {claims.data && claims.data.items.length > 0 && (
        <table>
          <thead><tr><th>#</th><th>Bounty</th><th>Result</th><th className="num">Paid (GEN)</th></tr></thead>
          <tbody>
            {claims.data.items.map((c) => (
              <tr className="row" key={c.id}>
                <td><a href={`#/c/${c.id}`}>{c.id}</a></td>
                <td><a href={`#/b/${c.bountyId}`}>{c.bountyId}</a></td>
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
