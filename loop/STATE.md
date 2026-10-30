# Keadaan loop

Diperbarui setiap tick. Satu sumber kebenaran untuk melanjutkan setelah kompaksi.

## Sekarang
- Tanggal: 30 Okt 2026 23:50, setelah tick 2.
- Fase: F0. Progres wajib: 3/63 (R-01, F0-01, F0-03).
- Berikutnya: F0-02 (proyek Vercel 'nadi' + env + deploy), lalu D-01 (riset desain) dan F0-10 (korpus contoh).
- Database: migrasi fondasi, graf_usaha, mode_hemat ter-apply; sidik md5 identik repo (cek: scripts/cek-migrasi.py dengan json dari supabase_migrations). Tes: supabase/tests/isolasi_tenant.test.sql (38 asersi). pg_cron: nadi-ringkas-harian 17:30 UTC, nadi-partman 18:00 UTC.
- Anti-macet: hook macet_guard (pre/post/elisitasi/start) di loop/hooks, pengawas loop/watchdog.py (pid di loop/.watchdog.pid), hook git pre-push (jejak + gerbang hijau) dan commit-msg dipasang dari scripts/git-hooks oleh gate.sh.
- Insiden tick 2: loop diam 20:34-23:26 menunggu dialog konfirmasi MCP (drop policy). Diperbaiki dengan hook Elicitation. Commit dengan jejak sempat ter-push karena `gate.sh | tail && git push`; ditulis ulang (force-with-lease, satu commit milik loop) dan dicegah pre-push.

## Fakta penting yang sudah terverifikasi
- Supabase `nadi` (izyesrryiljitpusaqvf, Singapura, paket Free, compute Nano). Migrasi `fondasi` ter-apply. Migrasi `graf_usaha` BELUM ter-apply (pemanggilan terputus 30 Okt; transaksi tidak masuk sama sekali, dicek: hanya tabel perusahaan dan anggota).
- Ekstensi tersedia: pg_partman, pgmq, pg_cron, pg_net, vector, pg_jsonschema, ltree, pg_trgm, btree_gin. Tidak ada pg_uuidv7 (pakai app.uuid7()).
- Secret Edge Function `ANTHROPIC_API_KEY` ada dan diterima API (uji 30 Okt: status 200, model kecil). Fungsi uji `cek-kunci` sudah dimatikan (410).
- Vercel: akses MCP ke tim team_DIFMD08eDgAex5GasIRHz7Fj sudah disetujui. Proyek lama `edusmart` jangan disentuh. Belum ada proyek `nadi`.
- GitHub: repo privat Tristan-tech-ai/nadi, gh CLI masuk sebagai Tristan-tech-ai. Integrasi GitHub di Vercel tersambung ke akun lain (namespace Sfhonda); pemasangan Vercel GitHub App di Tristan-tech-ai belum dipastikan.

## Pemblokir
- (belum ada)
