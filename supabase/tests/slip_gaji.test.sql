-- Tes slip_gaji: aturan resmi termuat (yang belum pasti tidak terverifikasi), total dihitung ulang database, komponen tidak sah
-- ditolak, orang bertemuan Gerbang Gaji ditahan, periode disetujui terkunci, staf hanya melihat slipnya sendiri setelah
-- disetujui, tautan slip (nms_) bisa dibuka tanpa akun lalu dicabut, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  o1 uuid; o2 uuid; hantu uuid; us uuid; per uuid; perb uuid; r jsonb; n int; x text; tok text; s1 uuid; sh uuid;
  bln date := date_trunc('month', now() at time zone 'Asia/Makassar')::date;
  kom constant jsonb := '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":5000000},
    {"kode":"tunjangan","label":"Tunjangan makan","jenis":"pendapatan","nilai":500000},
    {"kode":"bpjs_kes_pk","label":"BPJS Kesehatan (ditanggung usaha)","jenis":"pemberi_kerja","nilai":200000},
    {"kode":"bpjs_kes","label":"BPJS Kesehatan","jenis":"potongan","nilai":50000},
    {"kode":"jht","label":"JHT","jenis":"potongan","nilai":100000},
    {"kode":"pph21","label":"PPh 21","jenis":"potongan","nilai":0}]';
begin
  -- Aturan.
  perform pg_temp.cek('TER A/B/C termuat terverifikasi', (select terverifikasi and jsonb_array_length(nilai -> 'A') = 44 and jsonb_array_length(nilai -> 'B') = 40
    and jsonb_array_length(nilai -> 'C') = 41 from public.aturan_bertanggal where kunci = 'pph21.ter'));
  perform pg_temp.cek('batas upah JP 2026 terverifikasi dari surat BPJS B/1226/022026', (select bool_and(terverifikasi and (nilai ->> 'batas_upah')::bigint > 0) from public.aturan_bertanggal where kunci = 'bpjs.jp'));
  perform pg_temp.cek('PTKP, Pasal 17, lembur termuat', (select count(distinct kunci) = 3 from public.aturan_bertanggal where kunci in ('pph21.ptkp', 'pph21.pasal17', 'lembur.pp35') and terverifikasi));

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama, telepon, data) values (pa, 'Sari', '0812-1111-0001', '{"mulai":"2024-01-01"}') returning id into o1;
  insert into public.orang (perusahaan_id, nama, telepon, data) values (pa, 'Budi', '0812-1111-0002', '{"mulai":"2024-01-01"}') returning id into o2;
  insert into public.orang (perusahaan_id, nama, data) values (pa, 'Hantu', '{"mulai":"2024-01-01"}') returning id into hantu;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o1, pa, '{"pokok":5000000}'), (o2, pa, '{"pokok":5000000}'), (hantu, pa, '{"pokok":5000000}');
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'reset role';
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id)
  -- Tanda hidup harus jatuh di jendela 30 hari gerbang_gaji(akhir bulan periode); now() - 2 hari keluar jendela di hari pertama bulan (temuan Q-23).
  select pa, now() - interval '1 hour', 'absen.masuk', 'pwa', id from public.orang where id in (o1, o2);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  per := public.mulai_periode_gaji(bln + 14);
  perform pg_temp.cek('periode dibuka untuk tanggal 1 bulan itu, sekali', per = public.mulai_periode_gaji(bln) and (select bulan from public.periode_gaji where id = per) = bln);
  r := public.simpan_slip(per, o1, kom, '{}');
  s1 := (r ->> 'id')::uuid;
  perform pg_temp.cek('total dihitung database: bruto 5.500.000, potongan 150.000, neto 5.350.000 (iuran usaha tidak memotong)',
    (r ->> 'bruto')::bigint = 5500000 and (r ->> 'potongan')::bigint = 150000 and (r ->> 'neto')::bigint = 5350000 and not (r ->> 'ditahan')::boolean, r::text);
  r := public.simpan_slip(per, o2, kom, array['Batas upah JP 2026 belum terverifikasi; JP tidak dihitung.']);
  perform pg_temp.cek('peringatan aturan belum terverifikasi tersimpan di slip', (select peringatan = array['Batas upah JP 2026 belum terverifikasi; JP tidak dihitung.'] from public.slip_gaji where id = (r ->> 'id')::uuid));
  r := public.simpan_slip(per, hantu, kom, '{}');
  sh := (r ->> 'id')::uuid;
  perform pg_temp.cek('orang tanpa tanda hidup ditahan dengan alasan Gerbang Gaji', (r ->> 'ditahan')::boolean and r ->> 'alasan_tahan' like 'Belum ada absen atau izin%', r::text);
  begin
    perform public.simpan_slip(per, o1, '[{"kode":"x","label":"X","jenis":"pendapatan","nilai":-5}]', '{}');
    perform pg_temp.cek('nilai negatif ditolak', false);
  exception when others then perform pg_temp.cek('nilai negatif ditolak', sqlerrm like 'Komponen gaji tidak sah%', sqlerrm);
  end;
  begin
    perform public.simpan_slip(per, o1, '[{"kode":"x","label":"X","jenis":"hadiah","nilai":5}]', '{}');
    perform pg_temp.cek('jenis komponen asing ditolak', false);
  exception when others then perform pg_temp.cek('jenis komponen asing ditolak', sqlerrm like 'Komponen gaji tidak sah%', sqlerrm);
  end;
  begin
    perform public.buat_tautan_slip(s1);
    perform pg_temp.cek('tautan tidak bisa dibuat sebelum periode disetujui', false);
  exception when others then perform pg_temp.cek('tautan tidak bisa dibuat sebelum periode disetujui', sqlerrm like 'Slip belum bisa dibagikan%', sqlerrm);
  end;

  -- Staf sebelum disetujui.
  perform set_config('request.jwt.claims', ks, true);
  select count(*) into n from public.slip_gaji;
  perform pg_temp.cek('staf belum melihat slip draf', n = 0, n::text);
  begin
    perform public.simpan_slip(per, o1, kom, '{}');
    perform pg_temp.cek('staf tidak bisa menyimpan slip', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menyimpan slip', true);
  end;

  -- Setujui.
  perform set_config('request.jwt.claims', ka, true);
  r := public.setujui_periode_gaji(per);
  perform pg_temp.cek('setujui: 3 slip, 1 ditahan', r = '{"slip": 3, "ditahan": 1}'::jsonb, r::text);
  begin
    perform public.simpan_slip(per, o1, kom, '{}');
    perform pg_temp.cek('periode disetujui terkunci', false);
  exception when others then perform pg_temp.cek('periode disetujui terkunci', sqlerrm like 'Periode ini sudah disetujui%', sqlerrm);
  end;
  begin
    perform public.buat_tautan_slip(sh);
    perform pg_temp.cek('slip ditahan tidak bisa dibagikan', false);
  exception when others then perform pg_temp.cek('slip ditahan tidak bisa dibagikan', sqlerrm like 'Slip belum bisa dibagikan%', sqlerrm);
  end;
  tok := public.buat_tautan_slip(s1);
  perform pg_temp.cek('token slip berawalan nms_', tok ~ '^nms_[0-9a-f]{64}$');

  -- Staf sesudah disetujui: hanya slip sendiri.
  perform set_config('request.jwt.claims', ks, true);
  select count(*), max(neto) into n, x from public.slip_gaji;
  perform pg_temp.cek('staf melihat tepat slipnya sendiri', n = 1 and x = '5350000' and (select orang_id from public.slip_gaji) = o1, n::text);

  -- Tanpa akun lewat tautan.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.buka_slip(tok);
  perform pg_temp.cek('tautan membuka slip: usaha, nama, neto, komponen', r ->> 'usaha' = 'Warung Uji A' and r ->> 'nama' = 'Sari' and (r ->> 'neto')::bigint = 5350000
    and jsonb_array_length(r -> 'komponen') = 6, left(r::text, 200));
  begin
    perform public.buka_slip('nms_' || repeat('0', 64));
    perform pg_temp.cek('token karangan ditolak', false);
  exception when others then perform pg_temp.cek('token karangan ditolak', sqlerrm like 'Tautan slip ini tidak berlaku%', sqlerrm);
  end;
  begin
    perform count(*) from public.slip_gaji;
    perform pg_temp.cek('anon tidak bisa membaca tabel slip', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca tabel slip', true);
  end;

  -- Usaha lain.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.slip_gaji;
  perform pg_temp.cek('usaha lain tidak melihat slip', n = 0, n::text);
  begin
    perform public.buat_tautan_slip(s1);
    perform pg_temp.cek('usaha lain tidak bisa membuat tautan slip', false);
  exception when others then perform pg_temp.cek('usaha lain tidak bisa membuat tautan slip', sqlerrm like 'Slip belum bisa dibagikan%', sqlerrm);
  end;

  -- Lepas tahan dan cabut.
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.lepas_tahan_slip(sh, ' ');
    perform pg_temp.cek('lepas tahan butuh alasan', false);
  exception when others then perform pg_temp.cek('lepas tahan butuh alasan', sqlerrm like 'Tulis alasan%', sqlerrm);
  end;
  perform public.lepas_tahan_slip(sh, 'Sudah dicek, sedang cuti panjang tanpa absen.');
  perform pg_temp.cek('pemilik melepas tahanan dengan alasan tercatat', (select not ditahan and alasan_tahan like '%Dilepas: Sudah dicek%' from public.slip_gaji where id = sh));
  perform pg_temp.cek('cabut tautan', public.cabut_tautan_slip(s1) = 1);
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.buka_slip(tok);
    perform pg_temp.cek('tautan dicabut ditolak', false);
  exception when others then perform pg_temp.cek('tautan dicabut ditolak', sqlerrm like 'Tautan slip ini tidak berlaku%', sqlerrm);
  end;
  execute 'reset role';
  perform pg_temp.cek('token tersimpan sebagai hash', not exists (select 1 from app.token_slip where hash like 'nms_%'));
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
