// Assemble the final video: slow camera moves on the captured screens, static caption overlays, crossfades, the
// ElevenLabs narration timed to each scene, and a loudness-normalised mix. Falls back to a silent captioned preview
// when no narration has been generated yet.
//   cd video && node build.mjs
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { scenes, wordCount, TARGET_SECONDS } from "./storyboard.mjs";

const FFMPEG =
  process.env.FFMPEG ??
  "C:/Users/User/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe";
const FPS = 30, XF = 0.3, LEAD = 0.45, TAIL = 0.7;
mkdirSync("clips", { recursive: true });
mkdirSync("out", { recursive: true });

function run(args, label) {
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(`ffmpeg failed (${label}):\n${r.stderr}`);
    process.exit(1);
  }
}

function duration(file) {
  const r = spawnSync(FFMPEG, ["-i", file], { encoding: "utf8" });
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

// ---- timeline -------------------------------------------------------------------------------------------------
const haveAudio = scenes.every((s) => existsSync(`audio/${s.id}.mp3`));
let t = 0;
const timeline = []; // shots with start/dur
const narration = []; // { file, startMs }
for (const s of scenes) {
  const spoken = haveAudio ? duration(`audio/${s.id}.mp3`) : wordCount(s.narration) * 0.4; // ~150 wpm when estimating
  const base = spoken + LEAD + TAIL;
  const per = base / s.shots.length;
  if (haveAudio) narration.push({ file: `audio/${s.id}.mp3`, startMs: Math.round((t + LEAD) * 1000) });
  s.shots.forEach((shot, i) =>
    timeline.push({ key: `${s.id}__${shot.id}`, page: `frames/${s.id}__${shot.id}.png`, cap: `frames/${s.id}__${shot.id}.cap.png`, base: per, start: t + i * per }),
  );
  t += base;
}
const scenesEnd = t;
const endBase = Math.min(9, Math.max(3.5, TARGET_SECONDS - scenesEnd - XF));
timeline.push({ key: "endcard", page: "frames/endcard.png", cap: null, base: endBase, start: t });
const total = scenesEnd + endBase + XF;

console.log(`${haveAudio ? "narration" : "NO narration yet (silent preview, estimated timing)"}; scenes ${scenesEnd.toFixed(1)}s + end card ${endBase.toFixed(1)}s = ${total.toFixed(1)}s (target ${TARGET_SECONDS}s)`);

// ---- one clip per shot ----------------------------------------------------------------------------------------
timeline.forEach((c, i) => {
  const D = c.base + XF; // each clip overlaps the next by XF
  const N = Math.round(D * FPS);
  c.file = `clips/${c.key}-${Math.round(D * 1000)}.mp4`; // keyed by duration: a rebuild with new narration timing re-renders only what changed
  if (existsSync(c.file) && existsSync(c.page) && statSync(c.file).mtimeMs > Math.max(statSync(c.page).mtimeMs, c.cap ? statSync(c.cap).mtimeMs : 0)) {
    console.log("  keep", c.key, `${D.toFixed(2)}s`);
    return;
  }
  const zoomIn = i % 2 === 0;
  const z = zoomIn ? `1+0.04*on/${N}` : `1.04-0.04*on/${N}`;
  const args = ["-i", c.page];
  if (c.cap) args.push("-loop", "1", "-framerate", String(FPS), "-t", D.toFixed(3), "-i", c.cap);
  const bg = `[0:v]scale=3840:2160:flags=lanczos,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${N}:s=1920x1080:fps=${FPS},format=yuv420p`;
  const fc = c.cap ? `${bg}[bg];[1:v]format=rgba[cap];[bg][cap]overlay=0:0:shortest=1,format=yuv420p[v]` : `${bg}[v]`;
  args.push("-filter_complex", fc, "-map", "[v]", "-t", D.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", c.file);
  run(args, c.key);
  console.log("  clip", c.key, `${D.toFixed(2)}s`);
});

// ---- crossfade chain + audio mix ------------------------------------------------------------------------------
const inputs = [];
timeline.forEach((c) => inputs.push("-i", c.file));
let vchain = "";
let prev = "[0:v]";
let acc = 0;
for (let k = 1; k < timeline.length; k++) {
  acc += timeline[k - 1].base + XF - XF; // offset = sum of previous clip durations - k*XF = sum of bases
  const offset = timeline.slice(0, k).reduce((n, c) => n + c.base, 0);
  const out = k === timeline.length - 1 ? "[vout]" : `[x${k}]`;
  vchain += `${prev}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}${out};`;
  prev = out;
}
void acc;

let achain = "";
const aIn = [];
if (haveAudio) {
  narration.forEach((n, j) => {
    inputs.push("-i", n.file);
    const idx = timeline.length + j;
    achain += `[${idx}:a]adelay=${n.startMs}|${n.startMs},apad[a${j}];`;
    aIn.push(`[a${j}]`);
  });
  achain += `${aIn.join("")}amix=inputs=${narration.length}:normalize=0:dropout_transition=0,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;
} else {
  inputs.push("-f", "lavfi", "-t", total.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
  achain = `[${timeline.length}:a]anull[aout]`;
}

const outFile = haveAudio ? "out/inquest-demo.mp4" : "out/inquest-demo-preview-silent.mp4";
run(
  [...inputs, "-filter_complex", vchain + achain, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(3), outFile],
  "final",
);
const d = duration(outFile);
console.log(`wrote ${outFile}  ${d?.toFixed(1)}s`);
writeFileSync("out/timeline.json", JSON.stringify({ haveAudio, total, timeline, narration }, null, 2));
