-- Tes M-21 akses (supabase/migrations/20261105084000_akses.sql): peran kustom per izin (stok.lihat, stok.ubah) untuk staf, hanya pemilik
-- yang mengatur dan memberi, izin di luar katalog ditolak, isolasi; 2FA ditegakkan di database (faktor terverifikasi + sesi aal1 = tanpa
-- usaha aktif, aal2 = normal, faktor belum terverifikasi tidak mengunci); log aktivitas milik sendiri dan pengelola. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; ka2 text; o_s uuid; u_s uuid;
  pr uuid; rl uuid; rl2 uuid; rb uuid; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ak.a@uji.local'), (ub, 'ak.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Akses', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Akses', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'aal', 'aal1', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    ka2 := json_build_object('sub', ua, 'role', 'authenticated', 'aal', 'aal2', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Gudang') returning id into o_s;
    perform public.buat_akun_staf(o_s, '676767');
    pr := public.simpan_produk('{"kode": "BRS", "nama": "Beras 5 kg", "jenis": "barang", "satuan": "sak", "harga_jual": 80000}');
    perform public.stok_masuk(pr, null, 10, 600000, null, '1-100', 'awal', null, gen_random_uuid());
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Staf tanpa peran kustom.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf biasa tidak melihat stok', (select count(*) from public.stok) = 0);
    begin perform public.simpan_produk('{"kode": "GLA", "nama": "Gula", "jenis": "barang", "satuan": "kg"}'); perform pg_temp.cek('staf biasa tidak mengubah produk', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf biasa tidak mengubah produk', true); end;
    begin perform public.save_custom_role(null, 'Gudang', array['stok.ubah']); perform pg_temp.cek('staf tidak membuat peran kustom', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat peran kustom', true); end;

    -- Pemilik membuat peran dan memberikannya.
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.save_custom_role(null, 'Hapus', array['data.hapus']); perform pg_temp.cek('izin di luar katalog ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('izin di luar katalog ditolak', true); end;
    rl := public.save_custom_role(null, 'Kepala gudang', array['stok.lihat', 'stok.ubah']);
    rl2 := public.save_custom_role(null, 'Pemeriksa stok', array['stok.lihat']);
    begin perform public.save_custom_role(null, 'kepala GUDANG', array['stok.lihat']); perform pg_temp.cek('nama peran unik tanpa beda huruf besar', false);
    exception when unique_violation then perform pg_temp.cek('nama peran unik tanpa beda huruf besar', true); end;
    begin perform public.assign_custom_role(ua, rl); perform pg_temp.cek('peran kustom tidak untuk pemilik', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('peran kustom tidak untuk pemilik', true); end;
    perform public.assign_custom_role(u_s, rl2);

    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('stok.lihat: staf melihat stok dan kartu stok', (select count(*) from public.stok) = 1 and (select count(*) from public.gerak_stok) >= 1);
    begin perform public.simpan_produk('{"kode": "GLA", "nama": "Gula", "jenis": "barang", "satuan": "kg"}'); perform pg_temp.cek('stok.lihat saja tidak mengubah produk', false);
    exception when sqlstate '42501' then perform pg_temp.cek('stok.lihat saja tidak mengubah produk', true); end;

    perform set_config('request.jwt.claims', ka, true);
    perform public.assign_custom_role(u_s, rl);
    perform set_config('request.jwt.claims', ks, true);
    perform public.simpan_produk('{"kode": "GLA", "nama": "Gula", "jenis": "barang", "satuan": "kg"}');
    perform public.stok_masuk(pr, null, 2, 120000, null, '1-100', 'tambah', null, gen_random_uuid());
    perform pg_temp.cek('stok.ubah: staf menambah produk dan stok masuk', (select jumlah from public.stok where produk_id = pr) = 12 and (select count(*) from public.produk where kode = 'GLA') = 1);
    perform pg_temp.cek('staf membaca peran usahanya', (select count(*) from public.custom_role) = 2);

    perform set_config('request.jwt.claims', ka, true);
    perform public.save_custom_role(rl, 'Kepala gudang', array['stok.lihat']);
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.stok_masuk(pr, null, 1, 60000, null, '1-100', 'x', null, gen_random_uuid()); perform pg_temp.cek('izin dicabut dari peran berlaku seketika', false);
    exception when sqlstate '42501' then perform pg_temp.cek('izin dicabut dari peran berlaku seketika', true); end;

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat peran A', (select count(*) from public.custom_role) = 0);
    rb := public.save_custom_role(null, 'Gudang B', array['stok.ubah']);
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.assign_custom_role(u_s, rb); perform pg_temp.cek('peran usaha lain tidak bisa diberikan', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('peran usaha lain tidak bisa diberikan', true); end;

    -- Log aktivitas.
    perform public.log_activity('masuk', '203.0.113.7', 'Uji Peramban');
    perform set_config('request.jwt.claims', ks, true);
    perform public.log_activity('masuk', '198.51.100.2', 'HP staf');
    perform pg_temp.cek('staf hanya melihat log sendiri', (select count(*) from public.activity_log) = 1 and (select ip from public.activity_log) = '198.51.100.2');
    begin perform public.log_activity('hapus', null, null); perform pg_temp.cek('jenis log tak dikenal ditolak', false);
    exception when check_violation then perform pg_temp.cek('jenis log tak dikenal ditolak', true); end;
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik melihat log seluruh usaha', (select count(*) from public.activity_log where perusahaan_id = pa) = 2);
    perform pg_temp.cek('daftar sesi sendiri berupa larik', jsonb_typeof(public.my_sessions()) = 'array');
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat log A', (select count(*) from public.activity_log) = 0);

    -- 2FA: faktor belum terverifikasi tidak mengunci; terverifikasi + aal1 menutup usaha; aal2 membuka.
    execute 'reset role';
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values (gen_random_uuid(), ua, 'uji-belum', 'totp', 'unverified', now(), now());
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('faktor belum terverifikasi: usaha tetap terbuka', (select app.pid()) = pa and (select count(*) from public.stok) = 1);
    execute 'reset role';
    update auth.mfa_factors set status = 'verified' where user_id = ua;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('2FA aktif + sesi aal1: tanpa usaha aktif, stok tertutup', (select app.pid()) is null and (select count(*) from public.stok) = 0
      and (select app.peran_aktif()) is null);
    begin perform public.pos_products(); perform pg_temp.cek('2FA aktif + sesi aal1: RPC usaha ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('2FA aktif + sesi aal1: RPC usaha ditolak', true); end;
    perform set_config('request.jwt.claims', ka2, true);
    perform pg_temp.cek('2FA aktif + sesi aal2: usaha terbuka lagi', (select app.pid()) = pa and (select count(*) from public.stok) = 1 and (select app.peran_aktif()) = 'pemilik');
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('2FA pemilik tidak mengunci staf', (select app.pid()) = pa);
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
