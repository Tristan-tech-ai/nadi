-- Tes simpan_ocr. Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; r jsonb; r2 jsonb; ok boolean;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  r := public.lempar_berkas(repeat('ab', 32), 'nota.png', 'image/png', 100);
  r2 := public.lempar_berkas(repeat('cd', 32), 'inv.pdf', 'application/pdf', 100);
  perform pg_temp.cek('pengunggah menyimpan OCR foto', public.simpan_ocr((r ->> 'id')::uuid, 'TOTAL 376.500', 87));
  perform pg_temp.cek('OCR untuk PDF ditolak (bukan foto)', not public.simpan_ocr((r2 ->> 'id')::uuid, 'x', 90));
  begin
    perform public.simpan_ocr((r ->> 'id')::uuid, 'x', 150);
    perform pg_temp.cek('keyakinan di luar 0-100 ditolak', false);
  exception when invalid_parameter_value then perform pg_temp.cek('keyakinan di luar 0-100 ditolak', true); end;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  perform pg_temp.cek('usaha lain tidak bisa menimpa OCR', not public.simpan_ocr((r ->> 'id')::uuid, 'palsu', 99));
  execute 'reset role';
  perform pg_temp.cek('isi OCR tetap milik pengunggah', (select teks_ocr from public.berkas where id = (r ->> 'id')::uuid) = 'TOTAL 376.500');
  update public.berkas set status = 'usulan' where id = (r ->> 'id')::uuid;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  perform pg_temp.cek('berkas yang sudah dibaca tidak bisa diubah OCR-nya', not public.simpan_ocr((r ->> 'id')::uuid, 'ubah', 99));
  execute 'reset role';
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
