"""Assemble per-line voiceover clips into one track with exact timings.

    python tools/vo_assemble.py audio/vo_lines [--script docs/vo_script.md] [--clean] [--gap 0.35] [--lead 0.4]

Takes line_01.*, line_02.* ... (wav/mp3/m4a/aiff, any rate), trims leading/trailing
silence, levels each line, joins them with a gap and writes:
    audio/vo.wav   the voiceover
    audio/vo.json  {dur, lead, lines: [{i, text, start, end}]}   <- the film's cut list
    audio/vo.srt   subtitles for Devpost / YouTube uploads
--clean adds mic cleanup (high-pass, denoise, gentle compression) for your own recordings.
Also imported by tts.py and record_vo.mjs.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

SR = 48000
AUDIO_EXT = (".wav", ".mp3", ".m4a", ".aiff", ".aif", ".ogg", ".webm", ".flac")


def read_script(path):
    """One narration line per non-empty line. Skips headings, comments and blockquotes;
    strips list markers and [shot] / (stage direction) annotations."""
    lines = []
    with open(path, encoding="utf-8") as f:
        for raw in f:
            s = raw.strip()
            if not s or s.startswith(("#", "<!--", ">", "---")):
                continue
            s = re.sub(r"^(\d+[.)]|[-*+])\s+", "", s)
            s = re.sub(r"^\[[^\]]*\]\s*", "", s)          # [0:04 hook] prefix
            s = re.sub(r"\s*\([^)]*\)\s*$", "", s)         # trailing (stage direction)
            s = s.strip().strip('"').strip()
            if s:
                lines.append(s)
    return lines


def ffmpeg(*args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit("ffmpeg failed: " + r.stderr.strip())


TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse"
CLEAN = "highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=90"
LEVEL = "loudnorm=I=-16:TP=-1.5:LRA=7"


def normalize_clip(src, dst, clean=False):
    chain = ",".join([c for c in (CLEAN if clean else None, TRIM, LEVEL) if c])
    ffmpeg("-i", src, "-af", chain, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst)


def read_pcm(path):
    with wave.open(path, "rb") as w:
        return w.readframes(w.getnframes()), w.getnframes() / w.getframerate()


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_outputs(lines, dur, lead, out_json, out_srt):
    os.makedirs(os.path.dirname(out_json) or ".", exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"dur": round(dur, 3), "lead": lead, "lines": lines}, f, indent=1, ensure_ascii=False)
    with open(out_srt, "w", encoding="utf-8") as f:
        for l in lines:
            f.write(f"{l['i']}\n{srt_time(l['start'])} --> {srt_time(l['end'])}\n{l['text']}\n\n")


def assemble(clips, texts, out_wav="audio/vo.wav", out_json="audio/vo.json", clean=False, gap=0.35, lead=0.4, gaps=None):
    """clips: list of audio paths in order. gaps: optional per-line pause overrides."""
    tmp = tempfile.mkdtemp(prefix="vo_")
    pcm = bytearray(b"\x00\x00" * int(lead * SR))
    t, lines = lead, []
    for i, src in enumerate(clips):
        dst = os.path.join(tmp, f"{i:03d}.wav")
        normalize_clip(src, dst, clean)
        data, d = read_pcm(dst)
        pcm += data
        lines.append({"i": i + 1, "text": texts[i] if i < len(texts) else "", "start": round(t, 3), "end": round(t + d, 3)})
        t += d
        if i < len(clips) - 1:
            g = (gaps or {}).get(i + 1, gap)
            pcm += b"\x00\x00" * int(g * SR)
            t += g
    pcm += b"\x00\x00" * int(0.3 * SR)
    os.makedirs(os.path.dirname(out_wav) or ".", exist_ok=True)
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(pcm))
    dur = len(pcm) / 2 / SR
    write_outputs(lines, dur, lead, out_json, os.path.splitext(out_json)[0] + ".srt")
    return lines, dur


def find_clips(folder):
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(AUDIO_EXT) and f.lower().startswith("line_"))
    return [os.path.join(folder, f) for f in files]


def summary(lines, dur, out="audio/vo.wav"):
    for l in lines:
        print(f"  {l['i']:>2}  {l['start']:6.2f}-{l['end']:6.2f}s  {l['text'][:70]}")
    base = os.path.splitext(out)[0]
    print(f"voiceover: {dur:.2f}s total -> {out}, {base}.json, {base}.srt")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", nargs="?", default="audio/vo_lines")
    ap.add_argument("--script", default="docs/vo_script.md")
    ap.add_argument("--clean", action="store_true", help="mic cleanup for your own recordings")
    ap.add_argument("--gap", type=float, default=0.35)
    ap.add_argument("--lead", type=float, default=0.4)
    ap.add_argument("--out", default="audio/vo.wav")
    a = ap.parse_args()
    clips = find_clips(a.folder)
    if not clips:
        sys.exit(f"no line_XX audio files in {a.folder}")
    texts = read_script(a.script) if os.path.exists(a.script) else []
    if texts and len(texts) != len(clips):
        print(f"warning: {len(clips)} clips but {len(texts)} script lines", file=sys.stderr)
    summary(*assemble(clips, texts, a.out, os.path.splitext(a.out)[0] + ".json", a.clean, a.gap, a.lead), a.out)
