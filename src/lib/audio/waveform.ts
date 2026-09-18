/**
 * Downsamples decoded PCM into a small array of peak amplitudes (0-1) for
 * drawing a timeline waveform. Cheap and one-time — computed once during
 * the pipeline from audio we already decoded, then stored on the project.
 */
export function computeWaveformPeaks(samples: Float32Array, bucketCount = 600): number[] {
  if (samples.length === 0) return [];

  const bucketSize = Math.max(1, Math.ceil(samples.length / bucketCount));
  const peaks: number[] = [];

  for (let i = 0; i < samples.length; i += bucketSize) {
    let max = 0;
    const end = Math.min(i + bucketSize, samples.length);
    for (let j = i; j < end; j++) {
      const abs = Math.abs(samples[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  return peaks;
}
