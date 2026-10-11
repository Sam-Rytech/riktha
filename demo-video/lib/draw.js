// Canvas drawing helpers. Pure: they only paint what you pass in.
import { clamp, spring } from './motion.js';

export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Draw an image to fill a box (object-fit: cover), optional rounded clip and focal point.
export function cover(g, img, x, y, w, h, { r = 0, fx = 0.5, fy = 0.5 } = {}) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  const sx = (img.width - sw) * fx, sy = (img.height - sh) * fy;
  g.save();
  if (r) { rrect(g, x, y, w, h, r); g.clip(); }
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  g.restore();
}

// Draw an image to fit inside a box (object-fit: contain). Returns the drawn rect.
export function contain(g, img, x, y, w, h) {
  if (!img) return null;
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s, dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  g.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

// Arrow cursor. press: 0..1 click squash.
export function cursor(g, x, y, scale = 1, press = 0) {
  g.save();
  g.translate(x, y);
  g.scale(scale * (1 - 0.12 * press), scale * (1 - 0.12 * press));
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 34); g.lineTo(9, 26); g.lineTo(16, 41);
  g.lineTo(22, 38); g.lineTo(15, 24); g.lineTo(26, 24); g.closePath();
  g.fillStyle = '#111'; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
  g.restore();
}

// Click ripple at (x, y), t seconds after the click.
export function ripple(g, x, y, t, color = '#fff', size = 60) {
  if (t < 0 || t > 0.5) return;
  const p = t / 0.5;
  g.save();
  g.globalAlpha = (1 - p) * 0.5;
  g.strokeStyle = color; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, size * p, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// Text with letter-spacing (tracking in px). align: 'left' | 'center' | 'right'.
export function text(g, str, x, y, { font, color, align = 'left', tracking = 0, alpha = 1 } = {}) {
  g.save();
  if (font) g.font = font;
  if (color) g.fillStyle = color;
  g.globalAlpha *= alpha;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) { g.letterSpacing = tracking + 'px'; g.textAlign = align; g.fillText(str, x, y); }
  else { g.textAlign = align; g.fillText(str, x, y); }
  g.restore();
}

// Kinetic word-by-word reveal: each word springs up from a mask on a stagger.
export function kinetic(g, str, x, y, t, { font, color, size = 120, stagger = 0.06, align = 'left', lineH = 1.05, maxW = Infinity } = {}) {
  g.save();
  g.font = font || `800 ${size}px Inter, system-ui, sans-serif`;
  g.fillStyle = color || '#fff';
  g.textBaseline = 'alphabetic';
  const words = str.split(' ');
  // simple word wrap
  const lines = [[]]; let w = 0;
  const space = g.measureText(' ').width;
  for (const word of words) {
    const ww = g.measureText(word).width;
    if (w + ww > maxW && lines.at(-1).length) { lines.push([]); w = 0; }
    lines.at(-1).push(word); w += ww + space;
  }
  let i = 0;
  lines.forEach((line, li) => {
    const lw = line.reduce((a, wd) => a + g.measureText(wd).width, 0) + space * (line.length - 1);
    let cx = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x;
    const ly = y + li * size * lineH;
    for (const word of line) {
      const s = spring(t - i * stagger, 260, 24);
      const ww = g.measureText(word).width;
      g.save();
      g.beginPath(); g.rect(cx - 4, ly - size * 1.0, ww + 8, size * 1.25); g.clip();
      g.fillText(word, cx, ly + (1 - s) * size * 1.1);
      g.restore();
      cx += ww + space; i++;
    }
  });
  g.restore();
}

// Caption bar for voiceover lines (subtitles). line = {text, start, end}.
export function caption(g, L, line, t, { font, color = '#fff', bg = 'rgba(0,0,0,0.55)' } = {}) {
  if (!line || t < line.start || t > line.end + 0.15) return;
  const a = Math.min(clamp((t - line.start) / 0.12), clamp((line.end + 0.15 - t) / 0.15));
  const size = 40 * L.u;
  g.save();
  g.font = font || `600 ${size}px Inter, system-ui, sans-serif`;
  const maxW = L.W - 2 * L.pad;
  // wrap to at most 2 lines
  const words = line.text.split(' '); const rows = [''];
  for (const w of words) { const test = rows.at(-1) ? rows.at(-1) + ' ' + w : w; if (g.measureText(test).width > maxW - 48 * L.u && rows.at(-1)) rows.push(w); else rows[rows.length - 1] = test; }
  const lh = size * 1.3, h = rows.length * lh + 28 * L.u;
  const y = L.H - L.safe.y * 0.6 - h - (L.portrait ? 120 * L.u : 40 * L.u);
  const w = Math.max(...rows.map((r) => g.measureText(r).width)) + 48 * L.u;
  g.globalAlpha = a;
  g.fillStyle = bg; rrect(g, L.cx - w / 2, y, w, h, 16 * L.u); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  rows.forEach((r, i) => g.fillText(r, L.cx, y + 14 * L.u + lh * (i + 0.5)));
  g.restore();
}

// Soft drop shadow for a card, no glow.
export function shadow(g, on = true, u = 1) {
  if (on) { g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 40 * u; g.shadowOffsetY = 18 * u; }
  else { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }
}
