import { describe, it, expect } from "vitest";
import { segmentCaptions } from "./segmentCaptions";
import type { Word } from "@/types";

function words(spec: [string, number, number][]): Word[] {
  return spec.map(([text, start, end]) => ({ text, start, end }));
}

describe("segmentCaptions", () => {
  it("preserves exact word-level timing on every produced segment", () => {
    const input = words([
      ["This", 0.0, 0.2],
      ["is", 0.2, 0.35],
      ["really", 0.35, 0.6],
      ["interesting", 0.6, 1.1],
      ["because", 1.6, 1.8],
      ["we", 1.8, 1.9],
      ["are", 1.9, 2.0],
      ["building", 2.0, 2.3],
      ["something", 2.3, 2.6],
      ["completely", 2.6, 2.9],
      ["new", 2.9, 3.1],
    ]);

    const segments = segmentCaptions(input);

    // Every word must belong to exactly one segment, in order, with no drift.
    let cursor = 0;
    for (const seg of segments) {
      expect(seg.wordStartIndex).toBe(cursor);
      expect(seg.start).toBeCloseTo(input[seg.wordStartIndex].start, 5);
      expect(seg.end).toBeCloseTo(input[seg.wordEndIndex].end, 5);
      cursor = seg.wordEndIndex + 1;
    }
    expect(cursor).toBe(input.length);
  });

  it("breaks on a long natural pause even without punctuation", () => {
    const input = words([
      ["hello", 0, 0.3],
      ["world", 0.3, 0.6],
      ["next", 2.0, 2.3], // 1.4s gap
      ["thought", 2.3, 2.6],
    ]);

    const segments = segmentCaptions(input);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].wordEndIndex).toBe(1);
  });

  it("caps segment length so it never balloons into a wall of text", () => {
    const input = words(
      Array.from({ length: 12 }, (_, i) => [`word${i}`, i * 0.3, i * 0.3 + 0.25] as [string, number, number])
    );

    const segments = segmentCaptions(input, { maxWordsPerSegment: 6, pauseThresholdSec: 999 });
    for (const seg of segments) {
      expect(seg.wordEndIndex - seg.wordStartIndex + 1).toBeLessThanOrEqual(6);
    }
  });

  it("returns an empty array for no words", () => {
    expect(segmentCaptions([])).toEqual([]);
  });
});
