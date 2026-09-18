import OpenAI from "openai";
import { toFile } from "openai/uploads";
import type { STTProvider } from "./provider";
import type { Transcript, Word } from "@/types";

/**
 * OpenAI Whisper (gpt-4o-transcribe / whisper-1) provider using verbose_json
 * with word-level timestamp granularity.
 */
export class OpenAIWhisperProvider implements STTProvider {
  readonly id = "openai-whisper";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "whisper-1") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async transcribe(audio: Buffer, filename: string): Promise<Transcript> {
    const file = await toFile(audio, filename);
    const result = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    const raw = result as unknown as {
      language?: string;
      words?: { word: string; start: number; end: number }[];
      segments?: { text: string; start: number; end: number }[];
    };

    const words: Word[] = (raw.words ?? []).map((w) => ({
      text: w.word,
      start: w.start,
      end: w.end,
    }));

    if (words.length === 0 && raw.segments) {
      // Fallback for providers/models that don't return word timestamps:
      // approximate even spacing within each segment rather than failing outright.
      for (const seg of raw.segments) {
        const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
        const span = (seg.end - seg.start) / Math.max(tokens.length, 1);
        tokens.forEach((t, i) => {
          words.push({
            text: t,
            start: seg.start + i * span,
            end: seg.start + (i + 1) * span,
          });
        });
      }
    }

    return { words, language: raw.language };
  }
}
