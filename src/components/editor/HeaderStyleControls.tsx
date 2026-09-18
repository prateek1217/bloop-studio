"use client";

import { useState } from "react";
import type { CaptionSegment, DepthMode, LayoutRegion, Project } from "@/types";
import { getTheme } from "@/lib/themes/themes";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  project: Project;
  selectedSegment: CaptionSegment | null;
}

const DEPTH_OPTIONS: { value: DepthMode; label: string }[] = [
  { value: "normal", label: "Empty space" },
  { value: "front", label: "In front" },
  { value: "behind_person", label: "Behind person" },
];

const REGIONS: LayoutRegion[] = [
  "top-left",
  "top",
  "top-right",
  "center-left",
  "center-right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

/**
 * Compact counterpart to the bottom half of StylePanel (font size, selected
 * segment depth/position, reset), surfaced in the otherwise-empty header
 * strip between the project name and Export button. These are the controls
 * people reach for constantly, but on `lg`+ they used to be stuck below the
 * entire theme grid, requiring a scroll every time. Mobile has no equivalent
 * dead header space, so it keeps the original StylePanel layout unchanged
 * (see the `lg:hidden` sections there).
 */
export default function HeaderStyleControls({ project, selectedSegment }: Props) {
  const setSegmentOverride = useEditorStore((s) => s.setSegmentOverride);
  const setCustomThemeOverride = useEditorStore((s) => s.setCustomThemeOverride);
  const setSegmentFontSize = useEditorStore((s) => s.setSegmentFontSize);
  const persist = useEditorStore((s) => s.persist);

  const baseFontSize = getTheme(project.themeId).fontSize;
  const effectiveFontSize = project.customTheme?.fontSize ?? baseFontSize;
  const [fontSizeInput, setFontSizeInput] = useState(String(effectiveFontSize));

  // Same "adjust state during render" sync as StylePanel — keeps the field
  // in step with theme switches/overrides without fighting in-progress typing.
  const [lastSeenFontSize, setLastSeenFontSize] = useState(effectiveFontSize);
  if (effectiveFontSize !== lastSeenFontSize) {
    setLastSeenFontSize(effectiveFontSize);
    setFontSizeInput(String(effectiveFontSize));
  }

  function parseFontSize(): number | null {
    const n = Math.round(Number(fontSizeInput));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function applyFontSizeToAll() {
    const n = parseFontSize();
    if (n == null) return;
    setCustomThemeOverride({ fontSize: n });
    persist();
  }

  function applyFontSizeToSegment() {
    const n = parseFontSize();
    if (n == null || !selectedSegment) return;
    setSegmentFontSize(selectedSegment.id, n);
    persist();
  }

  function chooseDepth(depth: DepthMode) {
    if (!selectedSegment) return;
    setSegmentOverride(selectedSegment.id, {
      ...selectedSegment.manualOverride,
      depth,
      region: selectedSegment.manualOverride?.region ?? selectedSegment.layout?.region,
    });
    persist();
  }

  function chooseRegion(region: LayoutRegion) {
    if (!selectedSegment) return;
    setSegmentOverride(selectedSegment.id, {
      region,
      depth: selectedSegment.manualOverride?.depth ?? selectedSegment.layout?.depth,
    });
    persist();
  }

  function clearOverride() {
    if (!selectedSegment) return;
    setSegmentOverride(selectedSegment.id, null);
    persist();
  }

  const currentDepth = selectedSegment?.manualOverride?.depth ?? selectedSegment?.layout?.depth ?? null;
  const currentRegion = selectedSegment?.manualOverride?.region ?? selectedSegment?.layout?.region ?? null;

  return (
    <div className="flex min-w-0 items-center gap-3 whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-800 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-neutral-500">Size</span>
        <input
          type="number"
          min={12}
          max={200}
          value={fontSizeInput}
          onChange={(e) => setFontSizeInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFontSizeToAll()}
          title="Font size"
          className="w-14 rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-neutral-100 outline-none focus:border-violet-400"
        />
        <button
          onClick={applyFontSizeToAll}
          title="Apply to every subtitle in this project"
          className="rounded-md bg-white px-2 py-1 font-semibold text-black hover:opacity-90"
        >
          Apply to all
        </button>
        {selectedSegment && (
          <button
            onClick={applyFontSizeToSegment}
            title="Apply to the selected segment only, leaving every other subtitle as-is"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 font-semibold text-neutral-300 hover:bg-neutral-800"
          >
            Apply to segment
          </button>
        )}
      </div>

      <div className="h-4 w-px shrink-0 bg-neutral-700" />

      <div className="flex items-center gap-1.5">
        <span className="text-neutral-500">Depth</span>
        <select
          value={currentDepth ?? ""}
          onChange={(e) => chooseDepth(e.target.value as DepthMode)}
          disabled={!selectedSegment}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-neutral-100 outline-none focus:border-violet-400 disabled:opacity-40"
        >
          {!selectedSegment && <option value="">—</option>}
          {DEPTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-neutral-500">Position</span>
        <select
          value={currentRegion ?? ""}
          onChange={(e) => chooseRegion(e.target.value as LayoutRegion)}
          disabled={!selectedSegment}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-neutral-100 outline-none focus:border-violet-400 disabled:opacity-40"
        >
          {!selectedSegment && <option value="">—</option>}
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={clearOverride}
        disabled={!selectedSegment?.manualOverride}
        title="Reset to auto layout"
        className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ↺ Reset
      </button>

      {!selectedSegment && <span className="text-neutral-500">Select a segment to override position/depth</span>}
    </div>
  );
}
