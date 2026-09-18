import { v4 as uuid } from "uuid";
import type { CaptionSegment, Word } from "@/types";

export interface SegmentationOptions {
  /** Hard cap on words per on-screen caption. Reels read best short: 3-6 words. */
  maxWordsPerSegment: number;
  /** Hard cap on total characters (keeps 1-2 short lines instead of a wall of text). */
  maxCharsPerSegment: number;
  /** Above this on-screen duration a segment gets forced to break even mid-thought. */
  maxDurationSec: number;
  /** Below this, a segment reads too fast — nudges the algorithm to fold in fewer words. */
  minDurationSec: number;
  /** A gap between words at least this long is treated as a natural speech pause. */
  pauseThresholdSec: number;
  /** Never break a segment before it has at least this many words, even on punctuation. */
  minWordsPerSegment: number;
}

export const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  maxWordsPerSegment: 6,
  maxCharsPerSegment: 26,
  maxDurationSec: 2.6,
  minDurationSec: 0.5,
  pauseThresholdSec: 0.35,
  minWordsPerSegment: 1,
};

const SENTENCE_END = /[.!?]["')\]]?$/;
const CLAUSE_END = /[,;:]["')\]]?$/;

/**
 * Groups word-level timestamps into short, readable on-screen caption segments.
 * Pure function: same words + options => same segments. Word-level timing is
 * preserved via wordStartIndex/wordEndIndex, never collapsed.
 */
export function segmentCaptions(
  words: Word[],
  options: Partial<SegmentationOptions> = {}
): CaptionSegment[] {
  const opts = { ...DEFAULT_SEGMENTATION_OPTIONS, ...options };
  const segments: CaptionSegment[] = [];

  if (words.length === 0) return segments;

  let bufferStart = 0; // index of first word in current buffer

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isLast = i === words.length - 1;
    const bufferWordCount = i - bufferStart + 1;
    const bufferText = words
      .slice(bufferStart, i + 1)
      .map((w) => w.text)
      .join(" ");
    const bufferDuration = word.end - words[bufferStart].start;

    const nextWord = words[i + 1];
    const gapToNext = nextWord ? nextWord.start - word.end : Infinity;

    const overWordCap = bufferWordCount >= opts.maxWordsPerSegment;
    const overCharCap = bufferText.length >= opts.maxCharsPerSegment;
    const overDurationCap = bufferDuration >= opts.maxDurationSec;
    const hasMinWords = bufferWordCount >= opts.minWordsPerSegment;

    const atSentenceEnd = SENTENCE_END.test(word.text);
    const atClauseEnd = CLAUSE_END.test(word.text);
    const naturalPause = gapToNext >= opts.pauseThresholdSec;

    const shouldBreakOnPunctuationOrPause =
      hasMinWords &&
      bufferDuration >= opts.minDurationSec &&
      (atSentenceEnd || (atClauseEnd && naturalPause) || naturalPause);

    const shouldBreak =
      isLast || overWordCap || overCharCap || overDurationCap || shouldBreakOnPunctuationOrPause;

    if (shouldBreak) {
      const segWords = words.slice(bufferStart, i + 1);
      segments.push({
        id: uuid(),
        wordStartIndex: bufferStart,
        wordEndIndex: i,
        start: segWords[0].start,
        end: segWords[segWords.length - 1].end,
        text: wrapForDisplay(segWords.map((w) => w.text).join(" ")),
        layout: null,
      });
      bufferStart = i + 1;
    }
  }

  return segments;
}

/**
 * Greedy line-balancing wrap for short caption bursts: aims for <=2 lines,
 * roughly equal width, breaking on word boundaries only.
 */
function wrapForDisplay(text: string, maxLineChars = 18): string {
  const words = text.split(" ");
  if (text.length <= maxLineChars || words.length <= 2) return text;

  let bestSplit = Math.ceil(words.length / 2);
  let bestDiff = Infinity;
  for (let split = 1; split < words.length; split++) {
    const line1 = words.slice(0, split).join(" ");
    const line2 = words.slice(split).join(" ");
    const diff = Math.abs(line1.length - line2.length);
    if (Math.max(line1.length, line2.length) <= maxLineChars * 1.4 && diff < bestDiff) {
      bestDiff = diff;
      bestSplit = split;
    }
  }

  return words.slice(0, bestSplit).join(" ") + "\n" + words.slice(bestSplit).join(" ");
}
