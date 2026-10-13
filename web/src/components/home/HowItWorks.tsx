interface Step {
  n: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { n: "01", title: "Lock a bounty", body: "A project locks GEN and freezes a rubric: what is in scope, what counts as a duplicate, and where each severity bar sits. Neither can be changed afterwards." },
  { n: "02", title: "Submit a writeup", body: "A researcher posts one public URL and a small bond. Nothing is run against any target, and no link inside the page is followed." },
  { n: "03", title: "Independent jury", body: "Each validator fetches the page itself and answers five fixed fields. The leader is accepted only if every validator reaches the same five answers." },
  { n: "04", title: "On-chain settlement", body: "A plain table pays, slashes or refunds from those answers, and only once the verdict finalizes. If the jury cannot decide, no GEN moves." },
];

const FIELDS: { name: string; means: string }[] = [
  { name: "evidence_available", means: "A technical writeup could be loaded" },
  { name: "demonstrated", means: "The page itself shows the behavior, a reproduction and the cause" },
  { name: "in_scope", means: "The frozen rubric covers it" },
  { name: "duplicate_of", means: "An earlier accepted claim with the same root cause, or null" },
  { name: "severity", means: "none, low, medium or high: the lowest bar actually met" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-ivory-2 text-ivory-ink" aria-labelledby="how-title">
      <div className="mx-auto max-w-page px-5 py-16 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-gold-deep">How it works</p>
            <h2 id="how-title" className="!m-0 mt-4 font-serif !text-[40px] !font-normal !normal-case !leading-[1.05] !tracking-tight !text-ivory-ink sm:!text-[52px]">
              Four steps from claim to settlement.
            </h2>
          </div>
          <p className="m-0 text-[16px] leading-[1.7] text-ivory-muted lg:col-span-6 lg:col-start-7 lg:pt-8">
            The mechanism is small on purpose. Money is handled by ordinary code; the jury answers only five questions about one public page.
          </p>
        </div>

        <ol className="m-0 mt-14 grid list-none gap-y-10 border-t border-ivory-ink/80 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="border-ivory-line pt-6 sm:pr-8 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
              <span className="font-mono text-[12px] font-medium text-gold-deep">{s.n}</span>
              <h3 className="!m-0 mt-3 font-serif text-[28px] font-normal leading-tight text-ivory-ink">{s.title}</h3>
              <p className="mt-3 text-[14.5px] leading-[1.65] text-ivory-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-6 rounded-2xl border border-ivory-line bg-ivory p-6 sm:p-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <h3 className="!m-0 font-serif text-[30px] font-normal leading-tight text-ivory-ink">Five fields. Nothing else.</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-ivory-muted">
              The jury&apos;s whole answer. Prose is never compared, so a persuasive page can only choose between a few enumerated outcomes.
            </p>
          </div>
          <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:col-span-8">
            {FIELDS.map((f) => (
              <div key={f.name} className="border-t border-ivory-line pt-3">
                <dt className="font-mono text-[12.5px] font-medium text-ivory-ink">{f.name}</dt>
                <dd className="m-0 mt-1 text-[13px] leading-snug text-ivory-muted">{f.means}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
