// Final mix: picture + voiceover + music (ducked under the voice) + SFX, normalized to -14 LUFS.
//
//   node tools/mix.mjs                                        uses whatever exists in audio/
//   node tools/mix.mjs --video out/silent_16x9.mp4 --out out/final_16x9.mp4
//   node tools/mix.mjs --music-db -20 --no-sfx
// Defaults: --video out/silent.mp4  --vo audio/vo.wav  --music audio/music.wav  --sfx audio/sfx.wav  --out out/final.mp4
// Music sits at -6 dB alone and -16 dB under a voice, then ducks further while words are spoken.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const video = arg('video', 'out/silent.mp4');
const out = arg('out', 'out/final.mp4');
const pick = (k, d) => (has('no-' + k) ? null : existsSync(arg(k, d)) ? arg(k, d) : null);
const vo = pick('vo', 'audio/vo.wav'), music = pick('music', 'audio/music.wav'), sfx = pick('sfx', 'audio/sfx.wav');
if (!existsSync(video)) { console.error(`no video at ${video}. Render first: node tools/render.mjs`); process.exit(1); }

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' });
const DUR = Number(probe.stdout.trim());
const musicDb = Number(arg('music-db', vo ? -16 : -6));
const sfxDb = Number(arg('sfx-db', -4));
const voDelay = Number(arg('vo-delay', 0));

const inputs = ['-i', video], f = [], mixIn = [];
const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
let idx = 1;
if (vo) {
  inputs.push('-i', vo);
  f.push(`[${idx}:a]${fmt},adelay=${Math.round(voDelay * 1000)}:all=1,apad,asplit=2[vo][vokey]`);
  mixIn.push('[vo]'); idx++;
}
if (music) {
  inputs.push('-i', music);
  const fade = `afade=t=out:st=${Math.max(0, DUR - 1.2).toFixed(2)}:d=1.2`;
  f.push(`[${idx}:a]${fmt},volume=${musicDb}dB,apad,${fade}[mus0]`);
  if (vo) f.push('[mus0][vokey]sidechaincompress=threshold=0.015:ratio=6:attack=25:release=400:makeup=1[mus]');
  mixIn.push(vo ? '[mus]' : '[mus0]'); idx++;
} else if (vo) f.push('[vokey]anullsink');
if (sfx) {
  inputs.push('-i', sfx);
  f.push(`[${idx}:a]${fmt},volume=${sfxDb}dB,apad[sfx]`);
  mixIn.push('[sfx]'); idx++;
}
if (!mixIn.length) { console.error('no audio found (audio/vo.wav, audio/music.wav, audio/sfx.wav)'); process.exit(1); }
f.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:duration=longest,atrim=0:${DUR.toFixed(3)},loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[a]`);

mkdirSync(dirname(out) || '.', { recursive: true });
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', f.join(';'),
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', DUR.toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

// report integrated loudness
const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', out, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
const I = m.stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)/);
console.log(`${out}  ${DUR.toFixed(2)}s  audio: ${[vo && 'voice', music && 'music', sfx && 'sfx'].filter(Boolean).join(' + ')}  loudness: ${I ? I[1] + ' LUFS' : '?'}`);
