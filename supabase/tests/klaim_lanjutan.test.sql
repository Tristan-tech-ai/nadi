-- Tes M-18B uang harian per kota: tarif per kota dan '*' diatur pengelola (staf ditolak); pengajuan dinas mencatat tarif kota
-- terpanjang yang cocok dengan tujuan, lalu '*'; disetujui = satu klaim uang harian disetujui + jurnal 6-930/2-160 (tidak ganda);
-- ditolak = tanpa klaim; tarif nonaktif tidak dipakai; uang harian ikut dipotong uang muka saat selesai; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); u1 uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; k1 text; o1 uuid; hari date; r jsonb; d1 uuid; d2 uuid; d3 uuid; d4 uuid; us uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'uh-a@uji.local'), (ub, 'uh-b@uji.local'), (u1, 'uh-1@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uang Harian A', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uang Harian B', 'toko');
    execute 'reset role';
    hari := app.hari_ini(pa);
    insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Sales Dinas', array['karyawan'], u1) returning id into o1;
    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, u1, 'staf', o1);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    k1 := json_build_object('sub', u1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.atur_uang_harian('  Surabaya ', 350000);
    perform pg_temp.cek('tarif kota disimpan huruf kecil', r ->> 'kota' = 'surabaya' and (r ->> 'nominal')::int = 350000, r::text);
    perform public.atur_uang_harian('Surabaya Barat', 400000);
    perform public.atur_uang_harian('*', 200000);
    begin perform public.atur_uang_harian('Bali', 500); perform pg_temp.cek('nominal di bawah Rp1.000 ditolak', false);
    exception when others then perform pg_temp.cek('nominal di bawah Rp1.000 ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_uang_harian('X', 100000); perform pg_temp.cek('nama kota 1 huruf ditolak', false);
    exception when others then perform pg_temp.cek('nama kota 1 huruf ditolak', sqlstate = '22023', sqlerrm); end;

    perform set_config('request.jwt.claims', k1, true);
    begin perform public.atur_uang_harian('Jakarta', 300000); perform pg_temp.cek('staf tidak mengatur tarif', false);
    exception when others then perform pg_temp.cek('staf tidak mengatur tarif', sqlstate = '42501', sqlerrm); end;
    perform pg_temp.cek('staf bisa membaca tarif', (select count(*) from public.uang_harian) = 3);
    r := public.ajukan_dinas('Kantor cabang Surabaya Barat', hari - 2, hari, 'Stok opname cabang', 500000, md5('uh1')::uuid);
    d1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('kota terpanjang yang cocok dipakai: 3 hari x Rp400.000', (r ->> 'uang_harian')::int = 1200000, r::text);
    d2 := (public.ajukan_dinas('Malang', hari - 1, hari, 'Kunjungan pemasok', 0, md5('uh2')::uuid) ->> 'id')::uuid;
    d3 := (public.ajukan_dinas('Malang', hari, hari, 'Rapat', 0, md5('uh3')::uuid) ->> 'id')::uuid;
    execute 'reset role';
    perform pg_temp.cek('tarif kota lain untuk Malang: 2 x Rp200.000', (select uang_harian_kota = '*' and uang_harian_tarif = 200000 and uang_harian_hari = 2 from public.perjalanan_dinas where id = d2));
    perform pg_temp.cek('usulan menyebut uang harian', (select penjelasan like '%uang harian 3 hari x Rp400.000 = Rp1.200.000 (tarif Surabaya Barat)%' and dampak_rp = 1700000 from public.usulan where payload ->> 'dinas_id' = d1::text),
      (select penjelasan from public.usulan where payload ->> 'dinas_id' = d1::text));

    -- Disetujui pemilik: klaim uang harian otomatis, jurnal sekali.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    select id into us from public.usulan where payload ->> 'dinas_id' = d1::text;
    perform public.putuskan_usulan(us, true);
    execute 'reset role';
    perform pg_temp.cek('klaim uang harian disetujui', (select count(*) = 1 and min(jumlah) = 1200000 and min(status) = 'disetujui' from public.klaim where perjalanan_id = d1));
    perform pg_temp.cek('jurnal D 6-930 / K 2-160', (select sum(b.debit) from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id
      where j.perusahaan_id = pa and j.sumber = 'klaim' and a.kode = '6-930') = 1200000
      and (select sum(b.kredit) from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id
      where j.perusahaan_id = pa and j.sumber = 'klaim' and a.kode = '2-160') = 1200000);
    perform pg_temp.cek('kategori uang harian dibuat tanpa wajib struk', (select not butuh_struk and akun = '6-930' from public.kategori_klaim where perusahaan_id = pa and nama = 'Uang harian perjalanan dinas'));
    -- Ditolak: tanpa klaim.
    execute 'set local role authenticated';
    select id into us from public.usulan where payload ->> 'dinas_id' = d2::text;
    perform public.putuskan_usulan(us, false);
    execute 'reset role';
    perform pg_temp.cek('ditolak: tanpa klaim uang harian', not exists (select 1 from public.klaim where perjalanan_id = d2));

    -- Uang muka dibayar, lalu selesai: uang harian dipotong uang muka (sisa klaim 700.000).
    execute 'set local role authenticated';
    perform public.bayar_uang_muka_dinas(d1, 'bank');
    r := public.selesaikan_dinas(d1);
    perform pg_temp.cek('uang harian dipotong uang muka saat selesai', (r ->> 'dipotong')::int = 500000 and (r ->> 'sisa_klaim')::int = 700000 and (r ->> 'kasbon')::int = 0, r::text);

    -- Tarif kota lain dinonaktifkan: Bandung tanpa uang harian.
    perform public.atur_uang_harian('*', null);
    perform set_config('request.jwt.claims', k1, true);
    d4 := (public.ajukan_dinas('Bandung', hari, hari, 'Pameran', 0, md5('uh4')::uuid) ->> 'id')::uuid;
    execute 'reset role';
    perform pg_temp.cek('tarif nonaktif tidak dipakai', (select uang_harian_tarif = 0 and uang_harian_hari = 0 from public.perjalanan_dinas where id = d4));

    -- Isolasi.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha B tidak melihat tarif A', (select count(*) from public.uang_harian) = 0);
    begin insert into public.uang_harian (perusahaan_id, kota, nominal) values (pa, 'jakarta', 100000); perform pg_temp.cek('tulis langsung ditolak', false);
    exception when others then perform pg_temp.cek('tulis langsung ditolak', sqlstate = '42501', sqlerrm); end;
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
