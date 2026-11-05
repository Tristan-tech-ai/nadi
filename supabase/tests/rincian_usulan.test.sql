-- Tes U-13 rincian usulan (supabase/migrations/20261105100000_rincian_usulan.sql): nilai sebelum dari data sekarang, nama yang
-- sudah ada dilewati, usaha lain tidak bisa membaca, staf ditolak, NIK tidak pernah muncul utuh. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid; r jsonb; u_izin uuid; u_orang uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ri.a@uji.local'), (ub, 'ri.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Rincian', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Rincian', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Lama') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '530301');
    perform public.atur_kebijakan_izin('cuti', false, 0, false, null, 12);
    perform public.usul_onboarding(jsonb_build_array(
      jsonb_build_object('aksi', 'onboarding.izin', 'judul', 'Aturan cuti otomatis 2 hari', 'bidang', jsonb_build_object('jenis', 'cuti', 'otomatis', true, 'maks_hari', 2, 'butuh_bukti', false, 'jatah_tahunan', 12)),
      jsonb_build_object('aksi', 'orang.impor', 'judul', 'Tambah Budi Lama', 'bidang', jsonb_build_object('baris', jsonb_build_array(jsonb_build_object('nama', 'budi lama', 'jabatan', 'kasir')))),
      jsonb_build_object('aksi', 'orang.impor', 'judul', 'Tambah Sari Baru', 'bidang', jsonb_build_object('baris', jsonb_build_array(jsonb_build_object('nama', 'Sari Baru', 'jabatan', 'kasir'))))), gen_random_uuid());
    execute 'reset role';
    select id into u_izin from public.usulan where perusahaan_id = pa and aksi = 'onboarding.izin';
    select id into u_orang from public.usulan where perusahaan_id = pa and judul = 'Tambah Budi Lama';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.preview_proposal(u_izin);
    perform pg_temp.cek('sebelum = aturan cuti sekarang', r #>> '{sebelum,otomatis}' = 'false' and r #>> '{sebelum,jatah_tahunan}' = '12', r::text);
    perform pg_temp.cek('sesudah = isi usulan', r #>> '{bidang,otomatis}' = 'true' and r #>> '{bidang,maks_hari}' = '2', r::text);
    r := public.preview_proposal(u_orang);
    perform pg_temp.cek('nama yang sudah ada dilewati (tanpa beda huruf besar)', r -> 'lewati' = '["budi lama"]'::jsonb, r::text);
    r := public.preview_proposal((select id from public.usulan where perusahaan_id = pa and judul = 'Tambah Sari Baru'));
    perform pg_temp.cek('nama baru tidak dilewati', r -> 'lewati' = '[]'::jsonb, r::text);

    perform set_config('request.jwt.claims', kb, true);
    begin
      perform public.preview_proposal(u_izin);
      perform pg_temp.cek('usaha lain tidak bisa membaca rincian', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa membaca rincian', true); end;
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.preview_proposal(u_izin);
      perform pg_temp.cek('staf ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf ditolak', true); end;
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
