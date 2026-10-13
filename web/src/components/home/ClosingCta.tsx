import { ArrowRight } from "lucide-react";
import { Linework } from "./HeroArt.tsx";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-app-line bg-app-surface text-app-text" aria-labelledby="closing-title">
      <Linework className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[60%] sm:block" />
      <div className="relative mx-auto max-w-page px-5 py-20 lg:py-28">
        <h2
          id="closing-title"
          className="!m-0 max-w-2xl font-serif !text-[44px] !font-normal !normal-case !leading-[1.02] !tracking-tight !text-app-text sm:!text-[68px]"
        >
          Better verification.
          <br />
          Stronger security.
        </h2>
        <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-app-soft">
          Lock a pool, freeze a rubric, and let independent validators decide what a public writeup actually proves.
        </p>
        <a
          href="#/bounties"
          className="mt-9 inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3.5 text-sm font-semibold !text-[#171205] no-underline transition-colors hover:bg-gold-hover hover:no-underline"
        >
          Explore Bounties <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
