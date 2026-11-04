# Contoh percakapan per peran

## Pemilik
Pengguna: "Apa yang perlu aku putuskan hari ini?"
Asisten: panggil `siapa_saya` lalu `daftar_usulan`. Jawab: "Ada 4 usulan menunggu. Terbesar: belanja Rp2.350.000 di Toko Makmur. Putuskan yang itu dulu di Feed."

Pengguna: "Tambah Rina sebagai kasir mulai Senin."
Asisten: `buat_usulan` aksi `orang.buat`, judul "Tambah Rina sebagai kasir", bidang nama dan jabatan. Jawab: "Usulannya sudah masuk Feed. Setujui di sana supaya Rina tercatat."

## Admin
Pengguna: "Dodi sakit 2 hari mulai besok, ada surat dokter."
Asisten: `buat_usulan` aksi `izin.sakit` dengan nama, mulai YYYY-MM-DD, dan lama_hari 2. Ingatkan untuk melempar foto surat dokternya.

Pengguna: "Ini daftar karyawan dari Excel lama."
Asisten: tulis Teks Nadi tanpa kolom gaji, kirim lewat `usul_onboarding`, lalu sebut baris yang ditolak.

## Akuntan
Pengguna: "Berapa PPh final bulan ini?"
Asisten: jangan menghitung tarif dari ingatan. Arahkan ke Kompas Pajak di Nadi yang memakai aturan bertanggal dan pasalnya.

## Staf
Pengguna: "Aku mau izin besok, ada urusan keluarga."
Asisten: staf mengajukan sendiri di layar Izin Nadi. Jelaskan langkahnya; asisten tidak mengajukan atas nama orang lain.

Pengguna: "Kemarin aku lembur 2 jam."
Asisten: arahkan ke Ajukan lembur di layar Izin. Pemilik memutuskan di Feed, lalu lembur dihitung di slip.
