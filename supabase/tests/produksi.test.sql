-- Tes M-07 produksi (supabase/migrations/20261105082000_produksi.sql): BoM bertingkat tanpa lingkaran, urai kebutuhan bahan,
-- biaya standar, perintah kerja (bahan ke 1-320, konversi, hasil pada biaya aktual, saldo 1-320 kembali 0), produk sampingan pada
-- nilai realisasi neto, produk bersama menurut nilai jual relatif, rakit, bongkar, batal mengembalikan bahan, idempoten, peran, isolasi.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  tp uuid; gl uuid; ad uuid; rt uuid; rm uuid; kl uuid; pr uuid; sn uuid; g uuid; w1 uuid; w2 uuid; w3 uuid; r jsonb; k uuid := gen_random_uuid();
  v_hari date; v_nilai0 bigint; v numeric;
begin
  begin
    insert into auth.users (id, email) values (ua, 'pd.a@uji.local'), (ub, 'pd.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Roti Uji Produksi', 'produksi');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Produksi', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Dapur') returning id into o_s;
    perform public.buat_akun_staf(o_s, '565656');
    tp := public.simpan_produk('{"kode": "TPG", "nama": "Tepung terigu", "jenis": "barang", "satuan": "kg", "harga_jual": 0}');
    gl := public.simpan_produk('{"kode": "GLA", "nama": "Gula pasir", "jenis": "barang", "satuan": "kg", "harga_jual": 0}');
    ad := public.simpan_produk('{"kode": "ADN", "nama": "Adonan dasar", "jenis": "barang", "satuan": "kg", "harga_jual": 0}');
    rt := public.simpan_produk('{"kode": "RTI", "nama": "Roti manis", "jenis": "barang", "satuan": "pcs", "harga_jual": 3000}');
    rm := public.simpan_produk('{"kode": "RMH", "nama": "Remah roti", "jenis": "barang", "satuan": "kg", "harga_jual": 5000}');
    kl := public.simpan_produk('{"kode": "KLP", "nama": "Kelapa butir", "jenis": "barang", "satuan": "butir", "harga_jual": 0}');
    pr := public.simpan_produk('{"kode": "PRT", "nama": "Kelapa parut", "jenis": "barang", "satuan": "kg", "harga_jual": 20000}');
    sn := public.simpan_produk('{"kode": "SNT", "nama": "Santan", "jenis": "barang", "satuan": "l", "harga_jual": 30000}');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_hari := app.hari_ini(pa);
    g := app.gudang_utama(pa);
    perform app.gerak_stok(pa, tp, g, 100, 1000000, 'masuk', v_hari, 'awal', 'uji', null, 'uji:tp');
    perform app.gerak_stok(pa, gl, g, 20, 300000, 'masuk', v_hari, 'awal', 'uji', null, 'uji:gl');
    perform app.gerak_stok(pa, kl, g, 10, 50000, 'masuk', v_hari, 'awal', 'uji', null, 'uji:kl');
    select sum(nilai) into v_nilai0 from public.stok where perusahaan_id = pa;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.save_bom(jsonb_build_object('produk', ad, 'jumlah_hasil', 1, 'biaya_konversi', 0, 'bahan', jsonb_build_array(
      jsonb_build_object('produk', tp, 'jumlah', 1), jsonb_build_object('produk', gl, 'jumlah', 0.2))));
    perform pg_temp.cek('simpan BoM adonan', true);
    perform public.save_bom(jsonb_build_object('produk', rt, 'jumlah_hasil', 10, 'biaya_konversi', 20000,
      'bahan', jsonb_build_array(jsonb_build_object('produk', ad, 'jumlah', 0.5)),
      'hasil_lain', jsonb_build_array(jsonb_build_object('produk', rm, 'jumlah', 0.1, 'jenis', 'sampingan'))));
    perform pg_temp.cek('simpan BoM roti', true);
    begin perform public.save_bom(jsonb_build_object('produk', tp, 'jumlah_hasil', 1, 'bahan', jsonb_build_array(jsonb_build_object('produk', rt, 'jumlah', 1))));
      perform pg_temp.cek('BoM melingkar dua lapis ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('BoM melingkar dua lapis ditolak', sqlerrm like '%melingkar%', sqlerrm); end;
    begin perform public.save_bom(jsonb_build_object('produk', rt, 'jumlah_hasil', 1, 'bahan', jsonb_build_array(jsonb_build_object('produk', rt, 'jumlah', 1))));
      perform pg_temp.cek('bahan sama dengan hasil ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('bahan sama dengan hasil ditolak', true); end;
    r := public.explode_bom(rt, 100);
    perform pg_temp.cek('urai bertingkat 100 roti = 5 kg tepung + 1 kg gula', jsonb_array_length(r) = 2
      and (select (x ->> 'jumlah')::numeric from jsonb_array_elements(r) x where x ->> 'kode' = 'TPG') = 5
      and (select (x ->> 'jumlah')::numeric from jsonb_array_elements(r) x where x ->> 'kode' = 'GLA') = 1, r::text);
    execute 'reset role';
    v := app.standard_unit_cost(pa, rt);
    perform pg_temp.cek('biaya standar roti dari standar adonan = 2.650', round(v) = 2650, v::text);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);

    -- PK adonan 10 kg: bahan 100.000 + 30.000 masuk 1-320, hasil 130.000.
    w1 := public.create_work_order(ad, 10, gen_random_uuid());
    r := public.issue_work_order(w1);
    perform pg_temp.cek('ambil bahan adonan 130.000', (r ->> 'biaya_bahan')::bigint = 130000, r::text);
    perform pg_temp.cek('ambil bahan dua kali tidak menggandakan', (public.issue_work_order(w1) ->> 'baru')::boolean = false);
    r := public.complete_work_order(w1);
    perform pg_temp.cek('adonan 10 kg senilai 130.000', (select jumlah from public.stok where produk_id = ad) = 10 and (select nilai from public.stok where produk_id = ad) = 130000);

    -- PK roti 100 (faktor 10), hasil nyata 98 + remah 1 kg; konversi 200.000.
    w2 := public.create_work_order(rt, 100, k);
    perform pg_temp.cek('kunci sama = perintah kerja sama', public.create_work_order(rt, 100, k) = w2);
    perform pg_temp.cek('nomor PK terbit', (select nomor from public.work_order where id = w2) like '%/PK/%');
    perform pg_temp.cek('standar tercatat 2.650 per roti', (select standard_unit_cost from public.work_order where id = w2) = 2650);
    begin perform public.complete_work_order(w2); perform pg_temp.cek('selesai sebelum ambil bahan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('selesai sebelum ambil bahan ditolak', true); end;
    r := public.issue_work_order(w2);
    perform pg_temp.cek('ambil 5 kg adonan = 65.000', (r ->> 'biaya_bahan')::bigint = 65000 and (select jumlah from public.stok where produk_id = ad) = 5, r::text);
    r := public.complete_work_order(w2, 98);
    perform pg_temp.cek('biaya total 265.000, selisih terhadap standar 5.300', (r ->> 'biaya_total')::bigint = 265000 and (r ->> 'selisih')::bigint = 5300, r::text);
    perform pg_temp.cek('sampingan remah 1 kg pada nilai realisasi neto 5.000', (select jumlah from public.stok where produk_id = rm) = 1 and (select nilai from public.stok where produk_id = rm) = 5000);
    perform pg_temp.cek('roti 98 senilai 260.000 (biaya dikurangi sampingan)', (select jumlah from public.stok where produk_id = rt) = 98 and (select nilai from public.stok where produk_id = rt) = 260000);
    perform pg_temp.cek('selesai dua kali tidak menggandakan', (public.complete_work_order(w2) ->> 'baru')::boolean = false and (select jumlah from public.stok where produk_id = rt) = 98);
    execute 'reset role';
    perform pg_temp.cek('saldo 1-320 barang dalam proses kembali 0', (select coalesce(sum(b.debit - b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-320') = 0);
    perform pg_temp.cek('5-310 konversi dibebankan kredit 200.000', (select coalesce(sum(b.kredit - b.debit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '5-310') = 200000);
    perform pg_temp.cek('jurnal 1-300 naik 200.000 = nilai stok naik 200.000',
      (select coalesce(sum(b.debit - b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-300') = 200000
      and (select sum(nilai) from public.stok where perusahaan_id = pa) - v_nilai0 = 200000);

    -- Rakit kelapa parut: 2 butir (10.000) jadi parut 1 kg (bobot 20.000) + santan 0,6 l bersama (bobot 18.000).
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.save_bom(jsonb_build_object('produk', pr, 'jumlah_hasil', 0.5, 'bahan', jsonb_build_array(jsonb_build_object('produk', kl, 'jumlah', 1)),
      'hasil_lain', jsonb_build_array(jsonb_build_object('produk', sn, 'jumlah', 0.3, 'jenis', 'bersama'))));
    r := public.assemble_product(pr, 1, gen_random_uuid());
    perform pg_temp.cek('produk bersama dibagi nilai jual relatif: parut 5.263, santan 4.737',
      (select nilai from public.stok where produk_id = pr) = 5263 and (select nilai from public.stok where produk_id = sn) = 4737
      and (select jumlah from public.stok where produk_id = sn) = 0.6 and (select jumlah from public.stok where produk_id = kl) = 8, r::text);

    -- Bongkar 10 roti: keluar senilai rata-rata, adonan 0,5 kg kembali dengan nilai sama; total persediaan tetap.
    execute 'reset role';
    select sum(nilai) into v_nilai0 from public.stok where perusahaan_id = pa;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.disassemble_product(rt, 10, gen_random_uuid());
    perform pg_temp.cek('bongkar: roti 88, adonan 5,5, nilai pindah utuh', (select jumlah from public.stok where produk_id = rt) = 88
      and (select jumlah from public.stok where produk_id = ad) = 5.5 and (r ->> 'nilai')::bigint = 26531, r::text);
    execute 'reset role';
    perform pg_temp.cek('bongkar tidak mengubah total persediaan', (select sum(nilai) from public.stok where perusahaan_id = pa) = v_nilai0);

    -- Batal setelah ambil bahan: adonan kembali, 1-320 tetap 0; stok kurang ditolak.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    w3 := public.create_work_order(rt, 10, gen_random_uuid());
    perform public.issue_work_order(w3);
    perform public.cancel_work_order(w3);
    perform pg_temp.cek('batal mengembalikan adonan', (select jumlah from public.stok where produk_id = ad) = 5.5 and (select status from public.work_order where id = w3) = 'cancelled');
    begin perform public.issue_work_order(public.create_work_order(rt, 100000, gen_random_uuid())); perform pg_temp.cek('bahan kurang ditolak', false);
    exception when sqlstate '23514' then perform pg_temp.cek('bahan kurang ditolak', true); end;
    execute 'reset role';
    perform pg_temp.cek('saldo 1-320 tetap 0 setelah batal', (select coalesce(sum(b.debit - b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-320') = 0);

    -- Peran dan isolasi.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.create_work_order(rt, 10, gen_random_uuid()); perform pg_temp.cek('staf tidak membuat perintah kerja', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat perintah kerja', true); end;
    perform pg_temp.cek('staf tidak membaca BoM dan PK', (select count(*) from public.bom) = 0 and (select count(*) from public.work_order) = 0);
    begin perform public.save_bom(jsonb_build_object('produk', rt, 'jumlah_hasil', 1, 'bahan', jsonb_build_array(jsonb_build_object('produk', ad, 'jumlah', 1))));
      perform pg_temp.cek('staf tidak mengubah BoM', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengubah BoM', true); end;
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik membaca 5 PK (adonan, roti, rakit, bongkar, batal)', (select count(*) from public.work_order) = 5);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat BoM dan PK', (select count(*) from public.bom) = 0 and (select count(*) from public.work_order) = 0);
    begin perform public.issue_work_order(w3); perform pg_temp.cek('usaha lain tidak memakai PK A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai PK A', true); end;
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    begin perform public.explode_bom(rt, 1); perform pg_temp.cek('anon tidak mengurai BoM', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak mengurai BoM', true); end;
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
