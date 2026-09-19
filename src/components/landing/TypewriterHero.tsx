"use client";

import { useEffect, useState } from "react";

interface Segment {
  text: string;
  className?: string;
}

interface Props {
  segments: Segment[];
  className?: string;
  /** ms per character. */
  speed?: number;
}

/**
 * Types the sentence out character by character on mount, preserving each
 * segment's own styling (the colored/bold phrase emphasis) as it goes.
 *
 * Starts already fully "typed" — `shown` defaults to the full length, and
 * only the mount effect resets it to animate from 0 — so anyone without JS,
 * or before hydration finishes, just sees the complete, correct sentence
 * immediately. This is hero copy; it should never depend on JS to be readable.
 */
export default function TypewriterHero({ segments, className = "", speed = 16 }: Props) {
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const [shown, setShown] = useState(total);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= total) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = shown >= total;

  // Pure (no shared-variable mutation across iterations) computation of how
  // many characters of each segment are revealed at the current `shown` count.
  const takes = segments.reduce<{ take: number; usedSoFar: number }[]>((acc, seg) => {
    const before = acc.length ? acc[acc.length - 1].usedSoFar : 0;
    return [...acc, { take: Math.max(0, Math.min(seg.text.length, shown - before)), usedSoFar: before + seg.text.length }];
  }, []);

  return (
    <span className={className}>
      {segments.map((seg, i) => (
        <span key={i} className={seg.className}>
          {seg.text.slice(0, takes[i].take)}
        </span>
      ))}
      {!done && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}
