import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import UploadFlow from "@/components/upload/UploadFlow";
import MyProjectsButton from "@/components/dashboard/MyProjectsButton";
import Reveal from "@/components/landing/Reveal";
import MobileNav from "@/components/landing/MobileNav";
import ScrollyHowItWorks from "@/components/landing/ScrollyHowItWorks";
import TypewriterHero from "@/components/landing/TypewriterHero";
import LeadCaptureForm from "@/components/landing/LeadCaptureForm";

const TITLE = "Bloop Studio — #1 AI Subtitles Generator with Person Masking";
const DESCRIPTION =
  "Bloop Studio is the #1 AI subtitles generator with person masking: auto-generated captions that slide behind your subject instead of sitting on top of them. Word-level sync, 17+ caption themes, runs in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI subtitles generator",
    "person masking",
    "video captions generator",
    "auto captions",
    "behind person captions",
    "depth-aware subtitles",
    "reels caption generator",
    "TikTok caption generator",
    "word-level subtitle sync",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    images: ["/screenshots/editor-full-v3.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/screenshots/editor-full-v3.png"],
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Bloop Studio",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "20",
    priceCurrency: "USD",
  },
};

// Layered, low-contrast shadow (soft ambient + tight contact) used on every
// rounded "card" surface — the thing that gives images the floating,
// editorial feel instead of a flat drop shadow.
const CARD_SHADOW =
  "shadow-[0_32px_32px_rgba(5,20,51,0.05),0_12px_12px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05)]";

const HERO_SUBLINE_SEGMENTS = [
  { text: "Captions with " },
  { text: "real depth", className: "font-semibold text-neutral-800" },
  { text: ", not a flat bar. Get subtitles that read the frame — " },
  { text: "sliding behind your subject", className: "font-semibold text-violet-600" },
  { text: " or " },
  { text: "dodging their face", className: "font-semibold text-fuchsia-600" },
  { text: " — automatically." },
];

const STICKY_NOTES: { text: string; bg: string; iconBg: string; icon: React.ReactNode; tiltClass: string }[] = [
  {
    text: "No editing skills, no timeline to fiddle with",
    bg: "bg-violet-100",
    iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    icon: <WandIcon />,
    tiltClass: "rotate-[-3deg]",
  },
  {
    text: "Word-level sync, done automatically",
    bg: "bg-cyan-100",
    iconBg: "bg-gradient-to-br from-cyan-500 to-blue-500",
    icon: (
      <span className="font-black leading-none text-white">
        <span className="text-[10px]">A</span>
        <span className="text-sm">a</span>
      </span>
    ),
    tiltClass: "rotate-[2deg]",
  },
  {
    text: "17+ ready-made caption themes to pick from",
    bg: "bg-rose-100",
    iconBg: "bg-gradient-to-br from-pink-500 to-rose-500",
    icon: <DotsIcon />,
    tiltClass: "rotate-[-2deg]",
  },
  {
    text: "Runs almost entirely in your browser",
    bg: "bg-amber-100",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    icon: <BrowserIcon />,
    tiltClass: "rotate-[3deg]",
  },
];

const STEPS: { n: string; title: string; body: string; visual: React.ReactNode }[] = [
  {
    n: "1",
    title: "Upload your clip",
    body: "Drop a talking-head video. Audio extraction and transcription kick off immediately, right on your machine.",
    visual: <StepVisualUpload />,
  },
  {
    n: "2",
    title: "AI reads the frame",
    body: "We segment the person pixel-by-pixel and score every word for emphasis based on loudness and text cues.",
    visual: (
      // eslint-disable-next-line @next/next/no-img-element -- animated GIF, next/image re-encodes and drops the animation
      <img
        src="/demo/step2-frame-scan.gif"
        alt="AI reading the frame to segment the person from the background"
        className="block h-full w-full object-cover"
      />
    ),
  },
  {
    n: "3",
    title: "Edit & export",
    body: "Drag captions right on the preview, pick a theme, and export a polished MP4 — all processed client-side.",
    visual: (
      <Image
        src="/screenshots/editor-timeline-v3.png"
        alt="Bloop Studio's timeline, showing synced caption segments over a waveform"
        fill
        className="object-cover object-top"
      />
    ),
  },
];

const FEATURES: {
  title: string;
  body: string;
  accent: string;
  glow: string;
  icon: React.ReactNode;
  large?: boolean;
}[] = [
  {
    title: "Behind-the-person subtitles",
    body: "The flagship effect: captions that visually pass behind your subject's body, using a live segmentation mask — not a CSS trick. Nothing else brings this kind of depth to a caption track.",
    accent: "from-violet-500 to-fuchsia-500",
    glow: "rgba(168,85,247,0.4)",
    icon: <LayersIcon />,
    large: true,
  },
  {
    title: "Word-level emphasis",
    body: "Loud, punchy, or content-heavy words render bigger automatically — no manual keyframing needed.",
    accent: "from-cyan-500 to-blue-500",
    glow: "rgba(34,211,238,0.35)",
    icon: (
      <span className="font-black leading-none text-white">
        <span className="text-[11px]">A</span>
        <span className="text-[17px]">a</span>
      </span>
    ),
  },
  {
    title: "17+ attractive themes",
    body: "Minimal, Bold, Karaoke, Collage, Cascade, Colossal, Marker, Headline — swap any time without reprocessing.",
    accent: "from-pink-500 to-rose-500",
    glow: "rgba(244,63,94,0.35)",
    icon: <DotsIcon />,
  },
  {
    title: "Drag anything",
    body: "Reposition a caption right on the video preview, or drag its timing on the timeline — clamped so it never breaks.",
    accent: "from-amber-500 to-orange-500",
    glow: "rgba(245,158,11,0.35)",
    icon: <MoveIcon />,
  },
  {
    title: "Smart auto-layout",
    body: "Captions avoid the speaker's face and dodge into empty space automatically, with hysteresis so they don't jitter.",
    accent: "from-emerald-500 to-teal-500",
    glow: "rgba(16,185,129,0.35)",
    icon: <GridIcon />,
  },
  {
    title: "Private by default",
    body: "Your video and projects stay on your device (OPFS/IndexedDB) — nothing is uploaded except audio for transcription.",
    accent: "from-indigo-500 to-violet-500",
    glow: "rgba(99,102,241,0.35)",
    icon: <LockIcon />,
  },
];

const PRICING_FEATURES = [
  "Unlimited subtitle generation",
  "High-quality video export",
  "Access to every caption theme",
];

export default function LandingPage() {
  return (
    <main className="relative flex-1 bg-[#FCFAF7] text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      {/* Floating pill nav — narrower than the page, rounded-full, sits above
          the content instead of stretching edge-to-edge. */}
      <div className="sticky top-4 z-40 mx-auto w-full max-w-4xl px-4">
        <nav className="flex items-center justify-between rounded-full border border-neutral-200 bg-[#FCFAF7]/95 px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_10px_rgba(0,0,0,0.05)] backdrop-blur-md">
          <Link href="/" className="flex items-center pl-1">
            <Image src="/logo/bloop-wordmark-black.png" alt="Bloop Studio" width={951} height={408} className="h-7 w-auto" priority />
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#pricing" shine>
              Pricing
            </NavLink>
          </div>

          <div className="flex items-center gap-3 pr-0.5 sm:gap-4">
            <MyProjectsButton className="hidden rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-white disabled:opacity-50 sm:inline-block" />
            <a
              href="#upload"
              className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-90"
            >
              Get started
            </a>
            <MobileNav />
          </div>
        </nav>
      </div>

      {/* Ambient tint — soft color washes behind the hero, kept low-opacity
          so the section still reads as clean/warm rather than noisy. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden">
        <div className="absolute -left-40 top-[-160px] h-[520px] w-[520px] rounded-full bg-violet-300/25 blur-[110px]" />
        <div className="absolute -right-40 top-[-60px] h-[480px] w-[480px] rounded-full bg-cyan-300/20 blur-[110px]" />
      </div>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pb-28 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            ✦ #1 AI Subtitles Generator
          </span>
          <h1 className="mt-6 font-gabarito text-5xl font-extrabold leading-[0.98] tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
            The #1 AI Subtitles Generator{" "}
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
              with Person Masking
            </span>
          </h1>
          <p className="hero-subline mt-6 max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg">
            <TypewriterHero segments={HERO_SUBLINE_SEGMENTS} />
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#upload"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-90"
            >
              <UploadGlyphIcon />
              Upload a video
            </a>
            <a
              href="#how-it-works"
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-white"
            >
              See how it works
            </a>
          </div>
        </div>

        <div id="upload" className="scroll-mt-24">
          <p className="mb-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center font-gabarito text-2xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
            <CheckIcon size={26} />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
              No account needed
            </span>
            <span>to try it</span>
          </p>
          <div className={`upload-target-card relative rounded-[28px] border border-neutral-200 bg-white p-3 ${CARD_SHADOW} sm:p-4`}>
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            </div>
            <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/95 p-4 text-neutral-100 sm:p-5">
              <UploadFlow />
            </div>

            <div className="absolute -bottom-6 -left-4 hidden max-w-[220px] items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_16px_32px_rgba(5,20,51,0.08),0_1px_1px_rgba(0,0,0,0.05)] sm:flex">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
                <LayersMiniIcon />
              </span>
              <div>
                <p className="text-xs font-semibold text-neutral-900">Depth-aware masking</p>
                <p className="text-[11px] leading-snug text-neutral-500">Captions duck behind your subject automatically.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="flex flex-col items-center gap-8 rounded-3xl border border-neutral-200 bg-white p-6 sm:flex-row sm:gap-10 sm:p-8">
          <div className="w-[220px] shrink-0 sm:w-[260px]">
            <div className={`overflow-hidden rounded-2xl border border-neutral-200 ${CARD_SHADOW}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF, next/image re-encodes and drops the animation */}
              <img src="/demo/hero-demo.gif" alt="Concept preview — placeholder, local only" className="block h-auto w-full" />
            </div>
            <p className="mt-2 text-center text-[11px] text-neutral-400"></p>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-gabarito text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-neutral-900">Sit relax —</span>{" "}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
                we auto-detect bheind you
              </span>{" "}
              <span className="text-neutral-900">and add subtitles in one click :)</span>
            </p>
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STICKY_NOTES.map((note) => (
                <div
                  key={note.text}
                  className={`group relative rounded-lg p-4 text-left shadow-[0_6px_16px_-4px_rgba(0,0,0,0.15)] transition-transform duration-300 hover:rotate-0 hover:scale-105 ${note.tiltClass} ${note.bg}`}
                >
                  <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white/70 shadow-sm" />
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${note.iconBg}`}>{note.icon}</span>
                  <p className="mt-2.5 text-sm font-medium leading-snug text-neutral-800">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20 text-center sm:py-28">
        <Reveal>
          <h2 className="font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            This is the actual editor
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500 sm:text-base">
            Not a mockup — this screenshot is the real interface: theme picker, per-segment
            controls, and a scrubbable timeline, all in one screen.
          </p>
        </Reveal>
        <Reveal delay={150}>
          <div className={`mx-auto mt-10 max-w-4xl rounded-2xl border border-[#E1E2E5] bg-white p-2 ${CARD_SHADOW} sm:p-3`}>
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            </div>
            <Image
              src="/screenshots/editor-full-v3.png"
              alt="Bloop Studio's editor: video preview with a bold caption theme applied, segment list, theme picker, and timeline"
              width={1440}
              height={900}
              className="h-auto w-full rounded-xl border border-neutral-800/60"
            />
          </div>
        </Reveal>
      </section>

      <section id="how-it-works" className="scroll-mt-20 mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="mb-12 text-center">
            <h2 className="font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Three steps to a polished reel
            </h2>
            <p className="mt-3 text-sm text-neutral-500 sm:text-base">No timeline scrubbing, no manual keyframes.</p>
          </div>
        </Reveal>
        <ScrollyHowItWorks steps={STEPS} />
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 text-center sm:pb-28">
        <div
          className="pointer-events-none absolute inset-x-0 top-10 -z-10 h-72 opacity-60"
          style={{ background: "radial-gradient(ellipse 50% 100% at 50% 0%, rgba(6,182,212,0.12), transparent)" }}
        />
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            ✦ Frame-accurate editing
          </span>
          <h2 className="mt-4 font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Fine-tune every word, frame by frame
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500 sm:text-base">
            Every caption segment lines up under its own stretch of the waveform — drag its
            timing, retime it, or nudge it in place directly on the frame.
          </p>
        </Reveal>
        <Reveal delay={150} direction="left">
          <div className={`mx-auto mt-10 max-w-3xl rounded-2xl border border-[#E1E2E5] bg-white p-2 ${CARD_SHADOW} sm:p-3`}>
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <span className="ml-2 text-[11px] font-medium text-neutral-400">Timeline — synced to the waveform</span>
            </div>
            <div className="overflow-hidden rounded-xl">
              <Image
                src="/screenshots/editor-timeline-v3.png"
                alt="Close-up of Bloop Studio's timeline with synced caption segments over an audio waveform"
                width={734}
                height={180}
                className="h-auto w-full"
              />
            </div>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <a
            href="#upload"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-90"
          >
            <UploadGlyphIcon />
            Try it on your own clip
          </a>
        </Reveal>
      </section>

      <section id="features" className="relative scroll-mt-20 overflow-hidden bg-neutral-950 py-20 sm:py-28">
        {/* Faint dot-grid texture — the literal "depth" cue behind the
            section that's actually about depth, instead of a flat black bg. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-40"
          style={{ background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(124,58,237,0.25), transparent)" }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-6">
          <Reveal>
            <div className="mb-12 text-center">
              <h2 className="font-gabarito text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Built for depth, not just decoration
              </h2>
              <p className="mt-3 text-sm text-neutral-400 sm:text-base">
                Everything below runs the same at export time as it does in the live preview.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 3) * 100}
                direction="up"
                className={f.large ? "sm:col-span-2 sm:row-span-2" : ""}
              >
                <div
                  className={`feature-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 ${
                    f.large ? "sm:p-7" : ""
                  }`}
                  style={{ "--glow": f.glow } as React.CSSProperties}
                >
                  {/* Always-on color strip — gives every card a quiet hit of
                      its own accent at rest, not just a flat gray box until hovered. */}
                  <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-70 ${f.accent}`} />
                  {/* Soft corner glow in the feature's own accent — the thing
                      that stops every card from reading as the same flat box. */}
                  <div
                    className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30 ${f.accent}`}
                  />
                  <span className="absolute right-4 top-4 rounded-full bg-white/5 px-2 py-0.5 font-gabarito text-[10px] font-semibold text-white/30 transition-colors duration-300 group-hover:text-white/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div
                    className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${f.accent} ${
                      f.large ? "h-11 w-11" : "h-9 w-9"
                    }`}
                  >
                    {f.icon}
                  </div>
                  <h3 className={`relative mt-3.5 font-semibold text-white ${f.large ? "text-lg" : "text-sm"}`}>
                    {f.title}
                  </h3>
                  <p
                    className={`relative mt-2 leading-relaxed text-neutral-400 ${f.large ? "text-sm sm:text-base" : "text-sm"}`}
                  >
                    {f.body}
                  </p>

                  {f.large && (
                    <div className="relative mt-6 flex flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 py-10">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <DepthDemo />
                      <div className="relative mt-5 flex items-center gap-4 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> behind
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> in front
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="mb-12 text-center">
            <h2 className="font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Simple, one-plan pricing
            </h2>
            <p className="mt-3 text-sm text-neutral-500 sm:text-base">No tiers to compare — everything, one price.</p>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className={`mx-auto max-w-sm rounded-3xl border border-violet-200 bg-white p-8 text-center ${CARD_SHADOW}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Pro</p>
            <p className="mt-3 flex items-baseline justify-center gap-1">
              <span className="font-gabarito text-5xl font-extrabold tracking-tight text-neutral-900">$20</span>
              <span className="text-sm font-medium text-neutral-500">/month</span>
            </p>
            <ul className="mt-6 space-y-3 text-left">
              {PRICING_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-8 block rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 px-6 py-16 text-center sm:px-12">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-300/30 to-cyan-300/20 blur-[100px]" />
            <h2 className="relative font-gabarito text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Give your next reel some depth
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm text-neutral-500 sm:text-base">
              Upload a clip and see behind-the-person captions on your own footage in under a minute.
            </p>
            <a
              href="#upload"
              className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-90"
            >
              <UploadGlyphIcon />
              Upload a video
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-2">
            <Image src="/logo/bloop-wordmark-black.png" alt="Bloop Studio" width={951} height={408} className="h-6 w-auto" />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-neutral-900">
              Your video never leaves your device except as audio, sent only for transcription.
            </p>
            <LeadCaptureForm />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-900">
              <li>
                <a href="#upload" className="transition-colors hover:text-violet-600">
                  New project
                </a>
              </li>
              <li>
                <MyProjectsButton className="text-sm text-neutral-900 transition-colors hover:text-violet-600 disabled:opacity-50" />
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-violet-600">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-violet-600">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Built different</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-900">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /> Client-side rendering
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" /> Depth-aware occlusion
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" /> No install required
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-900">
          © {new Date().getFullYear()} Bloop Studio
        </div>
      </footer>
    </main>
  );
}

/** A nav link with a soft "card" that pops in behind the text on hover.
 * `shine` adds a periodic light sweep across that card even at rest, to
 * draw the eye to Pricing without needing a hover. */
function NavLink({ href, shine, children }: { href: string; shine?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group relative rounded-full px-3.5 py-1.5 text-sm text-neutral-900 transition-colors hover:text-violet-600"
    >
      <span
        className={`absolute inset-0 rounded-full transition-all duration-200 ease-out ${
          shine
            ? "scale-100 bg-gradient-to-r from-violet-200 to-fuchsia-200 opacity-100 shadow-[0_1px_2px_rgba(124,58,237,0.25)] group-hover:from-violet-300 group-hover:to-fuchsia-300"
            : "scale-90 bg-white opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] group-hover:scale-100 group-hover:opacity-100"
        }`}
      />
      {shine && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-white/90 mix-blend-plus-lighter blur-[1px] [animation:shine-sweep_3s_ease-in-out_infinite]" />
        </span>
      )}
      <span className="relative">{children}</span>
    </a>
  );
}

/** A tiny, always-looping recreation of the actual behind-the-person effect —
 * the word passes behind the "person" on one side of its travel and in front
 * on the other, purely so this is something you *watch happen* instead of a
 * paragraph asking you to imagine it. */
function DepthDemo() {
  return (
    <div className="relative flex h-20 items-center justify-center sm:h-24">
      <div className="pointer-events-none absolute h-24 w-24 rounded-full bg-violet-500/20 blur-2xl sm:h-28 sm:w-28" />
      <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 shadow-[0_8px_20px_rgba(0,0,0,0.4)] sm:h-20 sm:w-20">
        <PersonSilhouetteIcon />
      </div>
      <span className="depth-demo-word absolute bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text font-gabarito text-lg font-bold tracking-wide text-transparent sm:text-xl">
        depth.
      </span>
    </div>
  );
}

function PersonSilhouetteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-90">
      <circle cx="12" cy="8" r="3.5" fill="white" />
      <path d="M5 20c1.2-4.2 4.2-6.5 7-6.5s5.8 2.3 7 6.5" fill="white" />
    </svg>
  );
}

function StepVisualUpload() {
  return (
    <a
      href="#upload"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 sm:p-10"
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white/70 transition-colors hover:border-violet-400 hover:bg-white">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg sm:h-14 sm:w-14">
          <UploadGlyphIcon />
        </span>
        <p className="text-sm font-semibold text-neutral-700 sm:text-base">Drop your video here</p>
        <p className="text-xs text-neutral-400">or click to browse — MP4, MOV, WebM</p>
      </div>
    </a>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0 text-emerald-500">
      <path d="M4 10.5l3.5 3.5L16 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadGlyphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayersMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-white" style={{ opacity: 0.4 + (i % 3) * 0.3 }} />
      ))}
    </div>
  );
}

function MoveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v18M3 12h18M6 6l-3 3 3 3M18 6l3 3-3 3M6 18l-3-3 3-3M18 18l3-3-3-3"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.6" opacity="0.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.6" opacity="0.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.6" opacity="0.6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="white" strokeWidth="1.6" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 20L15 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="white" />
      <path d="M6 13l.6 1.4L8 15l-1.4.6L6 17l-.6-1.4L4 15l1.4-.6L6 13z" fill="white" />
    </svg>
  );
}

function BrowserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="white" strokeWidth="1.6" />
      <path d="M3 8.5h18" stroke="white" strokeWidth="1.6" />
      <circle cx="6" cy="6.25" r="0.75" fill="white" />
      <circle cx="8.5" cy="6.25" r="0.75" fill="white" />
    </svg>
  );
}
