import { segmentFrame, resetSegmenter } from "@/lib/segmentation/personSegmenter";
import type { PersonMaskFrame } from "@/types";

export interface AnalyzeVideoOptions {
  /** Seconds between segmentation keyframes. Lower = smoother but more CPU/GPU work. */
  sampleIntervalSec: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: AnalyzeVideoOptions = {
  // Shorter than before (was 0.12s): less motion happens between two
  // keyframes, so the alpha-lerp interpolation in getMaskAtTime blends two
  // more similar silhouettes instead of smearing a bigger gap.
  sampleIntervalSec: 0.08,
};

/**
 * Keyframe-based person segmentation pass: samples the video at a fixed,
 * sparse interval (instead of every decoded frame) and lets the renderer
 * interpolate between samples. This is the "temporal tracking" stage —
 * for the MVP it's a fixed-rate sampler; swap in confidence-triggered
 * re-segmentation later without touching callers.
 */
export async function analyzeVideoForPersonMasks(
  video: HTMLVideoElement,
  durationSec: number,
  options: Partial<AnalyzeVideoOptions> = {}
): Promise<PersonMaskFrame[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const masks: PersonMaskFrame[] = [];
  const wasPaused = video.paused;
  video.pause();

  // Each analysis run restarts its own timestamp clock at t=0, but a
  // segmenter left over from a previous video's run has already seen much
  // larger timestamps — resetting here keeps this run's frames valid no
  // matter what ran before it.
  await resetSegmenter();

  const totalSteps = Math.max(1, Math.ceil(durationSec / opts.sampleIntervalSec));

  for (let step = 0; step <= totalSteps; step++) {
    if (opts.signal?.aborted) break;
    const t = Math.min(step * opts.sampleIntervalSec, durationSec - 0.001);
    await seekTo(video, t);

    const mask = await segmentFrame(video, Math.round(t * 1000));
    if (mask) masks.push(mask);

    opts.onProgress?.(step / totalSteps);
  }

  if (!wasPaused) video.play().catch(() => {});
  return masks;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Returns the person mask for a given playback time, alpha-blending between
 * the two nearest keyframes so the occlusion edge doesn't visibly "pop" at
 * the sample rate used during analysis.
 */
export function getMaskAtTime(
  masks: PersonMaskFrame[],
  time: number
): PersonMaskFrame | null {
  if (masks.length === 0) return null;
  if (time <= masks[0].time) return masks[0];
  if (time >= masks[masks.length - 1].time) return masks[masks.length - 1];

  // Masks are produced in time order during analysis; binary search the pair.
  let lo = 0;
  let hi = masks.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (masks[mid].time <= time) lo = mid;
    else hi = mid;
  }

  const a = masks[lo];
  const b = masks[hi];
  if (a.width !== b.width || a.height !== b.height || b.time === a.time) return a;

  const t = (time - a.time) / (b.time - a.time);
  const data = new Uint8ClampedArray(a.data.length);
  for (let i = 0; i < data.length; i++) {
    data[i] = a.data[i] + (b.data[i] - a.data[i]) * t;
  }

  return {
    time,
    width: a.width,
    height: a.height,
    data,
    bbox: lerpBbox(a.bbox, b.bbox, t),
    faceBbox: a.faceBbox && b.faceBbox ? lerpBbox(a.faceBbox, b.faceBbox, t) : a.faceBbox,
    trackConfidence: a.trackConfidence + (b.trackConfidence - a.trackConfidence) * t,
  };
}

function lerpBbox(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  t: number
) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}
