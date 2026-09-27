"use client";

import { useMemo } from "react";

/**
 * Floating gold dust for the hero.
 *
 * Motes are generated once per size change and never re-shuffled, so the
 * field is stable across re-renders. Each one gets its own duration,
 * delay, drift and size: they rise at different speeds and sway by
 * different amounts, so the eye reads depth rather than a loop.
 *
 * The animation itself lives in globals.css, which is why the inline
 * style here is only custom properties.
 */

const COUNT = 34;
const SIZES = [1.5, 2, 2.5, 3] as const;

/** Deterministic pseudo-random from a seed, so server and client agree
    on the initial markup and React never warns about a hydration
    mismatch. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function GoldDust() {
  const motes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const a = rand(i + 1);
        const b = rand(i + 101);
        const c = rand(i + 201);
        const d = rand(i + 301);

        return {
          // Spread across the full width, but denser in the upper half
          // where the lamp light is.
          left: a * 100,
          top: 15 + b * 80,
          size: SIZES[Math.floor(c * SIZES.length)],
          duration: 24 + d * 26,
          // Negative delay starts a mote mid-flight, so the field is
          // already in motion on first paint rather than all rising
          // from the floor together.
          delay: -(a * 30 + b * 18),
          drift: (c - 0.5) * 90,
          opacity: 0.28 + d * 0.45,
        };
      }),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <span
          key={i}
          className="dust"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            ["--dust-duration" as string]: `${m.duration}s`,
            ["--dust-delay" as string]: `${m.delay}s`,
            ["--dust-drift" as string]: `${m.drift}px`,
            ["--dust-opacity" as string]: `${m.opacity}`,
          }}
        />
      ))}
    </div>
  );
}
