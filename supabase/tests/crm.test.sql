-- Tes M-15 CRM (supabase/migrations/20261105077000_crm.sql): pelanggan (nomor WhatsApp dirapikan, nama unik tanpa beda huruf besar),
-- deal bertahap, aktivitas sales dengan lokasi hanya bila diizinkan, deal menjadi penawaran M-03 lalu menang saat penawaran jadi pesanan,
-- laporan sales (corong, tingkat menang, target, kunjungan), segmen dari invoice, peran, dan isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; kd text; ks text; ks2 text; o_s uuid; o_s2 uuid; u_s uuid; u_s2 uuid;
  c1 uuid; c2 uuid; d1 uuid; d2 uuid; t1 uuid; r jsonb; v_hari date; v_bln date; n int; v_baris jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'crma@uji.local'), (ub, 'crmb@uji.local'), (ud, 'crmd@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Konveksi Uji CRM', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji CRM', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Rudi Sales') returning id into o_s;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sinta Gudang') returning id into o_s2;
    perform public.buat_akun_staf(o_s, '111222');
    perform public.buat_akun_staf(o_s2, '333444');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin');
    select user_id into u_s from public.orang where id = o_s;
    select user_id into u_s2 from public.orang where id = o_s2;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    ks2 := json_build_object('sub', u_s2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_hari := app.hari_ini(pa);
    v_bln := date_trunc('month', v_hari)::date;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- Pelanggan.
    c1 := public.save_customer(null, 'PT Maju Jaya', 'perusahaan', null, '0812-3456-7890', 'beli@majujaya.co.id', 'Denpasar', null);
    perform pg_temp.cek('nomor WhatsApp dirapikan ke 62', (select hp = '6281234567890' from public.customer where id = c1));
    perform pg_temp.cek('nama sama beda huruf = pelanggan sama', public.save_customer(null, 'pt maju jaya', 'perusahaan', null, null, null, null, null) = c1);
    c2 := public.save_customer(null, 'Bu Komang', 'orang', c1, null, null, null, 'grosir');
    perform pg_temp.cek('kontak orang menempel ke perusahaannya', (select induk_id = c1 and jenis = 'orang' from public.customer where id = c2));
    begin perform public.save_customer(null, 'Salah Nomor', 'orang', null, '12345', null, null, null); perform pg_temp.cek('nomor salah ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('nomor salah ditolak', true); end;

    -- Deal.
    d1 := public.save_deal(null, c1, 'Seragam karyawan 200 pcs', 14000000, o_s, v_hari + 30);
    d2 := public.save_deal(null, c1, 'Kaos acara', 3000000, o_s, null);
    perform pg_temp.cek('deal baru di tahap prospek', (select tahap = 'prospek' from public.deal where id = d1));
    begin perform public.move_deal(d2, 'kalah'); perform pg_temp.cek('kalah tanpa alasan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kalah tanpa alasan ditolak', true); end;
    perform public.move_deal(d1, 'kualifikasi');

    -- Sales (staf) hanya melihat dan mencatat pada deal miliknya.
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('sales melihat 2 deal dan pelanggannya', (select count(*) from public.deal) = 2 and (select count(*) from public.customer) = 1);
    perform public.add_deal_activity(d1, 'kunjungan', 'Ukur badan di kantor pelanggan', null, '{"lat": -8.6704512, "lng": 115.2126293, "akurasi": 18.4}', true);
    perform public.add_deal_activity(d1, 'kunjungan', 'Antar contoh kain', null, '{"lat": -8.67, "lng": 115.21}', false);
    perform pg_temp.cek('lokasi disimpan hanya dengan izin, dibulatkan 5 desimal, bertujuan',
      (select count(*) from public.deal_activity where deal_id = d1 and jenis = 'kunjungan' and lokasi is not null) = 1
      and (select lokasi ->> 'lat' = '-8.67045' and lokasi ->> 'tujuan' = 'bukti kunjungan pelanggan' from public.deal_activity where deal_id = d1 and lokasi is not null));
    begin perform public.add_deal_activity(d1, 'tugas', 'Kirim katalog'); perform pg_temp.cek('tugas tanpa tanggal ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tugas tanpa tanggal ditolak', true); end;
    t1 := public.add_deal_activity(d1, 'tugas', 'Kirim katalog', v_hari + 2);
    perform public.complete_deal_task(t1);
    perform pg_temp.cek('sales menyelesaikan tugasnya', (select selesai from public.deal_activity where id = t1));
    begin perform public.save_deal(null, c1, 'Deal baru', 1, null, null); perform pg_temp.cek('sales tidak membuat deal', false);
    exception when sqlstate '42501' then perform pg_temp.cek('sales tidak membuat deal', true); end;
    perform set_config('request.jwt.claims', ks2, true);
    perform pg_temp.cek('staf lain tidak melihat deal, pelanggan, aktivitas', (select count(*) from public.deal) = 0
      and (select count(*) from public.customer) = 0 and (select count(*) from public.deal_activity) = 0);
    begin perform public.add_deal_activity(d1, 'catatan', 'Coba'); perform pg_temp.cek('staf lain tidak mencatat di deal orang', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf lain tidak mencatat di deal orang', true); end;

    -- Deal menjadi penawaran M-03, lalu menang saat penawaran dijadikan pesanan.
    perform set_config('request.jwt.claims', ka, true);
    v_baris := jsonb_build_array(jsonb_build_object('uraian', 'Seragam kerja drill', 'jumlah', 200, 'harga', 75000));
    r := public.deal_to_quote(d1, v_baris, v_hari + 14, gen_random_uuid());
    perform pg_temp.cek('penawaran PNW dari deal, total 15.000.000', r ->> 'nomor' like '%/PNW/%' and (r ->> 'total')::bigint = 15000000, r::text);
    perform pg_temp.cek('penawaran memakai nama dan WhatsApp pelanggan',
      (select pelanggan = 'PT Maju Jaya' and pelanggan_hp = '6281234567890' and catatan like 'Dari deal:%' from public.dokumen_jual where id = (r ->> 'id')::uuid));
    perform pg_temp.cek('deal pindah ke penawaran, nilai mengikuti total', (select tahap = 'penawaran' and nilai = 15000000 and dokumen_jual_id = (r ->> 'id')::uuid from public.deal where id = d1));
    perform pg_temp.cek('penawaran kedua dari deal yang sama memakai yang ada', (public.deal_to_quote(d1, v_baris, null, gen_random_uuid()) ->> 'sudah')::boolean);
    perform public.buat_dokumen_jual('pesanan', (r ->> 'id')::uuid, null, null, null, null, null, gen_random_uuid());
    perform pg_temp.cek('pesanan dari penawaran: deal menang, ditutup hari ini', (select tahap = 'menang' and ditutup_at = v_hari from public.deal where id = d1));
    begin perform public.deal_to_quote(d1, v_baris, null, gen_random_uuid()); perform pg_temp.cek('deal tertutup tidak dibuat penawaran lagi', false);
    exception when sqlstate '22023' then perform pg_temp.cek('deal tertutup tidak dibuat penawaran lagi', true); end;
    perform public.move_deal(d2, 'kalah', 'Harga pesaing lebih murah');

    -- Laporan sales dan target.
    perform public.set_sales_target(o_s, v_hari, 20000000);
    r := public.sales_report(v_bln, v_hari);
    perform pg_temp.cek('laporan: 1 menang, 1 kalah, tingkat menang 50%, corong menang 15.000.000',
      (r ->> 'menang')::int = 1 and (r ->> 'kalah')::int = 1 and (r ->> 'tingkat_menang')::int = 50
      and (r #>> '{corong,menang,nilai}')::bigint = 15000000 and (r #>> '{corong,kalah,jumlah}')::int = 1, r::text);
    perform pg_temp.cek('laporan per sales: menang 15.000.000, target 20.000.000, 2 kunjungan',
      exists (select 1 from jsonb_array_elements(r -> 'sales') s where s ->> 'nama' = 'Rudi Sales' and (s ->> 'menang_nilai')::bigint = 15000000
              and (s ->> 'target')::bigint = 20000000 and (s ->> 'kunjungan')::int = 2), r::text);

    -- Segmen dari invoice 365 hari.
    for n in 1..3 loop
      perform public.buat_invoice(case when n = 2 then 'pt maju jaya' else 'PT Maju Jaya' end, null, jsonb_build_array(jsonb_build_object('uraian', 'Kaos', 'jumlah', 10, 'harga', 50000)), v_hari + 14, null, gen_random_uuid());
    end loop;
    perform public.buat_invoice('Warung Kecil', null, jsonb_build_array(jsonb_build_object('uraian', 'Kaos', 'jumlah', 1, 'harga', 50000)), v_hari + 14, null, gen_random_uuid());
    r := public.customer_segments();
    perform pg_temp.cek('segmen: PT Maju Jaya setia + besar + baru (3 invoice, nama tanpa beda huruf), Warung Kecil baru saja',
      exists (select 1 from jsonb_array_elements(r) e where e ->> 'pelanggan' = c1::text and (e ->> 'invoice')::int = 3
              and e -> 'segmen' @> '["setia", "besar", "baru"]')
      and exists (select 1 from jsonb_array_elements(r) e where e ->> 'nama' = 'Warung Kecil' and e -> 'segmen' = '["baru"]'), r::text);

    -- Admin boleh mengatur; usaha lain terisolasi.
    perform set_config('request.jwt.claims', kd, true);
    perform pg_temp.cek('admin melihat laporan sales', (public.sales_report(v_bln, v_hari) ->> 'menang')::int = 1);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat pelanggan dan deal', (select count(*) from public.customer) = 0 and (select count(*) from public.deal) = 0);
    begin perform public.move_deal(d2, 'menang'); perform pg_temp.cek('usaha lain tidak memindah deal', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memindah deal', true); end;
    begin perform public.save_deal(null, c1, 'Curi pelanggan', 1, null, null); perform pg_temp.cek('usaha lain tidak memakai pelanggan A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai pelanggan A', true); end;
    execute 'reset role';
    perform pg_temp.cek('fungsi app dan RPC tidak untuk anon', not has_function_privilege('authenticated', 'app.wajib_crm()', 'execute')
      and not has_function_privilege('anon', 'public.save_deal(uuid,uuid,text,bigint,uuid,date)', 'execute'));
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
