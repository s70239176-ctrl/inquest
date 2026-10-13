import { useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { listBounties, listClaims, sendTx } from "../lib/chain.ts";
import { formatDate, formatGen, hostOf, shortAddr } from "../lib/format.ts";
import { bountyPhase, claimStanding, claimTotals } from "../lib/view.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Copy, ErrorBox, Skeleton, Stat, TxStatus } from "../components/Ui.tsx";
import { StatusPill } from "../components/ui/StatusPill.tsx";
import { Tabs, panelProps, type TabDef } from "../components/ui/Tabs.tsx";

type TabId = "submissions" | "bounties" | "money" | "activity";

function Empty({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-lg border border-dashed border-app-line bg-app-surface px-6 py-12 text-center">
      <p className="m-0 text-app-text">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-app-soft">{body}</p>
      {cta && (
        <a href={cta.href} className="mt-4 inline-block">
          <button className="small !inline-flex !items-center !gap-1.5">
            {cta.label} <ArrowRight size={14} aria-hidden="true" />
          </button>
        </a>
      )}
    </div>
  );
}

export function Mine() {
  const { signer, me, connectWallet, useDemoAccount } = useSession();
  const now = useNow();
  const tx = useTx();
  const [tab, setTab] = useState<TabId>("submissions");
  const bounties = useLoad(async () => (me ? listBounties(0, 20) : null), [me]);
  const claims = useLoad(async () => (me ? listClaims(0, me, 0, 20) : null), [me]);

  if (!signer) {
    return (
      <>
        <p className="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-app-soft">
          <a href="#/" className="!text-app-soft hover:!text-app-text">Inquest</a> / Mine
        </p>
        <h1 className="!mt-2">Mine</h1>
        <p className="lede">Connect to see your reports, your bonds, the bounties you created, and what you have been paid.</p>
        <div className="mt-6 rounded-lg border border-app-line bg-app-surface p-6">
          <div className="flex items-start gap-4">
            <Wallet size={22} className="mt-0.5 text-gold" aria-hidden="true" />
            <div>
              <p className="m-0 font-semibold text-app-text">No wallet connected</p>
              <p className="mt-1 text-[13px] text-app-soft">
                Only your own on-chain activity is shown here. Use a browser wallet, or try the app with a throwaway demo account.
              </p>
              <div className="actions">
                <button onClick={connectWallet}>Connect wallet</button>
                <button className="ghost" onClick={useDemoAccount}>
                  Use demo account
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const myBounties = (bounties.data?.items ?? []).filter((b) => b.project === me);
  const myClaims = claims.data?.items ?? [];
  const titleOf = (id: number) => bounties.data?.items.find((b) => b.id === id)?.title;
  const totals = claimTotals(myClaims);
  const toWithdraw = myBounties.reduce((a, b) => a + b.withdrawable, 0n);

  async function withdraw(id: number) {
    if (!signer) return;
    const out = await tx.run((onPhase) => sendTx(signer, "withdraw", [BigInt(id)], 0n, onPhase));
    if (out && !out.error) bounties.reload();
  }

  const tabs: TabDef<TabId>[] = [
    { id: "submissions", label: "My submissions", badge: claims.data ? claims.data.total : undefined },
    { id: "bounties", label: "My bounties", badge: bounties.data ? myBounties.length : undefined },
    { id: "money", label: "Rewards and bonds" },
    { id: "activity", label: "Activity" },
  ];
  const idp = "mine";
  const loading = (bounties.loading && !bounties.data) || (claims.loading && !claims.data);

  // activity feed from real fields only
  const events = [
    ...myClaims.flatMap((c) => {
      const out = [{ at: c.createdAt, title: `Filed claim #${c.id}`, detail: `On ${titleOf(c.bountyId) ?? `bounty ${c.bountyId}`} with a ${formatGen(c.bond, 6)} GEN bond.` }];
      if (c.status === "RESOLVED") {
        const s = claimStanding(c);
        out.push({
          at: c.resolvedAt,
          title: `Claim #${c.id}: ${s.label.toLowerCase()}`,
          detail: c.payout > 0n ? `${formatGen(c.payout)} GEN scheduled, bond returned.` : c.bondOutcome === "SLASHED" ? "Bond slashed to the project." : "Bond returned, no payout.",
        });
      }
      return out;
    }),
    ...myBounties.map((b) => ({ at: b.createdAt, title: `Created ${b.title}`, detail: `Locked ${formatGen(b.pool)} GEN remaining of the pool.` })),
  ].sort((a, z) => z.at - a.at);

  return (
    <>
      <p className="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-app-soft">
        <a href="#/" className="!text-app-soft hover:!text-app-text">Inquest</a> / Mine
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="!mb-1 !mt-2">Mine</h1>
          <p className="lede">
            {signer.kind === "sandbox" ? "Demo account " : ""}
            <Copy text={me} label={shortAddr(me)} />
          </p>
        </div>
      </div>

      <div className="stat-grid mt-6">
        <Stat k="Paid to you" v={formatGen(totals.paid)} s="GEN, from accepted reports" />
        <Stat k="Bonds in review" v={formatGen(totals.bondsHeld, 6)} s="GEN waiting for a verdict" />
        <Stat k="Bonds returned" v={formatGen(totals.bondsReturned, 6)} s={`${formatGen(totals.bondsSlashed, 6)} slashed`} />
        <Stat k="Withdrawable" v={formatGen(toWithdraw)} s="GEN across your bounties" />
      </div>

      <div className="mt-8">
        <Tabs tabs={tabs} active={tab} onChange={setTab} label="Dashboard sections" idPrefix={idp} />
      </div>
      <TxStatus state={tx.state} doneText="Withdrawn." />

      <div className="animate-rise pt-6" key={tab}>
        {loading && <Skeleton rows={3} />}
        {(claims.error || bounties.error) && <ErrorBox message={(claims.error ?? bounties.error)!} onRetry={() => { claims.reload(); bounties.reload(); }} />}

        {tab === "submissions" && !loading && (
          <div {...panelProps(idp, "submissions")} className="outline-none">
            {myClaims.length === 0 ? (
              <Empty
                title="You have not filed a report yet."
                body="Pick a bounty, read its frozen rubric, and submit one public writeup that shows the behavior, a reproduction and the cause."
                cta={{ href: "#/bounties", label: "Explore bounties" }}
              />
            ) : (
              <>
                <div className="tbl hidden md:block">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Bounty</th>
                        <th>Filed</th>
                        <th>Status</th>
                        <th className="num">Bond (GEN)</th>
                        <th className="num">Reward (GEN)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {myClaims.map((c) => {
                        const s = claimStanding(c);
                        return (
                          <tr key={c.id} className="hover">
                            <td>
                              <a href={`#/c/${c.id}`} className="font-mono">#{c.id}</a>
                              <div className="sub">{hostOf(c.url, 30)}</div>
                            </td>
                            <td>
                              <a href={`#/b/${c.bountyId}`} className="!text-app-text hover:!text-gold">{titleOf(c.bountyId) ?? `Bounty ${c.bountyId}`}</a>
                            </td>
                            <td className="text-app-soft">{formatDate(c.createdAt)}</td>
                            <td><StatusPill label={s.label} tone={s.tone} /></td>
                            <td className="num">{formatGen(c.bond, 6)}</td>
                            <td className="num">{c.payout > 0n ? formatGen(c.payout) : "—"}</td>
                            <td className="text-right">
                              <a href={`#/c/${c.id}`} className="text-[13px] font-semibold">Open</a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
                  {myClaims.map((c) => {
                    const s = claimStanding(c);
                    return (
                      <li key={c.id} className="rounded-lg border border-app-line bg-app-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <a href={`#/c/${c.id}`} className="font-mono text-[13px] font-semibold">Claim #{c.id}</a>
                          <StatusPill label={s.label} tone={s.tone} />
                        </div>
                        <p className="mt-1.5 text-[13px] text-app-soft">{titleOf(c.bountyId) ?? `Bounty ${c.bountyId}`}</p>
                        <p className="m-0 font-mono text-[12px] text-app-soft">
                          Bond {formatGen(c.bond, 6)} · Reward {c.payout > 0n ? formatGen(c.payout) : "—"} GEN
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === "bounties" && !loading && (
          <div {...panelProps(idp, "bounties")} className="outline-none">
            {myBounties.length === 0 ? (
              <Empty title="You have not created a bounty." body="Lock a pool and a rubric, and independent validators will judge every report." cta={{ href: "#/create", label: "Create a bounty" }} />
            ) : (
              <div className="tbl overflow-x-auto">
                <table className="min-w-[560px]">
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
                    {myBounties.map((b) => {
                      const p = bountyPhase(b, now);
                      return (
                        <tr key={b.id} className="hover">
                          <td>
                            <a href={`#/b/${b.id}`} className="!text-app-text hover:!text-gold">{b.title}</a>
                            <div className="sub">{b.claimCount} reports · {b.pendingCount} in review</div>
                          </td>
                          <td><StatusPill label={p.label} tone={p.tone} /></td>
                          <td className="num">{formatGen(b.pool)}</td>
                          <td className="num">{formatGen(b.withdrawable)}</td>
                          <td className="text-right">
                            <button className="small" disabled={tx.busy || b.withdrawable === 0n} onClick={() => withdraw(b.id)}>Withdraw</button>
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

        {tab === "money" && !loading && (
          <div {...panelProps(idp, "money")} className="outline-none">
            <div className="panel">
              <dl className="m-0 grid gap-x-10 gap-y-4 sm:grid-cols-2">
                {(
                  [
                    ["Rewards paid to you", `${formatGen(totals.paid)} GEN`, "Sum of accepted reports. GEN moves when each verdict finalizes."],
                    ["Bonds waiting for a verdict", `${formatGen(totals.bondsHeld, 6)} GEN`, "Held by the contract until the jury decides."],
                    ["Bonds returned", `${formatGen(totals.bondsReturned, 6)} GEN`, "Returned on duplicates, missing evidence, below-bar findings and accepted reports."],
                    ["Bonds slashed", `${formatGen(totals.bondsSlashed, 6)} GEN`, "Kept by the project when a report is not demonstrated or is out of scope."],
                  ] as [string, string, string][]
                ).map(([k, val, note]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-wider text-app-soft">{k}</dt>
                    <dd className="m-0 mt-0.5 font-mono text-[18px] text-app-text">{val}</dd>
                    <dd className="m-0 mt-0.5 text-[12px] text-app-soft">{note}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="hint">Figures cover your 20 newest reports. Studionet does not credit ordinary accounts, so payouts show here and in the contract rather than in a wallet balance.</p>
          </div>
        )}

        {tab === "activity" && !loading && (
          <div {...panelProps(idp, "activity")} className="outline-none">
            {events.length === 0 ? (
              <Empty title="No activity yet." body="Your reports, verdicts and bounties will appear here as they happen on-chain." cta={{ href: "#/bounties", label: "Explore bounties" }} />
            ) : (
              <ol className="m-0 list-none border-l border-app-line p-0 pl-5">
                {events.map((e, i) => (
                  <li key={i} className="relative pb-5">
                    <span className="absolute -left-[25.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-app-bg" aria-hidden="true" />
                    <div className="text-[13.5px] font-semibold text-app-text">{e.title}</div>
                    <div className="text-[12.5px] text-app-soft">{e.detail}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-app-soft">{formatDate(e.at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </>
  );
}
