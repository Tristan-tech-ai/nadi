# V-24: potongan rekaman per fitur untuk halaman publik (apps/web/public/video, L-01) dari film v4, plus film utuh versi web.
# Jalankan dari folder ini setelah docs/promo/nadi-demo.mp4 v4 jadi: python -I potong.py
import os
import subprocess

AKAR = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.join(AKAR, "..", "nadi-demo.mp4")
O = os.path.join(AKAR, "..", "..", "..", "apps", "web", "public", "video")
# nama: (mulai, lama, detik poster) dari beat sheet STORY.md
KLIP = {"lempar": (24.4, 13.6, 30.2), "feed": (38.6, 10.4, 43.8), "tagihan": (93.2, 10.6, 99.6), "gaji": (106.4, 7.6, 109.4), "mata": (139.0, 24.0, 146.0)}


def ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)


for nama, (a, n, p) in KLIP.items():
    ff("-ss", str(a), "-t", str(n), "-i", FILM, "-an", "-vf", "scale=960:540:flags=lanczos,fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(O, f"{nama}.mp4"))
    ff("-ss", str(p), "-i", FILM, "-frames:v", "1", "-vf", "scale=960:540", "-q:v", "4", os.path.join(O, f"{nama}.jpg"))
ff("-i", FILM, "-vf", "scale=1280:720:flags=lanczos,fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
   "-movflags", "+faststart", os.path.join(O, "nadi-demo.mp4"))
ff("-ss", "19.6", "-i", FILM, "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "4", os.path.join(O, "nadi-demo.jpg"))
for f in sorted(os.listdir(O)):
    print(f, os.path.getsize(os.path.join(O, f)) // 1024, "KB")
