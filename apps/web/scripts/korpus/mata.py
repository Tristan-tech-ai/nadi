# Korpus uji Mata (F5-01): 60 cuplikan "video" ruang makan (satu cuplikan = 2 detik) dengan orang datang dan pergi di 3 zona meja,
# plus orang lewat di lorong (bukan di zona). Jawaban status per cuplikan per zona = ada orang ditempel di zona itu atau tidak.
# Sumber gambar CC0 di fixtures/korpus/mata/sumber (lihat docs/ASSETS.md). Kotak orang di foto sumber diambil dari deteksi
# RF-DETR nano q8 atas foto utuh (1 Nov 2026), lalu diperlebar 8%.
# Jalankan dari apps/web: python -I scripts/korpus/mata.py <folder keluaran cuplikan>
# Menulis zona.json dan jawaban.json ke fixtures/korpus/mata; cuplikan JPEG ke folder keluaran (tidak disimpan di repo); bila ffmpeg
# ada, juga video.webm (VP9, 640 px, tiap cuplikan tampil 2 detik) untuk e2e /app/mata.
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageOps

AKAR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "fixtures", "korpus", "mata")
SUMBER = os.path.join(AKAR, "sumber")
N = 60

# Kotak orang (xmin, ymin, xmax, ymax, dinormalisasi) di foto sumber.
POTONG = {"orang1.jpg": (0.074, 0.233, 0.481, 0.988), "orang2.jpg": (0.327, 0.164, 0.819, 0.949), "orang5.jpg": (0.332, 0.174, 0.626, 0.884)}

# Zona meja di latar (persegi, dinormalisasi): bilik kiri, meja tengah, meja kanan.
ZONA = [
    {"id": "meja-1", "nama": "Bilik kiri", "jenis": "meja", "kotak": (0.02, 0.50, 0.32, 0.95)},
    {"id": "meja-2", "nama": "Meja tengah", "jenis": "meja", "kotak": (0.44, 0.52, 0.70, 0.97)},
    {"id": "meja-3", "nama": "Meja kanan", "jenis": "meja", "kotak": (0.72, 0.50, 0.98, 0.97)},
]
LORONG = (0.33, 0.45, 0.43, 0.98)

# Jadwal: (zona, foto, cuplikan mulai, cuplikan selesai eksklusif). Orang lewat di lorong pada beberapa cuplikan.
JADWAL = [("meja-1", "orang1.jpg", 5, 30), ("meja-2", "orang2.jpg", 15, 46), ("meja-3", "orang5.jpg", 34, 55),
          ("meja-1", "orang2.jpg", 40, 52), ("meja-3", "orang1.jpg", 8, 14)]
LEWAT = [20, 21, 41, 50]


def potong(nama):
    img = Image.open(os.path.join(SUMBER, nama)).convert("RGB")
    w, h = img.size
    x0, y0, x1, y1 = POTONG[nama]
    m = 0.08
    dx, dy = (x1 - x0) * m, (y1 - y0) * m
    return img.crop((int(max(0, x0 - dx) * w), int(max(0, y0 - dy) * h), int(min(1, x1 + dx) * w), int(min(1, y1 + dy) * h)))


def tempel(latar, orang, kotak, cermin=False):
    W, H = latar.size
    x0, y0, x1, y1 = kotak
    lebar, tinggi = (x1 - x0) * W * 0.95, (y1 - y0) * H * 0.95
    s = min(lebar / orang.width, tinggi / orang.height)
    o = orang.resize((max(1, int(orang.width * s)), max(1, int(orang.height * s))), Image.LANCZOS)
    if cermin:
        o = ImageOps.mirror(o)
    px = int(x0 * W + ((x1 - x0) * W - o.width) / 2)
    py = int(y1 * H - o.height - (y1 - y0) * H * 0.025)
    latar.paste(o, (px, py))


def main():
    keluar = sys.argv[1]
    os.makedirs(keluar, exist_ok=True)
    latar0 = Image.open(os.path.join(SUMBER, "latar.jpg")).convert("RGB")
    potongan = {n: potong(n) for n in POTONG}
    jawaban = []
    for i in range(N):
        img = latar0.copy()
        status = {z["id"]: "kosong" for z in ZONA}
        for zid, foto, a, b in JADWAL:
            if a <= i < b and status[zid] == "kosong":
                tempel(img, potongan[foto], next(z["kotak"] for z in ZONA if z["id"] == zid), cermin=(i % 7 == 3))
                status[zid] = "terisi"
        if i in LEWAT:
            tempel(img, potongan["orang5.jpg"], LORONG)
        img.save(os.path.join(keluar, f"{i:03d}.jpg"), quality=85)
        jawaban.append({"cuplikan": i, "detik": i * 2, "status": status, "lewat": i in LEWAT})
    zona = [{"id": z["id"], "nama": z["nama"], "jenis": z["jenis"],
             "poligon": [[z["kotak"][0], z["kotak"][1]], [z["kotak"][2], z["kotak"][1]], [z["kotak"][2], z["kotak"][3]], [z["kotak"][0], z["kotak"][3]]]}
            for z in ZONA]
    with open(os.path.join(AKAR, "zona.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(zona, f, ensure_ascii=False, indent=1)
    with open(os.path.join(AKAR, "jawaban.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(jawaban, f, ensure_ascii=False, indent=1)
    if shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "0.5", "-i", os.path.join(keluar, "%03d.jpg"), "-vf", "scale=640:-2,fps=2",
                        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", os.path.join(AKAR, "video.webm")], check=True)
    print(f"{N} cuplikan ke {keluar}")


if __name__ == "__main__":
    main()
