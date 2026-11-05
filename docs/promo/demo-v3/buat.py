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


def bungkus(h, teks, sid, kelas="stab"):
    """Bungkus kemunculan pertama teks di DOM dengan lapisan sorot (stabilo) atau kotak yang ikut tata letak teks itu."""
    assert teks in h, teks
    gaya = "left:-3px; right:-3px; top:1px; bottom:1px" if kelas == "stab" else "left:-8px; right:-8px; top:-6px; bottom:-6px; border-width:2px"
    return h.replace(teks, f'<span style="position:relative">{teks}<span id="{sid}" class="{kelas}" style="{gaya}"></span></span>', 1)


def tandai_siap(h):
    """Stabilo di tiap baris "Siap disetujui: ..." daftar Lempar, ditanam di span teksnya (ls0..ls4 urut berkas)."""
    a = "<span>Siap disetujui: <span>"
    for i in range(5):
        k = h.index(a)
        h = h[:k] + f'<span style="position:relative"><span id="ls{i}" class="stab" style="left:-3px; right:-3px; top:1px; bottom:1px"></span>Siap disetujui: <span>' + h[k + len(a):]
    return h


def kamera(fx, fy, s, tx=W / 2, ty=H / 2):
    return {"x": round(tx - fx * s, 1), "y": round(ty - fy * s, 1), "scale": round(s, 4)}


def bangun():
    f = Film()
    # Urutan dan durasi babak (detik). Waktu di dalam babak relatif terhadap M[babak]; menyisipkan atau memperpanjang cukup di sini.
    D = {0: 6.5, 1: 30.0, 2: 20.0, 3: 48.0, 4: 22.0, 5: 10.0, 6: 22.0, 7: 28.0, 8: 28.0, 9: 36.0, 10: 12.0, 11: 8.0}
    M, TOTAL = {}, 0.0
    for k in D:
        M[k], TOTAL = TOTAL, TOTAL + D[k]
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
    f.adegan("b0", M[0], M[0] + D[0], f'<div id="b0k" class="kam">{nota}{kartu}</div>')
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
    T1 = M[1]
    k1, s1 = f.ketik("k1", "Masih mengetik ulang nota", T1 + 0.5)
    k1b, s1b = f.ketik("k1b", " satu per satu?", s1)
    k1c, s1c = f.ketik("k1c", " setiap malam?", s1b + 1.6)
    k2, s2 = f.ketik("k2", "Otomatis itu mahal. Yang murah, manual.", s1c + 1.1, cps=34)
    isi1 = (f'{berkas}<div class="kal" style="top:430px">{k1}{k1b}{k1c}</div>'
            f'<div class="kal dua" style="top:560px">{k2}</div>')
    f.adegan("b1", T1, T1 + 9.5, isi1, latar="#E4DED2", z=2)
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

    # Babak 1 lanjutan (T1+9,5 - T1+19,5): Excel karyawan asli (docs/promo/aset-demo/karyawan-berantakan.xlsx) direkonstruksi sel per sel,
    # sel berantakan disorot, nama dobel ditandai, rumus total yang salah. Isi sel dibaca dari berkasnya, bukan ditulis ulang.
    import openpyxl
    ws = openpyxl.load_workbook(os.path.join(AKAR, "..", "aset-demo", "karyawan-berantakan.xlsx")).active
    KOL = [44, 230, 190, 140, 150, 200, 260]
    RH, X0, Y0 = 32, (W - (44 + sum(KOL))) / 2, 30
    def sel(r, c):  # kotak sel (baris r, kolom c, mulai 1) di bingkai
        return X0 + 44 + sum(KOL[:c - 1]), Y0 + 30 + (r - 1) * RH, KOL[c - 1], RH
    import html as _h
    grid = [f'<div class="xh" style="left:{X0}px; top:{Y0}px; width:44px"></div>']
    for c in range(1, 8):
        x, _, w, _ = sel(1, c)
        grid.append(f'<div class="xh" style="left:{x}px; top:{Y0}px; width:{w}px">{"ABCDEFG"[c - 1]}</div>')
    for r, row in enumerate(ws.iter_rows(min_row=1, max_row=31, max_col=7, values_only=True), start=1):
        _, y, _, _ = sel(r, 1)
        grid.append(f'<div class="xh xn" style="left:{X0}px; top:{y}px; width:44px">{r}</div>')
        row = list(row)
        for c, v in enumerate(row, start=1):
            x, y, w, h = sel(r, c)
            if isinstance(v, str):
                for c2 in range(c + 1, 8):
                    if row[c2 - 1] is not None:
                        break
                    w += KOL[c2 - 1]
            t = "" if v is None else _h.escape(str(v))
            kanan = isinstance(v, (int, float)) and c != 1
            tebal = r == 4 or r == 1
            grid.append(f'<div class="xc{" xr" if kanan else ""}{" xb" if tebal else ""}" style="left:{x}px; top:{y}px; width:{w}px{"; z-index:1" if w > KOL[c - 1] else ""}">{t}</div>')
    SOROT = [(6, 5), (8, 4), (9, 5), (9, 4), (8, 6)]
    for i, (r, c) in enumerate(SOROT):
        x, y, w, h = sel(r, c)
        grid.append(f'<div id="xs{i}" class="stab" style="left:{x + 2}px; top:{y + 4}px; width:{w - 4}px; height:{h - 8}px"></div>')
    for i, (a, b) in enumerate([(6, 18), (7, 23)]):
        for j, r in enumerate((a, b)):
            x, y, _, _ = sel(r, 2)
            grid.append(f'<div class="kotak" id="xd{i}{j}" style="left:{x - 2}px; top:{y - 1}px; width:{sum(KOL[1:4]) + 4}px; height:{RH + 2}px; border-color:#B4372A; border-width:3px"></div>')
    xt, yt, _, _ = sel(31, 5)
    grid.append(f'<div class="kotak" id="xt" style="left:{xt - 2}px; top:{yt - 1}px; width:{KOL[4] + KOL[5] + KOL[6] + 4}px; height:{RH + 2}px; border-color:#B4372A; border-width:3px"></div>')
    T1x = T1 + 9.5
    f.adegan("b1x", T1x, T1 + 19.5, f'<div id="b1xk" class="kam" data-layout-allow-overlap>{"".join(grid)}</div>', latar="#FFFFFF", z=2)
    for i in range(len(SOROT)):
        f.add(f'tl.fromTo("#xs{i}", {{scaleX: 0}}, {{scaleX: 1, duration: 0.3, ease: "power2.out"}}, {T1x + 0.8 + i * 0.45:.3f});')
    # dorong ke nama dobel (Budi Santoso baris 6 dan 18), kotak merah, lalu ke rumus total yang salah
    _, ya, _, _ = sel(6, 2); _, yb, _, _ = sel(23, 2)
    f.add(f'tl.to("#b1xk", {{**{json.dumps(kamera(X0 + 44 + 330, (ya + yb) / 2 + 16, 1.5))}, duration: {16 / FPS:.3f}, ease: TEKAN}}, {T1x + 3.4:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    for i in range(2):
        for j in range(2):
            f.add(f'tl.fromTo("#xd{i}{j}", {{opacity: 0}}, {{opacity: 1, duration: 0.15}}, {T1x + 3.9 + i * 0.7 + j * 0.25:.3f});')
    f.add(f'tl.to("#b1xk", {{**{json.dumps(kamera(xt + 280, yt + 16, 1.7, W / 2, H / 2 - 80))}, duration: {16 / FPS:.3f}, ease: TEKAN}}, {T1x + 6.6:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add(f'tl.fromTo("#xt", {{opacity: 0, scale: 1.04}}, {{opacity: 1, scale: 1, duration: 0.2}}, {T1x + 7.2:.3f});')

    # Babak 1 lanjutan (T1+19,5 - T1+30): kartu fakta harga resmi (docs/bisnis/harga-pesaing.md, dibaca 3 Nov 2026), baris muncul
    # bergantian, tambahan modul AI disorot. Angka apa adanya dari halaman harga; satuan ditulis supaya tidak menyesatkan.
    T1h = T1 + 19.5
    k1h, s1h = f.ketik("k1h", "Yang otomatis, dibayar per outlet.", T1h + 0.2, cps=30)
    HARGA = [("Kasir dan operasional", "Rp249.000 sampai Rp999.000", "per outlet per bulan"),
             ("Tambahan modul AI asisten", "+Rp499.000", "per outlet per bulan"),
             ("Gaji dan HR", "Rp12.500 sampai Rp20.000", "per karyawan per bulan"),
             ("Akuntansi", "Rp159.900 sampai Rp674.250", "per usaha per bulan")]
    brs = "".join(f'<div class="hb" id="hb{i}"><span class="hk">{a}</span><span class="hr"><b id="hr{i}">{b}</b> {c}</span></div>' for i, (a, b, c) in enumerate(HARGA))
    isi1h = (f'<div class="kal" id="b1ht" style="top:110px">{k1h}</div>'
             f'<div class="harga" id="b1hk">{brs}<div class="hs">Halaman harga resmi majoo, Gadjian, Kledo, dan Mekari Jurnal, dibaca 3 Nov 2026. Harga bisa berubah.</div>'
             '</div>')
    f.adegan("b1h", T1h, T1 + D[1], isi1h, latar="#E4DED2", z=2)
    f.add(f'tl.set("#k1h-c", {{opacity: 1}}, {T1h + 0.2:.3f});')
    for i in range(len(HARGA)):
        f.add(f'tl.fromTo("#hb{i}", {{opacity: 0, y: 24}}, {{opacity: 1, y: 0, duration: 0.35, ease: "power2.out"}}, {s1h + 0.4 + i * 0.5:.3f});')
    f.add(f'tl.fromTo("#hr1", {{backgroundColor: "rgba(233,168,37,0)"}}, {{backgroundColor: "rgba(233,168,37,0.55)", duration: 0.35}}, {s1h + 3.0:.3f});')
    f.add(f'tl.fromTo("#b1hk", {{scale: 1}}, {{scale: 1.04, duration: 6, ease: "none"}}, {s1h + 0.4:.3f});')

    # ---------- Babak 2 Nadi muncul + Lempar (16 - 26 dtk) ----------
    T2 = M[2]
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
             f'<div class="isi" id="m2" style="transform:scale({MS}); transform-origin:0 0; top:{-(lm["area"]["y"] - 20) * MS}px; opacity:0">{tandai_siap(frag("lempar-siap"))}'
             + f'<div class="stab" id="lsf" style="left:{ls_["kefeed"]["x"] - 3}px; top:{ls_["kefeed"]["y"] + 2}px; width:{ls_["kefeed"]["w"] + 6}px; height:20px"></div>'
             + '</div></div></div>')
    f.adegan("b2b", T2c, T2 + D[2], isi2b, z=3)
    f.add(f'tl.to("#m2", {{opacity: 1, duration: 0.25}}, {T2c + 2.0});')
    f.add(f'tl.to("#m1", {{opacity: 0, duration: 0.25}}, {T2c + 2.0});')  # lapisan Membaca hilang saat Siap muncul (dulu tumpuk)
    awal = lm["area"]["y"] - 20  # baris DOM teratas yang tampil saat lapisan belum digulir
    for i in range(5):
        tg = T2c + 3.0 + i * 1.7
        if i:
            f.add(f'tl.to("#m2", {{y: {-round((ls_[f"f{i}"]["y"] - 40 - awal) * MS)}, duration: 0.55, ease: TEKAN}}, {tg:.3f});')
        f.add(f'tl.fromTo("#ls{i}", {{scaleX: 0}}, {{scaleX: 1, duration: 0.35, ease: "power2.out"}}, {tg + 0.5:.3f});')
    tf = T2c + 3.0 + 5 * 1.7
    f.add(f'tl.to("#m2", {{y: {-round((ls_["kefeed"]["y"] - 560 - awal) * MS)}, duration: 0.6, ease: TEKAN}}, {tf:.3f});')
    f.add(f'tl.fromTo("#lsf", {{scaleX: 0}}, {{scaleX: 1, duration: 0.35, ease: "power2.out"}}, {tf + 0.6:.3f});')

    # ---------- Babak 4 Feed (22 dtk): tahu dulu ke mana data masuk, buka rincian, Setujui menjadi cap ----------
    # DOM asli Feed Toko Bu Sari sekarang (scripts/promo-layar.mjs feed-rincian): kartu tagihan pemasok INV/2026/X/0007 dengan
    # "Kalau disetujui:" (U-10) dan rincian "Akan ditambah (3)" (U-13). Keadaan tertutup = DOM yang sama tanpa atribut open (ukur.mjs OLAH).
    T4 = M[4]
    KURSOR = ('<svg viewBox="0 0 32 32" width="72" height="72"><path d="M6 3 L6 25 L11.5 19.8 L15.4 28.4 L19 26.8 L15.2 18.4 L22.6 18.4 Z" '
              'fill="#1C1B18" stroke="#FFFDF8" stroke-width="2" stroke-linejoin="round"/></svg>')
    k4, s4 = f.ketik("k4", "Tahu dulu, datanya masuk ke mana.", T4 + 0.2, cps=30)
    fr, ft = U["feed-rincian"], U["feed-tutup"]
    kb, kt = fr["kartu"], ft["kartu"]
    S4, JX, JY, JW, JH = 1.45, 200, 60, 1520, 960
    OX = kb["x"] - (JW / S4 - kb["w"]) / 2
    OY = kb["y"] - 40  # kartu terbuka (595 px) tetap di dalam jendela
    def fp(x, y):  # titik DOM Feed -> bingkai
        return JX + (x - OX) * S4, JY + (y - OY) * S4
    ftutup = frag("feed-rincian").replace('data-testid="rincian-usulan" open=""', 'data-testid="rincian-usulan"')
    fbuka = frag("feed-rincian")
    kx, ky = fp(kb["x"], kb["y"])
    def salin(sid, isi, tinggi, op):  # salinan kartu yang sama, dipotong tepat di kotak kartu (isolasi fokus, rujukan 1)
        return (f'<div id="{sid}" data-layout-allow-overlap data-layout-allow-occlusion style="position:absolute; left:{kx}px; top:{ky}px; width:{kb["w"] * S4}px; '
                f'height:{tinggi * S4}px; overflow:hidden; border-radius:{10 * S4}px; opacity:{op}; transform-origin:50% 0">'
                f'<div style="position:absolute; left:{-kb["x"] * S4}px; top:{-kb["y"] * S4}px; transform:scale({S4}); transform-origin:0 0">{isi}'
                f'<div class="stab" id="{sid}-s1" style="left:{fr["kalau"]["x"] - 3}px; top:{fr["kalau"]["y"] + 1}px; width:{fr["jenis"]["w"] + 6}px; height:{fr["kalau"]["h"] - 2}px"></div>'
                f'<div class="stab" id="{sid}-s2" style="left:{fr["kalau"]["x"] - 3}px; top:{fr["kalau"]["y"] + 21}px; width:90px; height:{fr["kalau"]["h"] - 2}px"></div>'
                + (f'<div class="stab" id="{sid}-s3" style="left:{fr["tambah"]["x"] - 3}px; top:{fr["tambah"]["y"] + 1}px; width:140px; height:{fr["tambah"]["h"] - 2}px"></div>' if sid == "kb4" else "")
                + '</div></div>')
    isi4 = (f'<div class="kal" id="b4t" style="top:480px">{k4}</div>'
            f'<div id="b4k" class="kam" style="opacity:0">'
            f'<div class="jendela" data-layout-allow-overflow style="left:{JX}px; top:{JY}px; width:{JW}px; height:{JH}px">'
            f'<div class="isi" data-layout-allow-overflow style="left:{-OX * S4}px; top:{-OY * S4}px; transform:scale({S4}); transform-origin:0 0">{ftutup}</div>'
            f'<div id="redup" style="position:absolute; inset:0; background:#F6F2EA; opacity:0"></div></div>'
            + salin("kt4", ftutup, kt["h"], 0) + salin("kb4", fbuka, kb["h"], 0)
            + f'<div id="capbesar" class="capbesar" data-layout-allow-overlap data-layout-allow-occlusion style="left:{kx + kb["w"] * S4 / 2 - 170}px; top:{ky + 30}px">DITERIMA</div>'
            + f'<div class="kursor" id="kur4">{KURSOR}</div></div>'
            + '<div class="notif" id="n4" data-layout-allow-overlap data-layout-allow-occlusion style="left:1220px; top:60px"><b>Disetujui.</b><br>Masuk Pembelian sebagai tagihan pemasok.</div>')
    f.adegan("b4", T4, T4 + D[4], isi4, z=4)
    f.add(f'tl.set("#k4-c", {{opacity: 1}}, {T4 + 0.2});')
    T4a = s4 + 0.8
    f.add(f'tl.set("#b4t", {{opacity: 0}}, {T4a:.3f});')
    f.add(f'tl.set("#b4k", {{opacity: 1}}, {T4a:.3f});')
    # sekeliling meredup, kartu terangkat (salinan tertutup), "Kalau disetujui:" disorot
    f.add(f'tl.to("#redup", {{opacity: 0.72, duration: 0.35, ease: "power2.out"}}, {T4a + 0.5:.3f});')
    f.add(f'tl.set("#kt4", {{opacity: 1}}, {T4a + 0.5:.3f});')
    f.add(f'tl.to("#kt4", {{scale: 1.03, boxShadow: "0 30px 70px rgba(28,27,24,0.22)", duration: 0.4, ease: "power2.out"}}, {T4a + 0.55:.3f});')
    f.add(f'tl.fromTo("#kt4-s1", {{scaleX: 0}}, {{scaleX: 1, duration: 0.45, ease: "power2.out"}}, {T4a + 1.3:.3f});')
    f.add(f'tl.fromTo("#kt4-s2", {{scaleX: 0}}, {{scaleX: 1, duration: 0.2, ease: "power2.out"}}, {T4a + 1.75:.3f});')
    # kursor ke Lihat rincian, klik, rincian terbuka (salinan terbuka disingkap dari atas ke bawah)
    lx, ly = fp(ft["lihat"]["x"] + ft["lihat"]["w"] * 0.5, ft["lihat"]["y"] + ft["lihat"]["h"] * 0.5)
    lx, ly = kx + (lx - kx) * 1.03 - kb["w"] * S4 * 0.015, ky + (ly - ky) * 1.03
    TL = T4a + 4.0
    f.add(f'tl.fromTo("#kur4", {{x: {round(lx + 520)}, y: {round(ly + 260)}, opacity: 0}}, {{x: {round(lx - 10)}, y: {round(ly - 8)}, opacity: 1, duration: 0.9, ease: TEKAN}}, {TL - 1.0:.3f});')
    f.add(f'tl.to("#kur4", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TL:.3f});')
    f.add(f'tl.set("#kb4", {{opacity: 1, scale: 1.03, boxShadow: "0 30px 70px rgba(28,27,24,0.22)"}}, {TL + 0.1:.3f});')
    f.add(f'tl.set("#kb4-s1", {{scaleX: 1}}, {TL + 0.1:.3f});')
    f.add(f'tl.set("#kb4-s2", {{scaleX: 1}}, {TL + 0.1:.3f});')
    f.add(f'tl.set("#kb4-s3", {{scaleX: 0}}, {TL + 0.1:.3f});')
    sisa = round(100 * (1 - kt["h"] / kb["h"]), 2)
    f.add(f'tl.fromTo("#kb4", {{clipPath: "inset(0% 0% {sisa}% 0%)"}}, {{clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: TEKAN}}, {TL + 0.1:.3f});')
    f.add(f'tl.set("#kt4", {{opacity: 0}}, {TL + 0.12:.3f});')
    f.add(f'tl.to("#kur4", {{opacity: 0, duration: 0.3}}, {TL + 0.5:.3f});')
    # dorong ke rincian (TEKAN 14 bingkai), "Akan ditambah (3)" disorot, lalu tarik mundur
    rx, ry = fp(fr["rincian"]["x"] + fr["rincian"]["w"] / 2, fr["rincian"]["y"] + fr["rincian"]["h"] / 2)
    f.add(f'tl.to("#b4k", {{**{json.dumps(kamera(rx, ry, 1.3))}, duration: {14 / FPS:.3f}, ease: TEKAN}}, {TL + 0.8:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add(f'tl.fromTo("#kb4-s3", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out", immediateRender: false}}, {TL + 1.5:.3f});')
    f.add(f'tl.to("#b4k", {{x: 0, y: 0, scale: 1, duration: {40 / FPS:.3f}, ease: MUNDUR}}, {TL + 4.4:.3f});')
    # kursor ke Setujui, klik, cap DITERIMA turun di kartu (karakter film), notifikasi tujuan
    sx, sy = fp(fr["setujui"]["x"] + fr["setujui"]["w"] * 0.45, fr["setujui"]["y"] + fr["setujui"]["h"] / 2)
    sx, sy = kx + (sx - kx) * 1.03 - kb["w"] * S4 * 0.015, ky + (sy - ky) * 1.03
    TK = TL + 7.4
    f.add(f'tl.fromTo("#kur4", {{x: {round(sx + 480)}, y: {round(sy + 200)}, opacity: 0}}, {{x: {round(sx - 10)}, y: {round(sy - 8)}, opacity: 1, duration: 1.0, ease: TEKAN, immediateRender: false}}, {TK - 1.1:.3f});')
    f.add(f'tl.to("#kur4", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TK:.3f});')
    f.add(f'tl.fromTo("#capbesar", {{opacity: 0, scale: 2.2, rotation: -14}}, {{opacity: 1, scale: 1, rotation: -7, duration: 0.16, ease: "power3.in"}}, {TK + 0.06:.3f});')
    f.add(f'tl.to("#kb4", {{scale: 1.0, duration: 0.06, yoyo: true, repeat: 1}}, {TK + 0.22:.3f});')
    f.add(f'tl.to("#kur4", {{opacity: 0, duration: 0.3}}, {TK + 0.6:.3f});')
    f.add(f'tl.fromTo("#n4", {{opacity: 0, y: -24}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {TK + 0.7:.3f});')
    f.add(f'tl.to("#redup", {{opacity: 0, duration: 0.5}}, {TK + 2.4:.3f});')
    f.add(f'tl.to("#b4k", {{x: {round(W * 0.07)}, y: {round(H * 0.07)}, scale: 0.86, duration: {48 / FPS:.3f}, ease: MUNDUR}}, {TK + 2.4:.3f});')

    # ---------- Babak 5 invoice + QRIS (36 - 46 dtk) ----------
    T5 = M[5]
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
            f'<div id="tutupst" data-layout-allow-overlap data-layout-allow-occlusion style="position:absolute; left:{stx - ip["status"]["w"] * S5 / 2 - 2}px; top:{sty - ip["status"]["h"] * S5 / 2 - 2}px; width:{ip["status"]["w"] * S5 + 4}px; height:{ip["status"]["h"] * S5 + 4}px; background:#F6F2EA; opacity:0"></div>'
            f'<div id="lunas" class="capbesar" data-layout-allow-overlap data-layout-allow-occlusion style="left:{stx - 150}px; top:{sty - 44}px; border-color:#23704A; color:#23704A">LUNAS</div>'
            f'<div id="stab5" class="stab" style="left:{tx - ip["totalrp"]["w"] * S5 / 2 - 4}px; top:{ty - 13}px; width:{ip["totalrp"]["w"] * S5 + 8}px; height:26px"></div>'
            f'<div class="notif" id="notif5" data-layout-allow-overlap data-layout-allow-occlusion style="left:{W - 700}px; top:70px"><b>Pembayaran masuk</b><br>Rp1.448.000 dari Hotel Segara, lewat QRIS</div>'
            f'</div>')
    f.adegan("b5", T5, T5 + D[5], isi5, z=5)
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
    T7 = M[7]
    k7, s7 = f.ketik("k7", "Kamera menghitung. Wajah tidak disimpan.", T7 + 0.2, cps=30)
    pp = U["peta-panas"]
    S7 = 1.5
    PX, PY = W / 2 - pp["lebar"] * S7 / 2, -pp["svg"]["y"] * S7 + 80
    isi7 = (f'<div class="kal" id="b7t" style="top:480px">{k7}</div>'
            f'<div id="b7v" style="position:absolute; left:240px; top:120px; width:1440px; height:810px; background:#2A2925; border-radius:14px; opacity:0; overflow:hidden">'
            '<div class="ph" style="left:40px; top:40px; background:#2A2925; color:#F0B53D; border-color:#F0B53D">PLACEHOLDER: footage CCTV toko asli berlisensi bebas (V-04), dengan pelacakan Mata v2 (V-12 dirancang ulang)</div>'
            '<div style="position:absolute; right:40px; bottom:36px; color:#ECE7DD; font-size:34px; font-weight:700" id="hit7">Masuk 0 &middot; Keluar 0</div></div>'
            f'<div id="b7k" class="kam" style="opacity:0"><div class="jendela" style="left:{PX - 30}px; top:60px; width:{pp["lebar"] * S7 + 60}px; height:960px"></div>'
            f'<div id="pp7" style="position:absolute; left:{PX}px; top:{PY}px; transform:scale({S7}); transform-origin:0 0">'
            + bungkus(frag("peta-panas").replace('data-testid="panas-jumlah">177<', 'data-testid="panas-jumlah"><span id="n177">177</span><', 1),
                      "Pintu &gt; Lorong B &gt; Antrean &gt; Kasir &gt; Antrean &gt; Pintu", "pj1")
            + '</div></div>')
    f.adegan("b7", T7, T7 + 20.0, isi7, z=7)
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

    # Babak 7 lanjutan: angka kunjungan asli (177, rekap 7 hari), jalur yang paling sering (hanya jalur >= 3 kunjungan), lalu papan
    # informasi kamera (UU 27/2022 Pasal 17) dari panel Mata asli. Tanpa data per orang.
    T7d = T7c + 3.2
    f.add(f'tl.to("#pp7", {{y: {round((pp["svg"]["y"] - pp["jumlah"]["y"] + 60) * S7)}, duration: 0.7, ease: TEKAN}}, {T7d:.3f});')
    jx7, jy7 = PX + (pp["jumlah"]["x"] + 360) * S7, PY + (pp["jumlah"]["y"] + 10) * S7 + (pp["svg"]["y"] - pp["jumlah"]["y"] + 60) * S7
    f.add(f'tl.to("#b7k", {{**{json.dumps(kamera(jx7, jy7, 1.35))}, duration: {14 / FPS:.3f}, ease: TEKAN}}, {T7d + 0.8:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add(f'tl.fromTo("#n177", {{textContent: 0}}, {{textContent: 177, duration: 1.2, ease: "power2.out", snap: {{textContent: 1}}, immediateRender: false}}, {T7d + 0.9:.3f});')
    f.add(f'tl.to("#b7k", {{x: 0, y: 0, scale: 1, duration: {36 / FPS:.3f}, ease: MUNDUR}}, {T7d + 3.0:.3f});')
    T7e = T7d + 4.4
    f.add(f'tl.to("#pp7", {{y: {-round((pp["jalur"]["y"] - pp["svg"]["y"] - 260) * S7)}, duration: 0.8, ease: TEKAN}}, {T7e:.3f});')
    f.add(f'tl.fromTo("#pj1", {{scaleX: 0}}, {{scaleX: 1, duration: 0.45, ease: "power2.out"}}, {T7e + 1.0:.3f});')

    T7m = T7 + 20.0
    mp = U["mata-panel"]
    S7m = 1.6
    MX, MY = W / 2 - mp["lebar"] * S7m / 2, H / 2 - (mp["papan"]["y"] + 60) * S7m
    isi7m = (f'<div id="b7mk" class="kam"><div class="jendela" style="left:{MX - 30}px; top:{MY + (mp["judul"]["y"] - 20) * S7m}px; width:{mp["lebar"] * S7m + 60}px; height:{(mp["tinggi"] - 70) * S7m}px"></div>'
             f'<div style="position:absolute; left:{MX}px; top:{MY}px; transform:scale({S7m}); transform-origin:0 0">'
             + bungkus(bungkus(frag("mata-panel"), "UU 27/2022 Pasal 17 mewajibkan informasi di area yang dipasangi kamera.", "pu7"),
                       "Papan informasi sudah terpasang di area kamera", "pk7", "kotak")
             + '</div></div>')
    f.adegan("b7m", T7m, T7 + D[7], isi7m, z=7)
    f.add(f'tl.set("#b7mk", {json.dumps(kamera(W / 2, H / 2, 1.25))}, {T7m:.3f});')
    f.add(f'tl.to("#b7mk", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {T7m + 0.6:.3f});')
    f.add(f'tl.fromTo("#pu7", {{scaleX: 0}}, {{scaleX: 1, duration: 0.45, ease: "power2.out"}}, {T7m + 2.4:.3f});')
    f.add(f'tl.fromTo("#pk7", {{opacity: 0, scale: 1.04}}, {{opacity: 1, scale: 1, duration: 0.2}}, {T7m + 4.0:.3f});')

    # ---------- Babak 9 belajar format (58 - 70 dtk): struk SPBU ke-1 dibaca AI dan dipelajari, struk ke-4 tanpa AI ----------
    # Teks status = kamus asli klaim (terbacaAi, belajarStruk, terbacaAturan); angka = eval produksi T-01B (struk-belajar.spec).
    T9 = M[9]
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
    f.adegan("b9", T9, T9 + 12.0, isi9, z=9)
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

    # Babak 9 lanjutan (T9+12 - T9+29): pengawas bukan AI (T-02). Aturan yang ditulis model ditampilkan apa adanya; daftar alasan =
    # keluaran asli periksaAturan (pengawas.ts) untuk aturan buruk ini, dijalankan 6 Nov 2026; aturan baik lulus, lalu bayangan 2x baru aktif.
    T9p = T9 + 12.0
    k9p, s9p = f.ketik("k9p", "Aturan dari AI diperiksa kode biasa.", T9p + 0.2, cps=30)
    BURUK = ['{', '  "bentuk": "teks", "jenis": "struk",', '  "jangkar": ["SPBU", "Total Harga"],', '  "bidang": {',
             '    "total": { "tipe": "rupiah",', '      "pola": "Total Harga : Rp\\\\. <b class="jm">((\\\\d+)+)+</b>" },',
             '    "pemasok": { "tipe": "teks",', '      "pola": "SPBU (.+)<b class="jm">&lt;script&gt;fetch(...)&lt;/script&gt;</b>" }', '  }', '}']
    BAIK = ['{', '  "bentuk": "teks", "jenis": "struk",', '  "jangkar": ["SPBU", "Total Harga"],', '  "bidang": {',
            '    "pemasok": { "tipe": "teks", "pola": "^(SPBU [\\\\d.]+)" },', '    "tanggal": { "tipe": "tanggal",',
            '      "pola": "Waktu : (\\\\d{2}[/.-]\\\\d{2}[/.-]\\\\d{4})" },', '    "total": { "tipe": "rupiah",',
            '      "pola": "Total Harga : Rp\\\\. ?([\\\\d.]+)" }', '  }', '}']
    ALASAN = ["total: pengulangan bersarang (berisiko lambat)", "total: harus tepat satu grup tangkap",
              "pemasok: berisi teks yang menyerupai skrip atau SQL", "pemasok: harus tepat satu grup tangkap"]
    def kode(sid, baris, op=1):
        isi = ""
        for b in baris:
            lead = len(b) - len(b.lstrip(" "))
            isi += f'<div style="padding-left:{lead * 0.6}em">{b.lstrip(" ")}</div>'
        return f'<div class="kode" id="{sid}" style="opacity:{op}">{isi}</div>'
    cek = "".join(f'<div class="pa" id="pa{i}"><span class="px">&times;</span>{t}</div>' for i, t in enumerate(ALASAN))
    isi9p = (f'<div class="kal" id="b9pt" style="top:480px">{k9p}</div>'
             f'<div id="b9pk" class="kam" style="opacity:0">'
             f'<div class="lbl9" style="left:110px; top:170px">Aturan yang ditulis AI</div><div class="lbl9" style="left:1090px; top:170px">Pengawas: kode tetap, tanpa AI</div>'
             f'<div style="position:absolute; left:110px; top:224px; width:940px">{kode("kb", BURUK)}{kode("kg", BAIK, 0)}</div>'
             f'<div id="capt9" class="capbesar" data-layout-allow-overlap data-layout-allow-occlusion style="left:360px; top:520px; border-color:#B4372A; color:#B4372A">DITOLAK</div>'
             f'<div class="pengawas" id="pg">{cek}<div class="pok" id="pok"><span class="pv">&#10003;</span>Lulus pemeriksaan</div>'
             f'<div class="ptahap" id="pt"><span class="pil" id="pil">bayangan</span> <span id="pcocok">cocok dengan AI 0 dari 2</span></div>'
             f'<div class="pmati" id="pm">Beda sekali saja, aturan dimatikan.</div></div></div>')
    f.adegan("b9p", T9p, T9 + 29.0, isi9p, z=9)
    f.add(f'tl.set("#k9p-c", {{opacity: 1}}, {T9p + 0.2:.3f});')
    T9q = s9p + 0.8
    f.add(f'tl.set("#b9pt", {{opacity: 0}}, {T9q:.3f});')
    f.add(f'tl.set("#b9pk", {{opacity: 1}}, {T9q:.3f});')
    for i in range(len(ALASAN)):
        f.add(f'tl.fromTo("#pa{i}", {{opacity: 0, x: -16}}, {{opacity: 1, x: 0, duration: 0.25, ease: "power2.out"}}, {T9q + 1.2 + i * 0.45:.3f});')
    f.add(f'tl.fromTo("#capt9", {{opacity: 0, scale: 2.2, rotation: -14}}, {{opacity: 1, scale: 1, rotation: -7, duration: 0.16, ease: "power3.in"}}, {T9q + 3.3:.3f});')
    T9g = T9q + 5.6
    f.add(f'tl.to("#capt9", {{opacity: 0, duration: 0.25}}, {T9g:.3f});')
    f.add(f'tl.to("#kb", {{opacity: 0, duration: 0.25}}, {T9g:.3f});')
    f.add(f'tl.to("#kg", {{opacity: 1, duration: 0.25}}, {T9g + 0.2:.3f});')
    for i in range(len(ALASAN)):
        f.add(f'tl.to("#pa{i}", {{opacity: 0, duration: 0.2}}, {T9g:.3f});')
    f.add(f'tl.fromTo("#pok", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T9g + 1.0:.3f});')
    f.add(f'tl.fromTo("#pt", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, {T9g + 1.8:.3f});')
    f.add(f'tl.set("#pcocok", {{textContent: "cocok dengan AI 1 dari 2"}}, {T9g + 3.0:.3f});')
    f.add(f'tl.set("#pcocok", {{textContent: "cocok dengan AI 2 dari 2"}}, {T9g + 4.0:.3f});')
    f.add(f'tl.set("#pil", {{textContent: "aktif", borderColor: "#23704A", color: "#23704A"}}, {T9g + 4.8:.3f});')
    f.add(f'tl.fromTo("#pil", {{scale: 1.5}}, {{scale: 1, duration: 0.3, ease: "power3.out", immediateRender: false}}, {T9g + 4.8:.3f});')
    f.add(f'tl.fromTo("#pm", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, {T9g + 6.0:.3f});')

    # Babak 9 penutup (T9+29 - T9+36): cara yang sama di tempat lain (T-01A tanya data, T-01B struk, T-01C pindah data).
    T9r = T9 + 29.0
    TIGA = [("Struk foto", "Struk dari toko yang sama dibaca dengan aturan, 0 token."),
            ("Tanya data", "Kalimat baru dipetakan sekali ke pertanyaan yang dikenal."),
            ("Pindah data", "Judul kolom aplikasi lama dipetakan sekali. Isi baris tidak dikirim.")]
    kartu3 = "".join(f'<div class="k3" id="k3{i}"><b>{a}</b><span>{b}</span></div>' for i, (a, b) in enumerate(TIGA))
    k9r, s9r = f.ketik("k9r", "Belajar sekali. Berikutnya tanpa AI.", T9r + 0.2, cps=30)
    f.adegan("b9r", T9r, T9 + D[9], f'<div class="kal" style="top:240px">{k9r}</div><div class="tiga">{kartu3}</div>', z=9)
    f.add(f'tl.set("#k9r-c", {{opacity: 1}}, {T9r + 0.2:.3f});')
    for i in range(3):
        f.add(f'tl.fromTo("#k3{i}", {{opacity: 0, y: 30}}, {{opacity: 1, y: 0, duration: 0.4, ease: MUNDUR}}, {s9r + 0.3 + i * 0.35:.3f});')

    # ---------- Babak 11 kartu akhir (70 - 76 dtk): cap turun, menjadi logo Nadi asli, satu kalimat, URL ----------
    T11 = M[11]
    logo = re.search(r'<svg[^>]*aria-label="Nadi".*?</svg>', open(os.path.join(SUMBER, "app", "feed.html"), encoding="utf8").read(), re.S).group(0)
    logo = re.sub(r'width="\d+" height="\d+"', 'width="220" height="220"', logo, count=1)
    isi11 = (f'<div id="capakhir" class="capbesar" data-layout-allow-overlap data-layout-allow-occlusion style="left:{W / 2 - 170}px; top:330px">DITERIMA</div>'
             f'<div id="logo11" style="position:absolute; left:{W / 2 - 110}px; top:300px; width:220px; height:220px; opacity:0">{logo}</div>'
             '<div class="kal" id="k11" style="top:600px; opacity:0">Lempar berkasnya. Nadi yang merapikan.</div>'
             '<div class="kal dua" id="u11" style="top:720px; opacity:0">nadi-swart.vercel.app/demo</div>')
    f.adegan("b11", T11, T11 + D[11], isi11, z=11)
    f.add(f'tl.fromTo("#capakhir", {{opacity: 0, scale: 2.4, rotation: -14}}, {{opacity: 1, scale: 1, rotation: -7, duration: 0.16, ease: "power3.in"}}, {T11 + 0.3});')
    f.add(f'tl.to("#capakhir", {{opacity: 0, scale: 0.6, rotation: 0, duration: 0.3, ease: TEKAN}}, {T11 + 1.2});')
    f.add(f'tl.fromTo("#logo11", {{opacity: 0, scale: 0.6}}, {{opacity: 1, scale: 1, duration: 0.35, ease: "power3.out"}}, {T11 + 1.3});')
    f.add(f'tl.fromTo("#k11", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {T11 + 1.9});')
    f.add(f'tl.fromTo("#u11", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, {T11 + 2.5});')

    # ---------- Babak 3 kerja dari AI-mu lewat MCP  ----------
    # Jendela chat NETRAL (tanpa logo atau nama aplikasi pihak ketiga); alat tulis_draf/ubah_draf = alat MCP Nadi yang sungguhan
    # (src/lib/mcp/protokol.ts); layar tinjau = DOM asli (scripts/promo-draf.mjs, draf 15 baris dari karyawan-berantakan.xlsx).
    T3 = M[3]
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
             f'<div class="notif" id="n3" data-layout-allow-overlap data-layout-allow-occlusion style="left:1220px; top:80px"><b>10 baris diterapkan.</b><br>Bisa dibatalkan selama 10 menit.</div></div>')
    f.adegan("b3b", T3b, T3 + D[3], isi3b, z=3)
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

    # ---------- Babak 10 satu kerangka di semua layar  ----------
    # Tiap ukuran dimuat di iframe selebar aslinya, supaya media query CSS aplikasi bekerja seperti di perangkat (1440 sidebar,
    # 768 rail, 390 bilah bawah). DOM = /app Toko Bu Sari (scripts/promo-layar.mjs).
    T10 = M[10]
    k10, s10 = f.ketik("k10", "Di laptop dan HP, tempatnya sama.", T10 + 0.2, cps=30)
    def bingkai(nama, lebar, tinggi, skala, x, y, bid):
        h = open(os.path.join(SUMBER, "app", f"{nama}.html"), encoding="utf8").read()
        h = re.sub(r"<body([^>]*)>", r"<body style='margin:0'>", h)
        doc = f'<!doctype html><html lang="id"><head><link rel="stylesheet" href="assets/app/app.css"></head>{h}</html>'.replace('"', "&quot;")
        return (f'<div class="perangkat" id="{bid}" style="left:{x}px; top:{y}px; width:{lebar * skala}px; height:{tinggi * skala}px; opacity:0">'
                f'<iframe srcdoc="{doc}" style="width:{lebar}px; height:{tinggi}px; transform:scale({skala}); transform-origin:0 0; border:0" scrolling="no"></iframe></div>')
    isi10 = (f'<div class="kal" id="b10t" style="top:480px">{k10}</div>'
             + bingkai("hari-1440", 1440, 900, 0.62, 70, 190, "d1") + bingkai("hari-768", 768, 1024, 0.6, 1000, 150, "d2")
             + bingkai("hari-390", 390, 844, 0.9, 1500, 150, "d3"))
    f.adegan("b10", T10, T10 + D[10], isi10, z=10)
    f.add(f'tl.set("#k10-c", {{opacity: 1}}, {T10 + 0.2});')
    T10b = s10 + 0.8
    f.add(f'tl.set("#b10t", {{opacity: 0}}, {T10b:.3f});')
    for i, d in enumerate(["d1", "d2", "d3"]):
        f.add(f'tl.fromTo("#{d}", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.45, ease: MUNDUR}}, {T10b + i * 0.5:.3f});')

    # ---------- Babak 8 otomasi + tanya data + Sarapan Data (28 dtk) ----------
    # DOM asli baca-saja Toko Bu Sari (scripts/promo-layar.mjs). Teks yang muncul = kamus asli ("Alur dibuat dan langsung aktif.");
    # isian {nomor} ada di data kejadian invoice.lunas (migrasi alur_proses). Jawaban tanya = jawaban produksi untuk pertanyaan itu.
    T8 = M[8]
    k8, s8 = f.ketik("k8", "Yang berulang, biar jalan sendiri.", T8 + 0.2, cps=30)
    al = U["alur"]
    S8, OX8, OY8, JX8, JY8 = 1.5, 300, 420, 160, 90
    def ap(r, fx=0.5, fy=0.5):  # titik elemen alur di bingkai
        return JX8 + (r["x"] + r["w"] * fx - OX8) * S8, JY8 + (r["y"] + r["h"] * fy - OY8) * S8
    fa = frag("alur").replace('placeholder="Kerusakan alat parah"', 'placeholder=""').replace('placeholder="Perbaiki {alat}"', 'placeholder=""')
    kn8, sn8 = f.ketik("k8n", "Kirim pesanan setelah lunas", T8 + 2.6, cps=24, gaya="")
    kk8, sk8 = f.ketik("k8k", "Kirim pesanan {nomor}", sn8 + 2.2, cps=24)
    def isian(r, html, pad=9):
        return (f'<div style="position:absolute; left:{r["x"] + pad}px; top:{r["y"]}px; height:{r["h"]}px; display:flex; align-items:center; '
                f'font-size:16px; color:#1C1B18; white-space:nowrap">{html}</div>')
    bx, by = ap(al["buat"])
    isi8 = (f'<div class="kal" id="b8t" style="top:480px">{k8}</div>'
            f'<div id="b8k" class="kam" style="opacity:0"><div class="jendela" data-layout-allow-overflow style="left:{JX8}px; top:{JY8}px; width:1600px; height:900px">'
            f'<div class="isi" data-layout-allow-overflow style="left:{-OX8 * S8}px; top:{-OY8 * S8}px; transform:scale({S8}); transform-origin:0 0">{fa}'
            f'{isian(al["nama"], kn8)}{isian(al["kerja"], kk8)}'
            f'<div class="kotak" id="k8sel" style="left:{al["ketika"]["x"] - 5}px; top:{al["ketika"]["y"] - 5}px; width:{al["ketika"]["w"] + 10}px; height:{al["ketika"]["h"] + 10}px; border-color:#E9A825"></div>'
            f'<div id="k8btn" style="position:absolute; left:{al["buat"]["x"]}px; top:{al["buat"]["y"]}px; width:{al["buat"]["w"]}px; height:{al["buat"]["h"]}px"></div>'
            f'</div></div><div class="kursor" id="kur8">{KURSOR}</div></div>'
            '<div class="notif" id="n8" data-layout-allow-overlap data-layout-allow-occlusion style="left:1220px; top:60px"><b>Alur dibuat dan langsung aktif.</b></div>')
    f.adegan("b8", T8, T8 + 11.5, isi8, z=8)
    f.add(f'tl.set("#k8-c", {{opacity: 1}}, {T8 + 0.2});')
    T8a = s8 + 0.8
    f.add(f'tl.set("#b8t", {{opacity: 0}}, {T8a:.3f});')
    f.add(f'tl.set("#b8k", {{opacity: 1}}, {T8a:.3f});')
    nx8, ny8 = ap(al["nama"], 0.3)
    f.add(f'tl.set("#b8k", {json.dumps(kamera(nx8, ny8, 1.45))}, {T8a:.3f});')
    f.add(f'tl.set("#k8n-c", {{opacity: 1}}, {T8 + 2.6:.3f});')
    f.add(f'tl.set("#k8n-c", {{opacity: 0}}, {sn8 + 0.4:.3f});')
    # Ketika: Invoice lunas disorot, lalu tarik mundur memperlihatkan seluruh formulir saat judul kerja diketik.
    f.add(f'tl.fromTo("#k8sel", {{opacity: 0}}, {{opacity: 1, duration: 0.2}}, {sn8 + 0.3:.3f});')
    f.add(f'tl.to("#b8k", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {sn8 + 0.9:.3f});')
    f.add(f'tl.set("#k8k-c", {{opacity: 1}}, {sn8 + 2.2:.3f});')
    f.add(f'tl.set("#k8k-c", {{opacity: 0}}, {sk8 + 0.3:.3f});')
    f.add(f'tl.to("#k8sel", {{opacity: 0, duration: 0.2}}, {sk8 + 0.2:.3f});')
    TK8 = sk8 + 1.3
    f.add(f'tl.fromTo("#kur8", {{x: {round(bx + 600)}, y: {round(by + 260)}, opacity: 0}}, {{x: {round(bx - 10)}, y: {round(by - 8)}, opacity: 1, duration: 0.9, ease: TEKAN}}, {TK8 - 1.0:.3f});')
    f.add(f'tl.to("#kur8", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TK8:.3f});')
    f.add(f'tl.fromTo("#k8btn", {{backgroundColor: "rgba(246,242,234,0)"}}, {{backgroundColor: "rgba(246,242,234,0.25)", duration: 0.07, yoyo: true, repeat: 1}}, {TK8:.3f});')
    f.add(f'tl.fromTo("#n8", {{opacity: 0, y: -24}}, {{opacity: 1, y: 0, duration: 0.3, ease: "power2.out"}}, {TK8 + 0.25:.3f});')
    f.add(f'tl.to("#kur8", {{opacity: 0, duration: 0.3}}, {TK8 + 0.8:.3f});')

    # Tanya data: pertanyaan diketik, Tanya diklik, jawaban dari sumber, stabilo angka dan tautan sumber.
    T8b = T8 + 11.5
    kt8, st8 = f.ketik("k8t", "Tanya angkanya. Nadi tunjukkan sumbernya.", T8b + 0.2, cps=30)
    ty_ = U["tanya"]
    S8b, JX8b, JY8b = 1.6, 200, 100
    OX8b, OY8b = (ty_["tanya"]["x"] + 364) - 760 / S8b, 100
    def tp(r, fx=0.5, fy=0.5):
        return JX8b + (r["x"] + r["w"] * fx - OX8b) * S8b, JY8b + (r["y"] + r["h"] * fy - OY8b) * S8b
    ft = frag("tanya").replace('value="Laba bulan ini berapa?"', 'value=""').replace('placeholder="Berapa penjualan bulan ini?"', 'placeholder=""')
    kq8, sq8 = f.ketik("k8q", "Laba bulan ini berapa?", st8 + 1.4, cps=20)
    jw = ty_["jawab"]
    rp_, sm_ = ty_["rp"], ty_["sumber"]
    tbx, tby = tp(ty_["tombol"])
    isi8b = (f'<div class="kal" id="b8bt" style="top:480px">{kt8}</div>'
             f'<div id="b8bk" class="kam" style="opacity:0"><div class="jendela" data-layout-allow-overflow style="left:{JX8b}px; top:{JY8b}px; width:1520px; height:880px">'
             f'<div class="isi" data-layout-allow-overflow style="left:{-OX8b * S8b}px; top:{-OY8b * S8b}px; transform:scale({S8b}); transform-origin:0 0">{ft}'
             f'{isian(ty_["tanya"], kq8, 13)}'
             f'<div id="t8tutup" data-layout-allow-overlap data-layout-allow-occlusion style="position:absolute; left:{jw["x"] - 4}px; top:{jw["y"] - 4}px; width:{jw["w"] + 8}px; height:{jw["h"] + 8}px; background:#F6F2EA"></div>'
             f'<div id="t8s1" class="stab" style="left:{rp_["x"] - 3}px; top:{rp_["y"] + 1}px; width:{rp_["w"] + 6}px; height:{rp_["h"]}px"></div>'
             f'<div id="t8s2" class="stab" style="left:{sm_["x"] - 3}px; top:{sm_["y"] + 1}px; width:{sm_["w"] + 6}px; height:{sm_["h"]}px"></div>'
             f'</div></div><div class="kursor" id="kur8b">{KURSOR}</div></div>')
    f.adegan("b8b", T8b, T8 + 20.0, isi8b, z=8)
    f.add(f'tl.set("#k8t-c", {{opacity: 1}}, {T8b + 0.2:.3f});')
    T8b2 = st8 + 0.8
    f.add(f'tl.set("#b8bt", {{opacity: 0}}, {T8b2:.3f});')
    f.add(f'tl.set("#b8bk", {{opacity: 1}}, {T8b2:.3f});')
    f.add(f'tl.set("#k8q-c", {{opacity: 1}}, {st8 + 1.4:.3f});')
    f.add(f'tl.set("#k8q-c", {{opacity: 0}}, {sq8 + 0.3:.3f});')
    TK8b = sq8 + 0.9
    f.add(f'tl.fromTo("#kur8b", {{x: {round(tbx + 420)}, y: {round(tby + 360)}, opacity: 0}}, {{x: {round(tbx - 10)}, y: {round(tby - 8)}, opacity: 1, duration: 0.8, ease: TEKAN}}, {TK8b - 0.9:.3f});')
    f.add(f'tl.to("#kur8b", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TK8b:.3f});')
    f.add(f'tl.to("#t8tutup", {{opacity: 0, duration: 0.25}}, {TK8b + 0.45:.3f});')
    f.add(f'tl.to("#kur8b", {{opacity: 0, duration: 0.3}}, {TK8b + 0.6:.3f});')
    # Dorong ke jawaban (TEKAN 14 bingkai), stabilo angka lalu sumber.
    jx, jy = tp(jw)
    f.add(f'tl.to("#b8bk", {{**{json.dumps(kamera(jx, jy, 1.3))}, duration: {14 / FPS:.3f}, ease: TEKAN}}, {TK8b + 0.9:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add(f'tl.fromTo("#t8s1", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {TK8b + 1.3:.3f});')
    f.add(f'tl.fromTo("#t8s2", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {TK8b + 2.3:.3f});')

    # Sarapan Data: kartu pagi asli, dua butir berdampak rupiah muncul bergantian.
    T8c = T8 + 20.0
    kc8, sc8 = f.ketik("k8c", "Tiap pagi, yang berdampak rupiah.", T8c + 0.2, cps=30)
    S8c = 2.2
    SXc, SYc = W / 2 - 632 * S8c / 2, (H - 299 * S8c) / 2
    isi8c = (f'<div class="kal" id="b8ct" style="top:480px">{kc8}</div>'
             f'<div id="b8ck" class="kam" style="opacity:0"><div class="jendela" style="left:{SXc - 50}px; top:{SYc - 46}px; width:{632 * S8c + 100}px; height:{299 * S8c + 80}px"></div>'
             f'<div style="position:absolute; left:{SXc}px; top:{SYc}px; transform:scale({S8c}); transform-origin:0 0">{frag("sarapan").replace("Rp1.406.000", '<span style="position:relative">Rp1.406.000<span id="sps" class="stab" style="left:-3px; right:-3px; top:1px; bottom:1px"></span></span>', 1)}'
             f'<div id="sp2" data-layout-allow-overlap data-layout-allow-occlusion style="position:absolute; left:-2px; top:186px; width:640px; height:116px; background:#F6F2EA"></div>'
             f'</div></div>')
    f.adegan("b8c", T8c, T8 + D[8], isi8c, z=8)
    f.add(f'tl.set("#k8c-c", {{opacity: 1}}, {T8c + 0.2:.3f});')
    T8c2 = sc8 + 0.8
    f.add(f'tl.set("#b8ct", {{opacity: 0}}, {T8c2:.3f});')
    f.add(f'tl.set("#b8ck", {{opacity: 1}}, {T8c2:.3f});')
    f.add(f'tl.set("#b8ck", {json.dumps(kamera(W / 2, SYc + 120 * S8c, 1.35))}, {T8c2:.3f});')
    f.add(f'tl.fromTo("#sps", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {T8c2 + 0.5:.3f});')
    f.add(f'tl.to("#b8ck", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {T8c2 + 2.2:.3f});')
    f.add(f'tl.to("#sp2", {{opacity: 0, duration: 0.3}}, {T8c2 + 3.0:.3f});')

    # ---------- Babak 6 gaji (22 dtk): PPh 21 + BPJS terhitung, Gerbang Gaji menahan nama dengan alasan, pemilik melepas ----------
    # DOM asli draf gaji Toko Bu Sari (scripts/promo-layar.mjs gaji-isi + gaji-draf, draf tidak disetujui). Rincian slip pertama dibuka
    # (OLAH yang sama di ukur.mjs). Teks "Dilepas. Alasanmu tercatat di slip." = kamus gajiPesan.dilepas.
    T6 = M[6]
    k6, s6 = f.ketik("k6", "Gaji dihitung. Yang janggal, ditahan dulu.", T6 + 0.2, cps=30)
    gd = U["gaji-draf"]
    S6, JX6, JY6, JW6, JH6 = 1.7, 360, 60, 1200, 960
    OX6 = 580 - (JW6 - 536 * S6) / 2 / S6
    GULIR = [100, 470, 760]  # baris DOM teratas yang tampil di jendela pada tiap tahap
    def gp(r, oy, fx=0.5, fy=0.5):
        return JX6 + (r["x"] + r["w"] * fx - OX6) * S6, JY6 + (r["y"] + r["h"] * fy - oy) * S6
    PH = 'placeholder="Misalnya: sudah dicek, sedang cuti panjang"'
    fg = frag("gaji-draf").replace('<details class="mt-2 text-sm">', '<details open class="mt-2 text-sm">', 1)
    i2 = fg.find(PH, fg.find(PH) + 1)
    fg = fg[:i2] + 'placeholder=""' + fg[i2 + len(PH):]
    ka6, sa6 = f.ketik("k6a", "Sudah dicek, Rina jaga kasir tiap hari", 0, cps=24)  # waktu diatur ulang di bawah
    f.tw = f.tw[:-len("Sudah dicek, Rina jaga kasir tiap hari")]
    def stab(sid, x, y, w, h):
        return f'<div id="{sid}" class="stab" style="left:{x}px; top:{y}px; width:{w}px; height:{h}px"></div>'
    ps, al1, bp, ph_, t1, t2, in2, lp2 = (gd[k] for k in ["pesan", "alasan1", "bpjs", "pph", "tahan1", "tahan2", "input2", "lepas2"])
    isi6 = (f'<div class="kal" id="b6t" style="top:480px">{k6}</div>'
            f'<div id="b6k" class="kam" style="opacity:0"><div class="jendela" data-layout-allow-overflow style="left:{JX6}px; top:{JY6}px; width:{JW6}px; height:{JH6}px">'
            f'<div class="isi" id="g6" data-layout-allow-overflow style="left:{-OX6 * S6}px; top:{-GULIR[0] * S6}px; transform:scale({S6}); transform-origin:0 0">{fg}'
            + stab("g6s1", ps["x"] - 3, ps["y"] + 1, ps["w"] + 6, ps["h"] - 2)
            + f'<div class="kotak" id="g6k" style="left:{al1["x"] - 6}px; top:{t1["y"] - 8}px; width:{al1["w"] + 12}px; height:{al1["y"] + al1["h"] - t1["y"] + 14}px; border-width:2px"></div>'
            + stab("g6s2", 577, bp["y"] + 1, 1116 - 577 + 3, bp["h"] - 2) + stab("g6s3", 577, ph_["y"] + 1, 1116 - 577 + 3, ph_["h"] - 2)
            + f'<div style="position:absolute; left:{in2["x"] + 9}px; top:{in2["y"]}px; height:{in2["h"]}px; display:flex; align-items:center; font-size:16px; white-space:nowrap">{ka6}</div>'
            + f'<div id="g6tt" data-layout-allow-overlap data-layout-allow-occlusion style="position:absolute; left:{t2["x"] - 2}px; top:{t2["y"] - 2}px; width:{t2["w"] + 4}px; height:{t2["h"] + 4}px; background:#F6F2EA; opacity:0"></div>'
            + f'<div id="g6ok" style="position:absolute; left:{in2["x"]}px; top:{in2["y"] + in2["h"] + 8}px; font-size:14px; color:#23704A; opacity:0">Dilepas. Alasanmu tercatat di slip.</div>'
            + f'</div></div><div class="kursor" id="kur6">{KURSOR}</div></div>')
    f.adegan("b6", T6, T6 + D[6], isi6, z=6)
    f.add(f'tl.set("#k6-c", {{opacity: 1}}, {T6 + 0.2});')
    T6a = s6 + 0.8
    f.add(f'tl.set("#b6t", {{opacity: 0}}, {T6a:.3f});')
    f.add(f'tl.set("#b6k", {{opacity: 1}}, {T6a:.3f});')
    # A: ringkasan draf disorot
    f.add(f'tl.fromTo("#g6s1", {{scaleX: 0}}, {{scaleX: 1, duration: 0.45, ease: "power2.out"}}, {T6a + 0.6:.3f});')
    # B: dorong 1,35x ke nama yang ditahan + alasannya (TEKAN 14 bingkai), tahan, lalu tarik mundur
    bx6, by6 = gp({"x": al1["x"], "y": t1["y"], "w": al1["w"], "h": al1["y"] + al1["h"] - t1["y"]}, GULIR[0])
    T6b = T6a + 2.2
    f.add(f'tl.to("#b6k", {{**{json.dumps(kamera(bx6, by6, 1.35))}, duration: {14 / FPS:.3f}, ease: TEKAN}}, {T6b:.3f});'.replace('{**{', '{').replace('}, duration', ', duration'))
    f.add(f'tl.fromTo("#g6k", {{opacity: 0, scale: 1.03}}, {{opacity: 1, scale: 1, duration: 0.2, ease: "power2.out"}}, {T6b + 0.5:.3f});')
    f.add(f'tl.to("#b6k", {{x: 0, y: 0, scale: 1, duration: {44 / FPS:.3f}, ease: MUNDUR}}, {T6b + 3.0:.3f});')
    # C: gulir ke rincian, BPJS dan PPh 21 disorot
    T6c = T6b + 4.6
    f.add(f'tl.to("#g6", {{y: {-(GULIR[1] - GULIR[0]) * S6:.1f}, duration: 0.9, ease: TEKAN}}, {T6c:.3f});')
    f.add(f'tl.fromTo("#g6s2", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {T6c + 1.0:.3f});')
    f.add(f'tl.fromTo("#g6s3", {{scaleX: 0}}, {{scaleX: 1, duration: 0.4, ease: "power2.out"}}, {T6c + 1.5:.3f});')
    # D: gulir ke Rina, ketik alasan melepas, klik Lepas, lencana Ditahan hilang, pesan asli muncul
    T6d = T6c + 3.6
    f.add(f'tl.to("#g6", {{y: {-(GULIR[2] - GULIR[0]) * S6:.1f}, duration: 0.9, ease: TEKAN}}, {T6d:.3f});')
    tk = T6d + 1.1
    teks = "Sudah dicek, Rina jaga kasir tiap hari"
    for i in range(len(teks)):
        f.add(f'tl.set("#k6a-{i}", {{display: "inline"}}, {tk + i / 24:.3f});')
    f.add(f'tl.set("#k6a-c", {{opacity: 1}}, {tk:.3f});')
    f.add(f'tl.set("#k6a-c", {{opacity: 0}}, {tk + len(teks) / 24 + 0.3:.3f});')
    lx6, ly6 = gp(lp2, GULIR[2])
    TK6 = tk + len(teks) / 24 + 1.1
    f.add(f'tl.fromTo("#kur6", {{x: {round(lx6 + 380)}, y: {round(ly6 + 300)}, opacity: 0}}, {{x: {round(lx6 - 10)}, y: {round(ly6 - 8)}, opacity: 1, duration: 0.8, ease: TEKAN}}, {TK6 - 0.9:.3f});')
    f.add(f'tl.to("#kur6", {{scale: 0.88, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "15% 10%"}}, {TK6:.3f});')
    f.add(f'tl.set("#g6tt", {{opacity: 1}}, {TK6 + 0.35:.3f});')
    f.add(f'tl.fromTo("#g6ok", {{opacity: 0, y: -6}}, {{opacity: 1, y: 0, duration: 0.25, ease: "power2.out"}}, {TK6 + 0.4:.3f});')
    f.add(f'tl.to("#kur6", {{opacity: 0, duration: 0.3}}, {TK6 + 0.9:.3f});')

    durasi = TOTAL
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
