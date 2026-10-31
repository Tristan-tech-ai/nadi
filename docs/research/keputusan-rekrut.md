# Keputusan rekrut, status pelamar, dan Bank Talenta (F2-05)

Ditulis 1 Nov 2026. Masalah P01: pelamar UMKM jarang diberi kabar ("digantung"), pemilik mengetik pesan tawaran satu per satu, dan pelamar bagus yang tidak terpilih hilang begitu saja padahal bulan depan ada lowongan serupa.

## Keputusan
1. **Tahap lamaran** (kolom baru `lamaran.tahap`, terpisah dari `status` yang mencatat proses berkas): `masuk` -> `ditinjau` -> `ditawari` -> `diterima`, atau `ditolak` kapan saja. Hanya pemilik/admin yang mengubah, lewat RPC; setiap perubahan boleh membawa pesan singkat untuk pelamar (maks 500 huruf) dan tercatat waktunya.
2. **Pelacak status tanpa akun**: setelah melamar, pelamar mendapat tautan `/lamar/status#nml_...` (token acak, hanya hash yang disimpan, pola sama dengan slip gaji `nms_`; token di fragmen agar tidak masuk log server). Halaman itu menampilkan nama usaha, lowongan, tahap, pesan, dan tanggal. Berlaku 180 hari. Token dibuat sekali per lamaran dalam 2 jam sejak melamar.
3. **Tawaran dan penolakan dikirim pemilik sendiri lewat wa.me** (tanpa WhatsApp Business API, sesuai keputusan 30 Okt 2026). Nadi menyiapkan teks pesan yang sopan; penolakan selalu berterima kasih dan tidak menyebut alasan yang menyinggung atribut pribadi.
4. **Bank Talenta berbasis izin**: formulir lamar punya centang "Boleh dihubungi untuk lowongan lain di usaha ini" (bawaan tidak dicentang). Saat pemilik membuka lowongan dengan topi yang sama, kartu lowongan menampilkan pelamar lama yang memberi izin, dari 12 bulan terakhir, belum diterima, satu baris per nomor HP (lamaran terbaru). Dasar: persetujuan eksplisit untuk tujuan tambahan (UU 27/2022 PDP, prinsip pembatasan tujuan; pasal belum dikutip per pasal, belum terverifikasi rinci).
5. Tanpa model AI (0 token).

## Kriteria terima rinci
- Pelamar melihat tahap lamarannya tanpa akun lewat tautan; token salah/kedaluwarsa memberi pesan jelas.
- Pemilik mengubah tahap dari layar pelamar, dan halaman status pelamar ikut berubah.
- Tombol wa.me berisi nomor pelamar dan teks tawaran/penolakan.
- Lowongan baru bertopi sama menampilkan pelamar lama yang memberi izin; yang tidak memberi izin tidak tampil.
- Tes SQL (merah dulu), e2e lokal dan produksi, axe 390/1440 terang/gelap.
