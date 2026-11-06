"""Edit the Wikimedia Commons clips used on the site (ffmpeg required).

Every clip is CC BY-SA 4.0. CC BY-SA asks us to credit the author, link the
licence and say what we changed, and to share our edits under the same licence.
This script *is* the record of those changes: each clip is trimmed, given a
gentle Mediterranean colour grade (warmer highlights, cooler shadows, a little
more contrast and saturation), turned into a seamless loop with a short
cross-fade, stripped of audio and re-encoded for the web (H.264 MP4 + a poster
frame). The reel is a montage of the edited clips.

Credits shown on the site come from travago-tour-app/src/data/videos.json.

Usage:
    python scripts/edit_videos.py SOURCE_DIR
SOURCE_DIR holds the downloaded originals named by key (blue-eye.webm, ...).
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "travago-tour-app", "public", "media", "video")
CREDITS = os.path.join(ROOT, "travago-tour-app", "src", "data", "videos.json")

# Mediterranean grade, shared by every clip.
GRADE = ("eq=contrast=1.06:saturation=1.14:gamma=0.98,"
         "colorbalance=rs=-0.03:gs=0.0:bs=0.04:rh=0.04:gh=0.01:bh=-0.03,"
         "unsharp=5:5:0.35:5:5:0.0,vignette=angle=PI/8")

CHANGES = "Trimmed, colour graded, looped with a cross-fade, audio removed, re-encoded."
LICENSE = {"name": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/"}

# key: source file, [start, end] seconds, metadata for the credits.
CLIPS = {
    "blue-eye": {
        "src": "blue-eye", "short": "Blue Eye", "cut": [8.7, 13.0], "place": "blue-eye",
        "title": "Syri i Kaltër — the Blue Eye", "caption": "The spring's water runs glass-clear into the Bistricë.",
        "author": "Ekki3", "page": "https://commons.wikimedia.org/wiki/File:20260410_Blue_Eye.webm",
    },
    "blue-eye-spring": {
        "src": "blue-eye", "short": "The spring", "cut": [0.2, 6.3], "place": "blue-eye",
        "title": "Inside the Blue Eye", "caption": "Looking straight down into the 50 m deep karst spring.",
        "author": "Ekki3", "page": "https://commons.wikimedia.org/wiki/File:20260410_Blue_Eye.webm",
    },
    "berat-castle": {
        "src": "berat-01", "short": "Berat Castle", "cut": [18.0, 30.0], "place": "berat",
        "title": "Berat Castle from the air", "caption": "Kalaja walls wrapping the old quarter — still lived in today.",
        "author": "Arianit", "page": "https://commons.wikimedia.org/wiki/File:Berat_01.webm",
    },
    "berat-town": {
        "src": "berat-01", "short": "Berat valley", "cut": [49.0, 60.0], "place": "berat",
        "title": "Berat, the town of a thousand windows", "caption": "The Osum valley opening up below the citadel.",
        "author": "Arianit", "page": "https://commons.wikimedia.org/wiki/File:Berat_01.webm",
    },
    "berat-roofs": {
        "src": "berat-50", "short": "Kalaja roofs", "cut": [1.0, 10.0], "place": "berat",
        "title": "Rooftops of Kalaja", "caption": "Stone slab roofs inside the citadel walls.",
        "author": "Arianit", "page": "https://commons.wikimedia.org/wiki/File:Berat_50.webm",
    },
    "tirana": {
        "src": "tirana", "short": "Tirana", "cut": [0.0, 10.0], "place": "tirana",
        "title": "Skanderbeg Square, Tirana", "caption": "The capital's square and the Palace of Culture.",
        "author": "Leeturtle", "page": "https://commons.wikimedia.org/wiki/File:Tirana_Skenderbeg_Square_birds_eye_view.webm",
    },
    "lekures": {
        "src": "lekures", "short": "Lëkurës", "cut": [0.0, 8.2], "place": "lekures-castle", "vertical": True,
        "title": "Lëkurës Castle above Sarandë", "caption": "The hilltop fortress with the bay at its feet.",
        "author": "A.jobs02", "page": "https://commons.wikimedia.org/wiki/File:Kalaja_Lekursit_Sarand%C3%AB.ogv",
    },
    "gjirokaster": {
        "src": "gjirokaster", "short": "Gjirokastër", "cut": [0.0, 14.5], "place": "gjirokaster", "vertical": True,
        "title": "Gjirokastër Castle", "caption": "The stone city's fortress, a UNESCO World Heritage site.",
        "author": "A.jobs02", "page": "https://commons.wikimedia.org/wiki/File:Kalaja_e_Gjirokastres.ogg",
    },
}

# Montage order for the reel (only clips that exist are used).
REEL = ["blue-eye", "lekures", "berat-castle", "gjirokaster", "tirana", "berat-town"]
XF = 0.8  # cross-fade seconds


def run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def find_source(src_dir, key):
    for ext in (".webm", ".ogv", ".ogg", ".mp4"):
        p = os.path.join(src_dir, key + ext)
        if os.path.exists(p) and os.path.getsize(p) > 50_000:
            return p
    return None


def frame_filter(vertical):
    """Landscape 854x480. Vertical sources sit on a blurred, darkened copy of themselves."""
    if not vertical:
        return f"scale=854:480:force_original_aspect_ratio=increase:flags=lanczos,crop=854:480,{GRADE},fps=30"
    return (f"split[bg][fg];"
            f"[bg]scale=854:480:force_original_aspect_ratio=increase,crop=854:480,boxblur=24:2,eq=brightness=-0.12[bgb];"
            f"[fg]scale=-2:480:flags=lanczos[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:0,{GRADE},fps=30")


def edit_clip(key, clip, src):
    a, b = clip["cut"]
    length = b - a
    tmp = os.path.join(OUT, f".{key}.graded.mp4")
    # 1) trim + grade into an intermediate (high quality).
    run(["-ss", str(a), "-t", str(length), "-i", src, "-an",
         "-filter_complex", frame_filter(clip.get("vertical")) + ",format=yuv420p",
         "-c:v", "libx264", "-crf", "14", "-preset", "medium", tmp])
    # 2) seamless loop: the tail cross-fades into the head.
    loop = (f"[0:v]split[m][h];[m]trim=start={XF},setpts=PTS-STARTPTS[main];"
            f"[h]trim=0:{XF},setpts=PTS-STARTPTS[head];"
            f"[main][head]xfade=transition=fade:duration={XF}:offset={length - 2 * XF:.3f},format=yuv420p[v]")
    base = os.path.join(OUT, key)
    run(["-i", tmp, "-filter_complex", loop, "-map", "[v]", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
         "-profile:v", "high", "-movflags", "+faststart", "-an", base + ".mp4"])
    run(["-ss", "0.6", "-i", base + ".mp4", "-frames:v", "1", "-q:v", "4", base + ".jpg"])
    run(["-i", base + ".jpg", "-vf", "scale=427:-2", "-q:v", "5", base + ".thumb.jpg"])
    os.remove(tmp)
    return length - XF


def edit_reel(keys):
    """Returns the chapter list [{key, start}] of the montage."""
    inputs, chain, durs = [], [], []
    for k in keys:
        inputs += ["-i", os.path.join(OUT, k + ".mp4")]
        durs.append(float(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
             os.path.join(OUT, k + ".mp4")]).decode().strip()))
    # Each shot ≤ 5 s, chained with smooth cross-fades.
    shot = [min(d, 5.0) for d in durs]
    parts = [f"[{i}:v]trim=0:{s:.3f},setpts=PTS-STARTPTS[s{i}]" for i, s in enumerate(shot)]
    prev, offset = "s0", 0.0
    for i in range(1, len(keys)):
        offset += shot[i - 1] - XF
        out = f"x{i}"
        chain.append(f"[{prev}][s{i}]xfade=transition=smoothleft:duration={XF}:offset={offset:.3f}[{out}]")
        prev = out
    graph = ";".join(parts + chain) + f";[{prev}]format=yuv420p[v]"
    starts, t = [], 0.0
    for i, k in enumerate(keys):
        starts.append({"key": k, "start": round(t if i == 0 else t + XF / 2, 2)})
        t += shot[i] - XF
    base = os.path.join(OUT, "reel")
    run([*inputs, "-filter_complex", graph, "-map", "[v]", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
         "-movflags", "+faststart", "-an", base + ".mp4"])
    run(["-ss", "1.0", "-i", base + ".mp4", "-frames:v", "1", "-q:v", "4", base + ".jpg"])
    return starts


def main():
    if len(sys.argv) != 2 or not shutil.which("ffmpeg"):
        sys.exit(__doc__)
    src_dir = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    made = []
    for key, clip in CLIPS.items():
        src = find_source(src_dir, clip["src"])
        if not src:
            print(f"skip {key}: no source")
            continue
        seconds = edit_clip(key, clip, src)
        made.append({
            "key": key, "title": clip["title"], "short": clip["short"], "caption": clip["caption"], "place": clip["place"],
            "seconds": round(seconds, 1), "author": clip["author"],
            "author_url": "https://commons.wikimedia.org/wiki/User:" + clip["author"],
            "source": clip["page"], "license": LICENSE, "changes": CHANGES,
            "src": {"mp4": f"/media/video/{key}.mp4",
                    "poster": f"/media/video/{key}.jpg", "thumb": f"/media/video/{key}.thumb.jpg"},
        })
        print(f"edited {key}")
    reel_keys = [k for k in REEL if any(m["key"] == k for m in made)]
    reel = None
    if len(reel_keys) >= 2:
        chapters = edit_reel(reel_keys)
        reel = {"chapters": chapters, "src": {"mp4": "/media/video/reel.mp4", "poster": "/media/video/reel.jpg"},
                "clips": reel_keys, "changes": "Montage of the edited clips above, joined with cross-fades.",
                "license": LICENSE}
        print("edited reel")
    with open(CREDITS, "w", encoding="utf-8") as f:
        json.dump({"clips": made, "reel": reel}, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main()
