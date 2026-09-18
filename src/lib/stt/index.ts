import type { STTProvider } from "./provider";
import { OpenAIWhisperProvider } from "./openaiProvider";
import { NvidiaParakeetProvider } from "./nvidiaParakeetProvider";
import { ElevenLabsSTTProvider } from "./elevenLabsProvider";

export type TranscriptionLanguage = "en" | "hi";

const cache = new Map<TranscriptionLanguage, STTProvider>();

/**
 * Central place that picks the configured STT provider for a requested
 * transcription language. ElevenLabs Scribe is the default — a single API
 * that handles both English and Hindi — so it's checked first regardless of
 * language. STT_PROVIDER can still be set to "openai-whisper" or
 * "nvidia-parakeet" for English, in which case Hindi/Hinglish falls back to
 * NVIDIA's multilingual Parakeet model (the old dedicated Hindi path);
 * Hinglish is built on top of this by transliterating the Hindi output
 * afterward (see transliterate.ts), not by transcribing directly into
 * Hinglish.
 */
export function getSTTProvider(language: TranscriptionLanguage = "en"): STTProvider {
  const existing = cache.get(language);
  if (existing) return existing;

  const providerId = process.env.STT_PROVIDER ?? "elevenlabs";

  if (providerId === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env.local (see .env.example).");
    }
    const provider = new ElevenLabsSTTProvider(apiKey, language === "hi" ? "hi" : "en");
    cache.set(language, provider);
    return provider;
  }

  if (language === "hi") {
    const apiKey = process.env.NVIDIA_HINDI_API_KEY;
    const functionId = process.env.NVIDIA_HINDI_FUNCTION_ID;
    if (!apiKey || !functionId) {
      throw new Error(
        "NVIDIA_HINDI_API_KEY and NVIDIA_HINDI_FUNCTION_ID must be set for Hindi/Hinglish transcription " +
          "when STT_PROVIDER isn't 'elevenlabs' (see .env.example — get them from the " +
          "nvidia/parakeet-1.1b-rnnt-multilingual-asr model page on build.nvidia.com)."
      );
    }
    const provider = new NvidiaParakeetProvider(apiKey, functionId, "hi-IN");
    cache.set(language, provider);
    return provider;
  }

  let provider: STTProvider;

  switch (providerId) {
    case "openai-whisper": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).");
      }
      provider = new OpenAIWhisperProvider(apiKey, process.env.OPENAI_STT_MODEL);
      break;
    }
    case "nvidia-parakeet": {
      const apiKey = process.env.NVIDIA_API_KEY;
      const functionId = process.env.NVIDIA_FUNCTION_ID;
      if (!apiKey || !functionId) {
        throw new Error("NVIDIA_API_KEY and NVIDIA_FUNCTION_ID must be set (see .env.example).");
      }
      provider = new NvidiaParakeetProvider(apiKey, functionId, process.env.NVIDIA_LANGUAGE_CODE);
      break;
    }
    default:
      throw new Error(`Unknown STT_PROVIDER: ${providerId}`);
  }

  cache.set(language, provider);
  return provider;
}
