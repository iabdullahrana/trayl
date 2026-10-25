"use client";
import { useEffect, useRef, useState } from "react";
export function AnimatedCount({ value, cap }: { value: number; cap?: number }) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = value;
      setDisplay(value);
    };
    const from = current.current,
      start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 400, 1);
      current.current = Math.round(
        from + (value - from) * (1 - (1 - progress) ** 3),
      );
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const change = () => {
      if (media.matches) finish();
    };
    if (media.matches) finish();
    else frame = requestAnimationFrame(tick);
    media.addEventListener("change", change);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", change);
    };
  }, [value]);
  const format = (n: number) => (cap && n > cap ? `${cap}+` : n);
  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
