-- Tes M-02B stok lanjutan (supabase/migrations/20261104061000_stok_lanjutan.sql): lokasi rak/bin, laporan per gudang,
-- usulan produk.impor (duplikat dilewati, kode dibuat dari nama) dan stok.opname (dicocokkan kode/nama, yang asing dilewati).
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  gula uuid; varian uuid; g uuid; u uuid; r jsonb; v_hari date;
begin
  begin
    insert into auth.users (id, email) values (ua, 'sa@uji.local'), (ub, 'sb@uji.local'), (us, 'ss@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Stok Lanjut', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Stok Lanjut B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    gula := public.simpan_produk('{"kode":"GULA","nama":"Gula 1 kg","harga_jual":15000,"harga_tingkat":[{"min":10,"harga":14000},{"min":50,"harga":13500}]}');
    varian := public.simpan_produk(jsonb_build_object('kode', 'GULA-5', 'nama', 'Gula 5 kg', 'harga_jual', 72000, 'induk', gula, 'atribut', jsonb_build_object('ukuran', '5 kg')));
    perform pg_temp.cek('varian menyimpan induk dan atribut, harga bertingkat tersimpan',
      (select induk_id = gula and atribut ->> 'ukuran' = '5 kg' from public.produk where id = varian)
      and (select jsonb_array_length(harga_tingkat) = 2 from public.produk where id = gula));
    execute 'reset role';
    g := app.gudang_utama(pa);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.stok_masuk(gula, g, 10, 120000, v_hari, '1-100', 'Stok awal', null, gen_random_uuid());
    perform public.atur_lokasi_stok(gula, g, 'Rak A-3');
    perform pg_temp.cek('lokasi rak tersimpan tanpa mengubah jumlah', (select lokasi = 'Rak A-3' and jumlah = 10 from public.stok where produk_id = gula and gudang_id = g));
    r := public.laporan_stok();
    perform pg_temp.cek('laporan stok per gudang memuat lokasi dan nilai', r -> 0 ->> 'gudang_id' = g::text and (r -> 0 ->> 'nilai')::bigint = 120000
      and exists (select 1 from jsonb_array_elements(r -> 0 -> 'produk') e where e ->> 'kode' = 'GULA' and e ->> 'lokasi' = 'Rak A-3'), r::text);

    execute 'reset role';
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, kunci_klien) values (pa, 'lempar', 'produk.impor', 'Tambah 3 produk dari Excel',
      jsonb_build_object('jenis', 'produk', 'bidang', jsonb_build_object('baris', jsonb_build_array(
        jsonb_build_object('kode', 'GULA', 'nama', 'Gula 1 kg', 'satuan', 'pcs', 'harga_jual', 15000, 'stok', 0),
        jsonb_build_object('kode', 'KOPI-B', 'nama', 'Kopi Bubuk 200 g', 'satuan', 'bks', 'harga_jual', 18500, 'stok', 0),
        jsonb_build_object('kode', '', 'nama', 'Teh Celup 25', 'satuan', 'kotak', 'harga_jual', 9000, 'stok', 0)))), gen_random_uuid()) returning id into u;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('sebelum disetujui produk belum bertambah', (select count(*) = 2 from public.produk where perusahaan_id = pa));
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('produk.impor: 2 produk baru, duplikat GULA dilewati, kode dari nama', (select count(*) = 4 from public.produk where perusahaan_id = pa)
      and exists (select 1 from public.produk where perusahaan_id = pa and kode = 'TEHCELUP25' and harga_jual = 9000 and satuan = 'kotak'),
      (select string_agg(kode, ',') from public.produk where perusahaan_id = pa));

    execute 'reset role';
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, kunci_klien) values (pa, 'lempar', 'stok.opname', 'Catat hitungan stok 3 barang',
      jsonb_build_object('jenis', 'opname', 'bidang', jsonb_build_object('gudang', 'Toko', 'tanggal', v_hari, 'baris', jsonb_build_array(
        jsonb_build_object('kode', 'gula', 'nama', '', 'jumlah', 8),
        jsonb_build_object('kode', '', 'nama', 'Kopi Bubuk 200 g', 'jumlah', 5),
        jsonb_build_object('kode', 'XXX', 'nama', 'Barang Asing', 'jumlah', 3)))), gen_random_uuid()) returning id into u;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('opname: GULA 10 jadi 8 (nilai rata-rata 9.600), KOPI 5, barang asing dilewati',
      (select jumlah = 8 and nilai = 96000 from public.stok where produk_id = gula and gudang_id = g)
      and (select s.jumlah = 5 from public.stok s join public.produk p on p.id = s.produk_id where p.kode = 'KOPI-B' and p.perusahaan_id = pa)
      and exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'stok.opname.diterapkan' and (data ->> 'baris')::int = 2),
      (select jumlah::text || '/' || nilai from public.stok where produk_id = gula and gudang_id = g));
    perform pg_temp.cek('opname tetap menjurnal penyesuaian sehingga neraca seimbang', (public.laporan_keuangan(date_trunc('year', v_hari)::date, v_hari) #>> '{neraca,seimbang}')::boolean);

    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.atur_lokasi_stok(gula, g, 'Rak B');
      perform pg_temp.cek('staf tidak mengubah lokasi', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak mengubah lokasi', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.laporan_stok();
    perform pg_temp.cek('usaha lain tidak melihat stok usaha A', not exists (select 1 from jsonb_array_elements(r) x, jsonb_array_elements(x -> 'produk') e where e ->> 'kode' = 'GULA'), r::text);
    begin
      perform public.atur_lokasi_stok(gula, g, 'Rak X');
      perform pg_temp.cek('usaha lain tidak mengubah lokasi usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengubah lokasi usaha A', true);
    end;
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
