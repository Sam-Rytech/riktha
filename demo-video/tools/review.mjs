// Review sheets for the critique loop: Claude opens these images and scores them.
//
//   node tools/review.mjs                         contact + phone + poster for out/final.mp4 (or silent.mp4)
//   node tools/review.mjs --at 4.2                + a 12-frame strip around 4.2s (catch pops / overlaps)
//   node tools/review.mjs --loop                  + out/review/loop_check.mp4 (played twice, watch the seam)
//   node tools/review.mjs --poster 6.5            poster/thumbnail frame time (default: 40% in)
//   node tools/review.mjs --hash out/stills/0003.png   sha256 for determinism checks
// Writes to out/review/.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

if (has('hash')) {
  for (const f of argv.slice(argv.indexOf('--hash') + 1)) console.log(createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16), f);
  process.exit(0);
}

const video = arg('video', existsSync('out/final.mp4') ? 'out/final.mp4' : 'out/silent.mp4');
if (!existsSync(video)) { console.error('no video to review:', video); process.exit(1); }
const D = 'out/review';
mkdirSync(D, { recursive: true });
const ffTry = (...a) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' }).status === 0;
const ff = (...a) => { if (!ffTry(...a)) { console.error('ffmpeg failed:', a.join(' ')); process.exit(1); } };
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', video], { encoding: 'utf8' }).stdout);
const dur = Number(probe.format.duration);
const vs = probe.streams.find((s) => s.codec_type === 'video');
const wide = vs.width > vs.height;

// contact sheet: <= 36 frames spread over the film, 6 across, timestamps burned in
const n = Math.min(36, Math.max(6, Math.round(dur * 2)));
const rate = (n / dur).toFixed(4), rows = Math.ceil(n / 6);
// drawtext needs a font: Windows ffmpeg builds often lack fontconfig, so name a font file directly
const winFont = process.platform === 'win32' && existsSync('C:/Windows/Fonts/arial.ttf') ? ":fontfile='C\\:/Windows/Fonts/arial.ttf'" : '';
const stamp = `drawtext=text='%{pts\\:hms}'${winFont}:x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,`;
const tile = `tile=6x${rows}:padding=6:color=0x222222`;
if (!ffTry('-i', video, '-vf', `fps=${rate},scale=${wide ? 480 : 270}:-2,${stamp}${tile}`, '-frames:v', '1', `${D}/contact.png`)) {
  console.warn('timestamp overlay unavailable; contact sheet without timestamps (frame k is at k / ' + rate + ' s)');
  ff('-i', video, '-vf', `fps=${rate},scale=${wide ? 480 : 270}:-2,${tile}`, '-frames:v', '1', `${D}/contact.png`);
}

// phone test: how it reads at 360px wide
ff('-i', video, '-vf', `fps=${Math.min(1, 15 / dur).toFixed(4)},scale=360:-2,tile=5x3:padding=6:color=0x222222`, '-frames:v', '1', `${D}/phone.png`);

// poster / thumbnail
const posterT = Number(arg('poster', (dur * 0.4).toFixed(2)));
ff('-ss', String(posterT), '-i', video, '-frames:v', '1', `${D}/poster.png`);

if (has('at')) {
  const at = Number(arg('at'));
  ff('-ss', Math.max(0, at - 0.1).toFixed(3), '-i', video, '-vf', `scale=${wide ? 400 : 240}:-2,tile=12x1:padding=4`, '-frames:v', '1', `${D}/strip_${at}.png`);
}
if (has('loop')) ff('-stream_loop', '1', '-i', video, '-c', 'copy', `${D}/loop_check.mp4`);

// loudness, if there is audio
let loud = 'no audio';
if (probe.streams.some((s) => s.codec_type === 'audio')) {
  const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', video, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const I = m.stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)/);
  loud = I ? `${I[1]} LUFS (target -14)` : '?';
}
console.log(`${video}: ${vs.width}x${vs.height}, ${dur.toFixed(2)}s, ${loud}
review sheets in ${D}/: contact.png (${n} frames), phone.png, poster.png${has('at') ? ', strip' : ''}${has('loop') ? ', loop_check.mp4' : ''}
Now open them and run the critique pass.`);
