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
# CSS aplikasi terbaru (node css.mjs) menimpa salinan lama D-28 supaya kelas tata letak baru ikut (CATATAN: tinjau-draf bertumpuk).
if os.path.exists(os.path.join(AKAR, "css", "app.css")):
    shutil.copy(os.path.join(AKAR, "css", "app.css"), os.path.join(AKAR, "assets", "app", "app.css"))
    shutil.copytree(os.path.join(AKAR, "css", "media"), os.path.join(AKAR, "assets", "app", "media"), dirs_exist_ok=True)

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
    G3 = 48.0  # panjang babak 3 MCP (sisipan setelah babak 2)
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
    f.add(f'tl.to("#m1", {{opacity: 0, duration: 0.25}}, {T2c + 2.0});')  # lapisan Membaca hilang saat Siap muncul (dulu tumpuk)
    gulir = (ls_["daftar"]["y"] + ls_["daftar"]["h"] - 900) * MS
    f.add(f'tl.to("#m2", {{y: -{round(gulir * 0.55)}, duration: {27 / FPS:.3f}, ease: "power4.out"}}, {T2c + 3.2});')

    # ---------- Babak 4 Feed: kartu diangkat, Setujui menjadi cap (26 - 36 dtk) ----------
    T4 = 26.0 + G3
    fe, kn, dc = U["feed"], U["kartu-nota"], U["kartu-nota-dicap"]
    OX, OY = 340, fe["nota"]["y"] - 330  # potongan Feed yang tampil di jendela
    JX, JY, JW, JH = 200, 60, 1520, 960
    S4 = 1.45  # isi Feed diperbesar supaya kolom kartu mengisi ~60% lebar bingkai
    nx, ny = JX + (fe["nota"]["x"] - OX) * S4, JY + (fe["nota"]["y"] - OY) * S4  # pojok kiri atas kartu nota di bingkai
    sx, sy = nx + (kn["setujui"]["x"] + kn["setujui"]["w"] * 0.45) * S4, ny + (kn["setujui"]["y"] + kn["setujui"]["h"] / 2) * S4
    KURSOR = ('<svg viewBox="0 0 32 32" width="72" height="72"><path d="M6 3 L6 25 L11.5 19.8 L15.4 28.4 L19 26.8 L15.2 18.4 L22.6 18.4 Z" '
              'fill="#1C1B18" stroke="#FFFDF8" stroke-width="2" stroke-linejoin="round"/></svg>')
    isi4 = (f'<div id="b4k" class="kam">'
            f'<div class="jendela" data-layout-allow-overflow style="left:{JX}px; top:{JY}px; width:{JW}px; height:{JH}px">'
            f'<div class="isi" data-layout-allow-overflow style="left:{-OX * S4}px; top:{-OY * S4}px; transform:scale({S4}); transform-origin:0 0">{frag("feed")}</div>'
            f'<div id="redup" style="position:absolute; inset:0; background:#F6F2EA; opacity:0"></div></div>'
            # kartu nota diangkat: salinan DOM kartu yang sama, persis di atas posisinya (isolasi fokus, rujukan 1)
            f'<div id="angkat" style="position:absolute; left:{nx}px; top:{ny}px; transform-origin:50% 50%; opacity:0">'
            f'<div style="transform:scale({S4}); transform-origin:0 0">{frag("kartu-nota")}</div></div>'
            f'<div id="dicapx" style="display:none"></div><div id="dicap" style="position:absolute; z-index:5; left:{nx}px; top:{ny + 40 * S4}px; opacity:0">'
            f'<div style="transform:scale({S4}); transform-origin:0 0">{frag("kartu-nota-dicap")}</div></div>'
            f'<div id="capbesar" class="capbesar" style="left:{nx + 150 * S4}px; top:{ny + 30 * S4}px">DITERIMA</div>'
            f'<div id="tutup" style="position:absolute; left:{nx - 4}px; top:{ny - 4}px; width:{640 * S4 + 8}px; height:{178 * S4 + 8}px; background:#F6F2EA; opacity:0"></div>'
            f'<div class="kursor" id="kur4">{KURSOR}</div></div>')
    f.adegan("b4", T4, 36.0 + G3, isi4, z=4)
    f.add(f'tl.set("#b4k", {json.dumps(kamera(nx + 320 * S4, ny + 89 * S4, 1.0))}, {T4});')
    # 27,0: sekeliling meredup, kartu terangkat sedikit (skala 1,05, bayangan) - "satu kartu yang perlu keputusanmu"
    f.add(f'tl.to("#redup", {{opacity: 0.72, duration: 0.35, ease: "power2.out"}}, {T4 + 0.9});')
    f.add(f'tl.fromTo("#angkat", {{opacity: 0}}, {{opacity: 1, duration: 0.01}}, {T4 + 0.9});')
    f.add(f'tl.to("#angkat", {{scale: 1.05, y: -8, boxShadow: "0 30px 70px rgba(28,27,24,0.22)", duration: 0.4, ease: "power2.out"}}, {T4 + 0.95});')
    # kursor datang ke Setujui, klik di 29,0
    TK = T4 + 3.0
    f.add(f'tl.fromTo("#kur4", {{x: {round(sx + 520)}, y: {round(sy + 300)}, opacity: 0}}, {{x: {round(sx - 10)}, y: {round(sy - 8)}, opacity: 1, duration: 1.0, ease: TEKAN}}, {TK - 1.2:.3f});')
    f.add(f'tl.to("#kur4", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TK:.3f});')
    # cap besar turun di atas kartu (karakter film), lalu kartu menyusut menjadi kartu diputuskan asli dengan cap kecil di tempatnya
    f.add(f'tl.fromTo("#capbesar", {{opacity: 0, scale: 2.2, rotation: -14}}, {{opacity: 1, scale: 1, rotation: -7, duration: 0.16, ease: "power3.in"}}, {TK + 0.06:.3f});')
    f.add(f'tl.to("#angkat", {{scale: 1.02, duration: 0.06, yoyo: true, repeat: 1}}, {TK + 0.22:.3f});')
    cx, cy = nx + (dc["cap"]["x"]) * S4, ny + 40 * S4 + dc["cap"]["y"] * S4
    f.add(f'tl.to("#capbesar", {{x: {round(cx - (nx + 150 * S4))}, y: {round(cy - (ny + 30 * S4))}, scale: 0.36, rotation: 0, opacity: 0, duration: 0.45, ease: TEKAN}}, {TK + 1.0:.3f});')
    f.add(f'tl.to("#angkat", {{opacity: 0, duration: 0.3}}, {TK + 1.0:.3f});')
    f.add(f'tl.fromTo("#dicap", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, {TK + 1.1:.3f});')
    f.add(f'tl.to("#kur4", {{opacity: 0, duration: 0.3}}, {TK + 1.2:.3f});')
    # kartu diputuskan bergeser keluar, sekeliling terang lagi, kamera mundur memperlihatkan Feed (kurva MUNDUR)
    f.add(f'tl.set("#tutup", {{opacity: 1}}, {TK + 1.0:.3f});')
    f.add(f'tl.to("#redup", {{opacity: 0, duration: 0.4}}, {TK + 2.8:.3f});')
    f.add(f'tl.to("#b4k", {{x: 0, y: 0, scale: 0.86, duration: {48 / FPS:.3f}, ease: MUNDUR}}, {TK + 3.0:.3f});')

    # ---------- Babak 5 invoice + QRIS (36 - 46 dtk) ----------
    T5 = 36.0 + G3
    k5, s5 = f.ketik("k5", "Tagih. Pelanggan bayar QRIS.", T5 + 0.2, cps=30)
    ip = U["invoice-publik"]
    S5 = 1.12
    IX, IY = W / 2 - ip["lebar"] * S5 / 2, (H - ip["tinggi"] * S5) / 2
    def di(r, fx=0.5, fy=0.5):
        return IX + (r["x"] + r["w"] * fx) * S5, IY + (r["y"] + r["h"] * fy) * S5
    qx, qy = di(ip["qris"])
    stx, sty = di(ip["status"])
    tx, ty = di(ip["totalrp"])
    isi5 = (f'<div class="kal" id="b5t" style="top:480px">{k5}</div>'
            f'<div id="b5k" class="kam" style="opacity:0">'
            f'<div class="jendela" style="left:{IX - 24}px; top:{IY - 20}px; width:{ip["lebar"] * S5 + 48}px; height:{ip["tinggi"] * S5 + 40}px; background:#F6F2EA"></div>'
            f'<div style="position:absolute; left:{IX}px; top:{IY}px; transform:scale({S5}); transform-origin:0 0">{frag("invoice-publik")}</div>'
            f'<div id="tutupst" style="position:absolute; left:{stx - ip["status"]["w"] * S5 / 2 - 2}px; top:{sty - ip["status"]["h"] * S5 / 2 - 2}px; width:{ip["status"]["w"] * S5 + 4}px; height:{ip["status"]["h"] * S5 + 4}px; background:#F6F2EA; opacity:0"></div>'
            f'<div id="lunas" class="capbesar" style="left:{stx - 150}px; top:{sty - 44}px; border-color:#23704A; color:#23704A">LUNAS</div>'
            f'<div id="stab5" class="stab" style="left:{tx - ip["totalrp"]["w"] * S5 / 2 - 4}px; top:{ty - 13}px; width:{ip["totalrp"]["w"] * S5 + 8}px; height:26px"></div>'
            f'<div class="notif" id="notif5" style="left:{W - 620}px; top:70px"><b>Pembayaran masuk</b><br>Rp1.448.000 dari Hotel Segara, lewat QRIS</div>'
            f'</div>')
    f.adegan("b5", T5, 46.0 + G3, isi5, z=5)
    f.add(f'tl.set("#k5-c", {{opacity: 1}}, {T5 + 0.2});')
    T5b = s5 + 0.8
    f.add(f'tl.set("#b5t", {{opacity: 0}}, {T5b:.3f});')
    f.add(f'tl.set("#b5k", {{opacity: 1}}, {T5b:.3f});')
    # Bidikan dekat QRIS (2,4x), tahan 0,9 dtk, lalu tarik mundur ke tagihan utuh (kurva MUNDUR, 40 bingkai).
    f.add(f'tl.set("#b5k", {json.dumps(kamera(qx, qy, 2.4))}, {T5b:.3f});')
    f.add(f'tl.to("#b5k", {{x: 0, y: 0, scale: 1, duration: {40 / FPS:.3f}, ease: MUNDUR}}, {T5b + 0.9:.3f});')
    # Notifikasi pembayaran masuk, lalu lencana BELUM DIBAYAR dicap LUNAS (karakter cap), stabilo di total.
    TN = T5b + 2.6
    f.add(f'tl.fromTo("#notif5", {{opacity: 0, y: -24}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {TN:.3f});')
    f.add(f'tl.set("#tutupst", {{opacity: 1}}, {TN + 0.7:.3f});')
    f.add(f'tl.fromTo("#lunas", {{opacity: 0, scale: 2.2, rotation: -14}}, {{opacity: 1, scale: 0.62, rotation: -6, duration: 0.16, ease: "power3.in"}}, {TN + 0.66:.3f});')
    f.add(f'tl.fromTo("#stab5", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {TN + 1.1:.3f});')
    f.add(f'tl.to("#notif5", {{opacity: 0, duration: 0.3}}, {TN + 3.4:.3f});')

    # ---------- Babak 7 Mata (46 - 58 dtk): footage CCTV PLACEHOLDER, lalu peta panas asli ----------
    T7 = 46.0 + G3
    k7, s7 = f.ketik("k7", "Kamera menghitung. Wajah tidak disimpan.", T7 + 0.2, cps=30)
    pp = U["peta-panas"]
    S7 = 1.5
    PX, PY = W / 2 - pp["lebar"] * S7 / 2, -pp["svg"]["y"] * S7 + 80
    isi7 = (f'<div class="kal" id="b7t" style="top:480px">{k7}</div>'
            f'<div id="b7v" style="position:absolute; left:240px; top:120px; width:1440px; height:810px; background:#2A2925; border-radius:14px; opacity:0; overflow:hidden">'
            '<div class="ph" style="left:40px; top:40px; background:#2A2925; color:#F0B53D; border-color:#F0B53D">PLACEHOLDER: footage CCTV toko asli berlisensi bebas (V-04), dengan pelacakan Mata v2 (V-12 dirancang ulang)</div>'
            '<div style="position:absolute; right:40px; bottom:36px; color:#ECE7DD; font-size:34px; font-weight:700" id="hit7">Masuk 0 &middot; Keluar 0</div></div>'
            f'<div id="b7k" class="kam" style="opacity:0"><div class="jendela" style="left:{PX - 30}px; top:60px; width:{pp["lebar"] * S7 + 60}px; height:960px"></div>'
            f'<div style="position:absolute; left:{PX}px; top:{PY}px; transform:scale({S7}); transform-origin:0 0">{frag("peta-panas")}</div></div>')
    f.adegan("b7", T7, 58.0 + G3, isi7, z=7)
    f.add(f'tl.set("#k7-c", {{opacity: 1}}, {T7 + 0.2});')
    T7b = s7 + 0.8
    f.add(f'tl.set("#b7t", {{opacity: 0}}, {T7b:.3f});')
    f.add(f'tl.set("#b7v", {{opacity: 1}}, {T7b:.3f});')
    for i in range(1, 12):  # hitungan sesuai jawaban korpus Mata (11 masuk, 11 keluar) sampai footage asli terpasang
        f.add(f'tl.set("#hit7", {{textContent: "Masuk {i} · Keluar {max(0, i - 1)}"}}, {T7b + 0.35 * i:.3f});')
    T7c = T7b + 4.6
    f.add(f'tl.to("#b7v", {{opacity: 0, duration: 0.3}}, {T7c:.3f});')
    f.add(f'tl.set("#b7k", {{opacity: 1}}, {T7c:.3f});')
    ax, ay = PX + (pp["antrean"]["x"] + pp["antrean"]["w"] / 2) * S7, PY + (pp["antrean"]["y"] + pp["antrean"]["h"] / 2) * S7
    f.add(f'tl.set("#b7k", {json.dumps(kamera(ax, ay, 1.9))}, {T7c:.3f});')
    f.add(f'tl.to("#b7k", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {T7c + 0.8:.3f});')

    # ---------- Babak 9 belajar format (58 - 70 dtk): struk SPBU ke-1 dibaca AI dan dipelajari, struk ke-4 tanpa AI ----------
    # Teks status = kamus asli klaim (terbacaAi, belajarStruk, terbacaAturan); angka = eval produksi T-01B (struk-belajar.spec).
    T9 = 58.0 + G3
    k9, s9 = f.ketik("k9", "Format yang sama, dibaca tanpa AI.", T9 + 0.2, cps=30)
    def struk(sid, no, waktu, total, x):
        b = [("SPBU " + no, "judul"), ("JL. RAYA SINGARAJA", "kecil"), ("Waktu : " + waktu, ""), ("Nama Produk : PERTALITE", ""),
             ("Total Harga : Rp. " + total, "total"), ("Operator : NYOMAN", "")]
        isi = "".join(f'<div class="sb {k}">{t}</div>' for t, k in b)
        return f'<div class="struk" id="{sid}">{isi}<div class="pita" id="{sid}-p" style="top:16px; height:44px"></div></div>'
    st1 = struk("st1", "34.520.88", "04/10/2026 11:42", "64.800", 230)
    st4 = struk("st4", "34.549.21", "27-07-2026 15:37", "275.100", 1110)
    status1 = ('<div class="stat" id="sa1"><span class="tok">600 token</span>Dibaca Nadi dengan AI, yakin 98%. Periksa angkanya sebelum mengajukan.'
               '<br><b>Nadi sedang mempelajari format baru, sekali saja.</b> Struk dari toko yang sama berikutnya dibaca tanpa AI.</div>')
    status4 = ('<div class="stat" id="sa4"><span class="tok nol" id="tok4">0 token</span>Terbaca dengan aturan struk yang sudah dipelajari, tanpa AI. Periksa angkanya.</div>')
    isi9 = (f'<div class="kal" id="b9t" style="top:480px">{k9}</div>'
            f'<div id="b9k" class="kam" style="opacity:0">'
            f'<div class="kolom" style="left:150px">{st1}<div class="lbl">Struk pertama dari SPBU ini</div>{status1}</div>'
            f'<div class="kolom" id="kol4" style="left:1030px; opacity:0">{st4}<div class="lbl">Struk keempat, SPBU lain di jalan yang sama</div>{status4}</div>'
            f'</div>')
    f.adegan("b9", T9, 70.0 + G3, isi9, z=9)
    f.add(f'tl.set("#k9-c", {{opacity: 1}}, {T9 + 0.2});')
    T9b = s9 + 0.8
    f.add(f'tl.set("#b9t", {{opacity: 0}}, {T9b:.3f});')
    f.add(f'tl.set("#b9k", {{opacity: 1}}, {T9b:.3f});')
    # struk 1 dipindai pelan (model), status muncul, kalimat belajar disorot kunyit
    f.add(f'tl.fromTo("#st1-p", {{y: 0}}, {{y: 250, duration: 1.4, ease: "none"}}, {T9b + 0.3:.3f});')
    f.add(f'tl.to("#st1-p", {{opacity: 0, duration: 0.2}}, {T9b + 1.7:.3f});')
    f.add(f'tl.fromTo("#sa1", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T9b + 1.8:.3f});')
    # struk 4 masuk, dipindai sangat cepat (aturan), token menghitung 0
    T94 = T9b + 4.6
    f.add(f'tl.to("#kol4", {{opacity: 1, duration: 0.3}}, {T94:.3f});')
    f.add(f'tl.fromTo("#st4-p", {{y: 0}}, {{y: 250, duration: 0.35, ease: "power2.in"}}, {T94 + 0.4:.3f});')
    f.add(f'tl.to("#st4-p", {{opacity: 0, duration: 0.15}}, {T94 + 0.75:.3f});')
    f.add(f'tl.fromTo("#sa4", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.25, ease: "power2.out"}}, {T94 + 0.8:.3f});')
    f.add(f'tl.fromTo("#tok4", {{scale: 1.6}}, {{scale: 1, duration: 0.3, ease: "power3.out"}}, {T94 + 0.85:.3f});')

    # ---------- Babak 11 kartu akhir (70 - 76 dtk): cap turun, menjadi logo Nadi asli, satu kalimat, URL ----------
    T11 = 70.0 + G3
    logo = re.search(r'<svg[^>]*aria-label="Nadi".*?</svg>', open(os.path.join(SUMBER, "app", "feed.html"), encoding="utf8").read(), re.S).group(0)
    logo = re.sub(r'width="\d+" height="\d+"', 'width="220" height="220"', logo, count=1)
    isi11 = (f'<div id="capakhir" class="capbesar" style="left:{W / 2 - 170}px; top:330px">DITERIMA</div>'
             f'<div id="logo11" style="position:absolute; left:{W / 2 - 110}px; top:300px; width:220px; height:220px; opacity:0">{logo}</div>'
             '<div class="kal" id="k11" style="top:600px; opacity:0">Lempar berkasnya. Nadi yang merapikan.</div>'
             '<div class="kal dua" id="u11" style="top:720px; opacity:0">nadi-swart.vercel.app/demo</div>')
    f.adegan("b11", T11, 76.0 + G3, isi11, z=11)
    f.add(f'tl.fromTo("#capakhir", {{opacity: 0, scale: 2.4, rotation: -14}}, {{opacity: 1, scale: 1, rotation: -7, duration: 0.16, ease: "power3.in"}}, {T11 + 0.3});')
    f.add(f'tl.to("#capakhir", {{opacity: 0, scale: 0.6, rotation: 0, duration: 0.3, ease: TEKAN}}, {T11 + 1.2});')
    f.add(f'tl.fromTo("#logo11", {{opacity: 0, scale: 0.6}}, {{opacity: 1, scale: 1, duration: 0.35, ease: "power3.out"}}, {T11 + 1.3});')
    f.add(f'tl.fromTo("#k11", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T11 + 1.9});')
    f.add(f'tl.fromTo("#u11", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, {T11 + 2.5});')

    # ---------- Babak 3 kerja dari AI-mu lewat MCP (26 - 26+G3 dtk) ----------
    # Jendela chat NETRAL (tanpa logo atau nama aplikasi pihak ketiga); alat tulis_draf/ubah_draf = alat MCP Nadi yang sungguhan
    # (src/lib/mcp/protokol.ts); layar tinjau = DOM asli (scripts/promo-draf.mjs, draf 15 baris dari karyawan-berantakan.xlsx).
    T3 = 26.0
    k3a, s3a = f.ketik("k3a", "Atau kerja dari AI-mu sendiri.", T3 + 0.2, cps=30)
    CHAT = [
        ("u", '<span class="chip">karyawan-berantakan.xlsx</span><span class="chip">harga-berantakan.xlsx</span><br>Tolong siapkan data karyawan tokoku untuk Nadi.', 3.2),
        ("a", "Aku baca dulu Excel-nya. Ada 10 orang, tanggal masuk dan gaji ditulis macam-macam. Satu nama tercatat dua kali.", 5.6),
        ("t", "Nadi &middot; tulis_draf<br><span class=\"mono\">15 baris dikirim ke Nadi untuk kamu periksa</span>", 8.4),
        ("u", "Budi pindah ke kasir pagi ya. Yang dobel biar aku cek sendiri.", 11.0),
        ("t", "Nadi &middot; ubah_draf<br><span class=\"mono\">Topi Budi Santoso: kasir &rarr; Kasir pagi</span>", 13.6),
        ("a", "Sudah. Drafnya siap di Nadi. Gaji tidak aku centang, kamu yang periksa.", 15.4),
    ]
    gel = "".join(f'<div class="cb {k}" id="c3-{i}">{t}</div>' for i, (k, t, _) in enumerate(CHAT))
    isi3 = (f'<div class="kal" id="b3t" style="top:480px">{k3a}</div>'
            f'<div id="b3c" class="chat" style="opacity:0"><div class="chat-kepala">AI-mu &middot; tersambung ke Nadi lewat MCP</div>'
            f'<div class="chat-jendela"><div class="chat-isi" id="c3isi">{gel}</div></div><div class="chat-tulis">Tulis pesan&hellip;</div></div>')
    f.adegan("b3", T3, T3 + 19.0, isi3, z=3)
    f.add(f'tl.set("#k3a-c", {{opacity: 1}}, {T3 + 0.2});')
    f.add(f'tl.set("#b3t", {{opacity: 0}}, {s3a + 0.9:.3f});')
    f.add(f'tl.set("#b3c", {{opacity: 1}}, {s3a + 0.9:.3f});')
    for i, (k, t, w) in enumerate(CHAT):
        f.add(f'tl.fromTo("#c3-{i}", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T3 + w:.3f});')
    f.add(f'tl.to("#c3isi", {{y: -260, duration: 0.6, ease: TEKAN}}, {T3 + 10.6:.3f});')
    f.add(f'tl.to("#c3isi", {{y: -520, duration: 0.6, ease: TEKAN}}, {T3 + 15.0:.3f});')
    # Layar tinjau draf asli: dekat ke ringkasan + baris Perlu dicek, lalu catatan gaji, lalu Terapkan.
    T3b = T3 + 19.0
    td = U["tinjau-draf"]
    S3 = 1.0
    OYT = 60
    isi3b = (f'<div id="b3k" class="kam"><div class="jendela" data-layout-allow-overflow style="left:200px; top:40px; width:1520px; height:1000px">'
             f'<div class="isi" id="td" data-layout-allow-overflow style="left:-296px; top:{-OYT}px">{frag("tinjau-draf")}</div></div>'
             f'<div class="notif" id="n3" style="left:1180px; top:80px"><b>10 baris diterapkan.</b><br>Bisa dibatalkan selama 10 menit.</div></div>')
    f.adegan("b3b", T3b, T3b + 29.0, isi3b, z=3)
    def tdp(r, fy=0.5):
        return 200 - 296 + r["x"] + r["w"] / 2, 40 - OYT + r["y"] + r["h"] * fy
    rx, ry = tdp(td["ringkas"])
    f.add(f'tl.set("#b3k", {json.dumps(kamera(rx, ry + 120, 1.6))}, {T3b});')
    f.add(f'tl.to("#b3k", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {T3b + 2.2:.3f});')
    # gulir ke gaji (tidak dicentang otomatis), lalu ke tombol Terapkan
    gx, gy = tdp(td["gaji"])
    f.add(f'tl.to("#td", {{y: -{round(gy - 380)}, duration: 1.0, ease: TEKAN}}, {T3b + 6.5:.3f});')
    tx, ty = tdp(td["terapkan"])
    f.add(f'tl.to("#td", {{y: -{round(ty - 760)}, duration: 1.0, ease: TEKAN}}, {T3b + 11.0:.3f});')
    f.add(f'tl.fromTo("#n3", {{opacity: 0, y: -20}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T3b + 13.5:.3f});')

    durasi = 76.0 + G3
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
