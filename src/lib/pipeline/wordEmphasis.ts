import type { Word } from "@/types";

// Short function/filler words that shouldn't visually dominate even if they
// happen to land loud (e.g. a stressed "the" mid-sentence).
const FILLER_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "am", "to", "of", "in", "on", "at",
  "and", "or", "but", "um", "uh", "like", "so", "just", "it", "its", "it's", "i",
  "you", "we", "they", "he", "she", "this", "that", "these", "those", "for",
  "with", "as", "be", "been", "being",
]);

/**
 * Scores each word 0-1 for visual emphasis by combining relative loudness
 * (RMS energy of the word's audio span vs. the rest of the clip) with
 * lightweight textual cues (numbers, exclamations, filler-word suppression).
 * No ML model call — everything here comes from data the pipeline already
 * has (the decoded audio + the transcript).
 */
export function computeWordEmphasis(words: Word[], samples: Float32Array, sampleRate: number): Word[] {
  if (words.length === 0) return words;

  const loudness = words.map((w) => rmsEnergy(samples, sampleRate, w.start, w.end));
  const { mean, std } = meanStd(loudness);

  return words.map((w, i) => {
    const audioZ = std > 0 ? (loudness[i] - mean) / std : 0;
    const audioScore = clamp01(0.5 + audioZ / 4); // squash z-score into ~0-1
    const textScore = textEmphasisScore(w.text);
    const emphasis = clamp01(audioScore * 0.65 + textScore * 0.35);
    return { ...w, emphasis };
  });
}

function rmsEnergy(samples: Float32Array, sampleRate: number, start: number, end: number): number {
  const startIdx = Math.max(0, Math.floor(start * sampleRate));
  const endIdx = Math.min(samples.length, Math.ceil(end * sampleRate));
  if (endIdx <= startIdx) return 0;

  let sumSquares = 0;
  for (let i = startIdx; i < endIdx; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / (endIdx - startIdx));
}

function meanStd(values: number[]): { mean: number; std: number } {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length, 1);
  return { mean, std: Math.sqrt(variance) };
}

function textEmphasisScore(rawText: string): number {
  const text = rawText.trim();
  const bare = text.replace(/[^\p{L}\p{N}']/gu, "");
  if (!bare) return 0.3;

  let score = 0.4;
  if (/\d/.test(bare)) score += 0.25; // numbers tend to carry the point
  if (/[!?]$/.test(text)) score += 0.2; // emphatic punctuation
  if (bare.length > 1 && bare === bare.toUpperCase() && /[A-Z]/.test(bare)) score += 0.25; // shouted/acronym
  if (FILLER_WORDS.has(bare.toLowerCase())) score -= 0.35;
  if (bare.length >= 8) score += 0.1; // longer words read as more content-heavy

  return clamp01(score);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
