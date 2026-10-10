"use client";

import { useInView, useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * A 0..1 clock over [from, to] that loops every `ms`. Pauses when `ref` is off-screen; with
 * reduced motion it returns `still` and never animates.
 */
export function useLoop(ref: RefObject<Element | null>, ms: number, opts: { from?: number; to?: number; still?: number; loop?: boolean; enabled?: boolean } = {}) {
  const { from = 0, to = 1, still = 0.92, loop = true, enabled = true } = opts;
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.2 });
  const [t, setT] = useState(from);
  const start = useRef<number | null>(null);
  const elapsed = useRef(0);

  // Restart the range whenever it changes (the pinned story switches steps).
  useEffect(() => { elapsed.current = 0; start.current = null; setT(from); }, [from, to]);

  useEffect(() => {
    if (reduce || !inView || !enabled) return;
    let raf = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now - elapsed.current;
      elapsed.current = now - start.current;
      let x = elapsed.current / ms;
      if (loop) x = x % 1;
      else x = Math.min(1, x);
      setT(from + (to - from) * x);
      if (loop || x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); start.current = null; };
  }, [reduce, inView, enabled, ms, from, to, loop]);

  return reduce ? still : t;
}
