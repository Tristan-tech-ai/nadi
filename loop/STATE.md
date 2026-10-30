# Keadaan loop

Diperbarui setiap tick. Satu sumber kebenaran untuk melanjutkan setelah kompaksi.

## Sekarang
- Tanggal: 30 Okt 2026, setelah tick 1.
- Fase: F0 (fondasi). Progres wajib: 2/63 (R-01, F0-01).
- Berikutnya: F0-03 (migrasi graf_usaha: berkas sudah ada di supabase/migrations/20261030100100_graf_usaha.sql, belum ter-apply; tambah mode hemat + tes SQL), lalu D-01 (riset desain) dan F0-02 (proyek Vercel).
- Catatan teknis baru: Next 16.4.3 dengan Cache Components aktif; membaca cookies() di luar <Suspense> = galat build (docs bawaan 02-guides/authentication-with-cache-components.md). Tailwind lewat @tailwindcss/turbopack. TS ^5 dan ESLint ^9 sesuai template resmi.

## Fakta penting yang sudah terverifikasi
- Supabase `nadi` (izyesrryiljitpusaqvf, Singapura, paket Free, compute Nano). Migrasi `fondasi` ter-apply. Migrasi `graf_usaha` BELUM ter-apply (pemanggilan terputus 30 Okt; transaksi tidak masuk sama sekali, dicek: hanya tabel perusahaan dan anggota).
- Ekstensi tersedia: pg_partman, pgmq, pg_cron, pg_net, vector, pg_jsonschema, ltree, pg_trgm, btree_gin. Tidak ada pg_uuidv7 (pakai app.uuid7()).
- Secret Edge Function `ANTHROPIC_API_KEY` ada dan diterima API (uji 30 Okt: status 200, model kecil). Fungsi uji `cek-kunci` sudah dimatikan (410).
- Vercel: akses MCP ke tim team_DIFMD08eDgAex5GasIRHz7Fj sudah disetujui. Proyek lama `edusmart` jangan disentuh. Belum ada proyek `nadi`.
- GitHub: repo privat Tristan-tech-ai/nadi, gh CLI masuk sebagai Tristan-tech-ai. Integrasi GitHub di Vercel tersambung ke akun lain (namespace Sfhonda); pemasangan Vercel GitHub App di Tristan-tech-ai belum dipastikan.

## Pemblokir
- (belum ada)
