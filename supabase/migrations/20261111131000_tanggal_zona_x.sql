-- X-21 (temuan tes Q-24 dan Q-26 di Supabase lokal, 11 Nov 2026), fungsi yang dibuat setelah Q-24/Q-26:
-- (1) apply_ai_draft mengubah tanggal mulai jabatan lewat app.tanggal_aman(...)::date. tanggal_aman memasang jam 00:00 WITA
--     (+08), lalu ::date dibaca di zona sesi (UTC), sehingga tanggal mundur satu hari (2026-01-05 menjadi 2026-01-04).
--     Diganti app.tanggal_teks yang membaca YYYY-MM-DD apa adanya.
-- (2) preview_proposal dan app.ukuran_usaha memakai current_date (tanggal UTC server); diganti app.hari_ini(usaha), sama
--     dengan fungsi lain sejak Q-26 (docs/quality/zona-fungsi.md).
-- Badan fungsi diambil dari definisi yang terpasang dan hanya potongan yang disebut yang diganti; blok gagal bila potongannya
-- tidak ditemukan tepat satu kali, sehingga migrasi tidak pernah diam-diam tidak mengubah apa-apa. Hak dan pemilik tetap
-- (create or replace).
-- (3) Fungsi yang sengaja memakai tanggal UTC atau menyebut WITA diberi komentar alasannya (syarat daftar putih tes):
--     prefilter cron lintas usaha (ambil kandidat dengan kelonggaran satu hari, lalu menghitung per usaha dengan
--     app.hari_ini), pengisi data demo, dan daftar zona Indonesia yang sah.
do $$
declare
  r record; v_def text; v_baru text;
begin
  for r in select * from (values
      ('public.apply_ai_draft(uuid)', 'app.tanggal_aman(v ->> ''mulai'')::date', 'app.tanggal_teks(v ->> ''mulai'')'),
      ('public.preview_proposal(uuid)', 'pt.selesai >= current_date', 'pt.selesai >= app.hari_ini(v_pid)'),
      ('app.ukuran_usaha(uuid)', 'i.lunas_tanggal >= current_date - 90', 'i.lunas_tanggal >= app.hari_ini(p_pid) - 90')
    ) t(fungsi, lama, baru)
  loop
    v_def := pg_get_functiondef(r.fungsi::regprocedure);
    if (length(v_def) - length(replace(v_def, r.lama, ''))) / length(r.lama) <> 1 then
      raise exception 'tanggal_zona_x: potongan "%" tidak ditemukan tepat satu kali di %', r.lama, r.fungsi;
    end if;
    v_baru := replace(v_def, r.lama, r.baru);
    execute v_baru;
  end loop;
end $$;

comment on function public.analis_bahan() is
  'Bahan analis malam lintas usaha. Sengaja memakai current_date - 1 (UTC) sebagai prefilter longgar: zona Indonesia UTC+7 sampai +9, jadi hari ini setiap usaha selalu tercakup (Q-26).';
comment on function app.run_recurring_all() is
  'Cron jurnal berulang lintas usaha. Sengaja memakai current_date + 1 (UTC) hanya sebagai prefilter longgar; tanggal jatuh tempo dihitung per usaha dengan app.hari_ini (Q-26).';
comment on function app.issue_recurring_invoices_all() is
  'Cron tagihan berulang lintas usaha. Sengaja memakai current_date + 1 (UTC) hanya sebagai prefilter longgar; terbit dihitung per usaha dengan app.hari_ini (Q-26).';
comment on function app.isi_belanja_demo() is
  'Pengisi data usaha contoh. Tanggal UTC di sini sengaja: waktu data sintetis hanya ilustrasi dan digeser segarkan_demo (Q-26).';
comment on function app.isi_alur_demo() is
  'Pengisi data usaha contoh. Tanggal UTC di sini sengaja: waktu data sintetis hanya ilustrasi dan digeser segarkan_demo (Q-26).';
comment on function app.zona_sah(text, text) is
  'Validasi zona waktu usaha. Asia/Makassar disebut sengaja sebagai salah satu dari empat zona Indonesia yang sah (Q-24), bukan zona bawaan.';
