-- Tes M-10B: cicilan kasbon lewat slip (sisa berkurang saat periode disetujui, tertua dulu, jurnal 6-100 / 1-150, tidak melebihi
-- sisa, batas Pasal 65 tetap), THR harian lepas Permenaker 6/2016 Pasal 3 ayat (3), rekening karyawan (hash, Gerbang Gaji), isolasi.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; o1 uuid; o2 uuid; o5 uuid; o6 uuid; o7 uuid;
  k1 uuid; k2 uuid; per1 uuid; per2 uuid; h jsonb; g text; i int; v bigint;
begin
  insert into auth.users (id, email) values (ua, 'kb1@uji.local'), (ub, 'kb2@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Kasbon A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Kasbon B', 'fnb');
  execute 'reset role';
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Sari Kasbon', array['karyawan'], '{"mulai": "2024-01-15"}') returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Budi Rekening', array['karyawan'], '{"mulai": "2024-02-01"}') returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Ketut Harian', array['karyawan'], '{"mulai": "2025-01-10"}') returning id into o5;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Nyoman Harian Baru', array['karyawan'], '{"mulai": "2026-09-05"}') returning id into o6;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Putu Harian Kosong', array['karyawan'], '{"mulai": "2026-01-05"}') returning id into o7;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values
    (o1, pa, '{"pokok": 3000000}'), (o2, pa, '{"pokok": 2800000}'),
    (o5, pa, '{"pokok": 2000000, "harian_lepas": true}'), (o6, pa, '{"pokok": 1800000, "harian_lepas": true}'), (o7, pa, '{"pokok": 1500000, "harian_lepas": true}');

  -- Rekening: hash dan 4 angka akhir diisi trigger; format salah ditolak; rekening sama ditandai Gerbang Gaji.
  update public.orang_rahasia set bank = 'CIMB NIAGA', rekening = '800153423700', atas_nama = 'SARI KASBON' where orang_id = o1;
  perform pg_temp.cek('rekening: 4 angka akhir dan hash terisi', (select rekening_akhir = '3700' and length(rekening_hash) = 64 from public.orang_rahasia where orang_id = o1));
  begin update public.orang_rahasia set rekening = '12ab34' where orang_id = o2; perform pg_temp.cek('rekening bukan angka ditolak', false);
  exception when check_violation then perform pg_temp.cek('rekening bukan angka ditolak', true); end;
  update public.orang_rahasia set bank = 'CIMB NIAGA', rekening = '800153423700', atas_nama = 'BUDI' where orang_id = o2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('Gerbang Gaji menandai rekening sama untuk dua orang',
    (select count(*) from public.gerbang_gaji('2027-05-31') where kode = 'rekening_ganda' and orang_id in (o1, o2)) = 2);
  update public.orang_rahasia set rekening = '800153423711' where orang_id = o2;
  perform pg_temp.cek('rekening diganti lewat RLS pemilik: tanda ganda hilang', not exists (select 1 from public.gerbang_gaji('2027-05-31') where kode = 'rekening_ganda'));
  execute 'reset role';

  -- Kasbon: dua kasbon Sari (tertua dulu), cicilan lewat slip dua bulan.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  k1 := (public.beri_kasbon(o1, 1000000, 400000, 'tunai', 'Biaya sekolah', md5('kb-k1')::uuid) ->> 'id')::uuid;
  execute 'reset role';
  update public.kasbon set tanggal = tanggal - 10 where id = k1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  k2 := (public.beri_kasbon(o1, 300000, 100000, 'transfer', 'Servis motor', md5('kb-k2')::uuid) ->> 'id')::uuid;
  execute 'reset role';
  insert into public.periode_gaji (perusahaan_id, bulan) values (pa, '2027-05-01') returning id into per1;
  insert into public.periode_gaji (perusahaan_id, bulan) values (pa, '2027-06-01') returning id into per2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.simpan_slip(per1, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "label": "Cicilan kasbon", "jenis": "potongan", "nilai": 1400000}]');
    perform pg_temp.cek('cicilan melebihi sisa kasbon ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('cicilan melebihi sisa kasbon ditolak', g like '%melebihi sisa kasbon%', g); end;
  begin
    perform public.simpan_slip(per1, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "label": "Cicilan kasbon", "jenis": "potongan", "nilai": 400000}, {"kode": "denda", "label": "Denda", "jenis": "potongan", "nilai": 1200000}]');
    perform pg_temp.cek('cicilan + denda di atas 50% tetap ditolak (Pasal 65)', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('cicilan + denda di atas 50% tetap ditolak (Pasal 65)', g like '%Pasal 65%', g); end;
  perform public.simpan_slip(per1, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "label": "Cicilan kasbon", "jenis": "potongan", "nilai": 400000}]');
  perform pg_temp.cek('draf slip tidak mengubah sisa kasbon', (select sum(sisa) from public.kasbon where orang_id = o1) = 1300000);
  perform public.setujui_periode_gaji(per1);
  perform pg_temp.cek('disetujui: kasbon tertua berkurang 400.000', (select sisa from public.kasbon where id = k1) = 600000 and (select sisa from public.kasbon where id = k2) = 300000);
  perform pg_temp.cek('kasbon_bayar satu baris untuk slip itu', (select count(*) = 1 and sum(nilai) = 400000 from public.kasbon_bayar where periode_id = per1));
  perform pg_temp.cek('jurnal D 6-100 / K 1-150 sebesar cicilan',
    (select sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id join public.jurnal j on j.id = b.jurnal_id where b.perusahaan_id = pa and a.kode = '1-150' and j.sumber_id = per1::text) = 400000
    and (select sum(b.debit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id join public.jurnal j on j.id = b.jurnal_id where b.perusahaan_id = pa and a.kode = '6-100' and j.sumber_id = per1::text) = 400000);
  begin perform public.setujui_periode_gaji(per1); perform pg_temp.cek('periode disetujui dua kali ditolak (sisa tidak dipotong lagi)', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('periode disetujui dua kali ditolak (sisa tidak dipotong lagi)', (select sisa from public.kasbon where id = k1) = 600000); end;
  perform public.simpan_slip(per2, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "label": "Cicilan kasbon", "jenis": "potongan", "nilai": 700000}]');
  perform public.setujui_periode_gaji(per2);
  perform pg_temp.cek('bulan 2: kasbon tertua lunas, sisanya dari kasbon kedua', (select sisa from public.kasbon where id = k1) = 0 and (select sisa from public.kasbon where id = k2) = 200000);
  perform pg_temp.cek('bulan 2: dua baris kasbon_bayar 600.000 + 100.000', (select count(*) = 2 and sum(nilai) = 700000 from public.kasbon_bayar where periode_id = per2));
  perform pg_temp.cek('saldo 1-150 = sisa kasbon', (select sum(b.debit) - sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-150') = 200000);
  execute 'reset role';

  -- THR harian lepas: slip disetujui 12 bulan sebelum Hari Raya 20 Mar 2027 (Mar 2026 s.d. Feb 2027).
  for i in 0..11 loop
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, ('2026-03-01'::date + make_interval(months => i))::date, 'disetujui')
      on conflict (perusahaan_id, bulan) do nothing;
  end loop;
  -- Ketut (masa >= 12 bulan): 11 bulan bekerja (Agustus kosong): 5 x 2.000.000 + 6 x (2.400.000 + tunjangan 200.000) = 25.600.000; lembur tidak dihitung.
  for i in 0..11 loop
    continue when i = 5;
    v := case when i < 6 then 2000000 else 2400000 end;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen)
    select pa, p.id, o5, jsonb_build_array(jsonb_build_object('kode', 'pokok', 'label', 'Upah', 'jenis', 'pendapatan', 'nilai', v))
           || case when i >= 6 then '[{"kode": "tunjangan_tetap", "label": "Tunjangan tetap", "jenis": "pendapatan", "nilai": 200000}]'::jsonb else '[]'::jsonb end
           || case when i = 0 then '[{"kode": "lembur", "label": "Lembur", "jenis": "pendapatan", "nilai": 500000}]'::jsonb else '[]'::jsonb end
      from public.periode_gaji p where p.perusahaan_id = pa and p.bulan = ('2026-03-01'::date + make_interval(months => i))::date;
  end loop;
  -- Slip Ketut di periode draf dan sesudah Hari Raya tidak dihitung.
  insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen) values (pa, per2, o5, '[{"kode": "pokok", "label": "Upah", "jenis": "pendapatan", "nilai": 9000000}]');
  -- Nyoman (mulai 5 Sep 2026, masa 6 bulan): Sep 900.000, Okt-Jan 4 x 1.800.000, Feb 2.100.000 = 10.200.000 / 6 bulan = 1.700.000.
  for i in 6..11 loop
    v := case when i = 6 then 900000 when i = 11 then 2100000 else 1800000 end;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen)
    select pa, p.id, o6, jsonb_build_array(jsonb_build_object('kode', 'pokok', 'label', 'Upah', 'jenis', 'pendapatan', 'nilai', v))
      from public.periode_gaji p where p.perusahaan_id = pa and p.bulan = ('2026-03-01'::date + make_interval(months => i))::date;
  end loop;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  h := public.hitung_thr('2027-03-20');
  perform pg_temp.cek('harian lepas >= 12 bulan: rata-rata 12 bulan 25.600.000 / 12 = Rp2.133.333',
    (select (x ->> 'thr')::numeric = 2133333 and (x ->> 'harian_lepas')::boolean and (x ->> 'bulan_rata')::int = 11 from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Ketut Harian'), h::text);
  perform pg_temp.cek('harian lepas 6 bulan: rata-rata 1.700.000, THR 6/12 = Rp850.000',
    (select (x ->> 'masa_bulan')::int = 6 and (x ->> 'upah')::numeric = 1700000 and (x ->> 'thr')::numeric = 850000 from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Nyoman Harian Baru'));
  perform pg_temp.cek('harian lepas tanpa slip: belum dihitung, catatan jelas',
    (select x -> 'thr' = 'null'::jsonb and x ->> 'catatan' like 'belum ada slip%' from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Putu Harian Kosong'));
  perform pg_temp.cek('karyawan bulanan tetap pokok + tunjangan (regresi)',
    (select (x ->> 'thr')::numeric = 3000000 and not (x ->> 'harian_lepas')::boolean from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Sari Kasbon'));
  perform pg_temp.cek('dasar menyebut ayat (3) harian lepas', h ->> 'dasar' like '%ayat (3)%');

  -- Isolasi.
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat kasbon_bayar A', (select count(*) from public.kasbon_bayar) = 0);
  perform pg_temp.cek('usaha B tidak melihat rekening A', (select count(*) from public.orang_rahasia where perusahaan_id = pa) = 0);
  execute 'reset role';
  perform pg_temp.cek('fungsi trigger tidak bisa dipanggil klien',
    not has_function_privilege('authenticated', 'app.kasbon_dari_gaji()', 'execute') and not has_function_privilege('authenticated', 'app.isi_rekening_hash()', 'execute'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
