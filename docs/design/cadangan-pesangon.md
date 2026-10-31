# Kartu "Cadangan pesangon" di /app/gaji (F4-09)

Ditulis 1 Nov 2026, pasangan docs/research/pesangon-f4-09.md. Hanya pemilik yang melihat kartu ini (angka per orang berasal dari data gaji rahasia).

## Isi kartu (atas ke bawah)
1. Judul "Cadangan pesangon" dan label kecil bergaris "Perkiraan, belum final" (teks, bukan hanya warna).
2. Angka utama: kewajiban skenario dasar seluruh karyawan aktif, komponen Rupiah, contoh "Rp86.400.000". Di bawahnya satu kalimat: "Kalau semua karyawan berhenti hari ini dengan alasan umum (1 kali), menurut PP 35/2021 Pasal 40."
3. Rentang dalam satu baris bergaris buku kas: "Bila usaha rugi: Rp52.200.000 · Dasar: Rp86.400.000 · Bila pensiun: Rp137.700.000" (pengali 0,5 / 1 / 1,75 pada pesangon; UPMK tetap 1 kali. Contoh konsisten: pesangon dasar Rp68.400.000 + UPMK Rp18.000.000).
4. Saran sisihan: "Sisihkan Rp7.200.000 sebulan selama 12 bulan untuk menutup skenario dasar." Bila pemilik mengisi saldo cadangan yang sudah ada, saran dihitung dari kekurangannya.
5. Rincian (lipat, dibuka dengan ketuk): tabel orang, masa kerja ("4 tahun 2 bulan"), upah dasar (pokok + tunjangan tetap), bulan pesangon, bulan UPMK, kewajiban dasar. Kolom angka rata kanan, tabular.
6. Isian per orang "Iuran dana pensiun dari usaha yang sudah dibayar" (Pasal 58), kosong bawaan, dengan keterangan "Hanya program dana pensiun sukarela, bukan BPJS Jaminan Pensiun."

## Keadaan
- Belum ada data gaji: "Isi gaji pokok dan tunjangan tetap di halaman Orang dulu. Cadangan pesangon dihitung dari angka itu."
- Ada karyawan tanpa tanggal mulai: barisnya tampil dengan "Tanggal mulai belum diisi" dan tautan ke halaman orangnya, tidak ikut dijumlah; angka utama diberi catatan "2 orang belum dihitung".
- Galat: "Cadangan pesangon belum bisa dihitung. Coba muat ulang; data gaji tidak berubah."
- Memuat: skeleton angka besar + 3 baris.

## Nada
Tidak menakut-nakuti dan tidak menyuruh: angka besar ditulis apa adanya, tanpa kata "wajib menyisihkan". Penjelasan sumber selalu satu ketukan dari angka ("Dari mana angka ini?" membuka kutipan Pasal 40 ayat (2)-(3) dan Pasal 157 UU 6/2023).

## Uji
- Tangkapan 390/1440 terang/gelap, axe tanpa pelanggaran serius.
- Akun admin dan staf tidak melihat kartu (e2e + tes SQL fungsi pemilik saja).
