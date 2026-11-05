# D-28: film promo Nadi dari DOM ASLI aplikasi (usaha contoh "Toko Bu Sari", akun uji B, produksi; /demo untuk Sarapan Data).
# Antarmuka tidak digambar ulang: potongan HTML + CSS aplikasi dari apps/web/scripts/promo-dom.mjs, posisi tombol/baris dari
# ukur.json (ukur.mjs). Kamera mendorong ke bagian yang sedang bekerja, kursor mengklik, keterangan satu per langkah.
# Pedoman: skill video-produksi references/code-rendered-product-films.md (Okt 2026) dan hyperframes types/launch.md, motion.md.
# Musik "Funk in my Pocket" (OptiKill, CC BY 3.0) 129,2 BPM; potongan di garis bar. Jalankan dari folder ini: python -I buat.py
import json
import os
import re

AKAR = os.path.dirname(os.path.abspath(__file__))
BAR = 4 * 60 / 129.2
KET = BAR / 4
W, H = 1920, 1080
U = json.load(open(os.path.join(AKAR, "ukur.json"), encoding="utf8"))
KREDIT = "Musik: Funk in my Pocket oleh OptiKill (CC BY 3.0)"


def frag(nama):
    """Potongan DOM asli: id dibuang (unik per halaman), body jadi div; teks dan kelas tidak diubah."""
    h = open(os.path.join(AKAR, "assets", "app", f"{nama}.html"), encoding="utf8").read()
    h = re.sub(r'\sid="[^"]*"', "", h)
    h = re.sub(r"<body([^>]*)>", r"<div\1>", h).replace("</body>", "</div>")
    return f'<div class="app" style="width:{U[nama]["lebar"]}px">{h}</div>'


def pusat(r):
    return r["x"] + r["w"] / 2, r["y"] + r["h"] / 2


def kamera(cx, cy, s, fx=W / 2, fy=H / 2):
    """Transform pembungkus (asal 0,0) agar titik (cx, cy) potongan berada di (fx, fy) bingkai pada skala s."""
    return {"x": round(fx - cx * s, 1), "y": round(fy - cy * s, 1), "scale": s}


CSS = """
@font-face { font-family: Papan; src: url(assets/fonts/bigshoulders.woff2) format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #F6F2EA; }
#root { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #F6F2EA; font-family: var(--font-jakarta), sans-serif; color: #1C1B18; }
.clip { position: absolute; inset: 0; overflow: hidden; }
.lantai { position: absolute; inset: 0; background: #F6F2EA; }
.kam { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.app { background: #F6F2EA; }
/* bilah navigasi bawah aplikasi (sticky) tidak dibawa ke film: di dalam pembungkus bertransformasi ia mengambang di tengah bingkai */
.app nav[aria-label="Navigasi utama"], .app .fixed { display: none !important; }
.berkas { position: absolute; left: 0; top: 0; background: #FFFDF8; border-radius: 10px; box-shadow: 0 10px 30px rgba(28,27,24,0.18); overflow: hidden; }
.berkas img { display: block; width: 100%; }
.csv { padding: 22px 24px; font-family: var(--font-plex-mono), monospace; font-size: 17px; line-height: 1.55; color: #1C1B18; white-space: pre; }
.ket { position: absolute; left: 120px; bottom: 80px; max-width: 1280px; padding: 18px 30px 20px; background: #F6F2EA; border-radius: 16px; box-shadow: 0 8px 28px rgba(28,27,24,0.16); font-size: 50px; font-weight: 800; line-height: 1.14; letter-spacing: -0.01em; color: #1C1B18; }
.ket span { display: inline-block; margin-right: 0.24em; }
.ket .s { background: #E9A825; padding: 0 0.12em; border-radius: 6px; }
.kursor { position: absolute; left: 0; top: 0; width: 84px; height: 84px; z-index: 40; }
.akhir-garis { font-size: 60px; font-weight: 800; letter-spacing: -0.01em; }
"""

KURSOR = ('<svg class="kursor" id="kur" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 2l18 12-8 1.5 4.5 8.5-3.5 1.8-4.5-8.6L4 23z" '
          'fill="#1C1B18" stroke="#FFFDF8" stroke-width="2" stroke-linejoin="round"/></svg>')


class Film:
    def __init__(self):
        self.klip, self.tw, self.sfx = [], [], []
        self.n = 0

    def t(self, bar, ket=0.0):
        return round(bar * BAR + ket * KET, 3)

    def adegan(self, sid, b0, b1, isi, z=1):
        mulai, lama = self.t(b0), round(self.t(b1) - self.t(b0), 3)
        self.klip.append(f'<section id="{sid}" class="clip" data-start="{mulai}" data-duration="{lama}" data-track-index="1" style="z-index:{z}">'
                         f'<div class="lantai"></div>{isi}</section>')
        return mulai

    def ket(self, kid, t0, t1, teks, sorot=()):
        """Keterangan per kata: blur 6 px -> 0 dan 0 -> 1, 0,067 dtk antar kata; keluar blur + pudar 0,2 dtk."""
        kata = teks.split(" ")
        isi = "".join(f'<span id="{kid}-{i}" class="{"s" if i in sorot else ""}">{k}</span>' for i, k in enumerate(kata))
        self.klip.append(f'<div id="{kid}" class="clip" data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-track-index="3" style="z-index:30">'
                         f'<div class="ket">{isi}</div></div>')
        for i in range(len(kata)):
            self.fr(f"#{kid}-{i}", {"opacity": 0, "filter": "blur(6px)"}, {"opacity": 1, "filter": "blur(0px)"}, t0 + 0.05 + i * 0.067, 0.13, "power2.out")
        self.to(f"#{kid} .ket", {"opacity": 0, "filter": "blur(8px)"}, t1 - 0.22, 0.2, "power2.in")

    def fr(self, sel, a, b, t, lama, ease="power3.out"):
        self.tw.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps({**b, "duration": round(lama, 3), "ease": ease})}, {round(t, 3)});')

    def to(self, sel, b, t, lama, ease="power2.inOut"):
        self.tw.append(f'tl.to("{sel}", {json.dumps({**b, "duration": round(lama, 3), "ease": ease})}, {round(t, 3)});')

    def set(self, sel, b, t):
        self.tw.append(f'tl.set("{sel}", {json.dumps(b)}, {round(t, 3)});')

    def klik(self, t):
        self.to("#kur", {"scale": 0.82}, t - 0.06, 0.06, "power2.in")
        self.to("#kur", {"scale": 1}, t, 0.14, "power2.out")
        self.sfx.append([round(t, 3), "klik"])

    def kursor(self, x, y, t, lama=0.5):
        # ujung panah ada di sudut kiri atas svg
        self.to("#kur", {"x": round(x - 10), "y": round(y - 6)}, t, lama, "power3.inOut")


def bangun():
    f = Film()
    k = KET

    # 1. Kait (0-2 bar): foto nota asli berubah menjadi kartu usulan asli, langsung di 2 detik pertama.
    kn = U["kartu-nota"]
    s_k = 2.3
    isi = (f'<div class="kam" id="s1-k">{frag("kartu-nota")}</div>'
           '<div class="berkas" id="s1-n" style="width:420px"><img src="assets/berkas/nota.png" alt=""></div>')
    t0 = f.adegan("s1", 0, 2, isi)
    f.set("#s1-k", {**kamera(kn["lebar"] / 2, kn["tinggi"] / 2, s_k), "opacity": 0, "filter": "blur(10px)"}, 0)
    f.fr("#s1-n", {"x": 750, "y": 1100, "rotation": 8, "scale": 1}, {"x": 750, "y": 330, "rotation": -3, "scale": 1}, t0 + 0.05, 0.55, "expo.out")
    # morf: nota menyusut dan kabur ke tengah, kartu usulan tumbuh dari situ
    f.to("#s1-n", {"scale": 0.4, "x": 870, "y": 440, "opacity": 0, "filter": "blur(12px)", "rotation": 0}, t0 + 0.85, 0.3, "power3.in")
    f.to("#s1-k", {"opacity": 1, "filter": "blur(0px)"}, t0 + 0.95, 0.25, "power3.out")
    f.sfx.append([round(t0 + 0.95, 3), "cetak"])
    f.ket("k1", t0 + 1.2, f.t(2) - 0.05, "Foto nota jadi usulan.", sorot=(2,))

    # 2. Berkas asli berserakan (2-4 bar).
    berkas = [("nota.png", 380, 120, 300, -9), ("invoice.png", 300, 760, 150, 6), ("absen.png", 330, 1170, 120, -4), ("slip.png", 300, 1480, 210, 8)]
    isi = "".join(f'<div class="berkas" id="s2-b{i}" style="width:{w}px"><img src="assets/berkas/{n}" alt=""></div>' for i, (n, w, _, _, _) in enumerate(berkas))
    csv = open(os.path.join(AKAR, "..", "..", "..", "fixtures", "korpus", "mutasi", "mutasi-01.csv"), encoding="utf8").read().splitlines()[:7]
    isi += f'<div class="berkas csv" id="s2-b4">{chr(10).join(l[:44] for l in csv)}</div>'
    t0 = f.adegan("s2", 2, 4, isi)
    letak = [(x, y, r) for (_, _, x, y, r) in berkas] + [(980, 560, -5)]
    for i, (x, y, r) in enumerate(letak):
        f.fr(f"#s2-b{i}", {"x": x + (300 if i % 2 else -300), "y": y + 900, "rotation": r * 3, "opacity": 1},
             {"x": x, "y": y, "rotation": r}, t0 + 0.05 + i * 0.12, 0.7, "back.out(1.3)")
        f.sfx.append([round(t0 + 0.2 + i * 0.12, 3), "taruh"])
    f.ket("k2", t0 + 0.6, f.t(4) - 0.55, "Nota, tagihan, absen, mutasi, slip. Menumpuk tiap hari.", sorot=(5, 6))
    # bawa: semua berkas melesat ke tengah atas (area Lempar di adegan 3) sambil mengecil
    for i in range(5):
        f.to(f"#s2-b{i}", {"x": 860, "y": 300, "scale": 0.25, "rotation": 0, "filter": "blur(6px)"}, f.t(4) - 0.5 + i * 0.04, 0.42, "power3.in")

    # 3. Lempar (4-10 bar): berkas jatuh ke area asli -> sedang membaca -> siap.
    lk, lm, ls = U["lempar-kosong"], U["lempar-membaca"], U["lempar-siap"]
    isi = (f'<div class="kam" id="s3-a">{frag("lempar-kosong")}</div>'
           f'<div class="kam" id="s3-m" style="opacity:0">{frag("lempar-membaca")}</div>'
           f'<div class="kam" id="s3-s" style="opacity:0">{frag("lempar-siap")}</div>'
           + "".join(f'<div class="berkas" id="s3-b{i}" style="width:150px; opacity:0"><img src="assets/berkas/{n}" alt=""></div>'
                     for i, n in enumerate(["nota.png", "invoice.png", "absen.png", "slip.png", "invoice.png"])))
    t0 = f.adegan("s3", 4, 10, isi)
    ax, ay = pusat(lk["area"])
    s_a = 2.15
    f.set("#s3-a", kamera(ax, ay - 70, s_a), t0)
    f.fr("#s3-a", {"scale": s_a * 1.06}, {"scale": s_a}, t0, 0.5, "expo.out")
    area = "#s3-a [data-testid=area-lempar]"
    f.to(area, {"backgroundColor": "#FFF3D1", "borderColor": "#E9A825"}, t0 + 0.1, 0.2, "power2.out")
    for i in range(5):
        tt = t0 + 0.15 + i * 0.16
        f.fr(f"#s3-b{i}", {"x": 885 + (i - 2) * 30, "y": 280, "opacity": 1, "scale": 1.2, "rotation": (i - 2) * 6},
             {"y": 620, "scale": 0.5, "opacity": 0, "rotation": 0}, tt, 0.4, "power3.in")
        f.sfx.append([round(tt + 0.38, 3), "taruh"])
    f.ket("k3", t0 + 0.5, t0 + 4.6, "Lempar apa saja ke Nadi.", sorot=(2,))
    # potong pada pantulan taruh: daftar baca asli, sedikit besar lalu mantap
    tc = t0 + 1.3
    dx, dy = pusat(lm["daftar"])
    s_m = 1.7
    f.set("#s3-a", {"opacity": 0}, tc)
    f.set("#s3-m", {**kamera(dx, lm["daftar"]["y"] + 230, s_m * 1.05), "opacity": 1}, tc)
    f.to("#s3-m", kamera(dx, lm["daftar"]["y"] + 230, s_m), tc, 0.5, "expo.out")
    f.sfx.append([round(tc, 3), "sapu"])
    # tukar blur ke keadaan siap (kartu usulan asli tampil di bawah tiap berkas)
    tsw = t0 + 4.3
    f.set("#s3-s", kamera(dx, lm["daftar"]["y"] + 230, s_m), tsw)
    f.to("#s3-m", {"opacity": 0, "filter": "blur(8px)"}, tsw, 0.18, "power2.in")
    f.fr("#s3-s", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)"}, tsw + 0.05, 0.16, "power2.out")
    f.sfx.append([round(tsw + 0.05, 3), "cetak"])
    f.ket("k4", tsw + 0.3, f.t(10) - 0.6, "Nadi membaca semuanya. Lima berkas, lima usulan.", sorot=(5, 6))
    # kamera turun menyusuri lima usulan, lalu ke tautan Lihat di Feed
    ky = ls["kefeed"]["y"]
    f.to("#s3-s", kamera(dx, ky - 110, 1.8), tsw + 0.9, f.t(10) - tsw - 2.0, "power2.inOut")
    fx, fy = pusat(ls["kefeed"])
    tkl = f.t(10) - 0.5
    # posisi tautan di bingkai pada kamera akhir
    kx, kyb = kamera(dx, ky - 110, 1.8)["x"], kamera(dx, ky - 110, 1.8)["y"]
    lx, ly = kx + fx * 1.8, kyb + fy * 1.8
    f.set("#kur", {"x": 2000, "y": 1100}, 0)
    f.kursor(lx, ly, tkl - 0.7, 0.6)
    f.klik(tkl)

    # 4. Feed (10-13 bar): menembus tautan ke Feed asli, dorong ke kartu nota, Setujui -> dicap.
    fe = U["feed"]
    nx, ny = pusat(fe["nota"])
    s_f = 1.9
    dc = U["kartu-nota-dicap"]
    isi = (f'<div class="kam" id="s4-f">{frag("feed")}</div>'
           f'<div class="kam" id="s4-d" style="opacity:0">{frag("kartu-nota-dicap")}</div>')
    t0 = f.adegan("s4", 10, 13, isi)
    # masuk: Feed lebar penuh (konteks), lalu dorong ke kartu nota
    f.set("#s4-f", kamera(720, 520, 1.3), t0)
    f.fr("#s4-f", {"scale": 2.6, "filter": "blur(14px)"}, {"scale": 1.3, "filter": "blur(0px)"}, t0, 0.35, "power3.out")
    f.to("#s4-f", kamera(nx, ny, s_f), t0 + 0.9, 0.6, "power2.inOut")
    sx, sy = pusat(fe["setujui"])
    cam = kamera(nx, ny, s_f)
    bx, by = cam["x"] + sx * s_f, cam["y"] + sy * s_f
    f.kursor(bx, by, t0 + 1.4, 0.55)
    f.ket("k5", t0 + 1.0, f.t(13) - 0.1, "Kamu yang memutuskan.", sorot=(2,))
    tsj = t0 + 2.4
    f.klik(tsj)
    # keadaan asli setelah disetujui: kartu menyusut menjadi baris bercap DITERIMA
    f.set("#s4-d", {**kamera(dc["lebar"] / 2, dc["tinggi"] / 2, 2.5, W / 2, 440), "opacity": 0}, tsj)
    f.to("#s4-f", {"opacity": 0, "filter": "blur(8px)"}, tsj + 0.1, 0.18, "power2.in")
    f.fr("#s4-d", {"opacity": 0, "scale": 2.8}, {"opacity": 1, "scale": 2.5}, tsj + 0.15, 0.35, "back.out(1.6)")
    f.sfx.append([round(tsj + 0.2, 3), "cap"])

    # 5. Tagihan (13-17 bar): iris dari titik klik ke halaman tagihan publik asli, Total lalu QRIS.
    ip = U["invoice-publik"]
    isi = f'<div class="kam" id="s5-i">{frag("invoice-publik")}</div>'
    t0 = f.adegan("s5", 13, 17, isi, z=2)
    hx, hy = pusat(ip["kepala"])
    f.set("#s5-i", kamera(256, hy + 120, 2.0), t0)
    f.fr("#s5", {"clipPath": f"circle(0px at {bx:.0f}px {by:.0f}px)"}, {"clipPath": f"circle(2300px at {bx:.0f}px {by:.0f}px)"}, t0, 0.45, "power3.in")
    f.sfx.append([round(t0, 3), "sapu"])
    f.to("#kur", {"x": 2000, "y": 1100}, t0, 0.4, "power3.in")
    tx, ty = pusat(ip["total"])
    f.to("#s5-i", kamera(256, ty - 60, 2.0), t0 + 1.6, 0.6, "power2.inOut")
    f.ket("k6", t0 + 0.8, t0 + 3.6, "Tagihan terbit dengan nomor sendiri.", sorot=(4,))
    qx, qy = pusat(ip["qris"])
    f.to("#s5-i", kamera(qx, qy, 2.5, W / 2, 470), t0 + 3.6, 0.6, "power2.inOut")
    f.ket("k7", t0 + 4.0, f.t(17) - 0.1, "Pelanggan bayar lewat QRIS milikmu.", sorot=(3,))

    # 6. Mata (17-21 bar): peta panas asli terisi zona demi zona, angka kunjungan naik ke 177.
    pp = U["peta-panas"]
    isi = f'<div class="kam" id="s6-p">{frag("peta-panas")}</div>'
    t0 = f.adegan("s6", 17, 21, isi, z=3)
    f.fr("#s6", {"y": 1080}, {"y": 0}, t0, 0.45, "power4.out")
    f.sfx.append([round(t0, 3), "sapu"])
    sx2, sy2 = pusat(pp["svg"])
    f.set("#s6-p", kamera(sx2, sy2 - 90, 1.55, W / 2, 470), t0)
    f.tw.append(f'tl.from("#s6 polygon", {{attr: {{"fill-opacity": 0}}, duration: 1.6, ease: "power1.in", stagger: 0.25}}, {round(t0 + 0.4, 3)});')
    for j, n in enumerate([0, 19, 46, 83, 117, 142, 161, 177]):
        tt = t0 + 0.4 + j * 0.28
        f.set("#s6 [data-testid=panas-jumlah]", {"textContent": str(n)}, tt)
        if j:
            f.sfx.append([round(tt, 3), "tik"])
    f.ket("k8", t0 + 0.6, t0 + 3.6, "Kamera atas menghitung kunjungan.", sorot=(2,))
    zx, zy = pusat(pp["antrean"])
    f.to("#s6-p", kamera(zx, zy, 2.3, W / 2, 470), t0 + 3.7, 0.6, "power2.inOut")
    f.ket("k9", t0 + 4.1, f.t(21) - 0.1, "Ternyata antrean yang paling lama.", sorot=(1,))

    # 7. Sarapan Data (21-24 bar): kalimat insight asli muncul per kata dari abu ke tinta.
    sp = U["sarapan"]
    isi = f'<div class="kam" id="s7-s">{frag("sarapan")}</div>'
    t0 = f.adegan("s7", 21, 24, isi, z=4)
    f.fr("#s7", {"backgroundColor": "#1C1B18"}, {"backgroundColor": "#F6F2EA"}, t0, 0.4, "power2.inOut")
    s1x, s1y = pusat(sp["satu"])
    f.set("#s7-s", kamera(sp["lebar"] / 2, s1y, 2.2), t0)
    f.fr("#s7-s", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)"}, t0 + 0.1, 0.2, "power2.out")
    f.ket("k10", t0 + 0.9, f.t(24) - 0.1, "Pagi hari, yang berdampak rupiah saja.", sorot=(4,))

    # 8. Kartu akhir (24-27 bar): logo Nadi asli di tengah, satu kalimat, alamat tenang.
    logo = re.search(r'<svg[^>]*aria-label="Nadi".*?</svg>', open(os.path.join(AKAR, "assets", "app", "feed.html"), encoding="utf8").read(), re.S).group(0)
    logo = re.sub(r'width="\d+" height="\d+"', 'width="300" height="300"', logo, count=1)
    isi = (f'<div id="s8-l" style="position:absolute; left:810px; top:250px; width:300px; height:300px">{logo}</div>'
           '<div id="s8-g" class="akhir-garis" style="position:absolute; left:0; right:0; top:600px; text-align:center">Coba usaha contohnya.</div>'
           '<div id="s8-u" style="position:absolute; left:0; right:0; top:700px; text-align:center; font-size:36px; color:#5B574F; font-weight:600">nadi-swart.vercel.app/demo</div>'
           f'<div style="position:absolute; left:0; right:0; bottom:60px; text-align:center; font-size:22px; color:#5B574F">{KREDIT}</div>')
    t0 = f.adegan("s8", 24, 27, isi, z=5)
    f.fr("#s8", {"clipPath": "inset(50% 0% 50% 0%)"}, {"clipPath": "inset(0% 0% 0% 0%)"}, t0, 0.4, "power3.out")
    f.fr("#s8-l", {"scale": 0.6, "opacity": 0}, {"scale": 1, "opacity": 1}, t0 + 0.2, 0.6, "back.out(1.4)")
    f.sfx.append([round(t0 + 0.25, 3), "cap"])
    f.fr("#s8-g", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)"}, t0 + 0.8, 0.2, "power2.out")
    f.fr("#s8-u", {"opacity": 0}, {"opacity": 1}, t0 + 1.2, 0.3, "power2.out")

    durasi = f.t(27)
    html = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>Nadi promo</title>
<link rel="stylesheet" href="assets/app/app.css" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{CSS}</style>
</head>
<body>
<div id="root" data-composition-id="promo" data-start="0" data-width="1920" data-height="1080" data-duration="{durasi}" data-fps="30">
{chr(10).join(f.klip)}
<div id="lapis-kursor" class="clip" data-start="0" data-duration="{durasi}" data-track-index="4" style="z-index:50">{KURSOR}</div>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(f.tw)}
window.__timelines["promo"] = tl;
</script>
</body>
</html>
"""
    open(os.path.join(AKAR, "index.html"), "w", encoding="utf-8", newline="\n").write(html)
    os.makedirs(os.path.join(AKAR, "sfx"), exist_ok=True)
    json.dump({"durasi": durasi, "bar": BAR, "sfx": sorted(f.sfx)}, open(os.path.join(AKAR, "sfx", "index.json"), "w"), indent=1)
    print("durasi", durasi)


if __name__ == "__main__":
    bangun()
