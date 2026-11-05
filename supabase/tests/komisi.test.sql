-- Tes W-07C komisi (supabase/migrations/20261105087000_komisi.sql): aturan bawaan persen + aturan produk rupiah per satuan (aturan
-- produk menang), dihitung dari penjualan kasir milik pembuka shift dan invoice lunas milik penerbit menurut tanggal bayar, invoice belum
-- lunas tidak dihitung, rentang tanggal, aturan dimatikan, hanya pengelola, isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid; o_p uuid;
  cukur uuid; pomade uuid; sh uuid; inv jsonb; inv2 jsonb; r jsonb; v_hari date;
begin
  begin
    insert into auth.users (id, email) values (ua, 'km.a@uji.local'), (ub, 'km.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Barbershop Uji Komisi', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Komisi', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Kapster Dodi') returning id into o_s;
    perform public.buat_akun_staf(o_s, '343434');
    cukur := public.simpan_produk('{"kode": "CKR", "nama": "Potong rambut", "jenis": "jasa", "satuan": "kali", "harga_jual": 35000}');
    pomade := public.simpan_produk('{"kode": "PMD", "nama": "Pomade 80 g", "jenis": "barang", "satuan": "pot", "harga_jual": 50000}');
    perform public.stok_masuk(pomade, null, 10, 300000, null, '1-100', 'awal', null, gen_random_uuid());
    perform public.save_commission_rule(null, 10, 0);
    perform public.save_commission_rule(pomade, 0, 5000);
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Pemilik Barber') returning id into o_p;
    update public.anggota set orang_id = o_p where perusahaan_id = pa and user_id = ua;

    -- Kapster menjual 2 potong + 1 pomade di kasir: 10% x 70.000 + 5.000 = 12.000.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    sh := public.pos_open_shift(0);
    perform public.pos_record_sale(sh, gen_random_uuid(), now(), jsonb_build_array(jsonb_build_object('produk', cukur, 'jumlah', 2), jsonb_build_object('produk', pomade, 'jumlah', 1)), 'tunai', 120000);
    begin perform public.commission_summary(v_hari, v_hari); perform pg_temp.cek('staf tidak melihat rekap komisi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak melihat rekap komisi', true); end;
    begin perform public.save_commission_rule(null, 50, 0); perform pg_temp.cek('staf tidak mengubah aturan komisi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengubah aturan komisi', true); end;

    -- Pemilik menerbitkan dua invoice jasa (100.000 dan 40.000); hanya yang lunas dihitung.
    perform set_config('request.jwt.claims', ka, true);
    inv := public.buat_invoice('Pelanggan Paket', null, '[{"uraian": "Paket cukur keluarga", "jumlah": 1, "harga": 100000}]', v_hari + 7, null, gen_random_uuid());
    inv2 := public.buat_invoice('Pelanggan Belum', null, '[{"uraian": "Cukur rumah", "jumlah": 1, "harga": 40000}]', v_hari + 7, null, gen_random_uuid());
    perform public.tandai_lunas((inv ->> 'id')::uuid, 'tunai');
    r := public.commission_summary(v_hari, v_hari);
    perform pg_temp.cek('kapster: komisi 12.000 dari penjualan 120.000', (select (x ->> 'komisi')::bigint from jsonb_array_elements(r) x where (x ->> 'orang')::uuid = o_s) = 12000
      and (select (x ->> 'penjualan')::bigint from jsonb_array_elements(r) x where (x ->> 'orang')::uuid = o_s) = 120000, r::text);
    perform pg_temp.cek('pemilik: komisi 10.000 dari invoice lunas saja', (select (x ->> 'komisi')::bigint from jsonb_array_elements(r) x where (x ->> 'orang')::uuid = o_p) = 10000, r::text);
    perform pg_temp.cek('rentang tanggal lain: kosong', jsonb_array_length(public.commission_summary(v_hari - 30, v_hari - 1)) = 0);

    -- Aturan bawaan dimatikan: tinggal komisi pomade.
    perform public.save_commission_rule(null, 0, 0);
    r := public.commission_summary(v_hari, v_hari);
    perform pg_temp.cek('aturan bawaan mati: kapster tinggal 5.000, pemilik tidak muncul', (select (x ->> 'komisi')::bigint from jsonb_array_elements(r) x where (x ->> 'orang')::uuid = o_s) = 5000
      and jsonb_array_length(r) = 1, r::text);
    begin perform public.save_commission_rule(null, 150, 0); perform pg_temp.cek('komisi > 100% ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('komisi > 100% ditolak', true); end;

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain: rekap kosong, aturan tidak terlihat', jsonb_array_length(public.commission_summary(v_hari, v_hari)) = 0 and (select count(*) from public.commission_rule) = 0);
    begin perform public.save_commission_rule(pomade, 10, 0); perform pg_temp.cek('usaha lain tidak memakai produk A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai produk A', true); end;
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
