-- Tes W-07B order titipan/servis (supabase/migrations/20261105086000_order_servis.sql): tiket bernomor SRV dan kode publik, idempoten,
-- status hanya maju (mundur ditolak, batal butuh alasan, selesai/batal terkunci), riwayat tercatat, invoice sekali per tiket dengan stok
-- suku cadang berkurang, status publik tanpa HP, staf boleh menerima tetapi tidak menagih, isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  r jsonb; s1 uuid; s2 uuid; k uuid := gen_random_uuid(); kode text; pr uuid; v_hari date;
begin
  begin
    insert into auth.users (id, email) values (ua, 'os.a@uji.local'), (ub, 'os.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Bengkel Uji Servis', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Servis', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Mekanik Loket') returning id into o_s;
    perform public.buat_akun_staf(o_s, '232323');
    pr := public.simpan_produk('{"kode": "OLI", "nama": "Oli mesin 1 L", "jenis": "barang", "satuan": "botol", "harga_jual": 55000}');
    perform public.stok_masuk(pr, null, 10, 350000, null, '1-100', 'awal', null, gen_random_uuid());
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Staf loket menerima motor.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    r := public.create_service_order(jsonb_build_object('pelanggan', 'Andi', 'hp', '6281299990001', 'item', 'Honda Beat DK 1234 AB', 'keluhan', 'Ganti oli, rem bunyi',
      'estimasi', 120000, 'janji', v_hari + 1), k);
    s1 := (r ->> 'id')::uuid; kode := r ->> 'kode';
    perform pg_temp.cek('tiket bernomor SRV dan kode publik 12 heksa', r ->> 'nomor' like '%/SRV/%' and kode ~ '^[0-9A-F]{12}$', r::text);
    perform pg_temp.cek('kunci sama = tiket sama', (public.create_service_order(jsonb_build_object('pelanggan', 'x', 'item', 'xx'), k) ->> 'id')::uuid = s1);
    begin perform public.create_service_order(jsonb_build_object('pelanggan', 'B', 'item', 'Kulkas', 'janji', v_hari - 1), gen_random_uuid()); perform pg_temp.cek('janji kemarin ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('janji kemarin ditolak', true); end;
    perform public.advance_service_order(s1, 'dikerjakan');
    perform public.advance_service_order(s1, 'dikerjakan');
    begin perform public.advance_service_order(s1, 'diterima'); perform pg_temp.cek('status mundur ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('status mundur ditolak', true); end;
    perform public.advance_service_order(s1, 'selesai', 'Oli diganti, kampas rem dibersihkan');
    perform pg_temp.cek('riwayat 3 langkah (klik ganda diabaikan)', (select jsonb_array_length(riwayat) from public.service_order where id = s1) = 3);
    begin perform public.invoice_from_service_order(s1, '[{"uraian": "Jasa servis", "jumlah": 1, "harga": 50000}]'); perform pg_temp.cek('staf tidak menagih', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak menagih', true); end;

    -- Pemilik menagih: jasa + oli dari stok.
    perform set_config('request.jwt.claims', ka, true);
    r := public.invoice_from_service_order(s1, jsonb_build_array(jsonb_build_object('uraian', 'Jasa servis', 'jumlah', 1, 'harga', 50000),
      jsonb_build_object('uraian', 'Oli mesin 1 L', 'jumlah', 1, 'harga', 55000, 'produk', pr)));
    perform pg_temp.cek('invoice dari tiket: total 105.000, tertaut', (r ->> 'total')::bigint = 105000 and (select invoice_id from public.service_order where id = s1) = (r ->> 'id')::uuid, r::text);
    perform pg_temp.cek('invoice sekali per tiket', (public.invoice_from_service_order(s1, '[{"uraian": "lain", "jumlah": 1, "harga": 1}]'::jsonb) ->> 'sudah')::boolean
      and (select count(*) from public.invoice where catatan like 'Order %Honda Beat%') = 1);
    perform pg_temp.cek('stok oli berkurang 1', (select jumlah from public.stok where produk_id = pr) = 9);
    perform public.advance_service_order(s1, 'diambil');
    begin perform public.advance_service_order(s1, 'batal', 'salah input'); perform pg_temp.cek('sudah diambil tidak bisa batal', false);
    exception when sqlstate '22023' then perform pg_temp.cek('sudah diambil tidak bisa batal', true); end;

    -- Batal butuh alasan; batal tidak ditagih.
    s2 := (public.create_service_order(jsonb_build_object('pelanggan', 'Sari', 'item', 'Cucian 4 kg'), gen_random_uuid()) ->> 'id')::uuid;
    begin perform public.advance_service_order(s2, 'batal', ''); perform pg_temp.cek('batal tanpa alasan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('batal tanpa alasan ditolak', true); end;
    perform public.advance_service_order(s2, 'batal', 'Pelanggan ambil lagi');
    begin perform public.invoice_from_service_order(s2, '[{"uraian": "x", "jumlah": 1, "harga": 1}]'); perform pg_temp.cek('order batal tidak ditagih', false);
    exception when sqlstate '22023' then perform pg_temp.cek('order batal tidak ditagih', true); end;

    -- Status publik.
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    r := public.service_status(lower(kode));
    perform pg_temp.cek('status publik: diambil, riwayat 4, kode tagihan, tanpa HP', r ->> 'status' = 'diambil' and jsonb_array_length(r -> 'riwayat') = 4
      and r ->> 'tagihan' ~ '^[A-HJ-NP-Z2-9]{12}$' and not (r::text like '%62812999%') and not (r::text like '%kampas%'), r::text);
    perform pg_temp.cek('kode salah: kosong', public.service_status('000000000000') is null);
    begin perform public.create_service_order(jsonb_build_object('pelanggan', 'x', 'item', 'xx'), gen_random_uuid()); perform pg_temp.cek('anon tidak membuat tiket', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak membuat tiket', true); end;

    -- Isolasi.
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat tiket A', (select count(*) from public.service_order) = 0);
    begin perform public.advance_service_order(s1, 'selesai'); perform pg_temp.cek('usaha lain tidak mengubah tiket A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengubah tiket A', true); end;
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf melihat tiket usahanya', (select count(*) from public.service_order) = 2);
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
