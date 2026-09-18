"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CaptionSegment } from "@/types";
import { formatTime } from "@/lib/format";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  duration: number;
  currentTime: number;
  captions: CaptionSegment[];
  waveformPeaks?: number[];
  selectedId: string | null;
  /** 1 = fully zoomed out (fits the whole clip). Higher = narrower visible window, more precision. */
  zoom: number;
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
}

export default function Timeline({
  duration,
  currentTime,
  captions,
  waveformPeaks,
  selectedId,
  zoom,
  onSeek,
  onSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const moveSegmentTiming = useEditorStore((s) => s.moveSegmentTiming);
  const persist = useEditorStore((s) => s.persist);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = tracksRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const fraction = (clientX - rect.left) / rect.width;
      onSeek(Math.min(Math.max(fraction, 0), 1) * duration);
    },
    [duration, onSeek]
  );

  useEffect(() => {
    if (!isScrubbing) return;
    // Pointer events (not mouse-only) so scrubbing works via touch too.
    const onMove = (e: PointerEvent) => seekFromClientX(e.clientX);
    const onUp = () => setIsScrubbing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isScrubbing, seekFromClientX]);

  // Keep the playhead in view when zoomed in enough that the timeline scrolls.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const tracksEl = tracksRef.current;
    if (!scrollEl || !tracksEl || !duration) return;

    const playheadPx = (currentTime / duration) * tracksEl.offsetWidth;
    const viewStart = scrollEl.scrollLeft;
    const viewEnd = viewStart + scrollEl.clientWidth;
    const margin = scrollEl.clientWidth * 0.1;

    if (playheadPx < viewStart + margin || playheadPx > viewEnd - margin) {
      scrollEl.scrollLeft = Math.max(0, playheadPx - scrollEl.clientWidth / 2);
    }
  }, [currentTime, duration]);

  function handleTrackPointerDown(e: React.PointerEvent) {
    setIsScrubbing(true);
    seekFromClientX(e.clientX);
  }

  function handleCommitMove(segmentId: string, deltaSeconds: number) {
    moveSegmentTiming(segmentId, deltaSeconds);
    persist();
  }

  if (!duration) return null;

  const ticks = buildTicks(duration, zoom);
  const playheadPct = Math.min(Math.max((currentTime / duration) * 100, 0), 100);

  return (
    <div className="flex w-full select-none rounded-lg border border-neutral-800 bg-neutral-900">
      {/* Row-label gutter — pinned outside the horizontally-scrolling/zoomable
          area, the same way a real NLE keeps track headers fixed while the
          content scrubs underneath. */}
      <div className="flex w-16 shrink-0 flex-col border-r border-neutral-800 sm:w-20">
        <div className="h-5 border-b border-neutral-800" />
        <div className="flex h-12 items-center gap-1.5 border-b border-neutral-800 px-2">
          <WaveformRowIcon />
          <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-neutral-500">Audio</span>
        </div>
        <div className="flex h-16 items-center gap-1.5 px-2">
          <CaptionsRowIcon />
          <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-neutral-500">Subtitles</span>
        </div>
      </div>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <div ref={tracksRef} className="relative" style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
          <div className="relative h-5 border-b border-neutral-800 text-[10px] text-neutral-500">
            {ticks.map((t) => (
              <span key={t} className="absolute top-0.5 -translate-x-1/2" style={{ left: `${(t / duration) * 100}%` }}>
                {formatTime(t)}
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute top-0 z-20 h-full" style={{ left: `${playheadPct}%` }}>
            <div className="absolute -top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 shadow" />
            <div className="h-full w-px bg-red-500" />
          </div>

          <div
            onPointerDown={handleTrackPointerDown}
            className="relative h-12 cursor-pointer touch-none border-b border-neutral-800 bg-neutral-800/60"
          >
            {waveformPeaks && waveformPeaks.length > 0 && <Waveform peaks={waveformPeaks} />}
          </div>

          <div onPointerDown={handleTrackPointerDown} className="relative h-16 cursor-pointer touch-none">
            {captions.map((seg, i) => (
              <SegmentBlock
                key={seg.id}
                seg={seg}
                duration={duration}
                tracksRef={tracksRef}
                isSelected={seg.id === selectedId}
                prevEnd={captions[i - 1]?.end ?? 0}
                nextStart={captions[i + 1]?.start ?? duration}
                onSelect={onSelect}
                onSeek={onSeek}
                onCommitMove={handleCommitMove}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SegmentBlockProps {
  seg: CaptionSegment;
  duration: number;
  tracksRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  prevEnd: number;
  nextStart: number;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
  onCommitMove: (segmentId: string, deltaSeconds: number) => void;
}

function SegmentBlock({
  seg,
  duration,
  tracksRef,
  isSelected,
  prevEnd,
  nextStart,
  onSelect,
  onSeek,
  onCommitMove,
}: SegmentBlockProps) {
  const [dragDelta, setDragDelta] = useState(0);
  const dragDeltaRef = useRef(0);
  const movedRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    const startX = e.clientX;
    movedRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const track = tracksRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const deltaPx = ev.clientX - startX;
      if (Math.abs(deltaPx) > 4) movedRef.current = true;

      const rawDeltaSec = (deltaPx / rect.width) * duration;
      const clamped = clampDelta(rawDeltaSec, seg, prevEnd, nextStart);
      dragDeltaRef.current = clamped;
      setDragDelta(clamped);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Read the final delta from the ref and commit as a plain call, not
      // nested inside the setDragDelta updater — React updater functions
      // must stay pure, and onCommitMove updates a different component
      // (EditorPage, via the store) as a side effect.
      const finalDelta = dragDeltaRef.current;
      dragDeltaRef.current = 0;
      setDragDelta(0);
      if (Math.abs(finalDelta) > 0.005) onCommitMove(seg.id, finalDelta);
    };

    // Pointer events (not mouse-only) so dragging a caption's timing works via touch too.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (movedRef.current) return; // this mouseup ended a drag, not a click
    onSelect(seg.id);
    onSeek(seg.start);
  }

  const displayStart = seg.start + dragDelta;
  const displayEnd = seg.end + dragDelta;

  return (
    <button
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        left: `${(displayStart / duration) * 100}%`,
        width: `${Math.max(((displayEnd - displayStart) / duration) * 100, 0.4)}%`,
      }}
      className={`absolute top-1.5 h-[52px] touch-none cursor-grab overflow-hidden rounded-md border px-1.5 text-left text-[10px] font-medium leading-tight transition-colors active:cursor-grabbing ${
        isSelected
          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
          : "border-violet-800 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
      } ${dragDelta !== 0 ? "z-10 border-amber-500 bg-amber-500/30 text-amber-200" : ""}`}
    >
      {seg.text.replace("\n", " ")}
    </button>
  );
}

/** Keeps a dragged segment within [0, duration] and from crossing its neighbors. */
function clampDelta(deltaSec: number, seg: CaptionSegment, prevEnd: number, nextStart: number): number {
  const dur = seg.end - seg.start;
  let newStart = seg.start + deltaSec;
  let newEnd = seg.end + deltaSec;

  if (newStart < prevEnd) {
    newStart = prevEnd;
    newEnd = newStart + dur;
  }
  if (newEnd > nextStart) {
    newEnd = nextStart;
    newStart = newEnd - dur;
  }
  newStart = Math.max(newStart, prevEnd);

  return newStart - seg.start;
}

const Waveform = memo(function Waveform({ peaks }: { peaks: number[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-1 inset-y-2 flex items-center gap-px">
      {peaks.map((p, i) => (
        <div
          key={i}
          style={{ height: `${Math.max(p * 100, 3)}%` }}
          className="min-w-px flex-1 rounded-full bg-emerald-500/70"
        />
      ))}
    </div>
  );
});

function WaveformRowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-500">
      <path
        d="M3 12h2l2-6 3 12 3-9 2 6 2-3h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CaptionsRowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-500">
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 14h4M13 14h4M7 10.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function buildTicks(duration: number, zoom: number): number[] {
  const visibleSpan = duration / zoom;
  const step =
    visibleSpan <= 10 ? 1 : visibleSpan <= 20 ? 2 : visibleSpan <= 60 ? 5 : visibleSpan <= 180 ? 15 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  return ticks;
}
