-- Tes M-22 tanya data (supabase/migrations/20261105094000_tanya_data.sql): jawaban ask_data sama dengan sumber (laporan_keuangan,
-- umur_piutang, tabel), niat di luar daftar ditolak, staf ditolak, gaji hanya pemilik, kuota 200 per hari, dan 0 data usaha lain
-- (usaha B dengan data berbeda tidak pernah muncul di jawaban usaha A dan sebaliknya). Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kad text; ks text;
  o1 uuid; ob uuid; pr uuid; prb uuid; r jsonb; lr jsonb; v_hari date; v_awal date; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'td.a@uji.local'), (ub, 'td.b@uji.local'), (uc, 'td.c@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Tanya', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Tanya', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Budi', array['karyawan']) returning id into o1;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Sari', array['karyawan']), (pa, 'Eko', array['magang']);
    perform public.buat_akun_staf(o1, '550001');
    execute 'reset role';
    v_hari := app.hari_ini(pa); v_awal := date_trunc('month', v_hari)::date;
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pa, uc, 'admin', true);
    kad := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o1;
    -- Usaha B: data berbeda supaya kebocoran terlihat.
    insert into public.orang (perusahaan_id, nama, jenis) select pb, 'Orang B ' || g, array['karyawan'] from generate_series(1, 7) g;
    insert into public.produk (perusahaan_id, kode, nama, satuan) values (pa, 'GP1', 'Gula Pasir', 'kg') returning id into pr;
    insert into public.produk (perusahaan_id, kode, nama, satuan) values (pb, 'GP9', 'Gula Pasir Rahasia', 'kg') returning id into prb;
    insert into public.stok (perusahaan_id, produk_id, gudang_id, jumlah, nilai) values (pa, pr, app.gudang_utama(pa), 12, 180000);
    insert into public.stok (perusahaan_id, produk_id, gudang_id, jumlah, nilai) values (pb, prb, app.gudang_utama(pb), 999, 1);
    insert into public.lembur (perusahaan_id, orang_id, tanggal, jenis, jam) values (pa, o1, v_hari, 'hari_kerja', 3);
    insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, terjadi_at) values (pa, 'absen.masuk', 'pwa', o1, now());

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    lr := public.laporan_keuangan(v_awal, v_hari) -> 'laba_rugi';
    r := public.ask_data('pendapatan', null, null, null);
    perform pg_temp.cek('pendapatan bawaan bulan ini = laporan_keuangan, tautan ke laba rugi', (r ->> 'nilai')::numeric = (lr ->> 'pendapatan')::numeric
      and r ->> 'dari' = v_awal::text and r ->> 'sumber' = '/app/buku?jenis=laba_rugi&dari=' || v_awal || '&sampai=' || v_hari, r::text);
    r := public.ask_data('laba', v_awal, v_hari + 30, null);
    perform pg_temp.cek('sampai di masa depan dipotong ke hari ini', r ->> 'sampai' = v_hari::text and (r ->> 'nilai')::numeric = (lr ->> 'laba')::numeric, r::text);
    r := public.ask_data('piutang', null, null, null);
    perform pg_temp.cek('piutang = umur_piutang total', (r ->> 'nilai')::numeric = (public.umur_piutang(v_hari) -> 'kelompok' ->> 'total')::numeric, r::text);
    r := public.ask_data('karyawan', null, null, null);
    perform pg_temp.cek('karyawan aktif 3 (usaha B yang 7 tidak ikut)', (r ->> 'nilai')::int = 3 and r ->> 'sumber' = '/app/orang', r::text);
    r := public.ask_data('stok', null, null, 'gula');
    perform pg_temp.cek('stok gula = 12 kg, barang usaha B tidak muncul', (r ->> 'nilai')::numeric = 12 and r ->> 'satuan' = 'kg' and jsonb_array_length(r -> 'rincian') = 1
      and r::text not like '%Rahasia%', r::text);
    r := public.ask_data('lembur', null, null, null);
    perform pg_temp.cek('lembur bulan ini 3 jam', (r ->> 'nilai')::int = 3, r::text);
    r := public.ask_data('hadir', v_hari, v_hari, null);
    perform pg_temp.cek('hadir hari ini 1 orang', (r ->> 'nilai')::int = 1, r::text);
    r := public.ask_data('invoice_terbit', null, null, null);
    perform pg_temp.cek('invoice terbit = hitungan tabel', (r ->> 'jumlah')::int = (select count(*) from public.invoice where status <> 'batal' and tanggal between v_awal and v_hari), r::text);
    r := public.ask_data('hutang', null, null, null);
    perform pg_temp.cek('hutang = sisa tagihan pemasok terbuka', (r ->> 'nilai')::numeric = (select coalesce(sum(total - terbayar - dikurangi), 0) from public.tagihan_beli where status = 'terbuka'), r::text);
    r := public.ask_data('gaji', null, null, null);
    perform pg_temp.cek('pemilik boleh bertanya gaji', r ->> 'satuan' = 'rupiah', r::text);
    begin perform public.ask_data('drop table', null, null, null); perform pg_temp.cek('niat di luar daftar ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('niat di luar daftar ditolak', true); end;
    begin perform public.ask_data('stok', null, null, 'g'); perform pg_temp.cek('stok tanpa nama barang ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('stok tanpa nama barang ditolak', true); end;

    perform set_config('request.jwt.claims', kad, true);
    begin perform public.ask_data('gaji', null, null, null); perform pg_temp.cek('admin tidak bertanya gaji', false);
    exception when sqlstate '42501' then perform pg_temp.cek('admin tidak bertanya gaji', true); end;
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.ask_data('pendapatan', null, null, null); perform pg_temp.cek('staf ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf ditolak', true); end;

    perform set_config('request.jwt.claims', kb, true);
    r := public.ask_data('karyawan', null, null, null);
    perform pg_temp.cek('usaha B: karyawan 7', (r ->> 'nilai')::int = 7, r::text);
    r := public.ask_data('stok', null, null, 'gula');
    perform pg_temp.cek('usaha B: stok gulanya sendiri saja', (r ->> 'nilai')::numeric = 999 and r::text not like '%GP1%', r::text);
    r := public.ask_data('lembur', null, null, null);
    perform pg_temp.cek('usaha B: lembur usaha A tidak terlihat', (r ->> 'nilai')::int = 0, r::text);
    perform pg_temp.cek('usaha B tidak membaca log tanya usaha A', (select count(*) from public.ask_log) = 3);

    -- Kuota.
    execute 'reset role';
    insert into public.ask_log (perusahaan_id, niat) select pa, 'kas' from generate_series(1, 200);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.ask_data('kas', null, null, null); perform pg_temp.cek('kuota 200 per hari', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kuota 200 per hari', true); end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.ask_data('kas', null, null, null);
    perform pg_temp.cek('kuota usaha A tidak menghabiskan kuota usaha B', r ->> 'niat' = 'kas', r::text);
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
