-- R-UUPK3: pesan dan sumber pasal di fungsi database diperbarui ke UU 27/2026 (angka tidak berubah). Setiap fungsi dibangun ulang dari
-- definisinya sendiri (pg_get_functiondef) dengan kutipan pasal diganti, jadi logika, hak, dan pemiliknya tetap sama:
--   PP 35/2021 Pasal 26 (batas lembur) -> UU 27/2026 Pasal 116; PP 35/2021 Pasal 36 huruf k dan Pasal 52, Penjelasan Pasal 52 ayat (1)
--   (surat peringatan) -> UU 27/2026 Pasal 231 huruf k; PP 35/2021 Pasal 40 ayat (4) (uang penggantian hak) -> UU 27/2026 Pasal 232
--   ayat (4); PP 35/2021 Pasal 50 (mengundurkan diri) -> UU 27/2026 Pasal 242. Rujukan PP 36/2021 (upah sehari, potongan upah,
--   insentif) tetap karena PP itu masih berlaku menurut UU 27/2026 Pasal 310.
do $$
declare f regprocedure; d text;
begin
  foreach f in array array[
    'public.simpan_shift(uuid,date,time without time zone,time without time zone,integer,uuid,uuid)'::regprocedure,
    'app.tolak_batas_pindah(jsonb)'::regprocedure,
    'public.catat_lembur(uuid,date,text,integer,text)'::regprocedure,
    'public.beri_sp(uuid,date,text,text,integer,boolean,uuid)'::regprocedure,
    'public.terbitkan_sp(uuid)'::regprocedure,
    'app.tenggat_kepatuhan(uuid,date,date)'::regprocedure,
    'public.ajukan_hak_berhenti(uuid,jsonb)'::regprocedure]
  loop
    d := pg_get_functiondef(f);
    d := replace(d, 'PP 35/2021 Pasal 36 huruf k dan Pasal 52', 'UU 27/2026 Pasal 231 huruf k');
    d := replace(d, 'Penjelasan PP 35/2021 Pasal 52 ayat (1)', 'UU 27/2026 Pasal 231 huruf k');
    d := replace(d, 'PP 35/2021 Penjelasan Pasal 52 ayat (1)', 'UU 27/2026 Pasal 231 huruf k');
    d := replace(d, 'PP 35/2021 Pasal 26', 'UU 27/2026 Pasal 116');
    d := replace(d, '(PP 35/2021)', '(UU 27/2026 Pasal 116)');
    d := replace(d, 'PP 35/2021 Pasal 40 ayat (4)', 'UU 27/2026 Pasal 232 ayat (4)');
    d := replace(d, 'PP 35/2021 Pasal 50', 'UU 27/2026 Pasal 242');
    if d ~ 'PP 35/2021' then
      raise exception 'Masih ada kutipan PP 35/2021 di %', f;
    end if;
    execute d;
  end loop;
end $$;
