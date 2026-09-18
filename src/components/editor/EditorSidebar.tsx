"use client";

import { useState } from "react";
import type { CaptionSegment, Project } from "@/types";
import SegmentList from "./SegmentList";
import StylePanel from "./StylePanel";

type Panel = "segments" | "theme" | null;

interface Props {
  project: Project;
  selectedId: string | null;
  selectedSegment: CaptionSegment | null;
  onSelect: (id: string) => void;
}

/**
 * Laptop/tablet-only (`lg`+) icon rail + expandable panel — the desktop
 * counterpart to the mobile tab bar below. Segments and Theme used to be two
 * permanently-visible 320px columns; collapsing them behind icons gives the
 * preview real width back, while still keeping both one click away instead
 * of buried in a tab you have to know to switch to.
 */
export default function EditorSidebar({ project, selectedId, selectedSegment, onSelect }: Props) {
  const [panel, setPanel] = useState<Panel>("segments");

  function toggle(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="hidden shrink-0 lg:flex">
      <div className="flex w-[72px] shrink-0 flex-col items-center gap-2 border-r border-neutral-800 bg-neutral-900 py-3">
        <RailButton active={panel === "segments"} label="Segments" onClick={() => toggle("segments")}>
          <SegmentsIcon />
        </RailButton>
        <RailButton active={panel === "theme"} label="Theme" onClick={() => toggle("theme")}>
          <ThemeIcon />
        </RailButton>
      </div>

      {panel && (
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-neutral-800 bg-neutral-900">
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {panel === "segments" ? "Segments" : "Theme"}
            </span>
            <button
              onClick={() => setPanel(null)}
              aria-label="Collapse panel"
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === "segments" ? (
              <SegmentList captions={project.captions} selectedId={selectedId} onSelect={onSelect} />
            ) : (
              <StylePanel project={project} selectedSegment={selectedSegment} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RailButton({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex w-14 flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors ${
        active
          ? "border-violet-600 bg-violet-600 text-white shadow-sm"
          : "border-neutral-800 bg-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-700 hover:text-neutral-100"
      }`}
    >
      {children}
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}

function SegmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}
