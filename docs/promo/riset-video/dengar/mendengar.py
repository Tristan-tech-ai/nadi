"""V-14: dengar per kejadian. Efek rujukan (dari stem demucs) dan kandidat foley (rekaman CC0) diukur dengan cara yang sama:
serangan (10% -> puncak, ms), ekor (puncak -> -20 dB, ms), centroid spektrum (Hz), pita energi 10-90% (Hz), dan untuk ketikan jarak
antarklik (ms). Lalu tiap kandidat dibandingkan dengan rujukan sejenis dan digambar berdampingan (spektrogram + amplop).

Pakai: python bedah/mendengar.py <folder_stem_r8> <folder_foley> <folder_keluar>
"""
import json
import os
import sys

import librosa
import matplotlib
import numpy as np
matplotlib.use("Agg")
import matplotlib.pyplot as plt

STEM, FOLEY, KELUAR = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(KELUAR, exist_ok=True)
SR = 48000
HOP = 96  # 2 ms


def muat(p, t0=None, t1=None):
    y, _ = librosa.load(p, sr=SR, mono=True, offset=t0 or 0.0, duration=None if t1 is None else t1 - (t0 or 0.0))
    return y


def ukur_satu(y):
    """Ukuran satu kejadian (y dipotong di sekitar satu transien)."""
    rms = librosa.feature.rms(y=y, frame_length=256, hop_length=HOP)[0] + 1e-9
    ip = int(np.argmax(rms)); p = rms[ip]
    j = ip
    while j > 0 and rms[j] > 0.1 * p:
        j -= 1
    j2 = ip
    while j2 < len(rms) - 1 and rms[j2] > p * 0.1:  # -20 dB
        j2 += 1
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP)); fr = librosa.fft_frequencies(sr=SR, n_fft=2048)
    sp = S[:, max(0, ip - 2):ip + 20].mean(axis=1); e = np.cumsum(sp ** 2); e /= e[-1] or 1
    return {"serangan_ms": round((ip - j) * HOP / SR * 1000, 1), "ekor_ms": round((j2 - ip) * HOP / SR * 1000, 1),
            "centroid": int(np.sum(fr * sp) / (np.sum(sp) or 1)), "pita_lo": int(fr[np.searchsorted(e, 0.1)]), "pita_hi": int(fr[min(len(fr) - 1, np.searchsorted(e, 0.9))]),
            "db": round(float(librosa.amplitude_to_db([p], ref=1.0)[0]), 1)}


def kejadian(y, delta=0.25, wait_ms=25):
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    pk = librosa.util.peak_pick(env, pre_max=5, post_max=5, pre_avg=20, post_avg=20, delta=np.max(env) * delta, wait=int(wait_ms / 2))
    return [k * HOP / SR for k in pk]


def ringkas(y, jenis):
    on = kejadian(y)
    ukuran = []
    for t in on[:40]:
        a, b = int(max(0, t - 0.01) * SR), int(min(len(y), (t + 0.25) * SR))
        if b - a > 512:
            ukuran.append(ukur_satu(y[a:b]))
    if not ukuran:
        return None
    med = {k: float(np.median([u[k] for u in ukuran])) for k in ukuran[0]}
    if jenis == "ketik" and len(on) > 3:
        ioi = np.diff(on) * 1000
        ioi = ioi[ioi < 400]
        med["ioi_med"] = float(np.median(ioi)) if len(ioi) else None
        med["ioi_cv"] = float(np.std(ioi) / np.mean(ioi)) if len(ioi) > 2 else None
    med["n"] = len(ukuran)
    return med


# Rujukan 8 (bedah/orTd3grSYsQ.md): klik 2,35-2,80 dtk, ketik 10,55-11,05 dtk, whoosh folder 3,0-3,75 dtk (stem drums untuk transien,
# campuran semua stem untuk whoosh yang pita lebar).
def stem_mix(t0, t1, nama=("drums",)):
    return sum(muat(os.path.join(STEM, n + ".wav"), t0, t1) for n in nama)


RUJUKAN = {"klik": stem_mix(2.35, 2.80), "ketik": stem_mix(10.55, 11.05), "whoosh": stem_mix(3.0, 3.75, ("drums", "other"))}
KANDIDAT = json.load(open(os.path.join(FOLEY, "kandidat.json"), encoding="utf8"))  # {jenis: [berkas, ...]}

hasil = {}
for jenis, yr in RUJUKAN.items():
    r = ringkas(yr, jenis) if jenis != "whoosh" else ukur_satu(yr)
    hasil[jenis] = {"rujukan": r, "kandidat": {}}
    for b in KANDIDAT.get(jenis, []):
        y = muat(os.path.join(FOLEY, b))[: SR * 8]
        hasil[jenis]["kandidat"][b] = ringkas(y, jenis) if jenis != "whoosh" else ukur_satu(y)
json.dump(hasil, open(os.path.join(KELUAR, "ukur.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)


def gambar(jenis, nama_berkas, y_kand, nama):
    yr = RUJUKAN[jenis]
    fig, ax = plt.subplots(2, 2, figsize=(14, 6))
    for k, (y, judul) in enumerate([(yr, f"rujukan 8: {jenis}"), (y_kand, f"kandidat: {nama_berkas}")]):
        D = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=1024, hop_length=128)), ref=np.max)
        ax[0, k].imshow(D, origin="lower", aspect="auto", extent=[0, len(y) / SR, 0, SR / 2 / 1000], vmin=-70, vmax=0, cmap="magma")
        ax[0, k].set_ylim(0, 16); ax[0, k].set_title(judul); ax[0, k].set_ylabel("kHz")
        env = librosa.amplitude_to_db(librosa.feature.rms(y=y, frame_length=256, hop_length=HOP)[0] + 1e-9, ref=1.0)
        ax[1, k].plot(np.arange(len(env)) * HOP / SR, env); ax[1, k].set_ylim(-70, 0); ax[1, k].set_xlabel("dtk"); ax[1, k].set_ylabel("dB")
    fig.tight_layout(); fig.savefig(os.path.join(KELUAR, f"{nama}.png"), dpi=80); plt.close(fig)


for jenis in RUJUKAN:
    for b in KANDIDAT.get(jenis, []):
        y = muat(os.path.join(FOLEY, b))
        n = len(RUJUKAN[jenis]) if jenis == "whoosh" else min(len(y), SR * 2)
        on = kejadian(y)
        a = int(max(0, (on[0] if on else 0) - 0.02) * SR)
        gambar(jenis, b, y[a:a + max(n, SR // 2)], f"{jenis}_{os.path.splitext(b)[0]}")
print(json.dumps(hasil, ensure_ascii=False, indent=1))
