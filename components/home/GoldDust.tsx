/**
 * Floating gold dust for the hero.
 *
 * Each mote carries its own duration, delay, drift, size and opacity: they
 * rise at different speeds and sway by different amounts, so the eye reads
 * depth rather than a loop. The field is fixed data, never re-shuffled.
 *
 * The animation itself lives in globals.css, which is why the inline
 * style here is only custom properties.
 */

/**
 * The mote field as literal data.
 *
 * This was previously a seeded generator (`Math.sin(seed) * 43758.5453`)
 * evaluated during render. That is deterministic per engine but not across
 * engines: V8 in Node and V8 in Chrome differ in the last bits of `Math.sin`,
 * and the 43758.5453 multiplier scales that ~1e-16 difference up into a
 * ~1e-10 one. React then rejects the inline styles, because the server
 * renderer also prints them at 6 significant digits while the client keeps
 * full double precision — so "5.72182%" never matched
 * "5.721816935692914%".
 *
 * Baking the field to a table removes both causes: no transcendental math
 * to disagree about, and every value is already rounded to the 6 significant
 * digits the server emits. Regenerate with the script in the comment above
 * the array rather than reintroducing a generator.
 *
 * left/top are percentages across the hero; duration and delay are seconds
 * (the negative delay starts each mote mid-flight, so the field is already
 * in motion on first paint); drift is horizontal sway in pixels; opacity is
 * the peak brightness the mote reaches as it passes through the light.
 */
const MOTES: ReadonlyArray<{
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}> = [
  { left: 92.169, top: 89.6392, size: 1.5, duration: 31.8179, delay: -44.4445, drift: -29.3736, opacity: 0.41531 },
  { left: 5.72182, top: 21.3149, size: 2.5, duration: 47.204, delay: -3.1374, drift: 1.9971, opacity: 0.681607 },
  { left: 55.8223, top: 28.2429, size: 2, duration: 35.8776, delay: -19.7263, drift: -11.5898, opacity: 0.485573 },
  { left: 37.3734, top: 54.806, size: 3, duration: 38.7464, delay: -20.1684, drift: 33.1573, opacity: 0.535226 },
  { left: 45.348, top: 86.4558, size: 2.5, duration: 42.4108, delay: -29.6819, drift: 12.5861, opacity: 0.598648 },
  { left: 62.6087, top: 42.4993, size: 2, duration: 29.8547, delay: -24.9699, drift: -20.7265, opacity: 0.381332 },
  { left: 16.558, top: 60.7921, size: 3, duration: 32.8372, delay: -15.2706, drift: 34.8101, opacity: 0.432952 },
  { left: 32.9111, top: 72.3495, size: 3, duration: 42.9741, delay: -22.777, drift: 42.446, opacity: 0.608398 },
  { left: 53.9625, top: 90.6077, size: 2, duration: 48.5145, delay: -33.2005, drift: -6.82263, opacity: 0.704289 },
  { left: 97.1512, top: 31.6519, size: 2, duration: 35.6513, delay: -32.8921, drift: -20.5449, opacity: 0.481657 },
  { left: 82.119, top: 66.2957, size: 1.5, duration: 40.1868, delay: -36.1772, drift: -25.8365, opacity: 0.560157 },
  { left: 17.9044, top: 18.7651, size: 3, duration: 34.9034, delay: -6.21846, drift: 28.4342, opacity: 0.468712 },
  { left: 99.5172, top: 17.5191, size: 3, duration: 33.5026, delay: -30.422, drift: 26.7567, opacity: 0.444468 },
  { left: 81.6025, top: 54.9527, size: 2.5, duration: 40.4239, delay: -33.4701, drift: 8.20113, opacity: 0.56426 },
  { left: 44.1816, top: 51.5407, size: 1.5, duration: 48.7925, delay: -21.4762, drift: -24.5341, opacity: 0.709102 },
  { left: 92.6879, top: 52.4063, size: 3, duration: 26.5352, delay: -36.2228, drift: 44.2638, opacity: 0.323878 },
  { left: 43.4196, top: 88.3101, size: 1.5, duration: 27.5748, delay: -29.5206, drift: -34.7051, opacity: 0.341871 },
  { left: 64.4186, top: 47.1273, size: 3, duration: 46.7302, delay: -26.5542, drift: 32.8195, opacity: 0.673407 },
  { left: 32.2644, top: 94.6092, size: 2, duration: 47.8662, delay: -27.5914, drift: -12.3801, opacity: 0.693068 },
  { left: 76.0377, top: 36.4356, size: 2.5, duration: 45.2245, delay: -27.6343, drift: 11.3453, opacity: 0.647348 },
  { left: 55.6031, top: 76.015, size: 2, duration: 48.0597, delay: -30.4093, drift: -1.07669, opacity: 0.696418 },
  { left: 66.0876, top: 92.9134, size: 2, duration: 44.3079, delay: -37.3568, drift: -18.925, opacity: 0.631482 },
  { left: 41.9338, top: 23.5324, size: 2.5, duration: 33.0858, delay: -14.4999, drift: 21.3945, opacity: 0.437254 },
  { left: 13.5764, top: 15.0844, size: 2, duration: 39.5078, delay: -4.09192, drift: -2.00778, opacity: 0.548404 },
  { left: 33.047, top: 73.5119, size: 2, duration: 32.3984, delay: -23.0793, drift: -0.304728, opacity: 0.425358 },
  { left: 49.5324, top: 39.4906, size: 1.5, duration: 42.6082, delay: -20.3701, drift: -38.3766, opacity: 0.602065 },
  { left: 0.0317557, top: 31.7411, size: 2, duration: 42.7767, delay: -3.77627, drift: -0.206067, opacity: 0.60498 },
  { left: 16.1906, top: 89.7497, size: 3, duration: 40.9799, delay: -21.6759, drift: 30.0587, opacity: 0.573882 },
  { left: 42.0193, top: 36.5763, size: 2, duration: 45.3194, delay: -17.4605, drift: -9.37496, opacity: 0.64899 },
  { left: 98.5082, top: 49.6394, size: 3, duration: 47.0953, delay: -37.3463, drift: 31.3796, opacity: 0.679726 },
  { left: 72.3408, top: 80.1488, size: 2.5, duration: 34.0952, delay: -36.3607, drift: 5.32995, opacity: 0.454725 },
  { left: 28.5702, top: 76.9725, size: 2.5, duration: 43.8839, delay: -22.5149, drift: 20.8702, opacity: 0.624145 },
  { left: 41.8044, top: 16.477, size: 2, duration: 46.6785, delay: -12.8736, drift: -9.26997, opacity: 0.672512 },
  { left: 20.0598, top: 60.4722, size: 2, duration: 32.1088, delay: -16.2492, drift: -14.1772, opacity: 0.420344 },
];

export function GoldDust() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {MOTES.map((m, i) => (
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
