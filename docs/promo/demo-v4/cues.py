# Daftar cue suara film v4 (skill sound-effects langkah 2), diambil dari beat sheet film*.js. Satu bunyi per cue, jenis cue
# dipetakan ke kategori pustaka CC0 skill (movement/scene_cut=whoosh, appear/success=pop, click=click, build_up=riser,
# reveal=impact, hover_or_small_ui=tick, error_or_tech=glitch). Ketik tidak diberi bunyi: satu-satunya rekaman ketik di pustaka
# berlisensi Mixkit yang lisensinya belum bisa dicek (halaman lisensi hanya tampil lewat skrip). Jalankan: python -I cues.py
import json
import os

C = []


def cue(t, jenis, desc, dur=None):
    c = {"t": round(t, 3), "type": jenis, "desc": desc}
    if dur:
        c["dur"] = dur
    C.append(c)


# A berkas berserakan
cue(2.5, "movement", "berkas merenggang")
for i, t in enumerate([5.0, 6.2, 7.4]):
    cue(t, "hover_or_small_ui", f"kata {i + 1}")
cue(8.5, "build_up", "riser ke terowongan", 3.4)
cue(11.4, "scene_cut", "kalimat menerobos kamera")
# B terowongan
cue(12.2, "movement", "masuk terowongan")
cue(15.0, "movement", "terowongan makin cepat")
cue(17.9, "reveal", "keluar ke lapangan kunyit")
cue(18.9, "appear", "Mulai Rp0")
# C koin
cue(22.2, "scene_cut", "tarik mundur ke koin")
cue(24.4, "movement", "koin dilempar")
cue(28.6, "reveal", "koin masuk kotak Lempar")
for i in range(9):
    cue(29.0 + i * 0.36 + 0.7, "appear", f"berkas {i + 1} jatuh")
# D membaca, rincian, setujui
cue(34.2, "hover_or_small_ui", "memuat")
cue(35.7, "success", "selesai dibaca")
for i in range(5):
    cue(36.2 + i * 0.42, "hover_or_small_ui", f"siap disetujui {i + 1}")
cue(38.6, "scene_cut", "kalimat tahu dulu")
cue(41.45, "hover_or_small_ui", "sorot kalau disetujui")
cue(42.4, "click", "lihat rincian")
cue(43.5, "appear", "akan ditambah")
cue(46.15, "click", "setujui")
cue(46.3, "reveal", "cap diterima")
# E AI-mu
cue(48.6, "movement", "koin melompat")
cue(50.0, "movement", "koin menggelinding")
cue(56.0, "scene_cut", "ke obrolan")
for t in [56.6, 59.4, 61.8, 65.0, 69.0]:
    cue(t, "appear", "pesan obrolan")
for t in [61.2, 68.5]:
    cue(t, "success", "alat Nadi selesai")
cue(74.4, "scene_cut", "ke tinjau draf")
for i in range(8):
    cue(75.0 + i * 0.78, "hover_or_small_ui", f"baris {i + 1}")
cue(84.65, "click", "terapkan")
cue(85.0, "success", "diterapkan")
cue(88.2, "scene_cut", "kalimat kamu memutuskan")
# F tagihan
cue(91.0, "scene_cut", "kalimat tagih")
cue(93.2, "scene_cut", "ke tagihan publik")
cue(96.4, "movement", "koin terbang ke QRIS")
cue(98.3, "success", "cocok dengan mutasi")
cue(99.0, "reveal", "cap lunas")
# G gaji
cue(104.0, "scene_cut", "kalimat gaji")
cue(106.4, "scene_cut", "ke draf gaji")
cue(108.7, "error_or_tech", "ditahan")
cue(114.0, "scene_cut", "kalimat janggal")
# H alur, tanya
cue(116.6, "scene_cut", "ke alur")
cue(122.05, "click", "buat alur")
cue(122.4, "success", "alur aktif")
cue(123.6, "scene_cut", "ke diagram")
for i in range(3):
    t0 = 124.6 + i * 1.7
    cue(t0 + 0.55, "reveal" if i == 0 else "success", f"invoice {i + 1} lunas")
    cue(t0 + 1.15, "appear", f"kerja {i + 1} masuk")
cue(131.0, "scene_cut", "kalimat tanya")
cue(133.4, "scene_cut", "ke tanya data")
cue(135.05, "click", "tanya")
cue(135.3, "appear", "jawaban")
# I kamera
cue(139.0, "movement", "koin di denah")
cue(140.4, "movement", "kamera menunduk")
cue(150.6, "error_or_tech", "gambar menjadi kotak-kotak")
cue(152.2, "appear", "angka masuk")
cue(152.32, "appear", "angka keluar")
cue(155.4, "scene_cut", "kalimat lorong")
cue(157.8, "scene_cut", "ke peta panas")
# J belajar
cue(163.0, "scene_cut", "ke pemindai")
cue(164.6, "error_or_tech", "format belum dikenal")
cue(166.4, "movement", "koin menjadi lensa")
for i in range(3):
    cue(168.4 + i * 1.4, "hover_or_small_ui", f"bagian {i + 1} menyala")
cue(173.8, "movement", "pemindai baru terbentuk")
for i in range(3):
    cue(176.5 + i * 0.8, "click", f"centang {i + 1}")
for t in [180.6, 183.2, 184.6]:
    cue(t, "success", "struk terbaca")
cue(181.2, "appear", "biaya AI Rp0")
# K, L
cue(188.0, "scene_cut", "ke perangkat")
cue(195.2, "movement", "lemparan terakhir")
cue(197.6, "reveal", "koin mendarat menjadi logo")
cue(198.6, "appear", "kalimat penutup")

json.dump(C, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cues.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(len(C), "cue")
