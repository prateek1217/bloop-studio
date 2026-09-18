import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

let ffmpegPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily loads ffmpeg.wasm exactly once. Used at export time to remux the
 * browser-recorded composite into a standard, shareable MP4 (the expensive
 * part of export is the canvas compositing pass, not this remux step), and
 * conditionally during upload to compress oversized audio before
 * transcription (see compressAudio.ts) — never for a typical short clip.
 */
export function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}
