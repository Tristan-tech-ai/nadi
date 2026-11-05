"""Paket audio video Nadi v2 (V-05): tujuh efek + sonic logo + bed musik, semuanya dari bahan mentah berlisensi bebas
yang diolah dengan rantai olah.py (V-02). Resep tiap efek tertulis di fungsi di bawah dan bisa diulang persis.

Pakai:  python buat.py <folder-mentah> <folder-keluar>
Folder mentah (unduh dulu dari URL di SUMBER, lihat juga docs/ASSETS.md): klik.wav, kertas.ogg, mesin.ogg, ketik.mp3,
whoosh.mp3, swipe.mp3, lagu-krux.mp3. Keluaran: berkas efek .wav 48 kHz mono berpuncak -3 dBTP, uji-20dtk.wav
(bed + efek di bingkai, -14 LUFS), laporan.json.
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio"))
from olah import SR, baca, durasi, ff, ir_ruang, jendela_terkuat, lapis, normalkan, olah, puncak, reverb, tulis, ukur  # noqa: E402

SUMBER = {
    "klik.wav": ("Computer Mouse Click.wav", "https://commons.wikimedia.org/wiki/File:Computer_Mouse_Click.wav", "CC0"),
    "kertas.ogg": ("Book paper pages assorted.ogg", "https://commons.wikimedia.org/wiki/File:Book_paper_pages_assorted.ogg", "domain publik"),
    "mesin.ogg": ("Stomping machine.ogg", "https://commons.wikimedia.org/wiki/File:Stomping_machine.ogg", "domain publik"),
    "ketik.mp3": ("Keyboard Typing (fennelliott)", "https://freesound.org/people/fennelliott/sounds/379418", "CC0"),
    "whoosh.mp3": ("Swosh swoosh whoosh air sound (qubodup)", "https://freesound.org/people/qubodup/sounds/60026", "CC0"),
    "swipe.mp3": ("Swipe Whoosh (qubodup)", "https://freesound.org/people/qubodup/sounds/60007", "CC0"),
    "lagu-krux.mp3": ("Inspiring Advertising - Upbeat Summer Corporate (Rafael Krux, filmmusic.io)",
                      "https://commons.wikimedia.org/wiki/File:Rafael_Krux_-_Inspiring_Advertising_-_Upbeat_Summer_Corporate_(cc-by)_(filmmusic).mp3", "CC BY 4.0"),
}
FPS = 30
BPM = 117.45  # diukur librosa pada lagu-krux (V-05); bar = 4 ketukan
MULAI_LAGU = 15.0  # bagian penuh pertama (RMS naik dari -20 ke -13,7 dB pada 15-20 dtk)


def buat(mentah, hasil):
    os.makedirs(hasil, exist_ok=True)
    m = lambda n: os.path.join(mentah, n)
    t = lambda n: os.path.join(hasil, "_" + n)
    o = lambda n: os.path.join(hasil, n)
    ir_ruang(t("ir.wav"))
    ir_ruang(t("ir-panjang.wav"), detik=2.0, rt60=1.4, terang=0.35, benih=21)
    resep = {}

    # klik: transien 0,12 dtk, highpass 150 Hz, +3 dB 4 kHz, kompresi 4:1, ruang 12%.
    awal = jendela_terkuat(m("klik.wav"), 0.12)
    olah(m("klik.wav"), t("klik.wav"), "highpass=f=150,equalizer=f=4000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=4:attack=0.5:release=40,afade=t=out:st=0.09:d=0.03", awal, 0.12)
    reverb(t("klik.wav"), t("ir.wav"), t("klik2.wav"), 0.12); puncak(t("klik2.wav"), o("klik.wav"))
    resep["klik"] = "klik.wav: jendela terkuat 0,12 dtk; highpass 150; +3 dB 4 kHz; kompresor 4:1; ruang 12%; -3 dBTP"

    # ketik: 1,2 dtk ketikan terpadat, pita 250 Hz-10 kHz, kompresi lembut, fade.
    awal = jendela_terkuat(m("ketik.mp3"), 1.2)
    olah(m("ketik.mp3"), t("ketik.wav"), "highpass=f=250,lowpass=f=10000,equalizer=f=3000:t=q:w=1:g=-2,acompressor=threshold=-20dB:ratio=2.5:attack=2:release=60,afade=t=in:d=0.02,afade=t=out:st=1.0:d=0.2", awal, 1.2)
    puncak(t("ketik.wav"), o("ketik.wav"))
    resep["ketik"] = "ketik.mp3: jendela terkuat 1,2 dtk; pita 250-10k; -2 dB 3 kHz; kompresor 2,5:1; fade; -3 dBTP"

    # cap/setujui: transien klik -3 semitone, badan dentum mesin lowpass 400 Hz (+8 ms), ekor reverb, lem 3:1.
    awal_k = jendela_terkuat(m("klik.wav"), 0.1)
    olah(m("klik.wav"), t("cap-t.wav"), f"asetrate={int(SR * 2 ** (-3 / 12))},aresample={SR},highpass=f=400,afade=t=out:st=0.06:d=0.03", awal_k, 0.1)
    awal_m = jendela_terkuat(m("mesin.ogg"), 0.35)
    olah(m("mesin.ogg"), t("cap-b.wav"), "lowpass=f=400,highpass=f=50,acompressor=threshold=-24dB:ratio=6:attack=3:release=80,afade=t=out:st=0.22:d=0.13", awal_m, 0.35)
    ir_ruang(t("ir-ekor.wav"), detik=1.2, rt60=0.8, terang=0.4, benih=11)
    reverb(t("cap-b.wav"), t("ir-ekor.wav"), t("cap-e.wav"), 1.0)
    lapis([(t("cap-t.wav"), 0, -4), (t("cap-b.wav"), 8, 6), (t("cap-e.wav"), 8, -6)], t("cap1.wav"))
    olah(t("cap1.wav"), t("cap2.wav"), "acompressor=threshold=-22dB:ratio=3:attack=8:release=150:makeup=2")
    puncak(t("cap2.wav"), o("cap.wav"))
    resep["cap"] = "klik -3 semitone (-4 dB) + dentum mesin lowpass 400 (+6 dB, +8 ms) + ekor RT60 0,8 dtk (-6 dB, +8 ms); lem 3:1; -3 dBTP"

    # lempar: whoosh naik lalu kertas mendarat di 0,32 dtk.
    olah(m("whoosh.mp3"), t("lempar-w.wav"), "highpass=f=200,lowpass=f=8000,afade=t=in:d=0.05,afade=t=out:st=0.3:d=0.15")
    awal = jendela_terkuat(m("kertas.ogg"), 0.4)
    olah(m("kertas.ogg"), t("lempar-k.wav"), "highpass=f=300,lowpass=f=9000,acompressor=threshold=-20dB:ratio=3:attack=3:release=100,afade=t=out:st=0.25:d=0.15", awal, 0.4)
    lapis([(t("lempar-w.wav"), 0, -2), (t("lempar-k.wav"), 320, 0)], t("lempar1.wav"))
    reverb(t("lempar1.wav"), t("ir.wav"), t("lempar2.wav"), 0.15); puncak(t("lempar2.wav"), o("lempar.wav"))
    resep["lempar"] = "whoosh.mp3 pita 200-8k (-2 dB) lalu kertas 0,4 dtk di +320 ms; ruang 15%; -3 dBTP"

    # notifikasi: ketuk lembut (klik +5 semitone, lowpass 5 kHz) dua kali berjarak 90 ms, ruang 25%. Bukan nada sintetis.
    olah(m("klik.wav"), t("notif-t.wav"), f"asetrate={int(SR * 2 ** (5 / 12))},aresample={SR},lowpass=f=5000,highpass=f=300,afade=t=out:st=0.05:d=0.03", awal_k, 0.08)
    lapis([(t("notif-t.wav"), 0, 0), (t("notif-t.wav"), 90, -4)], t("notif1.wav"))
    reverb(t("notif1.wav"), t("ir.wav"), t("notif2.wav"), 0.25); puncak(t("notif2.wav"), o("notifikasi.wav"))
    resep["notifikasi"] = "klik +5 semitone lowpass 5k, dua ketuk berjarak 90 ms (-4 dB kedua); ruang 25%; -3 dBTP"

    # transisi: swipe, EQ terang, sedikit ruang.
    olah(m("swipe.mp3"), t("trans.wav"), "highpass=f=250,equalizer=f=5000:t=q:w=1:g=2,afade=t=in:d=0.03,afade=t=out:st=0.25:d=0.12")
    reverb(t("trans.wav"), t("ir.wav"), t("trans2.wav"), 0.1); puncak(t("trans2.wav"), o("transisi.wav"))
    resep["transisi"] = "swipe.mp3 highpass 250, +2 dB 5 kHz, fade; ruang 10%; -3 dBTP"

    # sonic logo 2 dtk: kertas menggeser (0 ms) lalu cap mendarat di 0,55 dtk, ekor panjang RT60 1,4 dtk, potong 2,0 dtk.
    awal = jendela_terkuat(m("kertas.ogg"), 0.5)
    olah(m("kertas.ogg"), t("logo-k.wav"), "highpass=f=400,lowpass=f=8000,afade=t=in:d=0.15,afade=t=out:st=0.35:d=0.15", awal, 0.5)
    lapis([(t("logo-k.wav"), 0, -8), (o("cap.wav"), 550, 0)], t("logo1.wav"))
    reverb(t("logo1.wav"), t("ir-panjang.wav"), t("logo2.wav"), 0.3)
    olah(t("logo2.wav"), t("logo3.wav"), "afade=t=out:st=1.6:d=0.4", 0, 2.0)
    puncak(t("logo3.wav"), o("sonic-logo.wav"))
    resep["sonic-logo"] = "kertas 0,5 dtk (-8 dB) lalu cap di +550 ms; reverb RT60 1,4 dtk 30%; potong 2,0 dtk dengan fade 0,4 dtk; -3 dBTP"

    # Uji 20 dtk: bed dari 15 dtk (fade masuk 0,4 / keluar 1,5 dtk), efek di bingkai 30 fps yang jatuh di ketukan.
    ketuk = 60 / BPM
    olah(m("lagu-krux.mp3"), t("bed.wav"), "afade=t=in:d=0.4,afade=t=out:st=18.5:d=1.5,volume=-6dB", MULAI_LAGU, 20.0)
    jadwal = [("lempar", 4), ("klik", 8), ("ketik", 10), ("notifikasi", 16), ("cap", 20), ("transisi", 28), ("klik", 32), ("sonic-logo", 34)]
    # Serangan setiap efek jatuh satu bingkai setelah gambarnya (cahaya lebih dulu dari bunyi, sound.md): efek digeser maju
    # sebesar letak serangannya sendiri (sampel pertama >= 50% puncak). Whoosh dan lempar menunggu momen mendarat, jadi mulai
    # lebih awal; klik hampir tidak digeser.
    # Ketikan berisi banyak tuts dengan kekuatan berbeda: yang disejajarkan tuts pertama (ambang 20%), bukan tuts terkeras.
    AMBANG = {"ketik": 0.2}
    def serangan(x, ambang):
        a = np.abs(x)
        return float(np.argmax(a >= ambang * a.max())) / SR
    letak = {n: serangan(baca(o(f"{n}.wav")), AMBANG.get(n, 0.5)) for n in {j[0] for j in jadwal}}
    lapisan, tanda = [(t("bed.wav"), 0, 0)], []
    for nama, k in jadwal:
        gambar = round(k * ketuk * FPS) / FPS  # dibulatkan ke bingkai, dari indeks ketukan (tidak menjumlah pembulatan)
        mulai = max(0.0, gambar + 1 / FPS - letak[nama])
        lapisan.append((o(f"{nama}.wav"), int(round(mulai * 1000)), -2 if nama in ("cap", "sonic-logo") else -6))
        tanda.append({"efek": nama, "ketukan": k, "gambar_dtk": round(gambar, 3), "bingkai": int(round(gambar * FPS)), "mulai_dtk": round(mulai, 3), "letak_serangan_ms": round(letak[nama] * 1000, 1)})
    lapis(lapisan, t("uji1.wav"))
    normalkan(t("uji1.wav"), o("uji-20dtk.wav"))
    lapis(lapisan[1:], t("efek-saja.wav"))

    # Periksa pada jalur efek saja (ketukan musik tidak ikut terbaca): serangan efek jatuh 0-2 bingkai (0-67 ms) setelah gambar.
    x = baca(t("efek-saja.wav"))
    for tnd in tanda:
        a = int((tnd["gambar_dtk"] - 0.1) * SR)
        seg = np.abs(x[a:a + int(0.3 * SR)])
        tnd["serangan_setelah_gambar_ms"] = round(float(np.argmax(seg >= AMBANG.get(tnd["efek"], 0.5) * seg.max())) / SR * 1000 - 100, 1)
    lap = {"efek": {n: {**ukur(o(f"{n}.wav")), "resep": r} for n, r in resep.items()},
           "uji": {"bed": ukur(t("bed.wav")), "sebelum": ukur(t("uji1.wav")), "sesudah": ukur(o("uji-20dtk.wav")), "jadwal": tanda},
           "sumber": SUMBER}
    for n in os.listdir(hasil):
        if n.startswith("_"):
            os.remove(os.path.join(hasil, n))
    json.dump(lap, open(o("laporan.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(json.dumps({"uji": lap["uji"]["sesudah"], "jadwal": tanda, "efek": {k: (v["true_peak"], v["durasi"]) for k, v in lap["efek"].items()}}, indent=1))


if __name__ == "__main__":
    buat(sys.argv[1], sys.argv[2])
