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

const CARD_SHADOW =
  "shadow-[0_32px_32px_rgba(5,20,51,0.05),0_12px_12px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05)]";

/**
 * Same scrollytelling mechanic at every breakpoint — a sticky preview that
 * cross-fades between each step's visual as you scroll past its chapter,
 * plus a fill-as-you-scroll progress rail. `lg`+ has room to put the sticky
 * preview beside the text (side by side); below that there's only room to
 * stack it on top, pinned, with the text chapters scrolling underneath.
 */
export default function ScrollyHowItWorks({ steps }: Props) {
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

  const active = Math.min(steps.length - 1, Math.floor(progress * steps.length));

  return (
    <div ref={containerRef}>
      {/* Below `lg`: sticky preview pinned on top, chapters scroll underneath. */}
      <div className="lg:hidden">
        <div className={`sticky top-20 z-10 h-64 overflow-hidden rounded-2xl border border-[#E1E2E5] ${CARD_SHADOW}`}>
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`absolute inset-0 transition-opacity duration-500 ${
                i === active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {s.visual}
            </div>
          ))}
          <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            Step {steps[active].n} of {steps.length}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-neutral-200" />
          <div
            className="absolute left-0 top-0 w-0.5 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-cyan-500 transition-[height] duration-150 ease-out"
            style={{ height: `${progress * 100}%` }}
          />
          <div className="pl-6">
            {steps.map((s, i) => (
              <div key={s.n} className="flex flex-col justify-center" style={{ minHeight: "55vh" }}>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors duration-500 ${
                    i === active
                      ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"
                      : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {s.n}
                </span>
                <h3
                  className={`mt-3 text-xl font-bold tracking-tight transition-colors duration-500 ${
                    i === active ? "text-neutral-900" : "text-neutral-300"
                  }`}
                >
                  {s.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed transition-colors duration-500 ${
                    i === active ? "text-neutral-600" : "text-neutral-300"
                  }`}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* `lg`+: sticky preview + scroll-linked chapters. */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-neutral-200" />
          <div
            className="absolute left-0 top-0 w-0.5 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-cyan-500 transition-[height] duration-150 ease-out"
            style={{ height: `${progress * 100}%` }}
          />
          <div className="pl-10">
            {steps.map((s, i) => (
              <div key={s.n} className="flex flex-col justify-center" style={{ minHeight: "80vh" }}>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${
                    i === active
                      ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"
                      : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {s.n}
                </span>
                <h3
                  className={`mt-5 text-2xl font-bold tracking-tight transition-colors duration-500 ${
                    i === active ? "text-neutral-900" : "text-neutral-300"
                  }`}
                >
                  {s.title}
                </h3>
                <p
                  className={`mt-3 max-w-sm text-base leading-relaxed transition-colors duration-500 ${
                    i === active ? "text-neutral-600" : "text-neutral-300"
                  }`}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky top-28 h-[460px] self-start">
          <div className={`relative h-full overflow-hidden rounded-2xl border border-[#E1E2E5] ${CARD_SHADOW}`}>
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  i === active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {s.visual}
              </div>
            ))}
            <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              Step {steps[active].n} of {steps.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
