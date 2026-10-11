"""Generate the voiceover from docs/vo_script.md, one clip per line, so timings are exact.

    python tools/tts.py                                   auto provider, default voice
    python tools/tts.py --audition                        first line in 3 voices -> audio/audition/
    python tools/tts.py --provider edge --voice en-US-AvaNeural --rate +8%
    python tools/tts.py --provider elevenlabs --voice <voice_id>
    python tools/tts.py --provider voicestudio --voice <profile_id> --style "warm, confident"
    python tools/tts.py --only 3                          regenerate just line 3, then reassemble
    python tools/tts.py --list-voices                     list voices for the chosen provider

Providers, picked in this order by --provider auto:
  voicestudio free, local, natural, can clone your voice. Used when the VoiceStudio app is running
              (https://github.com/debpalash/VoiceStudio). VOICESTUDIO_URL overrides http://127.0.0.1:3900.
  elevenlabs  hosted, top quality. Needs ELEVENLABS_API_KEY in .env (never paste the key into chat).
  edge        free Microsoft neural voices, no key, needs internet: pip install edge-tts
  sapi        offline Windows voices (built in)        say  offline macOS voices (built in)
Output: audio/vo_lines/line_XX.*, then audio/vo.wav + audio/vo.json + audio/vo.srt via vo_assemble.
"""
import argparse
import asyncio
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request

try:  # use the OS certificate store (fixes SSL errors with some Windows Python installs)
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vo_assemble import assemble, find_clips, read_script, summary  # noqa: E402

DEFAULT_VOICE = {"voicestudio": "default", "elevenlabs": "JBFqnCBsd6RMkjVDRZzb", "edge": "en-US-AndrewNeural", "sapi": "", "say": "Samantha"}
AUDITION = {
    "voicestudio": [],   # filled from the server's voice profiles at runtime
    "elevenlabs": ["JBFqnCBsd6RMkjVDRZzb", "TX3LPaxmHKxFdv7VOQHJ", "EXAVITQu4vr4xnSDxMaL"],   # George, Liam, Sarah,
    "edge": ["en-US-AndrewNeural", "en-US-AvaNeural", "en-GB-RyanNeural"],
    "sapi": [], "say": ["Samantha", "Daniel", "Karen"],
}


def load_env(path=".env"):
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def pct(rate):
    """'+8%' -> 8.0, '-5%' -> -5.0, '' -> 0.0"""
    return float(rate.strip().rstrip('%')) if rate else 0.0


def have_edge():
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False


OPTS = {"style": None, "seed": 42}   # set from CLI flags in main()


def vs_url(path):
    return os.environ.get("VOICESTUDIO_URL", "http://127.0.0.1:3900").rstrip("/") + path


def vs_request(path, body=None, timeout=5):
    headers = {"content-type": "application/json"}
    if os.environ.get("VOICESTUDIO_API_KEY"):          # only needed for a remote VoiceStudio server
        headers["authorization"] = "Bearer " + os.environ["VOICESTUDIO_API_KEY"]
    req = urllib.request.Request(vs_url(path), data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET", headers=headers)
    return urllib.request.urlopen(req, timeout=timeout)


def voicestudio_running():
    try:
        with vs_request("/v1/models", timeout=1.5) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def voicestudio_profiles():
    with vs_request("/v1/audio/voices") as r:
        return [v for v in json.load(r).get("voices", []) if v.get("type") == "profile"]


def pick_provider(name):
    if name != "auto":
        return name
    if voicestudio_running():
        return "voicestudio"
    if os.environ.get("ELEVENLABS_API_KEY"):
        return "elevenlabs"
    if have_edge():
        return "edge"
    return "sapi" if platform.system() == "Windows" else "say"


# ---------------- providers: each writes one file and returns its path ----------------
def tts_voicestudio(text, voice, rate, out_base):
    """OpenAI-compatible /v1/audio/speech on the local VoiceStudio app. A fixed seed keeps the
    voice consistent from line to line; a profile id uses a cloned or designed voice."""
    body = {"model": os.environ.get("VOICESTUDIO_MODEL", "omnivoice"), "input": text, "voice": voice or "default",
            "response_format": "wav", "speed": max(0.5, min(2.0, 1 + pct(rate) / 100)), "seed": OPTS["seed"]}
    if OPTS["style"]:
        body["instructions"] = OPTS["style"]
    try:
        # first request can take minutes while the model downloads/loads
        with vs_request("/v1/audio/speech", body, timeout=1500) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")
        try:
            msg = json.loads(msg)["error"]["message"]
        except Exception:  # noqa: BLE001
            pass
        sys.exit(f"VoiceStudio error {e.code}: {msg[:400]}")
    except urllib.error.URLError as e:
        sys.exit(f"VoiceStudio isn't reachable at {vs_url('')} ({e.reason}). Start the VoiceStudio app first.")
    path = out_base + ".wav"
    open(path, "wb").write(data)
    return path


def tts_elevenlabs(text, voice, rate, out_base):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set in .env")
    model = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    body = {"text": text, "model_id": model, "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2}}
    if rate:
        body["voice_settings"]["speed"] = max(0.7, min(1.2, 1 + pct(rate) / 100))
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": key, "content-type": "application/json", "accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs error {e.code}: {e.read().decode(errors='replace')[:300]}")
    path = out_base + ".mp3"
    open(path, "wb").write(data)
    return path


def tts_edge(text, voice, rate, out_base):
    import edge_tts
    path = out_base + ".mp3"
    kw = {"rate": rate} if rate else {}
    asyncio.run(edge_tts.Communicate(text, voice, **kw).save(path))
    return path


def tts_sapi(text, voice, rate, out_base):
    path = os.path.abspath(out_base + ".wav")
    txt = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    txt.write(text); txt.close()
    r = round(pct(rate) / 10)
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        + (f"$s.SelectVoice('{voice}');" if voice else "")
        + f"$s.Rate = {max(-10, min(10, r))};"
        f"$s.SetOutputToWaveFile('{path}');"
        f"$s.Speak([IO.File]::ReadAllText('{txt.name}'));$s.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    os.unlink(txt.name)
    return path


def tts_say(text, voice, rate, out_base):
    path = out_base + ".aiff"
    cmd = ["say", "-o", path] + (["-v", voice] if voice else [])
    if rate:
        cmd += ["-r", str(int(175 * (1 + pct(rate) / 100)))]
    subprocess.run(cmd + [text], check=True)
    return path


PROVIDERS = {"voicestudio": tts_voicestudio, "elevenlabs": tts_elevenlabs, "edge": tts_edge, "sapi": tts_sapi, "say": tts_say}


def list_voices(provider):
    if provider == "voicestudio":
        profiles = voicestudio_profiles()
        print("default - the engine's built-in voice")
        for v in profiles:
            print(v["voice_id"], "-", v["name"], "-", v.get("language") or "")
        if not profiles:
            print("(no voice profiles yet: clone or design one in the VoiceStudio app, then use its id)")
    elif provider == "edge":
        import edge_tts
        for v in sorted(asyncio.run(edge_tts.list_voices()), key=lambda v: v["ShortName"]):
            if v["Locale"].startswith("en-"):
                print(v["ShortName"], "-", v["Gender"])
    elif provider == "sapi":
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Add-Type -AssemblyName System.Speech;(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices()|%{$_.VoiceInfo.Name}"])
    elif provider == "say":
        subprocess.run(["say", "-v", "?"])
    elif provider == "elevenlabs":
        req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": os.environ.get("ELEVENLABS_API_KEY", "")})
        for v in json.load(urllib.request.urlopen(req)).get("voices", []):
            print(v["voice_id"], "-", v["name"], "-", v.get("labels", {}).get("accent", ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--script", default="docs/vo_script.md")
    ap.add_argument("--provider", default="auto", choices=["auto", *PROVIDERS])
    ap.add_argument("--voice", default=None)
    ap.add_argument("--rate", default="", help="e.g. +8%% or -5%%")
    ap.add_argument("--gap", type=float, default=0.35)
    ap.add_argument("--lead", type=float, default=0.4)
    ap.add_argument("--out-dir", default="audio/vo_lines")
    ap.add_argument("--only", type=int, help="regenerate one line number, keep the others")
    ap.add_argument("--audition", action="store_true")
    ap.add_argument("--list-voices", action="store_true")
    ap.add_argument("--style", help="delivery style, e.g. 'warm, energetic' (voicestudio)")
    ap.add_argument("--seed", type=int, default=42, help="fixed seed keeps a generated voice consistent (voicestudio)")
    a = ap.parse_args()

    load_env()
    OPTS.update(style=a.style, seed=a.seed)
    provider = pick_provider(a.provider)
    if provider == "edge" and not have_edge():
        sys.exit("edge-tts is not installed: pip install edge-tts")
    if a.list_voices:
        return list_voices(provider)
    voice = a.voice or DEFAULT_VOICE[provider]
    lines = read_script(a.script)
    if not lines:
        sys.exit(f"no narration lines in {a.script}")
    fn = PROVIDERS[provider]

    # edge-tts is an unofficial free service and sometimes refuses connections (403 / SSL).
    # In auto mode, check it once and fall back to the offline system voice instead of failing.
    if a.provider == "auto" and provider == "edge":
        try:
            p = fn("Test.", voice, "", os.path.join(tempfile.gettempdir(), "tts_probe"))
            os.remove(p)
        except Exception as e:  # noqa: BLE001
            provider = "sapi" if platform.system() == "Windows" else "say"
            print(f"edge-tts unavailable ({type(e).__name__}: {str(e)[:90]}); falling back to offline '{provider}' voice.\n"
                  "For natural voices: retry later, `pip install -U edge-tts truststore`, or add ELEVENLABS_API_KEY to .env.",
                  file=sys.stderr)
            fn, voice = PROVIDERS[provider], DEFAULT_VOICE[provider]   # an edge voice name won't exist offline

    if a.audition:
        os.makedirs("audio/audition", exist_ok=True)
        voices = AUDITION[provider] or [""]
        if provider == "voicestudio":
            voices = ["default"] + [v["voice_id"] for v in voicestudio_profiles()][:3]
        for v in voices:
            p = fn(lines[0], v, a.rate, os.path.join("audio/audition", (v or "default").replace("/", "_")))
            print("audition:", p)
        print(f"provider: {provider}. Listen, then run again with --voice <name>.")
        return

    os.makedirs(a.out_dir, exist_ok=True)
    todo = [a.only] if a.only else range(1, len(lines) + 1)
    for n in todo:
        for old in os.listdir(a.out_dir):
            if old.startswith(f"line_{n:02d}."):
                os.remove(os.path.join(a.out_dir, old))
        p = fn(lines[n - 1], voice, a.rate, os.path.join(a.out_dir, f"line_{n:02d}"))
        print(f"line {n}/{len(lines)} -> {p}")
    if not a.only:   # drop stale clips from a longer previous script
        for f in find_clips(a.out_dir):
            if int(os.path.basename(f)[5:7]) > len(lines):
                os.remove(f)
    clips = find_clips(a.out_dir)
    print(f"provider: {provider}, voice: {voice or 'system default'}")
    summary(*assemble(clips, lines, gap=a.gap, lead=a.lead))


if __name__ == "__main__":
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required on PATH")
    main()
