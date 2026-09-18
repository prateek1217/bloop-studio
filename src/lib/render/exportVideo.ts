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
 * Records the depth-aware composite (video + masked person + subtitle) in
 * real time via canvas.captureStream() + MediaRecorder — the compositing
 * itself is cheap 2D canvas work, so this stays light on the browser even
 * though it plays the clip back at 1x speed. ffmpeg.wasm is only used for
 * the final remux/transcode from the recorder's WebM to a shareable MP4.
 */
export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { video, words, captions, masks, theme, width, height, fps = 30, durationHint, onProgress } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const compositor = new Compositor();

  const canvasStream = (canvas as HTMLCanvasElement).captureStream(fps);

  type MediaElementWithCapture = HTMLVideoElement & { captureStream?: () => MediaStream };
  const mediaEl = video as MediaElementWithCapture;
  const sourceStream = mediaEl.captureStream ? mediaEl.captureStream() : null;
  const audioTrack = sourceStream?.getAudioTracks()[0];

  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioTrack ? [audioTrack] : []),
  ]);

  const mimeType = pickSupportedMimeType();
  // High capture bitrate matters here: this recording is a lossy intermediate
  // that the ffmpeg pass below re-encodes from, so any detail lost at this
  // stage (MediaRecorder's browser-default bitrate is a low, resolution-
  // agnostic ~2.5Mbps) can never be recovered later, however low the final CRF.
  const videoBitsPerSecond = Math.min(60_000_000, Math.max(8_000_000, Math.round(width * height * fps * 0.15)));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(combined, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond,
      audioBitsPerSecond: 256_000,
    });
  } catch {
    // Fall back to browser defaults if the explicit bitrate options themselves
    // aren't accepted, rather than failing the export over a quality knob.
    recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint;
  if (!duration) {
    throw new Error("Could not determine video duration for export.");
  }

  // Some browsers (notably Safari) only honor an unmuted video.play() when it
  // happens synchronously within the click that triggered it — the seek below
  // is async, so by the time we'd call play() afterward the gesture may have
  // expired and play() rejects with a DOMException. Spend the gesture here,
  // immediately, then pause; sticky activation from this first play() is what
  // lets the later play() (after the async seek) succeed.
  try {
    await video.play();
    video.pause();
  } catch {
    // If even this fails, the real play() call below will throw the same
    // error and it'll surface to the caller there instead.
  }

  await seekTo(video, 0);

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
  });

  // requestAnimationFrame is throttled or fully paused in a backgrounded/
  // minimized tab, which would freeze this render loop — and with it, the
  // recorded video — mid-export while audio and elapsed time keep going.
  // requestVideoFrameCallback is driven by actual video frame decode, not
  // page rendering, so it keeps firing regardless of tab visibility; fall
  // back to rAF only where it isn't supported (e.g. older Firefox/Safari).
  type VideoFrameCallbackElement = HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };
  const vfcVideo = video as VideoFrameCallbackElement;
  const useFrameCallback = typeof vfcVideo.requestVideoFrameCallback === "function";

  let scheduledHandle = 0;
  const scheduleNextTick = () => {
    scheduledHandle = useFrameCallback
      ? vfcVideo.requestVideoFrameCallback!(renderTick)
      : requestAnimationFrame(renderTick);
  };
  const cancelScheduledTick = () => {
    if (useFrameCallback) vfcVideo.cancelVideoFrameCallback?.(scheduledHandle);
    else cancelAnimationFrame(scheduledHandle);
  };

  // Stopping must not depend on the draw loop being called one more time:
  // requestVideoFrameCallback only fires for an actually-decoded new frame,
  // and there is no "next" frame once playback reaches the end — so the old
  // "check t < duration inside the callback, else stop()" logic could just
  // never run its stop branch, leaving the recorder (and the UI) stuck at
  // whatever percentage the last real callback reported. `ended` fires
  // independently of that, and the timeout is a hard backstop in case some
  // browser/codec combination doesn't fire `ended` either.
  let stopped = false;
  const stopRecording = () => {
    if (stopped) return;
    stopped = true;
    cancelScheduledTick();
    clearTimeout(fallbackTimer);
    video.removeEventListener("ended", stopRecording);
    if (recorder.state !== "inactive") recorder.stop();
  };
  const fallbackTimer = setTimeout(stopRecording, (duration + 3) * 1000);
  video.addEventListener("ended", stopRecording);

  const renderTick = () => {
    const t = video.currentTime;
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

    onProgress?.("recording", Math.min(t / duration, 1));

    if (!stopped && t < duration && !video.ended) {
      scheduleNextTick();
    } else {
      stopRecording();
    }
  };

  recorder.start(250);
  await video.play();
  scheduleNextTick();

  const webmBlob = await recordingDone;
  video.pause();

  onProgress?.("encoding", 0);
  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));

  // ffmpeg.wasm's progress event is known to report garbage values (huge
  // negative/positive numbers, particularly on the very first tick before it
  // has parsed enough encoder output to estimate a real ratio) — clamp to a
  // sane 0-1 fraction rather than passing that straight through to the UI.
  ffmpeg.on("progress", ({ progress }) => {
    const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    onProgress?.("encoding", safeProgress);
  });
  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-c:v",
    "libx264",
    // ffmpeg.wasm's single-threaded WASM x264 encoder is drastically slower
    // than native ffmpeg — "medium" made this step slow enough to look
    // completely hung rather than just slow. "veryfast" plus a low CRF still
    // looks great (the recording pass above already feeds it a high-bitrate
    // source), and actually finishes.
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
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);

  const data = await ffmpeg.readFile("output.mp4");
  await ffmpeg.deleteFile("input.webm");
  await ffmpeg.deleteFile("output.mp4");

  return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
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

function pickSupportedMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}
