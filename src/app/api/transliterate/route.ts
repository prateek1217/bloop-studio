import { NextRequest, NextResponse } from "next/server";
import { transliterateHindiToHinglish } from "@/lib/stt/transliterate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Thin relay for the Hindi -> Hinglish step of the Hinglish pipeline: takes
 * the word list from a Hindi transcript and returns the same words
 * transliterated into Roman-script Hinglish, same length/order, so the
 * caller can just swap word.text in place and keep every timestamp.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const words = body?.words;

    if (!Array.isArray(words) || !words.every((w) => typeof w === "string")) {
      return NextResponse.json({ error: "Expected { words: string[] }" }, { status: 400 });
    }

    const transliterated = await transliterateHindiToHinglish(words);
    return NextResponse.json({ words: transliterated });
  } catch (err) {
    console.error("[/api/transliterate] failed", err);
    const message = err instanceof Error ? err.message : "Transliteration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
