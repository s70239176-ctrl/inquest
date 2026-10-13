// Capture the demo footage: drives Edge headlessly against the LIVE deployment at 1920x1080 and saves one PNG per shot,
// with the caption burned into the page. Nothing is mocked and no transaction is ever sent (the create flow stops at
// the confirm dialog).
//   cd video && npm install && node capture.mjs [sceneId ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import puppeteer from "puppeteer-core";
import { BASE, CONTRACT, RESOLVE_TX_CLAIM_1, scenes } from "./storyboard.mjs";

const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const W = 1440, H = 810, DPR = 1920 / 1440; // 1440x810 CSS px at 1.3333x = 1920x1080 output
mkdirSync("frames", { recursive: true });
const args = process.argv.slice(2);
const withEndcard = args.includes("--endcard");
const only = new Set(args.filter((a) => !a.startsWith("--")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, protocolTimeout: 180000, args: ["--no-first-run", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });

// A throwaway demo account so the create flow shows its signed-in buttons; plus the real resolve tx for claim #1.
const demoKey = "0x" + randomBytes(32).toString("hex");
await page.evaluateOnNewDocument(
  (key, resolveKey, hash) => {
    try {
      localStorage.setItem("inquest:sandbox-key", key);
      localStorage.setItem(resolveKey, hash);
    } catch {}
  },
  demoKey,
  `inquest:${CONTRACT.toLowerCase()}:resolve:1`,
  RESOLVE_TX_CLAIM_1,
);

const css = `.banner,.ivory-scope{display:none!important} html{scroll-behavior:auto!important} *{caret-color:transparent}`;

// Studionet allows ~30 RPC calls a minute per IP and every page load reads the contract, so load patiently and retry
// until the data a shot needs has actually appeared. A shot is never captured half-loaded.
let lastLoad = 0;
let currentRoute = null;
async function open(route, ready) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = Math.max(0, 7000 - (Date.now() - lastLoad)) + (attempt > 1 ? 18000 : 0);
    await sleep(wait);
    await page.goto("about:blank");
    await page.goto(`${BASE}/#${route}`, { waitUntil: "networkidle2", timeout: 90000 });
    lastLoad = Date.now();
    await page.addStyleTag({ content: css });
    let ok = true;
    if (ready) {
      ok = await page
        .waitForFunction(({ re, sel }) => (re ? new RegExp(re).test(document.body.innerText) : !!document.querySelector(sel)), { timeout: 90000 }, ready)
        .then(() => true)
        .catch(() => false);
    }
    if (ok) {
      currentRoute = route;
      await page.evaluate(() => document.fonts.ready);
      await sleep(700);
      return;
    }
    const seen = await page.evaluate(() => `${location.hash} | ${document.body.innerText.slice(0, 160).replace(/\s+/g, " ")}`).catch(() => "?");
    console.log(`  (attempt ${attempt}: ${JSON.stringify(ready)} not ready; page shows: ${seen})`);
  }
  throw new Error("page never became ready: " + route);
}

const clickText = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(t));
    if (!b) throw new Error("button not found: " + t);
    b.click();
  }, text);

const scrollTo = (selector, offset = 90, block = "start") =>
  page.evaluate(
    (sel, off, blk) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error("selector not found: " + sel);
      el.scrollIntoView({ block: blk, behavior: "instant" });
      if (blk === "start") window.scrollBy(0, -off);
    },
    selector,
    offset,
    block,
  );

const hasText = (re) => ({ re });
// shots that scroll within the homepage open it first if the previous shot left us elsewhere
const ensureHome = async () => {
  if (currentRoute !== "/") await open("/", hasText("created on-chain"));
};

const actions = {
  "home-top": async () => {
    await open("/", hasText("created on-chain"));
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  "home-art": async () => {
    await ensureHome();
    await scrollTo("figure", 74);
  },
  "how-steps": async () => {
    await ensureHome();
    await scrollTo("#how-it-works", 56);
  },
  latest: async () => {
    await ensureHome();
    await scrollTo("#latest", 56);
  },
  "five-fields": async () => {
    await ensureHome();
    await page.evaluate(() => {
      const h = [...document.querySelectorAll("h3")].find((x) => x.textContent.includes("Five fields. Nothing else."));
      h.closest("div.grid").scrollIntoView({ block: "center", behavior: "instant" });
    });
  },
  "rubric-tab": async () => {
    await open("/b/1/rubric", { re: "Frozen at creation" });
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  "create-1": async () => {
    await open("/create", hasText("Create a bounty"));
    await clickText("Fill with an example");
    await sleep(400);
    await page.evaluate(() => window.scrollTo(0, 120));
  },
  "create-2": async () => {
    await clickText("Continue");
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 280));
  },
  "create-3": async () => {
    await clickText("Continue");
    await sleep(500);
    await scrollTo("#s3", 110);
  },
  "create-confirm": async () => {
    await clickText("Lock pool and create bounty");
    await sleep(700);
  },
  "claim-verdict": async () => {
    await open("/c/1", { sel: ".verdict" });
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  "claim-timeline": async () => scrollTo(".timeline", 0, "center"),
  jury: async () => {
    await open("/b/1/jury", { re: "Load validator votes" });
    await clickText("Load validator votes");
    await page.waitForFunction(() => /agreed/.test(document.body.innerText), { timeout: 60000 }).catch(() => console.log("  (votes did not load)"));
    await sleep(500);
    await scrollTo("article", 96);
  },
  bounties: async () => {
    await open("/bounties", { sel: "table tbody tr" });
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  closing: async () => {
    await open("/", hasText("created on-chain"));
    await page.evaluate(() => {
      document.getElementById("closing-title").closest("section").scrollIntoView({ block: "center", behavior: "instant" });
    });
  },
};

// Captions are rendered separately as transparent 1920x1080 overlays, so they stay razor sharp and static while the
// page behind them gets a slow camera move in the encoder.
const capPage = await browser.newPage();
await capPage.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
await capPage.setContent(
  `<!doctype html><html><head><meta charset="utf-8">
   <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap" rel="stylesheet">
   <style>html,body{margin:0;background:transparent}
   #bar{position:fixed;left:0;right:0;bottom:0;height:92px;box-sizing:border-box;padding:0 8%;display:flex;align-items:center;justify-content:center;text-align:center;
        background:#090A09;border-top:1px solid rgba(214,168,68,.55);color:#F1F0EA;font:400 36px/1.1 "Instrument Serif",Georgia,serif;letter-spacing:.005em}</style>
   </head><body><div id="bar"></div></body></html>`,
  { waitUntil: "networkidle0" },
);
await capPage.evaluate(() => document.fonts.load('36px "Instrument Serif"'));

async function captionOverlay(text, file) {
  await capPage.evaluate((t) => (document.getElementById("bar").textContent = t), text);
  await capPage.evaluate(() => document.fonts.ready);
  await sleep(120);
  await capPage.screenshot({ path: file, type: "png", omitBackground: true });
}

async function endCard(file) {
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  await p.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
     <style>html,body{margin:0;height:100%;background:#F3F0E7;color:#171713}
     main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}
     .brand{display:flex;align-items:center;gap:18px;font:600 30px Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase}
     h1{margin:0;font:400 92px/1.02 "Instrument Serif",Georgia,serif;letter-spacing:-.01em}
     h1 em{color:#8A6210}
     .url{font:500 26px "JetBrains Mono",monospace;color:#171713;border:1px solid #D4CEC1;border-radius:99px;padding:12px 28px;background:rgba(255,255,255,.55)}
     .sub{font:400 20px "JetBrains Mono",monospace;color:#66645D;letter-spacing:.14em;text-transform:uppercase}</style>
     </head><body><main>
       <div class="brand"><svg width="64" height="64" viewBox="0 0 64 64" fill="none"><polygon points="32.00,4.00 56.25,18.00 56.25,46.00 32.00,60.00 7.75,46.00 7.75,18.00" stroke="#171713" stroke-width="3.4" stroke-linejoin="round"/><circle cx="32" cy="15.9" r="3.5" fill="#D6A844"/><rect x="30" y="22.2" width="4" height="12.6" fill="#171713"/><path d="M32 34.2 40.8 43 32 51.8 23.2 43Z" fill="#D6A844"/></svg>Inquest</div>
       <h1>A bug isn&rsquo;t real<br><em>until it repros.</em></h1>
       <div class="url">inquest-repro.vercel.app</div>
       <div class="sub">Evidence first &middot; Independent judgment &middot; On-chain settlement</div>
     </main></body></html>`,
    { waitUntil: "networkidle0" },
  );
  await p.evaluate(() => document.fonts.ready);
  await sleep(300);
  await p.screenshot({ path: file, type: "png" });
  await p.close();
}

const manifest = [];
for (const scene of scenes) {
  if (only.size && !only.has(scene.id)) continue;
  console.log("scene", scene.id);
  for (const shot of scene.shots) {
    await actions[shot.action]();
    await sleep(250);
    const file = `frames/${scene.id}__${shot.id}.png`;
    await page.screenshot({ path: file, type: "png" }); // the clean page: no caption baked in
    await captionOverlay(shot.caption, `frames/${scene.id}__${shot.id}.cap.png`);
    manifest.push({ scene: scene.id, shot: shot.id, file, cap: `frames/${scene.id}__${shot.id}.cap.png` });
    console.log("  captured", file);
    if (shot.action === "create-confirm") await page.keyboard.press("Escape"); // never confirm: no transaction is sent
  }
}
if (!only.size || withEndcard) {
  await endCard("frames/endcard.png");
  if (!only.size) writeFileSync("frames/manifest.json", JSON.stringify(manifest, null, 2));
}
await browser.close();
console.log("done:", manifest.length, "frames");
