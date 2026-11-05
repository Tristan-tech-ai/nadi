-- Tes M-16B (supabase/migrations/20261105079000_janji_katalog_poin.sql): slot janji temu dan larangan bentrok (juga di tingkat
-- constraint), katalog publik hanya produk aktif berharga, poin loyalitas dari invoice lunas dan penukaran yang tidak melebihi
-- sisa, templat balasan, peran, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  kj text; kk text; lay uuid; r jsonb; v_tgl date; ap uuid; inv uuid; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'jk.a@uji.local'), (ub, 'jk.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Salon Uji Janji', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Janji', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Nia Kapster') returning id into o_s;
    perform public.buat_akun_staf(o_s, '565656');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_tgl := app.hari_ini(pa) + 2;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    kj := public.save_booking_setting(true, '09:00', '17:00', '{1,2,3,4,5,6,7}', 30);
    lay := public.save_appointment_service(null, 'Potong rambut', 60, 50000);
    perform public.save_reply_template('Salam', 'Halo Kak, terima kasih sudah menghubungi kami.');
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.save_booking_setting(true, '09:00', '17:00', '{1}', 30); perform pg_temp.cek('staf tidak mengubah pengaturan janji', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengubah pengaturan janji', true); end;
    perform pg_temp.cek('staf membaca templat balasan', (select count(*) from public.reply_template) = 1);

    -- Pengunjung.
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    r := public.booking_info(kj);
    perform pg_temp.cek('info janji publik: usaha dan layanan, tanpa id usaha', r ->> 'usaha' = 'Salon Uji Janji' and r -> 'layanan' -> 0 ->> 'nama' = 'Potong rambut'
      and not (r ? 'perusahaan_id'), r::text);
    r := public.booking_slots(kj, lay, v_tgl);
    perform pg_temp.cek('15 slot 60 menit dari 09.00 sampai 16.00 per 30 menit', jsonb_array_length(r) = 15 and r ->> 0 = '09:00' and r ->> 14 = '16:00', r::text);
    r := public.book_appointment(kj, lay, v_tgl, '10:00', 'Bu Sri', '0813-2222-3333', 'Potong pendek');
    perform pg_temp.cek('pesan janji 10.00: kode 8 karakter', r ->> 'kode' ~ '^[0-9A-F]{8}$', r::text);
    r := public.booking_slots(kj, lay, v_tgl);
    perform pg_temp.cek('slot 09.30, 10.00, 10.30 hilang (bertumpuk dengan 10.00 sampai 11.00)', jsonb_array_length(r) = 12
      and not (r ? '09:30') and not (r ? '10:00') and not (r ? '10:30') and r ? '09:00' and r ? '11:00', r::text);
    begin perform public.book_appointment(kj, lay, v_tgl, '10:30', 'Pak Budi', null, null); perform pg_temp.cek('jam bertumpuk ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('jam bertumpuk ditolak', true); end;
    perform pg_temp.cek('tanggal lebih dari 60 hari dan kemarin: tanpa slot', public.booking_slots(kj, lay, v_tgl + 70) = '[]' and public.booking_slots(kj, lay, v_tgl - 3) = '[]');
    begin perform public.booking_slots('kunci-salah', lay, v_tgl); perform pg_temp.cek('kunci janji salah ditolak', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('kunci janji salah ditolak', true); end;
    begin perform count(*) from public.appointment; perform pg_temp.cek('anon tidak membaca tabel janji', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak membaca tabel janji', true); end;
    execute 'reset role';
    -- Constraint menolak tumpukan walau lewat jalur lain (dua pemesanan bersamaan).
    begin
      insert into public.appointment (perusahaan_id, layanan_id, mulai, selesai, nama)
      select perusahaan_id, layanan_id, mulai + interval '15 minutes', selesai + interval '15 minutes', 'Tumpuk' from public.appointment where perusahaan_id = pa;
      perform pg_temp.cek('exclusion constraint menolak janji bertumpuk', false);
    exception when exclusion_violation then perform pg_temp.cek('exclusion constraint menolak janji bertumpuk', true); end;
    select id into ap from public.appointment where perusahaan_id = pa;
    perform pg_temp.cek('nomor WhatsApp dirapikan ke 62', (select hp = '6281322223333' from public.appointment where id = ap));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.set_appointment_status(ap, 'batal');
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform pg_temp.cek('janji batal membuka slot lagi', jsonb_array_length(public.booking_slots(kj, lay, v_tgl)) = 15);
    execute 'reset role';

    -- Katalog publik.
    insert into public.produk (perusahaan_id, kode, nama, harga_jual, satuan) values (pa, 'SMP-01', 'Sampo herbal', 45000, 'botol'), (pa, 'CTH-01', 'Contoh gratis', 0, 'pcs');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    kk := public.save_catalog_setting(true, '0812-9999-8888');
    begin perform public.save_catalog_setting(true, '123'); perform pg_temp.cek('nomor katalog salah ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('nomor katalog salah ditolak', true); end;
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    r := public.catalog_public(kk);
    perform pg_temp.cek('katalog publik: hanya produk berharga, nomor 62', r ->> 'wa' = '6281299998888' and jsonb_array_length(r -> 'produk') = 1
      and r -> 'produk' -> 0 ->> 'nama' = 'Sampo herbal' and (r -> 'produk' -> 0 ->> 'harga')::bigint = 45000, r::text);
    execute 'reset role';

    -- Poin loyalitas.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.save_loyalty_setting(true, 10000);
    inv := (public.buat_invoice('Bu Rina', null, jsonb_build_array(jsonb_build_object('uraian', 'Creambath', 'jumlah', 1, 'harga', 250000)), v_tgl + 5, null, gen_random_uuid()) ->> 'id')::uuid;
    perform public.tandai_lunas(inv, 'tunai');
    perform public.buat_invoice('Bu Rina', null, jsonb_build_array(jsonb_build_object('uraian', 'Belum dibayar', 'jumlah', 1, 'harga', 100000)), v_tgl + 5, null, gen_random_uuid());
    r := public.loyalty_points();
    perform pg_temp.cek('poin 25 dari invoice lunas Rp250.000 saja', r -> 0 ->> 'pelanggan' = 'Bu Rina' and (r -> 0 ->> 'dapat')::int = 25 and (r -> 0 ->> 'sisa')::int = 25, r::text);
    perform pg_temp.cek('tukar 10 poin: sisa 15', public.redeem_points('Bu Rina', 10, 'Potongan Rp10.000') = 15);
    begin perform public.redeem_points('bu rina', 20, 'Terlalu banyak'); perform pg_temp.cek('tukar melebihi sisa ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tukar melebihi sisa ditolak', true); end;
    perform pg_temp.cek('nama tanpa beda huruf besar: tukar 5 lagi, sisa 10', public.redeem_points('bu rina', 5, 'Vitamin rambut') = 10);
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.loyalty_points(); perform pg_temp.cek('staf tidak membaca poin', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membaca poin', true); end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain: tanpa janji, templat, pengaturan', (select count(*) from public.appointment) = 0 and (select count(*) from public.reply_template) = 0
      and (select count(*) from public.booking_setting) = 0 and (select count(*) from public.loyalty_redeem) = 0);
    begin perform public.set_appointment_status(ap, 'datang'); perform pg_temp.cek('usaha lain tidak mengubah janji A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengubah janji A', true); end;
    execute 'reset role';
    perform pg_temp.cek('fungsi app dan RPC pengelola tidak untuk anon', not has_function_privilege('anon', 'app.loyalty_table(uuid)', 'execute')
      and not has_function_privilege('anon', 'public.redeem_points(text,integer,text)', 'execute'));
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
