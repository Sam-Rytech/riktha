// Deterministic, uncropped screenshots for design QA, via the Chrome DevTools Protocol.
// Why: the in-app browser pane can crop captures under Windows display scaling, and plain
// `chrome --headless --window-size` can't go below ~500px wide. CDP device emulation renders at an exact
// width (any size), measures the real page height, and captures it in one image, then slices it.
//
// Usage: node scripts/qa-shots.mjs <url> <out_dir> [width x height ...]
//   e.g. node scripts/qa-shots.mjs http://localhost:3000/ shots 1440x900 768x1024 390x844
//   --at=<y>  also capture one viewport frame scrolled to y (<w>-at<y>.png), for scroll-dependent UI like a sticky nav
// Writes <out_dir>/<w>-full.png and <w>-00.png, <w>-01.png … (each exactly w x h), plus <w>-check.json
// with the measured left edges (header logo, headings, footer) for the alignment check.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const args = process.argv.slice(2);
const at = args.filter((a) => a.startsWith("--at=")).map((a) => Number(a.slice(5)));
const [url, out, ...sizes] = args.filter((a) => !a.startsWith("--"));
const viewports = (sizes.length ? sizes : ["1440x900", "768x1024", "390x844"]).map((s) => s.split("x").map(Number));
mkdirSync(out, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), `qa-chrome-${port}`);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("Chrome DevTools didn't start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");

const MEASURE = `(() => {
  const vis = (e) => e && e.getBoundingClientRect().width > 0;
  const L = (e) => Math.round(e.getBoundingClientRect().left);
  const logo = [...document.querySelectorAll('a[aria-label="Riktha home"]')].find(vis);
  const footer = [...document.querySelectorAll('footer p')].find(vis);
  const heads = [...document.querySelectorAll('main h1, main h2')].filter(vis)
    .filter((h) => !h.closest('[class*="rounded-[var(--radius-slab)]"]')).map((h) => ({ t: h.innerText.slice(0, 32), left: L(h) }));
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, logo: logo ? L(logo) : null, footer: footer ? L(footer) : null, heads };
})()`;

for (const [w, h] of viewports) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url });
  await sleep(3500); // load, fonts, entrance animations
  await evaluate("document.fonts.ready.then(() => true)");
  // Scroll through once so on-scroll motion reaches its final state, then return to the top.
  await evaluate(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += ${h}) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 600)); return true; })()`);
  const check = await evaluate(MEASURE);
  const pageH = await evaluate("document.documentElement.scrollHeight");
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: pageH, scale: 1 } });
  const full = join(out, `${w}-full.png`);
  writeFileSync(full, Buffer.from(shot.data, "base64"));
  writeFileSync(join(out, `${w}-check.json`), JSON.stringify(check, null, 2));
  for (const y of at) {
    await evaluate(`(async () => { scrollTo(0, ${y}); await new Promise(r => setTimeout(r, 900)); return true; })()`);
    const v = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(out, `${w}-at${y}.png`), Buffer.from(v.data, "base64"));
  }
  console.log(`${w}x${h}: page ${pageH}px, scrollWidth ${check.scrollWidth}, logo ${check.logo}, footer ${check.footer}, headings ${[...new Set(check.heads.map((x) => x.left))].join("/")}`);
}

ws.close();
chrome.kill();
