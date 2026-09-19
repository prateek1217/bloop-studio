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
  fps?: number;
  /** Known-good duration (e.g. project.meta.durationSec) to fall back on when
   * video.duration is unreliable (NaN/Infinity) for the source container. */
  durationHint?: number;
  onProgress?: (phase: "recording" | "encoding", fraction: number) => void;
}

/**
 * Frame-exact offline renderer: seeks the source video to each output frame's
 * exact timestamp, draws the depth-aware composite (video + masked person +
 * subtitle) to a canvas, and writes that frame as a PNG straight into
 * ffmpeg.wasm's virtual filesystem. ffmpeg then muxes the PNG sequence with
 * the source's own audio track into the final MP4 in one pass.
 *
 * This replaces the previous real-time `canvas.captureStream()` +
 * MediaRecorder approach, which took exactly as long as the clip's own
 * duration (a 60s clip took ~60s) regardless of how fast the machine could
 * actually render — this version's speed is bounded by seek+draw+encode
 * time instead, and it sidesteps MediaRecorder's inconsistent browser
 * support (notably Safari) entirely, since nothing here depends on it.
 */
export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { video, words, captions, masks, theme, width, height, fps = 30, durationHint, onProgress } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const compositor = new Compositor();

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint;
  if (!duration) {
    throw new Error("Could not determine video duration for export.");
  }

  const sourceUrl = video.currentSrc || video.src;
  if (!sourceUrl) {
    throw new Error("Video has no source to read audio from.");
  }

  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile("source.input", await fetchFile(sourceUrl));

  const wasPlaying = !video.paused;
  video.pause();

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameNameAt = (i: number) => `frame${String(i).padStart(6, "0")}.png`;

  try {
    for (let i = 0; i < totalFrames; i++) {
      // Clamp just under `duration`, not to it — seeking exactly to the end
      // timestamp of a clip is where browsers are most likely to just not
      // fire `seeked` at all (nothing to decode past), which is exactly the
      // hang seekTo's timeout below exists to survive, but landing a hair
      // short avoids hitting it every single export.
      const t = Math.min(i / fps, duration - 1 / fps / 2);
      await seekTo(video, t);

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

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
      });
      await ffmpeg.writeFile(frameNameAt(i), new Uint8Array(await blob.arrayBuffer()));

      onProgress?.("recording", (i + 1) / totalFrames);
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

    await ffmpeg.exec([
      "-framerate",
      String(fps),
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
      "-c:a",
      "aac",
      "-b:a",
      "256k",
      "-shortest",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);

    const data = await ffmpeg.readFile("output.mp4");
    return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
  } finally {
    // Always clean ffmpeg's virtual FS, even on failure — otherwise a failed
    // or retried export leaves thousands of orphaned frame files behind for
    // the rest of the session (getFFmpeg() reuses one instance throughout).
    await ffmpeg.deleteFile("source.input").catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});
    for (let i = 0; i < totalFrames; i++) {
      await ffmpeg.deleteFile(frameNameAt(i)).catch(() => {});
    }
    if (wasPlaying) video.play().catch(() => {});
  }
}

/**
 * Seeks and waits for the browser to actually land on the new frame. Setting
 * `currentTime` to the value it's already at (most commonly 0, right after
 * loading a project) does not reliably fire `seeked` in every browser, so a
 * naive "always await seeked" hangs the export forever in that case — this
 * skips the wait when we're already there, and times out instead of hanging
 * forever if `seeked` genuinely never arrives for some other reason.
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
