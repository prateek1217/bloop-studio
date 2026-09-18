import type { CaptionSegment, PersonMaskFrame, SubtitleTheme, Word } from "@/types";
import { drawSubtitleSegment, type SubtitleBox } from "@/lib/themes/renderSubtitle";

/**
 * Depth-aware frame compositor. Layer order per depth mode:
 *
 *   normal / front:  background+person (video frame) -> subtitle
 *   behind_person:   background+person (video frame) -> subtitle -> person cutout (masked)
 *
 * Redrawing the person cutout on top for "behind_person" is what makes the
 * body naturally occlude the part of the subtitle it overlaps, using the
 * confidence mask's own alpha for a soft, anti-aliased edge.
 */
export class Compositor {
  private maskCanvas: HTMLCanvasElement;
  private personCanvas: HTMLCanvasElement;

  constructor() {
    this.maskCanvas = document.createElement("canvas");
    this.personCanvas = document.createElement("canvas");
  }

  drawFrame(params: {
    ctx: CanvasRenderingContext2D;
    video: HTMLVideoElement;
    canvasWidth: number;
    canvasHeight: number;
    segment: CaptionSegment | null;
    segmentWords: Word[];
    currentTime: number;
    theme: SubtitleTheme;
    mask: PersonMaskFrame | null;
  }): SubtitleBox | null {
    const { ctx, video, canvasWidth, canvasHeight, segment, segmentWords, currentTime, theme, mask } = params;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

    const depth = segment?.layout?.depth ?? "normal";
    let box: SubtitleBox | null = null;

    if (segment) {
      if (depth === "behind_person") {
        box = drawSubtitleSegment({ ctx, canvasWidth, canvasHeight, segment, words: segmentWords, currentTime, theme });
        if (mask && mask.trackConfidence > 0.05) {
          this.drawPersonCutout(ctx, video, mask, canvasWidth, canvasHeight);
        }
      } else {
        // "front" and "normal" both render subtitle on top of the (already occlusion-free) frame.
        box = drawSubtitleSegment({ ctx, canvasWidth, canvasHeight, segment, words: segmentWords, currentTime, theme });
      }
    }

    return box;
  }

  private drawPersonCutout(
    mainCtx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: PersonMaskFrame,
    canvasWidth: number,
    canvasHeight: number
  ) {
    if (this.maskCanvas.width !== mask.width || this.maskCanvas.height !== mask.height) {
      this.maskCanvas.width = mask.width;
      this.maskCanvas.height = mask.height;
    }
    const maskCtx = this.maskCanvas.getContext("2d")!;
    const imageData = maskCtx.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) {
      imageData.data[i * 4 + 0] = 255;
      imageData.data[i * 4 + 1] = 255;
      imageData.data[i * 4 + 2] = 255;
      imageData.data[i * 4 + 3] = mask.data[i];
    }
    maskCtx.putImageData(imageData, 0, 0);

    if (this.personCanvas.width !== canvasWidth || this.personCanvas.height !== canvasHeight) {
      this.personCanvas.width = canvasWidth;
      this.personCanvas.height = canvasHeight;
    }
    const personCtx = this.personCanvas.getContext("2d")!;
    personCtx.globalCompositeOperation = "source-over";
    personCtx.imageSmoothingEnabled = true;
    personCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    personCtx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    personCtx.globalCompositeOperation = "destination-in";
    personCtx.drawImage(this.maskCanvas, 0, 0, mask.width, mask.height, 0, 0, canvasWidth, canvasHeight);
    personCtx.globalCompositeOperation = "source-over";

    mainCtx.drawImage(this.personCanvas, 0, 0);
  }
}

export function findActiveSegment(segments: CaptionSegment[], time: number): CaptionSegment | null {
  return segments.find((s) => time >= s.start && time <= s.end) ?? null;
}
