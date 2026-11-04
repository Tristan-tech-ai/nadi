-- Tes M-02 stok (supabase/migrations/20261104055000_stok.sql). Kartu stok dihitung tangan:
-- masuk 10 @1.000, masuk 10 @1.600 (rata-rata 1.300), pindah 5 ke gudang B, opname kurang 1, invoice 4 pcs, invoice 1 dus (10 pcs,
-- sisa nilai habis), stok kurang ditolak, masuk 10 @1.500, paket 2 x (2 pcs), invoice pertama dibatalkan. Saldo akun 1-300 harus sama
-- dengan jumlah nilai stok, neraca seimbang, peran dan isolasi usaha dijaga. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; ks text; r jsonb; x uuid; jasa uuid; paket uuid; ga uuid; gb uuid; i1 uuid; n int; v_hari date;
begin
  begin
    insert into auth.users (id, email) values (ua, 'sa@uji.local'), (ub, 'sb@uji.local'), (us, 'ss@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Stok', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Stok B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    perform pg_temp.cek('authenticated tidak bisa menulis tabel stok langsung', not has_table_privilege('authenticated', 'public.stok', 'update')
      and not has_table_privilege('authenticated', 'public.gerak_stok', 'insert') and not has_table_privilege('authenticated', 'public.produk', 'insert'));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    ga := public.simpan_gudang('TOKO', 'Toko depan');
    gb := public.simpan_gudang('GDG', 'Gudang belakang');
    perform pg_temp.cek('gudang pertama jadi utama', (select utama from public.gudang where id = ga) and not (select utama from public.gudang where id = gb));
    x := public.simpan_produk('{"kode":"GULA-1","nama":"Gula 1 kg","satuan":"pcs","harga_jual":2000,"satuan_lain":[{"satuan":"dus","faktor":10,"harga":19000}]}');
    jasa := public.simpan_produk('{"kode":"ANTAR","nama":"Ongkos antar","jenis":"jasa","harga_jual":5000}');
    paket := public.simpan_produk(jsonb_build_object('kode', 'PKT-2', 'nama', 'Paket 2 gula', 'jenis', 'paket', 'harga_jual', 3800,
      'komponen', jsonb_build_array(jsonb_build_object('produk', x, 'jumlah', 2))));

    r := public.stok_masuk(x, ga, 10, 10000, v_hari, '2-100', 'Beli dari UD Sumber', null, '00000000-0000-4000-8000-000000000001');
    perform public.stok_masuk(x, ga, 10, 16000, v_hari, '1-100', 'Beli tunai', 'B-01', '00000000-0000-4000-8000-000000000002');
    r := public.stok_masuk(x, ga, 10, 10000, v_hari, '2-100', 'kirim ulang', null, '00000000-0000-4000-8000-000000000001');
    perform pg_temp.cek('stok masuk idempoten per kunci', not (r ->> 'baru')::boolean);
    perform pg_temp.cek('dua kali masuk: 20 pcs bernilai 26.000 (rata-rata 1.300)', (select jumlah = 20 and nilai = 26000 from public.stok where produk_id = x and gudang_id = ga));
    r := public.transfer_stok(x, ga, gb, 5, gen_random_uuid());
    perform pg_temp.cek('pindah 5 ke gudang B membawa 6.500', (r ->> 'nilai')::bigint = 6500
      and (select jumlah = 15 and nilai = 19500 from public.stok where produk_id = x and gudang_id = ga)
      and (select jumlah = 5 and nilai = 6500 from public.stok where produk_id = x and gudang_id = gb));
    r := public.opname_stok(ga, jsonb_build_array(jsonb_build_object('produk', x, 'fisik', 14)), gen_random_uuid());
    perform pg_temp.cek('opname kurang 1 = selisih 1.300', (r ->> 'nilai')::bigint = -1300 and (select jumlah = 14 and nilai = 18200 from public.stok where produk_id = x and gudang_id = ga), r::text);

    perform public.atur_bayar('00020101021153033605802ID5915TOKO UJI NADI6008DENPASAR6304ABCD', 'TOKO UJI NADI', null, null);
    r := public.buat_invoice('Bu Rina', null, jsonb_build_array(jsonb_build_object('uraian', 'Gula 1 kg', 'jumlah', 4, 'harga', 2000, 'produk', x),
      jsonb_build_object('uraian', 'Ongkos antar', 'jumlah', 1, 'harga', 5000, 'produk', jasa)), v_hari + 7, null, gen_random_uuid());
    i1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('invoice 4 pcs: stok 10 bernilai 13.000, HPP 5.200, jasa tidak menyentuh stok',
      (select jumlah = 10 and nilai = 13000 from public.stok where produk_id = x and gudang_id = ga)
      and (select sum(b.debit) = 5200 from public.jurnal j join public.jurnal_baris b on b.jurnal_id = j.id join public.akun a on a.id = b.akun_id
            where j.perusahaan_id = pa and j.kunci_idempoten = 'hpp:' || i1 and a.kode = '5-100')
      and not exists (select 1 from public.stok where produk_id = jasa), r::text);
    perform pg_temp.cek('baris invoice menyimpan produk dan satuan', (select baris -> 0 ->> 'satuan' = 'pcs' and baris -> 0 ->> 'produk' = x::text from public.invoice where id = i1));
    perform public.buat_invoice('Pak Made', null, jsonb_build_array(jsonb_build_object('uraian', 'Gula 1 dus', 'jumlah', 1, 'harga', 19000, 'produk', x, 'satuan', 'dus')),
      v_hari + 7, null, gen_random_uuid());
    perform pg_temp.cek('invoice 1 dus = 10 pcs, sisa nilai habis tanpa sisa pembulatan', (select jumlah = 0 and nilai = 0 from public.stok where produk_id = x and gudang_id = ga));
    select count(*) into n from public.invoice where perusahaan_id = pa;
    begin
      perform public.buat_invoice('Bu Sari', null, jsonb_build_array(jsonb_build_object('uraian', 'Gula', 'jumlah', 1, 'harga', 2000, 'produk', x)), v_hari + 7, null, gen_random_uuid());
      perform pg_temp.cek('stok kosong menolak invoice berproduk', false);
    exception when sqlstate '23514' then
      perform pg_temp.cek('stok kosong menolak invoice berproduk', (select count(*) from public.invoice where perusahaan_id = pa) = n, sqlerrm);
    end;
    begin
      perform public.buat_invoice('Bu Sari', null, jsonb_build_array(jsonb_build_object('uraian', 'Gula', 'jumlah', 1, 'harga', 2000, 'produk', x, 'satuan', 'karung')), v_hari + 7, null, gen_random_uuid());
      perform pg_temp.cek('satuan tidak dikenal ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('satuan tidak dikenal ditolak', true);
    end;
    perform public.stok_masuk(x, ga, 10, 15000, v_hari, '2-100', null, null, gen_random_uuid());
    perform public.buat_invoice('Bu Ani', null, jsonb_build_array(jsonb_build_object('uraian', 'Paket 2 gula', 'jumlah', 2, 'harga', 3800, 'produk', paket)), v_hari + 7, null, gen_random_uuid());
    perform pg_temp.cek('paket 2 x 2 pcs: stok 6 bernilai 9.000', (select jumlah = 6 and nilai = 9000 from public.stok where produk_id = x and gudang_id = ga));
    perform public.batal_invoice(i1, 'Salah pelanggan');
    perform pg_temp.cek('invoice batal: 4 pcs kembali senilai 5.200, jurnal HPP dibalik', (select jumlah = 10 and nilai = 14200 from public.stok where produk_id = x and gudang_id = ga)
      and (select dibalik_oleh is not null from public.jurnal where perusahaan_id = pa and kunci_idempoten = 'hpp:' || i1));
    perform pg_temp.cek('saldo akun persediaan 1-300 = nilai stok 20.700',
      (select sum(b.debit - b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-300') = 20700
      and (select sum(nilai) from public.stok where perusahaan_id = pa) = 20700);
    perform pg_temp.cek('neraca tetap seimbang', (public.laporan_keuangan(date_trunc('year', v_hari)::date, v_hari) #>> '{neraca,seimbang}')::boolean);
    perform pg_temp.cek('kartu stok: saldo berjalan baris terakhir = saldo stok', (select saldo_jumlah = 10 and saldo_nilai = 14200 from public.gerak_stok
      where produk_id = x and gudang_id = ga order by dibuat_at desc, id desc limit 1));

    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf membaca daftar produk tetapi tidak nilai stok', (select count(*) = 3 from public.produk) and (select count(*) = 0 from public.stok));
    begin
      perform public.simpan_produk('{"kode":"X","nama":"X"}');
      perform pg_temp.cek('staf tidak bisa menambah produk', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menambah produk', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat produk dan stok', (select count(*) = 0 from public.produk) and (select count(*) = 0 from public.gerak_stok));
    begin
      perform public.stok_masuk(x, null, 1, 1, v_hari, '2-100', null, null, gen_random_uuid());
      perform pg_temp.cek('usaha lain tidak bisa menggerakkan produk usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menggerakkan produk usaha A', true);
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
