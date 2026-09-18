"use client";

import type { CaptionSegment } from "@/types";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  captions: CaptionSegment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SegmentList({ captions, selectedId, onSelect }: Props) {
  const updateSegmentText = useEditorStore((s) => s.updateSegmentText);
  const persist = useEditorStore((s) => s.persist);

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
      <h3 className="mb-2 shrink-0 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 lg:hidden">
        Segments
      </h3>
      <ul className="space-y-1 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {captions.map((seg) => (
          <li key={seg.id}>
            <button
              onClick={() => onSelect(seg.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                seg.id === selectedId
                  ? "border-violet-500 bg-violet-500/15"
                  : "border-transparent bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              <div className="mb-1 text-[10px] text-neutral-500">
                {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s
                {seg.layout && <span className="ml-2">{seg.layout.region} · {seg.layout.depth}</span>}
              </div>
              {seg.id === selectedId ? (
                <textarea
                  value={seg.text}
                  onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                  onBlur={() => persist()}
                  rows={2}
                  className="w-full resize-none rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-violet-400"
                />
              ) : (
                <p className="whitespace-pre-line text-neutral-300">{seg.text}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
