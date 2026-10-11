// Record your own voiceover line by line with a terminal teleprompter.
// Line-by-line takes give exact timings and let you redo one line without redoing the rest.
// Run it in your own terminal (it is interactive).
//
//   node tools/record_vo.mjs --list                      show microphones
//   node tools/record_vo.mjs                             record every line (default mic)
//   node tools/record_vo.mjs --device "Microphone (Realtek(R) Audio)"
//   node tools/record_vo.mjs --line 3                    retake line 3 only
//   then it runs: python tools/vo_assemble.py audio/vo_lines --clean
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, platform } from 'node:process';

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const SCRIPT = arg('script', 'docs/vo_script.md'), OUT = arg('out', 'audio/vo_lines');

function listDevices() {
  if (platform === 'win32') {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { encoding: 'utf8' });
    return [...r.stderr.matchAll(/"([^"]+)"\s*\(audio\)/g)].map((m) => m[1]);
  }
  if (platform === 'darwin') {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { encoding: 'utf8' });
    const audio = r.stderr.split('audio devices:')[1] || '';
    return [...audio.matchAll(/\[(\d+)\] (.+)/g)].map((m) => `${m[1]}: ${m[2].trim()}`);
  }
  return ['default (pulse)'];
}
function inputArgs(device) {
  if (platform === 'win32') return ['-f', 'dshow', '-i', `audio=${device}`];
  if (platform === 'darwin') return ['-f', 'avfoundation', '-i', `:${String(device).split(':')[0]}`];
  return ['-f', 'pulse', '-i', device === 'default (pulse)' ? 'default' : device];
}
// same parsing rules as tools/vo_assemble.py read_script
function readScript(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).map((s) => s.trim())
    .filter((s) => s && !/^(#|<!--|>|---)/.test(s))
    .map((s) => s.replace(/^(\d+[.)]|[-*+])\s+/, '').replace(/^\[[^\]]*\]\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

const devices = listDevices();
if (has('list')) { console.log(devices.length ? devices.join('\n') : 'no audio devices found'); process.exit(0); }
if (!existsSync(SCRIPT)) { console.error(`no script at ${SCRIPT}. Write the narration first (one line per shot).`); process.exit(1); }
const lines = readScript(SCRIPT);
const device = arg('device', devices[0]);
if (!device) { console.error('no microphone found. Run with --list, or record on your phone and use tools/vo_align.py'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const rl = createInterface({ input: stdin, output: stdout });
const only = has('line') ? [Number(arg('line'))] : lines.map((_, i) => i + 1);
const BOLD = '\x1b[1m', DIM = '\x1b[2m', RED = '\x1b[31m', OFF = '\x1b[0m';
console.log(`${DIM}mic: ${device}\nTips: phone-distance from the mic, smile a little, read slightly slower than feels natural.${OFF}`);

for (const n of only) {
  const text = lines[n - 1];
  if (!text) { console.error('no line', n); continue; }
  const target = (text.split(/\s+/).length / 2.5).toFixed(1);
  for (;;) {
    console.log(`\n${DIM}line ${n}/${lines.length}  (aim for ~${target}s)${OFF}\n\n   ${BOLD}${text}${OFF}\n`);
    await rl.question('Enter = start recording ');
    const file = `${OUT}/line_${String(n).padStart(2, '0')}.wav`;
    for (const f of readdirSync(OUT)) if (f.startsWith(`line_${String(n).padStart(2, '0')}.`)) unlinkSync(`${OUT}/${f}`);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputArgs(device), '-ac', '1', '-ar', '48000', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    await rl.question(`${RED}● recording${OFF} - Enter = stop `);
    ff.stdin.write('q');
    await new Promise((r) => ff.on('close', r));
    const ans = (await rl.question(`  ${((Date.now() - t0) / 1000).toFixed(1)}s. Enter = keep, r = redo, p = play: `)).trim().toLowerCase();
    if (ans === 'p') { spawnSync('ffplay', ['-autoexit', '-nodisp', '-loglevel', 'error', file], { stdio: 'inherit' }); const a2 = (await rl.question('  Enter = keep, r = redo: ')).trim().toLowerCase(); if (a2 !== 'r') break; continue; }
    if (ans !== 'r') break;
  }
}
rl.close();

console.log('\nassembling...');
const py = platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(py, ['tools/vo_assemble.py', OUT, '--script', SCRIPT, '--clean'], { stdio: 'inherit' });
if (r.status !== 0) console.log(`run it yourself: ${py} tools/vo_assemble.py ${OUT} --script ${SCRIPT} --clean`);
