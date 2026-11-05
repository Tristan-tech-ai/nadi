"""Pustaka efek film demo v3 (V-14/V-05) dari rekaman foley NYATA berlisensi CC0 (freesound lewat Openverse, dicatat di docs/ASSETS.md).

Rantai olah tiap efek (V-02) ditulis di RESEP dan dijalankan ulang sama persis:
  potong satu kejadian di sekitar onset -> high-pass -> low-pass 10 kHz (efek rujukan 8 berpita 0,6-10 kHz) -> angkat 2,5 kHz
  (tekanan rujukan di 2-3 kHz) -> ruang pendek (konvolusi ekor peluruhan 25 ms, basah -18 dB) -> pudar keluar -> normalisasi puncak.
Rekaman mentah tidak masuk repo (unduh ulang dari URL di ASSETS.md); hasil olah ditulis ke folder ini.

Pakai: python foley.py <folder_mentah> [folder_keluar]
"""
import json
import os
import sys

import librosa
import numpy as np
import soundfile as sf
from scipy import signal

MENTAH = sys.argv[1]
KELUAR = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
SR = 48000
RNG = np.random.default_rng(7)  # ekor ruang deterministik

RESEP = {
    "klik": {"sumber": "fs_534104.mp3", "ambil": "onset0", "panjang": 0.05, "hp": 300, "lp": 10000, "eq": (2500, 3.0), "ruang": 0.012, "puncak": -3.0},
    "ketik": {"sumber": "fs_546164.mp3", "ambil": "semua", "panjang": 0.07, "hp": 350, "lp": 10000, "eq": (2500, 3.0), "ruang": 0.02, "puncak": -6.0, "jumlah": 16},
    "cap": {"sumber": "fs_461888.mp3", "ambil": "onset0", "panjang": 0.35, "hp": 60, "lp": 10000, "eq": (180, 3.0), "ruang": 0.04, "puncak": -2.0},
    "whoosh": {"sumber": "fs_60026.mp3", "ambil": "utuh", "regang": 2.0, "hp": 600, "lp": 10000, "eq": (5000, 4.0), "ruang": 0.05, "puncak": -4.0},
    "notifikasi": {"sumber": "fs_63512.mp3", "ambil": "utuh", "hp": 400, "lp": 10000, "eq": (2500, 2.0), "ruang": 0.03, "puncak": -8.0},
    "kertas": {"sumber": "fs_334994.mp3", "ambil": "onset0", "panjang": 0.6, "hp": 200, "lp": 10000, "eq": (3000, 1.0), "ruang": 0.03, "puncak": -8.0},
    "toko": {"sumber": "fs_617520.mp3", "ambil": "utuh", "potong": (2.0, 52.0), "hp": 80, "lp": 9000, "eq": (1000, 0.0), "ruang": 0.0, "puncak": -14.0},
}


def saring(y, r):
    sos = signal.butter(2, r["hp"], "highpass", fs=SR, output="sos")
    y = signal.sosfilt(sos, y)
    sos = signal.butter(8, r["lp"], "lowpass", fs=SR, output="sos")  # curam seperti potongan 10,5 kHz di rujukan
    y = signal.sosfilt(sos, y)
    f0, g = r["eq"]
    if g:  # puncak EQ (RBJ), Q 1
        A = 10 ** (g / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / 2
        b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
        y = signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], y)
    if r["ruang"]:
        n = int(r["ruang"] * SR); ir = RNG.standard_normal(n) * np.exp(-np.arange(n) / (n / 5)); ir /= np.sqrt(np.sum(ir ** 2))
        y = y + 10 ** (-18 / 20) * signal.fftconvolve(y, ir)[: len(y)]
    return y


def rapikan(y, r):
    f = min(len(y) // 4, int(0.008 * SR))
    y = y.copy(); y[-f:] *= np.linspace(1, 0, f); y[: int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return y / (np.max(np.abs(y)) or 1) * 10 ** (r["puncak"] / 20)


def onset(y):
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=96)
    pk = librosa.util.peak_pick(env, pre_max=5, post_max=5, pre_avg=20, post_avg=20, delta=np.max(env) * 0.25, wait=12)
    return [int(k * 96) for k in pk]


hasil = {}
for nama, r in RESEP.items():
    y, _ = librosa.load(os.path.join(MENTAH, r["sumber"]), sr=SR, mono=True)
    if "potong" in r:
        y = y[int(r["potong"][0] * SR): int(r["potong"][1] * SR)]
    if r["ambil"] == "utuh":
        if "regang" in r:
            y = librosa.effects.time_stretch(y, rate=1 / r["regang"])
        y = rapikan(saring(y, r), r)
        if nama == "toko":  # suasana: pudar masuk/keluar 1 dtk, normalisasi RMS bukan puncak
            k = SR; y[:k] *= np.linspace(0, 1, k); y[-k:] *= np.linspace(1, 0, k)
        sf.write(os.path.join(KELUAR, f"{nama}.wav"), y.astype(np.float32), SR, subtype="PCM_24"); hasil[nama] = 1
        continue
    on = onset(y)
    potong = [y[max(0, o - int(0.004 * SR)): max(0, o - int(0.004 * SR)) + int(r["panjang"] * SR)] for o in on]
    potong = [p for p in potong if len(p) == int(r["panjang"] * SR)]
    if r["ambil"] == "onset0":
        potong = potong[:1]
    else:  # ketik: pilih ketukan yang kerasnya mirip (dalam 6 dB dari median), lalu ambil sejumlah
        pk = np.array([np.max(np.abs(p)) for p in potong]); med = np.median(pk)
        potong = [p for p, v in zip(potong, pk) if abs(20 * np.log10(v / med)) < 6][: r["jumlah"]]
    for i, p in enumerate(potong):
        nm = nama if len(potong) == 1 else f"{nama}-{i:02d}"
        sf.write(os.path.join(KELUAR, f"{nm}.wav"), rapikan(saring(p, r), r).astype(np.float32), SR, subtype="PCM_24")
    hasil[nama] = len(potong)

# Komposit dari hasil olah di atas (layering: transien memimpin, badan dan ekor menyusul; lihat SUARA.md bagian 1).
def baca(n):
    return sf.read(os.path.join(KELUAR, f"{n}.wav"))[0]


def susun(lapisan, panjang):
    out = np.zeros(int(panjang * SR))
    for n, t, g in lapisan:
        y = baca(n) * 10 ** (g / 20); a = int(t * SR); out[a:a + len(y)] += y[: len(out) - a]
    return out


def ruang_panjang(y, rt=1.2):
    n = int(rt * SR); ir = RNG.standard_normal(n) * np.exp(-np.arange(n) * 6.9 / n)
    ir = signal.sosfilt(signal.butter(2, 3500, "lowpass", fs=SR, output="sos"), ir); ir /= np.sqrt(np.sum(ir ** 2))
    return y + 10 ** (-14 / 20) * signal.fftconvolve(y, ir)[: len(y)]


KOMPOSIT = {
    "lempar": ([("whoosh", 0.0, 0.0), ("kertas", 0.32, -2.0)], 1.4, -3.0),   # berkas dilempar lalu mendarat
    "transisi": ([("whoosh", 0.0, -3.0)], 1.0, -6.0),                          # pergantian adegan besar, lebih lirih
    "sonic-logo": ([("kertas", 0.0, -6.0), ("cap", 0.55, 0.0)], 2.0, -3.0),     # kertas bergeser, cap mendarat (karakter film)
}
for nama, (lap, panjang, pk) in KOMPOSIT.items():
    y = susun(lap, panjang)
    if nama == "sonic-logo":
        y = ruang_panjang(y)
    k = int(0.3 * SR); y[-k:] *= np.linspace(1, 0, k)
    sf.write(os.path.join(KELUAR, f"{nama}.wav"), (y / (np.max(np.abs(y)) or 1) * 10 ** (pk / 20)).astype(np.float32), SR, subtype="PCM_24")
    hasil[nama] = 1
json.dump({"resep": RESEP, "hasil": hasil}, open(os.path.join(KELUAR, "foley.json"), "w", encoding="utf8"), indent=1)
print(hasil)
