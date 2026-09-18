"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectMeta } from "@/types";
import { formatRelativeTime } from "@/lib/format";

const READY_STAGES = new Set(["ready", "completed"]);
const PROCESSING_STAGES = new Set([
  "uploaded",
  "queued",
  "extracting_audio",
  "transcribing",
  "transliterating",
  "segmenting",
  "analyzing_video",
  "generating_layout",
  "rendering",
]);

interface Props {
  project: ProjectMeta;
  onDelete: (id: string) => void;
  /** Stagger index for the mount-in animation — purely cosmetic. */
  index?: number;
}

export default function ProjectCard({ project, onDelete, index = 0 }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isReady = READY_STAGES.has(project.stage);
  const isProcessing = PROCESSING_STAGES.has(project.stage);
  const isFailed = project.stage === "failed";

  return (
    <li
      className="project-card-enter group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-[0_20px_45px_-15px_rgba(139,92,246,0.35)]"
      style={{ "--card-delay": `${Math.min(index, 10) * 60}ms` } as React.CSSProperties}
    >
      <Link
        href={isFailed ? "#" : `/editor/${project.id}`}
        className={isFailed ? "pointer-events-none block" : "block"}
        aria-disabled={isFailed}
      >
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900">
          {project.thumbnailDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- per-project data URL, not a static asset next/image can optimize
            <img
              src={project.thumbnailDataUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FilmIcon />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-500/10" />

          {isReady && (
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
                <PlayIcon />
              </span>
            </span>
          )}
          {isProcessing && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-neutral-200 backdrop-blur-md">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Processing…
              </span>
            </span>
          )}
          {isFailed && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-red-300 backdrop-blur-md">
                Failed to process
              </span>
            </span>
          )}

          <StageBadge stage={project.stage} />
        </div>

        <div className="p-3.5">
          <p className="truncate text-sm font-semibold text-neutral-100">{project.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {isReady ? "Ready to edit" : isFailed ? "Failed" : "Processing…"}
            {project.durationSec > 0 && <span>· {project.durationSec.toFixed(0)}s</span>}
            <span>· {formatRelativeTime(project.updatedAt)}</span>
          </p>
        </div>
      </Link>

      <div className="absolute right-2.5 top-2.5">
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete project"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-neutral-300 opacity-0 backdrop-blur transition-opacity hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
          >
            <TrashIcon />
          </button>
        ) : (
          <div className="flex items-center gap-1 rounded-md bg-black/80 p-1 backdrop-blur">
            <button
              onClick={() => onDelete(project.id)}
              className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function StageBadge({ stage }: { stage: string }) {
  if (stage === "ready" || stage === "completed") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
        Ready
      </Badge>
    );
  }
  if (stage === "failed") {
    return <Badge className="border-red-500/30 bg-red-500/15 text-red-300">Failed</Badge>;
  }
  return <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">Processing</Badge>;
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-neutral-700">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 4v5M16 4v5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
