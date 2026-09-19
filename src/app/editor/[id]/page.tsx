"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useEditorStore } from "@/store/editorStore";
import { checkAuth } from "@/lib/auth/client";
import VideoStage from "@/components/editor/VideoStage";
import PlaybackControls from "@/components/editor/PlaybackControls";
import Timeline from "@/components/editor/Timeline";
import SegmentList from "@/components/editor/SegmentList";
import StylePanel from "@/components/editor/StylePanel";
import EditorSidebar from "@/components/editor/EditorSidebar";
import HeaderStyleControls from "@/components/editor/HeaderStyleControls";
import ExportPanel from "@/components/editor/ExportPanel";

type MobileTab = "segments" | "style";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useEditorStore((s) => s.project);
  const videoUrl = useEditorStore((s) => s.videoUrl);
  const loadProject = useEditorStore((s) => s.loadProject);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Below `lg` there isn't room for the icon-rail sidebar next to the video,
  // so Segments/Style become tabs instead — the video+timeline stay pinned
  // above them either way. At `lg`+ this tab bar is hidden entirely in favor
  // of EditorSidebar.
  const [mobileTab, setMobileTab] = useState<MobileTab>("segments");
  // Defaults to the landing page — swapped to /projects as soon as we learn
  // the visitor actually has an account, so a logged-out visitor (or the
  // brief moment before the check resolves) still goes somewhere sensible.
  const [backHref, setBackHref] = useState("/");
  // Export re-plays and records the live preview's own video element in real
  // time (see exportVideo.ts) — seeking, editing captions, or navigating away
  // mid-export would corrupt that capture, not just look confusing, so the
  // whole editor locks while it's running.
  const [exportStatus, setExportStatus] = useState({ exporting: false, phase: "idle" as string, fraction: 0 });

  useEffect(() => {
    loadProject(id);
  }, [id, loadProject]);

  useEffect(() => {
    checkAuth()
      .then(({ authenticated }) => {
        if (authenticated) setBackHref("/projects");
      })
      .catch(() => {});
  }, []);

  if (!project || !videoUrl) {
    return (
      <main className="flex flex-1 items-center justify-center bg-neutral-950 text-neutral-400">
        Loading project…
      </main>
    );
  }

  if (project.meta.stage !== "ready" && project.meta.stage !== "completed") {
    return (
      <main className="flex flex-1 items-center justify-center bg-neutral-950 text-neutral-400">
        This project is still processing ({project.meta.stage}). Head back to the dashboard and try again shortly.
      </main>
    );
  }

  const selectedSegment = project.captions.find((s) => s.id === selectedId) ?? null;

  function seek(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t;
  }

  return (
    <main className="flex flex-1 flex-col overflow-visible bg-neutral-950 lg:overflow-hidden">
      <header className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <Link href={backHref} className="shrink-0 text-neutral-500 hover:text-neutral-300" aria-label="Back to dashboard">
            ←
          </Link>
          <h1 className="truncate text-sm font-medium text-neutral-100">{project.meta.name}</h1>
        </div>

        {/* Laptop/tablet only: the header has dead space here otherwise, and
            these are the controls people reach for constantly but had to
            scroll past the whole theme grid to find in StylePanel. Mobile
            has no equivalent spare header room, so it keeps everything in
            the Style tab instead (see the `lg:hidden` sections there). */}
        <div className="hidden min-w-0 flex-1 items-center justify-center overflow-x-auto lg:flex">
          <HeaderStyleControls project={project} selectedSegment={selectedSegment} />
        </div>

        <div className="w-28 shrink-0 sm:w-48">
          <ExportPanel project={project} videoRef={videoRef} onStatusChange={setExportStatus} />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-visible lg:min-h-0 lg:flex-row lg:overflow-hidden">
        {/* Icon rail + expandable Segments/Theme panel — lg+ only. */}
        <EditorSidebar project={project} selectedId={selectedId} selectedSegment={selectedSegment} onSelect={setSelectedId} />

        <div className="flex flex-1 flex-col gap-3 overflow-visible p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden">
          <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-4 lg:min-h-0 lg:flex-1">
            <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              <span>Preview</span>
              {selectedSegment?.layout && (
                <span className="text-neutral-400">
                  {selectedSegment.layout.region} · {selectedSegment.layout.depth.replace("_", " ")}
                </span>
              )}
            </div>
            <DragHint />
            {/* h-[60vh] etc.: below `lg` the column is sized by content, not
                a fixed-height grid row, so VideoStage's own h-full chain
                needs an explicit height here to bottom out on — flex-1 alone
                has nothing to fill against and collapses to 0. At `lg` the
                flex row provides that height instead, so this reverts to fill. */}
            <div className="flex h-[60vh] items-center justify-center overflow-hidden sm:h-[65vh] lg:h-auto lg:min-h-0 lg:flex-1">
              <VideoStage
                project={project}
                videoUrl={videoUrl}
                videoRef={videoRef}
                onTimeUpdate={setCurrentTime}
                isExporting={exportStatus.exporting}
              />
            </div>
          </section>

          {/* Segments/Style tab switcher — only shown below `lg`, where the
              icon-rail sidebar doesn't fit next to the video. */}
          <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 lg:hidden">
            {(["segments", "style"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                  mobileTab === tab
                    ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={`${mobileTab === "segments" ? "block" : "hidden"} rounded-2xl border border-neutral-800 bg-neutral-900 p-3 lg:hidden`}>
            <SegmentList captions={project.captions} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          <div className={`${mobileTab === "style" ? "block" : "hidden"} rounded-2xl border border-neutral-800 bg-neutral-900 p-3 lg:hidden`}>
            <StylePanel project={project} selectedSegment={selectedSegment} />
          </div>
        </div>
      </div>

      {/* Full-width, spanning under the sidebar and preview above — this is
          the thing that actually needs horizontal room to be useful once a
          clip runs more than ~30s and zoom comes into play. */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900 px-3 py-3 sm:px-4">
        <PlaybackControls
          videoRef={videoRef}
          currentTime={currentTime}
          duration={project.meta.durationSec}
          fps={project.meta.fps || 30}
          zoom={zoom}
          onZoomChange={setZoom}
        />
        <div className="mt-3">
          <Timeline
            duration={project.meta.durationSec}
            currentTime={currentTime}
            captions={project.captions}
            waveformPeaks={project.waveformPeaks}
            selectedId={selectedId}
            zoom={zoom}
            onSeek={seek}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {exportStatus.exporting && <ExportBlockingOverlay phase={exportStatus.phase} fraction={exportStatus.fraction} />}
    </main>
  );
}

/** Covers the whole editor (including the sticky header) so nothing can be
 * clicked, scrubbed, or dragged while export is recording/encoding — see the
 * comment on exportStatus above for why that's a correctness issue, not just
 * a UX one. No close button; it clears itself once ExportPanel reports the
 * phase has moved past recording/encoding. */
function ExportBlockingOverlay({ phase, fraction }: { phase: string; fraction: number }) {
  const label = phase === "encoding" ? "Encoding" : "Recording";
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-neutral-950/90 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-500" />
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          {label}… {Math.round(fraction * 100)}%
        </p>
        <p className="mt-1 text-xs text-neutral-400">Exporting your video — please don&apos;t close or edit anything until this finishes.</p>
      </div>
    </div>
  );
}

const DRAG_HINT_KEY = "bloop-editor-drag-hint-dismissed";

/** One-time nudge toward the drag-to-reposition feature — the canvas overlay
 * in VideoStage shows a move handle on the caption itself every time, but
 * this spells it out in words the very first time someone opens the editor. */
function DragHint() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DRAG_HINT_KEY) === "1";
  });

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DRAG_HINT_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-violet-800 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
      <span>
        <span aria-hidden>💡</span> Drag the caption right on the preview to reposition it — depth and region update
        automatically.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="shrink-0 rounded px-1.5 py-0.5 text-violet-400 hover:bg-violet-500/20 hover:text-violet-200"
      >
        ✕
      </button>
    </div>
  );
}
