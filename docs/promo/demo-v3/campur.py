"""Audio film demo v3 (V-07H). Spotting dibaca dari timeline index.html (satu sumber kebenaran dengan gambar), efek dari pustaka foley
nyata docs/promo/audio-v2 (MENDENGAR.md), musik = stem demucs lagu Rafael Krux "Inspiring Advertising" (CC BY 4.0, ASSETS.md) yang
disusun ulang per birama. Aturan dari GERAK.md: alas dibuka saat Nadi muncul (babak 2), drum berhenti dua birama sebelum fitur kunci lalu
masuk lagi tepat saat aksinya terlihat, suara toko nyata di babak masalah dan Mata, alas berhenti sebelum logo lalu sonic logo cap.
Mix akhir -14 LUFS, <= -1 dBTP lewat normalkan() di docs/promo/audio/olah.py.

Pakai: python campur.py <folder_stem_lagu> <toko.wav>   (keluaran: assets/audio/mix.wav, laporan audio.json)
"""
import glob
import json
import os
import re
import sys

import librosa
import numpy as np
import soundfile as sf

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AKAR, "..", "audio"))
import olah  # noqa: E402

STEM, TOKO = sys.argv[1], sys.argv[2]
EF = os.path.join(AKAR, "..", "audio-v2")
SR = 48000
RNG = np.random.default_rng(11)
js = open(os.path.join(AKAR, "index.html"), encoding="utf8").read()
DUR = float(re.search(r'data-duration="([\d.]+)" data-fps', js).group(1))
M = json.load(open(os.path.join(AKAR, "babak.json"), encoding="utf8"))  # mulai tiap babak, ditulis buat.py
N = int(DUR * SR)


def efek(n):
    return sf.read(os.path.join(EF, f"{n}.wav"))[0]


KETIK = [efek(os.path.basename(f)[:-4]) for f in sorted(glob.glob(os.path.join(EF, "ketik-[0-9][0-9].wav")))]
jalur = {k: np.zeros(N) for k in ["ketik", "klik", "cap", "lain", "toko"]}
spot = []


def taruh(j, y, t, g):
    a = int(t * SR)
    if 0 <= a < N:
        jalur[j][a:a + len(y)] += (y * 10 ** (g / 20))[: N - a]


# ---- spotting dari timeline ----
huruf = sorted(float(t) for t in re.findall(r'tl\.set\("#k[\w]*-\d+", \{display: "(?:inline|none)"\}, ([\d.]+)\);', js))
akhir = -1.0
jarak = RNG.uniform(0.045, 0.09)
for t in huruf:  # rumpun ketukan: tiap huruf boleh berbunyi, tetapi jarak antarketukan 45-90 ms acak (rujukan 8: median 72 ms)
    if t - akhir >= jarak:
        taruh("ketik", KETIK[RNG.integers(len(KETIK))], t + RNG.uniform(-0.008, 0.008), (-8 if t < M["2"] else -11) + RNG.uniform(-3, 0))
        akhir, jarak = t, RNG.uniform(0.045, 0.09)
        spot.append(("ketik", round(t, 3)))
for t in re.findall(r'tl\.to\("#kur\w*", \{scale: 0\.88[^;]*\}, ([\d.]+)\);', js):  # klik: 1 bingkai setelah tekan
    taruh("klik", efek("klik"), float(t) + 1 / 30, -5); spot.append(("klik", float(t)))
for sid, t in re.findall(r'tl\.fromTo\("#(capbesar|lunas|capt9|capakhir)", \{opacity: 0, scale: 2\.\d[^;]*\}, ([\d.]+)\);', js):
    t = float(t) + 0.16  # cap mendarat di akhir tween 0,16 dtk
    if sid == "capakhir":
        taruh("cap", efek("sonic-logo"), t - 0.55, -1); spot.append(("sonic-logo", t))
    else:
        taruh("cap", efek("cap"), t, -2); spot.append(("cap", t))
for t in re.findall(r'tl\.fromTo\("#(?:n3|n4|n8|notif5)", \{opacity: 0, y: -2[04]\}[^;]*\}, ([\d.]+)\);', js):
    taruh("lain", efek("notifikasi"), float(t) + 0.03, -9); spot.append(("notifikasi", float(t)))
t = float(re.search(r'tl\.to\("#j0", [^;]*\}, ([\d.]+)\);', js).group(1))
taruh("lain", efek("lempar"), t, -4); spot.append(("lempar", t))
for t in re.findall(r'tl\.fromTo\("#bk\d", \{opacity: 0, y: 30\}[^;]*\}, ([\d.]+)\);', js):  # berkas berserakan muncul (babak 1)
    taruh("lain", efek("kertas"), float(t), -14); spot.append(("kertas", float(t)))
t = float(re.search(r'tl\.to\("#nota", \{scale: 0\.3[^;]*\}, ([\d.]+)\);', js).group(1))  # nota menjadi kartu (babak 0)
taruh("lain", efek("kertas"), t, -10); spot.append(("kertas", t))

# ---- musik: stem lagu disusun per birama ----
st = {n: librosa.load(os.path.join(STEM, f"{n}.wav"), sr=SR, mono=True)[0] for n in ["drums", "bass", "other", "vocals"]}
campur_lagu = sum(st.values())
tempo, ketuk = librosa.beat.beat_track(y=campur_lagu, sr=SR, units="time", start_bpm=117)
ketuk = np.array(ketuk)
b0 = int(np.argmin(np.abs(ketuk - 15.0)))  # bagian penuh pertama mulai ±15 dtk (V-05)
birama = ketuk[b0::4]
birama = birama[birama < len(campur_lagu) / SR - 0.5]
bl = float(np.median(np.diff(birama)))
mulai_m, akhir_m = M["2"], M["11"] - 0.3  # alas dibuka saat Nadi muncul, berhenti sebelum logo
perlu = int(round((akhir_m - mulai_m) / bl))
nb = len(birama) - 1
ekor = list(range(8, nb))  # bagian akhir lagu (penutup asli) selalu dipakai utuh
depan = list(range(0, max(0, perlu - len(ekor))))
urut = (depan + ekor)[-perlu:] if len(depan + ekor) >= perlu else (depan + ekor)
musik = {n: np.zeros(N) for n in st}
xf = int(0.02 * SR)
t_m = mulai_m
for i, b in enumerate(urut):
    a, z = int(birama[b] * SR), int(birama[b + 1] * SR)
    for n, y in st.items():
        seg = y[a:z + xf].copy()
        seg[:xf] *= np.linspace(0, 1, xf); seg[-xf:] *= np.linspace(1, 0, xf)
        p = int(t_m * SR)
        musik[n][p:p + len(seg)] += seg[: max(0, N - p)]
    t_m += (z - a) / SR
# drum (dan separuh bass) berhenti dua birama sebelum fitur kunci, masuk lagi tepat saat aksinya
kunci = {
    "Setujui jadi cap (babak 4)": [t for k, t in spot if k == "cap"][0],
    "QRIS lunas (babak 5)": [t for k, t in spot if k == "cap"][1],
    "Lepas gaji (babak 6)": float(re.search(r'tl\.fromTo\("#g6ok"[^;]*\}, ([\d.]+)\);', js).group(1)),
    "struk ke-4 token 0 (babak 9)": float(re.search(r'tl\.fromTo\("#tok4"[^;]*\}, ([\d.]+)\);', js).group(1)),
    "pengawas DITOLAK (babak 9)": [t for k, t in spot if k == "cap"][2],
}
gd, gb = np.ones(N), np.ones(N)
f50 = int(0.05 * SR)
for nama, k in kunci.items():
    a, z = int((k - 2 * bl) * SR), int(k * SR)
    gd[a:z] = 0.0; gb[a:z] = 0.5
    gd[a - f50:a] = np.linspace(1, 0, f50); gb[a - f50:a] = np.linspace(1, 0.5, f50)
# Mata: musik turun 6 dB, suara toko naik (babak 7)
gm = np.ones(N)
a, z = int(M["7"] * SR), int(M["8"] * SR)
gm[a:z] = 10 ** (-6 / 20); r = int(0.8 * SR); gm[a - r:a] = np.linspace(1, gm[a], r); gm[z:z + r] = np.linspace(gm[a], 1, r)
bed = (musik["drums"] * gd + musik["bass"] * gb + musik["other"] + musik["vocals"]) * gm
pf = int(1.5 * SR); p0 = int(mulai_m * SR)
bed[p0:p0 + int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))
pz = int(akhir_m * SR); bed[pz - pf:pz] *= np.linspace(1, 0, pf); bed[pz:] = 0
# intro asli lagu (0 sampai bagian penuh, tanpa drum) diputar menjelang babak 2 sehingga alas penuh masuk tepat saat Nadi muncul
ia = int(birama[0] * SR)
intro = (st["bass"][:ia] + st["other"][:ia] + st["vocals"][:ia]) * 0.8
p_in = p0 - ia
if p_in < 0:
    intro, p_in = intro[-p0:], 0
r = int(3.0 * SR); intro[:r] *= np.linspace(0, 1, r)
bed[p_in:p_in + len(intro)] += intro[: N - p_in]

# ---- suara toko nyata: babak 0-1 (masalah) dan babak 7 (Mata) ----
toko = sf.read(TOKO)[0]
def toko_di(t0, t1, g):
    p, n = int(t0 * SR), int((t1 - t0) * SR)
    y = np.resize(toko, n).copy(); r = int(1.0 * SR); y[:r] *= np.linspace(0, 1, r); y[-r:] *= np.linspace(1, 0, r)
    jalur["toko"][p:p + n] += y * 10 ** (g / 20)
toko_di(M["1"], M["2"] + 0.5, 0)
toko_di(M["7"], M["8"], -2)

# ---- campur: musik di bawah efek (efek 3-6 dB di atas alas) ----
mix = bed * 10 ** (-9 / 20) + jalur["ketik"] + jalur["klik"] + jalur["cap"] + jalur["lain"] + jalur["toko"] * 10 ** (-8 / 20)
os.makedirs(os.path.join(AKAR, "assets", "audio"), exist_ok=True)
mentah = os.path.join(AKAR, "assets", "audio", "mix-mentah.wav")
akhir_f = os.path.join(AKAR, "assets", "audio", "mix.wav")
sf.write(mentah, np.stack([mix, mix], 1).astype(np.float32), SR, subtype="FLOAT")
olah.normalkan(mentah, akhir_f, lufs=-14.0, tp=-1.0)
lap = {"durasi": DUR, "tempo": float(np.atleast_1d(tempo)[0]), "birama_dtk": bl, "jumlah_birama": len(urut), "urut_birama": urut,
       "kunci": kunci, "spot": {k: sum(1 for s in spot if s[0] == k) for k in {s[0] for s in spot}}, "ukur": olah.ukur(akhir_f)}
json.dump(lap, open(os.path.join(AKAR, "audio.json"), "w", encoding="utf8"), indent=1, ensure_ascii=False)
print(json.dumps(lap["spot"]), lap["ukur"], "tempo", lap["tempo"], "birama", len(urut))
