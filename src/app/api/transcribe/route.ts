import { NextRequest, NextResponse } from "next/server";
import { getSTTProvider, type TranscriptionLanguage } from "@/lib/stt";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Thin relay: browser extracts audio client-side (see lib/audio/extractAudio.ts)
 * and posts it here. This route only forwards to the configured STT provider so
 * the API key never reaches the client. No video ever touches this server.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const languageField = form.get("language");
    const language: TranscriptionLanguage = languageField === "hi" ? "hi" : "en";

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "Missing 'audio' file field" }, { status: 400 });
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // The client names this by actual format (audio.wav vs audio.m4a when
    // compressed — see runPipeline.ts) so the STT provider gets the right hint.
    const filename = audio instanceof File ? audio.name : "audio.wav";

    const provider = getSTTProvider(language);
    const transcript = await provider.transcribe(buffer, filename);

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[/api/transcribe] failed", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
