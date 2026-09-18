import type { STTProvider } from "./provider";
import type { Transcript, Word } from "@/types";

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

interface ElevenLabsWord {
  text: string;
  type: "word" | "spacing" | "audio_event";
  start: number;
  end: number;
}

interface ElevenLabsTranscriptionResponse {
  language_code?: string;
  words?: ElevenLabsWord[];
}

/**
 * ElevenLabs Scribe (v2) speech-to-text — a single HTTP endpoint that
 * handles both English and Hindi (and 90+ other languages), unlike the
 * NVIDIA setup this replaces which needed a separate gRPC model + function-id
 * per language. Word-level timestamps come back directly in the JSON
 * response, so no extra parsing step is needed.
 */
export class ElevenLabsSTTProvider implements STTProvider {
  readonly id = "elevenlabs-scribe";

  constructor(
    private apiKey: string,
    private languageCode?: string
  ) {}

  async transcribe(audio: Buffer, filename: string): Promise<Transcript> {
    const form = new FormData();
    form.append("model_id", "scribe_v2");
    if (this.languageCode) form.append("language_code", this.languageCode);
    form.append("file", new Blob([new Uint8Array(audio)]), filename);

    const res = await fetch(ELEVENLABS_STT_URL, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs transcription failed (${res.status}): ${body || res.statusText}`);
    }

    const data: ElevenLabsTranscriptionResponse = await res.json();

    // "spacing" entries are the gaps between words and "audio_event" entries
    // are non-speech sounds (laughter, applause) — only "word" entries carry
    // actual spoken text with usable timestamps.
    const words: Word[] = (data.words ?? [])
      .filter((w) => w.type === "word")
      .map((w) => ({ text: w.text, start: w.start, end: w.end }));

    return { words, language: data.language_code };
  }
}
