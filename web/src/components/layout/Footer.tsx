import type { Tone } from "./Navbar.tsx";

export function Footer({ tone }: { tone: Tone }) {
  const ivory = tone === "ivory";
  return (
    <footer className={`border-t ${ivory ? "border-ivory-line bg-ivory text-ivory-muted" : "border-app-line bg-app-bg text-app-soft"}`}>
      <div className="mx-auto flex max-w-page flex-col gap-3 px-5 py-8 text-[12.5px] md:flex-row md:items-start md:justify-between">
        <p className="m-0 max-w-2xl leading-relaxed">
          Inquest reads one public writeup. It never runs a proof of concept, never follows links inside a writeup and never sends traffic to a
          target. It is not legal advice and does not certify that any software is secure. If the jury cannot decide, no GEN moves.
        </p>
        <nav className="flex gap-5 font-medium" aria-label="Footer">
          <a href="#/bounties" className="!text-current hover:underline">
            Bounties
          </a>
          <a href="#/create" className="!text-current hover:underline">
            Create
          </a>
          <a href="https://github.com/s70239176-ctrl/inquest" target="_blank" rel="noreferrer noopener" className="!text-current hover:underline">
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
