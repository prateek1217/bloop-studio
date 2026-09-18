import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "@/lib/ffmpeg/client";

/**
 * Transcodes a WAV blob to AAC (48kbps, same sample rate/channels) via
 * ffmpeg.wasm — only called when the raw WAV would be too big to upload
 * (see SAFE_UPLOAD_BYTES in runPipeline.ts), since it pulls in the ~30MB
 * ffmpeg-core download that most short clips don't need at all. AAC (not
 * Opus) because it's the codec this exact ffmpeg-core build already proves
 * out for encoding, in exportVideo.ts's own remux step.
 */
export async function compressWavToAac(wav: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  await ffmpeg.writeFile("compress-in.wav", await fetchFile(wav));
  await ffmpeg.exec(["-i", "compress-in.wav", "-c:a", "aac", "-b:a", "48k", "compress-out.m4a"]);
  const data = await ffmpeg.readFile("compress-out.m4a");
  await ffmpeg.deleteFile("compress-in.wav");
  await ffmpeg.deleteFile("compress-out.m4a");

  return new Blob([Uint8Array.from(data as Uint8Array)], { type: "audio/mp4" });
}
