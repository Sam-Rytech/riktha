// Original background music synthesized in code, on the same timeline as the picture.
// Writes the track and its beat grid, so scenes and SFX can lock to it.
//
//   node tools/music.mjs --dur 45 --mood upbeat            (upbeat | chill | cinematic | minimal)
//   node tools/music.mjs --dur 60 --mood minimal --bpm 100 (minimal sits well under a voiceover)
//   options: --bpm N --key 0..11 (semitones from A minor) --seed N --out audio/music.wav --beats audio/beats.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { SR, writeWav, noiseGen, place, midiHz } from './wav.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const MOODS = { upbeat: 118, chill: 88, cinematic: 100, minimal: 104 };
const mood = arg('mood', 'upbeat');
if (!(mood in MOODS)) { console.error('mood must be one of', Object.keys(MOODS).join(', ')); process.exit(1); }
const DUR = Number(arg('dur', 30)), BPM = Number(arg('bpm', MOODS[mood])), KEY = Number(arg('key', 0));
const OUT = arg('out', 'audio/music.wav'), BEATS = arg('beats', 'audio/beats.json');
const noise = noiseGen(Number(arg('seed', 42)));

const beat = 60 / BPM, bar = beat * 4;
const buf = new Float32Array(Math.ceil(DUR * SR));
const TAIL = 1.6;                                   // final chord rings out
const endAt = Math.max(bar, Math.floor((DUR - TAIL) / beat) * beat);   // last downbeat-ish hit time
const nBeats = Math.round(endAt / beat);

// vi - IV - I - V in A minor / C major, shifted by --key
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]].map((c) => c.map((m) => m + KEY));
const ROOTS = [45, 41, 48, 43].map((m) => m + KEY);

// ---------- voices (all pure functions of local time) ----------
const kick = (t) => Math.sin(2 * Math.PI * (48 * t + (110 / 32) * (1 - Math.exp(-32 * t)))) * Math.exp(-t * 7);
const clap = (t) => noise() * Math.exp(-t * 22) * 0.6 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) * 0.3;
let hp = 0; const hat = (t) => { const n = noise(); const v = n - hp; hp = n; return v * Math.exp(-t * 55) * 0.5; };
const bass = (f, len) => (t) => (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * Math.min(1, t / 0.006) * Math.exp(-t * 2.2) * (t < len - 0.03 ? 1 : Math.max(0, (len - t) / 0.03));
const keys = (f, decay = 3) => (t) => (Math.sin(2 * Math.PI * f * t) + 0.45 * Math.sin(4 * Math.PI * f * t + 0.3) + 0.18 * Math.sin(6 * Math.PI * f * t)) * Math.min(1, t / 0.004) * Math.exp(-t * decay);
const pad = (f, len) => (t) => {
  const env = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (len - t) / 0.8));
  return env * (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t) * 0.8 + Math.sin(2 * Math.PI * f * 2.001 * t) * 0.25) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t));
};
const tom = (t) => Math.sin(2 * Math.PI * (90 * t + (60 / 12) * (1 - Math.exp(-12 * t)))) * Math.exp(-t * 6);
const tick = (t) => Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 120);

const hits = [];
for (let b = 0; b < nBeats; b++) {
  const t = b * beat, inBar = b % 4, barIdx = Math.floor(b / 4), chord = PROG[barIdx % 4], root = ROOTS[barIdx % 4];
  const intro = barIdx === 0;                        // first bar: harmony only, drums enter on bar 2
  const lastBar = b >= nBeats - 4;
  if (mood === 'upbeat') {
    if (!intro) { place(buf, t, 0.45, kick, 0.9); hits.push(t); }
    if (!intro && (inBar === 1 || inBar === 3)) place(buf, t, 0.3, clap, 0.35);
    if (!intro) place(buf, t + beat / 2, 0.08, hat, 0.25);
    for (let e = 0; e < 2; e++) place(buf, t + e * beat / 2, beat / 2, bass(midiHz(root), beat / 2), intro ? 0 : 0.42);
    if (inBar === 0 || inBar === 1) for (const m of chord) place(buf, t + (inBar === 1 ? beat / 2 : 0), 0.8, keys(midiHz(m + 12), 4), 0.11);
  } else if (mood === 'chill') {
    if (!intro && (inBar === 0 || inBar === 2)) { place(buf, t, 0.45, kick, 0.75); hits.push(t); }
    if (!intro && inBar === 2) place(buf, t + beat / 2, 0.3, clap, 0.18);
    if (!intro) for (let e = 0; e < 2; e++) place(buf, t + e * beat / 2, 0.06, hat, 0.12);
    if (inBar === 0) { for (const m of chord) place(buf, t, bar, keys(midiHz(m), 1.1), 0.12); place(buf, t, bar * 0.9, bass(midiHz(root), bar * 0.9), 0.4); }
  } else if (mood === 'cinematic') {
    if (inBar === 0) { for (const m of chord) place(buf, t, bar + 0.6, pad(midiHz(m), bar + 0.6), 0.09); place(buf, t, 0.8, kick, 0.8); hits.push(t); place(buf, t, bar, bass(midiHz(root - 12), bar), 0.35); }
    if (!intro && inBar === 2) place(buf, t, 0.4, kick, 0.45);
    if (barIdx >= 2) place(buf, t + beat / 2, 0.05, tick, 0.08);
    if (lastBar) place(buf, t, 0.6, tom, 0.5 + 0.1 * (b - (nBeats - 4)));
  } else if (mood === 'minimal') {
    if (!intro && inBar === 0) { place(buf, t, 0.45, kick, 0.6); hits.push(t); }
    for (let e = 0; e < 2; e++) {                    // 8th-note arpeggio
      const m = chord[(b * 2 + e) % 3] + 12;
      place(buf, t + e * beat / 2, 0.6, keys(midiHz(m), 5), 0.09);
    }
    if (inBar === 0) place(buf, t, bar * 0.95, bass(midiHz(root), bar * 0.95), 0.3);
    place(buf, t, 0.03, tick, 0.05);
  }
}
// ending: tonic-ish chord + low hit, then ring out
const endChord = PROG[0];
for (const m of endChord) place(buf, endAt, TAIL + 0.4, keys(midiHz(m), 1.4), 0.14);
place(buf, endAt, 0.8, kick, 0.9); place(buf, endAt, TAIL, bass(midiHz(ROOTS[0]), TAIL), 0.45);
hits.push(endAt);

// gentle saturation, then fades
for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.3) / Math.tanh(1.3);
for (let i = 0; i < 0.02 * SR; i++) buf[i] *= i / (0.02 * SR);
const fo = Math.floor(0.3 * SR); for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo;
writeWav(OUT, buf);

const beats = []; for (let b = 0; b <= nBeats; b++) beats.push(+(b * beat).toFixed(3));
const grid = { bpm: BPM, source: 'synth:' + mood, beats, downbeats: beats.filter((_, i) => i % 4 === 0), hits: hits.map((t) => +t.toFixed(3)), end: +endAt.toFixed(3), dur: DUR };
mkdirSync(BEATS.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
writeFileSync(BEATS, JSON.stringify(grid, null, 1));
console.log(`${OUT}  ${mood} @ ${BPM} BPM, ${DUR}s (final hit at ${endAt.toFixed(2)}s)\n${BEATS}  ${beats.length} beats, ${grid.downbeats.length} downbeats`);
