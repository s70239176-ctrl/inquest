import { useMemo, useState } from "react";
import { chainNow, hasContract, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { MAX_RUBRIC, RUBRIC_SECTIONS, composeRubric, emptyRubric, missingSections, type RubricParts, type RubricSection } from "../lib/rubric.ts";
import { useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { TxStatus } from "../components/Ui.tsx";

const HELP: Record<RubricSection, string> = {
  "In scope": "What the jury may pay for. Be concrete: components, bug classes, versions.",
  "Out of scope": "What is excluded even if it is a real bug.",
  Duplicates: "How the jury decides two reports share a root cause.",
  "Severity bars": "What clears low, what clears medium, what clears high. Between two bands the jury pays the lower.",
};

const EXAMPLE: RubricParts = {
  "In scope":
    "Memory-safety bugs in the tinyparse C library's header and body parsers: heap or stack overflow, out-of-bounds read or write, use after free.",
  "Out of scope":
    "Denial of service through large or slow inputs, resource exhaustion, documentation, build scripts, and anything requiring local write access.",
  Duplicates:
    "Two reports with the same faulty code and the same root cause are duplicates even if worded differently. Same symptom with a different cause is not a duplicate.",
  "Severity bars":
    "low = crash or null dereference on crafted input. medium = out-of-bounds read that discloses memory. high = out-of-bounds write or anything giving code execution.",
};

const URL_RE = /^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/;

export function Create() {
  const { signer, connectWallet, useDemoAccount } = useSession();
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
    const rubric = composeRubric(parts);
    const missing = missingSections(parts);
    const bondLo = lowW ? lowW / 100n : null;
    const bondHi = lowW ? lowW / 2n : null;
    const checks: { ok: boolean; text: string }[] = [
      { ok: title.trim() !== "" && title.length <= 120, text: "Title is 1 to 120 characters" },
      { ok: URL_RE.test(repo) && repo.length <= 300, text: "Repository is one https URL (context only; the jury never fetches it)" },
      { ok: missing.length === 0, text: missing.length ? `Rubric still needs: ${missing.join(", ")}` : "Rubric has all four sections" },
      { ok: rubric.length <= MAX_RUBRIC, text: `Rubric fits in ${MAX_RUBRIC.toLocaleString()} characters (${rubric.length.toLocaleString()} now)` },
      { ok: !!(lowW && medW && highW && lowW > 0n && highW >= medW && medW >= lowW), text: "Payouts satisfy high ≥ medium ≥ low > 0" },
      {
        ok: !!(bondW && bondLo !== null && bondHi !== null && bondW >= bondLo && bondW <= bondHi && bondW > 0n),
        text: bondLo !== null && bondHi !== null ? `Bond is between ${formatGen(bondLo, 6)} and ${formatGen(bondHi, 6)} GEN (1% to 50% of low)` : "Bond is between 1% and 50% of the low payout",
      },
      { ok: !!(poolW && highW && poolW >= highW), text: "Pool covers at least one high payout" },
      { ok: Number.isInteger(d) && d >= 1 && d <= 90, text: "Deadline is 1 to 90 days out" },
    ];
    return { lowW, medW, highW, bondW, poolW, d, rubric, checks, valid: checks.every((c) => c.ok) };
  }, [title, repo, parts, low, med, high, bond, pool, days]);

  async function submit() {
    if (!signer) return;
    await tx.run(async (onPhase) => {
      const now = await chainNow();
      const deadline = BigInt(now + v.d * 86400 - 60);
      return sendTx(
        signer,
        "create_bounty",
        [title.trim(), repo, v.rubric, v.lowW!, v.medW!, v.highW!, deadline, v.bondW!],
        v.poolW!,
        onPhase,
      );
    });
  }

  function fillExample() {
    setTitle("tinyparse memory-safety bounty");
    setRepo("https://github.com/acme/tinyparse");
    setParts(EXAMPLE);
    setLow("0.1");
    setMed("0.3");
    setHigh("1");
    setBond("0.01");
    setPool("1.4");
    setDays("30");
  }

  const done = tx.state.kind === "done" && !tx.state.outcome.error;

  return (
    <>
      <h1>Create a bounty</h1>
      <p className="lede">
        You lock GEN and a rubric. Both are frozen on creation: no admin, no rubric edit, no payout change. A jury of validators then decides
        each claim from one public writeup.
      </p>
      <div className="actions" style={{ marginTop: 10 }}>
        <button className="ghost small" onClick={fillExample}>
          Fill with an example
        </button>
      </div>

      <h2>Bounty</h2>
      <label htmlFor="title">Title</label>
      <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="repo">Repository</label>
      <input id="repo" value={repo} placeholder="https://github.com/org/project" onChange={(e) => setRepo(e.target.value)} />

      <h2>Rubric (frozen on creation)</h2>
      {RUBRIC_SECTIONS.map((s) => (
        <div key={s}>
          <label htmlFor={`r-${s}`}>{s}</label>
          <textarea id={`r-${s}`} value={parts[s]} onChange={(e) => setParts({ ...parts, [s]: e.target.value })} />
          <div className="hint">{HELP[s]}</div>
        </div>
      ))}

      <h2>Money (GEN)</h2>
      <div className="field-row">
        <div>
          <label htmlFor="low">Low payout</label>
          <input id="low" value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label htmlFor="med">Medium payout</label>
          <input id="med" value={med} onChange={(e) => setMed(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label htmlFor="high">High payout</label>
          <input id="high" value={high} onChange={(e) => setHigh(e.target.value)} inputMode="decimal" />
        </div>
      </div>
      <div className="field-row">
        <div>
          <label htmlFor="bond">Claim bond</label>
          <input id="bond" value={bond} onChange={(e) => setBond(e.target.value)} inputMode="decimal" />
          <div className="hint">Returned to the researcher unless the claim is not demonstrated or is out of scope; then it goes to you.</div>
        </div>
        <div>
          <label htmlFor="pool">Pool to lock</label>
          <input id="pool" value={pool} onChange={(e) => setPool(e.target.value)} inputMode="decimal" />
          <div className="hint">Payouts are absolute and capped by what remains.</div>
        </div>
        <div>
          <label htmlFor="days">Closes in (days, max 90)</label>
          <input id="days" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <h2>Before you lock funds</h2>
      <div className="panel tight" aria-live="polite">
        {v.checks.map((c) => (
          <div key={c.text} className={`check ${c.ok ? "ok" : ""}`}>
            <b>{c.ok ? "✓" : "·"}</b>
            <span>{c.text}</span>
          </div>
        ))}
      </div>

      <div className="actions">
        {signer ? (
          <button disabled={tx.busy || !hasContract || !v.valid || done} onClick={submit}>
            Lock pool and create bounty
          </button>
        ) : (
          <>
            <button onClick={connectWallet}>Connect wallet</button>
            <button className="ghost" onClick={useDemoAccount}>
              Use demo account
            </button>
            <span className="muted">to sign</span>
          </>
        )}
        {done && <a href="#/">Back to bounties →</a>}
      </div>
      <TxStatus state={tx.state} doneText="Bounty created." />
    </>
  );
}
