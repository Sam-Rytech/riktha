# Demo film studio rules

This folder makes a hackathon demo video rendered from code. These rules apply to every edit here.

## Render contract
- The film is a pure function of time: `window.seek(t)` in index.html paints frame t.
- No CSS transitions, no setTimeout/setInterval, no requestAnimationFrame in render mode,
  no state carried between frames. Seeded noise only (`rng()` in lib/motion.js), never Math.random.
- Motion uses closed-form springs from lib/motion.js. Any value with more than one target uses `track()`.
- Render with `node tools/render.mjs` (H.264 yuv420p, CRF 16). Use `--draft` while iterating.

## Truth
- Real product UI only: screenshots from tools/capture.mjs in assets/. Never redraw or invent screens,
  features, numbers, users or logos. If a metric isn't real, leave it out or label it as a target.

## Look
- Banned defaults: centered title on a gradient, everything fading in, corner labels and frame
  borders, glow on UI chrome, generic particle bursts, stock "AI" sparkles.
- One display face, one UI face, one accent color unless the brief says otherwise.
- Something new happens on screen every 2 to 4 seconds. Hook lands in the first 2 seconds.
- Text must read at 360 px wide (phone test). Keep it inside the safe area from `layout()`.

## Sound
- Voiceover (if any) drives the timeline: scene times come from audio/vo.json.
- Music: supplied track measured with tools/beats.py, or synthesized with tools/music.mjs.
  Ducked under the voice in tools/mix.mjs. Final loudness -14 LUFS.
- SFX from tools/sfx.mjs on cursor clicks and measured beats.

## Secrets
- API keys live in .env and are referred to by name (ELEVENLABS_API_KEY). Never print or paste them.

## Loop before showing anything
1. `node tools/render.mjs --stills beats` (or a full render + `node tools/review.mjs`) and LOOK at the sheets.
2. Score 1-10: hook in first 2s, phone readability, motion quality, variety, composition,
   brand accuracy, story clarity for judges, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+. Log rounds in docs/review_log.md.
4. Only then do the full render and mix.
