import { useMemo, useState } from "react";
import { chainNow, hasContract, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { MAX_RUBRIC, RUBRIC_SECTIONS, composeRubric, emptyRubric, missingSections, type RubricSection } from "../lib/rubric.ts";
import { useTx } from "../hooks.ts";
import { useWallet } from "../wallet-context.ts";
import { TxStatus } from "../components/Ui.tsx";

const HELP: Record<RubricSection, string> = {
  "In scope": "What the jury may pay for. Be concrete: components, bug classes, versions.",
  "Out of scope": "What is excluded even if it is a real bug.",
  Duplicates: "How the jury decides two reports share a root cause.",
  "Severity bars": "What clears low, what clears medium, what clears high. Between two bands the jury pays the lower.",
};

export function Create() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [parts, setParts] = useState(emptyRubric());
  const [low, setLow] = useState("");
  const [med, setMed] = useState("");
  const [high, setHigh] = useState("");
  const [bond, setBond] = useState("");
  const [pool, setPool] = useState("");
  const [days, setDays] = useState("30");

  const v = useMemo(() => {
    const lowW = parseGen(low), medW = parseGen(med), highW = parseGen(high), bondW = parseGen(bond), poolW = parseGen(pool);
    const d = Number(days);
    const problems: string[] = [];
    const rubric = composeRubric(parts);
    const missing = missingSections(parts);
    if (missing.length) problems.push(`Fill in: ${missing.join(", ")}.`);
    if (rubric.length > MAX_RUBRIC) problems.push(`Rubric is ${rubric.length} characters; the limit is ${MAX_RUBRIC}.`);
    if (title.trim() === "" || title.length > 120) problems.push("Title must be 1 to 120 characters.");
    if (!/^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/.test(repo) || repo.length > 300) problems.push("Repository must be one https URL.");
    if (!lowW || !medW || !highW || lowW <= 0n || !(highW >= medW && medW >= lowW)) problems.push("Payouts must satisfy high ≥ medium ≥ low > 0.");
    if (lowW && lowW > 0n) {
      if (!bondW || bondW < lowW / 100n || bondW > lowW / 2n || bondW < 1n) {
        problems.push(`Bond must be between ${formatGen(lowW / 100n, 6)} and ${formatGen(lowW / 2n, 6)} GEN (1% to 50% of the low payout).`);
      }
    } else problems.push("Enter the low payout to see the bond bounds.");
    if (!poolW || (highW && poolW < highW)) problems.push("The pool must be at least one high payout.");
    if (!Number.isInteger(d) || d < 1 || d > 90) problems.push("Deadline must be 1 to 90 days out.");
    return { lowW, medW, highW, bondW, poolW, d, rubric, problems };
  }, [title, repo, parts, low, med, high, bond, pool, days]);

  const bounds = v.lowW && v.lowW > 0n ? `${formatGen(v.lowW / 100n, 6)} to ${formatGen(v.lowW / 2n, 6)} GEN` : "set the low payout first";

  async function submit() {
    if (!account) return connect();
    await tx.run(async (onPhase) => {
      const now = await chainNow();
      const deadline = BigInt(now + v.d * 86400 - 60);
      return sendTx(
        account,
        "create_bounty",
        [title.trim(), repo, v.rubric, v.lowW!, v.medW!, v.highW!, deadline, v.bondW!],
        v.poolW!,
        onPhase,
      );
    });
  }

  return (
    <>
      <h1>Create a bounty</h1>
      <p className="muted">
        The pool and the rubric are frozen on creation: no admin, no rubric edit, no payout change. You lock GEN; a jury of validators
        decides each claim from one public writeup.
      </p>
      <label>Title</label>
      <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <label>Repository (context only; the jury never fetches it)</label>
      <input value={repo} placeholder="https://github.com/org/project" onChange={(e) => setRepo(e.target.value)} />

      <h2>Rubric (frozen)</h2>
      {RUBRIC_SECTIONS.map((s) => (
        <div key={s}>
          <label>{s}</label>
          <textarea value={parts[s]} onChange={(e) => setParts({ ...parts, [s]: e.target.value })} />
          <div className="hint">{HELP[s]}</div>
        </div>
      ))}
      <div className="hint">{v.rubric.length} / {MAX_RUBRIC} characters</div>

      <h2>Payouts and bond (GEN)</h2>
      <div className="row2">
        <div><label>Low payout</label><input value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" /></div>
        <div><label>Medium payout</label><input value={med} onChange={(e) => setMed(e.target.value)} inputMode="decimal" /></div>
        <div><label>High payout</label><input value={high} onChange={(e) => setHigh(e.target.value)} inputMode="decimal" /></div>
      </div>
      <div className="row2">
        <div>
          <label>Claim bond</label>
          <input value={bond} onChange={(e) => setBond(e.target.value)} inputMode="decimal" />
          <div className="hint">Allowed: {bounds}. Slashed to you if a claim is not demonstrated or is out of scope.</div>
        </div>
        <div>
          <label>Pool to lock</label>
          <input value={pool} onChange={(e) => setPool(e.target.value)} inputMode="decimal" />
          <div className="hint">Must cover at least one high payout.</div>
        </div>
        <div>
          <label>Deadline (days from now, max 90)</label>
          <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      {v.problems.length > 0 && (
        <ul className="muted">{v.problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <div className="actions">
        <button disabled={tx.busy || !hasContract || (!!account && v.problems.length > 0)} onClick={submit}>
          {account ? "Lock pool and create" : "Connect wallet"}
        </button>
        {tx.state.kind === "done" && !tx.state.outcome.error && <a href="#/">Back to bounties</a>}
      </div>
      <TxStatus state={tx.state} />
    </>
  );
}
