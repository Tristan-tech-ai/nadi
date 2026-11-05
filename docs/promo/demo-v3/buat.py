# Video demo Nadi v3 (CATATAN.md). Membangun index.html HyperFrames dari DOM asli aplikasi (docs/promo/film-langsung/assets/app)
# dengan gaya docs/promo/riset-video/GERAK.md: potongan keras ke bidikan dekat, tarik mundur ease-out berawalan lembut, lapisan
# diposisikan dari ukur.json (elemen terukur), satu perubahan isi selalu terjadi saat tahan. Audio menyusul setelah gambar jadi.
# Jalankan dari folder ini: python -I buat.py  lalu  npx --yes hyperframes@0.9.8 check / render
import json
import os
import re
import shutil

AKAR = os.path.dirname(os.path.abspath(__file__))
SUMBER = os.path.join(AKAR, "..", "film-langsung", "assets")
FPS = 30
W, H = 1920, 1080
U = json.load(open(os.path.join(AKAR, "..", "film-langsung", "ukur.json"), encoding="utf8"))
U.update(json.load(open(os.path.join(AKAR, "ukur.json"), encoding="utf8")))  # ukuran v3 menimpa yang lama
for d in ["app", "fonts", "berkas"]:
    shutil.copytree(os.path.join(SUMBER, d), os.path.join(AKAR, "assets", d), dirs_exist_ok=True)

# Kurva tarik mundur rujukan 8: ease-out dengan awalan lembut (puncak kecepatan ~30%), lihat UJI-GERAK.md.
EASE_JS = """
function bezier(x1, y1, x2, y2) {
  return function (x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; const bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; if (bx < x) lo = t; else hi = t; }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  };
}
const MUNDUR = bezier(0.35, 0, 0.1, 1);
const TEKAN = bezier(0.45, 0, 0.55, 1);
"""


def frag(nama):
    h = open(os.path.join(SUMBER, "app", f"{nama}.html"), encoding="utf8").read()
    h = re.sub(r'\sid="[^"]*"', "", h)
    h = re.sub(r"<body([^>]*)>", r"<div\1>", h).replace("</body>", "</div>")
    return f'<div class="app" style="width:{U[nama]["lebar"]}px">{h}</div>'


class Film:
    def __init__(self):
        self.klip, self.tw = [], []

    def adegan(self, sid, t0, t1, isi, latar="#F6F2EA", z=1):
        self.klip.append(f'<div id="{sid}" class="clip" data-start="{t0:.3f}" data-duration="{t1 - t0:.3f}" data-track-index="1" '
                         f'style="z-index:{z}; background:{latar}">{isi}</div>')

    def add(self, s):
        self.tw.append(s)

    def ketik(self, sid, teks, t0, cps=26, gaya=""):
        """Teks diketik per huruf (span per huruf diberi opacity 1 pada waktunya) dengan kursor teks; kembalikan (html, t_selesai)."""
        span = "".join(f'<span class="h" id="{sid}-{i}" style="display:none">{"&nbsp;" if c == " " else c}</span>' for i, c in enumerate(teks))
        for i in range(len(teks)):
            self.add(f'tl.set("#{sid}-{i}", {{display: "inline"}}, {t0 + i / cps:.3f});')
        return f'<span id="{sid}" style="{gaya}">{span}<span class="caret" id="{sid}-c"></span></span>', t0 + len(teks) / cps


def kamera(fx, fy, s, tx=W / 2, ty=H / 2):
    return {"x": round(tx - fx * s, 1), "y": round(ty - fy * s, 1), "scale": round(s, 4)}


def bangun():
    f = Film()
    # ---------- Babak 0 kait (0 - 6,5 dtk): nota dipindai, tarik mundur, nota menjadi kartu usulan asli ----------
    NOTA = [("UD Sumber Rejeki", "judul"), ("Jl. Gatot Subroto Barat No. 18, Denpasar", "kecil"), ("-", "garis"),
            ("No: NT-4671", ""), ("Tgl: 13/10/2026", ""), ("-", "garis"),
            ("Teh celup 25", ""), ("9 x 9.500|85.500", ""), ("Tepung terigu 1 kg", ""), ("6 x 13.500|81.000", ""),
            ("Bawang merah 1 kg", ""), ("5 x 42.000|210.000", ""), ("=", "garis"), ("TOTAL|376.500", "total")]
    NX, NY, NW, LH = 660, 150, 600, 52
    baris = []
    for i, (t, k) in enumerate(NOTA):
        y = 40 + i * LH  # koordinat di dalam nota
        if k == "garis":
            baris.append(f'<div class="nb garis" style="top:{y + LH / 2 - 1}px"></div>')
            continue
        kiri, _, kanan = t.partition("|")
        baris.append(f'<div class="nb {k}" id="n{i}" style="top:{y}px"><span>{kiri}</span><span>{kanan}</span></div>')
    i_total = len(NOTA) - 1
    ytot = NY + 40 + i_total * LH
    nota = (f'<div id="nota" class="nota" style="left:{NX}px; top:{NY}px; width:{NW}px; height:{40 + len(NOTA) * LH + 40}px">'
            f'<div class="pita" id="pita" style="top:40px"></div>{"".join(baris)}'
            f'<div class="kotak" id="ktot" style="left:20px; top:{ytot - NY - 2}px; width:{NW - 40}px; height:{LH + 4}px"></div></div>')
    kn = U["kartu-nota"]
    KX, KY = 640, 451  # kartu usulan asli 640 lebar di tengah bingkai
    kartu = (f'<div id="kartu" style="position:absolute; left:{KX}px; top:{KY}px; opacity:0">{frag("kartu-nota")}'
             f'<div id="stab" class="stab" style="left:{kn["judul_rp"]["x"] - 3}px; top:{kn["judul_rp"]["y"] + 2}px; width:{kn["judul_rp"]["w"] + 6}px; height:{kn["judul_rp"]["h"]}px"></div></div>')
    f.adegan("b0", 0, 6.5, f'<div id="b0k" class="kam">{nota}{kartu}</div>')
    # Bidikan dekat angka TOTAL (2,4x), pita pindai turun baris demi baris, kotak tiap baris terbaca, kotak tinta di TOTAL.
    fx, fy = NX + NW - 120, ytot + LH / 2
    f.add(f'tl.set("#b0k", {json.dumps(kamera(fx, fy, 2.4))}, 0);')
    f.add(f'tl.fromTo("#pita", {{y: 0}}, {{y: {i_total * LH}, duration: 1.3, ease: "none"}}, 0.1);')
    f.add(f'tl.fromTo("#ktot", {{opacity: 0, scale: 1.04}}, {{opacity: 1, scale: 1, duration: 0.2, ease: "power2.out"}}, 1.35);')
    f.add('tl.to("#pita", {opacity: 0, duration: 0.2}, 1.45);')
    T_M = 1.7
    f.add(f'tl.to("#b0k", {{x: 0, y: 0, scale: 1, duration: {36 / FPS:.3f}, ease: MUNDUR}}, {T_M});')
    # Nota mengecil dan memudar ke tempat kartu; kartu asli muncul di tempatnya (benda menjadi benda berikutnya).
    T_K = 3.2
    f.add(f'tl.to("#nota", {{scale: 0.3, x: {KX + 320 - (NX + NW / 2)}, y: {KY + 89 - (NY + 404)}, opacity: 0, duration: 0.3, ease: "power2.in"}}, {T_K});')
    f.add(f'tl.fromTo("#kartu", {{opacity: 0, scale: 0.94}}, {{opacity: 1, scale: 1, duration: 0.3, ease: "power2.out"}}, {T_K + 0.24});')
    # Kamera mendekat ke kartu sampai kartu mengisi ~70% lebar bingkai (UJI-GERAK masalah 3).
    f.add(f'tl.to("#b0k", {json.dumps(kamera(KX + 320, KY + 89, 2.0))[:-1]}, duration: 0.45, ease: TEKAN}}, {T_K + 0.2});')
    # Dorong penekanan 1,3x ke angka di judul + stabilo menyapu angka (rujukan 8 pada 30,0 dtk: 14 bingkai, ease-in-out).
    rx, ry = KX + kn["judul_rp"]["x"] + kn["judul_rp"]["w"] / 2, KY + kn["judul_rp"]["y"] + 10
    f.add(f'tl.to("#b0k", {{**{json.dumps(kamera(rx, ry, 2.6, W / 2, H / 2 - 40))}, duration: {14 / FPS:.3f}, ease: TEKAN}}, 4.3);'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add('tl.fromTo("#stab", {scaleX: 0}, {scaleX: 1, duration: 0.4, ease: "power2.out"}, 4.45);')

    # ---------- Babak 1 masalah (6,5 - 16 dtk): kalimat diketik lalu disunting, berkas berserakan samar ----------
    ser = [("nota.png", 150, 140, 330, -7), ("absen.png", 1420, 120, 360, 5), ("slip.png", 1380, 640, 340, -4), ("invoice.png", 170, 610, 360, 6)]
    berkas = "".join(f'<div class="bks" id="bk{i}" style="left:{x}px; top:{y}px; width:{w}px; transform:rotate({r}deg)"><img src="assets/berkas/{n}" alt=""></div>'
                     for i, (n, x, y, w, r) in enumerate(ser))
    T1 = 6.5
    k1, s1 = f.ketik("k1", "Masih mengetik ulang nota", T1 + 0.5)
    k1b, s1b = f.ketik("k1b", " satu per satu?", s1)
    k1c, s1c = f.ketik("k1c", " setiap malam?", s1b + 1.6)
    k2, s2 = f.ketik("k2", "Otomatis itu mahal. Yang murah, manual.", s1c + 1.1, cps=34)
    isi1 = (f'{berkas}<div class="kal" style="top:430px">{k1}{k1b}{k1c}</div>'
            f'<div class="kal dua" style="top:560px">{k2}</div>'
            '<div class="ph" style="left:1240px; top:880px">PLACEHOLDER: kartu fakta harga resmi pesaing (sumber + tanggal)</div>')
    f.adegan("b1", T1, 16.0, isi1, latar="#E4DED2", z=2)
    for i in range(len(ser)):
        f.add(f'tl.fromTo("#bk{i}", {{opacity: 0, y: 30}}, {{opacity: 0.38, y: 0, duration: 0.5, ease: "power2.out"}}, {T1 + 0.15 * i:.2f});')
    # "satu per satu?" disorot seperti teks yang dipilih, lalu dihapus mundur, diganti "setiap malam?" (rujukan 5, 4,2 dtk).
    f.add(f'tl.set("#k1b", {{backgroundColor: "rgba(233,168,37,0.55)"}}, {s1b + 0.9:.3f});')
    for i in range(len(" satu per satu?")):
        f.add(f'tl.set("#k1b-{len(" satu per satu?") - 1 - i}", {{display: "none"}}, {s1b + 1.15 + i * 0.025:.3f});')
    f.add(f'tl.set("#k1b", {{backgroundColor: "rgba(0,0,0,0)"}}, {s1b + 1.5:.3f});')
    f.add(f'tl.set("#k1c-c", {{opacity: 1}}, {s1b + 1.5:.3f});')
    # Saat tahan, berkas pelan-pelan menumpuk (satu perubahan isi selalu terjadi).
    for i in range(len(ser)):
        f.add(f'tl.to("#bk{i}", {{y: -14, duration: 6, ease: "none"}}, {T1 + 1:.2f});')

    # ---------- Babak 2 Nadi muncul + Lempar (16 - 26 dtk) ----------
    T2 = 16.0
    k3, s3 = f.ketik("k3", "Lempar berkasnya. Nadi yang merapikan.", T2 + 0.25, cps=30)
    lk, lm, ls_ = U["lempar-kosong"], U["lempar-membaca"], U["lempar-siap"]
    ar = lk["area"]
    # Area Lempar di bingkai: potongan 1440 lebar ditaruh sehingga area di tengah; kamera dekat 2,0x ke area.
    LX, LY = W / 2 - (ar["x"] + ar["w"] / 2), H / 2 - (ar["y"] + ar["h"] / 2)
    jatuh = [("nota.png", -420, -160, 230), ("absen.png", 2100, -200, 250), ("slip.png", -380, 1250, 230), ("invoice.png", 2150, 1200, 250)]
    bks2 = "".join(f'<div class="bks" id="j{i}" style="left:{x}px; top:{y}px; width:{w}px; opacity:1"><img src="assets/berkas/{n}" alt=""></div>'
                   for i, (n, x, y, w) in enumerate(jatuh))
    isi2 = (f'<div class="kal" id="b2t" style="top:480px">{k3}</div>'
            f'<div id="b2k" class="kam" style="opacity:0"><div style="position:absolute; left:{LX}px; top:{LY}px">{frag("lempar-kosong")}</div>'
            f'<div class="kotak" id="ar" style="left:{W / 2 - ar["w"] / 2 - 6}px; top:{H / 2 - ar["h"] / 2 - 6}px; width:{ar["w"] + 12}px; height:{ar["h"] + 12}px; border-color:#E9A825"></div>{bks2}</div>')
    f.adegan("b2", T2, T2 + 4.2, isi2, z=3)
    f.add(f'tl.set("#k3-c", {{opacity: 1}}, {T2 + 0.25});')
    T2b = s3 + 0.9
    f.add(f'tl.set("#b2t", {{opacity: 0}}, {T2b:.3f});')
    f.add(f'tl.set("#b2k", {{opacity: 1}}, {T2b:.3f});')
    f.add(f'tl.set("#b2k", {json.dumps(kamera(W / 2, H / 2, 2.2))}, {T2b:.3f});')
    for i, (n, x, y, w) in enumerate(jatuh):
        tx, ty = W / 2 - w / 2 + (i - 1.5) * 40, H / 2 - 60
        f.add(f'tl.to("#j{i}", {{x: {round(tx - x)}, y: {round(ty - y)}, rotation: {(-1) ** i * 6}, scale: 0.55, duration: 0.5, ease: "power2.in"}}, {T2b + 0.15 + i * 0.22:.3f});')
        f.add(f'tl.to("#j{i}", {{opacity: 0, scale: 0.35, duration: 0.18, ease: "power1.in"}}, {T2b + 0.65 + i * 0.22:.3f});')
    f.add(f'tl.fromTo("#ar", {{opacity: 0}}, {{opacity: 1, duration: 0.12, yoyo: true, repeat: 3}}, {T2b + 0.6:.3f});')
    # Membaca lalu Siap ditinjau: daftar Lempar asli 576 lebar, jendela mengisi ~70% tinggi bingkai (1,45x).
    T2c = T2 + 4.2
    MS = 1.45
    isi2b = (f'<div id="b2m" class="kam"><div class="jendela" style="left:{W / 2 - 576 * MS / 2}px; top:60px; width:{576 * MS}px; height:960px">'
             f'<div class="isi" id="m1" style="transform:scale({MS}); transform-origin:0 0; top:{-(lm["area"]["y"] - 20) * MS}px">{frag("lempar-membaca")}</div>'
             f'<div class="isi" id="m2" style="transform:scale({MS}); transform-origin:0 0; top:{-(lm["area"]["y"] - 20) * MS}px; opacity:0">{frag("lempar-siap")}</div></div></div>')
    f.adegan("b2b", T2c, 26.0, isi2b, z=3)
    f.add(f'tl.to("#m2", {{opacity: 1, duration: 0.25}}, {T2c + 2.0});')
    gulir = (ls_["daftar"]["y"] + ls_["daftar"]["h"] - 900) * MS
    f.add(f'tl.to("#m2", {{y: -{round(gulir * 0.55)}, duration: {27 / FPS:.3f}, ease: "power4.out"}}, {T2c + 3.2});')

    durasi = 26.0
    css = open(os.path.join(AKAR, "gaya.css"), encoding="utf8").read()
    html = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>Nadi demo</title>
<link rel="stylesheet" href="assets/app/app.css" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{css}</style>
</head>
<body>
<div id="root" data-composition-id="demo" data-start="0" data-width="1920" data-height="1080" data-duration="{durasi}" data-fps="{FPS}">
{chr(10).join(f.klip)}
</div>
<script>
{EASE_JS}
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(f.tw)}
window.__timelines["demo"] = tl;
</script>
</body>
</html>
"""
    open(os.path.join(AKAR, "index.html"), "w", encoding="utf-8", newline="\n").write(html)
    json.dump({"id": "demo-v3", "name": "demo-v3", "createdAt": "2026-11-06T03:30:00.000Z"}, open(os.path.join(AKAR, "meta.json"), "w"))
    shutil.copy(os.path.join(AKAR, "..", "film-langsung", "hyperframes.json"), os.path.join(AKAR, "hyperframes.json"))
    print("durasi", durasi)


if __name__ == "__main__":
    bangun()
