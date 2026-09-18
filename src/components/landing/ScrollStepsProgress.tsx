"use client";

import { useEffect, useRef, useState } from "react";

interface Step {
  n: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

interface Props {
  steps: Step[];
}

/**
 * Same three step cards, but the connecting line actually fills as you
 * scroll the section through the viewport (not just a static gradient),
 * and each card lights up in sequence as the fill reaches it — the
 * "progress" is a direct readout of scroll position, not a fixed timer.
 */
export default function ScrollStepsProgress({ steps }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    function computeProgress() {
      ticking = false;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // 0 when the section's top just touches the viewport's bottom edge
      // (about to enter), 1 when its bottom has fully passed the top edge.
      const raw = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      setProgress(Math.min(1, Math.max(0, raw)));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(computeProgress);
    }

    computeProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const activeIndex = Math.min(steps.length - 1, Math.floor(progress * steps.length));

  return (
    <div ref={containerRef} className="relative">
      {/* Track + scroll-driven fill, sitting behind the cards at badge height —
          hidden under each opaque card, visible only in the gaps, same trick
          as before, but the fill width now actually tracks scroll position. */}
      <div className="pointer-events-none absolute inset-x-6 top-[26px] z-0 hidden sm:block">
        <div className="h-0.5 w-full rounded-full bg-neutral-200" />
        <div
          className="absolute inset-y-0 left-0 h-0.5 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(124,58,237,0.5)] transition-[left] duration-150 ease-out"
          style={{ left: `calc(${progress * 100}% - 5px)` }}
        />
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((s, i) => {
          const active = i <= activeIndex;
          return (
            <div
              key={s.n}
              className={`overflow-hidden rounded-2xl border bg-white shadow-[0_32px_32px_rgba(5,20,51,0.05),0_12px_12px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05)] transition-all duration-500 ${
                active
                  ? "scale-100 border-violet-300 opacity-100"
                  : "scale-[0.97] border-[#E1E2E5] opacity-40 sm:opacity-60"
              }`}
            >
              <div className="relative h-40">
                {s.visual}
                <span
                  className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition-colors duration-500 ${
                    active ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white" : "bg-white text-neutral-900"
                  }`}
                >
                  {s.n}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold text-neutral-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{s.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
