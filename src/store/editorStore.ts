import { create } from "zustand";
import type { CaptionSegment, Project, ProcessingStage, SubtitleTheme } from "@/types";

type SegmentOverride = NonNullable<CaptionSegment["manualOverride"]>;
import { getProject, getVideoBlob, saveProject } from "@/lib/db/projectStore";
import { computeSegmentLayout } from "@/lib/pipeline/autoLayout";
import { getTheme, applyThemeOverrides } from "@/lib/themes/themes";

interface EditorState {
  project: Project | null;
  videoUrl: string | null;
  progressLabel: string | null;
  progressFraction: number;

  loadProject: (id: string) => Promise<void>;
  setStage: (stage: ProcessingStage, error?: string) => void;
  setProgress: (label: string | null, fraction: number) => void;
  updateSegmentText: (segmentId: string, text: string) => void;
  /** Shifts a segment's start/end by deltaSeconds, and shifts its underlying
   * words by the same amount so word-level highlight timing stays in sync. */
  moveSegmentTiming: (segmentId: string, deltaSeconds: number) => void;
  setSegmentOverride: (segmentId: string, override: SegmentOverride | null) => void;
  /** Same number the "apply to all" font-size field uses, but scoped to one
   * segment — internally stored as a multiplier relative to the theme's own
   * size, so it stacks correctly on top of setCustomThemeOverride's
   * project-wide size instead of fighting it. */
  setSegmentFontSize: (segmentId: string, px: number) => void;
  /** Back to 1x (the project's normal size) for this one segment. */
  resetSegmentSize: (segmentId: string) => void;
  setTheme: (themeId: string) => void;
  /** Merges into project.customTheme (e.g. a global font size for every
   * subtitle); pass `null` to clear all overrides back to the theme's own values. */
  setCustomThemeOverride: (patch: Partial<SubtitleTheme> | null) => void;
  persist: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  videoUrl: null,
  progressLabel: null,
  progressFraction: 0,

  async loadProject(id: string) {
    const project = await getProject(id);
    const blob = await getVideoBlob(id);
    set({
      project: project ?? null,
      videoUrl: blob ? URL.createObjectURL(blob) : null,
    });
  },

  setStage(stage, error) {
    const project = get().project;
    if (!project) return;
    const updated: Project = {
      ...project,
      meta: { ...project.meta, stage, error, updatedAt: Date.now() },
    };
    set({ project: updated });
  },

  setProgress(label, fraction) {
    set({ progressLabel: label, progressFraction: fraction });
  },

  updateSegmentText(segmentId, text) {
    const project = get().project;
    if (!project) return;
    const captions = project.captions.map((s: CaptionSegment) =>
      s.id === segmentId ? { ...s, text } : s
    );
    set({ project: { ...project, captions } });
  },

  moveSegmentTiming(segmentId, deltaSeconds) {
    const project = get().project;
    if (!project || deltaSeconds === 0) return;

    const segment = project.captions.find((s) => s.id === segmentId);
    if (!segment) return;

    const captions = project.captions.map((s) =>
      s.id === segmentId ? { ...s, start: s.start + deltaSeconds, end: s.end + deltaSeconds } : s
    );

    // The segment's words carry their own absolute start/end (the single
    // source of truth for word-level animation timing) — shift exactly the
    // words that belong to this segment so they stay aligned with its new
    // position instead of playing at their old, now-mismatched time.
    const transcript = project.transcript
      ? {
          ...project.transcript,
          words: project.transcript.words.map((w, i) =>
            i >= segment.wordStartIndex && i <= segment.wordEndIndex
              ? { ...w, start: w.start + deltaSeconds, end: w.end + deltaSeconds }
              : w
          ),
        }
      : project.transcript;

    set({ project: { ...project, captions, transcript } });
  },

  setSegmentOverride(segmentId, override) {
    const project = get().project;
    if (!project) return;
    const theme = applyThemeOverrides(getTheme(project.themeId), project.customTheme);

    const captions = project.captions.map((s) => {
      if (s.id !== segmentId) return s;
      const withOverride: CaptionSegment = { ...s, manualOverride: override ?? undefined };
      const layout = computeSegmentLayout(withOverride, project.personMasks, theme, s.layout);
      return { ...withOverride, layout };
    });
    set({ project: { ...project, captions } });
  },

  setSegmentFontSize(segmentId, px) {
    const project = get().project;
    if (!project || !Number.isFinite(px) || px <= 0) return;
    const theme = applyThemeOverrides(getTheme(project.themeId), project.customTheme);

    // Rendering does theme.fontSize * sizeMultiplier, so back-solving the
    // multiplier from the requested absolute px is what makes typing "90"
    // here produce the exact same rendered size as typing "90" into the
    // project-wide field would — just for this one segment.
    const multiplier = px / theme.fontSize;
    const captions = project.captions.map((s) =>
      s.id === segmentId ? { ...s, sizeMultiplier: multiplier } : s
    );
    set({ project: { ...project, captions } });
  },

  resetSegmentSize(segmentId) {
    const project = get().project;
    if (!project) return;
    const captions = project.captions.map((s) =>
      s.id === segmentId ? { ...s, sizeMultiplier: undefined } : s
    );
    set({ project: { ...project, captions } });
  },

  setTheme(themeId) {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, themeId } });
  },

  setCustomThemeOverride(patch) {
    const project = get().project;
    if (!project) return;
    const customTheme = patch === null ? undefined : { ...project.customTheme, ...patch };
    set({ project: { ...project, customTheme } });
  },

  async persist() {
    const project = get().project;
    if (!project) return;
    await saveProject({ ...project, meta: { ...project.meta, updatedAt: Date.now() } });
  },
}));
