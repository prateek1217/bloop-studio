"use client";

import { useEffect, useRef, useState } from "react";

interface Feature {
  title: string;
  body: string;
  accent: string;
  glow: string;
  icon: React.ReactNode;
  large?: boolean;
}

interface Props {
  features: Feature[];
  /** Rendered under the active feature's text only when it's the flagship
   * (`large`) one — kept generic here so this component doesn't need to
   * know what DepthDemo is. */
  flagshipExtra?: React.ReactNode;
}

const RADIUS = 150;
const AUTO_ROTATE_MS = 2000;

/** A circular dial of feature icons that auto-rotates on a timer — whichever
 * icon lands at the top slot is "active" and its title/body shows beside the
 * wheel. Clicking any node jumps straight to it and restarts the timer from
 * there, so reading one doesn't get cut off by the next auto-advance. */
export default function CircularFeatures({ features, flagshipExtra }: Props) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = features.length;

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % n);
    }, AUTO_ROTATE_MS);
  }

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectFeature(i: number) {
    setActive(i);
    startTimer();
  }

  const rotation = active * (360 / n);
  const activeFeature = features[active];

  return (
    <div className="flex flex-col items-center gap-10 lg:flex-row lg:justify-center lg:gap-20">
      <div className="relative h-[300px] w-[300px] shrink-0 sm:h-[340px] sm:w-[340px]">
        <div className="absolute inset-0 rounded-full border border-dashed border-white/10" />
        {/* Marker for the "active" slot at the top of the ring. */}
        <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />

        {features.map((f, i) => {
          const angleDeg = i * (360 / n) - rotation - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const x = Math.cos(rad) * RADIUS;
          const y = Math.sin(rad) * RADIUS;
          const isActive = i === active;
          return (
            <button
              key={f.title}
              type="button"
              onClick={() => selectFeature(i)}
              aria-label={f.title}
              aria-pressed={isActive}
              className="absolute left-1/2 top-1/2 transition-transform duration-500 ease-out"
              style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
              suppressHydrationWarning
            >
              <span
                className={`flex items-center justify-center rounded-full bg-gradient-to-br shadow-lg transition-all duration-500 ${f.accent} ${
                  isActive ? "h-14 w-14 opacity-100 ring-4 ring-white/20" : "h-9 w-9 opacity-40 hover:opacity-70"
                }`}
              >
                {f.icon}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-w-sm text-center lg:text-left">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${activeFeature.accent}`}
        >
          {activeFeature.icon}
        </span>
        <h3 className="mt-3 font-gabarito text-2xl font-bold text-white">{activeFeature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400 sm:text-base">{activeFeature.body}</p>
        {activeFeature.large && flagshipExtra}
        <div className="mt-4 flex justify-center gap-1.5 lg:justify-start">
          {features.map((f, i) => (
            <button
              key={f.title}
              type="button"
              onClick={() => selectFeature(i)}
              aria-label={`Show ${f.title}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
              suppressHydrationWarning
            />
          ))}
        </div>
      </div>
    </div>
  );
}
