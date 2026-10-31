-- Tes Papan kerja dan Poin Beban (F3-01): hanya pemilik/admin membuat kerja dan mengubah poin, staf hanya membaca dan
-- mengubah status kerjanya sendiri, jeda tunggu dikurangkan dari durasi nyata, estimasi riwayat tanpa token dari >= 3 kerja
-- serupa (median), faktor kalibrasi dari 30 kerja selesai terakhir (dibatasi 0,5..2) dan berubah mengikuti data, model hanya
-- sekali, manual mempertahankan menit model, usaha lain tidak membaca atau menulis apa pun. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; ut uuid; pa uuid; pb uuid; ka text; kb text; ks text; kt text;
  o_sari uuid; o_tono uuid; o_b uuid; t_cuci uuid; t_kasir uuid; t_b uuid;
  k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid; k6 uuid; r jsonb; n int; i int; v numeric; ai_awal int;
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
    insert into public.topi (perusahaan_id, kode, nama) values (pb, 'topi_b_uji', 'Topi B') returning id into t_b;

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Staf') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Staf') returning id into o_tono;
    insert into public.topi (perusahaan_id, kode, nama, tanggung_jawab) values (pa, 'cuci_uji', 'Pencuci', '[{"tugas": "Mencuci piring", "raci": "R"}]')
      returning id into t_cuci;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_uji', 'Kasir Uji') returning id into t_kasir;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi) values (pa, o_sari, t_cuci, 100);
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_tono, '654321');
    select user_id into us from public.orang where id = o_sari;
    select user_id into ut from public.orang where id = o_tono;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kt := json_build_object('sub', ut, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    select count(*) into ai_awal from public.pemakaian_ai where perusahaan_id = pa;

    -- Poin dari menit.
    execute 'reset role';
    perform pg_temp.cek('1 poin = 15 menit, bulat 0,25 (22 menit = 1,5 poin)', app.poin_dari_menit(22) = 1.5 and app.poin_dari_menit(15) = 1 and app.poin_dari_menit(40) = 2.75);
    perform pg_temp.cek('poin paling kecil 0,25 dan paling besar 99', app.poin_dari_menit(0.3) = 0.25 and app.poin_dari_menit(5000) = 99);
    perform pg_temp.cek('teks menit', app.teks_menit(0.4) = 'kurang dari 1 menit' and app.teks_menit(42) = '42 menit' and app.teks_menit(60) = '1 jam' and app.teks_menit(65) = '1 jam 5 menit');
    perform pg_temp.cek('faktor usaha tanpa data = 1', (app.faktor_kalibrasi(pb) ->> 'faktor')::numeric = 1 and (app.faktor_kalibrasi(pb) ->> 'n')::int = 0);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);

    -- Membuat kerja.
    r := public.buat_kerja('  Cuci   piring sore  ', t_cuci, o_sari, now() + interval '3 hours');
    k1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('pemilik membuat kerja; tanpa riwayat perlu model', k1 is not null and (r ->> 'perlu_model')::boolean and r -> 'estimasi' = 'null'::jsonb, r::text);
    perform pg_temp.cek('judul dirapikan, status baru, poin kosong',
      (select judul = 'Cuci piring sore' and status = 'baru' and poin_beban is null and not lintas_topi from public.kerja where id = k1));
    k2 := (public.buat_kerja('Hitung kas laci', t_kasir, o_sari, null) ->> 'id')::uuid;
    perform pg_temp.cek('kerja di luar topi pelaksana tertanda lintas topi', (select lintas_topi from public.kerja where id = k2));
    k3 := (public.buat_kerja('Lap meja depan', null, o_tono, null, '00000000-0000-4000-8000-00000000f301') ->> 'id')::uuid;
    r := public.buat_kerja('Lap meja depan', null, o_tono, null, '00000000-0000-4000-8000-00000000f301');
    perform pg_temp.cek('buat kerja dengan kunci sama: kerja yang sama, tanpa baris kembar',
      (r ->> 'id')::uuid = k3 and (r ->> 'sudah')::boolean
      and (select count(*) from public.kerja where kunci_klien = '00000000-0000-4000-8000-00000000f301') = 1
      and (select count(*) from public.kejadian where kerja_id = k3 and jenis = 'kerja.buat') = 1, r::text);
    perform pg_temp.cek('kejadian kerja.buat tercatat', (select count(*) from public.kejadian where kerja_id = k1 and jenis = 'kerja.buat') = 1);
    begin
      perform public.buat_kerja('ab', null, null, null);
      perform pg_temp.cek('judul terlalu pendek ditolak', false);
    exception when others then perform pg_temp.cek('judul terlalu pendek ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.buat_kerja('Kerja dengan topi B', t_b, null, null);
      perform pg_temp.cek('topi usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('topi usaha lain ditolak', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.buat_kerja('Kerja untuk orang B', null, o_b, null);
      perform pg_temp.cek('pelaksana usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('pelaksana usaha lain ditolak', sqlstate = 'P0002', sqlerrm);
    end;

    -- Staf: baca kerjanya sendiri, tidak membuat kerja, tidak mengubah poin, tidak menyentuh kerja orang lain.
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf hanya melihat kerjanya sendiri', (select count(*) from public.kerja) = 2 and not exists (select 1 from public.kerja where id = k3));
    perform pg_temp.cek('papan staf hanya kerjanya sendiri',
      jsonb_array_length(public.papan_kerja()) = 2 and not exists (select 1 from jsonb_array_elements(public.papan_kerja()) e where (e ->> 'id')::uuid = k3)
      and (select bool_and((e ->> 'saya')::boolean) from jsonb_array_elements(public.papan_kerja()) e));
    begin
      perform public.buat_kerja('Kerja buatan staf', null, null, null);
      perform pg_temp.cek('staf tidak membuat kerja', false);
    exception when others then perform pg_temp.cek('staf tidak membuat kerja', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.simpan_estimasi_kerja(k1, 30, 'manual');
      perform pg_temp.cek('staf tidak mengubah poin', false);
    exception when others then perform pg_temp.cek('staf tidak mengubah poin', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.ubah_status_kerja(k3, 'mulai');
      perform pg_temp.cek('staf tidak memulai kerja orang lain', false);
    exception when others then perform pg_temp.cek('staf tidak memulai kerja orang lain', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.ubah_status_kerja(k1, 'batal');
      perform pg_temp.cek('staf tidak membatalkan kerja', false);
    exception when others then perform pg_temp.cek('staf tidak membatalkan kerja', sqlstate = '42501', sqlerrm);
    end;
    update public.kerja set status = 'selesai' where id = k1;
    begin
      perform public.ubah_status_kerja(k1, 'tunggu');
      perform pg_temp.cek('kerja baru tidak bisa ditunda', false);
    exception when others then perform pg_temp.cek('kerja baru tidak bisa ditunda', sqlstate = '55000', sqlerrm);
    end;

    -- Mulai, tunggu 30 menit, lanjut, selesai: durasi nyata 60 - 30 = 30 menit.
    r := public.ubah_status_kerja(k1, 'mulai');
    perform pg_temp.cek('staf memulai kerjanya (update langsung staf tidak berlaku)', r ->> 'status' = 'jalan' and r ->> 'mulai_at' is not null, r::text);
    perform public.ubah_status_kerja(k1, 'tunggu');
    execute 'reset role';
    update public.kerja set mulai_at = now() - interval '60 minutes', data = data || jsonb_build_object('tunggu_at', now() - interval '30 minutes') where id = k1;
    execute 'set local role authenticated';
    r := public.ubah_status_kerja(k1, 'lanjut');
    perform pg_temp.cek('lanjut menjumlahkan jeda 30 menit', r ->> 'status' = 'jalan' and (r ->> 'jeda_menit')::numeric = 30, r::text);
    r := public.ubah_status_kerja(k1, 'selesai');
    perform pg_temp.cek('durasi nyata dikurangi jeda tunggu: 30 menit', r ->> 'status' = 'selesai' and (r ->> 'aktual_menit')::numeric = 30, r::text);
    perform pg_temp.cek('kejadian mulai, tunggu, lanjut, selesai tercatat (staf membaca miliknya)',
      (select count(*) from public.kejadian where kerja_id = k1 and jenis in ('kerja.mulai', 'kerja.tunggu', 'kerja.lanjut', 'kerja.selesai')) = 4);
    -- Idempoten (kiriman ulang useOffline): Selesai dua kali tidak mengubah durasi, waktu selesai, atau kejadian.
    r := public.ubah_status_kerja(k1, 'selesai');
    perform pg_temp.cek('selesai dua kali: tanpa galat, durasi tetap 30, ditandai sudah',
      r ->> 'status' = 'selesai' and (r ->> 'aktual_menit')::numeric = 30 and (r ->> 'sudah')::boolean
      and (select selesai_at = now() and (data ->> 'aktual_menit')::numeric = 30 from public.kerja where id = k1), r::text);
    perform pg_temp.cek('selesai dua kali tidak menambah kejadian',
      (select count(*) from public.kejadian where kerja_id = k1 and jenis = 'kerja.selesai') = 1);
    begin
      perform public.ubah_status_kerja(k1, 'mulai');
      perform pg_temp.cek('kerja selesai tidak bisa dimulai lagi', false);
    exception when others then perform pg_temp.cek('kerja selesai tidak bisa dimulai lagi', sqlstate = '55000', sqlerrm);
    end;

    -- Selesai langsung dari tunggu juga mengurangi jeda: 50 - 20 = 30 menit.
    perform public.ubah_status_kerja(k2, 'mulai');
    execute 'reset role';
    update public.kerja set mulai_at = now() - interval '50 minutes' where id = k2;
    execute 'set local role authenticated';
    r := public.ubah_status_kerja(k2, 'mulai');
    perform pg_temp.cek('mulai dua kali: tanpa galat, waktu mulai tidak bergeser, satu kejadian',
      r ->> 'status' = 'jalan' and (r ->> 'sudah')::boolean and (r ->> 'mulai_at')::timestamptz = now() - interval '50 minutes'
      and (select count(*) from public.kejadian where kerja_id = k2 and jenis = 'kerja.mulai') = 1, r::text);
    perform public.ubah_status_kerja(k2, 'tunggu');
    r := public.ubah_status_kerja(k2, 'tunggu');
    perform pg_temp.cek('tunggu dua kali: tanpa galat, satu kejadian', r ->> 'status' = 'tunggu' and (r ->> 'sudah')::boolean
      and (select count(*) from public.kejadian where kerja_id = k2 and jenis = 'kerja.tunggu') = 1, r::text);
    execute 'reset role';
    update public.kerja set mulai_at = now() - interval '50 minutes', data = data || jsonb_build_object('tunggu_at', now() - interval '20 minutes') where id = k2;
    execute 'set local role authenticated';
    r := public.ubah_status_kerja(k2, 'selesai');
    perform pg_temp.cek('selesai dari tunggu: 30 menit, jeda 20', (r ->> 'aktual_menit')::numeric = 30 and (r ->> 'jeda_menit')::numeric = 20, r::text);

    -- Staf lain tidak melihat kerja Sari.
    perform set_config('request.jwt.claims', kt, true);
    perform pg_temp.cek('staf lain hanya melihat kerjanya', (select count(*) from public.kerja) = 1 and (select id from public.kerja) = k3);

    -- Estimasi riwayat: siapkan 2 kerja selesai serupa (topi Pencuci) + 1 lama (> 180 hari) + 1 topi lain + 1 judul berbeda.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, topi_id, status, mulai_at, selesai_at, data) values
      (pa, 'cuci piring sore', t_cuci, 'selesai', now() - interval '2 days 1 hour', now() - interval '2 days', '{"aktual_menit": 50}'),
      (pa, 'Cuci piring sore', t_cuci, 'selesai', now() - interval '200 days 1 hour', now() - interval '200 days', '{"aktual_menit": 5}'),
      (pa, 'Cuci piring sore', t_kasir, 'selesai', now() - interval '3 days 1 hour', now() - interval '3 days', '{"aktual_menit": 5}'),
      (pa, 'Sapu gudang belakang', t_cuci, 'selesai', now() - interval '4 days 1 hour', now() - interval '4 days', '{"aktual_menit": 5}'),
      (pa, 'Cuci piring sore', t_cuci, 'selesai', null, now() - interval '5 days', '{"aktual_menit": 5}');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.buat_kerja('Cuci piring sore hari', t_cuci, null, null);
    k4 := (r ->> 'id')::uuid;
    perform pg_temp.cek('2 kerja serupa belum cukup untuk riwayat', (r ->> 'perlu_model')::boolean, r::text);
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, topi_id, status, mulai_at, selesai_at, data) values
      (pa, 'Cuci piring sore', t_cuci, 'selesai', now() - interval '1 day 1 hour', now() - interval '1 day', '{"aktual_menit": 40}');
    execute 'set local role authenticated';
    r := public.buat_kerja('Cuci piring sore hari', t_cuci, o_sari, null);
    k5 := (r ->> 'id')::uuid;
    perform pg_temp.cek('3 kerja serupa: estimasi riwayat median 40 menit = 2,75 poin',
      not (r ->> 'perlu_model')::boolean and r -> 'estimasi' ->> 'sumber' = 'riwayat' and (r -> 'estimasi' ->> 'menit')::numeric = 40
      and (r -> 'estimasi' ->> 'poin')::numeric = 2.75 and (r -> 'estimasi' ->> 'n')::int = 3, r::text);
    perform pg_temp.cek('alasan riwayat menyebut median dan jumlah', r -> 'estimasi' ->> 'alasan' = 'Median 3 kerja serupa (cuci piring sore): 40 menit.', r -> 'estimasi' ->> 'alasan');
    perform pg_temp.cek('poin_beban dan data.estimasi tersimpan',
      (select poin_beban = 2.75 and data -> 'estimasi' ->> 'sumber' = 'riwayat' and data -> 'estimasi' ? 'dihitung_at' from public.kerja where id = k5));
    perform pg_temp.cek('riwayat tanpa token (pemakaian_ai tidak bertambah)', (select count(*) from public.pemakaian_ai where perusahaan_id = pa) = ai_awal);
    begin
      perform public.simpan_estimasi_kerja(k5, 10, 'model', 'x');
      perform pg_temp.cek('model tidak menimpa estimasi yang sudah ada', false);
    exception when others then perform pg_temp.cek('model tidak menimpa estimasi yang sudah ada', sqlstate = '55000', sqlerrm);
    end;

    -- Konteks untuk model.
    r := public.konteks_estimasi(k4);
    perform pg_temp.cek('konteks model: judul, topi, sampai 5 contoh topi sama dulu',
      r ->> 'judul' = 'Cuci piring sore hari' and r -> 'topi' ->> 'nama' = 'Pencuci' and jsonb_array_length(r -> 'contoh') between 3 and 5
      and r -> 'contoh' -> 0 ->> 'topi' = 'Pencuci' and r -> 'estimasi' = 'null'::jsonb, r::text);

    -- Kalibrasi: 30 kerja model terbaru rasio 1,5 dan 5 lebih lama rasio 4 (di luar 30 terakhir) -> faktor 1,5.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, status, mulai_at, selesai_at, data)
    select pa, 'Kalibrasi ' || g, 'selesai', now() - make_interval(hours => g + 1), now() - make_interval(hours => g),
           jsonb_build_object('aktual_menit', 30, 'estimasi', jsonb_build_object('sumber', 'model', 'menit', 20, 'menit_model', 20))
      from generate_series(1, 30) g;
    insert into public.kerja (perusahaan_id, judul, status, mulai_at, selesai_at, data)
    select pa, 'Kalibrasi lama ' || g, 'selesai', now() - make_interval(days => 10 + g), now() - make_interval(days => 10 + g) + interval '1 hour',
           jsonb_build_object('aktual_menit', 80, 'estimasi', jsonb_build_object('sumber', 'model', 'menit', 20, 'menit_model', 20))
      from generate_series(1, 5) g;
    perform pg_temp.cek('faktor usaha = median 30 terakhir = 1,5', (app.faktor_kalibrasi(pa) ->> 'faktor')::numeric = 1.5 and (app.faktor_kalibrasi(pa) ->> 'n')::int = 30, app.faktor_kalibrasi(pa)::text);
    execute 'set local role authenticated';
    r := public.simpan_estimasi_kerja(k4, 20, 'model', 'Mencuci sekitar 40 piring.',
      '{"model": "model-uji", "token_masuk": 300, "token_keluar": 40}'::jsonb);
    perform pg_temp.cek('estimasi model dikali faktor: 20 x 1,5 = 30 menit = 2 poin',
      r ->> 'sumber' = 'model' and (r ->> 'menit')::numeric = 30 and (r ->> 'poin')::numeric = 2 and (r ->> 'faktor')::numeric = 1.5
      and (r ->> 'menit_model')::numeric = 20, r::text);
    perform pg_temp.cek('alasan model menyebut faktor', r ->> 'alasan' = 'Mencuci sekitar 40 piring. Dikali faktor usaha 1,50 dari 30 kerja selesai.', r ->> 'alasan');
    perform pg_temp.cek('pemakaian token model tercatat', (select count(*) from public.pemakaian_ai where perusahaan_id = pa and tugas = 'estimasi_kerja' and token_masuk = 300) = 1);
    begin
      perform public.simpan_estimasi_kerja(k4, 25, 'model', 'lagi');
      perform pg_temp.cek('model hanya sekali per kerja', false);
    exception when others then perform pg_temp.cek('model hanya sekali per kerja', sqlstate = '55000', sqlerrm);
    end;

    -- Data baru mengubah faktor: 30 kerja lebih baru rasio 3 -> dibatasi 2.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, status, mulai_at, selesai_at, data)
    select pa, 'Kalibrasi baru ' || g, 'selesai', now() - make_interval(mins => g + 30), now() - make_interval(mins => g),
           jsonb_build_object('aktual_menit', 60, 'estimasi', jsonb_build_object('sumber', 'model', 'menit', 20, 'menit_model', 20))
      from generate_series(1, 30) g;
    perform pg_temp.cek('faktor berubah mengikuti data dan dibatasi 2', (app.faktor_kalibrasi(pa) ->> 'faktor')::numeric = 2, app.faktor_kalibrasi(pa)::text);
    update public.kerja set data = jsonb_set(data, '{aktual_menit}', '2') where judul like 'Kalibrasi baru %' and perusahaan_id = pa;
    perform pg_temp.cek('faktor dibatasi bawah 0,5', (app.faktor_kalibrasi(pa) ->> 'faktor')::numeric = 0.5, app.faktor_kalibrasi(pa)::text);
    execute 'set local role authenticated';

    -- Manual menimpa, menit model dipertahankan; galat relatif dihitung saat selesai.
    r := public.simpan_estimasi_kerja(k4, 45, 'manual', null);
    perform pg_temp.cek('manual: 45 menit = 3 poin, menit model tetap 20',
      r ->> 'sumber' = 'manual' and (r ->> 'poin')::numeric = 3 and (r ->> 'menit_model')::numeric = 20 and r ->> 'alasan' = 'Diisi manual oleh pemberi kerja.', r::text);
    begin
      perform public.simpan_estimasi_kerja(k4, 0, 'manual', null);
      perform pg_temp.cek('menit 0 ditolak', false);
    exception when others then perform pg_temp.cek('menit 0 ditolak', sqlstate = '22023', sqlerrm);
    end;
    perform public.ubah_status_kerja(k4, 'mulai');
    execute 'reset role';
    update public.kerja set mulai_at = now() - interval '36 minutes' where id = k4;
    execute 'set local role authenticated';
    r := public.ubah_status_kerja(k4, 'selesai');
    perform pg_temp.cek('pemilik menyelesaikan; galat relatif (36 - 45) / 45 = -0,2',
      (r ->> 'aktual_menit')::numeric = 36 and (select (data ->> 'galat_relatif')::numeric = -0.2 from public.kerja where id = k4), r::text);
    r := public.ubah_status_kerja(k3, 'selesai');
    perform pg_temp.cek('selesai tanpa mulai: tanpa durasi nyata', r -> 'aktual_menit' = 'null'::jsonb or r -> 'aktual_menit' is null, r::text);

    -- Papan pemilik: semua kerja terbuka + selesai hari ini (bukan yang selesai kemarin).
    r := public.papan_kerja();
    perform pg_temp.cek('papan pemilik memuat kerja Tono dan Sari, tanpa selesai kemarin',
      exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k3)
      and exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k1 and e ->> 'status' = 'selesai' and (e ->> 'aktual_menit')::numeric = 30)
      and not exists (select 1 from jsonb_array_elements(r) e where e ->> 'judul' = 'cuci piring sore'), jsonb_array_length(r)::text);
    perform pg_temp.cek('papan memuat nama pelaksana dan topi',
      (select e -> 'pelaksana' ->> 'nama' = 'Sari Staf' and e -> 'topi' ->> 'nama' = 'Pencuci' from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k5));

    -- Batal oleh pemilik.
    r := public.ubah_status_kerja(k5, 'batal');
    perform pg_temp.cek('pemilik membatalkan kerja', r ->> 'status' = 'batal');

    -- Usaha lain.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat kerja A', (select count(*) from public.kerja where perusahaan_id = pa) = 0 and jsonb_array_length(public.papan_kerja()) = 0);
    r := public.buat_kerja('Lap meja depan', null, null, null, '00000000-0000-4000-8000-00000000f301');
    perform pg_temp.cek('kunci sama di usaha lain tidak membuka kerja A', (r ->> 'id')::uuid <> k3 and not (r ->> 'sudah')::boolean, r::text);
    update public.kerja set judul = 'Disusupi' where id = k1;
    begin
      perform public.ubah_status_kerja(k4, 'batal');
      perform pg_temp.cek('usaha lain tidak mengubah status kerja A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak mengubah status kerja A', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.simpan_estimasi_kerja(k1, 30, 'manual');
      perform pg_temp.cek('usaha lain tidak mengubah poin kerja A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak mengubah poin kerja A', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.konteks_estimasi(k1);
      perform pg_temp.cek('usaha lain tidak membaca konteks kerja A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak membaca konteks kerja A', sqlstate = 'P0002', sqlerrm);
    end;
    execute 'reset role';
    perform pg_temp.cek('tulisan usaha lain tidak mengubah apa pun', (select judul = 'Cuci piring sore' from public.kerja where id = k1));
    execute 'set local role anon';
    begin
      perform public.papan_kerja();
      perform pg_temp.cek('anon tidak memanggil papan_kerja', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil papan_kerja', sqlstate = '42501', sqlerrm);
    end;
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
