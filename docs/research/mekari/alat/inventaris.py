"""Susun inventaris per produk dari arsip pusat bantuan: pohon menu (kategori > bagian > artikel),
jalur klik (label tebal berurutan di langkah), dan tabel elemen layar (Nama tombol/bagian -> fungsi).
Pakai: python -I inventaris.py hc2 <folder_keluar>
"""
import json, re, html, sys, os, glob, collections

NAMA = {"talenta": "Mekari Talenta (HRIS, payroll, absensi, rekrutmen, kinerja, LMS)",
        "jurnal": "Mekari Jurnal (akuntansi, persediaan, produksi, Mekari Pay)",
        "qontak": "Mekari Qontak (omnichannel, CRM, kampanye, chatbot, tiket)",
        "klikpajak": "Mekari Klikpajak (e-Faktur, e-Bupot, e-Billing, SPT, Coretax)",
        "mekari": "Pusat bantuan Mekari umum (Flex, Officeless, POS, Account, Partners, Capital)",
        "sign": "Mekari Sign (tanda tangan elektronik, e-Meterai, kontrak, approval)",
        "expense": "Mekari Expense (klaim, perjalanan dinas, pembelian, kartu korporat)"}

def bersih(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s).replace("�", "")
    return re.sub(r"\s+", " ", s).strip(" .:-")

def pendek(s, n=110):
    s = bersih(s)
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "..."

def jalur(h):
    hasil = []
    h = re.sub(r"(?is)<table.*?</table>", " ", h)
    for li in re.findall(r"(?is)<li[^>]*>(.*?)</li>", h)[:12]:
        if not re.search(r"(?i)klik|pilih|menu|masuk|buka|click|select|go to|tekan|tap", li):
            continue
        for b in re.findall(r"(?is)<(?:strong|b)>(.*?)</(?:strong|b)>", li):
            t = bersih(b)
            if 1 < len(t) <= 40 and t.lower() not in ("penting", "catatan", "note", "keterangan") and (not hasil or hasil[-1] != t):
                hasil.append(t)
    return hasil[:10]

def elemen(h):
    hasil = []
    for tabel in re.findall(r"(?is)<table.*?</table>", h):
        baris = re.findall(r"(?is)<tr.*?</tr>", tabel)
        if not baris:
            continue
        kepala = " ".join(bersih(x).lower() for x in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", baris[0]))
        if not re.search(r"tombol|bagian|kolom|field|menu|fitur|button|section|column|nama|name|status|filter|ikon|icon", kepala):
            continue
        for b in baris[1:]:
            sel = [bersih(x) for x in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", b)]
            sel = [x for x in sel if x]
            if sel and re.fullmatch(r"\d+[a-z]?\.?", sel[0]):
                sel = sel[1:]
            if len(sel) >= 2 and len(sel[0]) <= 60:
                hasil.append((sel[0], pendek(sel[1])))
            elif len(sel) == 1 and len(sel[0]) <= 60:
                hasil.append((sel[0], ""))
    return hasil

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
ringkas = {}
for f in sorted(glob.glob(os.path.join(src, "*.id.json"))):
    prod = os.path.basename(f).split(".")[0]
    d = json.load(open(f, encoding="utf-8"))
    cats = {c["id"]: c for c in d["categories"]}
    secs = {s["id"]: s for s in d["sections"]}
    per = collections.defaultdict(list)
    for a in d["articles"]:
        per[a["section_id"]].append(a)
    n_el = n_j = 0
    L = [f"# Inventaris {NAMA.get(prod, prod)}", "",
         f"Sumber: pusat bantuan publik https://{d['host']} (API Help Center, locale id), diambil 4 Nov 2026.",
         f"Isi: {len(d['categories'])} kategori, {len(d['sections'])} bagian, {len(d['articles'])} artikel.",
         "Per artikel: judul (tautan), jalur klik (label tebal berurutan di langkah), dan elemen layar dari tabel",
         "'nama tombol/bagian' (fungsi diringkas). Teks artikel tidak disalin; baca tautannya untuk detail.", ""]
    for c in sorted(d["categories"], key=lambda c: c.get("position", 0)):
        L.append(f"## {bersih(c['name'])}")
        for s in sorted([s for s in d["sections"] if s["category_id"] == c["id"]], key=lambda s: s.get("position", 0)):
            arts = sorted(per.get(s["id"], []), key=lambda a: a.get("position", 0))
            if not arts:
                continue
            L.append(f"### {bersih(s['name'])} ({len(arts)})")
            for a in arts:
                L.append(f"- [{bersih(a['title'])}]({a['html_url']}) ({a.get('updated_at','')[:10]})")
                j = jalur(a.get("html", ""))
                if j:
                    n_j += 1
                    L.append(f"  - Jalur: {' > '.join(j)}")
                el = elemen(a.get("html", ""))
                if el:
                    n_el += len(el)
                    L.append("  - Elemen: " + "; ".join(f"{n} ({k})" if k else n for n, k in el[:40]))
        L.append("")
    open(os.path.join(out, f"{prod}.md"), "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
    ringkas[prod] = {"kategori": len(d["categories"]), "bagian": len(d["sections"]), "artikel": len(d["articles"]),
                     "artikel_berjalur": n_j, "elemen_layar": n_el}
json.dump(ringkas, open(os.path.join(out, "_ringkas.json"), "w"), indent=1)
print(json.dumps(ringkas, indent=1))
