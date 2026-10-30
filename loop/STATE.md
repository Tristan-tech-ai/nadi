# Keadaan loop

Diperbarui setiap tick. Satu sumber kebenaran untuk melanjutkan setelah kompaksi.

## Sekarang
- Tanggal: 30 Okt 2026, sebelum tick pertama.
- Fase: F0 (fondasi). Progres wajib: 0/62.
- Berikutnya: R-01 (ground truth versi tumpukan), lalu F0-03 (migrasi graf_usaha) dan F0-01 (kerangka monorepo).

## Fakta penting yang sudah terverifikasi
- Supabase `nadi` (izyesrryiljitpusaqvf, Singapura, paket Free, compute Nano). Migrasi `fondasi` ter-apply. Migrasi `graf_usaha` BELUM ter-apply (pemanggilan terputus 30 Okt; transaksi tidak masuk sama sekali, dicek: hanya tabel perusahaan dan anggota).
- Ekstensi tersedia: pg_partman, pgmq, pg_cron, pg_net, vector, pg_jsonschema, ltree, pg_trgm, btree_gin. Tidak ada pg_uuidv7 (pakai app.uuid7()).
- Secret Edge Function `ANTHROPIC_API_KEY` ada dan diterima API (uji 30 Okt: status 200, model kecil). Fungsi uji `cek-kunci` sudah dimatikan (410).
- Vercel: akses MCP ke tim team_DIFMD08eDgAex5GasIRHz7Fj sudah disetujui. Proyek lama `edusmart` jangan disentuh. Belum ada proyek `nadi`.
- GitHub: repo privat Tristan-tech-ai/nadi, gh CLI masuk sebagai Tristan-tech-ai. Integrasi GitHub di Vercel tersambung ke akun lain (namespace Sfhonda); pemasangan Vercel GitHub App di Tristan-tech-ai belum dipastikan.

## Pemblokir
- (belum ada)
