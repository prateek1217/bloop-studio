// Core domain types shared across the pipeline: transcript -> captions -> visual
// analysis -> layout -> style -> renderer. Keeping these in one place is what lets
// each stage stay decoupled (see ARCHITECTURE.md).

export interface Word {
  text: string;
  start: number; // seconds
  end: number; // seconds
  /** 0-1 visual emphasis score (loudness + textual cues), drives per-word size. */
  emphasis?: number;
}

export interface Transcript {
  words: Word[];
  language?: string;
}

/**
 * "hi-en" (Hinglish) transcribes in Hindi first, then transliterates each
 * word into Roman-script Hinglish — word-for-word, not translated, so the
 * original word timestamps stay valid. See src/lib/stt/transliterate.ts.
 */
export type SubtitleLanguage = "en" | "hi" | "hi-en";

export type DepthMode = "front" | "behind_person" | "normal";

export type LayoutRegion =
  | "top"
  | "top-left"
  | "top-right"
  | "center-left"
  | "center-right"
  | "bottom"
  | "bottom-left"
  | "bottom-right";

export interface SegmentLayout {
  region: LayoutRegion;
  /** Normalized 0-1 center position within the video frame, smoothed across time. */
  x: number;
  y: number;
  depth: DepthMode;
}

export interface CaptionSegment {
  id: string;
  /** Indices into the parent Transcript.words array — keeps word timing as the single source of truth. */
  wordStartIndex: number;
  wordEndIndex: number; // inclusive
  start: number;
  end: number;
  text: string;
  /** User or auto-computed layout. `null` until visual analysis / auto-layout has run. */
  layout: SegmentLayout | null;
  /** Per-segment font-size multiplier (1 = theme/global default). Independent of
   * the project-wide font-size override, which sets every segment at once. */
  sizeMultiplier?: number;
  /** Explicit user override — if set, auto-layout must not touch position/depth. */
  manualOverride?: {
    region?: LayoutRegion;
    depth?: DepthMode;
    x?: number;
    y?: number;
  };
}

/** A lightweight polygon/run-length-free representation of a person mask for one analyzed frame. */
export interface PersonMaskFrame {
  time: number; // seconds, presentation timestamp of the analyzed frame
  /** Low-res alpha mask (values 0-255), stored as ImageData-compatible bytes. */
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Normalized bounding box of the person(s) in this frame, 0-1. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Normalized face bbox if a face region was estimated (upper ~1/4 of person bbox heuristic or model-provided). */
  faceBbox?: { x: number; y: number; w: number; h: number };
  trackConfidence: number; // 0-1, drives keyframe vs interpolation decisions
}

export type WordAnimation =
  | "none"
  | "pop"
  | "scale"
  | "fade"
  | "slide"
  | "highlight"
  | "bounce"
  | "typewriter"
  | "glitch"
  | "wave";

export interface SubtitleTheme {
  id: string;
  name: string;
  font: string;
  fontSize: number; // px at 1080-height reference, scaled to actual video
  fontWeight: number;
  textColor: string;
  highlightColor: string;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  background?: { color: string; padding: number; radius: number } | null;
  animation: WordAnimation;
  wordHighlight: boolean;
  /** Scales each word's font size by its emphasis score instead of a flat size for the whole line. */
  dynamicWordSize: boolean;
  uppercase: boolean;
  /** Default depth/positioning behavior; per-segment layout can still override. */
  depthMode: DepthMode | "auto";
  positionStrategy: "auto" | "fixed-bottom" | "fixed-top" | "fixed-center";
  letterSpacing?: number;
  /** Cycles every word through these colors by position, overriding textColor/highlightColor entirely. */
  palette?: string[];
  /** Fills each word with a left-to-right linear gradient instead of a solid color. */
  textGradient?: [string, string];
  /** Renders the whole segment in italic (slanted) style. */
  italic?: boolean;
  /** Arranges words as an overlapping, rotated collage burst around the anchor
   * point instead of left-to-right lines (e.g. a "trending fonts" word-cloud look). */
  scatter?: boolean;
  /** Aligns multi-line text: "left" shares one left edge, "stairs" indents each
   * successive line further right for a cascading diagonal look, "center" (default)
   * centers each line independently. */
  align?: "left" | "center" | "stairs";
  /** Colors each word by its emphasis score (highlightColor above threshold, else textColor)
   * instead of by which word is currently being spoken — a static "keyword pop" look. */
  colorByEmphasis?: boolean;
}

export type ProcessingStage =
  | "uploaded"
  | "queued"
  | "extracting_audio"
  | "transcribing"
  | "transliterating"
  | "segmenting"
  | "analyzing_video"
  | "generating_layout"
  | "ready"
  | "rendering"
  | "completed"
  | "failed";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  stage: ProcessingStage;
  error?: string;
  /** Which language pipeline produced this project's transcript. Optional for projects saved before this existed. */
  language?: SubtitleLanguage;
  /** Small JPEG data URL captured from an early frame of the source video, used as the dashboard card preview. Optional for projects saved before this existed. */
  thumbnailDataUrl?: string;
}

export interface Project {
  meta: ProjectMeta;
  transcript: Transcript | null;
  captions: CaptionSegment[];
  themeId: string;
  customTheme?: Partial<SubtitleTheme>;
  /** Sparse, time-indexed person masks produced by keyframe segmentation + tracking. */
  personMasks: PersonMaskFrame[];
  /** Downsampled peak amplitudes (0-1) for the timeline waveform. One-time, cheap to store. */
  waveformPeaks?: number[];
}
