# Cadangan database mingguan (CADANGAN-01)

Setiap Senin 02.00 WITA GitHub Actions (`.github/workflows/cadangan-mingguan.yml`, skrip `scripts/cadangan.py`) membuat cadangan
database Nadi:

1. `supabase db dump` tiga berkas, sesuai docs Supabase "Backup and Restore using the CLI" (dibaca 13 Nov 2026):
   `roles.sql` (`--role-only`), `schema.sql`, `data.sql` (`--use-copy --data-only`).
2. Ketiganya diarsip `tar.gz` lalu dienkripsi AES-256-CBC dengan PBKDF2 600.000 iterasi (`openssl enc`) memakai kunci milik Nadi.
   Hugging Face hanya menyimpan berkas terenkripsi.
3. Diunggah ke Storage Bucket privat Hugging Face (`db/nadi-db-YYYYMMDD.tar.gz.enc` + `.sha256`). Akun gratis HF punya
   100 GB penyimpanan privat (docs HF "Storage limits", dibaca 13 Nov 2026); bucket tidak berversi, jadi berkas lama benar-benar
   terhapus saat diputar.
4. Diunduh balik, sidik SHA-256 dicocokkan, didekripsi, dan isinya dicek tiga berkas. Bila salah satu gagal, job merah.
5. Hanya 8 cadangan terbaru (sekitar 2 bulan) yang disimpan.

Yang belum ikut: berkas di Supabase Storage (foto nota dan lampiran). Itu butuh kunci akses Storage dan masuk rencana berikutnya.

## Memasang (sekali, oleh pemilik repo)

1. Hugging Face: Settings, Access Tokens, buat token fine-grained dengan izin tulis untuk bucket milikmu (atau token Write).
2. Supabase: Connect, Session pooler, salin string sambungan (berisi sandi database).
3. Buat kunci enkripsi panjang acak (misalnya 40 huruf acak dari pengelola sandi). Simpan salinannya di tempat aman di luar GitHub:
   tanpa kunci ini cadangan tidak bisa dibuka.
4. Pasang di repo, dari folder nadi, tanpa menempel nilainya di percakapan:
   `gh secret set NADI_DB_URL -R Tristan-tech-ai/nadi`, `gh secret set HF_TOKEN -R Tristan-tech-ai/nadi`,
   `gh secret set NADI_KUNCI_CADANGAN -R Tristan-tech-ai/nadi` (masing-masing meminta nilainya), lalu
   `gh variable set HF_BUCKET -R Tristan-tech-ai/nadi -b "<nama-pengguna-hf>/nadi-cadangan"`.
5. Jalankan sekali: `gh workflow run cadangan-mingguan.yml -R Tristan-tech-ai/nadi`.

## Memulihkan

1. Unduh cadangan: `hf buckets cp hf://buckets/<nama-pengguna-hf>/nadi-cadangan/db/nadi-db-YYYYMMDD.tar.gz.enc ./`
2. Cocokkan sidik dengan berkas `.sha256`: `sha256sum nadi-db-YYYYMMDD.tar.gz.enc`.
3. Dekripsi: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in nadi-db-YYYYMMDD.tar.gz.enc -out nadi-db.tar.gz` (meminta kunci),
   lalu `tar -xzf nadi-db.tar.gz`.
4. Pulihkan ke proyek Supabase kosong (bukan produksi yang masih berjalan), sesuai docs Supabase:
   `psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql --dbname "<string sambungan proyek tujuan>"`.
5. Cek: jumlah baris `perusahaan`, `orang`, dan `jurnal` sama dengan sebelum masalah.
