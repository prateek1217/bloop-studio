import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "@/lib/ffmpeg/client";
import { Compositor, findActiveSegment } from "./compositor";
import { getMaskAtTime } from "@/lib/pipeline/analyzeVideo";
import type { CaptionSegment, PersonMaskFrame, SubtitleTheme, Word } from "@/types";

export interface ExportOptions {
  video: HTMLVideoElement;
  words: Word[];
  captions: CaptionSegment[];
  masks: PersonMaskFrame[];
  theme: SubtitleTheme;
  width: number;
  height: number;
  /** Known-good duration (e.g. project.meta.durationSec) to fall back on when
   * video.duration is unreliable (NaN/Infinity) for the source container. */
  durationHint?: number;
  onProgress?: (phase: "recording" | "encoding", fraction: number) => void;
}

type VideoFrameCallbackElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

// No decoded frame at all for this long means playback has genuinely stalled
// (autoplay silently blocked, decoder error, tab-discard edge case) — this is
// NOT a per-frame processing budget, since processing now happens fully
// decoupled from capture (see below), so it can stay generous without ever
// being hit by a merely-slow-but-working device.
const STALL_TIMEOUT_MS = 8000;

/**
 * Captures the source video's real decoded frames by playing it through
 * once, start to finish, compositing each one onto a canvas the instant
 * `requestVideoFrameCallback` reports it, and writing the result as a PNG
 * into ffmpeg.wasm's virtual filesystem. ffmpeg then muxes that PNG sequence
 * with the source's own audio track into the final MP4.
 *
 * This is the third distinct approach tried here, after two earlier ones
 * each got the frame source wrong in a different way:
 *  1. Seeking to each output frame's computed `i/fps` timestamp — real
 *     device decoders (mobile especially) often snap an arbitrary seek to
 *     the nearest keyframe rather than the exact requested frame, so several
 *     seeks landing within one keyframe interval can silently return the
 *     *same* decoded frame.
 *  2. Playing forward continuously and *awaiting* each frame's draw+encode+
 *     write before moving on — since that processing takes real time, the
 *     video kept advancing underneath it, silently skipping every frame that
 *     decoded while still busy with the previous one (confirmed: an
 *     8.9s/30fps clip that should yield ~268 frames came out with 64).
 *  3. Pausing between every single frame (play → one frame → pause → process
 *     → repeat) — correct and confirmed working on desktop, but on a real
 *     mobile device the same 8.9s clip came out with only 104 of ~268 frames,
 *     with zero duplicates (ruled out via `ffmpeg -vf mpdecimate`), meaning
 *     frames were genuinely skipped rather than stuck. The most likely cause
 *     is the repeated play()/pause() cycling itself — some mobile hardware
 *     decoders resync on resume rather than continuing from the exact frame
 *     they paused on, jumping ahead by more than one frame.
 *
 * This version never pauses mid-capture at all, closing gap 3, while still
 * closing gap 2: the compositing draw happens synchronously inside the
 * `requestVideoFrameCallback` tick (so the correct frame's pixels are always
 * captured, and the *next* callback is armed before anything slow starts),
 * but the actually slow parts — PNG encoding and the ffmpeg filesystem write
 * — run fully decoupled in the background and are only ever awaited once,
 * after the video finishes playing.
 */
export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { video, words, captions, masks, theme, width, height, durationHint, onProgress } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const compositor = new Compositor();

  const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint;
  if (!rawDuration) {
    throw new Error("Could not determine video duration for export.");
  }
  // Reassigned to a definite `number` — closures defined below (captureFrame,
  // onFrame) otherwise see `duration` back as possibly-undefined, since TS
  // doesn't carry a narrowing across a function boundary even for a const.
  const duration: number = rawDuration;

  const sourceUrl = video.currentSrc || video.src;
  if (!sourceUrl) {
    throw new Error("Video has no source to read audio from.");
  }

  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile("source.input", await fetchFile(sourceUrl));

  const wasMuted = video.muted;
  video.muted = true; // this playback is never meant to be heard — real audio comes from source.input directly

  // Some browsers (notably Safari) only honor an unmuted video.play() when it
  // happens synchronously within the click that triggered it — the seek below
  // is async, so by the time we'd call play() afterward the gesture may have
  // expired and play() rejects with a DOMException. Spend the gesture here,
  // immediately, then pause; sticky activation from this first play() is what
  // lets the later play() call succeed.
  try {
    await video.play();
    video.pause();
  } catch {
    // If even this fails, the real play() below throws the same error and it
    // surfaces to the caller there instead.
  }
  await seekTo(video, 0);

  const frameNameAt = (i: number) => `frame${String(i).padStart(6, "0")}.png`;
  let frameCount = 0;
  const pendingWrites: Promise<void>[] = [];

  /** Composites one frame from `video`'s current displayed content and kicks
   * off its PNG encode + ffmpeg write. The compositing draw itself runs
   * synchronously (no `await` before it), so callers can safely fire this
   * without awaiting it and immediately move on to the next frame — the
   * canvas is redrawn only after `canvas.toBlob` below has already taken its
   * own internal snapshot of the current pixels. */
  function captureFrame(t: number, frameIndex: number): Promise<void> {
    const segment = findActiveSegment(captions, t);
    const segmentWords = segment ? words.slice(segment.wordStartIndex, segment.wordEndIndex + 1) : [];
    const mask = getMaskAtTime(masks, t);

    compositor.drawFrame({
      ctx,
      video,
      canvasWidth: width,
      canvasHeight: height,
      segment,
      segmentWords,
      currentTime: t,
      theme,
      mask,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
    })
      .then((blob) => blob.arrayBuffer())
      .then((buf) => ffmpeg.writeFile(frameNameAt(frameIndex), new Uint8Array(buf)))
      .then(() => {
        onProgress?.("recording", Math.min(t / duration, 1));
      });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const vfcVideo = video as VideoFrameCallbackElement;
      const useFrameCallback = typeof vfcVideo.requestVideoFrameCallback === "function";
      let settled = false;
      let stallTimer: ReturnType<typeof setTimeout>;
      let lastCapturedTime = -1;

      const cleanup = () => {
        clearTimeout(stallTimer);
        video.removeEventListener("ended", onEnded);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        video.pause();
        resolve();
      };
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        video.pause();
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const armStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(
          () => fail(new Error("Video playback stalled during export (no frame decoded in time).")),
          STALL_TIMEOUT_MS
        );
      };
      const onEnded = () => finish();
      video.addEventListener("ended", onEnded);

      const onFrame = (_now: number, metadata?: { mediaTime: number }) => {
        if (settled) return;
        const t = metadata ? metadata.mediaTime : video.currentTime;
        if (t >= duration || video.ended) {
          finish();
          return;
        }

        // Without real per-frame metadata (rAF fallback for browsers with no
        // rVFC), the same decoded frame can be seen on consecutive ticks —
        // skip it rather than writing a duplicate PNG.
        if (!useFrameCallback && t === lastCapturedTime) {
          requestAnimationFrame(() => onFrame(0));
          return;
        }
        lastCapturedTime = t;

        armStallTimer();
        // Re-arm before doing anything else — this is what guarantees every
        // real decoded frame is accounted for, no matter how long the
        // (fire-and-forget) work below ends up taking.
        if (useFrameCallback) {
          vfcVideo.requestVideoFrameCallback!(onFrame);
        } else {
          requestAnimationFrame(() => onFrame(0));
        }

        const idx = frameCount++;
        pendingWrites.push(captureFrame(t, idx));
      };

      armStallTimer();
      if (useFrameCallback) {
        vfcVideo.requestVideoFrameCallback!(onFrame);
      } else {
        requestAnimationFrame(() => onFrame(0));
      }
      video.play().catch(fail);
    });

    await Promise.all(pendingWrites);

    if (frameCount === 0) {
      throw new Error("No frames were captured during export.");
    }

    onProgress?.("encoding", 0);
    // ffmpeg.wasm's progress event is known to report garbage values (huge
    // negative/positive numbers, particularly on the very first tick before it
    // has parsed enough encoder output to estimate a real ratio) — clamp to a
    // sane 0-1 fraction rather than passing that straight through to the UI.
    ffmpeg.on("progress", ({ progress }) => {
      const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
      onProgress?.("encoding", safeProgress);
    });

    // The real output framerate is however many frames actually got captured
    // over the clip's real duration, not a value assumed beforehand — this
    // keeps final duration/pacing correct regardless of any real-world
    // variance in exactly how many frames the decoder produced.
    const outputFps = frameCount / duration;

    // Nothing about this pipeline needs to touch the audio at all, so copy
    // the source's original audio bitstream byte-for-byte rather than
    // decoding and re-encoding it — that re-encode was a real, avoidable
    // quality loss the old MediaRecorder-based export couldn't skip (it had
    // to capture audio live), but this direct-ffmpeg approach can. Not every
    // source codec can be copied straight into an MP4 container (e.g. Opus
    // from a WebM upload), so fall back to re-encoding only if the copy
    // attempt itself fails.
    const buildArgs = (audioCodecArgs: string[]) => [
      "-framerate",
      outputFps.toFixed(3),
      "-i",
      "frame%06d.png",
      "-i",
      "source.input",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0?", // "?" — some source clips may have no audio track at all
      "-c:v",
      "libx264",
      // ffmpeg.wasm's single-threaded WASM x264 encoder is drastically slower
      // than native ffmpeg — "medium" made this step slow enough to look
      // completely hung rather than just slow. "veryfast" plus a low CRF still
      // looks great, straight from lossless PNG source frames.
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      ...audioCodecArgs,
      "-shortest",
      "-movflags",
      "+faststart",
      "output.mp4",
    ];

    const copyExitCode = await ffmpeg.exec(buildArgs(["-c:a", "copy"]));
    if (copyExitCode !== 0) {
      await ffmpeg.deleteFile("output.mp4").catch(() => {});
      await ffmpeg.exec(buildArgs(["-c:a", "aac", "-b:a", "320k"]));
    }

    const data = await ffmpeg.readFile("output.mp4");
    return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
  } finally {
    video.muted = wasMuted;
    // Always clean ffmpeg's virtual FS, even on failure — otherwise a failed
    // or retried export leaves orphaned frame files behind for the rest of
    // the session (getFFmpeg() reuses one instance throughout).
    await ffmpeg.deleteFile("source.input").catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});
    for (let i = 0; i < frameCount; i++) {
      await ffmpeg.deleteFile(frameNameAt(i)).catch(() => {});
    }
  }
}

/**
 * Seeks and waits for the browser to actually land on the new frame. Setting
 * `currentTime` to the value it's already at (most commonly 0, right after
 * loading a project) does not reliably fire `seeked` in every browser, so a
 * naive "always await seeked" hangs forever in that case — this skips the
 * wait when we're already there, and times out instead of hanging forever if
 * `seeked` genuinely never arrives for some other reason. Only used once now,
 * to rewind to the start before capture begins.
 */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1 / 120) {
    video.currentTime = time;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const timeout = setTimeout(onSeeked, 2000);
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}
