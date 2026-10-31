-- Tes Q-12 (docs/quality/keamanan-f0.md S3, S4b, S5, S8): tulis lewat RLS butuh keanggotaan aktif sungguhan (bukan klaim JWT lama),
-- admin tidak bisa melewati aturan khusus pemilik (rute uang besar, untuk_peran, slip yang sudah dilepas), penanda demo tidak bisa
-- ditulis pengguna, staf hanya membaca orang dan kejadian miliknya. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); ue uuid := gen_random_uuid(); uk uuid := gen_random_uuid(); us uuid;
  pa uuid; ka text; kd text; kdp text; ke text; kk text; ks text;
  o1 uuid; o2 uuid; hantu uuid; u1 uuid; kp uuid; per uuid; sl uuid; n int; j int; tot int; r jsonb;
  kom jsonb := '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":5000000}]';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ud, 'd@uji.local'), (ue, 'e@uji.local'), (uk, 'k@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pa, ud, 'admin', false), (pa, ue, 'admin', true), (pa, uk, 'akuntan', true);
  execute 'set local role authenticated';
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  kdp := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  ke := json_build_object('sub', ue, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;

  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o2;
  insert into public.orang (perusahaan_id, nama, data) values (pa, 'Hantu', '{"mulai":"2024-01-01"}') returning id into hantu;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (hantu, pa, '{"pokok":5000000}');
  perform public.buat_akun_staf(o1, '123456');
  execute 'reset role';
  select user_id into us from public.orang where id = o1;
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id) values (pa, now(), 'absen.masuk', 'pwa', o1), (pa, now(), 'absen.masuk', 'pwa', o2);
  execute 'set local role authenticated';
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  -- S3: admin yang sudah dinonaktifkan (JWT lama masih berklaim admin/pemilik) tidak bisa menulis lewat RLS.
  perform set_config('request.jwt.claims', kd, true);
  begin
    insert into public.orang (perusahaan_id, nama) values (pa, 'Titipan');
    perform pg_temp.cek('S3 admin dicabut tidak bisa menambah orang', false);
  exception when others then perform pg_temp.cek('S3 admin dicabut tidak bisa menambah orang', sqlerrm like '%row-level security%', sqlerrm);
  end;
  update public.orang set nama = 'Diubah' where id = o2;
  get diagnostics n = row_count;
  perform pg_temp.cek('S3 admin dicabut tidak bisa mengubah orang', n = 0, n::text);
  begin
    insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o2, pa, '{"pokok":1}');
    perform pg_temp.cek('S3 admin dicabut tidak bisa menulis data rahasia', false);
  exception when others then perform pg_temp.cek('S3 admin dicabut tidak bisa menulis data rahasia', sqlerrm like '%row-level security%', sqlerrm);
  end;
  select count(*) into n from public.orang_rahasia;
  perform pg_temp.cek('S3 admin dicabut tidak bisa membaca data rahasia', n = 0, n::text);
  begin
    insert into public.lowongan (perusahaan_id, judul) values (pa, 'Lowongan titipan');
    perform pg_temp.cek('S3 admin dicabut tidak bisa membuat lowongan', false);
  exception when others then perform pg_temp.cek('S3 admin dicabut tidak bisa membuat lowongan', sqlerrm like '%row-level security%', sqlerrm);
  end;
  perform set_config('request.jwt.claims', kdp, true);
  update public.perusahaan set nama = 'Dibajak' where id = pa;
  get diagnostics n = row_count;
  perform pg_temp.cek('S3 klaim pemilik lama tidak bisa mengubah usaha', n = 0, n::text);

  -- S4b: admin aktif tidak bisa melewati aturan khusus pemilik.
  perform set_config('request.jwt.claims', ke, true);
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, dampak_rp, untuk_peran)
  values (pa, 'aturan', 'uang.keluar', 'Bayar besar', '{}', 10000000, array['admin']);
  -- Tanpa RETURNING: setelah dirutekan ke pemilik, admin memang tidak boleh membaca usulan ini.
  execute 'reset role';
  select id into u1 from public.usulan where perusahaan_id = pa and judul = 'Bayar besar';
  perform pg_temp.cek('S4b usulan uang besar tetap hanya untuk pemilik walau admin menulis untuk_peran sendiri',
    (select untuk_peran = array['pemilik'] from public.usulan where id = u1), (select untuk_peran::text from public.usulan where id = u1));
  select id into kp from public.keputusan where subjek_id = u1 and jenis = 'usulan.rute';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ke, true);
  begin
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = u1;
    get diagnostics n = row_count;
    perform pg_temp.cek('S4b admin tidak bisa mengubah untuk_peran langsung', n = 0, n::text);
  exception when insufficient_privilege then perform pg_temp.cek('S4b admin tidak bisa mengubah untuk_peran langsung', true);
  end;
  begin
    perform public.batalkan_keputusan(kp, 'admin ingin memutuskan');
    perform pg_temp.cek('S4b admin tidak bisa membatalkan rute uang besar', false);
  exception when others then perform pg_temp.cek('S4b admin tidak bisa membatalkan rute uang besar', sqlstate = '42501', sqlerrm);
  end;
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.batalkan_keputusan(kp, 'admin boleh memutuskan yang ini');
  exception when others then perform pg_temp.cek('S4b keputusan rute tercatat untuk usulan admin', false, sqlerrm);
  end;
  execute 'reset role';
  perform pg_temp.cek('S4b pemilik tetap bisa membatalkan rute', (select untuk_peran = array['pemilik', 'admin'] from public.usulan where id = u1));
  execute 'set local role authenticated';

  -- S4b: slip yang sudah dilepas pemilik ditahan lagi bila komponennya diubah.
  perform set_config('request.jwt.claims', ka, true);
  per := public.mulai_periode_gaji(date '2026-11-01');
  r := public.simpan_slip(per, hantu, kom, '{}');
  sl := (r ->> 'id')::uuid;
  perform pg_temp.cek('S4b slip orang tanpa tanda hidup ditahan', (r ->> 'ditahan')::boolean, r::text);
  begin
    perform public.lepas_tahan_slip(sl, 'sudah dicek langsung');
  exception when others then perform pg_temp.cek('S4b pemilik bisa melepas tahanan', false, sqlerrm);
  end;
  perform set_config('request.jwt.claims', ke, true);
  r := public.simpan_slip(per, hantu, kom, '{}');
  perform pg_temp.cek('S4b hitung ulang dengan komponen sama tetap dilepas', not (r ->> 'ditahan')::boolean, r::text);
  r := public.simpan_slip(per, hantu, '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":9000000}]', '{}');
  perform pg_temp.cek('S4b komponen diubah setelah dilepas: ditahan lagi', (r ->> 'ditahan')::boolean, r::text);

  -- S5: penanda demo tidak bisa ditulis pengguna.
  perform set_config('request.jwt.claims', ka, true);
  begin
    update public.perusahaan set pengaturan = pengaturan || '{"demo":"fnb"}' where id = pa;
    perform pg_temp.cek('S5 pemilik tidak bisa menandai usahanya sebagai demo', false);
  exception when others then perform pg_temp.cek('S5 pemilik tidak bisa menandai usahanya sebagai demo', sqlstate = '42501', sqlerrm);
  end;
  update public.perusahaan set pengaturan = pengaturan || '{"ambang_rute_pemilik":7000000}' where id = pa;
  get diagnostics n = row_count;
  perform pg_temp.cek('S5 pengaturan lain tetap bisa diubah pemilik', n = 1, n::text);

  -- S8: staf hanya membaca orang dan kejadian miliknya; akuntan dan admin membaca semua.
  execute 'reset role';
  select count(*) into tot from public.orang where perusahaan_id = pa;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  select count(*), count(*) filter (where id = o1) into n, j from public.orang;
  perform pg_temp.cek('S8 staf hanya melihat dirinya di orang', n = 1 and j = 1, n || '/' || j);
  select count(*), count(*) filter (where orang_id = o1) into n, j from public.kejadian;
  perform pg_temp.cek('S8 staf hanya melihat kejadiannya sendiri', n = j and n >= 1, n || '/' || j);
  perform set_config('request.jwt.claims', kk, true);
  select count(*) into n from public.orang;
  perform pg_temp.cek('S8 akuntan melihat semua orang', n = tot and tot >= 3, n || '/' || tot);
  perform set_config('request.jwt.claims', ke, true);
  select count(*) into n from public.kejadian;
  perform pg_temp.cek('S8 admin melihat semua kejadian', n >= 2, n::text);
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
