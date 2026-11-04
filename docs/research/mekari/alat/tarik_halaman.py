"""Tarik teks halaman publik mekari.com (produk, harga, solusi, integrasi).
Pakai: python -I tarik_hal.py pages.txt <folder_keluar>
"""
import sys, os, time, urllib.request, re, html, json

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NadiRiset/1.0"

def teks(h):
    h = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", h)
    h = re.sub(r"(?is)<header.*?</header>|<footer.*?</footer>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</tr>|</div>|</button>|</a>", "\n", h)
    h = re.sub(r"(?i)<h(\d)[^>]*>", lambda m: "\n" + "#" * int(m.group(1)) + " ", h)
    h = re.sub(r"(?i)<li[^>]*>", "- ", h)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h)
    h = re.sub(r"[ \t ]+", " ", h)
    baris = [b.strip() for b in h.split("\n")]
    keluar, lalu = [], None
    for b in baris:
        if b and b != lalu:
            keluar.append(b)
        lalu = b
    return "\n".join(keluar)

daftar = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
indeks = {}
for p in daftar:
    nama = (p.strip("/").replace("/", "__") or "beranda") + ".txt"
    f = os.path.join(out, nama)
    if os.path.exists(f):
        continue
    url = "https://mekari.com" + p
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=40) as r:
            h = r.read().decode("utf-8", "replace")
    except Exception as e:
        print("gagal", url, e, flush=True)
        continue
    judul = re.search(r"(?is)<title>(.*?)</title>", h)
    t = teks(h)
    open(f, "w", encoding="utf-8").write(url + "\n" + (html.unescape(judul.group(1)).strip() if judul else "") + "\n\n" + t)
    indeks[p] = len(t)
    time.sleep(0.5)
json.dump(indeks, open(os.path.join(out, "_indeks.json"), "w"), indent=0)
print("selesai", len(indeks))
