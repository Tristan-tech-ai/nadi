-- Tes F3-07E hak berhenti: bahan hitungan hanya untuk pemilik (gaji rahasia, pola, pembagi terverifikasi, jatah dan cuti terpakai),
-- ajukan membuat satu usulan uang.hak_berhenti untuk_peran {pemilik} (diperbarui selama menunggu), uang pisah tersimpan, tanpa
-- pesangon untuk mengundurkan diri, validasi angka, admin dan usaha lain ditolak, menyetujui hanya mencatat kejadian (tanpa slip).
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uadm uuid := gen_random_uuid(); pa uuid; pb uuid;
  ka text; kb text; kadm text; o_sari uuid; bh uuid; r jsonb; r2 jsonb; v_us uuid; n int; u public.usulan;
  v_rinci jsonb := '{"gaji_akhir": 2160000, "cuti": 1620000, "cuti_hari": 9, "upah_harian": 180000, "uang_pisah": 500000, "dasar_gaji": "12 hari kerja dari 25"}';
begin
  perform pg_temp.cek('fungsi ada, aturan pembagi terverifikasi', to_regprocedure('public.hak_berhenti(uuid)') is not null
    and to_regprocedure('public.ajukan_hak_berhenti(uuid,jsonb)') is not null
    and exists (select 1 from public.aturan_bertanggal where kunci = 'upah.pembagi_harian' and terverifikasi and (nilai ->> 'pola_6_hari')::int = 25 and (nilai ->> 'pola_5_hari')::int = 21));

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (uadm, 'adm@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Hak A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Hak B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kadm := json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Berhenti') returning id into o_sari;
  r := public.catat_berhenti(o_sari, current_date, current_date + 30, 'mundur', gen_random_uuid());
  execute 'reset role';
  select id into bh from public.berhenti where orang_id = o_sari;
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uadm, 'admin');
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o_sari, pa, '{"pokok": 4000000, "tunjangan_tetap": 500000, "ptkp": "TK/0"}')
    on conflict (orang_id) do update set gaji = excluded.gaji;
  insert into public.kebijakan_izin (perusahaan_id, jenis, jatah_tahunan) values (pa, 'cuti', 12)
    on conflict (perusahaan_id, jenis) do update set jatah_tahunan = 12;
  insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, status, alasan_putusan, diajukan_oleh)
  values (pa, o_sari, 'cuti', make_date(extract(year from current_date + 30)::int, 1, 5), make_date(extract(year from current_date + 30)::int, 1, 7), 3, 'disetujui', 'uji', ua),
         (pa, o_sari, 'cuti', make_date(extract(year from current_date + 30)::int, 2, 5), make_date(extract(year from current_date + 30)::int, 2, 6), 2, 'ditolak', 'uji', ua);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r := public.hak_berhenti(bh);
  perform pg_temp.cek('bahan: gaji, pola, pembagi', (r -> 'gaji' ->> 'pokok')::bigint = 4000000 and r ->> 'pola' = '6_hari'
    and (r -> 'pembagi' ->> 'pola_6_hari')::int = 25, r::text);
  perform pg_temp.cek('bahan: jatah dan cuti terpakai (hanya disetujui)', (r ->> 'jatah_cuti')::int = 12 and (r ->> 'cuti_terpakai')::int = 3, r::text);
  perform pg_temp.cek('bahan: belum ada usulan, alasan mundur', r -> 'usulan' = 'null'::jsonb and r ->> 'alasan' = 'mundur' and r ->> 'nama' = 'Sari Berhenti');

  perform set_config('request.jwt.claims', kadm, true);
  begin perform public.hak_berhenti(bh); perform pg_temp.cek('admin tidak melihat hak', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak melihat hak', true); end;
  begin perform public.ajukan_hak_berhenti(bh, v_rinci); perform pg_temp.cek('admin tidak mengajukan', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak mengajukan', true); end;
  perform set_config('request.jwt.claims', kb, true);
  begin perform public.hak_berhenti(bh); perform pg_temp.cek('usaha lain ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain ditolak', true); end;

  perform set_config('request.jwt.claims', ka, true);
  begin perform public.ajukan_hak_berhenti(bh, '{"gaji_akhir": 0}'); perform pg_temp.cek('total Rp0 ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('total Rp0 ditolak', true); end;
  begin perform public.ajukan_hak_berhenti(bh, '{"gaji_akhir": 100, "cuti": -5}'); perform pg_temp.cek('nilai negatif ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('nilai negatif ditolak', true); end;
  begin perform public.ajukan_hak_berhenti(bh, '{"gaji_akhir": "satu juta"}'); perform pg_temp.cek('bukan angka ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('bukan angka ditolak', true); end;

  r := public.ajukan_hak_berhenti(bh, v_rinci);
  v_us := (r ->> 'usulan')::uuid;
  perform pg_temp.cek('ajukan: total dijumlah database', (r ->> 'total')::bigint = 4280000 and (r ->> 'baru')::boolean, r::text);
  execute 'reset role';
  select * into u from public.usulan where id = v_us;
  perform pg_temp.cek('usulan uang.hak_berhenti untuk pemilik saja, menunggu', u.aksi = 'uang.hak_berhenti' and u.untuk_peran = '{pemilik}'
    and u.status = 'menunggu' and u.dampak_rp = 4280000, u.untuk_peran::text);
  perform pg_temp.cek('penjelasan: tanpa pesangon Pasal 50, tidak dibayar otomatis', u.penjelasan ~ 'Gaji sampai [0-9]{1,2} [A-Z][a-z]{2} [0-9]{4}:' and u.penjelasan like '%Pasal 50%' and u.penjelasan like '%Tanpa pesangon%'
    and u.penjelasan like '%pembayaran tetap kamu lakukan sendiri%', u.penjelasan);
  perform pg_temp.cek('payload bidang rinci', (u.payload -> 'bidang' ->> 'cuti')::bigint = 1620000 and u.payload -> 'bidang' ->> 'pesangon' = 'tidak_berlaku'
    and u.payload ->> 'berhenti_id' = bh::text);
  perform pg_temp.cek('uang pisah tersimpan di berhenti', (select uang_pisah from public.berhenti where id = bh) = 500000);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r2 := public.ajukan_hak_berhenti(bh, v_rinci - 'uang_pisah');
  perform pg_temp.cek('ajukan ulang memperbarui usulan yang sama', r2 ->> 'usulan' = v_us::text and not (r2 ->> 'baru')::boolean and (r2 ->> 'total')::bigint = 3780000, r2::text);
  perform set_config('request.jwt.claims', kadm, true);
  perform pg_temp.cek('admin tidak melihat usulan hak', not exists (select 1 from public.usulan where id = v_us));
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan(v_us, true);
  r := public.hak_berhenti(bh);
  perform pg_temp.cek('setelah disetujui terlihat di bahan', r -> 'usulan' ->> 'status' = 'diterima', r -> 'usulan' ->> 'status');
  begin perform public.ajukan_hak_berhenti(bh, v_rinci); perform pg_temp.cek('ajukan setelah disetujui ditolak', false);
  exception when sqlstate '23505' then perform pg_temp.cek('ajukan setelah disetujui ditolak', true); end;
  execute 'reset role';
  select count(*) into n from public.usulan where perusahaan_id = pa and aksi = 'uang.hak_berhenti';
  perform pg_temp.cek('satu usulan per berhenti', n = 1, n::text);
  perform pg_temp.cek('menyetujui mencatat kejadian uang.hak_berhenti', exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'uang.hak_berhenti' and nilai = 3780000));
  perform pg_temp.cek('menyetujui tidak membayar (tanpa slip, tanpa jurnal)', not exists (select 1 from public.slip_gaji where orang_id = o_sari)
    and not exists (select 1 from public.jurnal where perusahaan_id = pa and sumber_id = v_us::text));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'hak_berhenti: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
