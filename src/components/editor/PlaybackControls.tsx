"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  fps: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

/**
 * Transport bar under the preview: frame-step, play/pause, volume, and the
 * timeline zoom slider. Zoom is the thing that actually matters for long
 * videos — Timeline renders a wider virtual track and scrolls/auto-follows
 * the playhead once zoom > 1, instead of squeezing every caption into one
 * fixed-width bar.
 */
export default function PlaybackControls({ videoRef, currentTime, duration, fps, zoom, onZoomChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

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

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function stepFrame(dir: 1 | -1) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.min(Math.max(video.currentTime + dir / fps, 0), duration);
  }

  function handleVolume(v: number) {
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {/* On mobile these two wrappers are real flex rows (transport controls
          on top, volume/zoom below); sm:contents dissolves them at the sm
          breakpoint so all four children become one flat row again, restoring
          the original single-line desktop layout exactly. */}
      <div className="flex items-center justify-between gap-3 sm:contents">
        <span className="shrink-0 font-mono text-xs text-neutral-400 sm:w-28">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center justify-center gap-3 sm:flex-1">
          <IconButton label="Previous frame" onClick={() => stepFrame(-1)}>
            <StepIcon flipped />
          </IconButton>
          <IconButton label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} primary>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton label="Next frame" onClick={() => stepFrame(1)}>
            <StepIcon />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 sm:contents">
        <div className="flex shrink-0 items-center gap-2">
          <VolumeIcon muted={volume === 0} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="h-1 w-16 accent-violet-500 sm:w-20"
            aria-label="Volume"
          />
        </div>

        <div
          className="flex shrink-0 items-center gap-2 sm:border-l sm:border-neutral-800 sm:pl-4"
          title="Zoom the timeline below to space out captions on a long clip"
        >
          <span className="hidden text-[11px] font-medium uppercase tracking-wide text-neutral-500 sm:inline">
            Timeline zoom
          </span>
          <button
            onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 1))}
            aria-label="Zoom out timeline"
            className="text-neutral-500 hover:text-neutral-100"
          >
            <ZoomIcon out />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.5}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="h-1 w-16 accent-violet-500 sm:w-24"
            aria-label="Timeline zoom"
          />
          <button
            onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 1))}
            aria-label="Zoom in timeline"
            className="text-neutral-500 hover:text-neutral-100"
          >
            <ZoomIcon />
          </button>
          <span className="w-7 shrink-0 text-right font-mono text-[11px] text-neutral-500">{zoom.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        primary
          ? "bg-gradient-to-br from-violet-600 to-cyan-600 text-white"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

function StepIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={flipped ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M4 5v14l10-7L4 5z" />
      <rect x="17" y="5" width="3" height="14" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-400">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {!muted && (
        <path
          d="M16.5 8.5a5 5 0 010 7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

function ZoomIcon({ out }: { out?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20l-4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {out ? (
        <path d="M7.5 10h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M10 7.5v5M7.5 10h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
