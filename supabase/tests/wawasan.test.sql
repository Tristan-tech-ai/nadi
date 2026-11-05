-- Tes M-23 wawasan (supabase/migrations/20261105092000_wawasan.sql): angka public.insight_dashboard sama dengan hitungan langsung
-- dari tabel sumber dan RPC laporan_keuangan, contoh tangan turnover, gaji dan karyawan berisiko hanya untuk pemilik (admin mendapat
-- null), staf ditolak, usaha lain tidak melihat angka usaha ini. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kad text; ks text;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; pg uuid; r jsonb; v_hari date; v_awal date; z text; lr jsonb; n_bulan int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ws.a@uji.local'), (ub, 'ws.b@uji.local'), (uc, 'ws.c@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Wawasan', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Wawasan', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    execute 'reset role';
    v_hari := app.hari_ini(pa); v_awal := date_trunc('month', v_hari)::date; z := app.zona(pa);
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pa, uc, 'admin', true);
    kad := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    -- 4 karyawan aktif (2 mulai dalam 12 bulan), 1 keluar 30 hari lalu, 1 pelanggan (bukan karyawan).
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Budi', array['karyawan'], jsonb_build_object('mulai', (v_hari - 100)::text)) returning id into o1;
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Sari', array['karyawan'], jsonb_build_object('mulai', (v_hari - 30)::text)) returning id into o2;
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Dewi', array['karyawan'], jsonb_build_object('mulai', (v_hari - 800)::text)) returning id into o3;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Eko', array['magang']) returning id into o4;
    insert into public.orang (perusahaan_id, nama, jenis, status, data) values (pa, 'Fani', array['karyawan'], 'nonaktif', jsonb_build_object('mulai', (v_hari - 900)::text)) returning id into o5;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Pelanggan Tetap', array['pelanggan']);
    insert into public.berhenti (perusahaan_id, orang_id, tanggal_surat, tanggal_efektif, alasan, status, kunci_klien)
    values (pa, o5, v_hari - 60, v_hari - 30, 'mundur', 'selesai', gen_random_uuid());
    -- Absen: Budi dua kali hari ini, Sari hari ini, Dewi kemarin (dihitung bila masih bulan ini).
    insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, terjadi_at) values
      (pa, 'absen.masuk', 'pwa', o1, (v_hari + time '08:00')::timestamp at time zone z),
      (pa, 'absen.masuk', 'pwa', o1, (v_hari + time '13:00')::timestamp at time zone z),
      (pa, 'absen.masuk', 'pwa', o2, (v_hari + time '08:10')::timestamp at time zone z),
      (pa, 'absen.pulang', 'pwa', o2, (v_hari + time '17:00')::timestamp at time zone z),
      (pa, 'absen.masuk', 'pwa', o3, (v_hari - 1 + time '08:00')::timestamp at time zone z);
    n_bulan := case when v_hari - 1 >= v_awal then 3 else 2 end;
    insert into public.lembur (perusahaan_id, orang_id, tanggal, jenis, jam) values (pa, o1, v_hari, 'hari_kerja', 2), (pa, o2, v_awal, 'hari_kerja', 3),
      (pa, o3, v_awal - 1, 'hari_kerja', 4);
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, (v_awal - interval '1 month')::date, 'disetujui') returning id into pg;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen, bruto, potongan, neto) values
      (pa, pg, o1, '[]', 5000000, 200000, 4800000), (pa, pg, o2, '[]', 4000000, 100000, 3900000);
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, v_awal, 'draf');

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.insight_dashboard();
    lr := public.laporan_keuangan(v_awal, v_hari) -> 'laba_rugi';
    perform pg_temp.cek('aktif 4 (karyawan + magang, tanpa pelanggan dan nonaktif)', (r -> 'hr' ->> 'aktif')::int = 4, r::text);
    perform pg_temp.cek('masuk 12 bulan 2, keluar 12 bulan 1', (r -> 'hr' ->> 'masuk_12')::int = 2 and (r -> 'hr' ->> 'keluar_12')::int = 1, r::text);
    -- Contoh tangan: aktif 12 bulan lalu = 4 - 2 + 1 = 3; rata-rata (4 + 3) / 2 = 3,5; 1 / 3,5 = 28,6%.
    perform pg_temp.cek('turnover 28,6%', (r -> 'hr' ->> 'turnover_persen')::numeric = 28.6, r::text);
    perform pg_temp.cek('hadir hari ini 2 orang, bulan ini orang-hari sesuai', (r -> 'hr' ->> 'hadir_hari_ini')::int = 2 and (r -> 'hr' ->> 'hadir_bulan')::int = n_bulan, r::text);
    perform pg_temp.cek('lembur bulan ini 5 jam (bulan lalu tidak ikut)', (r -> 'hr' ->> 'lembur_jam_bulan')::int = 5, r::text);
    perform pg_temp.cek('gaji dari periode disetujui terakhir: bruto 9.000.000, neto 8.700.000, 2 orang', (r -> 'hr' -> 'gaji' ->> 'bruto')::bigint = 9000000
      and (r -> 'hr' -> 'gaji' ->> 'neto')::bigint = 8700000 and (r -> 'hr' -> 'gaji' ->> 'orang')::int = 2 and r -> 'hr' -> 'gaji' ->> 'bulan' = to_char(v_awal - interval '1 month', 'YYYY-MM'), r::text);
    perform pg_temp.cek('pemilik mendapat daftar berisiko (array)', jsonb_typeof(r -> 'hr' -> 'berisiko') = 'array', r::text);
    perform pg_temp.cek('penjualan bulan ini sama dengan laporan_keuangan', (r -> 'bisnis' ->> 'pendapatan_bulan')::bigint = coalesce((lr ->> 'pendapatan')::bigint, 0)
      and (r -> 'bisnis' ->> 'laba_bulan')::bigint = coalesce((lr ->> 'laba')::bigint, 0), r::text);
    perform pg_temp.cek('invoice terbuka sama dengan tabel invoice', (r -> 'bisnis' -> 'invoice_terbuka' ->> 'jumlah')::int = (select count(*) from public.invoice where status = 'terbit'), r::text);

    perform set_config('request.jwt.claims', kad, true);
    r := public.insight_dashboard();
    perform pg_temp.cek('admin melihat angka HR tanpa gaji dan daftar berisiko', (r -> 'hr' ->> 'aktif')::int = 4 and r -> 'hr' -> 'gaji' = 'null'::jsonb and r -> 'hr' -> 'berisiko' = 'null'::jsonb, r::text);

    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, orang_id, peran, aktif) select pa, ub, o4, 'staf', true;
    execute 'set local role authenticated';
    ks := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.insight_dashboard(); perform pg_temp.cek('staf ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf ditolak', true); end;

    perform set_config('request.jwt.claims', kb, true);
    r := public.insight_dashboard();
    perform pg_temp.cek('usaha lain hanya melihat angkanya sendiri (kosong)', (r -> 'hr' ->> 'aktif')::int = 0 and (r -> 'hr' ->> 'hadir_hari_ini')::int = 0
      and r -> 'hr' -> 'gaji' = 'null'::jsonb and r -> 'hr' -> 'turnover_persen' = 'null'::jsonb, r::text);
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    begin perform public.insight_dashboard(); perform pg_temp.cek('anon tidak memanggil', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak memanggil', true); end;
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
