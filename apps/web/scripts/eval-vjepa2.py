# Eksperimen F5-05: V-JEPA 2 pada korpus Mata (fixtures/korpus/mata). Bukan bagian aplikasi; dijalankan manual di CPU.
# (A) resep dari sedikit contoh: fitur encoder beku dari potongan zona meja + regresi logistik dengan k contoh per kelas.
# (B) skor kejutan: predictor menebak token paruh kedua klip dari paruh pertama; galat L1 dibandingkan antara klip normal
#     (urutan cuplikan asli) dan klip yang diberi kejadian janggal (lampu padam, kamera bergeser, lompat waktu),
#     dengan pembanding beda piksel sederhana.
# Pakai: python eval-vjepa2.py <folder model> <folder korpus mata> <berkas json keluaran>
# Butuh: torch, transformers (VJEPA2Model), scikit-learn, pillow, numpy, ffmpeg di PATH.
import json
import os
import subprocess
import sys
import tempfile
import time

import numpy as np
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from transformers import VJEPA2Model

MODEL, KORPUS, KELUAR = sys.argv[1], sys.argv[2], sys.argv[3]
SISI = 256
RATA = np.array([0.485, 0.456, 0.406], dtype=np.float32)
SIMP = np.array([0.229, 0.224, 0.225], dtype=np.float32)
torch.manual_seed(0)
acak = np.random.default_rng(20261104)


def cuplikan_video(video, n):
    """Video korpus 2 fps menahan tiap cuplikan 2 detik: cuplikan i = bingkai 4i+1."""
    d = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", video, os.path.join(d, "%04d.png")], check=True)
    berkas = sorted(os.listdir(d))
    return [Image.open(os.path.join(d, berkas[min(4 * i + 1, len(berkas) - 1)])).convert("RGB") for i in range(n)]


def tensor_bingkai(gambar):
    a = np.asarray(gambar.resize((SISI, SISI), Image.BICUBIC), dtype=np.float32) / 255.0
    a = (a - RATA) / SIMP
    return torch.from_numpy(a).permute(2, 0, 1)  # C, H, W


def klip(gambar):
    """Daftar PIL -> tensor (1, T, C, H, W) seperti keluaran AutoVideoProcessor."""
    return torch.stack([tensor_bingkai(g) for g in gambar]).unsqueeze(0)


jawaban = json.load(open(os.path.join(KORPUS, "jawaban.json"), encoding="utf-8"))
zona = json.load(open(os.path.join(KORPUS, "zona.json"), encoding="utf-8"))
N = len(jawaban)
semua = cuplikan_video(os.path.join(KORPUS, "video.webm"), N)
model = VJEPA2Model.from_pretrained(MODEL).eval()
hasil = {"model": os.path.basename(os.path.normpath(MODEL)), "cuplikan": N, "utas": torch.get_num_threads()}

# (A) resep dari sedikit contoh
fitur, label, zona_id = [], [], []
t0 = time.time()
with torch.no_grad():
    for j in jawaban:
        g = semua[j["cuplikan"]]
        W, H = g.size
        for z in zona:
            if z["jenis"] != "meja":
                continue
            xs = [p[0] for p in z["poligon"]]
            ys = [p[1] for p in z["poligon"]]
            potong = g.crop((int(min(xs) * W), int(min(ys) * H), int(max(xs) * W), int(max(ys) * H)))
            # gambar diam: satu tubelet (2 bingkai sama), seperti contoh gambar di kartu model
            f = model.get_vision_features(klip([potong, potong])).mean(dim=1)[0].numpy()
            fitur.append(f)
            label.append(1 if j["status"][z["id"]] == "terisi" else 0)
            zona_id.append(z["id"])
dtk_potong = (time.time() - t0) / len(fitur)
X, y, zid = np.stack(fitur), np.array(label), np.array(zona_id)
hasil["resep"] = {"contoh": int(len(y)), "terisi": int(y.sum()), "detik_per_potongan": round(dtk_potong, 3), "k": {}}
for k in (1, 2, 5, 10, 20):
    akurasi = []
    for _ in range(30):
        latih = np.concatenate([acak.choice(np.where(y == c)[0], k, replace=False) for c in (0, 1)])
        uji = np.setdiff1d(np.arange(len(y)), latih)
        clf = LogisticRegression(max_iter=2000, C=1.0).fit(X[latih], y[latih])
        akurasi.append(float((clf.predict(X[uji]) == y[uji]).mean()))
    hasil["resep"]["k"][str(k)] = {"rata": round(float(np.mean(akurasi)), 4), "min": round(float(np.min(akurasi)), 4)}
# zona baru: latih dua meja, uji meja ketiga (resep berpindah ke zona yang belum pernah dilihat)
lintas = {}
for z in sorted(set(zid)):
    clf = LogisticRegression(max_iter=2000).fit(X[zid != z], y[zid != z])
    lintas[z] = round(float((clf.predict(X[zid == z]) == y[zid == z]).mean()), 4)
hasil["resep"]["zona_baru"] = lintas

# (B) skor kejutan
T = 8  # 8 bingkai = 4 tubelet; konteks 2 tubelet pertama, sasaran 2 tubelet terakhir
PER = (SISI // 16) ** 2


def kejutan(gambar):
    with torch.no_grad():
        penuh = model(klip(gambar), skip_predictor=True).last_hidden_state  # 1, 4*PER, D
        konteks = model(klip(gambar[: T // 2]), skip_predictor=True).last_hidden_state  # encoder hanya melihat masa lalu
        n_ctx = konteks.shape[1]
        cm = [torch.arange(n_ctx).unsqueeze(0)]
        tm = [torch.arange(n_ctx, penuh.shape[1]).unsqueeze(0)]
        tebak = model.predictor(encoder_hidden_states=konteks, context_mask=cm, target_mask=tm).last_hidden_state
        sasaran = penuh[:, n_ctx:]
        return float((tebak - sasaran).abs().mean())


def beda_piksel(gambar):
    a = [np.asarray(g.resize((SISI, SISI)), dtype=np.float32) for g in gambar]
    return float(np.mean([np.abs(a[i] - a[T // 2 - 1]).mean() for i in range(T // 2, T)]))


def lampu(g):
    return Image.fromarray((np.asarray(g, dtype=np.float32) * 0.45).astype(np.uint8))


def geser(g):
    a = np.asarray(g)
    return Image.fromarray(np.roll(a, (a.shape[0] // 10, a.shape[1] // 12), axis=(0, 1)))


# bingkai tiap 2 detik (satu per cuplikan): klip 16 detik
jendela = list(range(0, N - T + 1))
normal = [[semua[i + t] for t in range(T)] for i in jendela]
janggal = {"lampu_padam": [], "kamera_geser": [], "lompat_waktu": []}
for i in acak.choice(jendela, 15, replace=False):
    dasar = [semua[i + t] for t in range(T)]
    janggal["lampu_padam"].append(dasar[: T // 2] + [lampu(g) for g in dasar[T // 2:]])
    janggal["kamera_geser"].append(dasar[: T // 2] + [geser(g) for g in dasar[T // 2:]])
    jauh = (i + N // 2) % (N - T)
    janggal["lompat_waktu"].append(dasar[: T // 2] + [semua[jauh + t] for t in range(T // 2)])
t0 = time.time()
s_normal = [kejutan(c) for c in normal]
dtk_klip = (time.time() - t0) / len(normal)
p_normal = [beda_piksel(c) for c in normal]
hasil["kejutan"] = {"klip_normal": len(normal), "bingkai_per_klip": T, "detik_per_klip": round(dtk_klip, 2),
                    "normal": {"rata": round(float(np.mean(s_normal)), 4), "maks": round(float(np.max(s_normal)), 4)}, "jenis": {}}
for nama, daftar in janggal.items():
    s = [kejutan(c) for c in daftar]
    p = [beda_piksel(c) for c in daftar]
    yy = [0] * len(s_normal) + [1] * len(s)
    hasil["kejutan"]["jenis"][nama] = {
        "klip": len(s), "rata": round(float(np.mean(s)), 4),
        "auroc_vjepa": round(float(roc_auc_score(yy, s_normal + s)), 4),
        "auroc_piksel": round(float(roc_auc_score(yy, p_normal + p)), 4),
        "lolos_ambang_maks_normal": int(sum(v > max(s_normal) for v in s)),
    }
# apakah kejutan normal naik saat orang datang/pergi (perubahan wajar) dibanding klip tanpa perubahan?
berubah = [any(jawaban[i + t]["status"] != jawaban[i + T // 2 - 1]["status"] for t in range(T // 2, T)) for i in jendela]
hasil["kejutan"]["normal_berubah"] = {"klip": int(sum(berubah)),
                                      "rata_berubah": round(float(np.mean([s for s, b in zip(s_normal, berubah) if b])), 4) if any(berubah) else None,
                                      "rata_tetap": round(float(np.mean([s for s, b in zip(s_normal, berubah) if not b])), 4) if not all(berubah) else None}
json.dump(hasil, open(KELUAR, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(hasil, ensure_ascii=False))
