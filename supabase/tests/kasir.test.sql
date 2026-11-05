-- Tes M-19 kasir (supabase/migrations/20261105081000_kasir.sql): 200 transaksi tanpa selisih stok dan jurnal, idempoten per kunci
-- (sinkron ulang antrean luring), stok kurang ditolak, uang kurang ditolak, tutup shift dengan selisih kas dibukukan, struk publik,
-- laporan harian, kasir staf hanya melihat penjualannya, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  pr1 uuid; pr2 uuid; g uuid; sh uuid; sh2 uuid; r jsonb; k1 uuid := gen_random_uuid(); n int; v_hari date; kode text;
  stok_awal numeric; stok_akhir numeric; nilai_awal bigint; nilai_akhir bigint; v_pend bigint; v_hpp bigint; v_kas bigint; v_bank bigint; v_tot bigint; v_tunai bigint;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ks.a@uji.local'), (ub, 'ks.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Kasir', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Kasir', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Kasir Uji') returning id into o_s;
    perform public.buat_akun_staf(o_s, '787878');
    pr1 := public.simpan_produk('{"kode": "KOPI-1", "nama": "Kopi bubuk 100 g", "jenis": "barang", "satuan": "bks", "harga_jual": 15000, "boleh_minus": false}');
    pr2 := public.simpan_produk('{"kode": "GULA-1", "nama": "Gula 1 kg", "jenis": "barang", "satuan": "kg", "harga_jual": 18000, "boleh_minus": false}');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_hari := app.hari_ini(pa);
    g := app.gudang_utama(pa);
    -- Stok awal: 500 kopi @ Rp10.000 dan 300 gula @ Rp14.000.
    perform app.gerak_stok(pa, pr1, g, 500, 5000000, 'masuk', v_hari, 'awal', 'uji', null, 'uji:kopi');
    perform app.gerak_stok(pa, pr2, g, 300, 4200000, 'masuk', v_hari, 'awal', 'uji', null, 'uji:gula');
    select sum(jumlah), sum(nilai) into stok_awal, nilai_awal from public.stok where perusahaan_id = pa;
    insert into public.bayar_usaha (perusahaan_id, qris, qris_nama, rekening) values (pa, '000201010211265700UJIQRISKASIRNADI6304ABCD', 'WARUNG UJI KASIR', 'BCA 1234567890');

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    sh := public.pos_open_shift(200000);
    perform pg_temp.cek('buka shift dua kali = shift yang sama', public.pos_open_shift(0) = sh);
    perform pg_temp.cek('kasir staf mendapat QRIS statis tanpa rekening', public.pos_payment_qr() = '{"qris": "000201010211265700UJIQRISKASIRNADI6304ABCD", "nama": "WARUNG UJI KASIR"}'::jsonb, public.pos_payment_qr()::text);
    perform pg_temp.cek('kasir staf tetap tidak membaca bayar_usaha', (select count(*) from public.bayar_usaha) = 0);
    -- 200 transaksi: genap tunai 2 kopi + 1 gula (Rp48.000), ganjil QRIS 1 kopi (Rp15.000).
    for n in 1..200 loop
      if n % 2 = 0 then
        perform public.pos_record_sale(sh, md5('jual' || n)::uuid, now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 2), jsonb_build_object('produk', pr2, 'jumlah', 1)), 'tunai', 50000);
      else
        perform public.pos_record_sale(sh, md5('jual' || n)::uuid, now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1)), 'qris', null);
      end if;
    end loop;
    -- Sinkron ulang 200 kunci yang sama (antrean luring terkirim dua kali): tidak menambah apa pun.
    for n in 1..200 loop
      r := public.pos_record_sale(sh, md5('jual' || n)::uuid, now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1)), 'qris', null);
      if (r ->> 'baru')::boolean then raise exception 'sinkron ulang membuat penjualan baru'; end if;
    end loop;
    perform pg_temp.cek('kasir melihat 200 penjualannya', (select count(*) from public.pos_sale) = 200);
    r := public.pos_record_sale(sh, k1, now(), jsonb_build_array(jsonb_build_object('produk', pr2, 'jumlah', 1)), 'tunai', 20000);
    perform pg_temp.cek('kembalian tunai', (r ->> 'kembalian')::bigint = 2000 and (r ->> 'total')::bigint = 18000, r::text);
    kode := r ->> 'kode';
    begin perform public.pos_record_sale(sh, gen_random_uuid(), now(), jsonb_build_array(jsonb_build_object('produk', pr2, 'jumlah', 1)), 'tunai', 10000); perform pg_temp.cek('uang kurang ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('uang kurang ditolak', true); end;
    begin perform public.pos_record_sale(sh, gen_random_uuid(), now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1000)), 'qris', null); perform pg_temp.cek('stok kurang ditolak', false);
    exception when sqlstate '23514' then perform pg_temp.cek('stok kurang ditolak', true); end;
    begin perform public.pos_record_sale(sh, gen_random_uuid(), now() - interval '8 days', jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1)), 'qris', null); perform pg_temp.cek('penjualan luring > 7 hari ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('penjualan luring > 7 hari ditolak', true); end;
    r := public.pos_daily(v_hari);
    perform pg_temp.cek('laporan harian: 201 transaksi', (r ->> 'transaksi')::int = 201, r::text);
    execute 'reset role';

    -- Tanpa selisih: 300 kopi + 101 gula keluar; penjualan 100 x 48.000 + 100 x 15.000 + 18.000 = 6.318.000.
    select sum(jumlah), sum(nilai) into stok_akhir, nilai_akhir from public.stok where perusahaan_id = pa;
    perform pg_temp.cek('stok berkurang tepat 401 unit', stok_awal - stok_akhir = 401
      and (select jumlah from public.stok where produk_id = pr1) = 200 and (select jumlah from public.stok where produk_id = pr2) = 199);
    select coalesce(sum(b.kredit - b.debit), 0) into v_pend from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '4-100';
    select coalesce(sum(b.debit - b.kredit), 0) into v_hpp from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '5-100';
    select coalesce(sum(b.debit - b.kredit), 0) into v_kas from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-100';
    select coalesce(sum(b.debit - b.kredit), 0) into v_bank from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-110';
    select sum(total) into v_tot from public.pos_sale where perusahaan_id = pa;
    perform pg_temp.cek('penjualan 4-100 = jumlah struk = 6.318.000', v_pend = 6318000 and v_tot = 6318000, v_pend || '/' || v_tot);
    perform pg_temp.cek('HPP 5-100 = turunnya nilai persediaan = jumlah hpp struk (300 x 10.000 + 101 x 14.000 = 4.414.000)',
      v_hpp = 4414000 and nilai_awal - nilai_akhir = 4414000 and (select sum(hpp) from public.pos_sale where perusahaan_id = pa) = 4414000, v_hpp || '/' || (nilai_awal - nilai_akhir));
    perform pg_temp.cek('kas 1-100 = tunai 4.818.000, bank 1-110 = QRIS 1.500.000', v_kas = 4818000 and v_bank = 1500000, v_kas || '/' || v_bank);

    -- Tutup shift: kas harus 200.000 + 4.818.000 = 5.018.000; hitung 5.010.000 = kurang 8.000.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    r := public.pos_close_shift(sh, 5010000);
    perform pg_temp.cek('tutup shift: kas harus 5.018.000, selisih -8.000', (r ->> 'kas_harus')::bigint = 5018000 and (r ->> 'selisih')::bigint = -8000, r::text);
    begin perform public.pos_record_sale(gen_random_uuid(), gen_random_uuid(), now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1)), 'qris', null); perform pg_temp.cek('shift orang lain/tidak ada ditolak', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('shift orang lain/tidak ada ditolak', true); end;
    execute 'reset role';
    perform pg_temp.cek('selisih kas dibukukan ke 6-940', (select coalesce(sum(b.debit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '6-940') = 8000);
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    r := public.pos_receipt(kode);
    perform pg_temp.cek('struk publik dari kode: total dan kembalian, tanpa data kasir', (r ->> 'total')::bigint = 18000 and (r ->> 'kembalian')::bigint = 2000 and not (r ? 'shift_id'), r::text);
    begin perform public.pos_payment_qr(); perform pg_temp.cek('anon tidak mendapat QRIS', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak mendapat QRIS', true); end;
    begin perform public.pos_open_shift(0); perform pg_temp.cek('anon tidak membuka shift', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak membuka shift', true); end;
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain mendapat QRIS kosong', public.pos_payment_qr() is null);
    perform pg_temp.cek('usaha lain tidak melihat shift dan penjualan', (select count(*) from public.pos_sale) = 0 and (select count(*) from public.pos_shift) = 0);
    begin perform public.pos_record_sale(sh, gen_random_uuid(), now(), jsonb_build_array(jsonb_build_object('produk', pr1, 'jumlah', 1)), 'qris', null); perform pg_temp.cek('usaha lain tidak memakai shift A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai shift A', true); end;
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik melihat semua 201 penjualan', (select count(*) from public.pos_sale) = 201);
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
