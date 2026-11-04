"""Gerbang cakupan riset Mekari: setiap bagian pusat bantuan di inventaris/*.md harus disebut
oleh minimal satu baris fitur.md (kolom Bagian), dan setiap baris punya status yang sah.

Pakai (dari folder docs/research/mekari):
  python -I alat/cek_cakupan.py            -> LULUS atau daftar bagian yang belum tercakup (keluar 1)
  python -I alat/cek_cakupan.py --hitung   -> juga mencetak jumlah per status
  python -I alat/cek_cakupan.py --selftest -> uji pencocokan
"""
import os, re, sys, collections

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AWALAN = {"talenta": "TA", "jurnal": "JU", "klikpajak": "KP", "qontak": "QO", "sign": "SI", "expense": "EX", "mekari": "LA"}
STATUS = {"ADA", "SEBAGIAN", "BELUM", "MITRA", "LUAR"}


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip().lower()


def baris_fitur(teks):
    """-> list (id, bagian, status)"""
    hasil = []
    for b in teks.splitlines():
        m = re.match(r"^\|\s*([A-Z]{2}-\d{2})\s*\|(.*)\|\s*$", b)
        if not m:
            continue
        sel = [x.strip() for x in m.group(2).split("|")]
        if len(sel) < 4:
            continue
        status = re.split(r"[\s:(/]", sel[3].strip())[0]
        hasil.append((m.group(1), sel[1], status))
    return hasil


def acuan(bagian):
    """'Kas & Bank/Rekonsiliasi Bank, Aturan; Video' -> [(kategori, [bagian] | None)]"""
    hasil = []
    for seg in bagian.split(";"):
        seg = seg.strip()
        if not seg or seg.lower().startswith(("halaman", "api", "tabel")):
            continue
        if "/" in seg:
            k, s = seg.split("/", 1)
            s = s.strip()
            hasil.append((norm(k), None if s == "*" else [norm(x) for x in s.split(",")]))
        else:
            hasil.append((norm(seg), None))
    return hasil


def bagian_inventaris(teks):
    """-> list (kategori, bagian)"""
    kat, hasil = None, []
    for b in teks.splitlines():
        if b.startswith("## "):
            kat = norm(b[3:])
        elif b.startswith("### ") and kat is not None:
            hasil.append((kat, norm(re.sub(r"\s*\(\d+\)\s*$", "", b[4:]))))
    return hasil


def tercakup(kat, bag, acuan_list):
    for k, ss in acuan_list:
        if not (kat == k or kat.startswith(k)):
            continue
        if ss is None:
            return True
        for s in ss:
            if bag == s or bag.startswith(s) or s.startswith(bag):
                return True
    return False


def periksa(hitung=False):
    fitur = baris_fitur(open(os.path.join(AKAR, "fitur.md"), encoding="utf-8").read())
    salah = [f for f in fitur if f[2] not in STATUS]
    per_awalan = collections.defaultdict(list)
    for fid, bagian, _ in fitur:
        per_awalan[fid[:2]].extend(acuan(bagian))
    # bagian produk lain yang tercatat di pusat bantuan umum
    per_awalan["LA"].extend(per_awalan["SI"] + per_awalan["EX"])
    kurang = []
    total = 0
    for prod, aw in AWALAN.items():
        f = os.path.join(AKAR, "inventaris", prod + ".md")
        for kat, bag in bagian_inventaris(open(f, encoding="utf-8").read()):
            total += 1
            if not tercakup(kat, bag, per_awalan[aw]):
                kurang.append(f"{prod}: {kat} / {bag}")
    c = collections.Counter(f[2] for f in fitur)
    teks = open(os.path.join(AKAR, "fitur.md"), encoding="utf-8").read()
    ringkas = {m.group(1): int(m.group(2)) for m in re.finditer(r"^\| (ADA|SEBAGIAN|BELUM|MITRA|LUAR) \| (\d+) \|$", teks, re.M)}
    if ringkas != dict(c):
        salah.append(("RINGKASAN", f"tabel ringkasan {ringkas} != hitungan {dict(c)}", "perbarui"))
    if hitung:
        print("baris fitur:", len(fitur), dict(c))
    for f in salah:
        print("STATUS TIDAK SAH:", f)
    for k in kurang:
        print("BELUM TERCAKUP:", k)
    print(f"bagian inventaris {total}, tercakup {total - len(kurang)}")
    if salah or kurang:
        print("GAGAL")
        return 1
    print("LULUS")
    return 0


def selftest():
    a = acuan("Kas & Bank/Rekonsiliasi Bank, Aturan Rekonsiliasi; Video; halaman /produk/x")
    ok = [tercakup("kas & bank", "rekonsiliasi bank otomatis", a), tercakup("video", "apa saja", a),
          not tercakup("kas & bank", "transfer uang", a), not tercakup("produk", "gudang", a)]
    f = baris_fitur("| TA-01 | x | Employees/* | y | SEBAGIAN: z | M-11 |\n| TA-02 | x | a | y | NGAWUR | - |")
    ok += [f[0] == ("TA-01", "Employees/*", "SEBAGIAN"), f[1][2] == "NGAWUR"]
    inv = bagian_inventaris("## Kas & Bank\n### Rekonsiliasi Bank (2)")
    ok += [inv == [("kas & bank", "rekonsiliasi bank")]]
    print("selftest", sum(ok), "/", len(ok))
    return 0 if all(ok) else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    sys.exit(periksa("--hitung" in sys.argv))
