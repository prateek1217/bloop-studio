import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import type { PersonMaskFrame } from "@/types";

// Keeping the mask buffer small is what keeps this "lightweight": we never run
// segmentation at video resolution. 256px wide is still far below source
// resolution (cheap to upscale with the GPU at draw time) but noticeably
// sharper than a lower width, especially around limbs/hair at the edges.
const MASK_WIDTH = 256;

// Raw confidence values near the 0.5 boundary render as visibly translucent
// once upscaled. Push values away from the midpoint before storing, which
// sharpens the silhouette edge while still leaving a soft anti-aliased ramp
// right at the true boundary (not a hard cutoff).
const EDGE_CONTRAST = 2.2;

function sharpenAlpha(a: number): number {
  const sharpened = (a - 0.5) * EDGE_CONTRAST + 0.5;
  return Math.min(1, Math.max(0, sharpened));
}

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function createSegmenter(): Promise<ImageSegmenter> {
  return FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  );
}

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter();
  }
  return segmenterPromise;
}

/**
 * Closes the current segmenter (if any) so the next `segmentFrame` call
 * creates a fresh one. MediaPipe's "VIDEO" running mode requires strictly
 * increasing timestamps for the lifetime of one segmenter instance, but each
 * video's analysis pass restarts its own clock at t=0 (see analyzeVideo.ts)
 * — so a segmenter left over from a previous video makes the new video's
 * first frame look like a timestamp going backward, which MediaPipe rejects
 * with "Packet timestamp mismatch". Call this before analyzing a new video.
 */
export async function resetSegmenter(): Promise<void> {
  const existing = segmenterPromise;
  segmenterPromise = null;
  if (!existing) return;
  try {
    (await existing).close();
  } catch {
    // Never finished initializing (or already closed) — nothing to clean up.
  }
}

/**
 * Runs MediaPipe's Selfie Segmentation model on a single video frame and
 * returns a downsampled alpha mask + derived bbox. Designed to be called
 * sparsely (see keyframeSegmentation.ts) rather than on every frame.
 */
export async function segmentFrame(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<PersonMaskFrame | null> {
  const segmenter = await getSegmenter();
  const result: ImageSegmenterResult = segmenter.segmentForVideo(video, timestampMs);

  const confidenceMask = result.confidenceMasks?.[0];
  if (!confidenceMask) {
    result.close();
    return null;
  }

  const srcW = confidenceMask.width;
  const srcH = confidenceMask.height;
  const srcData = confidenceMask.getAsFloat32Array();

  const maskH = Math.round((MASK_WIDTH * srcH) / srcW);
  const downsampled = new Uint8ClampedArray(MASK_WIDTH * maskH);

  let minX = srcW,
    minY = srcH,
    maxX = 0,
    maxY = 0;
  let foundAny = false;

  for (let y = 0; y < maskH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor((y / maskH) * srcH));
    for (let x = 0; x < MASK_WIDTH; x++) {
      const srcX = Math.min(srcW - 1, Math.floor((x / MASK_WIDTH) * srcW));
      const alpha = srcData[srcY * srcW + srcX];
      const byte = Math.round(sharpenAlpha(alpha) * 255);
      downsampled[y * MASK_WIDTH + x] = byte;

      if (alpha > 0.5) {
        foundAny = true;
        if (srcX < minX) minX = srcX;
        if (srcX > maxX) maxX = srcX;
        if (srcY < minY) minY = srcY;
        if (srcY > maxY) maxY = srcY;
      }
    }
  }

  result.close();

  if (!foundAny) {
    return {
      time: timestampMs / 1000,
      width: MASK_WIDTH,
      height: maskH,
      data: downsampled,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      trackConfidence: 0,
    };
  }

  const bbox = {
    x: minX / srcW,
    y: minY / srcH,
    w: (maxX - minX) / srcW,
    h: (maxY - minY) / srcH,
  };

  // Heuristic: face sits in the top ~28% of the person's bounding box, centered.
  const faceBbox = {
    x: bbox.x + bbox.w * 0.2,
    y: bbox.y,
    w: bbox.w * 0.6,
    h: bbox.h * 0.28,
  };

  return {
    time: timestampMs / 1000,
    width: MASK_WIDTH,
    height: maskH,
    data: downsampled,
    bbox,
    faceBbox,
    trackConfidence: 1,
  };
}

export function disposeSegmenter() {
  if (segmenterPromise) {
    segmenterPromise.then((s) => s.close()).catch(() => {});
    segmenterPromise = null;
  }
}
