# Lingkaran belajar rekrutmen (F2-07)

Ditulis 1 Nov 2026. Masalah P10: pemilik menilai pelamar dengan pertanyaan wawancara dan uji kerja yang sama bertahun-tahun tanpa
tahu mana yang benar-benar menandai karyawan yang bagus. Kriteria antrean: KPI 3-6 bulan ditautkan ke sinyal seleksi; laporan
pertanyaan yang memprediksi kinerja, dengan peringatan ukuran sampel.

## Data yang sudah ada dan yang kurang
- Sinyal seleksi: nilai rubrik per jawaban wawancara (jawaban_wawancara.nilai.skor 0-100, per pertanyaan) dan uji kerja hitungan
  (uji_lamaran jenis kerja: benih + jawaban, dinilai ulang di TypeScript lewat buatUji/nilaiUji). IPIP TIDAK dipakai (keputusan
  31 Okt 2026: kepribadian tidak untuk meranking).
- Kinerja: kerja selesai di papan kerja (kerja.pelaksana_id, poin_beban, tenggat, selesai_at), ukuran yang sama dengan KPI F3-03.
- Yang kurang: lamaran tidak tertaut ke orang. Ditambah lamaran.orang_id lewat RPC jadikan_karyawan (pelamar berstatus diterima
  dicatat sebagai karyawan dengan tanggal mulai dan topi lowongannya).

## Keputusan
1. Jendela kinerja = hari ke-90 sampai ke-180 sejak mulai kerja (bulan ke-3 sampai ke-6), dipotong di hari ini; orang yang belum
   genap 90 hari belum dihitung dan disebut jumlahnya. Ukuran: poin selesai per minggu dan persen tepat waktu (hanya kerja bertenggat).
2. Hubungan dihitung dengan korelasi peringkat Spearman (peringkat rata-rata untuk nilai sama), karena skor rubrik dan poin tidak
   linear dan sampel UMKM kecil. Tanpa selang kepercayaan (belum dibaca dari sumber yang bisa dikutip); gantinya aturan sampel tegas:
   n < 10 tidak ada angka ("belum cukup data"); 10 sampai 29 ada angka dengan peringatan "petunjuk awal"; >= 30 tanpa peringatan sampel.
   Selalu ada kalimat bahwa hubungan bukan sebab-akibat.
3. Laporan hanya agregat per sinyal; nama orang tidak ditampilkan. Hanya pemilik dan admin.
