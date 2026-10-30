# Nadi

Sistem saraf untuk usaha: platform operasional AI-first untuk UMKM dan perusahaan Indonesia. Rencana produk: `docs/PLAN.md`.
Dikerjakan oleh loop otonom: baca `loop/wake_header.txt` (kontrak tick, perintah tetap, gerbang, penjaga) dan `loop/STATE.md` dulu. Hook penjaga ada di `loop/hooks/`, didaftarkan di pengaturan agen lokal di luar repo.

## Peta repo
- `apps/web`: Next.js (App Router) + TypeScript, dideploy ke Vercel (region sin1).
- `supabase/migrations`: salinan persis setiap migrasi yang di-apply lewat MCP Supabase (proyek `izyesrryiljitpusaqvf`, Singapura).
- `supabase/tests`: tes SQL, dijalankan lewat execute_sql di dalam transaksi yang dibatalkan.
- `supabase/functions`: Edge Functions (Deno). Semua panggilan AI lewat sini, memakai secret `ANTHROPIC_API_KEY`.
- `loop/`: mesin loop (antrean, gerbang, keadaan, log, keputusan, pembelajaran).
- `docs/`: rencana, desain (`docs/design`), riset (`docs/research`), kualitas (`docs/quality`), `docs/ASSETS.md` (lisensi aset).

## Perintah
- `python -I loop/next_task.py` (tugas berikutnya), `... check`, `... done ID BUKTI`, `... progress`
- `bash loop/gate.sh` (rahasia, uji diri loop, lint, typecheck, unit, build; menulis `loop/gate_last.json`)
- `pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`

## Aturan teknis
- **Next.js**: versinya baru dan berbeda dari pengetahuan umum. Baca `apps/web/node_modules/next/dist/docs/` sebelum menulis kode Next.
- **Rahasia tidak pernah masuk git**, tidak dibaca, tidak dicetak. Env publik di Vercel; rahasia sebagai env sensitive Vercel atau secret Supabase. Tanpa service-role key; isolasi lewat RLS.
- **Multi-tenant**: setiap tabel tenant punya `perusahaan_id`, RLS memakai `(select app.pid())` dari klaim JWT. Setiap tabel diberi hak eksplisit, karena default privileges di public dicabut. Setiap perubahan skema disertai tes SQL dan `get_advisors`.
- **ID**: `app.uuid7()`. Tabel bervolume tinggi (kejadian, audit_log) dipartisi per bulan dengan pg_partman.
- **Konfigurasi adalah data**: tarif pajak, BPJS, UMP, paket industri ada di tabel bertanggal dengan sumber. Yang belum diverifikasi ke teks resmi berstatus `terverifikasi=false` dan tidak dipakai sebagai preset.
- **AI**: tangga kecerdasan, dari aturan pasti ke model kecil ke model menengah/besar. Ekstraktor terkompilasi dan Bank Data untuk menghemat token. Data nyata tidak lewat kunci AI gratis.
- **Bahasa UI**: Indonesia sehari-hari, mobile-first, ikuti `docs/design/VOICE.md` dan `ANTI-SLOP.md`.
- **Tanpa jejak**: nama asisten pengembang tidak muncul di repo, pesan commit, atau riwayat; ID model AI hidup di konfigurasi database/env, bukan di kode.
- **Git**: commit kecil per tugas dengan pathspec eksplisit (bukan `git add -A`), push setiap commit, tanpa force push.
