-- Tes W-07A tagihan berulang (supabase/migrations/20261105085000_tagihan_berulang.sql): tanggal periode aman akhir bulan, tepat satu
-- invoice per periode (job dua kali tetap satu), periode tertinggal sejak mulai disusul, jeda tidak terbit dan lanjut melompati periode
-- jeda, berhenti saat tanggal selesai, pembuat yang kehilangan peran mencatat galat, staf dan usaha lain ditolak. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  r1 uuid; r2 uuid; r3 uuid; v_hari date; n int; k uuid := gen_random_uuid();
  baris jsonb := '[{"uraian": "Sewa kamar 3 bulan", "jumlah": 1, "harga": 1500000}]';
begin
  begin
    perform pg_temp.cek('akhir bulan aman: 31 Jan > 28 Feb > 31 Mar > 30 Apr', app.recurring_period(date '2027-01-31', 1, 1) = date '2027-02-28'
      and app.recurring_period(date '2027-01-31', 1, 2) = date '2027-03-31' and app.recurring_period(date '2027-01-31', 1, 3) = date '2027-04-30');
    perform pg_temp.cek('tiap 3 bulan dari 30 Nov: 28 Feb (2028 kabisat 29 Feb)', app.recurring_period(date '2026-11-30', 3, 1) = date '2027-02-28'
      and app.recurring_period(date '2027-11-30', 3, 1) = date '2028-02-29');

    insert into auth.users (id, email) values (ua, 'tb.a@uji.local'), (ub, 'tb.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Kos Uji Berulang', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Berulang', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Penjaga Kos') returning id into o_s;
    perform public.buat_akun_staf(o_s, '898989');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- Kamar 1: mulai 2 bulan lalu, tiap bulan = 3 periode (2 bulan lalu, bulan lalu, hari ini) terbit sekaligus.
    r1 := public.save_recurring_invoice(jsonb_build_object('pelanggan', 'Rina (kamar 1)', 'hp', '6281234500011', 'baris', '[{"uraian": "Sewa kamar 1", "jumlah": 1, "harga": 750000}]'::jsonb,
      'tiap', 1, 'mulai', (v_hari - interval '2 months')::date, 'tempo', 5, 'catatan', 'Kos Melati.'), k);
    perform pg_temp.cek('kunci sama = jadwal sama', public.save_recurring_invoice(jsonb_build_object('pelanggan', 'x', 'baris', '[]', 'tiap', 1, 'mulai', v_hari), k) = r1);
    n := public.run_recurring_invoices();
    perform pg_temp.cek('3 periode tertinggal terbit: 3 invoice', n = 3 and (select count(*) from public.invoice where pelanggan = 'Rina (kamar 1)') = 3, n::text);
    n := public.run_recurring_invoices();
    perform pg_temp.cek('dijalankan lagi: tidak ada invoice ganda', n = 0 and (select count(*) from public.invoice where pelanggan = 'Rina (kamar 1)') = 3);
    perform pg_temp.cek('periode berikutnya = mulai + 3 bulan, total 2.250.000', (select next_date from public.recurring_invoice where id = r1) = (v_hari - interval '2 months' + interval '3 months')::date
      and (select runs from public.recurring_invoice where id = r1) = 3 and (select sum(total) from public.invoice where pelanggan = 'Rina (kamar 1)') = 2250000);
    perform pg_temp.cek('invoice berisi periode, HP, jatuh tempo >= hari ini', (select bool_and(catatan like 'Kos Melati. Tagihan periode %' and pelanggan_hp = '6281234500011' and jatuh_tempo >= v_hari)
      from public.invoice where pelanggan = 'Rina (kamar 1)'));
    perform pg_temp.cek('piutang 1-200 dijurnal untuk tiap invoice', (select count(*) from public.invoice where pelanggan = 'Rina (kamar 1)' and jurnal_terbit is not null) = 3);

    -- Jeda: tidak terbit walau sudah jatuh tempo; dilanjutkan melompati periode jeda.
    perform public.set_recurring_invoice_status(r1, 'jeda');
    execute 'reset role';
    n := app.issue_recurring_invoices(pa, v_hari + 70);
    perform pg_temp.cek('jeda: tidak ada invoice baru', n = 0 and (select count(*) from public.invoice where pelanggan = 'Rina (kamar 1)') = 3);
    update public.recurring_invoice set next_date = (v_hari - interval '1 month')::date, runs = 1 where id = r1;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.set_recurring_invoice_status(r1, 'aktif');
    perform pg_temp.cek('lanjut: periode yang lewat selama jeda dilompati', (select next_date from public.recurring_invoice where id = r1) >= v_hari
      and (select status from public.recurring_invoice where id = r1) = 'aktif');

    -- Kamar 2: mulai hari ini, selesai 45 hari lagi: dua periode lalu selesai.
    r2 := public.save_recurring_invoice(jsonb_build_object('pelanggan', 'Bagus (kamar 2)', 'baris', '[{"uraian": "Sewa kamar 2", "jumlah": 1, "harga": 800000}]'::jsonb,
      'tiap', 1, 'mulai', v_hari, 'sampai', v_hari + 45), gen_random_uuid());
    execute 'reset role';
    n := app.issue_recurring_invoices(pa, v_hari + 100);
    perform pg_temp.cek('berhenti di tanggal selesai: 2 invoice, status selesai', (select count(*) from public.invoice where pelanggan = 'Bagus (kamar 2)') = 2
      and (select status from public.recurring_invoice where id = r2) = 'selesai');

    -- Baris rusak: galat dicatat, jadwal lain tetap jalan.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r3 := public.save_recurring_invoice(jsonb_build_object('pelanggan', 'Rusak', 'baris', '[{"uraian": "", "jumlah": 1, "harga": 5}]'::jsonb, 'tiap', 1, 'mulai', v_hari), gen_random_uuid());
    n := public.run_recurring_invoices();
    perform pg_temp.cek('baris rusak: galat tercatat di jadwal, tanpa invoice', (select galat from public.recurring_invoice where id = r3) is not null
      and (select count(*) from public.invoice where pelanggan = 'Rusak') = 0);

    -- Peran dan isolasi.
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.save_recurring_invoice(jsonb_build_object('pelanggan', 'x', 'baris', baris, 'tiap', 1, 'mulai', v_hari), gen_random_uuid()); perform pg_temp.cek('staf tidak membuat tagihan berulang', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat tagihan berulang', true); end;
    perform pg_temp.cek('staf tidak membaca jadwal', (select count(*) from public.recurring_invoice) = 0);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat jadwal A', (select count(*) from public.recurring_invoice) = 0);
    begin perform public.set_recurring_invoice_status(r1, 'jeda'); perform pg_temp.cek('usaha lain tidak menjeda jadwal A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak menjeda jadwal A', true); end;
    begin perform public.save_recurring_invoice(jsonb_build_object('pelanggan', 'x', 'baris', baris, 'tiap', 2, 'mulai', v_hari), gen_random_uuid()); perform pg_temp.cek('tiap 2 bulan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tiap 2 bulan ditolak', true); end;

    -- Pembuat kehilangan peran: jadwal mencatat galat, tidak terbit.
    execute 'reset role';
    update public.recurring_invoice set next_date = v_hari, status = 'aktif', end_date = null where id = r2;
    update public.anggota set peran = 'staf' where perusahaan_id = pa and user_id = ua;
    n := app.issue_recurring_invoices(pa, v_hari);
    perform pg_temp.cek('pembuat bukan pengelola lagi: galat, tanpa invoice baru', (select galat from public.recurring_invoice where id = r2) like '%Hanya pemilik%'
      and (select count(*) from public.invoice where pelanggan = 'Bagus (kamar 2)') = 2, (select galat from public.recurring_invoice where id = r2));
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
