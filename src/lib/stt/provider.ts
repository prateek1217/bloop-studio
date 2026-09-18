import type { Transcript } from "@/types";

/**
 * Abstraction over any speech-to-text provider that can return word-level
 * timestamps. Swap providers (OpenAI, Deepgram, AssemblyAI, a self-hosted
 * whisper.cpp server, ...) without touching API routes or the pipeline.
 */
export interface STTProvider {
  readonly id: string;
  transcribe(audio: Buffer, filename: string): Promise<Transcript>;
}
