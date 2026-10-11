// Motion primitives. Every function is a pure function of time, so window.seek(t)
// can paint frame 812 without simulating frames 0-811. Never use Math.random or timers.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const mix = (a, b, p) => a + (b - a) * clamp(p);
export const remap = (x, a, b) => clamp((x - a) / (b - a));

// Closed-form damped spring, 0 -> 1. k = stiffness, d = damping.
export function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t); // z >= 1 treated as critical
}

// Spring presets (stiffness, damping)
export const SPRING = {
  snappy:  [320, 30],  // buttons, toggles, leading edges
  ui:      [170, 26],  // cards, containers, camera
  heavy:   [90, 20],   // big type, logo lockups
  playful: [220, 14],  // mascots, stickers: visible overshoot
};
export const sp = (t, preset = 'ui') => spring(t, ...SPRING[preset]);

// A value with many targets: sum of one spring per change, never restart a spring.
// keys: [[time, value], ...] sorted by time.
export function track(t, keys, k = 170, d = 26) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], k, d);
  return v;
}

// Track for points: keys [[time, x, y], ...]
export function track2(t, keys, k = 170, d = 26) {
  return {
    x: track(t, keys.map(([tt, x]) => [tt, x]), k, d),
    y: track(t, keys.map(([tt, , y]) => [tt, y]), k, d),
  };
}

// Tab indicator that stretches: leading edge stiffer than trailing edge.
export function indicator(t, stops, width = 120) {
  const lead = track(t, stops, 320, 30), trail = track(t, stops, 140, 22);
  return { left: Math.min(lead, trail), right: Math.max(lead, trail) + width };
}

// Text inside a morphing box: in after the morph starts, out before the next one.
export function swapAlpha(t, tIn, tOut) {
  return Math.min(clamp((t - tIn - 0.08) / 0.12), clamp((tOut - 0.1 - t) / 0.1));
}

// Seamless loop: pin the last frame to the first.
export const loopT = (t, dur) => ((t % dur) + dur) % dur;

// Seeded PRNG (mulberry32). rng(7)() always yields the same sequence.
export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Deterministic 1D value noise for grain / wobble.
export function noise1(x, seed = 1) {
  const h = (n) => { const r = rng(seed * 9973 + n); return r(); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// Beat helpers. beats = sorted array of seconds (from audio/beats.json).
export const beatIndex = (t, beats) => { let i = -1; while (i + 1 < beats.length && beats[i + 1] <= t) i++; return i; };
export const sinceBeat = (t, beats) => { const i = beatIndex(t, beats); return i < 0 ? t : t - beats[i]; };
export const nearestBeat = (t, beats) => beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), beats[0] ?? t);

// Layout for any format from one timeline: work in units, reframe per aspect.
export function layout(W, H) {
  const u = Math.min(W, H) / 1080;          // 1 unit = 1px at 1080 short side
  const portrait = H > W * 1.2, landscape = W > H * 1.2;
  const pad = 72 * u;                        // safe area: keep text away from edges
  return { W, H, u, cx: W / 2, cy: H / 2, portrait, landscape, square: !portrait && !landscape,
    pad, safe: { x: pad, y: portrait ? 180 * u : pad, w: W - 2 * pad, h: H - 2 * (portrait ? 180 * u : pad) } };
}

// Scene table helper: scenes [{from, to, draw(localT, sceneDur)}] -> paint fn + cut list.
export function sceneRunner(scenes) {
  return {
    cuts: scenes.slice(1).map((s) => s.from),
    draw(t) { for (const s of scenes) if (t >= s.from && t < s.to) s.draw(t - s.from, s.to - s.from); },
  };
}
