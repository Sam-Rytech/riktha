"""Measure a supplied music track: beats, downbeats and onset hits -> audio/beats.json.

    python tools/beats.py audio/track.mp3 [audio/beats.json]

Needs: pip install numpy librosa soundfile
State changes go on beats, big moments on downbeats, SFX on hits.
"""
import json
import sys

try:
    import numpy as np
    import librosa
except ImportError:
    sys.exit("beats.py needs librosa: pip install numpy librosa soundfile")

if len(sys.argv) < 2:
    sys.exit(__doc__)
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "audio/beats.json"

y, sr = librosa.load(src, sr=None, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
beats = librosa.frames_to_time(frames, sr=sr).round(3).tolist()

onset = librosa.onset.onset_strength(y=y, sr=sr)
peaks = librosa.util.peak_pick(onset, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)

# downbeats: pick the beat phase (0-3) whose beats carry the most onset energy
strength = [float(onset[min(f, len(onset) - 1)]) for f in frames]
phase = max(range(4), key=lambda p: sum(strength[p::4])) if beats else 0

grid = {
    "bpm": float(np.atleast_1d(tempo)[0]),
    "source": src,
    "beats": beats,
    "downbeats": beats[phase::4],
    "hits": librosa.frames_to_time(peaks, sr=sr).round(3).tolist(),
    "dur": round(len(y) / sr, 3),
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(grid, f, indent=1)
print(f"{out}: {grid['bpm']:.1f} BPM, {len(beats)} beats, {len(grid['downbeats'])} downbeats, {len(grid['hits'])} hits, {grid['dur']}s")
