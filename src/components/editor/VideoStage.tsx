"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/types";
import { Compositor, findActiveSegment } from "@/lib/render/compositor";
import { getMaskAtTime } from "@/lib/pipeline/analyzeVideo";
import { getTheme, applyThemeOverrides } from "@/lib/themes/themes";
import type { SubtitleBox } from "@/lib/themes/renderSubtitle";
import { formatTime } from "@/lib/format";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  project: Project;
  videoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate: (t: number) => void;
}

interface DragState {
  segmentId: string;
  grabOffsetXNorm: number;
  grabOffsetYNorm: number;
  halfWNorm: number;
  halfHNorm: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

/**
 * Renders the live depth-aware preview: video + person-mask occlusion +
 * themed subtitle, composited on a canvas every animation frame. This is
 * the "cheap" preview path — no ffmpeg, no re-render on every edit. Also
 * doubles as the player itself (play/pause, time readout, drag-to-reposition
 * the active subtitle) so the editor doesn't need separate controls below it.
 */
export default function VideoStage({ project, videoUrl, videoRef, onTimeUpdate }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const rafRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHoveringCaption, setIsHoveringCaption] = useState(false);

  // Updated every drawn frame — used to hit-test drag start against the
  // subtitle's actual on-screen box, and to preview a drag before it's committed.
  const lastBoxRef = useRef<SubtitleBox | null>(null);
  const lastSegmentIdRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<{ segmentId: string; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const setSegmentOverride = useEditorStore((s) => s.setSegmentOverride);
  const persist = useEditorStore((s) => s.persist);

  useEffect(() => {
    compositorRef.current = new Compositor();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const theme = applyThemeOverrides(getTheme(project.themeId), project.customTheme);

    function draw() {
      if (!video || !canvas || !ctx) return;
      const t = video.currentTime;
      const segment = findActiveSegment(project.captions, t);
      const segmentWords = segment && project.transcript
        ? project.transcript.words.slice(segment.wordStartIndex, segment.wordEndIndex + 1)
        : [];
      const mask = getMaskAtTime(project.personMasks, t);

      // While a drag is in progress, render the subtitle at the in-progress
      // position instead of its committed layout — gives live feedback
      // without writing to the store (and re-running layout) on every
      // mousemove; the real position is only committed on mouseup.
      let renderSegment = segment;
      const preview = dragPreviewRef.current;
      if (segment && preview && preview.segmentId === segment.id) {
        renderSegment = {
          ...segment,
          layout: segment.layout
            ? { ...segment.layout, x: preview.x, y: preview.y }
            : { region: "bottom", x: preview.x, y: preview.y, depth: "normal" },
        };
      }

      const box = compositorRef.current?.drawFrame({
        ctx,
        video,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        segment: renderSegment,
        segmentWords,
        currentTime: t,
        theme,
        mask,
      });
      lastBoxRef.current = box ?? null;
      lastSegmentIdRef.current = renderSegment?.id ?? null;

      // Persistent "this is draggable" affordance: a dashed outline + a move
      // handle drawn right on the active caption every frame. Nothing about
      // a canvas-rendered subtitle otherwise looks interactive at all.
      if (box) drawDragAffordance(ctx, box);

      setCurrentTime(t);
      onTimeUpdate(t);
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.captions, project.personMasks, project.themeId, project.customTheme, project.transcript]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function toggleFullscreen() {
    // Fullscreening the canvas's own wrapper (not the <video>) is what keeps
    // the burned-in subtitles visible — the raw <video> element is just an
    // invisible decode source, never what's actually shown to the user.
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen().catch(() => {});
    }
  }

  /** True if a client-space point falls inside the given box (both in the
   * canvas's own coordinate space) — shared by the hover cursor check and
   * the actual drag hit-test below, so they can never disagree. */
  function hitTestBox(box: SubtitleBox, clientX: number, clientY: number): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const pxNorm = (clientX - rect.left) / rect.width;
    const pyNorm = (clientY - rect.top) / rect.height;
    const boxXNorm = box.x / canvas.width;
    const boxYNorm = box.y / canvas.height;
    const boxWNorm = box.width / canvas.width;
    const boxHNorm = box.height / canvas.height;
    return pxNorm >= boxXNorm && pxNorm <= boxXNorm + boxWNorm && pyNorm >= boxYNorm && pyNorm <= boxYNorm + boxHNorm;
  }

  function handleStagePointerMove(e: React.PointerEvent) {
    if (dragStateRef.current) return; // already dragging — cursor is fixed for the duration
    const box = lastBoxRef.current;
    setIsHoveringCaption(box ? hitTestBox(box, e.clientX, e.clientY) : false);
  }

  function handleStagePointerDown(e: React.PointerEvent) {
    // Any new press invalidates a stale suppress flag from a drag that ended
    // outside this element (so its "click" never reached us to consume it).
    suppressClickRef.current = false;

    const canvas = canvasRef.current;
    const box = lastBoxRef.current;
    const segmentId = lastSegmentIdRef.current;
    if (!canvas || !box || !segmentId) return; // no active subtitle to grab — falls through to play/pause click

    if (!hitTestBox(box, e.clientX, e.clientY)) return; // clicked elsewhere on the frame — treat as a normal play/pause tap

    const rect = canvas.getBoundingClientRect();
    const pxNorm = (e.clientX - rect.left) / rect.width;
    const pyNorm = (e.clientY - rect.top) / rect.height;

    const boxXNorm = box.x / canvas.width;
    const boxYNorm = box.y / canvas.height;
    const boxWNorm = box.width / canvas.width;
    const boxHNorm = box.height / canvas.height;

    e.preventDefault();
    const centerXNorm = boxXNorm + boxWNorm / 2;
    const centerYNorm = boxYNorm + boxHNorm / 2;

    dragStateRef.current = {
      segmentId,
      grabOffsetXNorm: pxNorm - centerXNorm,
      grabOffsetYNorm: pyNorm - centerYNorm,
      halfWNorm: boxWNorm / 2,
      halfHNorm: boxHNorm / 2,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };

    // Pointer events (not mouse-only) so dragging the subtitle works via touch too.
    const onMove = (ev: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const mxNorm = (ev.clientX - r.left) / r.width;
      const myNorm = (ev.clientY - r.top) / r.height;

      if (!state.moved && Math.hypot(ev.clientX - state.startClientX, ev.clientY - state.startClientY) > 4) {
        state.moved = true;
      }

      const newX = clamp(mxNorm - state.grabOffsetXNorm, state.halfWNorm, 1 - state.halfWNorm);
      const newY = clamp(myNorm - state.grabOffsetYNorm, state.halfHNorm, 1 - state.halfHNorm);
      dragPreviewRef.current = { segmentId: state.segmentId, x: newX, y: newY };
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      const state = dragStateRef.current;
      const preview = dragPreviewRef.current;
      dragStateRef.current = null;
      dragPreviewRef.current = null;

      if (state?.moved && preview) {
        suppressClickRef.current = true;
        const segment = project.captions.find((s) => s.id === preview.segmentId);
        setSegmentOverride(preview.segmentId, {
          region: segment?.manualOverride?.region ?? segment?.layout?.region,
          depth: segment?.manualOverride?.depth ?? segment?.layout?.depth,
          x: preview.x,
          y: preview.y,
        });
        persist();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleStageClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    togglePlay();
  }

  const aspect = project.meta.width && project.meta.height ? project.meta.width / project.meta.height : 9 / 16;

  return (
    <div
      ref={wrapperRef}
      className={`flex h-full w-full items-center justify-center ${isFullscreen ? "bg-black" : ""}`}
    >
      <div
        className={`group relative overflow-hidden bg-black ${
          isFullscreen
            ? "h-full max-h-full max-w-full"
            : "mx-auto h-full max-h-[70vh] max-w-full rounded-2xl shadow-2xl ring-1 ring-white/10"
        }`}
        style={{ aspectRatio: aspect }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          playsInline
        />
        <canvas
          ref={canvasRef}
          width={project.meta.width || 1080}
          height={project.meta.height || 1920}
          className="absolute inset-0 h-full w-full"
        />

        <div
          role="button"
          tabIndex={0}
          aria-label={isPlaying ? "Pause" : "Play"}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={() => setIsHoveringCaption(false)}
          onClick={handleStageClick}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              togglePlay();
            }
          }}
          className={`absolute inset-0 flex touch-none items-center justify-center ${
            isHoveringCaption ? "cursor-move" : "cursor-pointer"
          }`}
        >
          <span
            className={`pointer-events-none flex h-16 w-16 items-center justify-center rounded-full bg-black/55 backdrop-blur transition-opacity duration-150 ${
              isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-90"
            }`}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </span>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] text-white/90 backdrop-blur">
          {formatTime(currentTime)} / {formatTime(project.meta.durationSec)}
        </div>

        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md bg-black/55 text-white/90 backdrop-blur hover:bg-black/70"
        >
          {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2; // box bigger than the frame — center it rather than fight NaN ranges
  return Math.min(Math.max(v, min), max);
}

/** Draws a dashed outline + a small move-handle badge around the active
 * caption, every frame — the only thing that makes a canvas-rendered
 * subtitle look like something you can grab and drag, since there's no DOM
 * element under the pointer to give it a real cursor/outline for free. */
function drawDragAffordance(ctx: CanvasRenderingContext2D, box: SubtitleBox) {
  const pad = 8;
  const x = box.x - pad;
  const y = box.y - pad;
  const w = box.width + pad * 2;
  const h = box.height + pad * 2;
  const r = 10;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
  ctx.restore();

  // Move-handle badge, top-left corner of the outline.
  const cx = x + 18;
  const cy = y + 18;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "white";
  ctx.fillStyle = "white";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const arm = 7;
  // Four-way arrow cross.
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy + dy * arm);
    ctx.stroke();
    // Arrowhead
    const perpX = dy * 2.5;
    const perpY = dx * 2.5;
    const tipX = cx + dx * arm;
    const tipY = cy + dy * arm;
    ctx.beginPath();
    ctx.moveTo(tipX + dx * 3, tipY + dy * 3);
    ctx.lineTo(tipX - perpX, tipY - perpY);
    ctx.lineTo(tipX + perpX, tipY + perpY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  );
}
