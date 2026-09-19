import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Bloop Studio",
  description: "How Bloop Studio handles your video, audio, and account data.",
};

const LAST_UPDATED = "September 19, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-neutral-800 sm:py-24">
      <Link href="/" className="text-sm text-violet-600 hover:underline">
        ← Back to Bloop Studio
      </Link>
      <h1 className="mt-6 font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-neutral-600 sm:text-base">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">Your video never leaves your device</h2>
          <p className="mt-2">
            When you upload a video to Bloop Studio, the video file itself is stored and processed entirely
            in your browser (using IndexedDB/OPFS), and it is never uploaded to our servers or anyone else&apos;s.
            Captioning, person segmentation, and export all run client-side, on your machine.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">What is sent off your device — audio for transcription</h2>
          <p className="mt-2">
            To generate captions, we extract just the audio from your video (in your browser) and send that
            audio to our speech-to-text provider, ElevenLabs, to be transcribed into text with word-level
            timestamps. If you choose Hinglish subtitles, the transcribed text is additionally sent to
            Google&apos;s Gemini API to be transliterated into Roman script. Neither provider receives your
            video — only the extracted audio, or plain text derived from it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">Account information</h2>
          <p className="mt-2">
            If you create an account, we store your email address and a securely hashed version of your
            password (never the password itself) to let you log in. We use a session cookie to keep you
            signed in, valid for 24 hours. Your projects and videos are not stored on our servers even if
            you have an account — they still live only in your browser, as described above.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">The email signup form</h2>
          <p className="mt-2">
            If you submit your email through the &quot;Stay in the loop&quot; form, we store that email
            address to contact you about Bloop Studio updates. We don&apos;t sell or share it with third
            parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">No advertising trackers</h2>
          <p className="mt-2">
            Bloop Studio does not use third-party analytics, advertising, or tracking scripts (no Google
            Analytics, ad pixels, or similar) on this site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">Your rights</h2>
          <p className="mt-2">
            You can delete your locally-stored projects and videos at any time from the app itself — that
            data never left your device to begin with. To request deletion of your account or the email
            address you gave us, contact us at{" "}
            <a href="mailto:privacy@example.com" className="text-violet-600 hover:underline">
              privacy@example.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
