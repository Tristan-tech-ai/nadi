-- Tes F6-04 mitra: direktori terbaca pengguna masuk (bukan anon), data contoh tidak terverifikasi, tanpa kolom uang; permintaan
-- hanya pemilik/admin, layanan harus milik mitra, validasi pesan, idempoten, batas 10 sehari, batal, isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  m uuid; r jsonb; r2 jsonb; k uuid := gen_random_uuid(); n int; i int;
begin
  perform pg_temp.cek('tanpa kolom uang di tabel mitra dan permintaan', not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('mitra', 'permintaan_mitra') and column_name ~ '(tarif|harga|biaya|bayar|nominal|rupiah)'));
  perform pg_temp.cek('anon tidak membaca direktori', not has_table_privilege('anon', 'public.mitra', 'select'));
  perform pg_temp.cek('data contoh tidak terverifikasi', (select count(*) from public.mitra where contoh) >= 4
    and not exists (select 1 from public.mitra where contoh and terverifikasi));
  select id into m from public.mitra where contoh and jenis = 'psikolog' order by nama limit 1;

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Mitra A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Mitra B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Mitra') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('pengguna masuk membaca direktori', (select count(*) from public.mitra) >= 4);
  begin perform public.kirim_permintaan_mitra(m, 'Audit laporan keuangan', 'Butuh asesmen calon kasir minggu depan.', gen_random_uuid());
    perform pg_temp.cek('layanan bukan milik mitra ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('layanan bukan milik mitra ditolak', true); end;
  begin perform public.kirim_permintaan_mitra(m, 'Asesmen calon karyawan', 'pendek', gen_random_uuid());
    perform pg_temp.cek('pesan terlalu pendek ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('pesan terlalu pendek ditolak', true); end;
  r := public.kirim_permintaan_mitra(m, 'Asesmen calon karyawan', 'Butuh asesmen dua calon kasir minggu depan.', k);
  perform pg_temp.cek('permintaan tersimpan dan ditandai contoh', not (r ->> 'sudah')::boolean and (r ->> 'contoh')::boolean, r::text);
  r2 := public.kirim_permintaan_mitra(m, 'Asesmen calon karyawan', 'Butuh asesmen dua calon kasir minggu depan.', k);
  perform pg_temp.cek('idempoten per kunci', (r2 ->> 'sudah')::boolean and r2 ->> 'id' = r ->> 'id');
  perform pg_temp.cek('pemilik membaca permintaannya', (select count(*) from public.permintaan_mitra) = 1);
  for i in 1..9 loop perform public.kirim_permintaan_mitra(m, 'Konseling karyawan', 'Konseling untuk tim dapur yang kelelahan.', gen_random_uuid()); end loop;
  begin perform public.kirim_permintaan_mitra(m, 'Konseling karyawan', 'Konseling untuk tim dapur yang kelelahan.', gen_random_uuid());
    perform pg_temp.cek('batas 10 sehari', false);
  exception when sqlstate '54000' then perform pg_temp.cek('batas 10 sehari', true); end;
  perform public.batal_permintaan_mitra((r ->> 'id')::uuid);
  perform pg_temp.cek('batal', (select status from public.permintaan_mitra where id = (r ->> 'id')::uuid) = 'dibatalkan');
  begin perform public.batal_permintaan_mitra((r ->> 'id')::uuid); perform pg_temp.cek('batal dua kali ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('batal dua kali ditolak', true); end;

  perform set_config('request.jwt.claims', ks, true);
  begin perform public.kirim_permintaan_mitra(m, 'Konseling karyawan', 'Konseling untuk tim dapur yang kelelahan.', gen_random_uuid());
    perform pg_temp.cek('staf tidak mengirim', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengirim', true); end;
  perform pg_temp.cek('staf tidak membaca permintaan', not exists (select 1 from public.permintaan_mitra));
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak membaca permintaan', not exists (select 1 from public.permintaan_mitra));
  begin perform public.batal_permintaan_mitra((r ->> 'id')::uuid); perform pg_temp.cek('usaha lain tidak membatalkan', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak membatalkan', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'mitra: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
