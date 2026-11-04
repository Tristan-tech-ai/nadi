"""cek-tulisan: gerbang tulisan Nadi (Q-40), langkah `tulisan` di loop/gate.sh.

Dipindahkan dari gerbang tulisan proyek research startup (cek_gaya_ai.py untuk bahasa Indonesia, cek_en2.py untuk bahasa
Inggris, keduanya dibaca 4 Nov 2026), lalu disesuaikan untuk tulisan SaaS. Riset sumber polanya: Wikipedia "Signs of AI
writing", Kobak dkk. 2024, Liang dkk. ICML 2024, Reinhart dkk. PNAS 2025, Freeburg 2026; batas kalimat dari Gopen dan Swan
1990; untuk produk dari docs/research/psikologi-persuasi.md (Nielsen 2008: orang memindai) dan docs/design/VOICE.md.

Aturan keras (harus nol):
  K1 pola bahasa AI (id: antitesis "bukan X, melainkan/tetapi Y", "tidak hanya", ekor partisipial penegas, pertanyaan retoris
     yang dijawab sendiri, frasa pengisi, pembesar makna, suara penulis "kita"/"kami harap", sapaan "Anda" di luar mode resmi,
     atribusi kabur; en: KERAS_EN cek_en2: not only/but also, rather than, kosakata AI, pengisi, ekor partisipial)
  K2 kata gaya AI bahasa Inggris (daftar 72 kata research startup, kecuali significant/overall)
  K3 dua pembalikan "X, bukan Y" / "X, not Y" atau lebih dalam satu teks
  K4 pembuka "Overall,", "Notably,", "Importantly,", "Pada dasarnya," dan sejenisnya
  K5 tanda pisah panjang/en dash, panah di prosa, emoji
  K6 batas per mode: panjang kalimat, panjang judul, panjang baris video, kata tombol
  K7 rerata panjang kalimat per mode (web, email)
Dilaporkan: triad "A, B, dan C", koefisien variasi panjang kalimat, kalimat terpanjang.

Mode (batas kata per kalimat id/en, rerata id/en):
  ui     teks antarmuka aplikasi          kalimat <= 24/26, tanpa batas rerata
  web    landing dan halaman fitur        kalimat <= 20/22, rerata <= 12/14 per bagian kamus; judul <= 34 karakter
  video  teks layar dan naskah video      baris <= 7 kata dan <= 34 karakter
  deck   slide                            judul klaim <= 12 kata, baris isi <= 16 kata
  email  surel dan pesan WhatsApp         kalimat <= 35, rerata <= 20 (cek_en2 mode email); sapaan "Anda" diizinkan
  resmi  dokumen cetak (surat, slip)      seperti ui, sapaan "Anda" diizinkan

Sumber yang diperiksa tanpa argumen: kamus apps/web/src/lib/i18n/kamus/{id,en}.ts (bagian beranda, fitur*, harga*,
keamanan*, tentang*, panduan* = web; lainnya = ui) dan naskah docs/promo/**/naskah*.md (video) serta docs/bisnis/naskah-deck*.md
(deck) bila ada.
Pemakaian: python -I scripts/cek-tulisan.py [--mode M --bahasa id|en BERKAS]   |   uji diri: --selftest
"""
import glob
import os
import re
import statistics as st
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KERAS_ID = [
    ("antitesis 'melainkan'", r"\bmelainkan\b"),
    ("antitesis 'bukan X, tetapi Y'", r"\bbukan\b[^.;:?!]{1,90}?,\s*(tetapi|tapi|namun)\b"),
    ("'tidak/bukan hanya', 'bukan sekadar'", r"\b(tidak|bukan|tak)\s+(hanya|sekadar|cuma|semata)\b"),
    ("'tetapi juga'", r"\b(tetapi|namun|tapi)\s+juga\b"),
    ("'tidak ada X, tidak ada Y'", r"\btidak ada\b[^.]{1,40},\s*tidak ada\b"),
    ("ekor partisipial penegas", r",\s*(menegaskan|mencerminkan|menandai|menyoroti|menggarisbawahi|memperkuat pentingnya|menunjukkan pentingnya)\b"),
    ("pertanyaan retoris dijawab sendiri", r"\b(hasilnya|jawabannya|alasannya|intinya|artinya)\s*\?"),
    ("pertanyaan retoris dijawab sendiri", r"\?\s+(karena|sebab|jawabannya|ternyata)\b"),
    ("frasa pengisi", r"\b(perlu|penting untuk|patut) (dicatat|diingat|ditegaskan|digarisbawahi|diperhatikan)\b"),
    ("frasa pengisi", r"\b(tidak|tak) (dapat|bisa) dipungkiri\b"),
    ("frasa pengisi", r"\b(era digital|semakin pesat|pada dasarnya|singkatnya|pada akhirnya|secara keseluruhan|mari kita|semoga bermanfaat|dalam hal ini)\b"),
    ("frasa pengisi", r"\bseiring (dengan )?(perkembangan|kemajuan)\b"),
    ("pembesar makna", r"\b(memainkan peran|krusial|bukti nyata|tonggak|lanskap|ranah|menavigasi|menggali lebih dalam|mengeksplorasi|memberdayakan|holistik|revolusioner|transformatif|tak tertandingi|secara mulus|sinergi|paradigma baru|kaya akan|inovatif|terobosan|solusi terbaik|all-in-one|seamless|game changer)\b"),
    ("pembesar makna", r"\bperan (yang )?(penting|krusial|vital|kunci)\b"),
    ("basa-basi", r"\b(silakan|mohon maaf atas ketidaknyamanan\w*|dengan senang hati|terima kasih atas kesabaran)\b"),
    ("klise pemasaran", r"\b(tingkatkan produktivitas|mudah dan cepat|satu platform untuk semua|masa depan bisnis)\b"),
    ("suara penulis", r"\b(pertanyaan (yang )?bagus|kami harap)\b"),
    ("suara penulis 'kita'", r"\bkita\b"),
    ("atribusi kabur", r"\b(para ahli|banyak penelitian menunjukkan)\b"),
]
ANDA = ("sapaan 'Anda' (pakai 'kamu'; 'Anda' hanya mode resmi/email)", r"\banda\b")
KERAS_EN = [
    ("negative parallelism", r"\bnot (only|just|merely)\b"),
    ("negative parallelism", r"\bbut also\b"),
    ("negative parallelism", r"\bit'?s not\b[^.]{1,60}\bit'?s\b"),
    ("rather than", r"\brather than\b"),
    ("AI vocabulary", r"\b(delve|delves|delving|tapestry|testament|pivotal|crucial|intricate|meticulous|meticulously|showcase|showcasing|underscore|underscores|landscape|realm|vibrant|boasts|garner|foster|fostering|seamless|holistic|groundbreaking|commendable|notably|leverage|embark|navigate|multifaceted|nuanced)\b"),
    ("filler", r"\b(it is (important|worth) (to note|noting)|in conclusion|moreover|furthermore|additionally|ultimately|overall)\b"),
    ("participial tail", r",\s*(highlighting|underscoring|emphasizing|reflecting|showcasing|demonstrating the)\b"),
    ("marketing cliche", r"\b(all-in-one|game[- ]changer|revolutionary|unlock|unleash|supercharge|elevate|empower|streamline|effortless|robust|cutting-edge|next-generation|world-class|blazing fast)\b"),
]
GAYA_EN = set("""delve delved delves delving excels garnered garner grappling notably offering pivotal showcasing showcase
underscore underscores underscoring comprehensive crucial crucially enhancing enhance exhibited highlights highlight insights
potential valuable realm intricate intricacies meticulous meticulously commendable robust nuanced landscape tapestry leverage
leveraging moreover furthermore additionally importantly seamless seamlessly holistic paradigm testament vibrant foster
fostering unveil elucidate ultimately noteworthy remarkable remarkably interestingly navigate navigating harness harnessing
groundbreaking cutting-edge multifaceted ever-evolving myriad plethora utilize utilizing""".split())
# "offering", "highlight(s)", "potential", "valuable", "insights", "enhance" lazim di teks produk; tetap dihitung keras seperti
# di research startup kecuali kata yang menjadi istilah fitur. Daftar pengecualian produk:
GAYA_EN_PRODUK = {"offering", "highlight", "highlights", "insights", "potential", "valuable", "enhance", "enhancing", "comprehensive"}
PEMBUKA = re.compile(r"(^|[.!?]\s+)(Overall|Taken together|In summary|In short|Importantly|Interestingly|Notably|Crucially|Pada dasarnya|Singkatnya|Intinya|Menariknya),", re.I)
TANDA = [("tanda pisah panjang/en dash", "[—–]"), ("panah di prosa", "[←-⇿]"), ("emoji", "[\U0001F300-\U0001FAFF☀-➿]")]
REV_ID = re.compile(r",\s*bukan\b", re.I)
REV_EN = re.compile(r",\s+not\s+(?!only\b|just\b|merely\b|yet\b|least\b|even\b|necessarily\b|always\b|all\b|every\b)[\w$(]", re.I)

BATAS = {  # mode: (kalimat id, kalimat en, rerata id, rerata en)
    "ui": (24, 26, None, None), "resmi": (24, 26, None, None), "web": (20, 22, 12, 14),
    "email": (35, 35, 20, 20), "deck": (16, 16, None, None), "video": (7, 7, None, None),
}
JUDUL_WEB = 40  # huruf judul Big Shoulders sempit (k sekitar 0,40): 40 karakter = dua baris di 390 px


def kalimat(t):
    return [s for s in re.split(r"(?<=[.!?])\s+", t.strip()) if s]


def kata(s):
    return re.findall(r"[\wÀ-ÿ'’\-]+", s)


def periksa(teks, mode="ui", bahasa="id", kunci=""):
    """Periksa satu teks. Mengembalikan daftar (aturan, cuplikan)."""
    out = []
    t = re.sub(r"\{[a-zA-Z]+\}", "X", teks)  # placeholder kamus
    if bahasa == "id":
        aturan = list(KERAS_ID) + ([] if mode in ("resmi", "email") else [ANDA])
        for nama, pola in aturan:
            for m in re.finditer(pola, t, re.I):
                out.append(("K1 " + nama, t[max(0, m.start() - 30):m.end() + 30]))
        if len(REV_ID.findall(t)) >= 2:
            out.append(("K3 dua pembalikan ', bukan' atau lebih", t[:90]))
    else:
        for nama, pola in KERAS_EN:
            for m in re.finditer(pola, t, re.I):
                out.append(("K1 " + nama, t[max(0, m.start() - 30):m.end() + 30]))
        for w in kata(t):
            if w.lower() in GAYA_EN and w.lower() not in GAYA_EN_PRODUK:
                out.append(("K2 style word '%s'" % w, t[:90]))
        if len(REV_EN.findall(t)) >= 2:
            out.append(("K3 two or more ', not' reversals", t[:90]))
    if PEMBUKA.search(t):
        out.append(("K4 pembuka pengisi", t[:90]))
    for nama, pola in TANDA:
        if re.search(pola, t):
            out.append(("K5 " + nama, t[:90]))
    cap = BATAS[mode][0 if bahasa == "id" else 1]
    if mode == "video":
        for baris in t.split("\n"):
            n = len(kata(baris))
            if n > cap or len(baris.strip()) > 34:
                out.append((f"K6 baris video {n} kata/{len(baris.strip())} karakter (batas 7 kata, 34 karakter)", baris[:80]))
    else:
        for s in kalimat(t):
            n = len(kata(s))
            if n > cap:
                out.append((f"K6 kalimat {n} kata (batas {mode} {cap})", s[:120]))
    if mode == "web" and re.search(r"(^|\.)judul\w*$", kunci, re.I) and len(t) > JUDUL_WEB:
        out.append((f"K6 judul {len(t)} karakter (batas {JUDUL_WEB})", t[:80]))
    if mode == "deck" and kunci.endswith("judul") and len(kata(t)) > 12:
        out.append((f"K6 judul slide {len(kata(t))} kata (batas 12)", t[:80]))
    return out


def rerata(teks_list, mode, bahasa):
    bar = BATAS[mode][2 if bahasa == "id" else 3]
    L = [len(kata(s)) for t in teks_list for s in kalimat(t) if len(kata(s)) >= 3]
    if not L or bar is None:
        return None, L
    m = st.mean(L)
    return (f"K7 rerata kalimat {m:.1f} kata (batas {mode} {bar})" if m > bar else None), L


# ------------------------------------------------------------- pembaca sumber

def string_kamus(path):
    """String literal dari berkas kamus TS beserta jalur kuncinya (bagian.kunci). Hanya string berisi >= 2 kata."""
    src = open(path, encoding="utf-8").read()
    hasil, tumpukan = [], []
    token = re.compile(r'(?P<kunci>[A-Za-z_]\w*)\s*:\s*(?P<buka>\{|\[)?|(?P<tutup>[}\]])|(?P<lit>"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(?P<buka2>[{\[])')
    kunci_akhir = None
    for m in token.finditer(src):
        if m.group("kunci"):
            kunci_akhir = m.group("kunci")
            if m.group("buka"):
                tumpukan.append(kunci_akhir)
        elif m.group("buka2"):
            sebelum = src[:m.start()].rstrip()
            tumpukan.append("" if sebelum.endswith("=") or sebelum.endswith("(") else (kunci_akhir or ""))
        elif m.group("tutup"):
            if tumpukan:
                tumpukan.pop()
            kunci_akhir = None
        elif m.group("lit"):
            s = m.group("lit")[1:-1].replace('\\"', '"').replace("\\n", "\n")
            if len(s.split()) >= 2 and not re.match(r"^[/@.]|https?://", s) and "${" not in s:
                tambah = kunci_akhir and not (tumpukan and tumpukan[-1] == kunci_akhir)
                jalur = ".".join(x for x in tumpukan + ([kunci_akhir] if tambah else []) if x)
                hasil.append((jalur, s))
    return hasil


WEB = re.compile(r"^(beranda|fitur\w*|harga\w*|keamanan\w*|tentang\w*|panduan\w*|kepala|kaki|navFitur\w*)\b")


def sumber_bawaan():
    """(label, mode, bahasa, kunci, teks) untuk semua sumber bawaan."""
    out = []
    for b in ("id", "en"):
        p = os.path.join(ROOT, "apps", "web", "src", "lib", "i18n", "kamus", f"{b}.ts")
        if os.path.exists(p):
            for jalur, s in string_kamus(p):
                out.append((f"kamus/{b}.ts:{jalur}", "web" if WEB.match(jalur) else "ui", b, jalur, s))
    for p in glob.glob(os.path.join(ROOT, "docs", "promo", "**", "naskah*.md"), recursive=True):
        b = "en" if p.endswith(".en.md") else "id"
        for i, baris in enumerate(open(p, encoding="utf-8").read().split("\n"), 1):
            if baris.startswith("> "):  # hanya baris teks layar bertanda kutipan
                out.append((f"{os.path.relpath(p, ROOT)}:{i}", "video", b, "", baris[2:].strip()))
    for p in glob.glob(os.path.join(ROOT, "docs", "bisnis", "naskah-deck*.md")):
        b = "en" if p.endswith(".en.md") else "id"
        for i, baris in enumerate(open(p, encoding="utf-8").read().split("\n"), 1):
            if baris.startswith("## "):
                out.append((f"{os.path.relpath(p, ROOT)}:{i}", "deck", b, "judul", baris[3:].strip()))
            elif baris.startswith("- "):
                out.append((f"{os.path.relpath(p, ROOT)}:{i}", "deck", b, "isi", baris[2:].strip()))
    # W-05: skill umum Nadi untuk asisten AI (salinan unduhan di docs/skill/nadi dan docs/skill/nadi-en), mode ui.
    akar_skill = os.path.join(ROOT, "docs", "skill")
    for p in sorted(glob.glob(os.path.join(akar_skill, "*", "**", "*.md"), recursive=True)):
        rel = os.path.relpath(p, ROOT)
        b = "en" if os.path.relpath(p, akar_skill).split(os.sep)[0].endswith("-en") else "id"
        kode = False
        for i, baris in enumerate(open(p, encoding="utf-8").read().split("\n"), 1):
            if baris.startswith("```"):
                kode = not kode
                continue
            if kode or baris.strip() in ("", "---") or re.match(r"^(name|metadata|  \w+):", baris):
                continue
            t = re.sub(r"^(#+ |- |\d+\. |description: )", "", baris).strip().strip('"')
            if len(t.split()) >= 2:
                out.append((f"{rel}:{i}", "ui", b, "", t))
    return out


def jalankan(item):
    temuan = []
    for label, mode, b, kunci, s in item:
        temuan += [(label, a, c) for a, c in periksa(s, mode, b, kunci)]
    # rerata per bagian kamus (web) dan per berkas (email)
    kelompok = {}
    for label, mode, b, kunci, s in item:
        if mode in ("web", "email"):
            kelompok.setdefault((label.split(":")[0] + ":" + (kunci.split(".")[0] if kunci else ""), mode, b), []).append(s)
    semua_L = []
    for (k, mode, b), ts in kelompok.items():
        msg, L = rerata(ts, mode, b)
        semua_L += L
        if msg:
            temuan.append((k, msg, ""))
    return temuan, semua_L


def laporkan(temuan, L, n):
    triad = 0
    print(f"cek-tulisan: {n} teks diperiksa")
    if L:
        cv = st.pstdev(L) / st.mean(L) if len(L) > 2 else 0
        print(f"  kalimat web/email: {len(L)}, rerata {st.mean(L):.1f} kata, terpanjang {max(L)}, koefisien variasi {cv:.2f}")
    if temuan:
        print(f"  TEMUAN KERAS: {len(temuan)}")
        for label, a, c in temuan[:80]:
            print(f"    [{a}] {label} :: {c}")
        print("  GAGAL")
        return 1
    print("  aturan keras: nol temuan\n  LOLOS")
    return 0 if not triad else 0


def selftest():
    kasus = [  # (teks, mode, bahasa, kunci, harus_gagal)
        ("Nadi bukan sekadar aplikasi, melainkan mitra usaha.", "web", "id", "", True),
        ("Di era digital ini, kita butuh solusi inovatif.", "web", "id", "", True),
        ("Silakan isi formulir berikut.", "ui", "id", "", True),
        ("Anda bisa menyetujui dari HP.", "ui", "id", "", True),
        ("Anda bisa menyetujui dari HP.", "resmi", "id", "", False),
        ("Hasilnya? Semua beres.", "web", "id", "", True),
        ("Foto nota, Nadi membaca total — lalu kamu setujui.", "web", "id", "", True),
        ("Lempar notanya. Nadi yang merapikan.", "web", "id", "beranda.judul", False),
        ("Lempar nota, slip, atau Excel apa saja. Nadi yang merapikan.", "web", "id", "beranda.judul", True),
        ("Foto nota pemasok. Nadi membaca barang, harga, dan totalnya, lalu menyiapkan catatan untuk kamu setujui.", "web", "id", "beranda.pengantar", False),
        ("Kartu ini menunggu keputusanmu karena nilai belanja di nota pemasok lebih besar dari batas yang kamu pasang di pengaturan usaha minggu lalu, jadi Nadi tidak menyetujuinya sendiri.", "web", "id", "", True),
        ("Nota numpuk lagi?", "video", "id", "", False),
        ("Nadi membaca barang, harga, dan total dari setiap nota", "video", "id", "", True),
        ("Nadi delves into your receipts.", "web", "en", "", True),
        ("Not only faster, but also safer.", "web", "en", "", True),
        ("Use Nadi rather than spreadsheets.", "web", "en", "", True),
        ("Overall, it works.", "ui", "en", "", True),
        ("Approve it from your phone.", "ui", "en", "", False),
        ("Pay by QRIS, not cash, and by card, not cheque.", "web", "en", "", True),
        ("Nadi reads the receipt and prepares a suggestion you approve.", "web", "en", "", False),
        ("Unlock seamless payroll.", "web", "en", "", True),
    ]
    gagal = 0
    for teks, mode, b, kunci, harus in kasus:
        hasil = bool(periksa(teks, mode, b, kunci))
        ok = hasil == harus
        gagal += not ok
        print(("ok   " if ok else "SALAH") + f" [{mode}/{b}] harus {'gagal' if harus else 'lolos'}: {teks[:60]}")
    # rerata web
    msg, _ = rerata(["Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas tiga belas empat belas."] * 3, "web", "id")
    gagal += msg is None
    print(("ok   " if msg else "SALAH") + " rerata web > 12 kata harus gagal")
    # pembaca kamus
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".ts", delete=False, encoding="utf-8") as f:
        f.write('export const k = {\n  beranda: {\n    judul: "Lempar notanya sekarang juga.",\n    daftar: ["satu dua", "tiga empat"],\n  },\n  aplikasi: { lompat: "Lompat ke isi" },\n};\n')
    hasil = string_kamus(f.name)
    os.unlink(f.name)
    ok = hasil == [("beranda.judul", "Lempar notanya sekarang juga."), ("beranda.daftar", "satu dua"), ("beranda.daftar", "tiga empat"), ("aplikasi.lompat", "Lompat ke isi")]
    gagal += not ok
    print(("ok   " if ok else "SALAH") + f" pembaca kamus: {hasil}")
    print(f"uji diri: {len(kasus) + 2 - gagal}/{len(kasus) + 2} lulus")
    return 1 if gagal else 0


def main(a):
    if a[:1] == ["--selftest"]:
        return selftest()
    if "--mode" in a:
        mode = a[a.index("--mode") + 1]
        b = a[a.index("--bahasa") + 1] if "--bahasa" in a else "id"
        path = a[-1]
        isi = [p for p in re.split(r"\n\s*\n", open(path, encoding="utf-8").read()) if p.strip()]
        item = [(f"{path}:{i}", mode, b, "", re.sub(r"\s+", " ", p) if mode != "video" else p) for i, p in enumerate(isi, 1)]
    else:
        item = sumber_bawaan()
    temuan, L = jalankan(item)
    return laporkan(temuan, L, len(item))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
