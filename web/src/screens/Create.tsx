import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { chainNow, hasContract, listBounties, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { MAX_RUBRIC, RUBRIC_SECTIONS, composeRubric, emptyRubric, missingSections, type RubricParts, type RubricSection } from "../lib/rubric.ts";
import { useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { TxStatus } from "../components/Ui.tsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.tsx";

const HELP: Record<RubricSection, string> = {
  "In scope": "What the jury may pay for. Be concrete: components, bug classes, versions.",
  "Out of scope": "What is excluded even if it is a real bug.",
  Duplicates: "How the jury decides two reports share a root cause.",
  "Severity bars": "What clears low, what clears medium, what clears high. Between two bands the jury pays the lower.",
};

const EXAMPLE: RubricParts = {
  "In scope": "Memory-safety bugs in the tinyparse C library's header and body parsers: heap or stack overflow, out-of-bounds read or write, use after free.",
  "Out of scope": "Denial of service through large or slow inputs, resource exhaustion, documentation, build scripts, and anything requiring local write access.",
  Duplicates: "Two reports with the same faulty code and the same root cause are duplicates even if worded differently. Same symptom with a different cause is not a duplicate.",
  "Severity bars": "low = crash or null dereference on crafted input. medium = out-of-bounds read that discloses memory. high = out-of-bounds write or anything giving code execution.",
};

const URL_RE = /^https:\/\/[^\s/@:]+(\.[^\s/@:]+)+(\/\S*)?$/;
const STEPS = ["Basic details", "Rubric and payouts", "Review and lock"] as const;

interface Check {
  ok: boolean;
  text: string;
}

export function Create() {
  const { signer, connectWallet, useDemoAccount } = useSession();
  const tx = useTx();
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [days, setDays] = useState("30");
  const [parts, setParts] = useState(emptyRubric());
  const [low, setLow] = useState("");
  const [med, setMed] = useState("");
  const [high, setHigh] = useState("");
  const [bond, setBond] = useState("");
  const [pool, setPool] = useState("");

  const v = useMemo(() => {
    const lowW = parseGen(low), medW = parseGen(med), highW = parseGen(high), bondW = parseGen(bond), poolW = parseGen(pool);
    const d = Number(days);
    const rubric = composeRubric(parts);
    const missing = missingSections(parts);
    const bondLo = lowW ? lowW / 100n : null;
    const bondHi = lowW ? lowW / 2n : null;

    const basic: Check[] = [
      { ok: title.trim() !== "" && title.length <= 120, text: "Title is 1 to 120 characters" },
      { ok: URL_RE.test(repo) && repo.length <= 300, text: "Repository is one https URL (context only; the jury never fetches it)" },
      { ok: Number.isInteger(d) && d >= 1 && d <= 90, text: "Closes in 1 to 90 days" },
    ];
    const rules: Check[] = [
      { ok: missing.length === 0, text: missing.length ? `Rubric still needs: ${missing.join(", ")}` : "Rubric has all four sections" },
      { ok: rubric.length <= MAX_RUBRIC, text: `Rubric fits in ${MAX_RUBRIC.toLocaleString()} characters (${rubric.length.toLocaleString()} now)` },
      { ok: !!(lowW && medW && highW && lowW > 0n && highW >= medW && medW >= lowW), text: "Payouts satisfy high ≥ medium ≥ low > 0" },
      {
        ok: !!(bondW && bondLo !== null && bondHi !== null && bondW >= bondLo && bondW <= bondHi && bondW > 0n),
        text: bondLo !== null && bondHi !== null ? `Bond is between ${formatGen(bondLo, 6)} and ${formatGen(bondHi, 6)} GEN (1% to 50% of low)` : "Bond is between 1% and 50% of the low payout",
      },
    ];
    const funding: Check[] = [{ ok: !!(poolW && highW && poolW >= highW), text: "Pool covers at least one high payout" }];
    return { lowW, medW, highW, bondW, poolW, d, rubric, basic, rules, funding, bondLo, bondHi };
  }, [title, repo, days, parts, low, med, high, bond, pool]);

  const allOk = (cs: Check[]) => cs.every((c) => c.ok);
  const stepOk = [allOk(v.basic), allOk(v.rules), allOk(v.funding)];
  const reachable = (i: number) => i === 0 || stepOk.slice(0, i).every(Boolean);
  const valid = stepOk.every(Boolean);
  const done = createdId !== null;

  const List = ({ checks }: { checks: Check[] }) => (
    <div className="panel tight mt-4" aria-live="polite">
      {checks.map((c) => (
        <div key={c.text} className={`check ${c.ok ? "ok" : ""}`}>
          <b>{c.ok ? "✓" : "·"}</b>
          <span>{c.text}</span>
        </div>
      ))}
    </div>
  );

  async function lock() {
    if (!signer) return;
    setConfirm(false); // close the dialog at once: progress is shown on the page, not behind a modal
    const out = await tx.run(async (onPhase) => {
      const now = await chainNow();
      const deadline = BigInt(now + v.d * 86400 - 60);
      return sendTx(signer, "create_bounty", [title.trim(), repo, v.rubric, v.lowW!, v.medW!, v.highW!, deadline, v.bondW!], v.poolW!, onPhase);
    });
    if (out && !out.error) {
      try {
        const newest = await listBounties(0, 5);
        const mine = newest.items.find((b) => b.project === signer.address && b.title === title.trim());
        setCreatedId(mine ? mine.id : 0);
      } catch {
        setCreatedId(0);
      }
    }
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

  return (
    <>
      <p className="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-app-soft">
        <a href="#/" className="!text-app-soft hover:!text-app-text">Inquest</a> / Create
      </p>
      <h1 className="!mt-2">Create a bounty</h1>
      <p className="lede">
        You lock GEN and a rubric. Both are frozen on creation: no admin, no rubric edit, no payout change. A jury of validators then decides each
        report from one public writeup.
      </p>

      {/* stepper */}
      <ol className="m-0 mt-7 flex list-none items-center gap-2 p-0" aria-label="Progress">
        {STEPS.map((label, i) => {
          const current = i === step;
          const complete = stepOk[i] && i < step;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={() => reachable(i) && !done && setStep(i)}
                disabled={!reachable(i) || done}
                aria-current={current ? "step" : undefined}
                className={`!flex !w-full !min-w-0 !items-center !gap-2.5 !rounded-lg !border !px-3 !py-2.5 !text-left ${
                  current ? "!border-gold !bg-gold/10 !text-app-text" : "!border-app-line !bg-app-surface !text-app-soft hover:!bg-app-raised"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${complete ? "bg-ok text-app-bg" : current ? "bg-gold text-[#171205]" : "bg-app-raised text-app-soft"}`}>
                  {complete ? <Check size={13} /> : i + 1}
                </span>
                <span className="truncate text-[13px] font-semibold">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex justify-end">
        <button className="ghost small" onClick={fillExample} disabled={done}>
          Fill with an example
        </button>
      </div>

      {/* step 1 */}
      {step === 0 && (
        <section aria-labelledby="s1">
          <h2 id="s1">Step 1 · Basic details</h2>
          <label htmlFor="title">Title</label>
          <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <label htmlFor="repo">Repository</label>
          <input id="repo" value={repo} placeholder="https://github.com/org/project" onChange={(e) => setRepo(e.target.value)} />
          <div className="hint">Shown as context. The jury never fetches it.</div>
          <label htmlFor="days">Closes in (days, max 90)</label>
          <input id="days" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="!max-w-[10rem]" />
          <List checks={v.basic} />
        </section>
      )}

      {/* step 2 */}
      {step === 1 && (
        <section aria-labelledby="s2">
          <h2 id="s2">Step 2 · Rubric (frozen on creation)</h2>
          {RUBRIC_SECTIONS.map((s) => (
            <div key={s}>
              <label htmlFor={`r-${s}`}>{s}</label>
              <textarea id={`r-${s}`} value={parts[s]} onChange={(e) => setParts({ ...parts, [s]: e.target.value })} />
              <div className="hint">{HELP[s]}</div>
            </div>
          ))}

          <h2>Payouts and bond (GEN)</h2>
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
            <div>
              <label htmlFor="bond">Claim bond</label>
              <input id="bond" value={bond} onChange={(e) => setBond(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div className="hint">
            The bond goes back to the researcher unless the report is not demonstrated or is out of scope; then it goes to you.
            {v.bondLo !== null && v.bondHi !== null && <> Allowed: {formatGen(v.bondLo, 6)} to {formatGen(v.bondHi, 6)} GEN.</>}
          </div>
          <List checks={v.rules} />
        </section>
      )}

      {/* step 3 */}
      {step === 2 && (
        <section aria-labelledby="s3">
          <h2 id="s3">Step 3 · Review and lock</h2>
          <div className="field-row">
            <div>
              <label htmlFor="pool">Pool to lock (GEN)</label>
              <input id="pool" value={pool} onChange={(e) => setPool(e.target.value)} inputMode="decimal" disabled={done} />
              <div className="hint">Must cover at least one high payout. Payouts are absolute and capped by what remains.</div>
            </div>
          </div>

          <div className="panel mt-4">
            <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {(
                [
                  ["Title", title || "—"],
                  ["Repository", repo || "—"],
                  ["Closes in", `${v.d || "—"} days`],
                  ["High / medium / low", `${v.highW ? formatGen(v.highW) : "—"} / ${v.medW ? formatGen(v.medW) : "—"} / ${v.lowW ? formatGen(v.lowW) : "—"} GEN`],
                  ["Claim bond", v.bondW ? `${formatGen(v.bondW, 6)} GEN` : "—"],
                  ["Pool", v.poolW ? `${formatGen(v.poolW)} GEN` : "—"],
                ] as [string, string][]
              ).map(([k, val]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-app-soft">{k}</dt>
                  <dd className="m-0 break-words font-mono text-[13px] text-app-text">{val}</dd>
                </div>
              ))}
            </dl>
          </div>

          <List checks={[...v.basic, ...v.rules, ...v.funding]} />

          <div className="mt-4 flex gap-3 rounded-lg border border-pending/40 bg-pending/5 p-4 text-[13px] leading-relaxed text-app-text">
            <Lock size={18} className="mt-0.5 shrink-0 text-pending" aria-hidden="true" />
            <p className="m-0">
              <b>This cannot be undone.</b> The rubric, the payout bands and the bond are frozen the moment the transaction finalizes. The pool leaves
              your account and stays in the contract: you can cancel and take it back only before the deadline and before any report is filed, and
              otherwise withdraw what is left after the deadline.
            </p>
          </div>
        </section>
      )}

      {/* navigation */}
      {!done && (
        <div className="actions">
          {step > 0 && (
            <button className="ghost !inline-flex !items-center !gap-2" onClick={() => setStep(step - 1)} disabled={tx.busy}>
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          )}
          {step < 2 && (
            <button className="!inline-flex !items-center !gap-2" onClick={() => setStep(step + 1)} disabled={!stepOk[step]}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
          {step === 2 &&
            (signer ? (
              <button disabled={tx.busy || !hasContract || !valid} onClick={() => setConfirm(true)} className="!inline-flex !items-center !gap-2">
                <Lock size={15} aria-hidden="true" /> Lock pool and create bounty
              </button>
            ) : (
              <>
                <button onClick={connectWallet}>Connect wallet</button>
                <button className="ghost" onClick={useDemoAccount}>
                  Use demo account
                </button>
                <span className="muted">to sign</span>
              </>
            ))}
        </div>
      )}

      <TxStatus state={tx.state} doneText="Bounty created." />

      {done && (
        <div className="panel mt-4">
          <p className="m-0 font-semibold text-app-text">Your bounty is live.</p>
          <p className="muted m-0 mt-1">It is open for reports now. Share the link so researchers can file writeups.</p>
          <div className="actions">
            <a href={createdId ? `#/b/${createdId}` : "#/bounties"}>
              <button>{createdId ? "Open your bounty" : "See all bounties"}</button>
            </a>
            <a href="#/mine">
              <button className="ghost">My dashboard</button>
            </a>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Lock this pool?"
        confirmLabel={`Lock ${v.poolW ? formatGen(v.poolW) : ""} GEN`}
        onConfirm={lock}
        onCancel={() => setConfirm(false)}
        busy={tx.busy}
      >
        <p className="m-0">
          You are about to lock <b className="text-app-text">{v.poolW ? formatGen(v.poolW) : "—"} GEN</b> and freeze the rubric for{" "}
          <b className="text-app-text">{title || "this bounty"}</b>.
        </p>
        <p className="mt-3">
          Nothing here can be edited afterwards. Your wallet will ask you to sign one transaction. If the contract refuses it, the GEN is returned to
          you.
        </p>
      </ConfirmDialog>
    </>
  );
}
