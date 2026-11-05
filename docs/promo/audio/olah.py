"""Rantai olah suara Nadi (V-02): potong, fade, EQ, kompresi, reverb konvolusi, layering, normalisasi dua lintasan.

Hanya ffmpeg (8.1+) dan numpy. Setiap langkah adalah fungsi kecil, sehingga efek video bisa disusun ulang tanpa DAW.
Jalankan:  python olah.py <folder-mentah> <folder-keluar>
Folder mentah berisi klik.wav (CC0), kertas.ogg dan mesin.ogg (domain publik) dari Wikimedia Commons, lihat SUARA.md.
Hasil: klik-ui.wav, kertas-nota.wav, cap.wav (berlapis) + laporan LUFS/true peak sebelum dan sesudah (laporan.json).
"""
import json, os, re, subprocess, sys, wave
import numpy as np

SR = 48000  # video: 48 kHz


def ff(*arg):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", *arg], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-800:])
    return r.stderr


def durasi(berkas):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", berkas], capture_output=True, text=True)
    return float(r.stdout.strip())


def ukur(berkas):
    """Kenyaringan terintegrasi (LUFS, ITU-R BS.1770 lewat ebur128) dan true peak (dBTP).
    BS.1770 mengukur blok 400 ms, jadi bunyi lebih pendek dari 0,4 dtk terbaca -inf. Bunyi pendek diukur di jendela 1 dtk
    (diberi senyap di belakang) supaya sebelum dan sesudah tetap bisa dibandingkan; kolom `jendela` menyebut caranya."""
    pendek = durasi(berkas) < 1.0
    af = ("apad=whole_dur=1," if pendek else "") + "ebur128=peak=true:framelog=quiet"
    e = ff("-i", berkas, "-af", af, "-f", "null", "-")
    i = re.findall(r"I:\s+(-?[\d.]+|-inf) LUFS", e)
    tp = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", e)
    return {"lufs": float(i[-1]) if i else None, "true_peak": float(tp[-1]) if tp else None,
            "jendela": "1 dtk" if pendek else "utuh", "durasi": round(durasi(berkas), 3)}


def baca(berkas):
    """Dekode ke float mono 48 kHz untuk analisis numpy."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", berkas, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def tulis(berkas, x):
    x = np.clip(x, -1, 1)
    with wave.open(berkas, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def jendela_terkuat(berkas, detik):
    """Awal potongan sepanjang `detik` dengan RMS terbesar (spotting otomatis transien yang paling jelas)."""
    x = baca(berkas)
    n = int(detik * SR)
    jumlah = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])  # jumlah bergeser O(N), bukan konvolusi O(N*n)
    awal = int(np.argmax(jumlah[n:] - jumlah[:-n]))
    # Mundur ke awal serangan: sampel pertama di atas 10% puncak dalam potongan itu.
    pot = np.abs(x[awal:awal + n])
    mulai = awal + int(np.argmax(pot > pot.max() * 0.1))
    return max(0, mulai - int(0.005 * SR)) / SR


def ir_ruang(berkas, detik=0.6, rt60=0.35, terang=0.6, benih=7):
    """Respons impuls sintetis: derau berbenih yang meluruh eksponensial (RT60) dan makin gelap di ekor.
    Dipakai reverb konvolusi (afir); deterministik, jadi hasil render sama setiap kali."""
    rng = np.random.default_rng(benih)
    t = np.arange(int(detik * SR)) / SR
    derau = rng.standard_normal(len(t))
    luruh = 10 ** (-3 * t / rt60)  # -60 dB pada rt60
    # Peredam tinggi sederhana: rata-rata bergerak makin panjang di ekor.
    gelap = np.convolve(derau, np.ones(8) / 8, "same")
    ir = (terang * derau + (1 - terang) * gelap) * luruh
    ir[0] = 1.0  # bunyi langsung
    tulis(berkas, ir / np.max(np.abs(ir)) * 0.9)


def olah(masuk, keluar, saring, mulai=None, durasi=None):
    a = []
    if mulai is not None:
        a += ["-ss", f"{mulai:.4f}"]
    if durasi is not None:
        a += ["-t", f"{durasi:.4f}"]
    ff(*a, "-i", masuk, "-af", saring, "-ac", "1", "-ar", str(SR), keluar)


def reverb(masuk, ir, keluar, basah=0.25):
    """Konvolusi dengan IR, lalu campur kering/basah. Ekor menambah panjang berkas (wajar)."""
    # afir memotong keluaran sepanjang masukan: tambah senyap sepanjang IR supaya ekornya tidak terpotong.
    ff("-i", masuk, "-i", ir, "-filter_complex",
       f"[0]apad=pad_dur={durasi(ir):.3f},asplit[k][b];[b][1]afir=dry=10:wet=10[r];[k][r]amix=inputs=2:weights='{1 - basah} {basah}':normalize=0:duration=longest",
       "-ac", "1", "-ar", str(SR), keluar)


def lapis(lapisan, keluar):
    """Layering: [(berkas, tunda_ms, gain_db)] dijumlah tanpa normalisasi otomatis."""
    arg, rantai = [], []
    for i, (b, tunda, gain) in enumerate(lapisan):
        arg += ["-i", b]
        rantai.append(f"[{i}]adelay={tunda}:all=1,volume={gain}dB[l{i}]")
    ff(*arg, "-filter_complex", ";".join(rantai) + ";" + "".join(f"[l{i}]" for i in range(len(lapisan))) +
       f"amix=inputs={len(lapisan)}:normalize=0:duration=longest", "-ac", "1", "-ar", str(SR), keluar)


def puncak(masuk, keluar, tp=-3.0):
    """Efek satu tembakan (one-shot) dinormalkan menurut true peak, bukan LUFS: bunyi < 0,4 dtk tidak punya loudness
    terintegrasi, dan bunyi berekor panjang akan terdorong melampaui puncak bila dipaksa ke LUFS. Kerasnya di mix diatur gain
    per efek (3-6 dB di atas bed), lalu mix akhir yang dinormalkan ke -14 LUFS."""
    gain = tp - ukur(masuk)["true_peak"]
    ff("-i", masuk, "-af", f"volume={gain:.2f}dB", "-ar", str(SR), keluar)


def normalkan(masuk, keluar, lufs=-14.0, tp=-1.0):
    """Mix akhir, dua lintasan: (1) ukur loudness terintegrasi; (2) gain linier ke target, lalu limiter true peak:
    naik sampel 4x (192 kHz) supaya puncak antarsampel terlihat, alimiter dengan level otomatis MATI (bawaannya menyala dan
    akan mendorong sinyal ke batas), lalu turun ke 48 kHz. Kepala 0,5 dB menampung lonjakan kecil saat turun sampel."""
    gain = lufs - ukur(masuk)["lufs"]
    for _ in range(3):
        ff("-i", masuk, "-af",
           f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={10 ** ((tp - 0.5) / 20):.4f}:attack=2:release=60:level=0,aresample={SR}",
           "-ar", str(SR), keluar)
        # Limiter memotong puncak sehingga loudness turun sedikit: tambah gain sebesar selisihnya (toleransi R128 0,5 LU).
        selisih = lufs - ukur(keluar)["lufs"]
        if abs(selisih) <= 0.5:
            return
        gain += selisih


def utama(mentah, hasil):
    os.makedirs(hasil, exist_ok=True)
    tmp = lambda n: os.path.join(hasil, "_" + n)
    out = lambda n: os.path.join(hasil, n)
    ir = tmp("ir-ruang.wav"); ir_ruang(ir)
    lap = {}

    # 1. Klik UI: potong transien 0,12 dtk, buang dengung di bawah 150 Hz, kilau 4 kHz, kompresi cepat, ruang kecil.
    src = os.path.join(mentah, "klik.wav")
    m = jendela_terkuat(src, 0.12)
    olah(src, tmp("klik1.wav"), "highpass=f=150,equalizer=f=4000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=4:attack=0.5:release=40,afade=t=out:st=0.09:d=0.03", m, 0.12)
    reverb(tmp("klik1.wav"), ir, tmp("klik2.wav"), basah=0.12)
    puncak(tmp("klik2.wav"), out("klik-ui.wav"))
    olah(src, tmp("klik0.wav"), "anull", m, 0.12)
    lap["klik-ui"] = {"sumber": "klik.wav", "sebelum": ukur(tmp("klik0.wav")), "sesudah": ukur(out("klik-ui.wav"))}

    # 2. Kertas nota: cari gesekan terkuat 0,7 dtk, rentang 300 Hz-9 kHz, redam 2,5 kHz yang kasar, fade masuk/keluar.
    src = os.path.join(mentah, "kertas.ogg")
    m = jendela_terkuat(src, 0.7)
    olah(src, tmp("kertas1.wav"), "highpass=f=300,lowpass=f=9000,equalizer=f=2500:t=q:w=1.2:g=-3,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,afade=t=in:d=0.01,afade=t=out:st=0.55:d=0.15", m, 0.7)
    reverb(tmp("kertas1.wav"), ir, tmp("kertas2.wav"), basah=0.18)
    puncak(tmp("kertas2.wav"), out("kertas-nota.wav"))
    olah(src, tmp("kertas0.wav"), "anull", m, 0.7)
    lap["kertas-nota"] = {"sumber": "kertas.ogg", "sebelum": ukur(tmp("kertas0.wav")), "sesudah": ukur(out("kertas-nota.wav"))}

    # 3. Cap stempel berlapis: transien (klik, diturunkan 3 semitone lewat asetrate), badan (dentum mesin, lowpass 400 Hz),
    #    ekor (badan yang direverb panjang). Transien 0 ms, badan +8 ms agar serangan klik memimpin, ekor +8 ms.
    src = os.path.join(mentah, "mesin.ogg")
    m = jendela_terkuat(src, 0.35)
    olah(os.path.join(mentah, "klik.wav"), tmp("cap-transien.wav"),
         f"asetrate={int(SR * 2 ** (-3 / 12))},aresample={SR},highpass=f=400,afade=t=out:st=0.06:d=0.03", jendela_terkuat(os.path.join(mentah, "klik.wav"), 0.1), 0.1)
    olah(src, tmp("cap-badan.wav"), "lowpass=f=400,highpass=f=50,acompressor=threshold=-24dB:ratio=6:attack=3:release=80,afade=t=out:st=0.22:d=0.13", m, 0.35)
    ir_ruang(tmp("ir-ekor.wav"), detik=1.2, rt60=0.8, terang=0.4, benih=11)
    reverb(tmp("cap-badan.wav"), tmp("ir-ekor.wav"), tmp("cap-ekor.wav"), basah=1.0)
    lapis([(tmp("cap-transien.wav"), 0, -4), (tmp("cap-badan.wav"), 8, 6), (tmp("cap-ekor.wav"), 8, -6)], tmp("cap1.wav"))
    # Lem: kompresi lambat di hasil lapisan supaya transien, badan, dan ekor terdengar satu benda.
    olah(tmp("cap1.wav"), tmp("cap2.wav"), "acompressor=threshold=-22dB:ratio=3:attack=8:release=150:makeup=2")
    puncak(tmp("cap2.wav"), out("cap.wav"))
    olah(src, tmp("cap0.wav"), "anull", m, 0.35)
    lap["cap"] = {"sumber": "klik.wav + mesin.ogg (sebelum = potongan mesin mentah)", "sebelum": ukur(tmp("cap0.wav")), "sesudah": ukur(out("cap.wav"))}

    # 4. Mix akhir uji 8 dtk: bed derau merah lirih (pengganti musik, berbenih) + tiga efek di 1,0 / 3,0 / 5,5 dtk dengan
    #    gain per efek, lalu dua lintasan ke -14 LUFS / -1 dBTP. Membuktikan tahap normalisasi film, bukan musiknya.
    rng = np.random.default_rng(3)
    bed = np.cumsum(rng.standard_normal(8 * SR)); bed -= np.convolve(bed, np.ones(2400) / 2400, "same"); bed = bed / np.max(np.abs(bed)) * 0.05
    tulis(tmp("bed.wav"), bed)
    lapis([(tmp("bed.wav"), 0, 0), (out("klik-ui.wav"), 1000, -6), (out("kertas-nota.wav"), 3000, -8), (out("cap.wav"), 5500, -4)], tmp("mix1.wav"))
    normalkan(tmp("mix1.wav"), out("mix-uji.wav"))
    lap["mix-uji"] = {"sumber": "bed sintetis + 3 efek", "sebelum": ukur(tmp("mix1.wav")), "sesudah": ukur(out("mix-uji.wav"))}

    for n in os.listdir(hasil):
        if n.startswith("_"):
            os.remove(os.path.join(hasil, n))
    json.dump(lap, open(out("laporan.json"), "w"), indent=1)
    print(json.dumps(lap, indent=1))


if __name__ == "__main__":
    utama(sys.argv[1], sys.argv[2])
