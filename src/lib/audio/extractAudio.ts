/**
 * Extracts audio from a video file entirely in the browser using the native
 * Web Audio API (no ffmpeg.wasm needed for this step — keeps it cheap).
 * Downmixes to mono 16kHz, which is plenty for STT and keeps the upload small.
 */

const TARGET_SAMPLE_RATE = 16000;

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Decodes a video/audio file to mono PCM once. Shared by extractAudioAsWav
 * (for the transcription upload) and computeWordEmphasis (for loudness-based
 * word sizing), so we don't decode the same file twice.
 */
export async function decodeAudioToPCM(videoFile: File | Blob): Promise<DecodedAudio> {
  const arrayBuffer = await videoFile.arrayBuffer();

  // Decode at native rate first (decodeAudioData ignores the target rate we ask for).
  type WindowWithWebkitAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor =
    window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  const decodeCtx = new AudioContextCtor();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  await decodeCtx.close();

  const durationSec = decoded.duration;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(durationSec * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return { samples: rendered.getChannelData(0), sampleRate: TARGET_SAMPLE_RATE };
}

export async function extractAudioAsWav(videoFile: File | Blob): Promise<Blob> {
  const { samples, sampleRate } = await decodeAudioToPCM(videoFile);
  return encodeWav(samples, sampleRate);
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
