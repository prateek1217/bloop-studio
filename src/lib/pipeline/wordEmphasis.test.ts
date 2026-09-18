import { describe, it, expect } from "vitest";
import { computeWordEmphasis } from "./wordEmphasis";
import type { Word } from "@/types";

const SAMPLE_RATE = 16000;

function toneAt(rate: number, durationSec: number, amplitude: number): Float32Array {
  const n = Math.round(rate * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((i / rate) * 2 * Math.PI * 220);
  return out;
}

describe("computeWordEmphasis", () => {
  it("scores a louder word higher than a quiet one", () => {
    const words: Word[] = [
      { text: "quiet", start: 0, end: 0.5 },
      { text: "LOUD", start: 0.5, end: 1.0 },
      { text: "quiet", start: 1.0, end: 1.5 },
    ];
    const samples = new Float32Array(SAMPLE_RATE * 1.5);
    samples.set(toneAt(SAMPLE_RATE, 0.5, 0.02), 0);
    samples.set(toneAt(SAMPLE_RATE, 0.5, 0.9), Math.round(SAMPLE_RATE * 0.5));
    samples.set(toneAt(SAMPLE_RATE, 0.5, 0.02), Math.round(SAMPLE_RATE * 1.0));

    const scored = computeWordEmphasis(words, samples, SAMPLE_RATE);
    expect(scored[1].emphasis).toBeGreaterThan(scored[0].emphasis!);
    expect(scored[1].emphasis).toBeGreaterThan(scored[2].emphasis!);
  });

  it("de-emphasizes filler words and boosts numbers/exclamations at equal loudness", () => {
    const words: Word[] = [
      { text: "the", start: 0, end: 0.4 },
      { text: "100", start: 0.4, end: 0.8 },
      { text: "amazing!", start: 0.8, end: 1.2 },
    ];
    const samples = toneAt(SAMPLE_RATE, 1.2, 0.3); // uniform loudness throughout

    const scored = computeWordEmphasis(words, samples, SAMPLE_RATE);
    expect(scored[1].emphasis).toBeGreaterThan(scored[0].emphasis!);
    expect(scored[2].emphasis).toBeGreaterThan(scored[0].emphasis!);
  });

  it("returns values clamped between 0 and 1", () => {
    const words: Word[] = [{ text: "HELLO!", start: 0, end: 0.5 }];
    const samples = toneAt(SAMPLE_RATE, 0.5, 1.0);
    const scored = computeWordEmphasis(words, samples, SAMPLE_RATE);
    expect(scored[0].emphasis).toBeGreaterThanOrEqual(0);
    expect(scored[0].emphasis).toBeLessThanOrEqual(1);
  });

  it("returns an empty array for no words", () => {
    expect(computeWordEmphasis([], new Float32Array(0), SAMPLE_RATE)).toEqual([]);
  });
});
