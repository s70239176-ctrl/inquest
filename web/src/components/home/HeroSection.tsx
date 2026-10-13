import { ArrowRight } from "lucide-react";
import { NETWORK } from "../../lib/chain.ts";
import { HeroArt } from "./HeroArt.tsx";

/** Smooth-scroll to a section without touching the hash router. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function HeroSection() {
  return (
    <section className="bg-ivory text-ivory-ink" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-page gap-10 px-5 pb-12 pt-10 lg:grid-cols-12 lg:items-stretch lg:gap-12 lg:pb-16 lg:pt-16">
        <div className="flex flex-col justify-center lg:col-span-7">
          <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-gold-deep">The on-chain bug bounty protocol</p>

          <h1
            id="hero-title"
            className="!m-0 mt-5 font-serif !text-[56px] !font-normal !leading-[0.98] !tracking-tight text-ivory-ink sm:!text-[84px] lg:!text-[104px]"
          >
            Evidence.
            <br />
            Validators.
            <br />
            <em className="italic text-gold-deep">True security.</em>
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-[1.65] text-ivory-muted">
            Inquest pays bug bounties only when independent validators agree that public evidence proves an in-scope, non-duplicate bug.
            A bug isn&apos;t real until it repros.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#/bounties"
              className="inline-flex items-center gap-2 rounded-md bg-ivory-ink px-6 py-3.5 text-sm font-semibold !text-ivory no-underline transition-colors hover:bg-black hover:no-underline"
            >
              Explore Bounties <ArrowRight size={16} aria-hidden="true" />
            </a>
            <button
              onClick={() => jumpTo("how-it-works")}
              className="!rounded-md !border !border-ivory-ink/25 !bg-transparent !px-6 !py-3.5 !text-sm !font-semibold !text-ivory-ink transition-colors hover:!border-ivory-ink hover:!bg-transparent"
            >
              How It Works
            </button>
          </div>
        </div>

        <figure className="relative m-0 min-h-[440px] overflow-hidden rounded-2xl bg-app-bg shadow-[0_30px_60px_-30px_rgba(23,23,19,0.55)] lg:col-span-5 lg:min-h-[560px]">
          <HeroArt className="absolute inset-0 h-full w-full" />
          <figcaption className="absolute left-4 right-4 top-4 flex items-center justify-between font-mono text-[10.5px] text-app-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-bg/70 px-2.5 py-1 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
              {NETWORK}
            </span>
            <span className="rounded-full border border-app-line bg-app-bg/70 px-2.5 py-1 backdrop-blur">Evidence first</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
