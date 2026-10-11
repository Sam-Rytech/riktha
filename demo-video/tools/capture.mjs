// Capture real product assets from a running app (localhost or deployed).
//
//   node tools/capture.mjs --url http://localhost:3000 --routes /,/dashboard,/settings
//   node tools/capture.mjs --url https://myapp.dev --routes / --full --mobile
//   node tools/capture.mjs --url http://localhost:3000 --routes /app --hide ".cookie-banner,#intercom"
//   node tools/capture.mjs --url http://localhost:3000 --routes /app --click "text=Generate" --wait 4000
//
// Writes assets/screens/<route>@desktop.png (+ @mobile), assets/brand/{logo,favicon,og}.*,
// assets/brand/brand.json (colors + fonts read from the live CSS) and assets/manifest.json.
// --click lets you capture a state after an interaction (e.g. a generated result).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const url = arg('url');
if (!url) { console.error('usage: node tools/capture.mjs --url <http://localhost:3000> [--routes /,/a] [--full] [--mobile] [--hide sel] [--click sel] [--wait ms]'); process.exit(1); }
// Routes: "/,/dashboard" or "home,dashboard". Git Bash on Windows rewrites "/x" into
// "C:/Program Files/Git/x"; undo that so captures don't silently hit the wrong page.
const routes = arg('routes', '/').split(',').map((r) => r.trim()).filter(Boolean).map((r) => {
  if (/^[A-Za-z]:[\\/]/.test(r)) r = r.replace(/^[A-Za-z]:[\\/].*?[\\/]Git(?=[\\/]|$)/i, '').replace(/\\/g, '/') || '/';
  if (r === 'home' || r === '.') return '/';
  return r.startsWith('/') || /^https?:/.test(r) ? r : '/' + r;
});
const [vw, vh] = arg('viewport', '1440x900').split('x').map(Number);
const wait = Number(arg('wait', 1500));
const hide = arg('hide', '');
const clicks = arg('click', '') ? arg('click').split('|') : [];
const tag = arg('tag', '');                          // suffix for state captures, e.g. --tag result

mkdirSync('assets/screens', { recursive: true });
mkdirSync('assets/brand', { recursive: true });
const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '')) + (tag ? '-' + tag : '');

const browser = await chromium.launch();
const profiles = [['desktop', { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(arg('scale', 2)) }]];
if (has('mobile')) profiles.push(['mobile', { ...devices['iPhone 13'] }]);

let brand = null;
for (const [name, ctxOpts] of profiles) {
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: arg('scheme', 'light') });
  const page = await ctx.newPage();
  for (const r of routes) {
    const target = new URL(r, url).href;
    try { await page.goto(target, { waitUntil: 'networkidle', timeout: 45000 }); }
    catch { await page.goto(target, { waitUntil: 'load', timeout: 45000 }).catch(() => {}); }
    if (hide) await page.addStyleTag({ content: `${hide} { display: none !important; }` }).catch(() => {});
    for (const sel of clicks) { await page.locator(sel).first().click({ timeout: 10000 }).catch((e) => console.warn('click failed:', sel, e.message)); await page.waitForTimeout(400); }
    await page.waitForTimeout(wait);
    const file = `assets/screens/${slug(r)}@${name}.png`;
    await page.screenshot({ path: file, fullPage: has('full') });
    console.log('captured', file);

    if (!brand && name === 'desktop') {
      brand = await page.evaluate(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const body = cs(document.body);
        const btn = cs(document.querySelector('button, [role=button], a.btn, .button'));
        const h1 = cs(document.querySelector('h1, h2'));
        const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || null;
        const icons = [...document.querySelectorAll('link[rel*=icon]')].map((l) => ({ rel: l.rel, href: l.href, sizes: l.sizes?.value }));
        const logoImg = [...document.querySelectorAll('header img, nav img, img[alt*=logo i], img[src*=logo i]')][0];
        const logoSvg = document.querySelector('header svg, nav svg, [class*=logo] svg');
        return {
          title: document.title, description: meta('description') || meta('og:description'),
          themeColor: meta('theme-color'), ogImage: meta('og:image'),
          colors: { background: body?.backgroundColor, text: body?.color, button: btn?.backgroundColor, buttonText: btn?.color, heading: h1?.color },
          fonts: { body: body?.fontFamily, heading: h1?.fontFamily, headingWeight: h1?.fontWeight },
          icons, logoImg: logoImg?.src || null, logoSvg: logoSvg ? logoSvg.outerHTML : null,
        };
      });
    }
  }
  await ctx.close();
}

// download brand files (logo, icons, og image) with the browser's request context
if (brand) {
  const req = (await browser.newContext()).request;
  const save = async (u, base) => {
    if (!u) return null;
    try {
      const res = await req.get(u); if (!res.ok()) return null;
      const type = res.headers()['content-type'] || '';
      const ext = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : type.includes('icon') ? 'ico' : 'bin';
      const p = `assets/brand/${base}.${ext}`; writeFileSync(p, await res.body()); return p;
    } catch { return null; }
  };
  brand.files = {
    logo: await save(brand.logoImg, 'logo'),
    og: await save(brand.ogImage, 'og'),
    icon: await save((brand.icons.find((i) => /apple/.test(i.rel)) || brand.icons.at(-1))?.href, 'icon'),
  };
  if (brand.logoSvg) { writeFileSync('assets/brand/logo-inline.svg', brand.logoSvg); brand.files.logoSvg = 'assets/brand/logo-inline.svg'; }
  delete brand.logoSvg;
  writeFileSync('assets/brand/brand.json', JSON.stringify(brand, null, 2));
  console.log('brand ->', 'assets/brand/brand.json');
}
await browser.close();

// manifest of everything in assets/
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p.replace(/\\/g, '/')]; });
const files = walk('assets').filter((f) => !f.endsWith('manifest.json'));
writeFileSync('assets/manifest.json', JSON.stringify({ source: url, captured: new Date().toISOString(), files }, null, 2));
console.log(`\n${files.length} files in assets/ (see assets/manifest.json). Look at them before animating.`);
