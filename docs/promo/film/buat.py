# D-21: komposisi HyperFrames video promo Nadi, dibangun ulang bergerak. Antarmuka digambar sebagai HTML (bukan PNG), kursor
# menggerakkan Lempar dan Feed, kamera menjelajah invoice, Mata dan Peta hidup, Sarapan Data mengetuk per ketukan musik.
# Semua potongan jatuh di garis bar lagu "Funk in my Pocket" (OptiKill, CC BY 3.0, 129,2 BPM, 1 bar = 1,8576 dtk;
# analisis di docs/promo/audio/analisis-funk-in-my-pocket.md). Blueprint: overwhelm-surround (masalah), cursor-ui-demo (Lempar,
# Feed), camera-journey (invoice + QRIS), kinetic-type-beats (Sarapan Data).
# Keluaran: index.html (promo 16:9, 28 bar = 52 dtk), varian/teaser.html (9:16, 8 bar), varian/fitur-*.html (9:16, 8 bar).
# Jalankan dari folder ini: python -I buat.py. Audio dicampur terpisah oleh docs/promo/audio/campur.py.
import json
import os

AKAR = os.path.dirname(os.path.abspath(__file__))
BAR = 4 * 60 / 129.2
KET = BAR / 4
URL = "nadi-swart.vercel.app/demo"
KREDIT = "Musik: Funk in my Pocket oleh OptiKill (CC BY 3.0)"

WARNA = {"kunyit": ("#E9A825", "#1C1B18"), "tinta": ("#1C1B18", "#FBFAF6"), "cap": ("#A63225", "#FFFDF8"), "laut": ("#1A3796", "#FFFDF8"),
         "daun": ("#23704A", "#FFFDF8"), "tulang": ("#F3F1EC", "#1C1B18"), "lembar": ("#FFFDF8", "#1C1B18")}

CSS = """
@font-face { font-family: Papan; src: url(assets/fonts/bigshoulders.woff2) format("woff2"); font-weight: 100 900; }
@font-face { font-family: Jakarta; src: url(assets/fonts/jakarta.woff2) format("woff2"); font-weight: 200 800; }
@font-face { font-family: PlexMono; src: url(assets/fonts/plexmono.woff2) format("woff2"); font-weight: 500; }
:root { --kertas: #F6F2EA; --lembar: #FFFDF8; --tinta: #1C1B18; --tinta-2: #4A463F; --garis: #DDD5C6; --kunyit: #E9A825; --cap: #B4372A; --daun: #23704A; --laut: #1A3796; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; background: var(--tinta); }
#root { position: relative; overflow: hidden; font-family: Jakarta, sans-serif; color: var(--tinta); }
.clip { position: absolute; inset: 0; overflow: hidden; }
.medan { position: absolute; inset: 0; }
.panggung { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.judul { font-family: Papan, sans-serif; font-weight: 800; line-height: 0.92; letter-spacing: -0.01em; }
.sorot { color: var(--kunyit); }
.sub { font-weight: 600; line-height: 1.3; }
.lembar { position: absolute; background: var(--lembar); color: var(--tinta); border-radius: 14px; }
.slip { position: absolute; background: var(--lembar); color: var(--tinta); border-radius: 8px; padding: 18px 22px; font-family: PlexMono, monospace; font-size: 24px; line-height: 1.4; width: 320px; }
.slip b { display: block; font-family: Jakarta, sans-serif; font-weight: 800; font-size: 24px; letter-spacing: 0.06em; margin-bottom: 6px; color: var(--cap); }
.chat { position: absolute; background: #DCF2D9; color: var(--tinta); border-radius: 22px 22px 22px 6px; padding: 16px 22px; font-size: 26px; font-weight: 600; max-width: 340px; }
.tombol { display: inline-flex; align-items: center; justify-content: center; height: 64px; padding: 0 30px; border-radius: 10px; font-weight: 700; font-size: 26px; }
.t-utama { background: var(--tinta); color: var(--lembar); }
.t-kedua { border: 3px solid var(--tinta); color: var(--tinta); }
.cap { position: absolute; border: 8px solid var(--cap); color: var(--cap); font-weight: 800; letter-spacing: 0.08em; border-radius: 12px; padding: 0.06em 0.36em; transform: rotate(-8deg); font-size: 64px; background: rgba(255,253,248,0.92); }
.cap-daun { border-color: var(--daun); color: var(--daun); }
.kursor { position: absolute; width: 56px; height: 56px; z-index: 50; }
.angka { font-variant-numeric: tabular-nums; }
.baris { display: flex; justify-content: space-between; gap: 24px; }
.garis-b { border-bottom: 2px solid var(--garis); }
.mono { font-family: PlexMono, monospace; }
.meja { position: absolute; width: 190px; height: 150px; border-radius: 16px; border: 4px solid #4FB07F; color: #FBFAF6; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; font-size: 28px; }
.meja span { font-size: 24px; font-weight: 600; margin-top: 6px; }
.titik { display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #4FB07F; margin-right: 12px; vertical-align: middle; }
.kredit { position: absolute; font-size: 22px; font-weight: 600; }
"""

KURSOR = '<svg class="kursor" id="{id}" style="left:0; top:0" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 2l18 12-8 1.5 4.5 8.5-3.5 1.8-4.5-8.6L4 23z" fill="#1C1B18" stroke="#FFFDF8" stroke-width="2" stroke-linejoin="round"/></svg>'
LOGO = '<svg viewBox="0 0 64 64" width="{s}" height="{s}" aria-hidden="true"><path d="M10 54V22c0-8 6-13 14-13h8c8 0 14 5 14 13v32l-4-3-4 3-4-3-4 3V24c0-3-2-5-5-5h-2c-3 0-5 2-5 5v30l-4-3z" fill="{w}"/><circle cx="52" cy="10" r="5.5" fill="{a}"/></svg>'


class Film:
    def __init__(self, cid, w, h, bar):
        self.cid, self.w, self.h = cid, w, h
        self.tegak = h > w
        self.durasi = round(bar * BAR, 3)
        self.adegan, self.tw, self.n, self.t = [], [], 0, 0.0
        self.sfx = []  # (detik, jenis) untuk campuran audio

    def id(self, awal):
        self.n += 1
        return f"{awal}{self.n}"

    def tambah(self, bar, medan, isi):
        sid = self.id("a")
        bg, fg = WARNA[medan]
        mulai, lama = round(self.t, 3), round(bar * BAR, 3)
        self.adegan.append(f'<section id="{sid}" class="clip" data-start="{mulai}" data-duration="{lama}" data-track-index="1">'
                           f'<div class="medan" style="background:{bg}; color:{fg}"></div>{isi}</section>')
        # masuk adegan: lapangan warna menyapu dari bawah dalam 1/2 ketukan (potongan tetap di garis bar)
        self.tw.append(f'tl.fromTo("#{sid} .medan", {{yPercent: 100}}, {{yPercent: 0, duration: {KET / 2:.3f}, ease: "power4.out"}}, {mulai});')
        self.sfx.append((mulai, "sapu"))
        self.t += lama
        return sid, mulai, fg

    def a(self, sel, dari, ke, t, lama=0.4, ease="power3.out"):
        self.tw.append(f'tl.fromTo("{sel}", {json.dumps(dari)}, {json.dumps({**ke, "duration": round(lama, 3), "ease": ease})}, {round(t, 3)});')

    def ke(self, sel, ke, t, lama=0.4, ease="power3.inOut"):
        self.tw.append(f'tl.to("{sel}", {json.dumps({**ke, "duration": round(lama, 3), "ease": ease})}, {round(t, 3)});')

    def panggung(self, sid, isi, dw, dh, zona):
        """Bangun gambar berukuran desain dw x dh, diskalakan agar muat di zona (x, y, w, h) piksel komposisi."""
        x, y, w, h = zona
        s = min(w / dw, h / dh)
        ox, oy = x + (w - dw * s) / 2, y + (h - dh * s) / 2
        # luar = penempatan tetap; dalam (#sid-p) = yang dianimasikan, supaya tween x/y/scale tidak menimpa penempatan
        return (f'<div class="panggung" style="width:{dw}px; height:{dh}px; transform: translate({ox:.1f}px, {oy:.1f}px) scale({s:.4f})">'
                f'<div id="{sid}-p" style="position:absolute; inset:0">{isi}</div></div>')

    def zona(self):
        """(judul, gambar): lanskap = judul kiri, gambar kanan; tegak = judul atas, gambar bawah."""
        if self.tegak:
            return (70, 140, self.w - 140, 440), (20, 600, self.w - 40, self.h - 640)
        return (110, 140, 620, self.h - 280), (760, 70, self.w - 800, self.h - 140)

    def judul(self, sid, kotak, judul, sub, fg, besar=None):
        x, y, w, h = kotak
        u = besar or (128 if self.tegak else 132)
        s = 44 if self.tegak else 40
        return (f'<div id="{sid}-j" style="position:absolute; left:{x}px; top:{y}px; width:{w}px; color:{fg}">'
                f'<div class="judul" style="font-size:{u}px">{judul}</div>'
                + (f'<div class="sub" style="font-size:{s}px; margin-top:34px; max-width:{w}px">{sub}</div>' if sub else "") + "</div>")

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
{chr(10).join(self.adegan)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(self.tw)}
window.__timelines["{self.cid}"] = tl;
</script>
</body>
</html>
"""

    def tulis(self, nama):
        if nama == "index.html":
            teks, jalur = self.html(), os.path.join(AKAR, nama)
        else:
            os.makedirs(os.path.join(AKAR, "varian"), exist_ok=True)
            teks, jalur = self.html().replace("assets/", "../assets/"), os.path.join(AKAR, "varian", nama)
        open(jalur, "w", encoding="utf-8", newline="\n").write(teks)
        isyarat = os.path.join(AKAR, "sfx", nama.replace(".html", ".json"))
        os.makedirs(os.path.dirname(isyarat), exist_ok=True)
        json.dump({"durasi": self.durasi, "bar": BAR, "sfx": sorted(self.sfx)}, open(isyarat, "w"), indent=1)


# ---------- 1. masalah: overwhelm-surround ----------
SLIP = [("NOTA", "UD Sumber Rejeki<br>Tepung 6 x 13.500<br>TOTAL 376.500"), ("ABSEN", "Sen Komang 07.58<br>Sel Komang --.--"),
        ("SLIP GAJI", "Oktober 2026<br>Lembur ?"), ("TAGIHAN", "Bu Rina, arisan RT 03<br>Rp750.000 belum"),
        ("KUITANSI", "Gas 3 tabung<br>Rp66.000"), ("IZIN", "Wayan sakit<br>surat dokter?")]
CHAT = ["Bu, gaji kapan?", "Nota kemarin di mana?", "Meja 4 minta bon", "Stok gula habis"]


def masalah(f, bar=4, kata=("Nota.", "Absen.", "Gaji.", "Tagihan.")):
    sid, t0, fg = f.tambah(bar, "cap", "")
    W, H = f.w, f.h
    cx, cy = W / 2, H / 2
    # cincin titik mendarat di sekeliling tengah, masuk dari luar layar (blueprint overwhelm-surround)
    import math
    benda, n = [], len(SLIP) + len(CHAT)
    for i in range(n):
        sudut = -math.pi / 2 + i * 2 * math.pi / n
        if f.tegak:
            # tegak: dua kolom, lima baris di luar pita judul tengah (tanpa saling tutup, dihitung di uji tumpang)
            x, y = (200 if i % 2 == 0 else W - 200), [190, 500, 1210, 1500, 1790][i // 2]
        else:
            x, y = cx + W * 0.38 * math.cos(sudut), cy + H * 0.37 * math.sin(sudut)
        r = ((i * 37 % 9) - 4) if f.tegak else ((i * 37 % 15) - 7)
        if i < len(SLIP):
            a, b = SLIP[i]
            el = f'<div id="{sid}-s{i}" class="slip" style="left:{x - 160:.0f}px; top:{y - 80:.0f}px; transform: rotate({r}deg)"><b>{a}</b>{b}</div>'
        else:
            el = f'<div id="{sid}-s{i}" class="chat" style="left:{x - 170:.0f}px; top:{y - 40:.0f}px; transform: rotate({r / 2}deg)">{CHAT[i - len(SLIP)]}</div>'
        benda.append(el)
    tengah = (f'<div id="{sid}-k" style="position:absolute; left:0; right:0; top:{cy - 120:.0f}px; text-align:center; color:{fg}">'
              + "".join(f'<span id="{sid}-w{j}" class="judul" style="font-size:{150 if f.tegak else 170}px; position:absolute; left:0; right:0">{k}</span>' for j, k in enumerate(kata))
              + f'<span id="{sid}-w9" class="judul" style="font-size:{150 if f.tegak else 170}px; position:absolute; left:0; right:0">Berserakan.</span></div>')
    f.adegan[-1] = f.adegan[-1].replace("</section>", f'<div id="{sid}-cam" style="position:absolute; inset:0">{"".join(benda)}</div>{tengah}</section>')
    # setiap benda mendarat di satu ketukan, dari luar layar searah sudutnya
    for i in range(n):
        t = t0 + 0.12 + i * KET * (bar * 4 - 3) / n
        sudut = -math.pi / 2 + i * 2 * math.pi / n
        f.a(f"#{sid}-s{i}", {"x": 900 * math.cos(sudut), "y": 900 * math.sin(sudut), "opacity": 0},
            {"x": 0, "y": 0, "opacity": 1}, t, lama=0.32, ease="power4.out")
        f.sfx.append((round(t + 0.3, 3), "kertas"))
    # kamera mendesak masuk perlahan dan bergetar kecil di akhir
    f.a(f"#{sid}-cam", {"scale": 1.0}, {"scale": 1.06}, t0, lama=bar * BAR, ease="none")
    for j in range(len(kata)):
        tk = t0 + j * BAR * (bar - 1) / len(kata)
        f.a(f"#{sid}-w{j}", {"opacity": 0, "scale": 1.25}, {"opacity": 1, "scale": 1}, tk, lama=0.16, ease="power4.out")
        f.ke(f"#{sid}-w{j}", {"opacity": 0}, tk + BAR * (bar - 1) / len(kata) - 0.08, lama=0.06)
    tb = t0 + (bar - 1) * BAR
    f.a(f"#{sid}-w9", {"opacity": 0, "scale": 1.4}, {"opacity": 1, "scale": 1}, tb, lama=0.18, ease="power4.out")
    f.a(f"#{sid}-cam", {"x": 0}, {"x": 10}, tb, lama=0.05, ease="none")
    f.tw.append(f'tl.to("#{sid}-cam", {{x: -10, duration: 0.05, repeat: 9, yoyo: true, ease: "none"}}, {round(tb + 0.05, 3)});')
    f.sfx.append((round(tb, 3), "dentum"))


# ---------- 2. Lempar: cursor-ui-demo ----------
def nota_html(i):
    baris = [("Tepung terigu 1 kg", "6 x 13.500", "81.000"), ("Gula pasir 1 kg", "5 x 17.000", "85.000"), ("Minyak goreng 2 L", "3 x 36.500", "109.500"),
             ("Telur ayam 1 kg", "2 x 28.000", "56.000"), ("Garam 500 g", "4 x 3.500", "14.000"), ("Kecap 600 ml", "1 x 31.000", "31.000")]
    return (f'<div id="{i}" class="lembar mono" style="left:820px; top:110px; width:470px; padding:30px 32px; font-size:26px; line-height:1.45; transform: rotate(4deg)">'
            '<div style="font-family:Jakarta; font-weight:800; font-size:30px">UD SUMBER REJEKI</div><div>Jl. Gatot Subroto 12</div>'
            '<div class="garis-b" style="margin:12px 0">No 0187 &nbsp; 04/11/2026</div>'
            + "".join(f'<div>{a}</div><div class="baris"><span>{b}</span><span>{c}</span></div>' for a, b, c in baris)
            + '<div class="baris garis-b" style="margin-top:12px; font-weight:700"><span>TOTAL</span><span>376.500</span></div></div>')


def lempar(f, bar=5, judul_on=True):
    sid, t0, fg = f.tambah(bar, "tinta", "")
    zj, zg = f.zona()
    kartu_baris = [("Pemasok", "UD Sumber Rejeki"), ("Nomor", "0187"), ("Tanggal", "4 Nov 2026"), ("Barang", "6 baris"), ("Total", "Rp376.500")]
    isi = (f'<div class="lembar" style="left:0; top:0; width:780px; height:1080px; padding:40px">'
           '<div style="font-weight:800; font-size:40px">Lempar berkas</div>'
           '<div style="font-size:28px; margin-top:8px">Nota, slip, Excel, PDF, atau foto.</div>'
           f'<div id="{sid}-zona" style="margin-top:26px; height:250px; border:4px dashed #8A8478; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:700"><span id="{sid}-zl">Taruh berkas di sini</span></div>'
           f'<div id="{sid}-baca" style="margin-top:28px; font-size:26px; font-weight:700; opacity:0">Membaca nota <span class="angka" id="{sid}-pct">0</span>%</div>'
           f'<div id="{sid}-kartu" style="margin-top:20px; border:3px solid var(--tinta); border-radius:12px; padding:26px 30px; opacity:0">'
           '<div style="font-size:26px; font-weight:700; color:#23704A">USULAN BARU</div>'
           '<div style="font-size:34px; font-weight:800; margin:6px 0 14px">Catat belanja Rp376.500 di UD Sumber Rejeki</div>'
           + "".join(f'<div id="{sid}-b{k}" class="baris" style="font-size:28px; padding:4px 0"><span>{a}</span><span class="angka" style="font-weight:700">{b}</span></div>' for k, (a, b) in enumerate(kartu_baris))
           + '<div style="font-size:26px; margin-top:8px">Dibaca dari berkas, yakin 94%.</div></div></div>'
           + nota_html(f"{sid}-nota") + KURSOR.format(id=f"{sid}-kur"))
    pang = f.panggung(sid, isi, 1300, 1080, zg)
    jud = f.judul(sid, zj, 'Lempar <span class="sorot">fotonya.</span>', "Nadi membaca nota, slip gaji, Excel, atau surat dokter, lalu menyiapkan usulan.", fg) if judul_on else ""
    f.adegan[-1] = f.adegan[-1].replace("</section>", jud + pang + "</section>")
    k = KET
    f.a(f"#{sid}-j", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0}, t0 + 0.1)
    f.a(f"#{sid}-p", {"opacity": 0, "x": "+=80"}, {"opacity": 1, "x": "-=80"}, t0 + 0.05, lama=0.5)
    # kursor ke nota, ambil, seret ke zona taruh, lepas
    f.a(f"#{sid}-kur", {"x": 1240, "y": 1020}, {"x": 1080, "y": 430}, t0 + 2 * k, lama=2 * k)
    f.sfx.append((round(t0 + 4 * k, 3), "klik"))
    f.ke(f"#{sid}-nota", {"rotation": 0, "scale": 0.92}, t0 + 4 * k, lama=0.15, ease="power2.out")
    f.ke(f"#{sid}-nota", {"x": -665, "y": -220, "scale": 0.36, "rotation": -3}, t0 + 5 * k, lama=3 * k)
    f.ke(f"#{sid}-kur", {"x": 420, "y": 300}, t0 + 5 * k, lama=3 * k)
    f.ke(f"#{sid}-zl", {"opacity": 0}, t0 + 5.6 * k, lama=0.15, ease="none")
    f.ke(f"#{sid}-zona", {"backgroundColor": "#FFF3D1", "borderColor": "#E9A825"}, t0 + 6.5 * k, lama=0.2)
    td = t0 + 8 * k
    f.sfx.append((round(td, 3), "taruh"))
    f.ke(f"#{sid}-nota", {"opacity": 0, "scale": 0.2}, td, lama=0.25, ease="power3.in")
    f.ke(f"#{sid}-kur", {"opacity": 0}, td + 0.2, lama=0.2)
    f.a(f"#{sid}-baca", {"opacity": 0}, {"opacity": 1}, td + 0.1, lama=0.15)
    for j, v in enumerate([8, 21, 37, 52, 66, 79, 90, 97, 100]):
        f.tw.append(f'tl.set("#{sid}-pct", {{textContent: "{v}"}}, {round(td + 0.1 + j * 2 * k / 9, 3)});')
    tk = td + 2 * k + 0.1
    f.a(f"#{sid}-kartu", {"opacity": 0, "y": 30}, {"opacity": 1, "y": 0}, tk, lama=0.3)
    for b in range(len(kartu_baris)):
        f.a(f"#{sid}-b{b}", {"opacity": 0, "x": -20}, {"opacity": 1, "x": 0}, tk + 0.25 + b * k / 2, lama=0.18)
        f.sfx.append((round(tk + 0.25 + b * k / 2, 3), "cetak"))


# ---------- 3. Feed: cursor-ui-demo, setujui ----------
FEED = [("Catat belanja Rp376.500 di UD Sumber Rejeki", "6 barang, nota 0187. Dibaca dari berkas, yakin 94%.", "Rp376.500"),
        ("Catat izin sakit Wayan 2 hari", "Mulai 5 Nov 2026. Surat dokter terlampir.", ""),
        ("Setujui lembur Komang 2 jam", "Selasa 4 Nov, hari kerja. Masuk slip November.", "Rp41.000")]


def feed(f, bar=4, judul_on=True):
    sid, t0, fg = f.tambah(bar, "tulang", "")
    zj, zg = f.zona()
    if not f.tegak:
        zj, zg = (zg[0] + 120, zj[1] + 60, 760, zj[3]), (110, 50, 820, f.h - 100)
    kartu = "".join(
        f'<div id="{sid}-c{i}" class="lembar" style="left:30px; top:{170 + i * 330}px; width:640px; padding:28px; border:3px solid var(--garis)">'
        f'<div style="font-size:30px; font-weight:800; line-height:1.2">{a}</div><div class="ket" style="font-size:26px; margin-top:10px; line-height:1.3">{b}</div>'
        f'<div class="baris ket" style="margin-top:20px; align-items:center"><span class="angka" style="font-size:28px; font-weight:800">{c}</span>'
        f'<span style="display:flex; gap:14px"><span class="tombol t-kedua">Tolak</span><span id="{sid}-ok{i}" class="tombol t-utama">Setujui</span></span></div>'
        + (f'<div id="{sid}-cap" class="cap cap-daun" style="left:170px; top:122px; opacity:0">DISETUJUI</div>' if i == 0 else "") + '</div>'
        for i, (a, b, c) in enumerate(FEED))
    isi = (f'<div style="position:absolute; left:0; top:0; width:700px; height:1180px; border-radius:56px; background:#1C1B18; padding:22px">'
           f'<div style="position:absolute; inset:22px; border-radius:38px; background:#F6F2EA; overflow:hidden">'
           f'<div style="padding:40px 30px 0; font-size:40px; font-weight:800">Feed</div>'
           f'<div style="padding:6px 30px; font-size:26px; font-weight:600">Menunggu keputusan: <span class="angka" id="{sid}-n">3</span></div>'
           f'{kartu}</div></div>'
           + KURSOR.format(id=f"{sid}-kur"))
    pang = f.panggung(sid, isi, 760, 1180, zg)
    jud = f.judul(sid, zj, 'Kamu tinggal <span style="color:#A63225">memutuskan.</span>', "Setujui atau tolak dari HP. Setiap keputusan tercatat dan bisa dibatalkan.", fg) if judul_on else ""
    f.adegan[-1] = f.adegan[-1].replace("</section>", jud + pang + "</section>")
    k = KET
    f.a(f"#{sid}-p", {"opacity": 0, "y": 80}, {"opacity": 1, "y": 0}, t0 + 0.05, lama=0.5)
    f.a(f"#{sid}-j", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0}, t0 + 0.2)
    f.a(f"#{sid}-kur", {"x": 760, "y": 1100}, {"x": 600, "y": 450}, t0 + 2 * k, lama=3 * k)
    tc = t0 + 6 * k
    f.ke(f"#{sid}-ok0", {"scale": 0.94}, tc - 0.1, lama=0.08, ease="power2.out")
    f.ke(f"#{sid}-ok0", {"scale": 1}, tc, lama=0.1, ease="power2.out")
    f.sfx.append((round(tc - 0.1, 3), "klik"))
    f.ke(f"#{sid}-c0 .ket", {"opacity": 0}, tc, lama=0.1, ease="none")
    f.a(f"#{sid}-cap", {"opacity": 0, "scale": 2.2}, {"opacity": 1, "scale": 1}, tc + 0.1, lama=0.2, ease="power4.in")
    f.sfx.append((round(tc + 0.2, 3), "cap"))
    f.tw.append(f'tl.fromTo("#{sid}-c0", {{scale: 1}}, {{scale: 0.97, duration: 0.07, yoyo: true, repeat: 1}}, {round(tc + 0.2, 3)});')
    to = tc + 4 * k
    f.ke(f"#{sid}-c0, #{sid}-cap", {"x": -760, "opacity": 0}, to, lama=0.35, ease="power3.in")
    f.ke(f"#{sid}-c1", {"y": -330}, to + 0.3, lama=0.35)
    f.ke(f"#{sid}-c2", {"y": -330}, to + 0.38, lama=0.35)
    f.tw.append(f'tl.set("#{sid}-n", {{textContent: "2"}}, {round(to + 0.3, 3)});')
    f.sfx.append((round(to, 3), "geser"))
    f.ke(f"#{sid}-kur", {"x": 610, "y": 780}, to + 0.4, lama=3 * k)


# ---------- 4. invoice + QRIS: camera-journey ----------
def qris(sid):
    import random
    rnd = random.Random(7)
    sel = []
    for y in range(25):
        for x in range(25):
            pojok = (x < 7 and y < 7) or (x > 17 and y < 7) or (x < 7 and y > 17)
            if pojok:
                tepi = x in (0, 6, 18, 24) or y in (0, 6, 18, 24)
                dalam = (2 <= x % 18 <= 4 or 2 <= x <= 4) and (2 <= y % 18 <= 4 or 2 <= y <= 4)
                on = tepi or (dalam and (2 <= (x if x < 7 else x - 18) <= 4) and (2 <= (y if y < 7 else y - 18) <= 4))
            else:
                on = rnd.random() < 0.48
            if on:
                sel.append(f'<rect x="{x}" y="{y}" width="1" height="1"/>')
    return f'<svg id="{sid}" viewBox="-2 -2 29 29" width="330" height="330" aria-hidden="true"><rect x="-2" y="-2" width="29" height="29" fill="#FFFDF8"/><g fill="#1C1B18">{"".join(sel)}</g></svg>'


NILAI_TOT = ["0", "120.000", "310.000", "480.000", "610.000", "690.000", "735.000", "750.000"]


def invoice(f, bar=4):
    sid, t0, fg = f.tambah(bar, "lembar", "")
    W, H = f.w, f.h
    baris = [("Nasi kotak ayam bakar", "30", "22.000", "660.000"), ("Es teh manis", "30", "3.000", "90.000")]
    doc = (f'<div id="{sid}-doc" class="lembar" style="left:0; top:0; width:1100px; height:1500px; padding:70px; border:3px solid var(--garis)">'
           '<div class="baris"><div><div style="font-weight:800; font-size:44px">Warung Bu Sari</div><div style="font-size:26px">Jl. Teuku Umar 8, Denpasar</div></div>'
           '<div style="text-align:right"><div style="font-weight:800; font-size:40px">INVOICE</div><div class="mono" style="font-size:28px">014/INV/XI/2026</div></div></div>'
           '<div style="margin-top:60px; font-size:28px">Untuk: <b>Bu Rina, arisan RT 03</b><br>Jatuh tempo: <b>11 Nov 2026</b></div>'
           '<div class="baris garis-b" style="margin-top:50px; font-size:24px; font-weight:700; padding-bottom:10px"><span style="flex:3">Uraian</span><span style="flex:1; text-align:right">Jml</span><span style="flex:1.4; text-align:right">Harga</span><span style="flex:1.6; text-align:right">Jumlah</span></div>'
           + "".join(f'<div class="baris garis-b angka" style="font-size:30px; padding:18px 0"><span style="flex:3">{a}</span><span style="flex:1; text-align:right">{b}</span><span style="flex:1.4; text-align:right">{c}</span><span style="flex:1.6; text-align:right">{d}</span></div>' for a, b, c, d in baris)
           + f'<div class="baris" style="margin-top:30px; font-size:44px; font-weight:800"><span>Total</span><span class="angka">Rp' + "".join(f'<span id="{sid}-t{j}" style="display:{"inline" if j == 0 else "none"}">{v}</span>' for j, v in enumerate(NILAI_TOT)) + '</span></div>'
           f'<div style="display:flex; gap:50px; margin-top:80px; align-items:center">{qris(sid + "-q")}'
           '<div style="font-size:30px; line-height:1.4"><b>Bayar pakai QRIS</b><br>QRIS milik Warung Bu Sari.<br>Uang masuk ke rekeningmu sendiri.</div></div>'
           f'<div id="{sid}-lunas" class="cap cap-daun" style="left:640px; top:215px; font-size:84px; opacity:0">LUNAS</div></div>')
    # kamera: dunia invoice diperbesar lalu digeser; nilai transform per titik jelajah (skala, pusat x, pusat y di koordinat dokumen)
    titik = [(1.3, 550, 160), (1.35, 550, 640), (1.5, 380, 1180), (0.62 if not f.tegak else 0.8, 550, 760)]

    def kamera(s, px, py):
        return {"x": round(W / 2 - px * s), "y": round(H / 2 - py * s), "scale": s}

    jud = (f'<div id="{sid}-j" style="position:absolute; left:{70 if f.tegak else 110}px; {"top:120px" if f.tegak else "top:330px"}; width:{f.w - 140 if f.tegak else 620}px; opacity:0">'
           f'<div class="judul" style="font-size:{124 if f.tegak else 128}px">Tagihan pakai <span style="color:#23704A">QRIS milikmu.</span></div>'
           f'<div class="sub" style="font-size:{42 if f.tegak else 38}px; margin-top:30px">Pelanggan membayar langsung ke rekeningmu. Pengingat jatuh tempo siap dikirim.</div></div>')
    f.adegan[-1] = f.adegan[-1].replace("</section>", f'<div id="{sid}-cam" class="panggung" style="width:1100px; height:1500px">{doc}</div>{jud}</section>')
    k = KET
    f.tw.append(f'tl.set("#{sid}-cam", {json.dumps(kamera(*titik[0]))}, {t0});')
    f.ke(f"#{sid}-cam", kamera(*titik[1]), t0 + 3 * k, lama=3 * k)
    for j in range(1, len(NILAI_TOT)):
        f.tw.append(f'tl.set("#{sid}-t{j - 1}", {{display: "none"}}, {round(t0 + 5 * k + (j - 1) * 2 * k / 7, 3)}); tl.set("#{sid}-t{j}", {{display: "inline"}}, {round(t0 + 5 * k + (j - 1) * 2 * k / 7, 3)});')
    f.ke(f"#{sid}-cam", kamera(*titik[2]), t0 + 8 * k, lama=3 * k)
    f.sfx.append((round(t0 + 3 * k, 3), "geser"))
    f.sfx.append((round(t0 + 8 * k, 3), "geser"))
    tp = t0 + 12 * k
    f.ke(f"#{sid}-cam", kamera(*titik[3]) | ({"x": round((W * (0.62 if not f.tegak else 0.5)) - 550 * titik[3][0])} if not f.tegak else {"y": round(H * 0.62 - 760 * titik[3][0])}), tp, lama=2 * k)
    f.a(f"#{sid}-lunas", {"opacity": 0, "scale": 2.2}, {"opacity": 1, "scale": 1}, tp + 2 * k, lama=0.2, ease="power4.in")
    f.sfx.append((round(tp + 2 * k + 0.2, 3), "cap"))
    f.a(f"#{sid}-j", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0}, tp + 0.5 * k, lama=0.4)


# ---------- 5. Mata dan Peta langsung ----------
def mata(f, bar=4, judul_on=True):
    sid, t0, fg = f.tambah(bar, "tinta", "")
    zj, zg = f.zona()
    meja = [(60, 120), (300, 120), (540, 120), (60, 330), (300, 330), (540, 330), (60, 540), (300, 540)]
    isi = ('<div style="position:absolute; left:0; top:0; width:1000px; height:900px; border:3px solid #3A372F; border-radius:20px">'
           '<div style="position:absolute; left:40px; top:30px; font-size:30px; font-weight:800; color:#FBFAF6"><span class="titik" id="' + sid + '-dot"></span>Peta Warung Bu Sari, langsung</div>'
           + "".join(f'<div id="{sid}-m{i}" class="meja" style="left:{x}px; top:{y}px">Meja {i + 1}<span id="{sid}-ms{i}">kosong</span></div>' for i, (x, y) in enumerate(meja))
           + '<div style="position:absolute; left:800px; top:120px; width:160px; height:620px; border:4px dashed #E9A825; border-radius:16px; color:#FBFAF6; text-align:center; padding-top:30px">'
           f'<div style="font-size:26px; font-weight:700">Antre kasir</div><div class="judul angka" style="font-size:120px; color:#E9A825; margin-top:40px" id="{sid}-q">1</div><div style="font-size:24px">orang</div></div>'
           '<div style="position:absolute; left:40px; top:770px; right:40px; font-size:26px; color:#FBFAF6; font-weight:600">Dibaca di perangkat dari kamera yang sudah ada. Videonya tidak dikirim.</div></div>')
    pang = f.panggung(sid, isi, 1000, 900, zg)
    jud = f.judul(sid, zj, 'Kamera jadi <span class="sorot">mata.</span>', "Meja terisi dan antrean terbaca langsung di peta warung.", fg) if judul_on else ""
    f.adegan[-1] = f.adegan[-1].replace("</section>", jud + pang + "</section>")
    k = KET
    f.a(f"#{sid}-p", {"opacity": 0, "scale": 0.94}, {"opacity": 1, "scale": 1}, t0 + 0.05, lama=0.5)
    f.a(f"#{sid}-j", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0}, t0 + 0.2)
    f.tw.append(f'tl.to("#{sid}-dot", {{scale: 1.5, duration: {k:.3f}, repeat: {bar * 4 - 1}, yoyo: true, ease: "sine.inOut"}}, {t0});')
    urutan = [2, 5, 0, 7, 3, 1, 4]
    for j, i in enumerate(urutan):
        t = t0 + (2 + j * 1.8) * k
        f.ke(f"#{sid}-m{i}", {"backgroundColor": "#A63225", "borderColor": "#F08A76"}, t, lama=0.12, ease="power2.out")
        f.tw.append(f'tl.set("#{sid}-ms{i}", {{textContent: "terisi"}}, {round(t, 3)});')
        f.sfx.append((round(t, 3), "tik"))
    for j, n in enumerate([2, 3, 4, 5]):
        t = t0 + (3 + j * 3) * k
        f.tw.append(f'tl.set("#{sid}-q", {{textContent: "{n}"}}, {round(t, 3)});')
        f.a(f"#{sid}-q", {"scale": 1.3}, {"scale": 1}, t, lama=0.25)


# ---------- 6. Sarapan Data: kinetic-type-beats ----------
def sarapan(f, bar=3):
    sid, t0, fg = f.tambah(bar, "laut", "")
    W = f.w
    besar = 150 if f.tegak else 170
    baris = [("Tagihan Bu Rina lewat 3 hari", "Rp750.000"), ("Belanja tepung naik 24% minggu ini", "Rp81.000"), ("Lembur Komang menunggu", "Rp41.000")]
    x0 = 70 if f.tegak else 120
    isi = (f'<div id="{sid}-a" class="judul" style="position:absolute; left:{x0}px; top:{150 if f.tegak else 110}px; font-size:{besar}px; color:{fg}">Pagi ini,</div>'
           f'<div id="{sid}-b" class="judul" style="position:absolute; left:{x0}px; top:{150 + besar if f.tegak else 110 + besar}px; font-size:{besar}px; color:#E9A825">3 hal penting.</div>'
           + "".join(f'<div id="{sid}-l{i}" class="baris" style="position:absolute; left:{x0}px; width:{W - 2 * x0}px; top:{(620 if f.tegak else 520) + i * (170 if f.tegak else 130)}px; font-size:{46 if f.tegak else 48}px; font-weight:700; color:{fg}; border-bottom:3px solid rgba(255,253,248,0.35); padding-bottom:16px{"; flex-direction:column; gap:6px" if f.tegak else ""}">'
                     f'<span>{a}</span><span class="angka" style="color:#E9A825">{b}</span></div>' for i, (a, b) in enumerate(baris))
           + f'<div id="{sid}-c" class="sub" style="position:absolute; left:{x0}px; bottom:{120 if f.tegak else 70}px; font-size:{36 if f.tegak else 34}px; color:{fg}">Sarapan Data: dihitung semalam, hanya yang berdampak rupiah.</div>')
    f.adegan[-1] = f.adegan[-1].replace("</section>", isi + "</section>")
    k = KET
    f.a(f"#{sid}-a", {"opacity": 0, "y": -60}, {"opacity": 1, "y": 0}, t0 + 0.05, lama=0.18, ease="power4.out")
    f.sfx.append((round(t0 + 0.15, 3), "ketuk"))
    f.a(f"#{sid}-b", {"opacity": 0, "scale": 1.3}, {"opacity": 1, "scale": 1}, t0 + 2 * k, lama=0.16, ease="power4.out")
    f.sfx.append((round(t0 + 2 * k + 0.1, 3), "ketuk"))
    for i in range(3):
        t = t0 + (4 + i * 2) * k
        f.a(f"#{sid}-l{i}", {"opacity": 0, "x": -120}, {"opacity": 1, "x": 0}, t, lama=0.18, ease="power4.out")
        f.sfx.append((round(t + 0.1, 3), "ketuk"))
    f.a(f"#{sid}-c", {"opacity": 0}, {"opacity": 1}, t0 + 10 * k, lama=0.3)


# ---------- 7. akhir ----------
def akhir(f, bar=4):
    sid, t0, fg = f.tambah(bar, "kunyit", "")
    besar = 220 if f.tegak else 230
    x0 = 80 if f.tegak else 140
    isi = (f'<div id="{sid}-l" style="position:absolute; left:{x0}px; top:{560 if f.tegak else 150}px; display:flex; align-items:center; gap:30px">'
           f'{LOGO.format(s=int(besar * 0.8), w="#1C1B18", a="#FFFDF8")}<span class="judul" style="font-size:{besar}px">nadi</span></div>'
           f'<div id="{sid}-t" class="judul" style="position:absolute; left:{x0}px; top:{860 if f.tegak else 470}px; width:{f.w - 2 * x0}px; font-size:{120 if f.tegak else 116}px">Coba usaha contohnya. Tanpa daftar.</div>'
           f'<div id="{sid}-u" style="position:absolute; left:{x0}px; top:{1290 if f.tegak else 750}px; font-size:{50 if f.tegak else 58}px; font-weight:800; border-bottom:8px solid #1C1B18; padding-bottom:6px">{URL}</div>'
           f'<div class="kredit" style="left:{x0}px; bottom:{60 if f.tegak else 44}px">{KREDIT}</div>')
    f.adegan[-1] = f.adegan[-1].replace("</section>", isi + "</section>")
    k = KET
    f.a(f"#{sid}-l", {"opacity": 0, "y": 60}, {"opacity": 1, "y": 0}, t0 + 0.05, lama=0.4)
    f.a(f"#{sid}-t", {"opacity": 0, "y": 60}, {"opacity": 1, "y": 0}, t0 + 2 * k, lama=0.4)
    f.a(f"#{sid}-u", {"opacity": 0, "x": -40}, {"opacity": 1, "x": 0}, t0 + 4 * k, lama=0.4)
    f.sfx.append((round(t0 + 4 * k, 3), "ketuk"))


def semua():
    p = Film("promo", 1920, 1080, 28)
    masalah(p, 4)
    lempar(p, 5)
    feed(p, 4)
    invoice(p, 4)
    mata(p, 4)
    sarapan(p, 3)
    akhir(p, 4)
    assert abs(p.t - p.durasi) < 0.01
    p.tulis("index.html")

    t = Film("teaser", 1080, 1920, 8)
    masalah(t, 2, kata=("Nota numpuk",))
    lempar(t, 4)
    akhir(t, 2)
    t.tulis("teaser.html")

    for nama, fn in [("lempar", lempar), ("feed", feed), ("mata", mata), ("sarapan", sarapan)]:
        f = Film(f"fitur-{nama}", 1080, 1920, 8)
        fn(f, 5)
        akhir(f, 3)
        f.tulis(f"fitur-{nama}.html")


if __name__ == "__main__":
    semua()
    print("ok")
