"""cek-slop: pemeriksa mesin untuk aturan [M] di docs/design/ANTI-SLOP.md (langkah `slop` di loop/gate.sh).
Memindai apps/web/src (tsx, ts, css), melewati berkas uji. Baris (atau baris sesudah komentar) yang memuat `slop-ok: <alasan>`
dikecualikan. Berkas token warna (globals.css) boleh memuat heksadesimal.
Pemakaian: python -I scripts/cek-slop.py [folder]   |   uji diri: python -I scripts/cek-slop.py --selftest"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILES = ("globals.css",)
BANNED_WORDS = ["silakan", "revolusioner", "inovatif", "memberdayakan", "solusi terbaik", "all-in-one", "seamless",
                "tingkatkan produktivitas", "game changer", "mudah dan cepat", "mohon maaf atas ketidaknyamanan"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF]")

ATURAN = [
    ("S01", re.compile(r"\b(indigo|violet|purple|fuchsia)-\d{2,3}\b"), "warna ungu/indigo dilarang"),
    ("S02", re.compile(r"linear-gradient|radial-gradient|\bbg-gradient-|\bbg-linear-"), "gradien tanpa slop-ok"),
    ("S03", re.compile(r"backdrop-blur|backdrop-filter"), "glassmorphism tanpa slop-ok"),
    ("S10", re.compile(r"\b(Inter|Roboto|Arial|Poppins)\b(?![-\w])"), "font generik dilarang"),
    ("S21", re.compile(r"\bh-screen\b|100vh"), "tinggi layar penuh dilarang; pakai 70svh atau tinggi isi"),
    ("S30", re.compile(r"\b(Lorem|John Doe|Jane Doe|Acme|TechCorp)\b|example\.com"), "isi placeholder palsu"),
    ("S31", re.compile("[—–]"), "tanda pisah panjang/en dash di UI"),
    ("S35", re.compile(r"\bRp\.?\s+\d|\bRp\.\d|\bRP\s?\d|\brp\s?\d"), "format rupiah salah; pakai formatRupiah (Rp1.250.000)"),
    ("S40", re.compile(r"\btransition-all\b|transition:\s*all\b"), "transition-all dilarang"),
    ("S41", re.compile(r"transition(-property)?:\s*[^;]*\b(width|height|top|left)\b|\btransition-\[(width|height|top|left)"), "animasi properti tata letak"),
    ("S42", re.compile(r"\bduration-(\d{4}|[4-9]\d\d)\b|transition[^;]*\b(0?\.[4-9]\d*s|[1-9]\d*(\.\d+)?s|[4-9]\d\dms|\d{4,}ms)\b"), "durasi > 300 ms"),
    ("S52", re.compile(r"\b(window\.)?(alert|confirm)\("), "alert/confirm bawaan dilarang"),
    ("S61", re.compile(r"<img\b"), "pakai next/image atau SVG"),
]
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")


def hapus_komentar(teks, css):
    teks = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), teks, flags=re.S)
    if not css:
        teks = re.sub(r"(?<![:\"'])//[^\n]*", "", teks)
    return teks


def rona_ungu(hexs):
    h = hexs.lstrip("#")
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h[:3])
    try:
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 0.15:
        return False
    if mx == r:
        hue = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / (mx - mn)) + 120
    else:
        hue = 60 * ((r - g) / (mx - mn)) + 240
    return 250 <= hue <= 300


def periksa_teks(nama, teks):
    css = nama.endswith(".css")
    asli = teks.splitlines()
    bersih = hapus_komentar(teks, css).splitlines()
    temuan = []
    for i, baris in enumerate(bersih):
        if "slop-ok" in asli[i] or (i > 0 and "slop-ok" in asli[i - 1]):
            continue
        for kode, rx, pesan in ATURAN:
            if rx.search(baris):
                temuan.append((kode, i + 1, pesan))
        for hx in HEX.findall(baris):
            if rona_ungu(hx):
                temuan.append(("S01", i + 1, f"heksadesimal ungu {hx}"))
            elif os.path.basename(nama) not in TOKEN_FILES and not css:
                temuan.append(("S05", i + 1, f"warna lepas {hx}; pakai token"))
        if not css:
            if EMOJI.search(baris):
                temuan.append(("S32", i + 1, "emoji di UI"))
            low = baris.lower()
            for k in BANNED_WORDS:
                if k in low:
                    temuan.append(("S33", i + 1, f"kata terlarang '{k}'"))
    if os.path.basename(nama) == "globals.css" and "prefers-reduced-motion" not in teks:
        temuan.append(("S43", 1, "globals.css harus menghormati prefers-reduced-motion"))
    return temuan


def pindai(folder):
    hasil = []
    for akar, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next")]
        for f in files:
            if not f.endswith((".tsx", ".ts", ".css")) or ".test." in f or f.endswith(".d.ts"):
                continue
            p = os.path.join(akar, f)
            for kode, baris, pesan in periksa_teks(p, open(p, encoding="utf-8").read()):
                hasil.append(f"{kode} {os.path.relpath(p, ROOT)}:{baris} {pesan}")
    return hasil


def selftest():
    kasus = {
        "S01": ('<div className="bg-indigo-500">x</div>', "a.tsx"), "S01b": ('const c = "#7c3aed";', "a.tsx"),
        "S02": ("background: linear-gradient(135deg, red, blue);", "a.css"), "S03": ('<div className="backdrop-blur">', "a.tsx"),
        "S05": ('<p style={{ color: "#123456" }}>x</p>', "a.tsx"), "S10": ("font-family: Inter, sans-serif;", "a.css"),
        "S21": ('<section className="h-screen">', "a.tsx"), "S30": ("<p>John Doe</p>", "a.tsx"), "S31": ("<p>Cepat — mudah</p>", "a.tsx"),
        "S32": ("<p>Halo \U0001F44B</p>", "a.tsx"), "S33": ("<p>Silakan masuk</p>", "a.tsx"), "S35": ("<p>Rp 10.000</p>", "a.tsx"),
        "S40": ('<a className="transition-all">', "a.tsx"), "S41": ("transition: width 200ms;", "a.css"),
        "S42": ('<a className="duration-500">', "a.tsx"), "S52": ('alert("x")', "a.tsx"), "S61": ('<img src="a.png" />', "a.tsx"),
        "S43": (":root { --a: 1; }", "globals.css"),
    }
    ok = tot = 0
    for kode, (teks, nama) in kasus.items():
        tot += 1
        got = {k for k, _, _ in periksa_teks(nama, teks)}
        hit = kode[:3] in got
        ok += hit
        print(("ok  " if hit else "BAD ") + f"{kode} terdeteksi", sorted(got))
    bersih = [
        ('<p className="text-tinta">Rp1.250.000</p>', "a.tsx"),
        ("// bg-indigo-500 hanya di komentar\nconst x = 1;", "a.tsx"),
        ('/* slop-ok: satu gradien hero */\n.h { background: linear-gradient(red, blue); }', "a.css"),
        (":root { --kertas: #F6F2EA; }\n@media (prefers-reduced-motion: reduce) { * { transition: none; } }", "globals.css"),
        ('<a className="transition-colors duration-150">', "a.tsx"),
    ]
    for teks, nama in bersih:
        tot += 1
        got = periksa_teks(nama, teks)
        ok += not got
        print(("ok  " if not got else "BAD ") + "kode bersih lolos", got)
    print(f"SELFTEST cek-slop: {ok} dari {tot}", "LULUS" if ok == tot else "GAGAL")
    return 0 if ok == tot else 1


if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]:
        sys.exit(selftest())
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "apps", "web", "src")
    temuan = pindai(folder)
    for t in temuan:
        print(t)
    print("SLOP BERSIH" if not temuan else f"{len(temuan)} PELANGGARAN ANTI-SLOP")
    sys.exit(1 if temuan else 0)
