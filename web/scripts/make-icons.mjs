// Rasterize the brand SVGs into the icon set in web/public.
//   cd web && npm install --no-save sharp && node scripts/make-icons.mjs
// (sharp is deliberately not a dependency: icons are generated rarely and committed.)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => join(root, "brand", f);
const pub = (f) => join(root, "public", f);
mkdirSync(join(root, "public"), { recursive: true });

const faviconSvg = readFileSync(brand("favicon.svg"));
copyFileSync(brand("favicon.svg"), pub("favicon.svg"));

const render = (svg, size) => sharp(svg, { density: 1200 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();

// tab icons: transparent background, the hexagon fills the square
for (const s of [16, 32]) writeFileSync(pub(`favicon-${s}.png`), await render(faviconSvg, s));

// app icons: near-black full-bleed square (no transparency), hexagon at ~66% so it survives any mask
async function appIcon(size) {
  const inner = await render(faviconSvg, Math.round(size * 0.66));
  return sharp({ create: { width: size, height: size, channels: 4, background: "#090A09" } })
    .composite([{ input: inner, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
writeFileSync(pub("apple-touch-icon.png"), await appIcon(180));
writeFileSync(pub("icon-192.png"), await appIcon(192));
writeFileSync(pub("icon-512.png"), await appIcon(512));

writeFileSync(
  pub("site.webmanifest"),
  JSON.stringify(
    {
      name: "Inquest",
      short_name: "Inquest",
      description: "A bug bounty that pays only when independent validators agree a public writeup proves an in-scope, non-duplicate bug.",
      start_url: "./",
      display: "standalone",
      background_color: "#090A09",
      theme_color: "#090A09",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("icons written to public/");
