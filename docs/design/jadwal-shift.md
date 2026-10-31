# Layar jadwal shift /app/jadwal (F3-06)

Ditulis 1 Nov 2026, pasangan docs/research/shift-f3-06.md. Semua peringatan di layar ini berasal dari pasal yang sudah dikutip di berkas riset itu; yang belum terverifikasi (shift malam perempuan) tidak tampil sama sekali.

## Pemilik/admin, desktop 1440
- Kepala: "Jadwal minggu ini" + pemilih minggu (tanggal 3 Nov sampai 9 Nov 2026) + pola usaha ("6 hari kerja, 40 jam seminggu").
- Grid orang x hari bergaris buku kas. Sel berisi jam ("08.00-15.00", huruf angka tabular) atau "Libur". Kolom terakhir: total jam seminggu, rata kanan.
- Ketuk sel: lembar samping berisi jam mulai, jam selesai, istirahat (bawaan 30 menit untuk shift > 4 jam), topi yang dipakai di shift itu.
- Tombol utama satu: "Salin dari minggu lalu". Tombol kedua (teks): "Kosongkan minggu".

## Pemilik/admin, HP 390
- Bukan grid tujuh kolom (tidak terbaca). Daftar per hari: kepala hari ("Senin, 3 Nov"), di bawahnya baris orang + jam. Pil hari di atas untuk melompat.

## Peringatan (selalu teks + ikon, tidak hanya warna)
| Kondisi | Teks | Tingkat |
|---|---|---|
| Jam biasa melebihi 7 jam/hari (pola 6) atau 8 jam/hari (pola 5), atau 40 jam/minggu | "Selebihnya 2 jam dihitung lembur dan butuh persetujuan Sari." | kunyit (perlu dilihat) |
| Lembur > 4 jam/hari atau > 18 jam/minggu | "Lembur paling lama 4 jam sehari dan 18 jam seminggu." | cap, simpan ditolak |
| Shift > 4 jam tanpa istirahat >= 30 menit | "Beri istirahat minimal 30 menit; istirahat tidak dihitung jam kerja." | kunyit |
| Hari libur < 1 (pola 6) atau < 2 (pola 5) | "Budi belum punya hari libur minggu ini." | kunyit |

Usaha yang menandai "waktu kerja diatur di PK/PP/PKB" tetap melihat peringatan kunyit, tetapi hanya batas lembur yang memblokir.

## Staf (HP)
- "Jadwalmu minggu ini": tujuh baris hari, hari ini disorot stabilo.
- Bila ada jam lembur yang dijadwalkan: kartu "Lembur Sabtu 2 jam (16.00-18.00)" dengan dua tombol besar "Setuju" dan "Tidak bisa". Tidak setuju tidak butuh alasan; pemilik melihat "Sari tidak bisa lembur Sabtu" tanpa nada menyalahkan (VOICE prinsip 6). Persetujuan dicatat dengan waktu, karena Pasal 78 ayat (1) huruf a mensyaratkannya.

## Keadaan
- Kosong: "Belum ada jadwal minggu ini. Salin dari minggu lalu, atau ketuk satu sel untuk mulai."
- Memuat: skeleton grid/daftar. Galat simpan: "Jadwal belum tersimpan. Coba lagi; isianmu masih ada."
- Luring (staf): jadwal terakhir tetap tampil dengan keterangan "terakhir diperbarui 08.15".

## Kaitan
- Jam jadwal mengisi "jam jadwal" Pembagi kerja adil (docs/design/bagi-adil.md).
- Absen masuk di luar shift yang dijadwalkan ditandai di laporan absen, bukan ditolak.
