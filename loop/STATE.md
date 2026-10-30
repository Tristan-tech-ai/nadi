# Keadaan loop

Diperbarui setiap tick. Satu sumber kebenaran untuk melanjutkan setelah kompaksi.

## Sekarang
- Tanggal: 31 Okt 2026 02:10, setelah tick 6.
- Fase: F0. Progres wajib: 7/65 (+F0-04).
- Berikutnya: F0-10 (korpus contoh), F0-04B (masuk staf kode+ID), F0-05 (kerangka aplikasi, PWA, Feed), F0-08 (paket industri).
- Auth: src/app/auth-actions.ts (masuk/daftar/keluar), src/lib/sesi.ts (bacaSesi/wajibSesi/wajibPerusahaan, hanya di balik Suspense), src/app/app/actions.ts (buatPerusahaan, pindahPerusahaan + refreshSession). createClient memanggil connection(). Akun uji e2e e2e-a/e2e-b@uji.nadi.local, sandi di apps/web/.env.e2e.local (diabaikan git; salinan di scratchpad e2e_sandi.txt). Produksi belum memuat auth (deploy berkas berikutnya bersama landing/F0-05).
- Sistem desain: src/lib/tokens.ts (sumber warna, diuji kontras dan sinkron dengan globals.css), src/lib/format.ts (formatRupiah/Tanggal/Jam/Persen), komponen di src/components/ui (Tombol, Rupiah, Cap, KartuUsulan, LogoNadi), ikon dari @phosphor-icons/react/dist/ssr (nama berakhiran Icon), lembar /dev/komponen (noindex).
- Desain: arah 'kertas kerja yang hidup' (docs/design/DIRECTION.md), palet kertas/tinta/kunyit/cap/daun/laut tanpa ungu, sapaan 'kamu', format Rp1.250.000. Gerbang `slop` memeriksa aturan [M] di ANTI-SLOP.md.
- Produksi: https://nadi-well-13fd.vercel.app (proyek Vercel prj_FEXfQJCj2AulucGiuO6WniLz4KJ4, sin1, Node 24, install `npx --yes pnpm@10.29.2 install`). Deploy lewat create_deployment dengan berkas (atau redeploy deploymentId) karena GitHub App belum terpasang (F0-02B terblokir, UNTUK-TRISTAN). Deploy hanya di titik penting.
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
