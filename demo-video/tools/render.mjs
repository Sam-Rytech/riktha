// Deterministic renderer: walks time, calls window.seek(t), pipes frames into ffmpeg.
//
//   node tools/render.mjs                         final render, 1080x1920, 30fps, 2 subframes (motion blur)
//   node tools/render.mjs --hq                    flagship quality: 60fps, 4 subframes (~4x slower)
//   node tools/render.mjs --w 1920 --h 1080 --out out/silent_16x9.mp4
//   node tools/render.mjs --draft                 960px short side, 30fps, no motion blur (fast check)
//   node tools/render.mjs --stills beats          one PNG per beat (or per scene) + contact sheet
//   node tools/render.mjs --stills 0.5,2,4.2      specific times
//   node tools/render.mjs --serve                 live preview server, open the printed URL
//   node tools/render.mjs --from 4 --dur 3        re-render a section (out/section.mp4)
//   --workers N (parallel browser contexts, default cores-1 up to 4)  --png (lossless frames)  --fps --sub --crf
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { resolve, extname, join, sep } from 'node:path';
import { cpus } from 'node:os';

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const num = (k, d) => { const v = arg(k, undefined); return v === undefined ? d : Number(v); };

const draft = has('draft');
let W = num('w', 1080), H = num('h', 1920);
if (draft) { const s = 960 / Math.min(W, H); W = Math.round(W * s / 2) * 2; H = Math.round(H * s / 2) * 2; }
const hq = has('hq');
const FPS = num('fps', hq ? 60 : 30);
const SUB = Math.max(1, num('sub', draft ? 1 : hq ? 4 : 2));
const SHUTTER = num('shutter', 0.5);           // fraction of a frame the motion blur spans (0.5 = 180deg)
const PAGE = arg('page', 'index.html');
const ROOT = resolve('.');

// ---------- static server: file:// blocks module imports and fetch ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const server = createServer((req, res) => {
  const p = resolve(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!(p === ROOT || p.startsWith(ROOT + sep)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(has('serve') ? num('port', 5173) : 0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${PAGE}?w=${W}&h=${H}`;

if (has('serve')) {
  console.log(`preview: ${base}\nfreeze a frame: ${base}&t=4.2\nCtrl+C to stop`);
} else {
  const browser = await chromium.launch();
  const openPage = async () => (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const page = await openPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  try { await page.waitForFunction(() => typeof window.seek === 'function', null, { timeout: 30000 }); }
  catch { console.error('window.seek never appeared. Page errors:\n' + errors.join('\n')); process.exit(1); }
  if (errors.length) console.warn('page warnings:\n  ' + errors.join('\n  '));

  const info = await page.evaluate(() => ({ dur: window.DUR, cuts: window.CUTS || [], scenes: window.SCENES || [] }));
  const FROM = num('from', 0);
  const DUR = num('dur', (info.dur ?? 15) - FROM);
  // Frame grab. JPEG q0.95 is ~2x faster than PNG and visually lossless before x264; --png for lossless.
  const grab = (pg, t, fmt = 'image/png') => pg.evaluate(([t, fmt]) => { window.seek(t); return document.querySelector('canvas').toDataURL(fmt, 0.95); }, [t, fmt])
    .then((u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
  const ff = (args, opts = {}) => new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
    p.on('error', rej); p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
  });

  if (has('stills')) {
    // ---------- stills + contact sheet for the critique loop ----------
    const spec = arg('stills', 'beats');
    let times;
    if (spec === 'beats' || spec === 'downbeats') {
      let bj = null; try { bj = JSON.parse(readFileSync('audio/beats.json', 'utf8')); } catch {}
      times = bj?.[spec]?.length ? bj[spec].filter((t) => t < info.dur) : null;
      if (!times) times = info.scenes.flatMap((s) => [s.from + 0.35, (s.from + s.to) / 2]);   // no beat grid: 2 per scene
    } else if (spec === 'scenes') times = info.scenes.flatMap((s) => [s.from + 0.35, (s.from + s.to) / 2, s.to - 0.1]);
    else times = spec.split(',').map(Number);
    const dir = 'out/stills';
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (let i = 0; i < times.length; i++) writeFileSync(`${dir}/${String(i).padStart(4, '0')}.png`, await grab(page, times[i]));
    writeFileSync(`${dir}/times.json`, JSON.stringify(times.map((t) => +t.toFixed(3))));
    const cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols);
    const tw = W > H ? 480 : 270;
    await ff(['-framerate', '1', '-i', `${dir}/%04d.png`, '-vf', `scale=${tw}:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', 'out/contact_stills.png']);
    console.log(`${times.length} stills -> ${dir}/ (times.json lists their timestamps)\ncontact sheet -> out/contact_stills.png`);
  } else {
    // ---------- full render with cut-aware motion blur ----------
    mkdirSync('out', { recursive: true });
    const out = arg('out', has('from') ? 'out/section.mp4' : draft ? 'out/draft.mp4' : 'out/silent.mp4');
    const vf = SUB > 1 ? ['-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`] : [];
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-',
      ...vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', String(num('crf', 16)),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r, j) => { p.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg exited ' + c)))); p.on('error', j); });
    // Parallel workers: each is its own browser context (own renderer process), rasterizing frames
    // concurrently; frames are still written to ffmpeg strictly in order.
    const WORKERS = Math.max(1, num('workers', Math.min(4, cpus().length - 1)));
    const FMT = has('png') ? 'image/png' : 'image/jpeg';
    const pages = [page];
    while (pages.length < WORKERS) { const pg = await openPage(); await pg.goto(base); await pg.waitForFunction(() => typeof window.seek === 'function'); pages.push(pg); }
    const samples = [];
    const frames = Math.round(DUR * FPS), t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      const t = FROM + f / FPS;
      for (let j = 0; j < SUB; j++) {
        // samples trail the frame time; a sample that would cross a cut is pinned to the cut
        let s = t - (SHUTTER / FPS) * (SUB - 1 - j) / SUB;
        for (const c of info.cuts) if (s < c && c <= t) s = c;
        samples.push(Math.max(0, s));
      }
    }
    const inflight = [];
    for (let i = 0; i < samples.length || inflight.length; ) {
      while (i < samples.length && inflight.length < WORKERS * 3) { inflight.push(grab(pages[i % WORKERS], samples[i], FMT)); i++; }
      const buf = await inflight.shift();
      if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
      const doneN = i - inflight.length;
      if (doneN % (FPS * SUB) === 0) {
        const el = (Date.now() - t0) / 1000, eta = (el / doneN) * (samples.length - doneN);
        process.stdout.write(`
${(doneN / SUB / FPS).toFixed(0)}s / ${DUR.toFixed(1)}s  (eta ${eta.toFixed(0)}s)   `);
      }
    }
    p.stdin.end(); await done;
    console.log(`\n${out}  ${W}x${H} @${FPS}fps, ${SUB} subframes, ${DUR.toFixed(2)}s, ${WORKERS} workers, rendered in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
  server.close();
}
