# Inquest demo video (about 1:30)

A storyboard-driven pipeline: it films the **live deployment** at 1920×1080, adds captions, narrates with **ElevenLabs**, and encodes the MP4 with ffmpeg. Nothing is mocked and no transaction is ever sent (the create flow stops at the confirm dialog).

```
storyboard.mjs  ──►  capture.mjs  ──►  voiceover.mjs  ──►  build.mjs  ──►  out/inquest-demo.mp4
 narration +          Edge, headless     ElevenLabs, one     slow camera moves, caption overlays,
 captions + shots     1920x1080 PNGs     take per scene      crossfades, narration timed per scene
```

## Make the video

```bash
cd video
npm install
node capture.mjs                 # films the live app into frames/ (re-run one scene: node capture.mjs s5-verdict)
node voiceover.mjs               # needs ELEVENLABS_API_KEY (below); writes audio/<scene>.mp3
node build.mjs                   # writes out/inquest-demo.mp4 (out/inquest-demo-preview-silent.mp4 if no narration yet)
```

**API key.** Put it in the repo-root `.env.local` (gitignored) as `ELEVENLABS_API_KEY=...`, or export it in your shell. It is read only from there, never printed, and never written anywhere else. Defaults: voice **Adam** (`pNInz6obpgDQGcFmaJgB`), model `eleven_multilingual_v2`. Override with `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL`. Use `--force` to regenerate takes.

**ffmpeg** comes from the `imageio-ffmpeg` Python package (`pip install imageio-ffmpeg`); set `FFMPEG` to use another binary. Edge is used for capture (`EDGE_PATH` to override).

## How the timing works

`build.mjs` measures each narration take and gives its scene that length plus a short lead-in and tail; the scene's shots share the time. The end card absorbs whatever is left to land near 90 seconds (`TARGET_SECONDS` in `storyboard.mjs`). Change the narration, re-run `voiceover.mjs --force` and `build.mjs`: only clips whose duration changed are re-rendered.

## Editing

Everything is in `storyboard.mjs`: each scene has its spoken `narration` (one ElevenLabs take, so the intonation flows across sentences) and its `shots`, each with an on-screen `caption` and a named capture `action` defined in `capture.mjs`.

## Notes

- Studionet allows about 30 RPC reads a minute per IP and every page load reads the contract, so `capture.mjs` loads patiently and retries a shot until its data has appeared. If a capture still fails, wait a minute and re-run that scene.
- Frames, clips, audio and output are gitignored. The footage is of a **test network**, shown with a throwaway demo account.
