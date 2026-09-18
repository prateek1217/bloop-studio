const MODEL = "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
// Smaller than before (was 60): the model is noticeably more likely to keep
// an exact word count on a short list than a long one, so this trades a few
// more requests for far fewer count-mismatch failures.
const CHUNK_SIZE = 25;
const MAX_ATTEMPTS_PER_CHUNK = 3;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY must be set for Hinglish transliteration (see .env.example — get it from " +
        "aistudio.google.com/apikey)."
    );
  }
  return apiKey;
}

/**
 * Transliterates Hindi (Devanagari) words into "Hinglish" — the same words,
 * phonetically spelled in the Latin alphabet the way they're casually typed
 * in Indian social media captions (e.g. "क्या" -> "kya"). This is
 * transliteration, not translation: word count and order are preserved
 * exactly, which is what lets the original word-level timestamps from the
 * Hindi transcription keep applying unchanged.
 */
export async function transliterateHindiToHinglish(words: string[]): Promise<string[]> {
  if (words.length === 0) return [];

  const out: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE);
    out.push(...(await transliterateWithFallback(chunk)));
  }
  return out;
}

/**
 * Retries a chunk a few times (with a higher temperature after the first
 * attempt, since retrying an identical temperature-0 prompt just reproduces
 * the same wrong answer). If it still won't come back with the right word
 * count, bisects the chunk and retries each half — smaller chunks are
 * markedly more reliable, and this isolates whichever specific word(s) are
 * causing trouble instead of failing the entire batch over one of them. A
 * single word that still won't cooperate falls back to its original Hindi
 * text: a few un-transliterated words is a much better outcome than failing
 * the whole video's Hinglish output.
 */
async function transliterateWithFallback(words: string[]): Promise<string[]> {
  if (words.length === 0) return [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_CHUNK; attempt++) {
    try {
      return await transliterateChunk(words, attempt === 0 ? 0 : 0.4);
    } catch (err) {
      console.warn(
        `[transliterate] chunk of ${words.length} word(s) failed on attempt ${attempt + 1}/${MAX_ATTEMPTS_PER_CHUNK}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (words.length === 1) {
    return words; // give up gracefully: keep the original Hindi word
  }

  const mid = Math.ceil(words.length / 2);
  const [left, right] = await Promise.all([
    transliterateWithFallback(words.slice(0, mid)),
    transliterateWithFallback(words.slice(mid)),
  ]);
  return [...left, ...right];
}

async function transliterateChunk(words: string[], temperature: number): Promise<string[]> {
  const prompt =
    "You are a precise transliteration engine, not a translator.\n" +
    `You will be given a JSON array of exactly ${words.length} Hindi words written in Devanagari script.\n` +
    'Transliterate EACH word into "Hinglish" - the same Hindi word, phonetically spelled using the ' +
    "Latin alphabet, the way it is casually typed in Indian social media captions " +
    '(examples: "ज़िंदगी" -> "zindagi", "क्या" -> "kya", "है" -> "hai").\n' +
    "Rules:\n" +
    "- Do NOT translate to English. Only transliterate the sound of the Hindi word.\n" +
    `- Output EXACTLY ${words.length} items, in the same order — one output word per input word. ` +
    "Count them before you answer.\n" +
    "- Never merge two input words into one output item, and never split one input word into two, " +
    "even if that reads oddly.\n\n" +
    `Input (${words.length} items): ${JSON.stringify(words)}`;

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(getApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        responseSchema: { type: "ARRAY", items: { type: "STRING" } },
        // "low" is the minimum available on this model (thinking can't be
        // fully disabled) — but unlike the reasoning model this replaced,
        // Gemini keeps any internal reasoning in separate "thought" parts
        // rather than mixing it into the actual answer text, so it can't
        // leak into and corrupt the JSON output the way NVIDIA's did.
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini transliteration request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

  if (!raw.trim()) {
    throw new Error(`Gemini returned no usable text (finishReason: ${data.candidates?.[0]?.finishReason})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Transliteration response had malformed JSON: ${raw.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed) || parsed.length !== words.length) {
    const gotLength = Array.isArray(parsed) ? parsed.length : "not an array";
    throw new Error(`Transliteration returned ${gotLength} items, expected ${words.length}`);
  }

  return parsed.map((w) => String(w));
}
