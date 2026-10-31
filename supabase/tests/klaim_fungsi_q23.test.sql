-- Tes Q-23 (docs/quality/klaim-di-fungsi.md, docs/quality/klaim-kebijakan-sisa.md): peran di dalam fungsi dan kebijakan diambil
-- dari tabel anggota yang aktif (app.peran_aktif), bukan dari klaim prn di JWT yang bisa basi sampai token kedaluwarsa.
-- Bagian 1 memeriksa struktur: tidak ada fungsi public/app (selain app.prn dan app.pengelola sendiri) dan tidak ada kebijakan
-- public/storage yang memanggil app.prn() atau app.pengelola(). Bagian 2 memakai data sintetis: pemilik yang diturunkan menjadi
-- admin ditandai pemisahan tugas di gerbang_gaji, admin yang diturunkan tidak menerima id/jalur berkas orang lain dari
-- lempar_berkas, dan admin yang diturunkan atau dicabut tidak membaca slip, lembur, dan izin orang lain. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Bagian 1: struktur.
select pg_temp.cek('tidak ada fungsi public/app yang memanggil app.prn() atau app.pengelola()',
  count(*) = 0, count(*) || ': ' || coalesce(string_agg(p.oid::regprocedure::text, ', '), ''))
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
 where s.nspname in ('public', 'app') and p.prokind = 'f'
   and p.oid not in ('app.prn()'::regprocedure, 'app.pengelola()'::regprocedure)
   and pg_get_functiondef(p.oid) ~ '(app\.prn\(\)|app\.pengelola\(\))';

select pg_temp.cek('tidak ada kebijakan public/storage yang memakai app.prn() atau app.pengelola()',
  count(*) = 0, count(*) || ': ' || coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), ''))
  from pg_policies
 where schemaname in ('public', 'storage')
   and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(app\.prn\(\)|app\.pengelola\(\))';

-- Bagian 2: data.
do $$
declare
  ua uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  up uuid := gen_random_uuid();
  pa uuid; os uuid; ol uuid; og uuid; per uuid; ka text; ks text; kd text; kc text; kp text; n int; x text; r jsonb;
  h date := (now() at time zone 'Asia/Jakarta')::date;
  sha constant text := repeat('c', 64);
begin
  begin
    insert into auth.users (id, email) values
      (ua, 'a@uji.local'), (us, 's@uji.local'), (ud, 'd@uji.local'), (uc, 'c@uji.local'), (up, 'p@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Q23', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, data) values (pa, 'Staf Q23', '{"mulai":"2024-01-01"}') returning id into os;
    insert into public.orang (perusahaan_id, nama, data) values (pa, 'Lain Q23', '{"mulai":"2024-01-01"}') returning id into ol;
    r := public.lempar_berkas(sha, 'nota-pemilik.jpg', 'image/jpeg', 1000);
    perform pg_temp.cek('pemilik mengunggah berkas baru', not (r ->> 'ada')::boolean and r ? 'id', r::text);
    execute 'reset role';

    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values
      (pa, us, 'staf', os), (pa, ud, 'admin', null), (pa, uc, 'admin', null), (pa, up, 'pemilik', null);
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, date '2026-09-01', 'disetujui') returning id into per;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id) values (pa, per, os), (pa, per, ol);
    insert into public.lembur (perusahaan_id, orang_id, tanggal, jenis, jam) values
      (pa, os, h - 3, 'hari_kerja', 2), (pa, ol, h - 3, 'hari_kerja', 2);
    insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, alasan_putusan, diajukan_oleh) values
      (pa, os, 'sakit', h - 2, h - 2, 1, '', us), (pa, ol, 'sakit', h - 2, h - 2, 1, '', ua);

    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kc := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kp := json_build_object('sub', up, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;

    -- Kendali: yang aktif membaca sesuai perannya.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kd, true);
    select count(*) into n from public.slip_gaji;
    perform pg_temp.cek('admin aktif membaca semua slip', n = 2, n::text);
    select count(*) into n from public.lembur;
    perform pg_temp.cek('admin aktif membaca semua lembur', n = 2, n::text);
    select count(*) into n from public.pengajuan_izin;
    perform pg_temp.cek('admin aktif membaca semua pengajuan izin', n = 2, n::text);
    r := public.lempar_berkas(sha, 'nota-sama.jpg', 'image/jpeg', 1000);
    perform pg_temp.cek('admin aktif menerima id berkas yang sudah ada', (r ->> 'ada')::boolean and r ? 'id' and r ? 'jalur', r::text);
    perform set_config('request.jwt.claims', ks, true);
    select count(*) into n from public.slip_gaji where orang_id = os;
    perform pg_temp.cek('staf aktif membaca slipnya sendiri', n = 1, n::text);
    select count(*) into n from public.slip_gaji where orang_id <> os;
    perform pg_temp.cek('staf aktif tidak membaca slip orang lain', n = 0, n::text);

    -- Pemilik kedua mengubah data orang yang digaji, lalu diturunkan menjadi admin (JWT lama masih prn=pemilik).
    perform set_config('request.jwt.claims', kp, true);
    insert into public.orang (perusahaan_id, nama, data) values (pa, 'Titipan Q23', '{"mulai":"2024-06-01"}') returning id into og;
    insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (og, pa, '{"pokok": 4500000}');
    select count(*) into n from public.gerbang_gaji() where orang_id = og and kode = 'pemisahan_tugas';
    perform pg_temp.cek('pemilik aktif tidak ditandai pemisahan tugas', n = 0, n::text);
    execute 'reset role';
    update public.anggota set peran = 'admin' where perusahaan_id = pa and user_id = up;
    update public.anggota set peran = 'staf' where perusahaan_id = pa and user_id = ud;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kp, true);
    select count(*) into n from public.gerbang_gaji() where orang_id = og and kode = 'pemisahan_tugas';
    perform pg_temp.cek('pemilik yang diturunkan jadi admin ditandai pemisahan tugas (JWT lama)', n = 1, n::text);

    -- Admin diturunkan menjadi staf (JWT lama prn=admin).
    perform set_config('request.jwt.claims', kd, true);
    r := public.lempar_berkas(sha, 'nota-sama.jpg', 'image/jpeg', 1000);
    perform pg_temp.cek('admin yang diturunkan hanya tahu berkas sudah ada, tanpa id/jalur (JWT lama)',
      (r ->> 'ada')::boolean and not r ? 'id' and not r ? 'jalur' and not r ? 'status', r::text);
    select count(*) into n from public.slip_gaji;
    perform pg_temp.cek('admin yang diturunkan: slip orang lain 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.lembur;
    perform pg_temp.cek('admin yang diturunkan: lembur orang lain 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.pengajuan_izin;
    perform pg_temp.cek('admin yang diturunkan: pengajuan izin orang lain 0 (JWT lama)', n = 0, n::text);

    -- Admin dicabut (anggota.aktif = false, JWT lama prn=admin).
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id = uc;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kc, true);
    select count(*) into n from public.slip_gaji;
    perform pg_temp.cek('admin dicabut: slip 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.lembur;
    perform pg_temp.cek('admin dicabut: lembur 0 (JWT lama)', n = 0, n::text);
    select count(*) into n from public.pengajuan_izin;
    perform pg_temp.cek('admin dicabut: pengajuan izin 0 (JWT lama)', n = 0, n::text);
    begin
      perform public.lempar_berkas(sha, 'nota-sama.jpg', 'image/jpeg', 1000);
      perform pg_temp.cek('admin dicabut ditolak lempar_berkas', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin dicabut ditolak lempar_berkas', true);
    end;

    -- Staf aktif tetap membaca miliknya sendiri, dan hanya itu.
    perform set_config('request.jwt.claims', ks, true);
    select count(*), string_agg(distinct orang_id::text, ',') into n, x from public.slip_gaji;
    perform pg_temp.cek('staf aktif tetap membaca slipnya sendiri saja', n = 1 and x = os::text, n || ' ' || coalesce(x, ''));
    select count(*), string_agg(distinct orang_id::text, ',') into n, x from public.lembur;
    perform pg_temp.cek('staf aktif tetap membaca lemburnya sendiri saja', n = 1 and x = os::text, n || ' ' || coalesce(x, ''));
    select count(*), string_agg(distinct orang_id::text, ',') into n, x from public.pengajuan_izin;
    perform pg_temp.cek('staf aktif tetap membaca izinnya sendiri saja', n = 1 and x = os::text, n || ' ' || coalesce(x, ''));

    -- Pemilik utama tetap melihat semua.
    perform set_config('request.jwt.claims', ka, true);
    select count(*) into n from public.slip_gaji;
    perform pg_temp.cek('pemilik utama tetap membaca semua slip', n = 2, n::text);
    select count(*) into n from public.lembur;
    perform pg_temp.cek('pemilik utama tetap membaca semua lembur', n = 2, n::text);
    select count(*) into n from public.pengajuan_izin;
    perform pg_temp.cek('pemilik utama tetap membaca semua pengajuan izin', n = 2, n::text);
    select count(*) into n from public.gerbang_gaji() where kode = 'pemisahan_tugas';
    perform pg_temp.cek('pemilik utama tidak ditandai pemisahan tugas', n = 0, n::text);
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
