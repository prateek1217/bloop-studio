"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProcessingStage, SubtitleLanguage } from "@/types";
import { runProcessingPipeline } from "@/lib/pipeline/runPipeline";
import { useAuthGate } from "@/lib/auth/useAuthGate";
import AuthRequiredModal from "@/components/auth/AuthRequiredModal";

// Anonymous visitors can generate subtitles for a clip up to this long with
// no account at all ("no account needed to try it"); anything longer needs a
// free login, since the transcription call behind it costs real money per
// second of audio (ElevenLabs), unlike the purely client-side stages.
const FREE_DURATION_LIMIT_SEC = 60;

function getVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read video duration"));
    };
  });
}

// Deliberately vague — these are shown to the user instead of the actual
// pipeline stage names (transcribing, segmenting, etc.) so processing reads
// as one smooth experience rather than a list of internal implementation
// steps. Keyed by the fraction of overall progress at which each kicks in.
const PROCESSING_MESSAGES: { upTo: number; label: string }[] = [
  { upTo: 0.12, label: "Reading your video…" },
  { upTo: 0.4, label: "Listening closely…" },
  { upTo: 0.85, label: "Adding the magic…" },
  { upTo: 1, label: "Wrapping up…" },
];

function processingLabel(overall: number): string {
  return PROCESSING_MESSAGES.find((m) => overall <= m.upTo)?.label ?? "Wrapping up…";
}

const BASE_STAGE_ORDER: ProcessingStage[] = [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "segmenting",
  "analyzing_video",
  "generating_layout",
  "ready",
];

const HINGLISH_STAGE_ORDER: ProcessingStage[] = [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "transliterating",
  "segmenting",
  "analyzing_video",
  "generating_layout",
  "ready",
];

const LANGUAGE_OPTIONS: { value: SubtitleLanguage; label: string; hint: string }[] = [
  { value: "en", label: "English", hint: "Current pipeline" },
  { value: "hi", label: "Hindi", hint: "Devanagari script" },
  { value: "hi-en", label: "Hinglish", hint: "Hindi, Roman script" },
];

type FlowStage = "idle" | "selected" | "processing" | "error";

interface Props {
  /** Pre-supplied file (e.g. from a file input opened elsewhere, like the
   * /projects dashboard's "New project" button) — skips straight to the
   * preview step instead of showing this component's own drop zone. */
  initialFile?: File;
}

/**
 * The upload -> preview -> generate -> editor flow. A file drop/pick only
 * stages the video; processing (and the eventual redirect into the editor)
 * only starts once the user confirms with "Generate subtitles", so they get
 * a chance to see what they picked first.
 */
export default function UploadFlow({ initialFile }: Props) {
  const router = useRouter();
  const [flowStage, setFlowStage] = useState<FlowStage>(initialFile ? "selected" : "idle");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    initialFile ? URL.createObjectURL(initialFile) : null
  );
  const [language, setLanguage] = useState<SubtitleLanguage>("en");
  const [stage, setStage] = useState<ProcessingStage | null>(null);
  const [fraction, setFraction] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { checking: checkingAuth, showAuthModal, authRedirectTo, closeAuthModal, requireAuth } = useAuthGate();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setFlowStage("selected");
    setError(null);
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFlowStage("idle");
    setError(null);
  }

  const startPipeline = useCallback(async () => {
    if (!file) return;
    setFlowStage("processing");
    setStage("uploaded");
    setFraction(0);
    try {
      const id = await runProcessingPipeline(
        file,
        file.name.replace(/\.[^.]+$/, ""),
        { onStage: setStage, onProgress: setFraction },
        language
      );
      router.push(`/editor/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setFlowStage("error");
    }
  }, [file, language, router]);

  // Transcription (ElevenLabs) costs real money per second of audio, unlike
  // the other client-side stages — so anonymous visitors get a free preview
  // up to FREE_DURATION_LIMIT_SEC, and anything longer needs a login. Signed-in
  // users always pass, regardless of length.
  const generate = useCallback(async () => {
    if (!file) return;
    try {
      const durationSec = await getVideoDurationSec(file);
      if (durationSec > FREE_DURATION_LIMIT_SEC) {
        await requireAuth("/", startPipeline);
        return;
      }
    } catch {
      // Couldn't read duration up front — let the pipeline's own metadata
      // read surface any real problem with the file instead of blocking here.
    }
    startPipeline();
  }, [file, requireAuth, startPipeline]);

  const stageOrder = language === "hi-en" ? HINGLISH_STAGE_ORDER : BASE_STAGE_ORDER;
  const stageIndex = stage ? stageOrder.indexOf(stage) : -1;

  if (flowStage === "processing") {
    const overall = Math.min(1, Math.max(0, stageIndex >= 0 ? (stageIndex + fraction) / (stageOrder.length - 1) : 0));
    const percent = Math.round(overall * 100);
    const circumference = 2 * Math.PI * 44;

    return (
      <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-neutral-800" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="url(#uploadProgressGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - overall)}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
              <defs>
                <linearGradient id="uploadProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-lg font-semibold text-white">{percent}%</span>
          </div>

          <div className="text-center">
            <p className="text-base font-medium text-white">{processingLabel(overall)}</p>
            <p className="mt-1 text-xs text-neutral-500">This usually takes a minute or two.</p>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, percent)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (flowStage === "selected" && file && previewUrl) {
    return (
      <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex gap-4">
          <video
            src={previewUrl}
            controls
            className="h-40 w-24 shrink-0 rounded-lg bg-black object-cover sm:h-48 sm:w-28"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
            <div>
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="mt-1 text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-xs text-neutral-500">Subtitle language</p>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLanguage(opt.value)}
                    title={opt.hint}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      language === opt.value
                        ? "border-violet-400 bg-violet-500/15 text-violet-200"
                        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={generate}
                disabled={checkingAuth}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.7)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {checkingAuth ? "Checking…" : "Generate subtitles →"}
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                Choose different video
              </button>
            </div>
          </div>
        </div>
        {showAuthModal && (
          <AuthRequiredModal
            redirectTo={authRedirectTo}
            onClose={closeAuthModal}
            title="It's free"
            description="Clips up to a minute are always free, no account needed. This one's longer, so log in or create a free account to keep going."
          />
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-14 ${
        dragOver ? "border-violet-400 bg-violet-500/10" : "border-neutral-800 hover:border-violet-500/50"
      }`}
    >
      <p className="text-base font-medium sm:text-lg">Drop a talking-head video here</p>
      <p className="text-sm text-neutral-500">or click to browse — MP4, MOV, WebM</p>
      {flowStage === "error" && error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
