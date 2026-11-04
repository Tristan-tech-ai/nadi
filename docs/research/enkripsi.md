# Enkripsi di Nadi: apa yang ada, perlukah end-to-end (4 Nov 2026)

## Yang sudah ada

- **Saat dikirim.** Semua lalu lintas memakai HTTPS (TLS 1.2/1.3), sesuai halaman /keamanan.
- **Saat disimpan.** Proyek Supabase "encrypted at rest by default" (docs Supabase, halaman pgsodium, diakses 4 Nov 2026). Ini berlaku untuk database dan cadangannya.
- **Rahasia.** Kunci AI, token push, dan sejenisnya disimpan di Supabase Vault: enkripsi terautentikasi libsodium, kunci disimpan terpisah dari database (docs Supabase Vault).
- **Data sangat pribadi diminimalkan:**
  - NIK disimpan sebagai sidik hash + 4 digit akhir;
  - token tautan (slip, tablet, MCP) disimpan sebagai hash;
  - video Mata dan rekaman wawancara diproses di perangkat; video tidak pernah diunggah.
- **Akses.** RLS per usaha dan per peran, diuji di setiap perubahan, ditambah audit log.

## End-to-end (E2EE) belum ada, dan tidak cocok untuk sebagian besar data Nadi

E2EE berarti server tidak bisa membaca data sama sekali. Fitur yang langsung mati bila itu diterapkan:
- Lempar Saja (server membaca berkas);
- Analis Malam dan Sarapan Data;
- pengingat tagihan terjadwal;
- process mining;
- server MCP untuk AI pengguna;
- Ruang Akuntan dan berbagi data antara pemilik, admin, dan akuntan (perlu berbagi kunci);
- pencarian.

Akibat lain: lupa kata sandi berarti data hilang.

UU PDP 27/2022 mewajibkan pengamanan yang layak (enkripsi saat dikirim dan disimpan, kendali akses, pencatatan). E2EE tidak diwajibkan. Pasal persisnya dibaca dari teks resmi saat tugas ini dikerjakan.

## Rencana (belum dikerjakan, menunggu urutan)

- **Enkripsi kolom untuk data paling sensitif.** Nomor rekening karyawan dan gaji pokok dienkripsi di tingkat aplikasi, dengan kunci di Vault, dan dibuka hanya oleh fungsi yang berhak.
- **Brankas dokumen pribadi opsional dengan enkripsi di perangkat.** Contoh isinya: KTP asli, kontrak kerja. Brankas ini tidak dibaca AI, dan pemilik memegang kuncinya. Ada peringatan bahwa kehilangan kunci berarti dokumen tidak bisa dibuka.
- **Halaman /keamanan** menyebut dengan jujur apa yang terenkripsi dan apa yang tidak.
