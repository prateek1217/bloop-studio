# Subtitle Studio

AI-aware subtitles for reels/talking-head videos: captions that read the frame
and place themselves in empty space, in front of the person, or **behind**
the person's body using a live segmentation mask.

## Architecture at a glance

This is a **local-first, client-heavy MVP**, not the full multi-tenant SaaS
described in the original product spec. That scope was chosen deliberately
(see "Decisions" below) to get the core differentiator — depth-aware
subtitles — working end-to-end before investing in accounts/billing/a
server-side render farm.

```
Upload (browser)
  -> extract audio (Web Audio API, in-browser)
  -> transcribe (thin API route -> NVIDIA Parakeet-TDT or OpenAI Whisper, word timestamps)
  -> score word emphasis (loudness + text cues, src/lib/pipeline/wordEmphasis.ts -> drives per-word size)
  -> segment captions (pure function, src/lib/pipeline/segmentCaptions.ts)
  -> person segmentation (MediaPipe Selfie Segmentation, in-browser, GPU)
  -> temporal tracking (sparse keyframe sampling + alpha-lerp interpolation)
  -> auto layout (8-region scoring vs. person/face bbox, src/lib/pipeline/autoLayout.ts)
  -> theme (pure data, src/lib/themes/themes.ts)
  -> live preview (canvas compositor, src/lib/render/compositor.ts)
  -> export (canvas.captureStream + MediaRecorder, remuxed to mp4 by ffmpeg.wasm)
```

Everything through "auto layout" runs once per upload and is cached in
IndexedDB (`src/lib/db/projectStore.ts`). Changing the theme or a segment's
position/depth override never re-runs transcription or segmentation — it
only changes data the renderer reads (this is the "transcript / captions /
visual analysis / layout / style / renderer stay separate" requirement from
the spec).

## Key decisions & why

- **No backend/DB beyond one API route.** Projects (transcript, captions,
  person masks, theme) live in the browser: small JSON records in IndexedDB
  (`src/lib/db/projectStore.ts`), source video files in OPFS — the Origin
  Private File System — since that's built for large binary files rather
  than IndexedDB's structured-clone overhead at video sizes
  (`src/lib/db/opfsVideoStore.ts`, with an automatic IndexedDB fallback on
  browsers without OPFS). This matches "do most of the work client side" and
  avoids building auth/Postgres/object storage before the core feature is
  proven. Promoting this to a real multi-user SaaS later means adding a sync
  layer on top of the same `Project` shape — the pipeline/renderer don't need
  to change.
- **Transcription is the one server call.** Running Whisper in-browser is
  slow/heavy and less accurate; a thin Next.js API route
  (`src/app/api/transcribe`) keeps the API key server-side while everything
  else — audio extraction, segmentation, layout, compositing, export — runs
  in the browser. Swap providers via `STT_PROVIDER` (see `src/lib/stt`).
  Two providers are implemented: `openai-whisper` (plain HTTP) and
  `nvidia-parakeet` (NVIDIA Riva Parakeet-TDT). Parakeet's word-level
  timestamps are only exposed via NVIDIA's gRPC API, not its HTTP endpoint,
  so that provider shells out to `scripts/nvidia_transcribe.py`, a thin
  wrapper around NVIDIA's own `nvidia-riva-client` Python package, rather
  than reimplementing the Riva protobuf wire format by hand in Node. Using
  it requires Python 3 on PATH with `pip install -U nvidia-riva-client`.
- **Hindi and Hinglish are a language *choice* at upload time, not separate
  themes.** English keeps using whichever `STT_PROVIDER` is configured.
  Hindi transcribes directly with NVIDIA's multilingual Parakeet model
  (`nvidia/parakeet-1.1b-rnnt-multilingual-asr`, `language_code=hi-IN` —
  same gRPC pattern as the English Parakeet-TDT provider, just a different
  key/function-id). Hinglish is *not* a separate ASR model: it transcribes
  in Hindi first, then transliterates the result word-for-word into
  Roman-script Hinglish via NVIDIA's hosted `nemotron-3.5-lightning-30b-a3b`
  (`src/lib/stt/transliterate.ts`, over its OpenAI-compatible chat
  completions endpoint). Transliteration rather than translation is what
  lets the original Hindi ASR's word timestamps keep applying unchanged —
  translating could reorder, merge, or split words and break that alignment.
- **MediaPipe Selfie Segmentation, not BodyPix or a multi-person model.**
  It's built for exactly this use case (single/couple-person portrait video),
  runs on the GPU delegate, and the mask is downsampled to 256px wide before
  storage/interpolation (raised from an initial 160px — still far below
  source resolution, but sharper around limbs/hair) — this is what keeps
  segmentation "lightweight" in the browser rather than running a heavy model
  at full frame resolution. Raw confidence values are also pushed through a
  contrast curve around the 0.5 midpoint (`sharpenAlpha` in
  `src/lib/segmentation/personSegmenter.ts`) before storage, so uncertain
  edge pixels read as a crisper silhouette instead of visibly translucent.
- **Sparse keyframe sampling (~every 80ms), not every frame.** Full-rate
  segmentation on every decoded frame would be the actual "heavy" cost in
  this pipeline. Masks are sampled sparsely during a one-time analysis pass
  and alpha-blended between samples at render time
  (`src/lib/pipeline/analyzeVideo.ts`). Shorter intervals mean less motion
  between two keyframes, so the interpolation blends more similar silhouettes
  instead of smearing a bigger gap. This is the current, simple version of
  the spec's "temporal tracking" stage — a natural next step is
  confidence-triggered re-segmentation instead of a fixed interval.
- **Export re-plays the clip once (client-side) instead of a server render
  farm.** `src/lib/render/exportVideo.ts` drives the same compositor used for
  preview via `canvas.captureStream()` + `MediaRecorder`, then hands the
  result to ffmpeg.wasm only to transcode/remux to a shareable MP4. This
  fits reel-length clips (roughly 15–90s) well; very long source videos
  would be a good trigger to add a server-side render worker later, exactly
  as the original spec's FFmpeg worker describes.
- **Depth-aware compositing without a separate matting pass.** Instead of
  keeping a clean background plate, the renderer draws
  `video frame -> subtitle -> masked person cutout` for `behind_person`
  segments. The person cutout is the same video frame masked by the
  confidence mask's own alpha, redrawn on top — this is what makes the body
  occlude the text with a soft, anti-aliased edge, and it's cheap (one extra
  `drawImage` + `destination-in` composite per frame).

## Running it

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY
npm run dev
npm test                     # unit tests for the segmentation/layout algorithms
```

Open http://localhost:3000, click **New project**, drop in a short
talking-head video (MP4/MOV/WebM). Processing (transcription + segmentation +
person analysis + layout) runs once, then you land in the editor.

Browser requirements: a recent Chromium-based browser is the best-tested
target — `HTMLMediaElement.captureStream()` (used for export) and the
MediaPipe GPU delegate both have the most reliable support there. Firefox
mostly works; Safari's `captureStream` support is inconsistent, so exporting
may not work there yet.

## Where things live

```
src/types/                    Shared domain types (Word, CaptionSegment, PersonMaskFrame, SubtitleTheme, Project, ...)
src/lib/stt/                  STT provider abstraction (OpenAI, NVIDIA Parakeet EN/HI) + Hindi->Hinglish transliteration
src/app/api/transcribe/       Thin relay route (audio + language in, word-level transcript out)
src/app/api/transliterate/    Thin relay route for the Hindi -> Hinglish transliteration step
src/lib/audio/                Client-side audio extraction (Web Audio API -> PCM/WAV) + waveform peak extraction
src/lib/pipeline/             segmentCaptions, wordEmphasis, analyzeVideo (person masks), autoLayout, runPipeline (orchestrator)
src/lib/segmentation/         MediaPipe Selfie Segmentation wrapper
src/lib/themes/               Theme registry (data only) + the canvas rendering engine
src/lib/render/               Depth-aware compositor (preview) + exportVideo (ffmpeg.wasm remux)
src/lib/db/                   Project/caption/mask JSON in IndexedDB (idb-keyval); source videos in OPFS
src/store/                    Zustand editor state
src/components/editor/        VideoStage, Timeline, SegmentList, StylePanel, ExportPanel
src/app/(pages)                Dashboard (/), upload+processing (/new), editor (/editor/[id])
```

## What's simplified vs. the full spec (by design, for the MVP)

- No accounts, billing, or multi-tenant database — single browser, local
  projects.
- Layout scoring covers overlap with a person/face bbox across 8 regions
  plus basic hysteresis; it doesn't yet factor in motion or general visual
  clutter.
- Person segmentation assumes a MediaPipe-supported foreground/background
  split (great for single/couple-person reels); it isn't a multi-person
  instance segmenter.
- Export re-encodes via a real-time canvas recording rather than a
  frame-exact offline renderer, which is simpler and fast enough for
  reel-length clips but not for long-form video.
- Word-emphasis text heuristics (`src/lib/pipeline/wordEmphasis.ts`) — the
  filler-word list, ALL-CAPS check — are English-specific. For Hindi/Hinglish
  they quietly no-op rather than misfire; emphasis there is driven almost
  entirely by the (language-independent) loudness score.

These are the natural next milestones, not missing requirements — the
provider/theme/layout abstractions were built so each can be swapped or
upgraded independently.
