-- Q-17 (docs/quality/review-f1-06b.md, bagian Invarian): setiap usulan selalu bisa dilihat pemilik. Kebijakan baca usulan_baca
-- memakai untuk_peran, sehingga himpunan tanpa 'pemilik' menyembunyikan usulan dari penanggung jawab akhir. Semua jalur yang ada
-- sudah mematuhinya (1 Nov 2026: 0 baris tanpa pemilik); constraint ini menjaga jalur baru agar gagal keras, bukan diam-diam.
alter table public.usulan add constraint usulan_pemilik_melihat check ('pemilik' = any(untuk_peran));
