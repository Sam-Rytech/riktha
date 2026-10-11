// UI sound effects synthesized from a cue list, placed on the same timeline as the picture.
//
//   node tools/sfx.mjs audio/cues.json audio/sfx.wav [--dur 45]
//   cues.json: [{"t":0.5,"type":"click"}, {"t":2.0,"type":"whoosh","gain":0.8}, ...]
//   types: click, pop, thump, whoosh, rise, tick, type, success
// Put cues on measured beats/hits from audio/beats.json and on cursor clicks in index.html.
import { readFileSync } from 'node:fs';
import { SR, writeWav, noiseGen, place } from './wav.mjs';

const [cuesPath = 'audio/cues.json', out = 'audio/sfx.wav'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const di = process.argv.indexOf('--dur');
const cues = JSON.parse(readFileSync(cuesPath, 'utf8'));
const noise = noiseGen(7);
const end = di > 0 ? Number(process.argv[di + 1]) : Math.max(1, ...cues.map((c) => c.t)) + 2;
const buf = new Float32Array(Math.ceil(end * SR));

let lp = 0;
const VOICES = {
  click:   [0.05, (t) => Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 90) * 0.5],
  pop:     [0.15, (t) => Math.sin(2 * Math.PI * (600 + 900 * t) * t) * Math.exp(-t * 30) * 0.4],
  thump:   [0.5,  (t) => Math.sin(2 * Math.PI * (90 - 60 * t) * t) * Math.exp(-t * 9) * 0.9],
  whoosh:  [0.35, (t) => { lp += (noise() - lp) * (0.05 + 0.4 * Math.sin(Math.PI * t / 0.35)); return lp * Math.sin(Math.PI * Math.min(1, t / 0.35)) * 0.9; }],
  rise:    [0.8,  (t) => { lp += (noise() - lp) * (0.02 + 0.5 * t / 0.8); return lp * (t / 0.8) ** 2 * 0.9 + Math.sin(2 * Math.PI * (200 + 600 * t) * t) * (t / 0.8) * 0.08; }],
  tick:    [0.03, (t) => Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 160) * 0.35],
  type:    [0.04, (t) => noise() * Math.exp(-t * 140) * 0.25 + Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 200) * 0.15],
  success: [0.6,  (t) => (Math.sin(2 * Math.PI * 880 * t) * (t < 0.12 ? 1 : 0) + Math.sin(2 * Math.PI * 1320 * t) * (t >= 0.1 ? 1 : 0)) * Math.exp(-t * 6) * 0.3],
};

for (const c of cues) {
  const v = VOICES[c.type];
  if (!v) { console.warn('unknown cue type', c.type, '(skipped)'); continue; }
  lp = 0;
  place(buf, c.t, v[0], v[1], c.gain ?? 1);
}
writeWav(out, buf, { peak: 0.7 });
console.log(`${out}  ${cues.length} cues, ${end.toFixed(2)}s`);
