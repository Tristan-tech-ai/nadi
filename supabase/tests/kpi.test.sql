-- Tes KPI dari jejak (F3-03): setiap ukuran dijelaskan dari kerja nyata (larik id) atau teks "belum ada"; staf hanya melihat
-- miliknya, tanpa id kerja atau nama rekan; rata-rata tim hanya bila minimal 3 orang; batas minggu di zona usaha (Minggu 23.59
-- dan Senin 00.00; Asia/Jayapura dan Asia/Jakarta beda minggu untuk instan yang sama); lintas topi hanya menambah; usaha lain
-- tidak terbaca; banding hanya untuk kerja sendiri, idempoten dengan kunci, dan bisa diputuskan pemilik. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; ubd uuid; pa uuid; pb uuid; ka text; kb text; ks text; kbd text;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_tono uuid; o_b uuid; t_kasir uuid; t_cuci uuid;
  k_beras uuid; k_budi uuid; k_instan uuid; k_lintas uuid; kunci uuid := gen_random_uuid(); id_banding uuid;
  w date := date '2026-10-19'; r jsonb; r1 jsonb; e jsonb; v_o jsonb; v_n integer; v_ok boolean;
  jkt text := 'Asia/Jakarta';
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
    insert into public.orang (perusahaan_id, nama) values (pb, 'Rahasia B') returning id into o_b;

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Uji') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Uji') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Uji') returning id into o_tono;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_kpi_uji', 'Kasir KPI') returning id into t_kasir;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'cuci_kpi_uji', 'Pencuci KPI') returning id into t_cuci;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_kasir), (pa, o_budi, t_kasir);
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_budi, '123457');
    select user_id into us from public.orang where id = o_sari;
    select user_id into ubd from public.orang where id = o_budi;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kbd := json_build_object('sub', ubd, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Minggu uji 19 Okt 2026 (Senin) sampai 25 Okt di zona usaha. Sari: Cek stok beras (2 poin, lewat 40 menit), Setor kas (3, lewat
    -- 60 menit), Tutup kas (1, tepat), Rekap Minggu malam (1, Minggu 23.59 WIB, tanpa tenggat) = 4 kerja, 7 poin; Buka Senin pagi
    -- (Senin 26 Okt 00.00 WIB) masuk minggu berikutnya; minggu lalu Kas minggu lalu 4 poin tepat; kerja batal dan jalan tidak dihitung.
    -- Budi: Buka kas (2) + Instan sama (1, 25 Okt 16.30 UTC = 23.30 WIB). Tono: tidak ada kerja.
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pb;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, tenggat, selesai_at) values
      (pa, 'Cek stok beras', t_kasir, o_sari, 'selesai', 2, timestamp '2026-10-20 10:00' at time zone jkt, timestamp '2026-10-20 10:40' at time zone jkt)
      returning id into k_beras;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, tenggat, selesai_at) values
      (pa, 'Setor kas', t_kasir, o_sari, 'selesai', 3, timestamp '2026-10-23 17:00' at time zone jkt, timestamp '2026-10-23 18:00' at time zone jkt),
      (pa, 'Tutup kas', t_kasir, o_sari, 'selesai', 1, timestamp '2026-10-21 22:00' at time zone jkt, timestamp '2026-10-21 21:00' at time zone jkt),
      (pa, 'Rekap Minggu malam', t_kasir, o_sari, 'selesai', 1, null, timestamp '2026-10-25 23:59' at time zone jkt),
      (pa, 'Buka Senin pagi', t_kasir, o_sari, 'selesai', 2, null, timestamp '2026-10-26 00:00' at time zone jkt),
      (pa, 'Kas minggu lalu', t_kasir, o_sari, 'selesai', 4, timestamp '2026-10-15 12:00' at time zone jkt, timestamp '2026-10-14 12:00' at time zone jkt),
      (pa, 'Stok opname', t_kasir, o_sari, 'batal', 10, null, null),
      (pa, 'Lap meja', t_kasir, o_sari, 'jalan', 5, null, null),
      (pa, 'Instan sama', t_kasir, o_budi, 'selesai', 1, null, timestamptz '2026-10-25 16:30+00');
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Buka kas', t_kasir, o_budi, 'selesai', 2, timestamp '2026-10-20 08:00' at time zone jkt) returning id into k_budi;
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, selesai_at) values
      (pb, 'Instan B', o_b, 'selesai', 1, timestamptz '2026-10-25 16:30+00');
    select id into k_instan from public.kerja where perusahaan_id = pa and judul = 'Instan sama';
    execute 'set local role authenticated';

    -- Staf Sari: miliknya sendiri.
    perform set_config('request.jwt.claims', ks, true);
    r := public.kpi_saya(w);
    e := r -> 'orang';
    perform pg_temp.cek('minggu 19 sampai 25 Okt, zona usaha', (r ->> 'mulai')::date = w and (r ->> 'akhir')::date = w + 6 and r ->> 'zona' = jkt, r::text);
    perform pg_temp.cek('Sari: 4 kerja selesai, 7 poin (batal, jalan, minggu lalu, Senin berikutnya tidak dihitung)',
      (e ->> 'id')::uuid = o_sari and (e #>> '{poin_selesai,nilai}')::numeric = 7 and (e #>> '{poin_selesai,kerja}')::int = 4
      and jsonb_array_length(e #> '{poin_selesai,ids}') = 4, e::text);
    perform pg_temp.cek('id penjelasan poin adalah kerja selesai Sari minggu ini',
      not exists (select 1 from jsonb_array_elements_text(e #> '{poin_selesai,ids}') i
                   where not exists (select 1 from public.kerja k where k.id = i::uuid and k.pelaksana_id = o_sari and k.status = 'selesai')), e::text);
    perform pg_temp.cek('tepat tenggat 1 dari 3, dua yang lewat urut waktu: Cek stok beras 40 menit (Selasa), Setor kas 60 menit (Jumat)',
      (e #>> '{tepat,nilai}')::int = 1 and (e #>> '{tepat,dari}')::int = 3 and jsonb_array_length(e #> '{tepat,ids}') = 3
      and e #> '{tepat,lewat}' = jsonb_build_array(
        jsonb_build_object('id', k_beras, 'judul', 'Cek stok beras', 'lewat_menit', 40, 'tanggal', '2026-10-20'),
        jsonb_build_object('id', (select id from public.kerja where perusahaan_id = pa and judul = 'Setor kas'), 'judul', 'Setor kas', 'lewat_menit', 60, 'tanggal', '2026-10-23')),
      e #>> '{tepat,lewat}');
    perform pg_temp.cek('hadir null sampai jadwal shift, dengan alasan', e #> '{hadir,nilai}' = 'null'::jsonb
      and e #>> '{hadir,alasan}' = 'Hadir sesuai jadwal muncul setelah jadwal shift diisi.', e ->> 'hadir');
    perform pg_temp.cek('minggu lalu: 4 poin, 1 kerja, tepat 1 dari 1', e -> 'minggu_lalu' = '{"poin_selesai": 4, "kerja": 1, "tepat": 1, "bertenggat": 1, "lintas_poin": 0}'::jsonb, e ->> 'minggu_lalu');
    perform pg_temp.cek('batas minggu: Minggu 23.59 masuk, Senin 00.00 tidak',
      exists (select 1 from jsonb_array_elements(e -> 'rincian') x where x ->> 'judul' = 'Rekap Minggu malam' and x ->> 'tanggal' = '2026-10-25')
      and not exists (select 1 from jsonb_array_elements(e -> 'rincian') x where x ->> 'judul' = 'Buka Senin pagi'), e ->> 'rincian');
    r := public.kpi_saya(w + 7);
    perform pg_temp.cek('minggu berikutnya: Senin 00.00 masuk, Minggu 23.59 tidak',
      exists (select 1 from jsonb_array_elements(r #> '{orang,rincian}') x where x ->> 'judul' = 'Buka Senin pagi')
      and not exists (select 1 from jsonb_array_elements(r #> '{orang,rincian}') x where x ->> 'judul' = 'Rekap Minggu malam'), r::text);
    r := public.kpi_saya(w);
    perform pg_temp.cek('staf A tidak melihat id kerja, nama, atau topi rekan', r::text not like '%' || k_budi || '%'
      and r::text not like '%' || k_instan || '%'
      and r::text not like '%' || o_budi || '%' and r::text not like '%Budi%' and r::text not like '%Tono%', r::text);
    perform pg_temp.cek('dua orang punya kerja: rata-rata tim null', r -> 'rata_rata_tim' = 'null'::jsonb, r ->> 'rata_rata_tim');
    begin
      perform public.kpi_minggu(w);
      perform pg_temp.cek('staf tidak melihat kinerja semua orang', false);
    exception when others then perform pg_temp.cek('staf tidak melihat kinerja semua orang', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform app.kpi_orang(pa, w);
      perform pg_temp.cek('staf tidak memanggil app.kpi_orang langsung', false);
    exception when others then perform pg_temp.cek('staf tidak memanggil app.kpi_orang langsung', sqlstate = '42501', sqlerrm);
    end;

    -- Lintas topi hanya menambah: kerja bertopi pencuci (tidak dipakai Sari) menambah poin dan lintas, tepat tenggat tetap.
    r1 := r -> 'orang';
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Cuci gelas', t_cuci, o_sari, 'selesai', 1, timestamp '2026-10-22 15:00' at time zone jkt) returning id into k_lintas;
    execute 'set local role authenticated';
    e := public.kpi_saya(w) -> 'orang';
    perform pg_temp.cek('lintas topi menambah 1 poin dan 1 kerja lintas, tidak mengurangi apa pun',
      (select lintas_topi from public.kerja where id = k_lintas)
      and (e #>> '{poin_selesai,nilai}')::numeric = (r1 #>> '{poin_selesai,nilai}')::numeric + 1
      and (e #>> '{poin_selesai,kerja}')::int = (r1 #>> '{poin_selesai,kerja}')::int + 1
      and e -> 'tepat' = r1 -> 'tepat' and (e #>> '{lintas,nilai}')::numeric = 1 and e #> '{lintas,ids}' = jsonb_build_array(k_lintas)
      and (r1 #>> '{lintas,nilai}')::numeric = 0 and r1 #>> '{lintas,kosong}' = 'Belum ada kerja lintas topi minggu ini.', e::text);

    -- Orang ketiga dengan kerja: rata-rata tim muncul, tetap tanpa id atau nama rekan.
    execute 'reset role';
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Uji') returning id into o_dewi;
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, tenggat, selesai_at) values
      (pa, 'Setor bank', o_dewi, 'selesai', 3, timestamp '2026-10-22 12:00' at time zone jkt, timestamp '2026-10-22 11:00' at time zone jkt);
    execute 'set local role authenticated';
    r := public.kpi_saya(w);
    perform pg_temp.cek('tiga orang punya kerja: rata-rata poin (8 + 3 + 3) / 3 = 4,7, tepat tim 2 dari 4 hanya bila 3 orang bertenggat',
      (r #>> '{rata_rata_tim,n}')::int = 3 and (r #>> '{rata_rata_tim,poin_selesai}')::numeric = 4.7
      and (r #>> '{rata_rata_tim,lintas_poin}')::numeric = 0.3 and r #> '{rata_rata_tim,tepat_persen}' = 'null'::jsonb, r ->> 'rata_rata_tim');
    perform pg_temp.cek('rata-rata tim tanpa id atau nama rekan', r::text not like '%Dewi%' and r::text not like '%' || o_dewi || '%'
      and r::text not like '%Setor bank%' and r::text not like '%' || k_budi || '%', r::text);

    -- Pemilik: semua orang, setiap ukuran bukan null punya larik id, atau 0 dengan teks belum ada.
    perform set_config('request.jwt.claims', ka, true);
    r := public.kpi_minggu(w);
    perform pg_temp.cek('pemilik: 4 orang aktif urut nama, 8 kerja selesai', jsonb_array_length(r -> 'orang') = 4
      and r -> 'orang' -> 0 ->> 'nama' = 'Budi Uji' and r -> 'orang' -> 3 ->> 'nama' = 'Tono Uji' and (r ->> 'selesai_n')::int = 8, r::text);
    v_ok := true;
    for v_o in select * from jsonb_array_elements(r -> 'orang') loop
      v_ok := v_ok
        and (((v_o #>> '{poin_selesai,kerja}')::int > 0 and jsonb_array_length(v_o #> '{poin_selesai,ids}') = (v_o #>> '{poin_selesai,kerja}')::int and v_o #> '{poin_selesai,kosong}' = 'null'::jsonb)
          or ((v_o #>> '{poin_selesai,nilai}')::numeric = 0 and jsonb_array_length(v_o #> '{poin_selesai,ids}') = 0 and v_o #>> '{poin_selesai,kosong}' = 'Belum ada kerja selesai minggu ini.'))
        and (((v_o #>> '{tepat,dari}')::int > 0 and jsonb_array_length(v_o #> '{tepat,ids}') = (v_o #>> '{tepat,dari}')::int)
          or ((v_o #>> '{tepat,nilai}')::int = 0 and jsonb_array_length(v_o #> '{tepat,ids}') = 0 and v_o #>> '{tepat,kosong}' = 'Belum ada kerja bertenggat yang selesai minggu ini.'))
        and (((v_o #>> '{lintas,kerja}')::int > 0 and jsonb_array_length(v_o #> '{lintas,ids}') = (v_o #>> '{lintas,kerja}')::int)
          or ((v_o #>> '{lintas,nilai}')::numeric = 0 and jsonb_array_length(v_o #> '{lintas,ids}') = 0 and v_o #> '{lintas,kosong}' <> 'null'::jsonb))
        and jsonb_array_length(v_o -> 'rincian') = (v_o #>> '{poin_selesai,kerja}')::int;
    end loop;
    perform pg_temp.cek('setiap ukuran: larik id sebanyak kerjanya, atau 0 dengan teks belum ada', v_ok, r::text);
    select o into e from jsonb_array_elements(r -> 'orang') o where o ->> 'nama' = 'Budi Uji';
    perform pg_temp.cek('Jakarta: 25 Okt 16.30 UTC (Minggu 23.30 WIB) masuk minggu 19 Okt', (e #>> '{poin_selesai,nilai}')::numeric = 3
      and exists (select 1 from jsonb_array_elements(e -> 'rincian') x where x ->> 'judul' = 'Instan sama' and x ->> 'tanggal' = '2026-10-25'), e::text);
    select o into e from jsonb_array_elements(r -> 'orang') o where o ->> 'nama' = 'Tono Uji';
    perform pg_temp.cek('Tono tanpa kerja: 0 dengan teks', e #>> '{poin_selesai,kosong}' = 'Belum ada kerja selesai minggu ini.', e::text);
    perform pg_temp.cek('usaha A tidak membaca kerja usaha B', r::text not like '%Rahasia%' and r::text not like '%Instan B%', r::text);

    -- Usaha B di Asia/Jayapura: instan yang sama (Senin 01.30 WIT) masuk minggu 26 Okt, bukan 19 Okt.
    perform set_config('request.jwt.claims', kb, true);
    r := public.kpi_minggu(w);
    perform pg_temp.cek('Jayapura: instan sama tidak masuk minggu 19 Okt', r ->> 'zona' = 'Asia/Jayapura'
      and (r #>> '{orang,0,poin_selesai,nilai}')::numeric = 0, r::text);
    r := public.kpi_minggu(w + 7);
    perform pg_temp.cek('Jayapura: instan sama masuk minggu 26 Okt (tanggal 26 Okt)', (r #>> '{orang,0,poin_selesai,nilai}')::numeric = 1
      and r #>> '{orang,0,rincian,0,tanggal}' = '2026-10-26', r::text);
    perform pg_temp.cek('isolasi tenant: B hanya orangnya sendiri', jsonb_array_length(r -> 'orang') = 1 and r::text not like '%Uji%', r::text);
    r := public.kpi_saya(w + 7);
    perform pg_temp.cek('isolasi tenant: kpi_saya B tidak membaca kerja A, pemilik tanpa data orang', r -> 'orang' = 'null'::jsonb
      and r::text not like '%Uji%' and r::text not like '%' || k_beras || '%', r::text);

    -- Banding.
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.banding_kpi(k_budi, 'Ini bukan kerjaku', gen_random_uuid());
      perform pg_temp.cek('banding untuk kerja orang lain ditolak', false);
    exception when others then perform pg_temp.cek('banding untuk kerja orang lain ditolak', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.banding_kpi(k_beras, 'ok', gen_random_uuid());
      perform pg_temp.cek('banding tanpa alasan ditolak', false);
    exception when others then perform pg_temp.cek('banding tanpa alasan ditolak', sqlstate = '22023', sqlerrm);
    end;
    r := public.banding_kpi(k_beras, '  Tenggatnya   diundur pemilik  ', kunci);
    id_banding := (r ->> 'id')::uuid;
    perform pg_temp.cek('banding pertama membuat usulan', id_banding is not null and not (r ->> 'sudah')::boolean and r ->> 'status' = 'menunggu', r::text);
    r := public.banding_kpi(k_beras, 'Tenggatnya diundur pemilik', kunci);
    perform pg_temp.cek('banding ulang dengan kunci sama: usulan yang sama', (r ->> 'id')::uuid = id_banding and (r ->> 'sudah')::boolean, r::text);
    r := public.banding_kpi(k_beras, 'Kirim lagi dari tab lain', gen_random_uuid());
    perform pg_temp.cek('banding menunggu untuk kerja yang sama tidak digandakan', (r ->> 'id')::uuid = id_banding and (r ->> 'sudah')::boolean, r::text);
    perform pg_temp.cek('staf tidak membaca usulan banding lewat tabel', not exists (select 1 from public.usulan where id = id_banding));
    perform set_config('request.jwt.claims', kbd, true);
    begin
      perform public.banding_kpi(k_budi, 'Kunci curian', kunci);
      perform pg_temp.cek('kunci yang sudah dipakai untuk kerja lain ditolak', false);
    exception when others then perform pg_temp.cek('kunci yang sudah dipakai untuk kerja lain ditolak', sqlstate = '22023', sqlerrm);
    end;
    execute 'reset role';
    select count(*) into v_n from public.usulan where perusahaan_id = pa and aksi = 'kpi.banding';
    select * into e from (select to_jsonb(u) from public.usulan u where id = id_banding) z;
    perform pg_temp.cek('tepat satu usulan banding, untuk pemilik, payload {kerja_id, alasan}', v_n = 1
      and e -> 'untuk_peran' = '["pemilik"]'::jsonb and e -> 'payload' = jsonb_build_object('kerja_id', k_beras, 'alasan', 'Tenggatnya diundur pemilik')
      and e ->> 'sumber' = 'staf' and e ->> 'judul' = 'Tinjau hitungan kerja Sari Uji: Cek stok beras' and (e ->> 'kunci_klien')::uuid = kunci, e::text);
    perform pg_temp.cek('banding pemilik saja tidak diantre ke rute model',
      not exists (select 1 from public.keputusan where subjek_id = id_banding) and not exists (select 1 from app.rute_model where usulan_id = id_banding));
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    select x into e from jsonb_array_elements(public.kpi_saya(w) #> '{orang,rincian}') x where (x ->> 'id')::uuid = k_beras;
    perform pg_temp.cek('cermin staf menandai kerja yang dibanding: menunggu', e ->> 'banding' = 'menunggu', e::text);

    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik melihat usulan banding di Feed', exists (select 1 from public.usulan where id = id_banding and status = 'menunggu'));
    r := public.putuskan_usulan(id_banding, true);
    perform pg_temp.cek('pemilik menyetujui banding: satu kejadian kpi.banding pada kerja itu', r ->> 'status' = 'diterima' and (r ->> 'dibuat')::int = 1
      and exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'kpi.banding' and kerja_id = k_beras and orang_id = o_sari
                   and data ->> 'alasan' = 'Tenggatnya diundur pemilik'), r::text);
    select x into e from jsonb_array_elements(public.kpi_minggu(w) -> 'orang') o, jsonb_array_elements(o -> 'rincian') x where (x ->> 'id')::uuid = k_beras;
    perform pg_temp.cek('banding diterima tampil di cermin, angka tidak berubah', e ->> 'banding' = 'diterima' and (e ->> 'lewat_menit')::int = 40, e::text);

    execute 'set local role anon';
    begin
      perform public.kpi_saya(null);
      perform pg_temp.cek('anon tidak memanggil kpi_saya', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil kpi_saya', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.kpi_minggu(null);
      perform pg_temp.cek('anon tidak memanggil kpi_minggu', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil kpi_minggu', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.banding_kpi(k_beras, 'Coba dari luar', gen_random_uuid());
      perform pg_temp.cek('anon tidak memanggil banding_kpi', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil banding_kpi', sqlstate = '42501', sqlerrm);
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
