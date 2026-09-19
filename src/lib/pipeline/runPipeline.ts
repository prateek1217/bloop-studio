import { v4 as uuid } from "uuid";
import type { Project, ProcessingStage, SubtitleLanguage, Word } from "@/types";
import { decodeAudioToPCM, encodeWav } from "@/lib/audio/extractAudio";
import { compressWavToAac } from "@/lib/audio/compressAudio";
import { computeWaveformPeaks } from "@/lib/audio/waveform";
import { segmentCaptions } from "./segmentCaptions";
import { computeWordEmphasis } from "./wordEmphasis";
import { analyzeVideoForPersonMasks } from "./analyzeVideo";
import { computeAllLayouts } from "./autoLayout";
import { getTheme } from "@/lib/themes/themes";
import { saveProject, saveVideoBlob } from "@/lib/db/projectStore";

export interface PipelineCallbacks {
  onStage: (stage: ProcessingStage) => void;
  onProgress: (fraction: number) => void;
}

const DEFAULT_THEME_ID = "bold";

/**
 * Drives the full client-side pipeline: upload -> audio extraction ->
 * transcription -> caption segmentation -> person segmentation -> layout.
 * Each stage's output is attached to the Project and persisted, so a failure
 * partway through never loses prior stages' work.
 */
export async function runProcessingPipeline(
  videoFile: File,
  name: string,
  callbacks: PipelineCallbacks,
  language: SubtitleLanguage = "en"
): Promise<string> {
  const { onStage, onProgress } = callbacks;
  const id = uuid();

  onStage("uploaded");
  const metadata = await readVideoMetadata(videoFile);

  let project: Project = {
    meta: {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      durationSec: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      stage: "uploaded",
      language,
    },
    transcript: null,
    captions: [],
    themeId: DEFAULT_THEME_ID,
    personMasks: [],
  };

  await saveVideoBlob(id, videoFile);
  await saveProject(project);

  try {
    onStage("extracting_audio");
    onProgress(0);
    const { samples, sampleRate } = await decodeAudioToPCM(videoFile);
    const wav = encodeWav(samples, sampleRate);
    project = { ...project, waveformPeaks: computeWaveformPeaks(samples) };
    await saveProject(project);

    onStage("transcribing");
    // Vercel caps request bodies at 4.5MB; raw WAV runs ~32KB/sec, so leave
    // headroom and only pay for ffmpeg.wasm's ~30MB download on the clips
    // that actually need shrinking (short clips upload the plain WAV as-is).
    const SAFE_UPLOAD_BYTES = 3.5 * 1024 * 1024;
    const needsCompression = wav.size > SAFE_UPLOAD_BYTES;
    const audioBlob = needsCompression ? await compressWavToAac(wav) : wav;
    const audioFilename = needsCompression ? "audio.m4a" : "audio.wav";

    const form = new FormData();
    form.append("audio", audioBlob, audioFilename);
    // "hi-en" (Hinglish) transcribes in Hindi first, then transliterates below.
    form.append("language", language === "en" ? "en" : "hi");
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Transcription failed" }));
      throw new Error(body.error ?? `Transcription failed (${res.status})`);
    }
    const { transcript } = await res.json();
    let words: Word[] = transcript.words;

    if (language === "hi-en") {
      onStage("transliterating");
      const tRes = await fetch("/api/transliterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: words.map((w) => w.text) }),
      });
      if (!tRes.ok) {
        const body = await tRes.json().catch(() => ({ error: "Transliteration failed" }));
        throw new Error(body.error ?? `Transliteration failed (${tRes.status})`);
      }
      const { words: hinglishWords } = await tRes.json();
      // Word-for-word replacement only — start/end timestamps came from the
      // Hindi transcription above and stay exactly as they were.
      words = words.map((w, i) => ({ ...w, text: hinglishWords[i] ?? w.text }));
    }

    // Score each word's visual emphasis (loudness + textual cues) from the
    // audio we already decoded, so themes can size louder/content-heavy
    // words bigger instead of a flat size for the whole line.
    const wordsWithEmphasis = computeWordEmphasis(words, samples, sampleRate);
    project = { ...project, transcript: { ...transcript, words: wordsWithEmphasis } };
    await saveProject(project);

    onStage("segmenting");
    const captions = segmentCaptions(wordsWithEmphasis);
    project = { ...project, captions };
    await saveProject(project);

    onStage("analyzing_video");
    const video = await createOffscreenVideo(videoFile);
    const thumbnailDataUrl = await captureVideoThumbnail(video);
    if (thumbnailDataUrl) {
      project = { ...project, meta: { ...project.meta, thumbnailDataUrl } };
      await saveProject(project);
    }
    const masks = await analyzeVideoForPersonMasks(video, metadata.duration, {
      onProgress,
    });
    project = { ...project, personMasks: masks };
    await saveProject(project);
    cleanupVideo(video);

    onStage("generating_layout");
    const theme = getTheme(project.themeId);
    const laidOutCaptions = computeAllLayouts(project.captions, masks, theme);
    project = { ...project, captions: laidOutCaptions };

    project = { ...project, meta: { ...project.meta, stage: "ready", updatedAt: Date.now() } };
    await saveProject(project);

    return id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    project = { ...project, meta: { ...project.meta, stage: "failed", error: message } };
    await saveProject(project);
    throw err;
  }
}

function readVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = async () => {
      const { duration, videoWidth: width, videoHeight: height } = video;
      const fps = await detectFps(video);
      URL.revokeObjectURL(video.src);
      resolve({ duration, width, height, fps });
    };
    video.onerror = () => reject(new Error("Could not read video metadata"));
  });
}

/** There's no direct "give me this video's fps" browser API, so this plays
 * a few frames muted and measures the real gap between their presentation
 * timestamps via requestVideoFrameCallback — the same API exportVideo.ts
 * already relies on. Getting this right matters: exporting at a fixed 30fps
 * regardless of the source's real rate is exactly what causes visible
 * judder on a 24/25/60fps upload. Falls back to 30 if rVFC isn't supported
 * (old Firefox/Safari) or playback doesn't cooperate. */
function detectFps(video: HTMLVideoElement): Promise<number> {
  const FALLBACK_FPS = 30;
  const SAMPLE_COUNT = 12;

  type VideoFrameMetadata = { mediaTime: number };
  type VFCVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameMetadata) => void) => number;
  };
  const vfcVideo = video as VFCVideo;
  if (typeof vfcVideo.requestVideoFrameCallback !== "function") {
    return Promise.resolve(FALLBACK_FPS);
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (fps: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.pause();
      resolve(fps);
    };
    // Backstop in case `play()` resolves but rVFC never actually fires (e.g.
    // a browser quirk with a detached, never-appended-to-DOM video element) —
    // without this, a single bad case here would hang the whole upload.
    const timeout = setTimeout(() => settle(FALLBACK_FPS), 1500);

    const mediaTimes: number[] = [];
    function onFrame(_now: number, meta: VideoFrameMetadata) {
      mediaTimes.push(meta.mediaTime);
      if (mediaTimes.length < SAMPLE_COUNT) {
        vfcVideo.requestVideoFrameCallback!(onFrame);
        return;
      }
      const deltas: number[] = [];
      for (let i = 1; i < mediaTimes.length; i++) deltas.push(mediaTimes[i] - mediaTimes[i - 1]);
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      settle(avgDelta > 0 ? snapToCommonFps(1 / avgDelta) : FALLBACK_FPS);
    }

    video
      .play()
      .then(() => vfcVideo.requestVideoFrameCallback!(onFrame))
      .catch(() => settle(FALLBACK_FPS));
  });
}

/** Real recording frame rates cluster around a handful of standard values;
 * snapping to the nearest one avoids storing/exporting at a noisy measured
 * value like "29.83" from timing jitter in the few samples above. */
function snapToCommonFps(raw: number): number {
  const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  return COMMON_FPS.reduce((best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best), COMMON_FPS[0]);
}

async function createOffscreenVideo(file: File): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load video for analysis"));
  });
  return video;
}

function cleanupVideo(video: HTMLVideoElement) {
  URL.revokeObjectURL(video.src);
  video.src = "";
}

/** Grabs a small preview frame for the dashboard card. Seeks slightly past
 * t=0 rather than using the frame already decoded on load, since the very
 * first frame is often a black fade-in on talking-head clips. */
async function captureVideoThumbnail(video: HTMLVideoElement, targetWidth = 480): Promise<string | undefined> {
  try {
    const seekTime = Math.min(0.15, (video.duration || 0) / 4);
    if (Number.isFinite(seekTime) && seekTime > 0 && video.currentTime !== seekTime) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = seekTime;
      });
    }

    if (!video.videoWidth || !video.videoHeight) return undefined;
    const scale = targetWidth / video.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}
