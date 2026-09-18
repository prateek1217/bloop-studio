"use client";

import { useState } from "react";
import type { CaptionSegment, DepthMode, LayoutRegion, Project } from "@/types";
import { THEMES, getTheme } from "@/lib/themes/themes";
import { filterThemes } from "@/lib/themes/searchThemes";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  project: Project;
  selectedSegment: CaptionSegment | null;
}

const DEPTH_OPTIONS: { value: DepthMode; label: string; hint: string }[] = [
  { value: "normal", label: "Empty space", hint: "Floats clear of the person" },
  { value: "front", label: "In front", hint: "Always on top of the person" },
  { value: "behind_person", label: "Behind person", hint: "Body occludes the text" },
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

export default function StylePanel({ project, selectedSegment }: Props) {
  const setTheme = useEditorStore((s) => s.setTheme);
  const setSegmentOverride = useEditorStore((s) => s.setSegmentOverride);
  const setCustomThemeOverride = useEditorStore((s) => s.setCustomThemeOverride);
  const setSegmentFontSize = useEditorStore((s) => s.setSegmentFontSize);
  const resetSegmentSize = useEditorStore((s) => s.resetSegmentSize);
  const persist = useEditorStore((s) => s.persist);

  const [themeSearch, setThemeSearch] = useState("");
  const filteredThemes = filterThemes(THEMES, themeSearch);

  const baseFontSize = getTheme(project.themeId).fontSize;
  const effectiveFontSize = project.customTheme?.fontSize ?? baseFontSize;
  const [fontSizeInput, setFontSizeInput] = useState(String(effectiveFontSize));

  // Keep the field in sync with the effective size when it changes from
  // outside (switching themes, clearing the override) without fighting the
  // user's in-progress typing otherwise. This is the React-documented
  // "adjust state during render" pattern — not an effect, so it doesn't
  // cause an extra committed render.
  const [lastSeenFontSize, setLastSeenFontSize] = useState(effectiveFontSize);
  if (effectiveFontSize !== lastSeenFontSize) {
    setLastSeenFontSize(effectiveFontSize);
    setFontSizeInput(String(effectiveFontSize));
  }

  function chooseTheme(id: string) {
    setTheme(id);
    persist();
  }

  function applyFontSize() {
    const n = Math.round(Number(fontSizeInput));
    if (!Number.isFinite(n) || n <= 0) return;
    setCustomThemeOverride({ fontSize: n });
    persist();
  }

  function applyFontSizeToSelectedSegment() {
    if (!selectedSegment) return;
    const n = Math.round(Number(fontSizeInput));
    if (!Number.isFinite(n) || n <= 0) return;
    setSegmentFontSize(selectedSegment.id, n);
    persist();
  }

  function resetSelectedSegmentSize() {
    if (!selectedSegment) return;
    resetSegmentSize(selectedSegment.id);
    persist();
  }

  function resetFontSize() {
    // Clears every customTheme override, not just fontSize — fine for now
    // since this control is the only thing that ever sets one.
    setCustomThemeOverride(null);
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
    // Deliberately omit x/y here (rather than spreading the previous
    // override) so picking a preset region snaps back to that region's own
    // coordinates, overriding any position set by dragging the subtitle
    // around on the video preview.
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

  return (
    <div className="flex flex-col gap-6 pr-1 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <section className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Theme</h3>
          <input
            type="text"
            value={themeSearch}
            onChange={(e) => setThemeSearch(e.target.value)}
            placeholder="Search or /regex/"
            title="Plain text matches theme name/animation/depth. Invalid regex just falls back to plain text."
            className="w-32 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-violet-400"
          />
        </div>
        <div className="grid max-h-64 grid-cols-2 content-start gap-2 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
          {filteredThemes.length === 0 ? (
            <p className="col-span-2 py-4 text-center text-xs text-neutral-500">No themes match &quot;{themeSearch}&quot;.</p>
          ) : (
            filteredThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => chooseTheme(t.id)}
                className={`rounded-lg border p-2 text-left ${
                  t.id === project.themeId ? "border-violet-500 bg-violet-500/15" : "border-neutral-800 bg-neutral-800 hover:bg-neutral-700"
                }`}
              >
                <span
                  className="block rounded bg-neutral-950 px-1.5 py-1 text-sm font-bold"
                  style={{
                    color: t.textColor,
                    textShadow: t.stroke ? `0 0 3px ${t.stroke.color}` : undefined,
                  }}
                >
                  {t.name}
                </span>
                <span className="mt-1 block text-[10px] text-neutral-500">
                  {t.animation} · {t.depthMode}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Below `lg` these stay here (there's no spare header room on mobile/
          tablet-portrait to move them into) — at `lg`+ the same controls live
          in HeaderStyleControls instead, so they don't require scrolling
          past the whole theme grid to reach. */}
      <section className="lg:hidden">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Font size</h3>
        <p className="mb-2 text-[11px] text-neutral-400">
          Applies to every subtitle in this project, overriding the theme&apos;s default size.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={12}
            max={200}
            value={fontSizeInput}
            onChange={(e) => setFontSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFontSize();
            }}
            className="w-20 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-violet-400"
          />
          <button
            onClick={applyFontSize}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            Apply to all
          </button>
          {selectedSegment && (
            <button
              onClick={applyFontSizeToSelectedSegment}
              title="Applies the size above to only the selected segment, leaving every other subtitle as-is"
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              Apply to this segment only
            </button>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {project.customTheme?.fontSize != null && (
            <button onClick={resetFontSize} className="text-xs text-neutral-500 underline">
              Reset to theme default ({baseFontSize})
            </button>
          )}
          {selectedSegment && (selectedSegment.sizeMultiplier ?? 1) !== 1 && (
            <button onClick={resetSelectedSegmentSize} className="text-xs text-neutral-500 underline">
              Reset selected segment size
            </button>
          )}
        </div>
      </section>

      <section className="lg:hidden">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Selected segment
        </h3>
        {!selectedSegment ? (
          <p className="text-sm text-neutral-400">Select a segment to override its position and depth.</p>
        ) : (
          <div className="space-y-4">
            {(selectedSegment.sizeMultiplier ?? 1) !== 1 && (
              <p className="text-xs text-neutral-400">
                Size: <span className="text-neutral-300">{Math.round(effectiveFontSize * (selectedSegment.sizeMultiplier ?? 1))}px</span>{" "}
                (project default is {effectiveFontSize}px)
              </p>
            )}
            <div>
              <p className="mb-1 text-xs text-neutral-400">Depth</p>
              <div className="flex flex-col gap-1">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => chooseDepth(opt.value)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                      (selectedSegment.manualOverride?.depth ?? selectedSegment.layout?.depth) === opt.value
                        ? "border-violet-500 bg-violet-500/15"
                        : "border-neutral-800 bg-neutral-800 hover:bg-neutral-700"
                    }`}
                  >
                    <span className="font-medium text-neutral-100">{opt.label}</span>
                    <span className="block text-neutral-400">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-neutral-400">Position</p>
              <div className="grid grid-cols-3 gap-1">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => chooseRegion(r)}
                    className={`rounded-md border px-1 py-2 text-[10px] ${
                      (selectedSegment.manualOverride?.region ?? selectedSegment.layout?.region) === r
                        ? "border-violet-500 bg-violet-500/15 text-violet-200"
                        : "border-neutral-800 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {selectedSegment.manualOverride && (
              <button onClick={clearOverride} className="text-xs text-neutral-500 underline">
                Reset to auto layout
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
