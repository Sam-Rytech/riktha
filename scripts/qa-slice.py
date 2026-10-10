"""Slice the full-page captures from qa-shots.mjs into viewport-sized frames (no cropping or scaling).

Usage: python scripts/qa-slice.py <out_dir> [width x height ...]
"""
import sys
from pathlib import Path

from PIL import Image

out = Path(sys.argv[1])
sizes = [tuple(map(int, s.split("x"))) for s in (sys.argv[2:] or ["1440x900", "768x1024", "390x844"])]
for w, h in sizes:
    full = Image.open(out / f"{w}-full.png").convert("RGB")
    assert full.width == w, f"{w}-full.png is {full.width}px wide, expected {w}"
    n = 0
    for n, top in enumerate(range(0, full.height, h)):
        frame = Image.new("RGB", (w, h), full.getpixel((0, full.height - 1)))
        frame.paste(full.crop((0, top, w, min(top + h, full.height))), (0, 0))
        frame.save(out / f"{w}-{n:02d}.png")
    print(f"{w}: {full.height}px -> {n + 1} frames of {w}x{h}")
