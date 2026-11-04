# Menyusun komposisi HyperFrames untuk video promo Nadi dari layar asli produksi (assets/layar, assets/layar-hp).
# F6-06 index.html (16:9, 46 dtk), P-01 teaser.html (9:16, 15 dtk), P-02 fitur-*.html (9:16, 22 dtk).
# Jalankan: python -I buat.py (dari folder ini). Potongan gambar ditulis ke assets/potong/.
import os

from PIL import Image

AKAR = os.path.dirname(os.path.abspath(__file__))
URL = "nadi-swart.vercel.app/demo"


def potong():
    d = os.path.join(AKAR, "assets", "potong")
    os.makedirs(d, exist_ok=True)
    hp = Image.open(os.path.join(AKAR, "assets", "layar-hp", "landing.png"))
    hp.crop((60, 686, 1112, 1552)).save(os.path.join(d, "nota.png"))
    hp.crop((60, 1537, 1112, 2105)).save(os.path.join(d, "kartu.png"))
    # layar Mata HP: nav bawah ikut terpotret di tengah, jadi diambil dua potongan (video + zona, dan log perubahan)
    m = Image.open(os.path.join(AKAR, "assets", "layar-hp", "mata.png"))
    m.crop((40, 920, m.width - 40, 1720)).save(os.path.join(d, "mata-atas.png"))
    m.crop((40, 3680, m.width - 40, 4560)).save(os.path.join(d, "mata-log.png"))


CSS = """
@font-face { font-family: Jakarta; src: url(assets/fonts/jakarta.woff2) format("woff2"); font-weight: 200 800; }
@font-face { font-family: Bricolage; src: url(assets/fonts/bricolage.woff2) format("woff2"); font-weight: 200 800; }
@font-face { font-family: PlexMono; src: url(assets/fonts/plexmono.woff2) format("woff2"); font-weight: 500; }
:root { --kertas: #F6F2EA; --kertas-2: #EFE9DD; --tinta: #1C1B18; --tinta-2: #5B574F; --garis: #DDD5C6; --kunyit: #E9A825; --cap: #B4372A; --daun: #23704A; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; background: var(--kertas); }
#root { position: relative; overflow: hidden; font-family: Jakarta, sans-serif; color: var(--tinta); }
.latar { position: absolute; inset: 0; background: var(--kertas); }
.clip { position: absolute; inset: 0; }
.isi { position: absolute; }
.judul { font-family: Bricolage, sans-serif; font-weight: 800; letter-spacing: -0.025em; line-height: 1.04; }
.sorot { background: var(--kunyit); padding: 0 0.12em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.teks { font-weight: 500; line-height: 1.32; color: var(--tinta-2); }
.kartu { position: absolute; border-radius: 10px; overflow: hidden; background: var(--kertas); border: 2px solid var(--garis); box-shadow: 0 2px 0 var(--garis); }
.kartu img { display: block; width: 100%; height: auto; }
.tutup { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: var(--kertas); }
.cap { position: absolute; border: 6px solid var(--cap); color: var(--cap); font-weight: 800; letter-spacing: 0.08em; border-radius: 10px; padding: 0.1em 0.4em; transform: rotate(-7deg); background: rgba(246,242,234,0.9); }
.cap-daun { border-color: var(--daun); color: var(--daun); }
.kertas-lepas { position: absolute; background: #FBF8F2; border: 2px solid var(--garis); border-radius: 6px; padding: 22px 26px; font-family: PlexMono, monospace; font-weight: 500; color: var(--tinta); line-height: 1.5; box-shadow: 0 3px 0 var(--garis); }
.kertas-lepas b { display: block; font-family: Jakarta, sans-serif; font-weight: 800; margin-bottom: 8px; }
.logo { display: block; }
.alamat { font-family: PlexMono, monospace; font-weight: 500; color: var(--tinta); border-bottom: 6px solid var(--kunyit); display: inline-block; }
"""

LOGO = """<svg class="logo" viewBox="0 0 64 64" width="{s}" height="{s}" aria-hidden="true"><path d="M10 54V22c0-8 6-13 14-13h8c8 0 14 5 14 13v32l-4-3-4 3-4-3-4 3V24c0-3-2-5-5-5h-2c-3 0-5 2-5 5v30l-4-3z" fill="#1C1B18"/><circle cx="52" cy="10" r="5.5" fill="#E9A825"/></svg>"""

SLIP = [
    ("NOTA", "UD Sumber Rejeki<br>Tepung 6 x 13.500<br>TOTAL 376.500"),
    ("ABSEN", "Sen  Komang  07.58<br>Sel  Komang  --.--<br>Rab  Wayan   08.12"),
    ("SLIP GAJI", "Oktober 2026<br>Pokok 2.900.000<br>Lembur ?"),
    ("TAGIHAN", "Bu Rina, arisan RT 03<br>30 nasi kotak<br>Rp750.000 belum"),
]


class Film:
    def __init__(self, cid, w, h, durasi):
        self.cid, self.w, self.h, self.durasi = cid, w, h, durasi
        self.adegan, self.tween, self.n = [], [], 0

    def id(self, awal):
        self.n += 1
        return f"{awal}{self.n}"

    def tambah(self, mulai, lama, isi, keluar=True):
        sid = self.id("adegan")
        self.adegan.append(f'<section id="{sid}" class="clip" data-start="{mulai}" data-duration="{lama}" data-track-index="1">{isi}</section>')
        if keluar:
            self.tween.append(f'tl.to("#{sid} .isi, #{sid} .kartu, #{sid} .kertas-lepas", {{opacity: 0, duration: 0.3, ease: "power2.in"}}, {mulai + lama - 0.32});')
        return sid

    def masuk(self, sel, t, dari="y: 40", lama=0.5):
        self.tween.append(f'tl.fromTo("{sel}", {{opacity: 0, {dari}}}, {{opacity: 1, {dari.split(":")[0]}: 0, duration: {lama}, ease: "power3.out"}}, {t});')

    def html(self):
        return f"""<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width={self.w}, height={self.h}" />
<title>Nadi {self.cid}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{CSS}
html, body {{ width: {self.w}px; height: {self.h}px; }}
#root {{ width: {self.w}px; height: {self.h}px; }}
</style>
</head>
<body>
<div id="root" data-composition-id="{self.cid}" data-start="0" data-width="{self.w}" data-height="{self.h}" data-duration="{self.durasi}" data-fps="30">
<div class="latar"></div>
{chr(10).join(self.adegan)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(self.tween)}
window.__timelines["{self.cid}"] = tl;
</script>
</body>
</html>
"""

    def tulis(self, nama):
        # hanya satu komposisi akar per proyek (aturan check): varian lain di folder varian/ dengan jalur aset ../
        if nama == "index.html":
            teks, jalur = self.html(), os.path.join(AKAR, nama)
        else:
            os.makedirs(os.path.join(AKAR, "varian"), exist_ok=True)
            teks, jalur = self.html().replace("assets/", "../assets/"), os.path.join(AKAR, "varian", nama)
        open(jalur, "w", encoding="utf-8", newline="\n").write(teks)


# ---------- adegan yang dipakai ulang ----------

def berserakan(f, mulai, lama, judul, sub, tegak):
    sid = f"b{f.n + 1}"
    letak = ([(70, 300, -8), (560, 180, 6), (130, 1130, 5), (590, 1010, -6)] if tegak
             else [(980, 120, -7), (1440, 170, 6), (1060, 560, 5), (1480, 610, -5)])
    fs = 30 if tegak else 28
    kertas = "".join(
        f'<div id="{sid}-k{i}" class="kertas-lepas" style="left:{x}px; top:{y}px; width:{430 if tegak else 400}px; font-size:{fs}px; transform: rotate({r}deg)"><b>{a}</b>{b}</div>'
        for i, ((a, b), (x, y, r)) in enumerate(zip(SLIP, letak)))
    if tegak:
        teks = f'<div id="{sid}-t" class="isi" style="left:70px; right:70px; top:1560px"><div class="judul" style="font-size:96px">{judul}</div><div class="teks" style="font-size:44px; margin-top:28px">{sub}</div></div>'
    else:
        teks = f'<div id="{sid}-t" class="isi" style="left:120px; top:330px; width:780px"><div class="judul" style="font-size:96px">{judul}</div><div class="teks" style="font-size:40px; margin-top:28px">{sub}</div></div>'
    f.tambah(mulai, lama, kertas + teks)
    for i in range(4):
        f.tween.append(f'tl.fromTo("#{sid}-k{i}", {{opacity: 0, y: -120, rotation: {(-1) ** i * 14}}}, {{opacity: 1, y: 0, rotation: {letak[i][2]}, duration: 0.55, ease: "power2.out"}}, {mulai + 0.15 + i * 0.22});')
    f.masuk(f"#{sid}-t", mulai + 0.9)


def akhir(f, mulai, lama, tegak):
    sid = f"a{f.n + 1}"
    besar = 150 if tegak else 120
    isi = (f'<div id="{sid}-t" class="isi" style="left:{90 if tegak else 160}px; top:{760 if tegak else 250}px; width:{900 if tegak else 1600}px">'
           f'<div style="display:flex; align-items:center; gap:28px">{LOGO.format(s=besar)}<span class="judul" style="font-size:{besar}px">nadi</span></div>'
           f'<div class="judul" style="font-size:{84 if tegak else 88}px; margin-top:60px">Coba usaha contohnya. <span class="sorot">Tanpa daftar.</span></div>'
           f'<div class="alamat" style="font-size:{52 if tegak else 56}px; margin-top:56px">{URL}</div></div>')
    f.tambah(mulai, lama, isi, keluar=False)
    f.masuk(f"#{sid}-t", mulai + 0.2, lama=0.6)


def layar(f, mulai, lama, gambar, kotak, judul, sub, teks_kotak, geser=0, cap=None, cetak=False, susul=None):
    """Satu layar asli Nadi dalam kartu + judul. kotak = (x, y, lebar). geser = piksel isi digulir ke atas (pan).
    cap = (teks, x, y, ukuran, daun?) dicap di atas kartu. cetak = gambar muncul baris demi baris dari atas.
    susul = (gambar, kotak, t) kartu kedua yang menyusul."""
    sid = f"l{f.n + 1}"
    x, y, w = kotak[:3]
    tinggi = f'height:{kotak[3]}px;' if len(kotak) > 3 else ""
    # gulir hanya sejauh sisa gambar di bawah kartu (tanpa ruang kosong)
    gw, gh = Image.open(os.path.join(AKAR, gambar)).size
    geser = max(0, round(gh * w / gw - kotak[3]) - 4) if len(kotak) > 3 else 0
    isi = f'<div id="{sid}-c" class="kartu" style="left:{x}px; top:{y}px; width:{w}px; {tinggi}"><img id="{sid}-g" src="{gambar}" alt="" />'
    if cetak:
        isi += f'<div id="{sid}-tutup" class="tutup"></div>'
    isi += "</div>"
    if susul:
        g2, (x2, y2, w2), _ = susul
        isi += f'<div id="{sid}-c2" class="kartu" style="left:{x2}px; top:{y2}px; width:{w2}px"><img src="{g2}" alt="" /></div>'
    if cap:
        t, cx, cy, ukuran, daun = cap
        isi += f'<div id="{sid}-cap" class="cap{" cap-daun" if daun else ""}" style="left:{cx}px; top:{cy}px; font-size:{ukuran}px">{t}</div>'
    tx, ty, tw = teks_kotak[:3]
    isi += f'<div id="{sid}-t" class="isi" style="left:{tx}px; top:{ty}px; width:{tw}px"><div class="judul" style="font-size:{teks_kotak[4] if len(teks_kotak) > 4 else 80}px">{judul}</div>'
    if sub:
        isi += f'<div class="teks" style="font-size:{teks_kotak[5] if len(teks_kotak) > 5 else 38}px; margin-top:26px">{sub}</div>'
    isi += "</div>"
    f.tambah(mulai, lama, isi)
    f.masuk(f"#{sid}-t", mulai + 0.1)
    f.masuk(f"#{sid}-c", mulai + 0.3, dari="y: 60", lama=0.6)
    if cetak:
        f.tween.append(f'tl.fromTo("#{sid}-tutup", {{yPercent: 0}}, {{yPercent: 100, duration: 1.8, ease: "steps(9)"}}, {mulai + 0.9});')
    if geser:
        f.tween.append(f'tl.fromTo("#{sid}-g", {{y: 0}}, {{y: {-geser}, duration: {max(lama - 2.4, 1)}, ease: "power1.inOut"}}, {mulai + 1.4});')
    if susul:
        f.masuk(f"#{sid}-c2", susul[2], dari="y: 80", lama=0.6)
    if cap:
        tc = mulai + lama - 2.0
        f.tween.append(f'tl.fromTo("#{sid}-cap", {{opacity: 0, scale: 1.8}}, {{opacity: 1, scale: 1, duration: 0.28, ease: "power4.in"}}, {tc});')
        f.tween.append(f'tl.fromTo("#{sid}-c, #{sid}-c2", {{scale: 1}}, {{scale: 0.985, duration: 0.08, yoyo: true, repeat: 1}}, {tc + 0.28});')


L, H = "assets/layar/", "assets/layar-hp/"
P = "assets/potong/"


def promo():
    f = Film("promo", 1920, 1080, 46)
    berserakan(f, 0, 6, "Nota, absen, gaji, tagihan.", "Usaha kecil masih berjalan di kertas dan chat. Merapikannya makan malammu.", False)
    layar(f, 6, 7, P + "nota.png", (1060, 70, 700), "Lempar fotonya.", "Nadi membaca nota, slip, Excel, atau surat dokter, lalu menyiapkan usulan.", (120, 330, 820),
          cetak=True, susul=(P + "kartu.png", (1060, 660, 700), 9.6))
    layar(f, 13, 7, L + "feed-kartu.png", (740, 390, 1080), "Kamu tinggal memutuskan.", "Setujui atau tolak dari HP. Setiap keputusan tercatat dan bisa dibatalkan.", (120, 300, 580),
          cap=("DISETUJUI", 1300, 330, 64, True))
    layar(f, 20, 8, L + "tagihan.png", (1200, 50, 600, 980), "Tagihan pakai QRIS milikmu.", "Pelanggan memindai QRIS milikmu sendiri. Pengingat jatuh tempo siap dikirim lewat WhatsApp.", (120, 330, 900),
          geser=520)
    layar(f, 28, 9, L + "peta.png", (1060, 90, 800), "Kamera jadi mata.", "Meja terisi dan antrean terbaca langsung di peta warung. Videonya tidak dikirim ke mana pun.", (120, 330, 840),
          geser=360)
    layar(f, 37, 5, L + "sarapan.png", (840, 250, 1000), "Sarapan data.", "Tiap pagi, hanya yang berdampak rupiah.", (120, 330, 640))
    akhir(f, 42, 4, False)
    f.tulis("index.html")


def teaser():
    f = Film("teaser", 1080, 1920, 15)
    berserakan(f, 0, 3.2, "Nota numpuk lagi?", "", True)
    layar(f, 3.2, 6.3, P + "nota.png", (60, 520, 960), "Foto saja.", "", (70, 200, 940, None, 110),
          cetak=True, susul=(P + "kartu.png", (60, 1340, 960), 6.0), cap=("DISETUJUI", 560, 1250, 64, True))
    sid = "j1"
    f.tambah(9.5, 2.5, f'<div id="{sid}" class="isi" style="left:70px; right:70px; top:700px"><div class="judul" style="font-size:132px">Nadi yang <span class="sorot">merapikan.</span></div></div>')
    f.masuk(f"#{sid}", 9.6)
    akhir(f, 12, 3, True)
    f.tulis("teaser.html")


def fitur(nama, pembuka, adegan):
    f = Film(f"fitur-{nama}", 1080, 1920, 22)
    sid = "p1"
    f.tambah(0, 3, f'<div id="{sid}" class="isi" style="left:70px; right:70px; top:640px"><div class="judul" style="font-size:112px">{pembuka}</div></div>')
    f.masuk(f"#{sid}", 0.15)
    adegan(f)
    akhir(f, 18, 4, True)
    f.tulis(f"fitur-{nama}.html")


def semua():
    potong()
    promo()
    teaser()
    tegak = (70, 170, 940, None, 88, 42)
    fitur("lempar", "Foto nota, <span class=\"sorot\">bukan ketik ulang.</span>", lambda f: (
        layar(f, 3, 5, H + "lempar.png", (90, 560, 900, 1200), "Lempar Saja.", "Nota, slip gaji, KTP, CV, Excel, mutasi bank.", tegak, geser=260),
        layar(f, 8, 10, P + "nota.png", (60, 560, 960), "Nadi membaca isinya.", "Jumlah per baris dicocokkan dengan total.", tegak,
              cetak=True, susul=(P + "kartu.png", (60, 1380, 960), 11.5))))
    fitur("feed", "Keputusan, <span class=\"sorot\">bukan formulir.</span>", lambda f: (
        layar(f, 3, 7, H + "feed-kartu.png", (60, 760, 960), "Usulan menunggumu.", "Setiap usulan menyebut bukti dan keyakinannya.", tegak,
              cap=("DISETUJUI", 560, 1190, 64, True)),
        layar(f, 10, 8, H + "alur.png", (60, 640, 960, 1220), "Semua tercatat.", "Dari tagihan terbit sampai lunas, Nadi menunjukkan alurnya.", tegak, geser=900)))
    fitur("mata", "Meja kosong? <span class=\"sorot\">Nadi tahu.</span>", lambda f: (
        layar(f, 3, 7, P + "mata-atas.png", (60, 560, 960), "Kamera yang sudah ada.", "Gambar dibaca di perangkatmu, tidak pernah dikirim.", tegak,
              susul=(P + "mata-log.png", (60, 1320, 960), 6.2)),
        layar(f, 10, 8, H + "peta.png", (60, 560, 960, 1300), "Peta warung langsung.", "Meja terisi dan antrean kasir, tanpa muat ulang.", tegak, geser=420)))
    fitur("sarapan", "Pagi ini, <span class=\"sorot\">apa yang penting?</span>", lambda f: (
        layar(f, 3, 15, H + "sarapan.png", (60, 600, 960, 1160), "Sarapan data.", "Dihitung semalam dari catatan usahamu. Hanya yang berdampak rupiah, paling banyak tiga.", tegak, geser=120),))


if __name__ == "__main__":
    semua()
    print("ok")
