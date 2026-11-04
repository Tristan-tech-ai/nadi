"""Tarik seluruh artikel pusat bantuan Zendesk publik produk Mekari (API publik, robots mengizinkan).
Pakai: python -I tarik_hc.py <folder_keluar>
"""
import json, sys, time, urllib.request, os, html, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NadiRiset/1.0"
HOST = {
    "talenta": "help-center.talenta.co",
    "jurnal": "help-center.jurnal.id",
    "qontak": "help-center.qontak.com",
    "klikpajak": "help-center.klikpajak.id",
    "mekari": "help-center.mekari.com",
    "sign": "mekarisign.zendesk.com",
    "expense": "help-center.expense.mekari.com",
}

def ambil(url):
    for coba in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("  ulang", coba, url, e, flush=True)
            time.sleep(3 * (coba + 1))
    raise SystemExit("gagal " + url)

def semua(host, loc, jenis):
    url = f"https://{host}/api/v2/help_center/{loc}/{jenis}.json?per_page=100"
    hasil = []
    while url:
        d = ambil(url)
        hasil += d.get(jenis, [])
        url = d.get("next_page")
        time.sleep(0.4)
    return hasil

def teks(h):
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", h or "")
    h = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</tr>", "\n", h)
    h = re.sub(r"(?i)<li[^>]*>", "- ", h)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h)
    h = re.sub(r"[ \t ]+", " ", h)
    h = re.sub(r"\n\s*\n+", "\n", h)
    return h.strip()

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for prod, host in HOST.items():
    loc_d = ambil(f"https://{host}/api/v2/help_center/locales.json")
    locs = [l for l in loc_d.get("locales", ["id"]) if l == "id"]
    for loc in locs:
        f = os.path.join(out, f"{prod}.{loc}.json")
        if os.path.exists(f):
            continue
        print(prod, loc, flush=True)
        cats = semua(host, loc, "categories")
        secs = semua(host, loc, "sections")
        arts = semua(host, loc, "articles")
        for a in arts:
            a["html"] = a.get("body") or ""; a["teks"] = teks(a.pop("body", ""))
        json.dump({"host": host, "locale": loc, "categories": cats, "sections": secs, "articles": arts},
                  open(f, "w", encoding="utf-8"), ensure_ascii=False)
        print(" ", len(cats), "kategori", len(secs), "bagian", len(arts), "artikel", flush=True)
