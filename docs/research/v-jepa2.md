# Eksperimen V-JEPA 2 untuk Mata (F5-05)

Dijalankan 4 Nov 2026 di CPU (WSL Ubuntu 22.04, 6 utas torch). Skrip: `apps/web/scripts/eval-vjepa2.py`. Hasil mentah ada di bagian Angka.

**Kesimpulan:**
- **Resep dari sedikit contoh berhasil.** Dengan 2 contoh per kelas, keadaan meja benar 98,8%. Dengan 20 contoh, 100%. Resep juga berpindah ke meja yang belum pernah dilihat dengan 100% benar.
- **Skor kejutan gagal.** Galat tebakan predictor tidak naik untuk kejadian janggal (AUROC 0,16 sampai 0,34, lebih buruk dari menebak). Beda piksel sederhana mendapat 0,97 sampai 1,0.
- **Di Mata belum dipakai.** Alasannya ada di bagian Keputusan.

## Model
| Hal | Isi |
|---|---|
| Model | `facebook/vjepa2-vitl-fpc64-256`, kartu model resmi https://huggingface.co/facebook/vjepa2-vitl-fpc64-256 (dibaca 4 Nov 2026) |
| Lisensi | MIT (kartu model) |
| Ukuran | `model.safetensors` 1,30 GB; ViT-L 24 lapis (hidden 1024, patch 16, tubelet 2) + predictor 12 lapis (384) |
| Pustaka | transformers 5.20.2 (`VJEPA2Model`), torch 2.14.1+cpu, scikit-learn 1.7.2 |
| Masukan | bingkai 256x256, normalisasi ImageNet (dari `video_preprocessor_config.json`); bingkai diperkecil utuh tanpa potong tengah agar seluruh ruangan terlihat |

## Data
Korpus `fixtures/korpus/mata`:
- 60 cuplikan, 3 zona meja, 180 contoh berlabel (95 terisi).
- Gambar dibuat dari latar ruangan dan tiga foto orang CC0 (docs/ASSETS.md). Videonya berupa tayangan gambar diam: setiap cuplikan ditahan 2 detik.
- Untuk uji kejutan, satu klip berisi 8 cuplikan berurutan (16 detik waktu nyata, seperti time-lapse).

## Uji A: resep dari sedikit contoh
- **Cara:** potongan kotak tiap zona meja (gambar diam = satu tubelet) masuk ke encoder beku. Token dirata-rata menjadi vektor 1024. Di atasnya regresi logistik dilatih dengan k contoh per kelas, lalu diuji pada semua contoh lain. Setiap k diulang 30 kali dengan pilihan contoh acak (benih tetap).
- **Pembanding:**
  - beda terhadap latar kosong (agen edge F5-04): 94,4%, tanpa contoh berlabel, butuh gambar latar;
  - pendeteksi orang di peramban (F5-01): 91,7%.

| k per kelas | Benar rata-rata | Benar terburuk dari 30 ulangan |
|---|---|---|
| 1 | 93,0% | 82,6% |
| 2 | 98,8% | 89,8% |
| 5 | 99,0% | 82,4% |
| 10 | 99,8% | 94,4% |
| 20 | 100% | 100% |

- **Zona baru:** dilatih pada dua meja (120 contoh), diuji pada meja ketiga. Hasilnya meja-1 100%, meja-2 100%, meja-3 100%.
- **Waktu:** 0,60 detik per potongan zona di CPU.

## Uji B: skor kejutan
- **Cara:** encoder hanya melihat 4 cuplikan pertama, lalu predictor menebak token 4 cuplikan berikutnya. Skor kejutan = rata-rata selisih mutlak antara tebakan dan token encoder dari klip penuh.
- **Kejadian janggal** disisipkan pada paruh kedua klip:
  - lampu padam (kecerahan x0,45);
  - kamera bergeser (sekitar 10% tinggi gambar);
  - lompat waktu (paruh kedua diambil dari setengah video kemudian).
- **Pembanding:** beda piksel antara cuplikan terakhir konteks dan cuplikan sasaran.

| Kejadian | Klip | AUROC V-JEPA 2 | AUROC beda piksel | Melewati skor normal tertinggi |
|---|---|---|---|---|
| Lampu padam | 15 | 0,29 | 1,00 | 0 dari 15 |
| Kamera bergeser | 15 | 0,16 | 1,00 | 0 dari 15 |
| Lompat waktu | 15 | 0,34 | 0,97 | 0 dari 15 |

- Skor 53 klip normal: rata-rata 1,954, tertinggi 2,021. Klip janggal justru sedikit lebih rendah (1,907 sampai 1,938).
- Klip normal yang berisi orang datang atau pergi (33 klip) tidak lebih tinggi daripada yang tetap (1,948 vs 1,964).
- **Waktu:** 3,4 detik per klip 8 bingkai (dua kali encode + predictor).

### Kenapa gagal (dugaan, belum dibuktikan)
1. Predictor dilatih pada video bergerak alami dengan banyak bingkai. Time-lapse dari gambar diam berada di luar sebarannya, jadi galatnya tinggi dan rata untuk semua klip. Selisih normal dan janggal tenggelam di situ.
2. Selisih dihitung pada keluaran encoder apa adanya. Di pelatihan resmi, sasaran dan cara penyamaran (mask) berbeda. Cara ini belum dicocokkan dengan kode resmi github.com/facebookresearch/vjepa2.
3. Kejadian janggal yang paling umum di toko (lampu, kamera) sudah ditangkap sempurna oleh beda piksel. Model besar tidak menambah apa-apa untuk kasus ini.

## Batas jujur
- Korpus sintetis dan mudah: latar sama, orang ditempel, cahaya tetap. Angka 98 sampai 100% untuk resep tidak boleh dianggap angka kamera warung sungguhan.
- Uji kejutan memakai time-lapse dari gambar diam, bukan video bergerak. Uji pada rekaman kamera nyata bisa memberi hasil lain.
- Beban di kotak lokal: 1,3 GB berkas + sekitar 2 GB RAM + 0,6 detik CPU per zona. Agen Rust F5-04 hanya 2 MB dan butuh milidetik.

## Keputusan
- **Mata tetap memakai** pendeteksi orang di peramban (F5-01) dan agen edge beda-latar (F5-04).
- **V-JEPA 2 tidak dipasang di agen edge sekarang:**
  - ukurannya 650 kali agen;
  - akurasi tinggi di korpus ini belum terbukti di kamera nyata;
  - skor kejutan tidak bekerja.
- **Calon kegunaan nanti:** pengenal "resep baru" dari 2 sampai 10 contoh berlabel (misalnya rak kosong, meja kotor) yang dijalankan di server atau di HP pemilik kalau ada data kamera nyata.
- **Syaratnya:** uji ulang pada rekaman kamera sungguhan berizin dengan target minimal 90% pada k = 10.
- **Kejutan memakai beda piksel/latar**, yang sudah 1,0 untuk lampu dan kamera bergeser.

## Angka mentah
```json
{"resep": {"contoh": 180, "terisi": 95, "detik_per_potongan": 0.604, "k": {"1": {"rata": 0.9301, "min": 0.8258}, "2": {"rata": 0.9877, "min": 0.8977}, "5": {"rata": 0.99, "min": 0.8235}, "10": {"rata": 0.9981, "min": 0.9437}, "20": {"rata": 1.0, "min": 1.0}}, "zona_baru": {"meja-1": 1.0, "meja-2": 1.0, "meja-3": 1.0}},
 "kejutan": {"klip_normal": 53, "bingkai_per_klip": 8, "detik_per_klip": 3.36, "normal": {"rata": 1.9538, "maks": 2.0208},
  "jenis": {"lampu_padam": {"klip": 15, "rata": 1.9305, "auroc_vjepa": 0.2855, "auroc_piksel": 1.0}, "kamera_geser": {"klip": 15, "rata": 1.9069, "auroc_vjepa": 0.156, "auroc_piksel": 1.0}, "lompat_waktu": {"klip": 15, "rata": 1.9379, "auroc_vjepa": 0.3421, "auroc_piksel": 0.9711}},
  "normal_berubah": {"klip": 33, "rata_berubah": 1.9475, "rata_tetap": 1.9641}}}
```

Ulangi: `wsl -d Ubuntu-22.04 -- bash -lc "cd <repo> && ~/vjepa/bin/python apps/web/scripts/eval-vjepa2.py ~/vjepa-model fixtures/korpus/mata hasil.json"` (sekitar 7,5 menit; venv dan unduhan model dijelaskan di loop/LEARN.md).
