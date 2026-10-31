# KPI dari jejak dan cermin kinerja (F3-03)

Ditulis 1 Nov 2026. Kriteria antrean: "setiap skor punya penjelasan dari kejadian nyata; karyawan hanya melihat datanya sendiri (tes RLS)". Bahan: kejadian (absen.*, izin.*, kerja.*), kerja.poin_beban dan data.aktual_menit dari F3-01, ringkasan_harian.

## Apa yang diukur (per orang per topi, per minggu)
| Ukuran | Dari kejadian | Kenapa adil |
|---|---|---|
| Kerja selesai (poin) | kerja selesai x poin_beban | memakai poin estimasi, bukan jumlah tugas; tugas besar tidak kalah dari banyak tugas kecil |
| Tepat tenggat | kerja selesai sebelum tenggat / kerja bertenggat | hanya kerja yang punya tenggat |
| Hadir sesuai jadwal | absen.masuk dalam 15 menit dari shift (F3-06) | izin yang disetujui tidak dihitung tidak hadir |
| Kerja lintas topi | kerja bertanda lintas topi | ditampilkan sebagai kontribusi, tidak pernah sebagai minus |

Tidak ada skor gabungan tunggal 0-100. Satu angka yang menggabungkan semua membuat orang berdebat tentang bobot, bukan tentang kerja. Yang tampil adalah empat angka di atas, masing-masing dengan pembanding minggu lalu.

## Penjelasan wajib
Setiap angka punya kalimat dari kejadian nyata dan tautan ke daftarnya:
- "Tepat tenggat 8 dari 10. Dua yang lewat: Cek stok beras (Selasa, lewat 40 menit), Setor kas (Jumat, lewat 1 jam)."
- "Naik 6 poin dari minggu lalu, terutama dari 3 kerja dapur saat Budi izin (lintas topi)."
Model hanya boleh merapikan kalimat dari data yang sudah dihitung SQL; angka dan daftar kejadian tidak pernah dikarang model.

## Cermin karyawan (staf, HP)
- Judul "Kerjamu minggu ini". Empat angka dalam satu kolom, masing-masing dengan kalimat penjelasan dan "lihat rinciannya".
- Pembanding hanya dirinya minggu lalu dan rata-rata tim tanpa nama rekan.
- Nada tidak menyalahkan (VOICE prinsip 6): "2 kerja lewat tenggat" bukan "kamu terlambat 2 kali". Selalu ada jalan banding: "Ada yang keliru? Tandai kejadiannya, pemilik akan melihat."

## Tampilan pemilik
- Tabel bergaris buku kas: orang, empat angka, panah naik/turun dengan teks ("naik 6"). Ketuk orang: halaman cermin yang sama dengan yang dilihat orang itu, ditambah kolom "tinjauan pemilik" (catatan manusia di atas angka).

## Keamanan dan uji
- RLS: staf hanya membaca baris KPI miliknya (app.orang_saya); rata-rata tim dihitung fungsi SECURITY DEFINER yang hanya mengembalikan angka agregat, tanpa id orang lain. Tes SQL: staf A tidak bisa membaca KPI staf B maupun daftar kejadian B lewat penjelasan.
- Tes: setiap baris KPI punya penjelasan tidak kosong yang menyebut minimal satu kejadian nyata (id kejadian tersimpan), atau "belum ada kejadian minggu ini".
