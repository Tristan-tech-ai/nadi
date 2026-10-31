# Penulis dan pembaca pakai_topi.mulai (bahan Q-26)

Diperiksa 1 Nov 2026 (tick 184) dengan kueri pg_proc, pg_trigger, pg_views, pg_policies, pg_constraint, cron.job dan grep di supabase/migrations serta apps/web/src. Tujuannya memastikan perubahan bawaan pakai_topi.mulai ke tanggal zona usaha tidak memutus penulis mana pun.

## Penulis (definisi hidup di database)
| Penulis | Kolom yang diisi | Tanggal mulai | Dampak sekarang |
|---|---|---|---|
| public.putuskan_usulan (cabang orang.topi, F3-04) | perusahaan_id, orang_id, topi_id, porsi | **tidak diisi**, jadi bawaan CURRENT_DATE (UTC) | Topi yang disetujui pemilik usaha WIB antara 00.00 dan 07.00 tercatat mulai kemarin. Data tidak hilang, tetapi tanggalnya salah satu hari. |
| app.pasang_topi_dari_jabatan (impor, orang.buat) | + mulai | coalesce(p_mulai, current_date) | Sama: impor tanpa tanggal mulai di jam itu tercatat kemarin. |
| public.simpan_rencana_magang, insert topi mentor | + mulai | current_date | Topi mentor 10% mulai kemarin. |
| public.simpan_rencana_magang, insert topi peserta | + mulai, selesai | p_mulai dari formulir | Aman: tanggal kalender diketik pengguna. |
| Klien (authenticated punya hak INSERT, dibatasi RLS) | tidak ada di apps/web/src (hanya select di app/app/orang/page.tsx) | | Belum ada; bila nanti ada dan tidak mengisi mulai, ia ikut bawaan. |

Pemicu yang ada di pakai_topi hanya audit_pakai_topi (AFTER, app.catat_audit). Tidak ada view, kebijakan, CHECK, atau cron yang memakai current_date.

## Pembaca yang membandingkan dengan hari ini
app.hitung_lintas_topi (2 tempat) dan app.beban_orang (2 tempat) memakai `current_date`. Kalau penulis diubah ke zona usaha tetapi pembaca tidak (atau sebaliknya), topi baru tidak terhitung di jam 00.00 sampai 07.00 WIB. Penulis dan pembaca wajib diubah dalam satu migrasi.

## Rancangan aman untuk bawaan kolom
1. `alter table public.pakai_topi alter column mulai drop default`. Bawaan kolom diisi sebelum trigger BEFORE berjalan, jadi bila bawaan dibiarkan, trigger tidak pernah melihat null.
2. Trigger BEFORE INSERT `pakai_topi_mulai`: `if new.mulai is null then new.mulai := app.hari_ini(new.perusahaan_id); end if;`. Postgres memeriksa NOT NULL setelah trigger BEFORE ROW, sehingga insert tanpa mulai tetap sah.
3. current_date di tiga penulis diganti `app.hari_ini(v_pid)` / `app.hari_ini(p_pid)`. Cabang putuskan_usulan tidak perlu diubah, karena trigger yang mengisinya.
4. Tes: insert tanpa mulai untuk usaha Asia/Jayapura menghasilkan `app.hari_ini(pid)`; cek struktur: bawaan kolom kosong dan trigger ada.

## Data lama
Baris pakai_topi yang dibuat antara 17.00 dan 24.00 UTC untuk usaha berzona selain UTC mungkin mulai satu hari lebih awal. Satu hari lebih awal tidak membuat topi hilang dari hitungan, hanya memperpanjang satu hari ke belakang. Koreksi tidak wajib. Bila dikerjakan, sumbernya audit_log (waktu insert) dengan cadangan, sama seperti Q-24.
