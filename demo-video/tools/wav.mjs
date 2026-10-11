// Minimal 16-bit PCM WAV writer + seeded noise, shared by music.mjs and sfx.mjs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SR = 48000;

export function writeWav(path, buf, { sr = SR, peak = 0.89 } = {}) {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  const g = max > 0 ? peak / max : 1;                // normalize to the target peak
  const n = buf.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * g)) * 32767), 44 + i * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, b);
}

export function noiseGen(seed = 42) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2147483648 - 1;
}

// Add fn(localTime) into buf starting at time t for len seconds.
export function place(buf, t, len, fn, gain = 1, sr = SR) {
  const start = Math.floor(t * sr);
  for (let i = 0; i < len * sr; i++) {
    const k = start + i;
    if (k < 0) continue;
    if (k >= buf.length) break;
    buf[k] += fn(i / sr) * gain;
  }
}

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
