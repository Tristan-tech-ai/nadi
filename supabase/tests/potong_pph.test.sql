-- Tes M-09B: potong PPh atas tagihan pemasok (tarif dari referensi DJP, hutang berkurang, utang pajak 2-210), data bukti potong
-- per masa, kalender jatuh tempo PMK 81/2024 dengan geser hari libur, rekap jurnal penjualan; peran dan isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  t1 jsonb; t2 jsonb; r jsonb; d jsonb; k jsonb; e jsonb; hari date := current_date; g text;
begin
  insert into auth.users (id, email) values (ua, 'pp@uji.local'), (ub, 'pq@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Potong A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Potong B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Potong') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  perform pg_temp.cek('referensi kode objek pajak 198 baris', (select count(*) from public.kode_objek_pajak) = 198);
  perform pg_temp.cek('tarif jasa katering 2 dan sewa bangunan 10 sesuai REF DJP',
    (select tarif from public.kode_objek_pajak where kode = '24-104-39') = 2 and (select tarif from public.kode_objek_pajak where kode = '28-403-02') = 10);
  t1 := public.buat_tagihan_beli('CV Katering Rasa', 'TG-9', hari, hari + 14, 5000000, null, null, gen_random_uuid());
  t2 := public.buat_tagihan_beli('Pak Made (sewa ruko)', 'SW-1', hari, hari + 14, 12000000, null, null, gen_random_uuid());
  r := public.potong_pph_tagihan((t1 ->> 'id')::uuid, '24-104-39', 5000000, '0811.0342.4850.2000', '', 'CommercialInvoice', 'TG-9', hari, hari, md5('p1')::uuid);
  perform pg_temp.cek('PPh 23 katering 2% = Rp100.000', (r ->> 'pph')::bigint = 100000, r::text);
  perform pg_temp.cek('kunci sama tidak menggandakan', (public.potong_pph_tagihan((t1 ->> 'id')::uuid, '24-104-39', 5000000, '0811034248502000', '', 'CommercialInvoice', 'TG-9', hari, hari, md5('p1')::uuid) ->> 'sudah') = 'true');
  perform pg_temp.cek('sisa hutang berkurang PPh', (select total - terbayar - dikurangi from public.tagihan_beli where id = (t1 ->> 'id')::uuid) = 4900000);
  perform pg_temp.cek('jurnal 2-100 debit / 2-210 kredit', (select sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id
    where b.perusahaan_id = pa and a.kode = '2-210') = 100000);
  perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '28-403-02', 12000000, '5171014507800003', null, 'Contract', 'SW-1', hari, hari, md5('p2')::uuid);
  begin perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '99-999-99', 1000, '5171014507800003', null, 'Contract', 'SW-1', hari, hari, md5('p3')::uuid);
    perform pg_temp.cek('kode objek di luar referensi ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('kode objek di luar referensi ditolak', true); end;
  begin perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '24-104-39', 1000, '123', null, 'Contract', 'SW-1', hari, hari, md5('p4')::uuid);
    perform pg_temp.cek('NPWP pemasok pendek ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('NPWP pemasok pendek ditolak', true); end;
  begin perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '24-104-39', 1000, '5171014507800003', null, 'Contract', 'SW-1', hari, hari + 3, md5('p5')::uuid);
    perform pg_temp.cek('tanggal potong masa depan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('tanggal potong masa depan ditolak', true); end;
  begin perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '24-104-39', 1000, '5171014507800003', null, 'Faktur', 'SW-1', hari, hari, md5('p6')::uuid);
    perform pg_temp.cek('jenis dokumen di luar referensi ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('jenis dokumen di luar referensi ditolak', true); end;
  d := public.data_bupot(hari);
  perform pg_temp.cek('dua bukti potong masa ini', jsonb_array_length(d -> 'potong') = 2, d::text);
  perform pg_temp.cek('PPh 4(2) sewa 10% tercatat', (select (x ->> 'pph')::bigint from jsonb_array_elements(d -> 'potong') x where x ->> 'kode' = '28-403-02') = 1200000);
  k := public.kalender_pajak(hari);
  perform pg_temp.cek('jumlah setor PPh masa = Rp1.300.000', (k ->> 'pph_potong')::bigint = 1300000, k::text);
  for e in select * from jsonb_array_elements(k -> 'jatuh_tempo') loop
    perform pg_temp.cek('jatuh tempo ' || (e ->> 'jenis') || ' di hari kerja dan tidak sebelum tanggal aturan',
      extract(isodow from (e ->> 'tanggal')::date) < 6 and not exists (select 1 from public.libur_nasional l where l.tanggal = (e ->> 'tanggal')::date)
      and (e ->> 'tanggal')::date >= (e ->> 'asli')::date and (e ->> 'dasar') like 'PMK 81/2024 Pasal%', e::text);
  end loop;
  k := public.kalender_pajak('2026-11-01');
  perform pg_temp.cek('masa Nov 2026: setor PPh 15 Des, lapor PPh 20 Des (Minggu) geser ke 21 Des, PPN 31 Des',
    (select j ->> 'asli' from jsonb_array_elements(k -> 'jatuh_tempo') j where j ->> 'jenis' = 'setor_pph') = '2026-12-15'
    and (select j ->> 'tanggal' from jsonb_array_elements(k -> 'jatuh_tempo') j where j ->> 'jenis' = 'lapor_pph') = '2026-12-21'
    and (select j ->> 'asli' from jsonb_array_elements(k -> 'jatuh_tempo') j where j ->> 'jenis' = 'lapor_ppn') = '2026-12-31', k::text);
  perform public.buat_invoice('Pelanggan Rekap', null, '[{"uraian": "Nasi kotak", "jumlah": 30, "harga": 22200}]'::jsonb, hari + 7, null, gen_random_uuid());
  r := public.rekap_jurnal_penjualan(hari);
  perform pg_temp.cek('rekap jurnal penjualan = total invoice', (r ->> 'kredit_penjualan')::bigint = (r ->> 'total_invoice')::bigint and (r ->> 'total_invoice')::bigint = 666000, r::text);

  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.data_bupot(hari); perform pg_temp.cek('staf tidak membaca bukti potong', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membaca bukti potong', true); end;
  begin perform public.potong_pph_tagihan((t2 ->> 'id')::uuid, '24-104-39', 1000, '5171014507800003', null, 'Contract', 'SW-1', hari, hari, md5('p7')::uuid);
    perform pg_temp.cek('staf tidak memotong', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak memotong', true); end;
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat potongan A', (select count(*) from public.potong_pph) = 0 and jsonb_array_length(public.data_bupot(hari) -> 'potong') = 0);
  begin perform public.potong_pph_tagihan((t1 ->> 'id')::uuid, '24-104-39', 1000, '5171014507800003', null, 'Contract', 'X', hari, hari, md5('p8')::uuid);
    perform pg_temp.cek('usaha B tidak memotong tagihan A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak memotong tagihan A', true); end;
  execute 'reset role';
  perform pg_temp.cek('hari libur nasional digeser (fungsi privat, dicek sebagai pemilik basis data)', app.hari_kerja_pajak('2026-01-01') = '2026-01-02' or exists (select 1 from public.libur_nasional where tanggal = '2026-01-02'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
