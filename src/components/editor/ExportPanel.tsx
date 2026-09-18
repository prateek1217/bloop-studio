"use client";

import { useState } from "react";
import type { Project } from "@/types";
import { exportVideo } from "@/lib/render/exportVideo";
import { getTheme, applyThemeOverrides } from "@/lib/themes/themes";
import { useAuthGate } from "@/lib/auth/useAuthGate";
import AuthRequiredModal from "@/components/auth/AuthRequiredModal";

interface Props {
  project: Project;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function ExportPanel({ project, videoRef }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "encoding" | "done" | "error">("idle");
  const [fraction, setFraction] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { checking: checkingAuth, showAuthModal, authRedirectTo, closeAuthModal, requireAuth } = useAuthGate();

  function handleExport() {
    requireAuth(`/editor/${project.meta.id}`, runExport);
  }

  async function runExport() {
    const video = videoRef.current;
    if (!video || !project.transcript) return;

    setError(null);
    setDownloadUrl(null);
    setPhase("recording");
    setFraction(0);

    try {
      const theme = applyThemeOverrides(getTheme(project.themeId), project.customTheme);
      const blob = await exportVideo({
        video,
        words: project.transcript.words,
        captions: project.captions,
        masks: project.personMasks,
        theme,
        width: project.meta.width || 1080,
        height: project.meta.height || 1920,
        durationHint: project.meta.durationSec,
        onProgress: (p, f) => {
          setPhase(p);
          setFraction(f);
        },
      });
      setDownloadUrl(URL.createObjectURL(blob));
      setPhase("done");
    } catch (err) {
      console.error("Export failed:", err);
      setError(describeExportError(err));
      setPhase("error");
    }
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={checkingAuth || phase === "recording" || phase === "encoding"}
        className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {checkingAuth
          ? "Checking…"
          : phase === "recording"
          ? `Recording… ${Math.round(fraction * 100)}%`
          : phase === "encoding"
          ? `Encoding… ${Math.round(fraction * 100)}%`
          : "Export MP4"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={`${project.meta.name}.mp4`}
          className="mt-2 block text-center text-xs font-medium text-emerald-400 underline"
        >
          Download {project.meta.name}.mp4
        </a>
      )}
      {showAuthModal && <AuthRequiredModal redirectTo={authRedirectTo} onClose={closeAuthModal} />}
    </div>
  );
}

/** Extracts a readable message from any thrown value. `DOMException` (e.g. the
 * `NotAllowedError` a blocked `video.play()` rejects with) does NOT extend
 * `Error` per spec, so a plain `err instanceof Error` check silently drops its
 * actual message and every other non-Error rejection down to a useless
 * generic string — this is what surfaced as an unhelpful "Export failed"
 * with no detail. */
function describeExportError(err: unknown): string {
  if (err instanceof DOMException) return `${err.name}: ${err.message}`;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Export failed";
  }
}
