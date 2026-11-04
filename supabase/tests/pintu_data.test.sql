-- Tes W-08 pintu data: token nmi_ dibuat pemilik/admin (bukan staf), hanya hash disimpan; anon dengan token mengirim penjualan,
-- pesanan, mutasi yang menjadi SATU usulan menunggu di usaha token itu saja; kunci sama tidak menggandakan; baris salah ditolak
-- dengan nomor baris; batas per 24 jam; token dicabut ditolak; disetujui = jurnal penjualan, dokumen pesanan, mutasi rekening.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  tok text; tokb text; tok2 text; r jsonb; u1 uuid; u2 uuid; u3 uuid; pid_tok uuid; g text; n int;
begin
  insert into auth.users (id, email) values (ua, 'pa@uji.local'), (ub, 'pb@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Pintu A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Pintu B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Pintu') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  tok := public.buat_pintu_data('Toko online', 3);
  tok2 := public.buat_pintu_data('Kasir lama');
  perform pg_temp.cek('token berawalan nmi_', tok like 'nmi_%');
  perform pg_temp.cek('klien tidak membaca token_hash', not has_column_privilege('authenticated', 'public.pintu_data', 'token_hash', 'select'));
  perform pg_temp.cek('pemilik melihat dua pintu', (select count(*) from public.pintu_data) = 2);
  perform set_config('request.jwt.claims', kb, true);
  tokb := public.buat_pintu_data('Pintu B');
  perform pg_temp.cek('usaha B hanya melihat pintunya', (select count(*) from public.pintu_data) = 1);
  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform pg_temp.cek('hanya hash disimpan', not exists (select 1 from public.pintu_data where token_hash = tok) and exists (select 1 from public.pintu_data where token_hash = app.hash_token(tok)));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.buat_pintu_data('Pintu staf'); perform pg_temp.cek('staf tidak membuat pintu', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat pintu', true); end;
  perform pg_temp.cek('staf tidak melihat pintu', (select count(*) from public.pintu_data) = 0);

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform pg_temp.cek('anon tidak membaca tabel pintu', not has_table_privilege('anon', 'public.pintu_data', 'select'));
  r := public.pintu_terima(tok, 'penjualan', '[{"tanggal": "2026-11-04", "nomor": "TK-101", "keterangan": "Kopi susu 3", "jumlah": 54000, "metode": "qris"}, {"tanggal": "2026-11-04", "jumlah": "25000", "metode": "tunai"}]'::jsonb, md5('k1')::uuid, 'n8n');
  u1 := (r ->> 'usulan')::uuid;
  perform pg_temp.cek('penjualan jadi usulan 2 baris', r ->> 'sudah' = 'false' and (r ->> 'baris')::int = 2, r::text);
  r := public.pintu_terima(tok, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1}]'::jsonb, md5('k1')::uuid);
  perform pg_temp.cek('kunci sama tidak menggandakan', (r ->> 'usulan')::uuid = u1 and r ->> 'sudah' = 'true', r::text);
  begin perform public.pintu_terima(tok, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1000}, {"tanggal": "4/11/2026", "jumlah": 5}]'::jsonb, md5('k2')::uuid);
    perform pg_temp.cek('tanggal salah ditolak dengan nomor baris', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('tanggal salah ditolak dengan nomor baris', g like 'Baris 2:%', g); end;
  begin perform public.pintu_terima(tok, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1500.5}]'::jsonb, md5('k3')::uuid);
    perform pg_temp.cek('rupiah pecahan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('rupiah pecahan ditolak', true); end;
  begin perform public.pintu_terima(tok, 'gaji', '[{"nama": "x"}]'::jsonb, md5('k4')::uuid);
    perform pg_temp.cek('jenis lain ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('jenis lain ditolak', true); end;
  r := public.pintu_terima(tok, 'pesanan', '[{"nomor": "SHP-9", "pelanggan": "Bu Rina", "uraian": "Keripik 250 g", "jumlah": 2, "harga": 18000}, {"nomor": "SHP-9", "pelanggan": "Bu Rina", "uraian": "Sambal", "jumlah": 1, "harga": 22000}, {"nomor": "SHP-10", "pelanggan": "Pak Dodi", "uraian": "Keripik 250 g", "jumlah": 1, "harga": 18000}]'::jsonb, md5('k5')::uuid);
  u2 := (r ->> 'usulan')::uuid;
  r := public.pintu_terima(tok, 'mutasi', '[{"tanggal": "2026-11-04", "keterangan": "TRF MASUK TK-101", "jumlah": 54000, "arah": "cr", "saldo": 1054000}]'::jsonb, md5('k6')::uuid);
  u3 := (r ->> 'usulan')::uuid;
  begin perform public.pintu_terima(tok, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1000}]'::jsonb, md5('k7')::uuid);
    perform pg_temp.cek('batas per 24 jam ditegakkan', false);
  exception when sqlstate '54000' then perform pg_temp.cek('batas per 24 jam ditegakkan', true); end;
  r := public.pintu_terima(tok2, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1000}]'::jsonb, md5('k1')::uuid);
  perform pg_temp.cek('kunci sama di pintu lain usaha sama tetap usulan yang sama', (r ->> 'usulan')::uuid = u1);
  r := public.pintu_terima(tokb, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 7000}]'::jsonb, md5('k1')::uuid);
  perform pg_temp.cek('kunci sama di usaha lain = usulan terpisah', (r ->> 'usulan')::uuid <> u1);
  begin perform public.pintu_terima('nmi_salah', 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1}]'::jsonb, md5('k8')::uuid);
    perform pg_temp.cek('token salah ditolak', false);
  exception when sqlstate '28000' then perform pg_temp.cek('token salah ditolak', true); end;
  execute 'reset role';

  perform pg_temp.cek('usulan di usaha A, menunggu, dari pintu', (select count(*) from public.usulan where id in (u1, u2, u3) and perusahaan_id = pa and status = 'menunggu' and sumber = 'pintu') = 3);
  perform pg_temp.cek('aksi per jenis', (select array_agg(aksi order by aksi) from public.usulan where id in (u1, u2, u3)) = array['jual.pesanan', 'uang.mutasi_pintu', 'uang.penjualan']);
  perform pg_temp.cek('dampak penjualan = total', (select dampak_rp from public.usulan where id = u1) = 79000);
  perform pg_temp.cek('bidang hanya ringkasan kecil', (select pg_column_size(payload -> 'bidang') < 200 and jsonb_array_length(payload -> 'baris') = 2 from public.usulan where id = u1));
  perform pg_temp.cek('usaha B tidak punya usulan dari token A', not exists (select 1 from public.usulan where perusahaan_id = pb and id in (u1, u2, u3)));
  perform pg_temp.cek('terakhir dipakai tercatat', (select terakhir_at is not null from public.pintu_data where token_hash = app.hash_token(tok)));

  -- Usaha B tidak bisa melihat usulan A; pemilik A menyetujui ketiganya.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('pemilik B tidak melihat usulan A', (select count(*) from public.usulan where id in (u1, u2, u3)) = 0);
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan(u1, true);
  perform public.putuskan_usulan(u2, true);
  perform public.putuskan_usulan(u3, true);
  execute 'reset role';
  perform pg_temp.cek('penjualan jadi 2 jurnal: qris ke Bank, tunai ke Kas',
    (select count(*) from public.jurnal j where j.perusahaan_id = pa and j.sumber = 'pintu' and j.sumber_id = u1::text) = 2
    and (select sum(debit) from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id where j.sumber_id = u1::text and a.kode = '1-110') = 54000
    and (select sum(debit) from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id where j.sumber_id = u1::text and a.kode = '1-100') = 25000
    and (select sum(kredit) from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id where j.sumber_id = u1::text and a.kode = '4-100') = 79000);
  perform pg_temp.cek('pesanan jadi 2 dokumen SO', (select count(*) from public.dokumen_jual where perusahaan_id = pa and jenis = 'pesanan') = 2
    and (select total from public.dokumen_jual where perusahaan_id = pa and jenis = 'pesanan' and pelanggan = 'Bu Rina') = 58000);
  select count(*) into n from public.mutasi_bank m where m.perusahaan_id = pa;
  perform pg_temp.cek('mutasi masuk rekening bank', n = 1, n::text);

  -- Token dicabut ditolak.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.cabut_pintu_data((select id from public.pintu_data where nama = 'Kasir lama'));
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  begin perform public.pintu_terima(tok2, 'penjualan', '[{"tanggal": "2026-11-04", "jumlah": 1}]'::jsonb, md5('k9')::uuid);
    perform pg_temp.cek('token dicabut ditolak', false);
  exception when sqlstate '28000' then perform pg_temp.cek('token dicabut ditolak', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
