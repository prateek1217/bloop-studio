"use client";

import { useEffect, useRef, useState } from "react";

type Direction = "up" | "left" | "right" | "none";

interface Props {
  children: React.ReactNode;
  /** Stagger delay in ms — lets a group of siblings reveal one after another. */
  delay?: number;
  direction?: Direction;
  className?: string;
}

const HIDDEN_TRANSFORM: Record<Direction, string> = {
  up: "translate-y-8 scale-[0.98]",
  left: "-translate-x-10",
  right: "translate-x-10",
  none: "",
};

/**
 * Fades/slides children into place the first time they scroll into view —
 * a plain IntersectionObserver, no animation library needed. Only used
 * below the fold: hero content stays visible immediately so first paint
 * never depends on JS having run yet.
 */
export default function Reveal({ children, delay = 0, direction = "up", className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-x-0 translate-y-0 scale-100 opacity-100" : `opacity-0 ${HIDDEN_TRANSFORM[direction]}`
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
