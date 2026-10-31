-- Tes Q-21 (docs/quality/jwt-setelah-cabut.md): JWT yang sudah terbit tidak boleh membaca data usaha setelah anggota dicabut
-- (anggota.aktif = false) atau diturunkan perannya. Bagian 1 memeriksa struktur: tidak ada kebijakan SELECT/ALL di public yang
-- hanya bersandar pada klaim JWT. Bagian 2 memakai data: staf, admin, dan pemilik kedua yang dicabut melihat 0 baris; yang aktif
-- tetap melihat. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Bagian 1: struktur.
select pg_temp.cek('tidak ada kebijakan baca yang hanya memakai klaim pid/prn/pengelola',
  count(*) = 0, string_agg(tablename || '.' || policyname, ', '))
  from pg_policies
 where schemaname in ('public', 'storage') and cmd in ('SELECT', 'ALL')
   and coalesce(qual, '') ~ '(app\.pid\(\)|app\.prn\(\)|app\.pengelola\(\))'
   and coalesce(qual, '') !~ '(anggota_aktif|orang_saya|peran_aktif)';

-- Bagian 2: data.
do $$
declare
  ua uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); up uuid := gen_random_uuid();
  pa uuid; o uuid; ka text; ks text; kd text; kp text; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (us, 's@uji.local'), (ud, 'd@uji.local'), (up, 'p@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Q21', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Q21') returning id into o;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_q21', 'Kasir Q21');
    perform public.atur_kebijakan_izin('sakit', true, 1, true, null, null);
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, us, 'staf', o), (pa, ud, 'admin', null), (pa, up, 'pemilik', null);
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran)
      values (pa, 'sistem', 'uji.q21', 'Usulan uji Q21', '{}'::jsonb, array['pemilik', 'admin']);
    insert into public.audit_log (perusahaan_id, tabel, aksi) values (pa, 'uji_q21', 'INSERT');
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kp := json_build_object('sub', up, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;

    -- Kendali: yang aktif tetap melihat.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    select count(*) into n from public.topi;
    perform pg_temp.cek('staf aktif melihat topi', n = 1, n::text);
    select count(*) into n from public.kebijakan_izin;
    perform pg_temp.cek('staf aktif melihat aturan izin', n >= 1, n::text);
    perform set_config('request.jwt.claims', kd, true);
    select count(*) into n from public.usulan where aksi = 'uji.q21';
    perform pg_temp.cek('admin aktif melihat usulan untuk admin', n = 1, n::text);
    perform set_config('request.jwt.claims', kp, true);
    select count(*) into n from public.audit_log where tabel = 'uji_q21';
    perform pg_temp.cek('pemilik kedua aktif melihat audit', n = 1, n::text);

    -- Admin diturunkan jadi staf: JWT lama masih membawa prn admin.
    execute 'reset role';
    update public.anggota set peran = 'staf' where perusahaan_id = pa and user_id = ud;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kd, true);
    select count(*) into n from public.usulan where aksi = 'uji.q21';
    perform pg_temp.cek('admin yang diturunkan tidak lagi melihat usulan admin (JWT lama)', n = 0, n::text);
    select count(*) into n from public.keputusan;
    perform pg_temp.cek('admin yang diturunkan tidak melihat keputusan (JWT lama)', n = 0, n::text);

    -- Cabut semua.
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id in (us, ud, up);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    select count(*) into n from public.topi;
    perform pg_temp.cek('staf dicabut: topi 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.kebijakan_izin;
    perform pg_temp.cek('staf dicabut: aturan izin 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.pakai_topi;
    perform pg_temp.cek('staf dicabut: pakai_topi 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.anggota where user_id <> us;
    perform pg_temp.cek('staf dicabut: tidak melihat anggota lain (JWT lama)', n = 0, n::text);
    select count(*) into n from public.anggota where user_id = us;
    perform pg_temp.cek('staf dicabut: baris anggotanya sendiri tetap terlihat (daftar usaha)', n = 1, n::text);
    perform set_config('request.jwt.claims', kd, true);
    select count(*) into n from public.usulan where aksi = 'uji.q21';
    perform pg_temp.cek('admin dicabut: usulan 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.berkas;
    perform pg_temp.cek('admin dicabut: berkas 0 (JWT lama)', n = 0, n::text);
    perform set_config('request.jwt.claims', kp, true);
    select count(*) into n from public.audit_log where tabel = 'uji_q21';
    perform pg_temp.cek('pemilik kedua dicabut: audit 0 (JWT lama)', n = 0, n::text);

    -- Pemilik utama tetap melihat semuanya.
    perform set_config('request.jwt.claims', ka, true);
    select count(*) into n from public.usulan where aksi = 'uji.q21';
    perform pg_temp.cek('pemilik utama tetap melihat usulan', n = 1, n::text);
    select count(*) into n from public.topi;
    perform pg_temp.cek('pemilik utama tetap melihat topi', n = 1, n::text);
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
