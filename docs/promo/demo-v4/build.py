# Film demo v4 (STORY.md, CARA.md): menyusun index.html dari film.css + film.js + potongan DOM asli Nadi (dari demo-v3/assets/app,
# ditangkap dari usaha contoh dengan CSS aplikasi) + font tertanam base64. Kontrak skill motion-graphics: window.VIDEO + seek(t) murni.
# Jalankan dari folder ini: python -I build.py, lalu node render.mjs index.html cek.png --stills ... / draf.mp4 30 1 8
import base64
import json
import os
import re
import shutil

AKAR = os.path.dirname(os.path.abspath(__file__))
V3 = os.path.join(AKAR, "..", "demo-v3")
U = json.load(open(os.path.join(AKAR, "..", "film-langsung", "ukur.json"), encoding="utf8"))
U.update(json.load(open(os.path.join(V3, "ukur.json"), encoding="utf8")))

# Aset: gambar berkas, media font aplikasi, footage CCTV dan jejak pelacakan (V-04/V-12).
for d in ["berkas", os.path.join("app", "media")]:
    shutil.copytree(os.path.join(V3, "assets", d), os.path.join(AKAR, "assets", d), dirs_exist_ok=True)
css_app = open(os.path.join(V3, "assets", "app", "app.css"), encoding="utf8").read()
# Ukuran tangkapan Hari ini per lebar layar (tidak tercatat di ukur.json).
U.update({"hari-1440": {"lebar": 1440, "tinggi": 900}, "hari-768": {"lebar": 768, "tinggi": 1024}, "hari-390": {"lebar": 390, "tinggi": 844}})
# Bingkai CCTV asli (Pexels 37706044, V-04) sebagai urutan JPG 30 fps: kontrak skill melarang memutar video, jadi gambar dipilih per waktu.
if not os.path.exists(os.path.join(AKAR, "assets", "mata", "f285.jpg")):
    os.makedirs(os.path.join(AKAR, "assets", "mata"), exist_ok=True)
    import subprocess
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(V3, "assets", "mata", "pasar.mp4"), "-vf", "fps=30,scale=1440:810", "-q:v", "4", os.path.join(AKAR, "assets", "mata", "f%03d.jpg")], check=True)


def _tanam(m):
    """@font-face aplikasi: berkas font ditanam base64 (skill: render tidak boleh diam-diam memakai font cadangan); subset yang
    berkasnya tidak ada (bukan latin) dibuang."""
    blok = m.group(0)
    u = re.search(r"url\(media/([^)]+)\)", blok)
    p = os.path.join(V3, "assets", "app", "media", u.group(1)) if u else ""
    if not u or not os.path.exists(p):
        return ""
    return blok.replace(u.group(0), "url(data:font/woff2;base64," + base64.b64encode(open(p, "rb").read()).decode() + ")")


css_app = re.sub(r"@font-face\{[^}]*\}", _tanam, css_app)

BAGIAN = ["film.js", "film-d.js", "film-f.js", "film-mata.js", "film-i.js", "film-akhir.js"]
FRAG = ["lempar-kosong", "lempar-membaca", "lempar-siap", "feed-rincian", "feed-tutup", "kartu-nota", "kartu-nota-dicap", "tinjau-draf",
        "invoice-publik", "gaji-draf", "alur", "tanya", "peta-panas", "mata-panel", "hari-1440", "hari-768", "hari-390", "sarapan"]


def frag(nama):
    p = os.path.join(V3, "assets", "app", f"{nama}.html")
    if not os.path.exists(p):
        return ""
    h = open(p, encoding="utf8").read()
    h = re.sub(r"\sid=\"[^\"]*\"", "", h)
    h = re.sub(r"<body([^>]*)>", r"<div\1>", h).replace("</body>", "</div>")
    u = U.get(nama, {})
    # Potongan dibungkus selebar tangkapannya dan dipotong setinggi tangkapannya: tidak ada isi yang melewati kotaknya (cacat papan Mata v3).
    return f'<template id="f-{nama}"><div class="app" style="width:{u.get("lebar", 1440)}px;height:{u.get("tinggi", 900)}px;overflow:hidden">{h}</div></template>'


def b64(p):
    return base64.b64encode(open(p, "rb").read()).decode()


def main():
    font = b64(os.path.join(V3, "assets", "fonts", "jakarta.woff2"))
    css = open(os.path.join(AKAR, "film.css"), encoding="utf8").read()
    # Urutan bagian skrip: inti + babak A-C, babak berikutnya, lalu seek/pratinjau di akhir.
    js = "\n".join(open(os.path.join(AKAR, n), encoding="utf8").read() for n in BAGIAN if os.path.exists(os.path.join(AKAR, n)))
    tmpl = "\n".join(frag(n) for n in FRAG)
    html = f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Nadi, film demo v4</title>
<style>
@font-face {{ font-family: "Jakarta"; src: url(data:font/woff2;base64,{font}) format("woff2"); font-weight: 200 800; font-style: normal; }}
</style>
<style>{css_app}</style>
<style>{css}</style>
</head><body>
<div id="panggung"></div>
<div id="kendali"><button id="putar">Putar</button><input id="geser" type="range" min="0" max="1000" value="0"><span id="waktu">0,00</span></div>
{tmpl}
<script>const UKUR = {json.dumps(U)};
const MATA = {open(os.path.join(V3, "assets", "mata", "jejak.json"), encoding="utf8").read()};</script>
<script>{js}</script>
</body></html>"""
    open(os.path.join(AKAR, "index.html"), "w", encoding="utf8", newline="\n").write(html)
    print("index.html", len(html) // 1024, "KB")


if __name__ == "__main__":
    main()
