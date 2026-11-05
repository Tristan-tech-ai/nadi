# M-18B: korpus foto struk sintetis dari teks struk fixtures/korpus/struk/*.txt (jawaban di harapan.json yang sama).
# Tiap struk dirender ke kertas thermal (IBM Plex Mono, OFL), lalu difoto: miring, kabur, bayangan, derau, JPEG kualitas
# rendah, di atas meja. Deterministik (benih per berkas). Jalankan dari akar repo: python -I apps/web/scripts/korpus/struk-foto.py
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
SUMBER = os.path.join(AKAR, "fixtures", "korpus", "struk")
KELUAR = os.path.join(AKAR, "fixtures", "korpus", "struk-foto")
# Set "sulit": setengah resolusi, kabur dan miring lebih kuat, JPEG kualitas 40 (foto cepat di tempat gelap).
TINGKAT = {"": (0.3, 0.8, 4, 55, 75, 1.0), "sulit": (1.0, 1.6, 8, 38, 45, 0.5)}
FONT = os.path.join(AKAR, "docs", "promo", "film", "assets", "fonts", "plexmono.woff2")
for tingkat, (b0, b1, miring, q0, q1, skala) in TINGKAT.items():
  keluar = os.path.join(KELUAR, tingkat) if tingkat else KELUAR
  os.makedirs(keluar, exist_ok=True)
  for nama in sorted(f for f in os.listdir(SUMBER) if f.endswith(".txt")):
    r = random.Random(nama + tingkat)
    baris = open(os.path.join(SUMBER, nama), encoding="utf8").read().splitlines()
    uk = 22
    f = ImageFont.truetype(FONT, uk)
    lebar = max(int(f.getlength(b)) for b in baris) + 60
    tinggi = len(baris) * int(uk * 1.45) + 70
    kertas = Image.new("L", (lebar, tinggi), 246)
    d = ImageDraw.Draw(kertas)
    for i, b in enumerate(baris):
        # cetak thermal: tinta tidak rata
        d.text((30, 35 + i * int(uk * 1.45)), b, font=f, fill=r.randint(25, 70))
    kertas = kertas.filter(ImageFilter.GaussianBlur(r.uniform(b0, b1)))
    sudut = r.uniform(-miring, miring)
    kertas = kertas.convert("RGBA").rotate(sudut, expand=True, resample=Image.BICUBIC)
    meja = Image.new("RGB", (kertas.width + 160, kertas.height + 160), (r.randint(90, 140), r.randint(80, 120), r.randint(60, 100)))
    meja.paste(kertas, (80, 80), kertas)
    # bayangan tangan/lampu: gradien gelap di satu sisi
    bay = Image.new("L", meja.size, 0)
    db = ImageDraw.Draw(bay)
    for x in range(meja.width):
        db.line([(x, 0), (x, meja.height)], fill=int(70 * max(0.0, 1 - x / (meja.width * r.uniform(0.4, 0.9)))))
    meja = Image.composite(Image.new("RGB", meja.size, (0, 0, 0)), meja, bay)
    # derau sensor
    px = meja.load()
    for _ in range(meja.width * meja.height // 25):
        x, y = r.randrange(meja.width), r.randrange(meja.height)
        v = r.randint(-30, 30)
        c = px[x, y]
        px[x, y] = tuple(max(0, min(255, k + v)) for k in c)
    if skala != 1.0:
        meja = meja.resize((int(meja.width * skala), int(meja.height * skala)), Image.BILINEAR)
    meja.save(os.path.join(keluar, nama.replace(".txt", ".jpg")), quality=r.randint(q0, q1))
print("ok", len(os.listdir(KELUAR)))
