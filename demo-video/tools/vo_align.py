"""Time a single-take voiceover (phone memo, Audacity, Loom audio...) against the script.

    python tools/vo_align.py audio/my_take.m4a [--script docs/vo_script.md] [--clean] [--noise -35] [--min-silence 0.3]

Finds speech segments with ffmpeg silencedetect and maps them to script lines in order.
More segments than lines -> merges across the shortest pauses. Fewer -> falls back to
splitting by word count and says so (then re-record with clearer pauses between lines,
or use tools/record_vo.mjs which records line by line).
Writes audio/vo.wav (levelled, optionally cleaned; timing unchanged), audio/vo.json, audio/vo.srt.
"""
import argparse
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vo_assemble import CLEAN, read_script, summary, write_outputs  # noqa: E402


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())


def speech_segments(path, noise, min_sil):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=noise={noise}dB:d={min_sil}", "-f", "null", "-"],
                       capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    total = duration(path)
    segs, cur = [], 0.0
    for i, s in enumerate(starts):
        if s - cur > 0.15:
            segs.append([cur, s])
        cur = ends[i] if i < len(ends) else total
    if total - cur > 0.15:
        segs.append([cur, total])
    return segs, total


def fit(segs, n):
    segs = [list(s) for s in segs]
    while len(segs) > n:                       # merge across the shortest pause
        gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
        i = gaps.index(min(gaps))
        segs[i:i + 2] = [[segs[i][0], segs[i + 1][1]]]
    return segs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("take")
    ap.add_argument("--script", default="docs/vo_script.md")
    ap.add_argument("--clean", action="store_true", help="high-pass + denoise + compression")
    ap.add_argument("--noise", type=float, default=-35)
    ap.add_argument("--min-silence", type=float, default=0.3)
    ap.add_argument("--out", default="audio/vo.wav")
    a = ap.parse_args()

    texts = read_script(a.script)
    if not texts:
        sys.exit(f"no narration lines in {a.script}")
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    chain = ",".join(([CLEAN] if a.clean else []) + ["loudnorm=I=-16:TP=-1.5:LRA=9"])
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", a.take, "-af", chain, "-ar", "48000", "-ac", "1", a.out], check=True)

    segs, total = speech_segments(a.out, a.noise, a.min_silence)
    n, found = len(texts), len(segs)
    if found >= n:
        segs = fit(segs, n)
        mode = "silence-aligned"
    else:
        first, last = (segs[0][0], segs[-1][1]) if segs else (0, total)
        words = [len(t.split()) for t in texts]
        span, acc, segs = last - first, 0, []
        for w in words:
            s = first + span * acc / sum(words)
            acc += w
            segs.append([s, first + span * acc / sum(words)])
        mode = f"PROPORTIONAL fallback (found {found} pause-separated segments < {n} lines; timings are estimates)"
    lines = [{"i": i + 1, "text": texts[i], "start": round(s, 3), "end": round(e, 3)} for i, (s, e) in enumerate(segs)]
    write_outputs(lines, total, round(lines[0]["start"], 3), os.path.splitext(a.out)[0] + ".json", os.path.splitext(a.out)[0] + ".srt")
    print("alignment:", mode)
    summary(lines, total, a.out)


if __name__ == "__main__":
    main()
