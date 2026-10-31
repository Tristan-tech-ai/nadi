-- Tes Jalur Magang (F2-06): hanya pemilik/admin menulis rencana dan tarif (tarif khusus pemilik), mentor mencatat sesinya sendiri
-- untuk rencananya saja, staf bukan mentor ditolak, batas menit 1-600, biaya per rekrutmen dari buku jam (90 menit mentor +
-- 30 menit penilai pada Rp30.000/jam + iklan Rp100.000), tarif disalin ke baris, peringatan lunak (durasi, uang saku, mentor baru,
-- 20%) dengan sumber dan status belum terverifikasi, topi mentor otomatis, usaha lain tidak melihat atau menulis apa pun.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; ut uuid; pa uuid; pb uuid; ka text; kb text; ks text; kt text;
  o_sari uuid; o_budi uuid; o_tono uuid; o_dewi uuid; o_b uuid; t_barista uuid; t_mentor uuid; r1 uuid; r2 uuid;
  lw uuid; v_kode text; la uuid; r jsonb; b jsonb; n int; i int; v_minggu jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Orang B') returning id into o_b;

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, data) values (pa, 'Sari Mentor', '{"mulai": "2024-01-01"}') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Magang') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Staf') returning id into o_tono;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Magang') returning id into o_dewi;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'barista_uji', 'Barista') returning id into t_barista;
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_tono, '654321');
    select user_id into us from public.orang where id = o_sari;
    select user_id into ut from public.orang where id = o_tono;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kt := json_build_object('sub', ut, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Dana Rekrutmen: khusus pemilik.
    r := public.atur_dana_rekrut(30000, 500000);
    perform pg_temp.cek('pemilik mengatur tarif dan anggaran', (r ->> 'tarif_jam')::bigint = 30000 and (r ->> 'anggaran_bulanan')::bigint = 500000, r::text);
    perform pg_temp.cek('tarif tersimpan di pengaturan usaha',
      (select pengaturan ->> 'tarif_jam_rekrut' = '30000' and pengaturan ->> 'anggaran_rekrut_bulanan' = '500000' from public.perusahaan where id = pa));
    begin
      perform public.atur_dana_rekrut(-1, null);
      perform pg_temp.cek('tarif negatif ditolak', false);
    exception when others then perform pg_temp.cek('tarif negatif ditolak', sqlstate = '22023', sqlerrm);
    end;

    -- Rencana 1: Budi dibimbing Sari (bekerja sejak 2024), uang saku kosong, 3 bulan.
    r := public.simpan_rencana_magang(null, o_budi, o_sari, t_barista, date '2026-10-01', date '2026-12-31', '{}'::jsonb,
      '  Bisa menyiapkan espresso dan susu sendiri  ',
      '[{"minggu": 1, "keahlian": " Kenal mesin ", "target": "Membersihkan grup head"}, {"minggu": 2, "keahlian": "Espresso", "target": ""}]'::jsonb,
      'Membuat 10 cangkir dalam 30 menit');
    r1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('rencana 1 tersimpan', r1 is not null, r::text);
    perform pg_temp.cek('peringatan uang saku kosong muncul', exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'uang_saku'), r::text);
    perform pg_temp.cek('rencana 3 bulan tanpa peringatan durasi', not exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'durasi'), r::text);
    perform pg_temp.cek('mentor sejak 2024 tanpa peringatan mentor baru', not exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'mentor_baru'), r::text);
    perform pg_temp.cek('setiap peringatan menyebut sumber dan belum terverifikasi',
      jsonb_array_length(r -> 'peringatan') > 0 and not exists (select 1 from jsonb_array_elements(r -> 'peringatan') e
        where coalesce(e ->> 'sumber', '') not like 'Permenaker 6/2020 Pasal %' or e ->> 'status' <> 'belum terverifikasi'), r::text);
    select minggu into v_minggu from public.rencana_magang where id = r1;
    perform pg_temp.cek('rencana mingguan dirapikan',
      v_minggu = '[{"minggu": 1, "keahlian": "Kenal mesin", "target": "Membersihkan grup head"}, {"minggu": 2, "keahlian": "Espresso", "target": null}]'::jsonb, v_minggu::text);
    perform pg_temp.cek('tujuan dirapikan dan uang saku dinormalkan',
      (select tujuan = 'Bisa menyiapkan espresso dan susu sendiri' and uang_saku = '{"transport": 0, "makan": 0, "insentif": 0}'::jsonb from public.rencana_magang where id = r1));
    select id into t_mentor from public.topi where perusahaan_id = pa and kode = 'mentor';
    perform pg_temp.cek('topi mentor dibuat otomatis', t_mentor is not null);
    perform pg_temp.cek('mentor memakai topi mentor dengan porsi kecil',
      (select porsi = 10 from public.pakai_topi where orang_id = o_sari and topi_id = t_mentor));
    perform pg_temp.cek('peserta berjenis magang', (select 'magang' = any (jenis) from public.orang where id = o_budi));
    perform pg_temp.cek('peserta memakai topi tujuan selama magang',
      (select mulai = date '2026-10-01' and selesai = date '2026-12-31' from public.pakai_topi where orang_id = o_budi and topi_id = t_barista));
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (pa, 'Cuci gelas', t_mentor, o_budi);
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (pa, 'Seduh espresso', t_barista, o_budi);
    perform pg_temp.cek('kerja peserta di luar topi magangnya tertanda lintas topi',
      (select lintas_topi from public.kerja where judul = 'Cuci gelas' and perusahaan_id = pa)
        and not (select lintas_topi from public.kerja where judul = 'Seduh espresso' and perusahaan_id = pa));
    r := public.simpan_rencana_magang(r1, o_budi, o_sari, t_barista, date '2026-10-01', date '2026-12-31', '{}'::jsonb,
      'Bisa menyiapkan espresso dan susu sendiri', v_minggu, 'Membuat 10 cangkir dalam 30 menit', 'jalan', null);
    perform pg_temp.cek('simpan ulang memakai rencana yang sama, topi mentor tidak dobel',
      (r ->> 'id')::uuid = r1 and (select count(*) from public.pakai_topi where orang_id = o_sari and topi_id = t_mentor) = 1
        and (select count(*) from public.topi where perusahaan_id = pa and kode = 'mentor') = 1, r::text);

    -- Rencana 2: Dewi dibimbing Tono (orang baru), 18 bulan, uang saku terisi.
    r := public.simpan_rencana_magang(null, o_dewi, o_tono, null, date '2026-11-01', date '2028-04-30',
      '{"transport": 300000, "makan": 450000, "insentif": null}'::jsonb, 'Belajar dapur', '[]'::jsonb, null);
    r2 := (r ->> 'id')::uuid;
    perform pg_temp.cek('peringatan durasi lebih dari 1 tahun muncul (18 bulan)',
      exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'durasi' and e ->> 'pesan' like '%18 bulan%'), r::text);
    perform pg_temp.cek('peringatan mentor kurang dari 6 bulan muncul', exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'mentor_baru'), r::text);
    perform pg_temp.cek('uang saku terisi tanpa peringatan uang saku', not exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'uang_saku'), r::text);
    perform pg_temp.cek('peringatan 20% muncul (2 peserta dari 4 orang aktif)',
      exists (select 1 from jsonb_array_elements(r -> 'peringatan') e where e ->> 'kode' = 'kuota' and e ->> 'pesan' like 'Peserta magang aktif 2 dari 4 orang aktif (50%)%'), r::text);
    for i in 1..6 loop insert into public.orang (perusahaan_id, nama) values (pa, 'Karyawan ' || i); end loop;
    perform pg_temp.cek('peringatan 20% hilang saat 2 dari 10 orang aktif',
      not exists (select 1 from jsonb_array_elements(public.peringatan_magang(r2)) e where e ->> 'kode' = 'kuota'));

    -- Validasi isian rencana.
    begin
      perform public.simpan_rencana_magang(null, o_budi, o_budi, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan', '[]', null);
      perform pg_temp.cek('mentor sama dengan peserta ditolak', false);
    exception when others then perform pg_temp.cek('mentor sama dengan peserta ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(null, o_budi, o_sari, null, date '2026-10-01', date '2026-09-30', '{}', 'Tujuan', '[]', null);
      perform pg_temp.cek('selesai sebelum mulai ditolak', false);
    exception when others then perform pg_temp.cek('selesai sebelum mulai ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(null, o_budi, o_sari, null, date '2026-10-01', date '2026-12-31', '{"transport": -5}', 'Tujuan', '[]', null);
      perform pg_temp.cek('uang saku negatif ditolak', false);
    exception when others then perform pg_temp.cek('uang saku negatif ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(null, o_budi, o_sari, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan',
        (select jsonb_agg(jsonb_build_object('minggu', g, 'keahlian', 'Latihan')) from generate_series(1, 53) g), null);
      perform pg_temp.cek('lebih dari 52 baris mingguan ditolak', false);
    exception when others then perform pg_temp.cek('lebih dari 52 baris mingguan ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(null, o_budi, o_sari, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan', '[{"minggu": 1}]', null);
      perform pg_temp.cek('baris mingguan tanpa keahlian ditolak', false);
    exception when others then perform pg_temp.cek('baris mingguan tanpa keahlian ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(null, o_b, o_sari, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan', '[]', null);
      perform pg_temp.cek('peserta dari usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('peserta dari usaha lain ditolak', sqlstate = 'P0002', sqlerrm);
    end;

    -- Lowongan dengan biaya iklan dan satu pelamar yang diterima.
    insert into public.lowongan (perusahaan_id, judul, biaya_iklan) values (pa, 'Barista pagi', 100000) returning id, kode into lw, v_kode;
    begin
      update public.lowongan set biaya_iklan = -1 where id = lw;
      perform pg_temp.cek('biaya iklan negatif ditolak', false);
    exception when check_violation then perform pg_temp.cek('biaya iklan negatif ditolak', true);
    end;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    la := (public.lamar_daftar(v_kode, 'Rina Pelamar', '0812-3456-7200', repeat('d', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    begin
      perform public.catat_jam_rekrut('penilai', null, la, date '2026-10-15', 30, null);
      perform pg_temp.cek('anon tidak bisa mencatat jam', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa mencatat jam', true);
    end;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.ubah_tahap_lamaran(la, 'diterima', null);
    execute 'reset role';
    update public.lamaran set tahap_at = timestamptz '2026-10-15 12:00+08' where id = la;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.catat_jam_rekrut('penilai', null, la, date '2026-10-15', 30, 'Menonton rekaman wawancara');
    perform pg_temp.cek('pemilik mencatat 30 menit menilai, tarif disalin', (r ->> 'tarif_per_jam')::bigint = 30000, r::text);

    -- Batas menit.
    begin
      perform public.catat_jam_rekrut('mentor', r1, null, date '2026-10-15', 0, null);
      perform pg_temp.cek('0 menit ditolak', false);
    exception when others then perform pg_temp.cek('0 menit ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.catat_jam_rekrut('mentor', r1, null, date '2026-10-15', 601, null);
      perform pg_temp.cek('601 menit ditolak', false);
    exception when others then perform pg_temp.cek('601 menit ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.catat_jam_rekrut('mentor', r1, null, (now() at time zone 'Asia/Makassar')::date + 2, 30, null);
      perform pg_temp.cek('tanggal masa depan ditolak', false);
    exception when others then perform pg_temp.cek('tanggal masa depan ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.catat_jam_rekrut('mentor', null, la, date '2026-10-15', 30, null);
      perform pg_temp.cek('jam mentor tanpa rencana ditolak', false);
    exception when others then perform pg_temp.cek('jam mentor tanpa rencana ditolak', sqlstate = 'P0002', sqlerrm);
    end;

    -- Mentor Sari (staf) mencatat sesinya sendiri.
    perform set_config('request.jwt.claims', ks, true);
    r := public.catat_jam_rekrut('mentor', r1, null, date '2026-10-15', 90, 'Latihan espresso');
    perform pg_temp.cek('mentor mencatat 90 menit di rencananya', (r ->> 'tarif_per_jam')::bigint = 30000, r::text);
    perform pg_temp.cek('baris mentor atas nama mentor', (select orang_id = o_sari and jenis = 'mentor' and menit = 90 from public.jam_rekrut where id = (r ->> 'id')::uuid));
    begin
      perform public.catat_jam_rekrut('mentor', r2, null, date '2026-10-15', 30, null);
      perform pg_temp.cek('mentor tidak bisa mencatat di rencana orang lain', false);
    exception when others then perform pg_temp.cek('mentor tidak bisa mencatat di rencana orang lain', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.catat_jam_rekrut('penilai', null, la, date '2026-10-15', 30, null);
      perform pg_temp.cek('mentor tidak bisa mencatat menit penilai', false);
    exception when others then perform pg_temp.cek('mentor tidak bisa mencatat menit penilai', sqlstate = '42501', sqlerrm);
    end;
    begin
      insert into public.jam_rekrut (perusahaan_id, jenis, orang_id, rencana_id, tanggal, menit) values (pa, 'mentor', o_sari, r1, date '2026-10-15', 600);
      perform pg_temp.cek('staf tidak bisa menulis buku jam langsung', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menulis buku jam langsung', true);
    end;
    select count(*) into n from public.jam_rekrut;
    perform pg_temp.cek('mentor hanya membaca baris jamnya sendiri', n = 1, n::text);
    select count(*) into n from public.rencana_magang;
    perform pg_temp.cek('mentor hanya membaca rencananya', n = 1 and (select id from public.rencana_magang) = r1, n::text);
    r := public.daftar_rencana_magang();
    perform pg_temp.cek('daftar mentor berisi rencananya dengan nama peserta dan 90 menit',
      jsonb_array_length(r) = 1 and r -> 0 -> 'peserta' ->> 'nama' = 'Budi Magang' and (r -> 0 ->> 'saya_mentor')::boolean
        and (r -> 0 ->> 'menit_mentor')::int = 90 and r -> 0 -> 'sesi' -> 0 ->> 'catatan' = 'Latihan espresso', r::text);
    perform pg_temp.cek('mentor membaca peringatan rencananya', jsonb_typeof(public.peringatan_magang(r1)) = 'array');
    begin
      perform public.simpan_rencana_magang(r1, o_budi, o_sari, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan', '[]', null);
      perform pg_temp.cek('mentor tidak bisa menulis rencana', false);
    exception when others then perform pg_temp.cek('mentor tidak bisa menulis rencana', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.atur_dana_rekrut(1, 1);
      perform pg_temp.cek('staf tidak bisa mengatur tarif', false);
    exception when others then perform pg_temp.cek('staf tidak bisa mengatur tarif', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.laporan_rekrut(date '2026-10-01');
      perform pg_temp.cek('staf tidak bisa membuka laporan biaya', false);
    exception when others then perform pg_temp.cek('staf tidak bisa membuka laporan biaya', sqlstate = '42501', sqlerrm);
    end;

    -- Tono: staf, bukan mentor rencana 1.
    perform set_config('request.jwt.claims', kt, true);
    begin
      perform public.catat_jam_rekrut('mentor', r1, null, date '2026-10-15', 30, null);
      perform pg_temp.cek('staf bukan mentor tidak bisa mencatat sesi', false);
    exception when others then perform pg_temp.cek('staf bukan mentor tidak bisa mencatat sesi', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.peringatan_magang(r1);
      perform pg_temp.cek('staf bukan mentor tidak membaca peringatan rencana lain', false);
    exception when others then perform pg_temp.cek('staf bukan mentor tidak membaca peringatan rencana lain', sqlstate = 'P0002', sqlerrm);
    end;
    r := public.daftar_rencana_magang();
    perform pg_temp.cek('daftar Tono hanya rencana 2', jsonb_array_length(r) = 1 and (r -> 0 ->> 'id')::uuid = r2, r::text);
    select count(*) into n from public.jam_rekrut;
    perform pg_temp.cek('Tono tidak membaca jam Sari', n = 0, n::text);

    -- Biaya per rekrutmen. Tarif dinaikkan setelah dicatat: baris lama tetap memakai tarif salinan.
    perform set_config('request.jwt.claims', ka, true);
    perform public.atur_dana_rekrut(60000, 500000);
    r := public.laporan_rekrut(date '2026-10-20');
    select x into b from jsonb_array_elements(r -> 'baris') x where (x ->> 'id')::uuid = r1;
    perform pg_temp.cek('rencana 1: 90 menit mentor = Rp45.000',
      (b ->> 'menit_mentor')::int = 90 and (b ->> 'jam_mentor')::numeric = 1.5 and (b ->> 'biaya_total')::bigint = 45000 and b ->> 'jenis' = 'magang', b::text);
    select x into b from jsonb_array_elements(r -> 'baris') x where (x ->> 'id')::uuid = la;
    perform pg_temp.cek('pelamar diterima: 30 menit penilai Rp15.000 + iklan Rp100.000 = Rp115.000',
      (b ->> 'menit_penilai')::int = 30 and (b ->> 'biaya_jam')::bigint = 15000 and (b ->> 'biaya_iklan_bagian')::bigint = 100000
        and (b ->> 'biaya_total')::bigint = 115000 and b ->> 'jenis' = 'diterima' and b ->> 'nama' = 'Rina Pelamar', b::text);
    perform pg_temp.cek('rencana 2 belum berjalan di Oktober tidak masuk laporan',
      not exists (select 1 from jsonb_array_elements(r -> 'baris') x where (x ->> 'id')::uuid = r2), r::text);
    perform pg_temp.cek('total biaya Rp160.000, terpakai Rp60.000 dari anggaran Rp500.000, sisa Rp440.000',
      (r ->> 'total_biaya')::bigint = 160000 and (r ->> 'terpakai')::bigint = 60000 and (r ->> 'anggaran')::bigint = 500000
        and (r ->> 'sisa')::bigint = 440000 and (r ->> 'menit_mentor')::int = 90 and (r ->> 'menit_penilai')::int = 30
        and (r ->> 'tarif_jam')::bigint = 60000, r::text);
    r := public.laporan_rekrut(date '2026-09-01');
    perform pg_temp.cek('bulan lain kosong', jsonb_array_length(r -> 'baris') = 0 and (r ->> 'terpakai')::bigint = 0, r::text);

    -- Usaha lain.
    perform set_config('request.jwt.claims', kb, true);
    select count(*) into n from public.rencana_magang;
    perform pg_temp.cek('usaha lain tidak melihat rencana', n = 0, n::text);
    select count(*) into n from public.jam_rekrut;
    perform pg_temp.cek('usaha lain tidak melihat buku jam', n = 0, n::text);
    perform pg_temp.cek('daftar usaha lain kosong', jsonb_array_length(public.daftar_rencana_magang()) = 0);
    r := public.laporan_rekrut(date '2026-10-01');
    perform pg_temp.cek('laporan usaha lain kosong dan tanpa tarif A',
      jsonb_array_length(r -> 'baris') = 0 and r -> 'tarif_jam' = 'null'::jsonb and (r ->> 'terpakai')::bigint = 0, r::text);
    begin
      perform public.catat_jam_rekrut('mentor', r1, null, date '2026-10-15', 30, null);
      perform pg_temp.cek('usaha lain tidak bisa mencatat jam', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa mencatat jam', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.catat_jam_rekrut('penilai', null, la, date '2026-10-15', 30, null);
      perform pg_temp.cek('usaha lain tidak bisa mencatat menit penilai', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa mencatat menit penilai', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.simpan_rencana_magang(r1, o_budi, o_sari, null, date '2026-10-01', date '2026-12-31', '{}', 'Tujuan', '[]', null);
      perform pg_temp.cek('usaha lain tidak bisa mengubah rencana', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa mengubah rencana', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.peringatan_magang(r1);
      perform pg_temp.cek('usaha lain tidak membaca peringatan', false);
    exception when others then perform pg_temp.cek('usaha lain tidak membaca peringatan', sqlstate = 'P0002', sqlerrm);
    end;
    execute 'reset role';
    perform pg_temp.cek('tulisan usaha lain tidak mengubah apa pun',
      (select count(*) from public.jam_rekrut where perusahaan_id = pa) = 2 and (select tujuan from public.rencana_magang where id = r1) <> 'Tujuan');
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
