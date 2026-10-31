# Papan kerja /app/kerja (F3-01, layar)

Ditulis 1 Nov 2026, pasangan docs/research/poin-beban.md. Ikuti DIRECTION.md §4 (staf: satu tugas per layar, tombol besar) dan ANTI-SLOP (tanpa deretan tiga kartu sama besar, status selalu teks + warna).

## Pemilik/admin (HP)
- Kepala: "Kerja hari ini" + ringkasan angka: Baru 4, Jalan 2, Tunggu 1, Selesai 7.
- Pil saringan per kolom (bukan papan kanban empat kolom di HP; empat kolom sempit tidak terbaca di 390 px). Desktop 1440: empat kolom bergaris buku kas, kolom Selesai hanya hari ini.
- Kartu kerja: judul, topi + pelaksana, tenggat ("Hari ini, 15.00"), poin dengan sumber ("2 poin, dari 5 kerja serupa"), tanda lintas topi bila ada. Tanpa sobekan thermal (itu khusus kartu Usulan).
- Tombol utama satu: "Tambah kerja" (lembar bawah: judul, topi, pelaksana opsional, tenggat). Poin tampil setelah disimpan beserta alasannya; bisa ditimpa ("Ubah poin").

## Staf (HP)
- Satu kerja aktif per layar: judul besar, tenggat, tombol besar sesuai keadaan: Mulai / Tunggu dulu / Selesai. Di bawahnya daftar kerja berikutnya (maks 5).
- Setelah Selesai: "Selesai dalam 42 menit (perkiraan 30)". Tanpa nada menyalahkan bila lebih lama (VOICE prinsip 6).

## Keadaan wajib
Kosong ("Belum ada kerja hari ini. Tambah kerja pertama, misalnya Cek stok beras."), memuat (skeleton kartu), galat, luring (aksi Mulai/Selesai diantre dan dikirim saat online), tanpa izin.

## Gerak
Satu gerak bermakna: kartu yang diselesaikan bergeser ke kolom Selesai (transform 200 ms), seketika bila prefers-reduced-motion.
