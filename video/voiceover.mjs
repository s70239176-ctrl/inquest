// Generate the voiceover with ElevenLabs: one take per scene (natural intonation across sentences).
//
//   1. Put your key in the repo-root .env.local (gitignored):   ELEVENLABS_API_KEY=...
//      (or export it in your shell). Optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL.
//   2. cd video && node voiceover.mjs          (add --force to regenerate existing takes)
//
// The key is read from the environment or .env.local only and is never printed or written anywhere else.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { scenes, wordCount } from "./storyboard.mjs";

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const f of ["../.env.local", ".env.local", "../.env"]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const key = loadKey();
if (!key) {
  console.error("No ELEVENLABS_API_KEY found. Add it to ../.env.local (gitignored) or export it, then run again.");
  process.exit(2);
}

const VOICE = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"; // "Adam": calm, low, built for narration
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
const force = process.argv.includes("--force");
mkdirSync("audio", { recursive: true });

console.log(`voice ${VOICE}, model ${MODEL}, ${scenes.reduce((n, s) => n + wordCount(s.narration), 0)} words in ${scenes.length} takes`);

for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  const file = `audio/${s.id}.mp3`;
  if (existsSync(file) && !force) {
    console.log("  keep   ", file);
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: s.narration,
      model_id: MODEL,
      // neighbouring text lets each separate take continue the previous one's delivery
      previous_text: scenes[i - 1]?.narration,
      next_text: scenes[i + 1]?.narration,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.error(`ElevenLabs refused scene ${s.id}: HTTP ${res.status} ${body}`);
    process.exit(1);
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("  wrote  ", file);
}
console.log("done. Now run: node build.mjs");
