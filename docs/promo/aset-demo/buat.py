"""Aset demo video Nadi (V-04), semuanya buatan sendiri dan sintetis, deterministik dari benih.

  python -I buat.py <folder-keluar>

- karyawan-berantakan.xlsx: daftar karyawan seperti yang biasa dikirim pemilik usaha. Judul bergabung di atas tabel, nama kolom
  tidak seragam, tanggal campur format, gaji campur angka/teks/"jt", nomor HP berbagai bentuk, baris kosong, dan orang yang
  sama tercatat dua kali.
- harga-berantakan.xlsx: daftar harga barang dengan satuan dan rupiah tidak seragam, catatan di sel harga, dan kode kosong.
- pelanggan-ganda.csv: pelanggan dari ekspor kontak WhatsApp + buku catatan. Orang yang sama muncul dengan sapaan, ejaan, dan
  format nomor berbeda.
- cctv-toko.mp4: kamera atas toko 1280x720 30 fps 85 dtk dengan sosok abstrak (lingkaran kepala + elips bahu dari atas, tanpa
  wajah), masuk lewat pintu, berhenti di rak, membayar di kasir, keluar. Gerak memakai easing (percepat lalu perlambat, V-01)
  dan pegas kecil saat berhenti. Satu karyawan diam di kasir. cctv-jawaban.json menyimpan kunjungan sebenarnya untuk uji Mata.
Nama, nomor HP, dan angka adalah karangan.
"""
import csv, json, math, os, subprocess, sys
import numpy as np
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from PIL import Image, ImageDraw, ImageFilter, ImageFont

KELUAR = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(KELUAR, exist_ok=True)
rng = np.random.default_rng(2026)

NAMA = ["Siti Rahmawati", "Budi Santoso", "Ketut Ariani", "Agus Prasetyo", "Dewi Lestari", "Made Wirawan", "Rina Kartika",
        "Joko Susilo", "Nyoman Sudarsana", "Fitri Handayani", "Rudi Hartono", "Wayan Suarta", "Lina Marlina", "Andi Saputra",
        "Komang Ayu", "Hendra Gunawan", "Putu Eka", "Yuni Astuti", "Eko Wahyudi", "Gede Mahendra", "Ratna Sari", "Dodi Kurniawan"]
JABATAN = ["Kasir", "kasir", "Pramuniaga", "pramuniaga toko", "Gudang", "Staff gudang", "Kurir", "Admin", "ADMIN", "Kepala toko"]


def hp(i, gaya):
    nomor = f"812{(37000000 + i * 104729) % 100000000:08d}"
    return {0: f"0{nomor[:3]}-{nomor[3:7]}-{nomor[7:]}", 1: f"+62{nomor}", 2: f"0{nomor}", 3: f"62 {nomor[:3]} {nomor[3:]}", 4: f"'0{nomor}"}[gaya]


def tanggal(i, gaya):
    hari, bulan, tahun = 1 + (i * 7) % 27, 1 + (i * 5) % 12, 2019 + i % 6
    bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][bulan - 1]
    return {0: f"{hari}/{bulan}/{tahun}", 1: f"{tahun}-{bulan:02d}-{hari:02d}", 2: f"{hari} {bln} {tahun}", 3: f"{bln} {tahun}", 4: f"{hari}-{bulan}-{str(tahun)[2:]}"}[gaya]


def gaji(i, gaya):
    n = 3_600_000 + (i * 137) % 18 * 150_000
    return {0: n, 1: f"Rp {n:,}".replace(",", "."), 2: f"{n / 1e6:.1f} jt".replace(".", ","), 3: f"Rp{n // 1000}rb", 4: f"{n:,}".replace(",", ".")}[gaya]


def excel_karyawan():
    wb = Workbook(); ws = wb.active; ws.title = "data kary"
    ws.merge_cells("A1:G1"); ws["A1"] = "DATA KARYAWAN TOKO BU SARI (update terakhir??)"; ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = "jgn diubah2 ya"; ws["A2"].font = Font(italic=True, color="FF0000")
    kepala = ["No", "Nama Karyawan", "jabatan/posisi", "Tgl Masuk", "Gapok", "No HP / WA", "ket"]
    ws.append([]); ws.append(kepala)
    for c in ws[4]:
        c.font = Font(bold=True); c.fill = PatternFill("solid", fgColor="FFFF00")
    baris = []
    for i, n in enumerate(NAMA):
        baris.append([i + 1, n if i % 4 else n.upper(), JABATAN[i % len(JABATAN)], tanggal(i, i % 5), gaji(i, (i * 3) % 5), hp(i, i % 5),
                      ["", "kontrak", "tetap", "masa coba 3 bln", "", "pindahan cabang"][i % 6]])
    baris.insert(6, ["", "", "", "", "", "", ""])
    baris.insert(13, [None, "Budi santoso ", "Kasir", tanggal(1, 2), gaji(1, 1), hp(1, 0), "dobel?"])  # orang sama, beda huruf
    baris.insert(18, [None, "Ketut  Ariani", "pramuniaga", tanggal(2, 0), gaji(2, 2), hp(2, 3), ""])
    for b in baris:
        ws.append(b)
    ws.append([]); ws.append(["", "TOTAL", "", "", "=SUM(E5:E30)", "", "(rumus salah, banyak sel teks)"])
    for col, w in zip("ABCDEFG", [5, 24, 16, 14, 14, 18, 22]):
        ws.column_dimensions[col].width = w
    ws["B9"].fill = PatternFill("solid", fgColor="FFC7CE")
    ws["F12"].alignment = Alignment(horizontal="right")
    wb.save(os.path.join(KELUAR, "karyawan-berantakan.xlsx"))
    return {"baris_orang": len(NAMA), "baris_ganda": 2, "baris_kosong": 1}


BARANG = [("Beras 5 kg", "sak", 72000), ("Gula pasir", "kg", 18000), ("Minyak goreng 2L", "pouch", 38000), ("Telur", "kg", 29000),
          ("Kopi sachet", "renceng", 14000), ("Mi instan", "dus", 115000), ("Teh celup", "kotak", 9500), ("Sabun mandi", "pcs", 4500),
          ("Air mineral 600ml", "dus", 52000), ("Susu kental manis", "kaleng", 12500), ("Tepung terigu", "kg", 12000), ("Garam", "bks", 3000)]


def excel_harga():
    wb = Workbook(); ws = wb.active; ws.title = "HARGA BARU!!"
    ws.append(["daftar harga", "", "", "", "naik mulai senin"]); ws.append([])
    ws.append(["kode", "barang", "sat", "hrg jual", "hrg grosir", "catatan"])
    for i, (b, s, h) in enumerate(BARANG):
        kode = "" if i % 5 == 3 else f"BRG-{i + 1:03d}" if i % 2 else f"brg{i + 1}"
        jual = h if i % 3 == 0 else f"Rp {h:,}".replace(",", ".") if i % 3 == 1 else f"{h // 1000}rb"
        grosir = "" if i % 4 == 2 else (f"{int(h * 0.95):,}".replace(",", ".") + (" (min 10)" if i % 2 else ""))
        ws.append([kode, b if i % 3 else b.lower(), s, jual, grosir, ["", "stok tipis", "cek lagi", "", "harga lama 13rb"][i % 5]])
    ws.append(["", "Beras 5kg", "sak", "Rp 74.000", "", "harga baru? beda sama atas"])  # barang ganda, harga beda
    wb.save(os.path.join(KELUAR, "harga-berantakan.xlsx"))
    return {"barang": len(BARANG), "ganda": 1}


def csv_pelanggan():
    asli = [("Sari Wulandari", 11), ("Pak Made Sukarta", 12), ("Warung Bu Ani", 13), ("Hotel Melati Indah", 14), ("Toni (katering)", 15)]
    baris = []
    for nama, i in asli:
        baris.append([nama, hp(i, 2), "wa", ""])
        varian = {"Sari Wulandari": "Ibu Sari", "Pak Made Sukarta": "MADE SUKARTA", "Warung Bu Ani": "bu ani warung",
                  "Hotel Melati Indah": "Htl Melati", "Toni (katering)": "Tony Catering"}[nama]
        baris.append([varian, hp(i, 1 + i % 4).replace("'", ""), "buku catatan", "langganan" if i % 2 else ""])
    for j, n in enumerate(["Rahmat Hidayat", "Lilis Suryani", "CV Sumber Jaya", "Yayasan Harapan"]):
        baris.append([n, hp(30 + j, j % 4), "wa", ""])
    rng.shuffle(baris)
    with open(os.path.join(KELUAR, "pelanggan-ganda.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["nama", "no hp", "sumber", "catatan"]); w.writerows(baris)
    return {"baris": len(baris), "orang_unik": len(asli) + 4}


# ---------- CCTV kamera atas ----------
W, H, FPS, DUR = 1280, 720, 30, 85.0
PINTU = (620, 655)  # tengah bawah, seluruh badan masih di dalam bingkai
RAK = [(140, 150, 360, 210), (140, 330, 360, 390), (520, 150, 760, 210), (520, 330, 760, 390)]
KASIR = (930, 470, 1150, 540)
TITIK_RAK = [(250, 270), (250, 440), (640, 270), (640, 440)]
TITIK_KASIR = (1040, 600)


def mulus(u):  # easing masuk-keluar (smootherstep): percepat lalu perlambat, tidak linier
    u = min(max(u, 0.0), 1.0)
    return u * u * u * (u * (u * 6 - 15) + 10)


def jalur_pengunjung(k):
    """Satu pengunjung: pintu -> 1-2 rak (berhenti) -> kasir (berhenti) -> pintu. Kembali [(t0, t1, a, b)]."""
    mulai = 1.0 + k * 4.6
    r = np.random.default_rng(100 + k)
    henti = [TITIK_RAK[i] for i in r.choice(len(TITIK_RAK), size=1 + k % 2, replace=False)]
    # Jalan lewat lorong (x=440 di antara dua kolom rak, y=560 di depan kasir) supaya tidak menembus rak.
    lx = 440 + int(r.integers(-28, 28))  # tiap orang punya jalur sendiri di lorong, tidak satu garis yang sama
    titik, berhenti = [PINTU, (lx, 560)], set()
    for x, y in henti:
        tujuan = (x + int(r.integers(-25, 25)), y + int(r.integers(-8, 8)))
        titik += [(lx, y), tujuan, (lx, y)]; berhenti.add(tujuan)
    titik += [(lx, 560), TITIK_KASIR, PINTU]; berhenti.add(TITIK_KASIR)
    seg, t = [], mulai
    for a, b in zip(titik, titik[1:]):
        jarak = math.dist(a, b); lama = max(jarak, 1) / (140 + r.integers(0, 50))  # 140-190 px per dtk
        seg.append((t, t + lama, a, b)); t += lama
        tahan = 1.6 + r.random() * 1.6 if b in berhenti else 0
        if tahan:
            seg.append((t, t + tahan, b, b)); t += tahan
    return seg


def posisi(seg, t):
    for t0, t1, a, b in seg:
        if t0 <= t < t1:
            u = mulus((t - t0) / max(t1 - t0, 1e-6))
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), (b[0] - a[0], b[1] - a[1])
    return None, None


def lantai():
    gb = Image.new("RGB", (W, H), (214, 208, 196)); d = ImageDraw.Draw(gb)
    for x in range(0, W, 80):
        d.line([(x, 0), (x, H)], fill=(203, 197, 185), width=2)
    for y in range(0, H, 80):
        d.line([(0, y), (W, y)], fill=(203, 197, 185), width=2)
    derau = (np.random.default_rng(7).normal(0, 3.0, (H, W, 1))).astype(np.int16)
    arr = np.clip(np.asarray(gb, dtype=np.int16) + derau, 0, 255).astype(np.uint8)
    gb = Image.fromarray(arr); d = ImageDraw.Draw(gb)
    for x0, y0, x1, y1 in RAK:
        d.rectangle([x0 + 6, y0 + 8, x1 + 6, y1 + 8], fill=(170, 165, 154))  # bayangan
        d.rectangle([x0, y0, x1, y1], fill=(120, 96, 70))
        for i in range(x0 + 10, x1 - 10, 34):
            d.rectangle([i, y0 + 8, i + 24, y1 - 8], fill=[(176, 64, 52), (60, 112, 160), (220, 180, 70), (80, 140, 90)][(i // 34) % 4])
    d.rectangle([KASIR[0] + 6, KASIR[1] + 8, KASIR[2] + 6, KASIR[3] + 8], fill=(170, 165, 154))
    d.rectangle(KASIR, fill=(90, 88, 84)); d.rectangle([KASIR[0] + 20, KASIR[1] + 15, KASIR[0] + 80, KASIR[1] + 50], fill=(40, 40, 44))
    d.rectangle([540, 625, 700, 690], fill=(176, 171, 162))  # keset pintu
    return gb


def sosok(d, x, y, arah, warna, besar=1.0):
    # Dari atas: bahu (elips searah jalan) + kepala (lingkaran). Tanpa wajah atau ciri pribadi.
    sudut = math.atan2(arah[1], arah[0]) if arah and (arah[0] or arah[1]) else 0
    bx, by = 38 * besar, 22 * besar
    titik = [(x + bx * math.cos(a) * math.cos(sudut + math.pi / 2) - by * math.sin(a) * math.sin(sudut + math.pi / 2),
              y + bx * math.cos(a) * math.sin(sudut + math.pi / 2) + by * math.sin(a) * math.cos(sudut + math.pi / 2)) for a in np.linspace(0, 2 * math.pi, 28)]
    d.polygon(titik, fill=warna)
    r = 16 * besar
    d.ellipse([x - r, y - r, x + r, y + r], fill=(46, 38, 34))


def cctv():
    latar = lantai()
    huruf = ImageFont.load_default(size=22)
    pengunjung = [jalur_pengunjung(k) for k in range(12)]
    warna = [(64, 108, 170), (176, 70, 60), (90, 140, 96), (150, 110, 30), (120, 90, 150), (60, 130, 130)]  # semua >= 60 lebih gelap dari lantai (abu ±210)
    jawaban = [{"masuk": round(s[0][0], 2), "keluar": round(s[-1][1], 2)} for s in pengunjung]
    proc = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
                             os.path.join(KELUAR, "cctv-toko.mp4")], stdin=subprocess.PIPE)
    for f in range(int(DUR * FPS)):
        t = f / FPS
        gb = latar.copy(); bay = Image.new("L", (W, H), 0); db = ImageDraw.Draw(bay); d = ImageDraw.Draw(gb)
        isi = []
        for k, seg in enumerate(pengunjung):
            p, arah = posisi(seg, t)
            if p:
                isi.append((p, arah, warna[k % len(warna)]))
        isi.append(((1040, 445 + 3 * math.sin(t * 1.3)), (1, 0), (40, 92, 76)))  # karyawan di balik kasir
        for (x, y), _, _ in isi:
            db.ellipse([x - 34 + 8, y - 22 + 10, x + 34 + 8, y + 22 + 10], fill=90)
        bay = bay.filter(ImageFilter.GaussianBlur(8))
        gelap = Image.new("RGB", (W, H), (0, 0, 0))
        gb = Image.composite(gelap, gb, bay.point(lambda v: v * 0.35)); d = ImageDraw.Draw(gb)
        for (x, y), arah, wn in isi:
            sosok(d, x, y, arah, wn)
        detik = 8 * 3600 + 15 * 60 + 3 + int(t)
        d.text((24, 20), f"KAM 01  TOKO  06-11-2026 {detik // 3600:02d}:{detik // 60 % 60:02d}:{detik % 60:02d}", font=huruf, fill=(250, 250, 250), stroke_width=2, stroke_fill=(20, 20, 20))
        proc.stdin.write(gb.tobytes())
    proc.stdin.close(); proc.wait()
    json.dump({"lebar": W, "tinggi": H, "fps": FPS, "durasi": DUR, "pintu": PINTU, "kasir": KASIR, "rak": RAK, "karyawan": 1,
               "kunjungan": jawaban}, open(os.path.join(KELUAR, "cctv-jawaban.json"), "w"), indent=1)
    return {"kunjungan": len(jawaban)}


if __name__ == "__main__":
    print(json.dumps({"karyawan": excel_karyawan(), "harga": excel_harga(), "pelanggan": csv_pelanggan(), "cctv": cctv()}))
