import type {
  CaptionSegment,
  DepthMode,
  LayoutRegion,
  PersonMaskFrame,
  SegmentLayout,
  SubtitleTheme,
} from "@/types";
import { getMaskAtTime } from "./analyzeVideo";

interface RegionBox {
  region: LayoutRegion;
  x: number; // normalized center
  y: number;
  box: { x: number; y: number; w: number; h: number };
}

// Candidate placement zones, expressed as normalized frame rectangles.
// Deliberately excludes the dead-center of the frame, which is reserved
// for "behind/front person" placement rather than as its own safe region.
const REGIONS: RegionBox[] = [
  { region: "top", x: 0.5, y: 0.12, box: { x: 0.1, y: 0.04, w: 0.8, h: 0.16 } },
  { region: "top-left", x: 0.25, y: 0.12, box: { x: 0.05, y: 0.04, w: 0.4, h: 0.16 } },
  { region: "top-right", x: 0.75, y: 0.12, box: { x: 0.55, y: 0.04, w: 0.4, h: 0.16 } },
  { region: "center-left", x: 0.22, y: 0.5, box: { x: 0.04, y: 0.4, w: 0.36, h: 0.2 } },
  { region: "center-right", x: 0.78, y: 0.5, box: { x: 0.6, y: 0.4, w: 0.36, h: 0.2 } },
  { region: "bottom", x: 0.5, y: 0.85, box: { x: 0.1, y: 0.76, w: 0.8, h: 0.18 } },
  { region: "bottom-left", x: 0.25, y: 0.85, box: { x: 0.05, y: 0.76, w: 0.4, h: 0.18 } },
  { region: "bottom-right", x: 0.75, y: 0.85, box: { x: 0.55, y: 0.76, w: 0.4, h: 0.18 } },
];

const EMPTY_REGION_THRESHOLD = 0.12; // max acceptable person-overlap fraction to call a region "safe"

function rectOverlapFraction(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return 0;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = a.w * a.h;
  return aArea > 0 ? interArea / aArea : 0;
}

/**
 * Scores every candidate region for a segment's time span and picks the
 * best one, then decides whether the subtitle should sit in empty space,
 * in front of the person, or behind them. Also applies simple hysteresis
 * against the previous segment's placement so subtitles don't jitter.
 */
export function computeSegmentLayout(
  segment: CaptionSegment,
  masks: PersonMaskFrame[],
  theme: SubtitleTheme,
  previousLayout: SegmentLayout | null
): SegmentLayout {
  if (segment.manualOverride) {
    const region = segment.manualOverride.region ?? previousLayout?.region ?? "bottom";
    const found = REGIONS.find((r) => r.region === region) ?? REGIONS[5];
    return {
      region,
      x: segment.manualOverride.x ?? found.x,
      y: segment.manualOverride.y ?? found.y,
      depth: segment.manualOverride.depth ?? "normal",
    };
  }

  const mid = (segment.start + segment.end) / 2;
  const samples = [segment.start, mid, segment.end].map((t) => getMaskAtTime(masks, t));
  const validSamples = samples.filter((s): s is PersonMaskFrame => s !== null && s.trackConfidence > 0);

  // No person detected at all in this window: center-bottom is the safe, readable default.
  if (validSamples.length === 0) {
    return { region: "bottom", x: 0.5, y: 0.85, depth: "normal" };
  }

  const avgBox = averageBoxes(validSamples.map((s) => s.bbox));
  const avgFace = averageBoxes(
    validSamples.filter((s) => s.faceBbox).map((s) => s.faceBbox!)
  );

  const scored = REGIONS.map((r) => {
    const bodyOverlap = rectOverlapFraction(r.box, avgBox);
    const faceOverlap = avgFace ? rectOverlapFraction(r.box, avgFace) : 0;
    // Face overlap is penalized far more heavily: we basically never want to
    // sit a caption on top of the speaker's face unless forced to.
    const score = bodyOverlap + faceOverlap * 5;
    return { ...r, bodyOverlap, faceOverlap, score };
  });

  // Prefer sticking with the previous region if it's still reasonably clear —
  // avoids the subtitle hopping around every couple hundred milliseconds.
  if (previousLayout) {
    const prev = scored.find((r) => r.region === previousLayout.region);
    if (prev && prev.bodyOverlap <= EMPTY_REGION_THRESHOLD * 1.5 && prev.faceOverlap === 0) {
      return { region: prev.region, x: prev.x, y: prev.y, depth: "normal" };
    }
  }

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];

  if (best.bodyOverlap <= EMPTY_REGION_THRESHOLD && best.faceOverlap === 0) {
    return { region: best.region, x: best.x, y: best.y, depth: "normal" };
  }

  // No clear empty region (person fills most of the frame, e.g. a close-up):
  // fall back to crossing the body. Theme decides whether that means
  // "behind" (text passes under the person, more cinematic) or "front"
  // (max readability). Both still avoid the face region itself.
  const depth: DepthMode =
    theme.depthMode === "auto" ? "behind_person" : (theme.depthMode as DepthMode);

  return { region: best.region, x: best.x, y: best.y, depth };
}

function averageBoxes(
  boxes: { x: number; y: number; w: number; h: number }[]
): { x: number; y: number; w: number; h: number } {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const sum = boxes.reduce(
    (acc, b) => ({ x: acc.x + b.x, y: acc.y + b.y, w: acc.w + b.w, h: acc.h + b.h }),
    { x: 0, y: 0, w: 0, h: 0 }
  );
  return {
    x: sum.x / boxes.length,
    y: sum.y / boxes.length,
    w: sum.w / boxes.length,
    h: sum.h / boxes.length,
  };
}

/** Runs computeSegmentLayout across an entire caption list, threading hysteresis state through. */
export function computeAllLayouts(
  segments: CaptionSegment[],
  masks: PersonMaskFrame[],
  theme: SubtitleTheme
): CaptionSegment[] {
  let previous: SegmentLayout | null = null;
  return segments.map((seg) => {
    const layout = computeSegmentLayout(seg, masks, theme, previous);
    previous = layout;
    return { ...seg, layout };
  });
}
