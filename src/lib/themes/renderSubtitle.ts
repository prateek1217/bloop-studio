import type { CaptionSegment, SubtitleTheme, Word } from "@/types";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  segment: CaptionSegment;
  words: Word[]; // exactly segment.wordEndIndex - wordStartIndex + 1 words, in order
  currentTime: number;
  theme: SubtitleTheme;
}

export interface SubtitleBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Token {
  text: string;
  word: Word;
  line: number;
  fontSize: number; // px, already includes emphasis scaling when theme.dynamicWordSize is on
  sizeRatio: number; // fontSize / theme's base font size, used to scale stroke/shadow proportionally
  globalIndex: number; // position among all words in this segment, used for palette cycling
}

const EASE_OUT_BACK = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Emphasis 0-1 maps to this font-size multiplier range when a theme opts in
// via dynamicWordSize — an unemphasized filler word shrinks a bit, a loud/
// content-heavy word grows, instead of every word being the same size.
const MIN_SIZE_MULTIPLIER = 0.82;
const MAX_SIZE_MULTIPLIER = 1.37;

// Emphasis 0-1 at or above this, when a theme opts in via colorByEmphasis,
// paints the word with highlightColor instead of textColor — independent of
// which word is currently being spoken (a static "keyword pop" look).
const EMPHASIS_COLOR_THRESHOLD = 0.6;

/**
 * Draws one caption segment onto a 2D canvas for the given playback time.
 * Pure with respect to theme + segment data — this is the single rendering
 * engine every theme flows through (see THEMES in themes.ts).
 */
export function drawSubtitleSegment({
  ctx,
  canvasWidth,
  canvasHeight,
  segment,
  words,
  currentTime,
  theme,
}: RenderContext): SubtitleBox | null {
  if (currentTime < segment.start || currentTime > segment.end) return null;
  const layout = segment.layout ?? { region: "bottom", x: 0.5, y: 0.85, depth: "normal" as const };

  const scale = canvasHeight / 1080;
  const baseFontSize = theme.fontSize * scale * (segment.sizeMultiplier ?? 1);
  const familyName = fontFamilyFromCssVar(theme.font);

  const lines = segment.text.split("\n");
  const tokens: Token[] = [];
  let wordCursor = 0;
  lines.forEach((line, lineIdx) => {
    for (const raw of line.split(" ")) {
      if (!raw) continue;
      const word = words[wordCursor];
      if (!word) continue;
      const sizeRatio = theme.dynamicWordSize ? sizeMultiplierFor(word.emphasis) : 1;
      tokens.push({
        text: theme.uppercase ? raw.toUpperCase() : raw,
        word,
        line: lineIdx,
        fontSize: baseFontSize * sizeRatio,
        sizeRatio,
        globalIndex: wordCursor,
      });
      wordCursor++;
    }
  });

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const fontStyle = theme.italic ? "italic " : "";
  ctx.font = `${fontStyle}${theme.fontWeight} ${baseFontSize}px ${familyName}`;
  const spaceWidthRatio = ctx.measureText(" ").width / baseFontSize;

  const lineWidths: number[] = [];
  const lineHeights: number[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineTokens = tokens.filter((t) => t.line === lineIdx);
    let width = 0;
    let maxFontSize = baseFontSize;
    lineTokens.forEach((t, i) => {
      ctx.font = `${fontStyle}${theme.fontWeight} ${t.fontSize}px ${familyName}`;
      width += ctx.measureText(t.text).width;
      if (i > 0) width += t.fontSize * spaceWidthRatio;
      maxFontSize = Math.max(maxFontSize, t.fontSize);
    });
    lineWidths.push(width);
    lineHeights.push(maxFontSize * 1.28);
  }

  const totalHeight = lineHeights.reduce((a, b) => a + b, 0);
  const anchorX = layout.x * canvasWidth;
  const anchorY = layout.y * canvasHeight;

  // "stairs" indents each successive line further right, so the block's real
  // width is wider than any single line's measured width.
  const stairStep = canvasWidth * 0.07;
  const stairsTotalShift = stairStep * Math.max(lines.length - 1, 0);

  // Clamp so text never renders off-canvas regardless of region choice. Scatter
  // and stairs both spread words well past a single line's measured width, so
  // they clamp against a wider box instead of the literal line dimensions.
  const maxLineWidth = Math.max(...lineWidths, 1);
  const boxHalfWidth = theme.scatter
    ? Math.max(maxLineWidth * 0.75, canvasWidth * 0.2)
    : (maxLineWidth + (theme.align === "stairs" ? stairsTotalShift : 0)) / 2;
  const boxHalfHeight = theme.scatter
    ? Math.max(totalHeight * 1.1, canvasHeight * 0.12)
    : totalHeight / 2;
  const clampedCenterX = Math.min(
    Math.max(anchorX, boxHalfWidth + 16),
    canvasWidth - boxHalfWidth - 16
  );
  const clampedCenterY = Math.min(
    Math.max(anchorY, boxHalfHeight + 16),
    canvasHeight - boxHalfHeight - 16
  );

  if (theme.scatter) {
    ctx.textAlign = "center";
    drawScatterCollage(ctx, tokens, theme, familyName, fontStyle, clampedCenterX, clampedCenterY, currentTime, scale);
    ctx.restore();
    return {
      x: clampedCenterX - boxHalfWidth,
      y: clampedCenterY - boxHalfHeight,
      width: boxHalfWidth * 2,
      height: boxHalfHeight * 2,
    };
  }

  if (theme.background) {
    const bgPad = theme.background.padding * scale;
    ctx.fillStyle = theme.background.color;
    roundRect(
      ctx,
      clampedCenterX - maxLineWidth / 2 - bgPad,
      clampedCenterY - totalHeight / 2 - bgPad,
      maxLineWidth + bgPad * 2,
      totalHeight + bgPad * 2,
      theme.background.radius * scale
    );
    ctx.fill();
  }

  let cursorY = clampedCenterY - totalHeight / 2;
  lines.forEach((_, lineIdx) => {
    const lineTokens = tokens.filter((t) => t.line === lineIdx);
    const lineWidth = lineWidths[lineIdx];
    const lineHeight = lineHeights[lineIdx];
    let x: number;
    if (theme.align === "stairs") {
      x = clampedCenterX - maxLineWidth / 2 - stairsTotalShift / 2 + lineIdx * stairStep;
    } else if (theme.align === "left") {
      x = clampedCenterX - maxLineWidth / 2;
    } else {
      x = clampedCenterX - lineWidth / 2;
    }
    const y = cursorY + lineHeight / 2;

    for (const token of lineTokens) {
      ctx.font = `${fontStyle}${theme.fontWeight} ${token.fontSize}px ${familyName}`;
      if (theme.letterSpacing) {
        ctx.letterSpacing = `${theme.letterSpacing * scale * token.sizeRatio}px`;
      }
      drawWordToken(ctx, token, x, y, theme, currentTime, scale);
      x += ctx.measureText(token.text).width + token.fontSize * spaceWidthRatio;
    }
    cursorY += lineHeight;
  });

  ctx.restore();

  return {
    x: clampedCenterX - boxHalfWidth,
    y: clampedCenterY - totalHeight / 2,
    width: boxHalfWidth * 2,
    height: totalHeight,
  };
}

function sizeMultiplierFor(emphasis: number | undefined): number {
  const e = clamp(emphasis ?? 0.5, 0, 1);
  return MIN_SIZE_MULTIPLIER + e * (MAX_SIZE_MULTIPLIER - MIN_SIZE_MULTIPLIER);
}

function fontFamilyFromCssVar(font: string): string {
  return font.replace(/^var\(--font-([a-z-]+)\)$/, (_, n) => n.replace(/-/g, " "));
}

/** Deterministic 0-1 "random" from a seed — same seed always gives the same
 * jitter, so glitch looks identical between live preview and final export. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawWordToken(
  ctx: CanvasRenderingContext2D,
  token: Token,
  x: number,
  y: number,
  theme: SubtitleTheme,
  currentTime: number,
  scale: number
) {
  const { word, sizeRatio } = token;
  const isActive = currentTime >= word.start && currentTime <= word.end;
  const isPast = currentTime > word.end;
  const progress = clamp((currentTime - word.start) / Math.max(word.end - word.start, 0.001), 0, 1);

  const fillColor = resolveFillColor(theme, token, isActive, isPast);

  ctx.save();

  let drawX = x;
  let drawY = y;
  let alpha = 1;
  let widthToDraw: number | null = null; // for typewriter reveal

  if (isActive) {
    switch (theme.animation) {
      case "pop": {
        const s = 1 + 0.35 * (1 - EASE_OUT_BACK(progress)) * (progress < 1 ? 1 : 0);
        applyScale(ctx, x, y, ctx.measureText(token.text).width, s);
        break;
      }
      case "scale": {
        const s = 0.7 + 0.3 * EASE_OUT_BACK(Math.min(progress * 1.4, 1));
        applyScale(ctx, x, y, ctx.measureText(token.text).width, s);
        break;
      }
      case "bounce": {
        const bounce = Math.sin(Math.min(progress * Math.PI, Math.PI)) * -14 * scale;
        drawY = y + bounce;
        break;
      }
      case "fade": {
        alpha = progress;
        break;
      }
      case "slide": {
        drawX = x + (1 - progress) * 24 * scale;
        alpha = progress;
        break;
      }
      case "typewriter": {
        widthToDraw = progress;
        break;
      }
      default:
        break;
    }
  } else if (!isPast && theme.animation === "fade") {
    alpha = 0.15;
  }

  ctx.globalAlpha = alpha;

  const text = widthToDraw !== null ? token.text.slice(0, Math.ceil(token.text.length * widthToDraw)) : token.text;

  if (theme.shadow) {
    ctx.shadowColor = theme.shadow.color;
    ctx.shadowBlur = theme.shadow.blur * scale * sizeRatio;
    ctx.shadowOffsetX = theme.shadow.offsetX * scale * sizeRatio;
    ctx.shadowOffsetY = theme.shadow.offsetY * scale * sizeRatio;
  }

  if (isActive && theme.animation === "glitch") {
    drawGlitchText(ctx, text, drawX, drawY, fillColor, theme, scale, sizeRatio, word.start);
  } else if (isActive && theme.animation === "wave") {
    drawWaveText(ctx, text, drawX, drawY, fillColor, theme, progress, scale, sizeRatio);
  } else {
    if (theme.stroke) {
      ctx.lineWidth = theme.stroke.width * scale * sizeRatio;
      ctx.strokeStyle = theme.stroke.color;
      ctx.strokeText(text, drawX, drawY);
    }
    ctx.fillStyle = resolveFillStyle(ctx, theme, fillColor, drawX, drawY, text);
    ctx.fillText(text, drawX, drawY);
  }

  ctx.restore();
}

/** Lays words out as an overlapping, rotated collage burst around a center
 * point — biggest/most-emphasized word nearest center, others spiraling
 * outward at alternating angles — instead of left-to-right lines. Matches a
 * "trending fonts" word-cloud caption style. Deterministic per word (seeded
 * by its start time and rank), so preview and export render identically. */
function drawScatterCollage(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  theme: SubtitleTheme,
  familyName: string,
  fontStyle: string,
  centerX: number,
  centerY: number,
  currentTime: number,
  scale: number
) {
  const ordered = [...tokens].sort((a, b) => b.fontSize - a.fontSize);

  ordered.forEach((token, rank) => {
    const { word, sizeRatio } = token;
    const isActive = currentTime >= word.start && currentTime <= word.end;
    const progress = clamp((currentTime - word.start) / Math.max(word.end - word.start, 0.001), 0, 1);
    const popIn = isActive ? 0.7 + 0.3 * EASE_OUT_BACK(Math.min(progress * 1.4, 1)) : 1;

    const seed = word.start * 97 + rank * 13.37;
    const goldenAngle = rank * 2.39996; // radians; spaces words evenly around the center
    const radius = rank === 0 ? 0 : (26 + rank * 48) * scale;
    const px = centerX + Math.cos(goldenAngle) * radius;
    const py = centerY + Math.sin(goldenAngle) * radius * 0.55;
    const rotation = (pseudoRandom(seed) - 0.5) * 0.5;

    const fillColor =
      theme.palette && theme.palette.length > 0
        ? theme.palette[rank % theme.palette.length]
        : rank === 0
          ? theme.highlightColor
          : theme.textColor;

    ctx.save();
    ctx.font = `${fontStyle}${theme.fontWeight} ${token.fontSize}px ${familyName}`;
    if (theme.letterSpacing) {
      ctx.letterSpacing = `${theme.letterSpacing * scale * sizeRatio}px`;
    }
    const width = ctx.measureText(token.text).width;

    ctx.translate(px, py);
    ctx.rotate(rotation);
    ctx.scale(popIn, popIn);

    if (theme.shadow) {
      ctx.shadowColor = theme.shadow.color;
      ctx.shadowBlur = theme.shadow.blur * scale * sizeRatio;
      ctx.shadowOffsetX = theme.shadow.offsetX * scale * sizeRatio;
      ctx.shadowOffsetY = theme.shadow.offsetY * scale * sizeRatio;
    }
    if (theme.stroke) {
      ctx.lineWidth = theme.stroke.width * scale * sizeRatio;
      ctx.strokeStyle = theme.stroke.color;
      ctx.strokeText(token.text, 0, 0);
    }
    ctx.fillStyle = resolveFillStyle(ctx, theme, fillColor, -width / 2, 0, token.text);
    ctx.fillText(token.text, 0, 0);
    ctx.restore();
  });
}

/** Base color for a word: palette cycling takes priority, then the usual
 * active/highlight-vs-default logic. Gradient (if set) is applied later, as
 * an actual canvas fillStyle, not a plain color. */
function resolveFillColor(theme: SubtitleTheme, token: Token, isActive: boolean, isPast: boolean): string {
  if (theme.palette && theme.palette.length > 0) {
    return theme.palette[token.globalIndex % theme.palette.length];
  }
  if (theme.colorByEmphasis) {
    return (token.word.emphasis ?? 0) >= EMPHASIS_COLOR_THRESHOLD ? theme.highlightColor : theme.textColor;
  }
  const useHighlightColor = theme.wordHighlight && (isActive || (isPast && theme.animation === "highlight"));
  return useHighlightColor ? theme.highlightColor : theme.textColor;
}

function resolveFillStyle(
  ctx: CanvasRenderingContext2D,
  theme: SubtitleTheme,
  fallbackColor: string,
  x: number,
  y: number,
  text: string
): string | CanvasGradient {
  if (!theme.textGradient) return fallbackColor;
  const width = Math.max(ctx.measureText(text).width, 1);
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, theme.textGradient[0]);
  gradient.addColorStop(1, theme.textGradient[1]);
  return gradient;
}

/** RGB-split glitch: cyan/red ghost copies offset by a time-seeded jitter,
 * screen-blended so they glow rather than muddy the frame, with a crisp
 * main-color pass on top. The seed is `word.start` (not wall-clock time or
 * Math.random), so preview and the final export render pixel-identical. */
function drawGlitchText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  theme: SubtitleTheme,
  scale: number,
  sizeRatio: number,
  seed: number
) {
  const jitter = 4 * scale * sizeRatio;
  const jx = (pseudoRandom(seed) - 0.5) * jitter;
  const jy = (pseudoRandom(seed + 7.7) - 0.5) * jitter * 0.4;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "#ff2a6d";
  ctx.fillText(text, x - jitter + jx, y + jy);
  ctx.fillStyle = "#05d9e8";
  ctx.fillText(text, x + jitter + jx, y + jy);
  ctx.restore();

  if (theme.stroke) {
    ctx.lineWidth = theme.stroke.width * scale * sizeRatio;
    ctx.strokeStyle = theme.stroke.color;
    ctx.strokeText(text, x + jx, y + jy);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x + jx, y + jy);
}

/** Per-letter sine wave that rises in as the word becomes active and settles
 * back to baseline by the time it ends, instead of a hard on/off bounce. */
function drawWaveText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  theme: SubtitleTheme,
  progress: number,
  scale: number,
  sizeRatio: number
) {
  const amplitude = 10 * scale * sizeRatio * Math.sin(clamp(progress, 0, 1) * Math.PI);
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const charY = y + Math.sin(progress * Math.PI * 2.4 + i * 0.7) * amplitude;
    if (theme.stroke) {
      ctx.lineWidth = theme.stroke.width * scale * sizeRatio;
      ctx.strokeStyle = theme.stroke.color;
      ctx.strokeText(ch, cx, charY);
    }
    ctx.fillStyle = color;
    ctx.fillText(ch, cx, charY);
    cx += ctx.measureText(ch).width;
  }
}

function applyScale(ctx: CanvasRenderingContext2D, pivotX: number, pivotY: number, width: number, s: number) {
  ctx.translate(pivotX + width / 2, pivotY);
  ctx.scale(s, s);
  ctx.translate(-(pivotX + width / 2), -pivotY);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
