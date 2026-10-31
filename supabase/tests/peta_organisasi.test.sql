-- Tes Peta Organisasi Nyata (F3-04, docs/design/peta-organisasi.md): hanya pemilik/admin/akuntan yang aktif menurut tabel anggota
-- (staf, anon, admin yang dicabut atau diturunkan dengan JWT lama ditolak 42501); kerja selesai dalam p_minggu minggu terakhir
-- di zona usaha; kerja batal, jalan, dan di luar jendela tidak dihitung; lintas topi dari kerja.lintas_topi; persen per topi dan
-- per orang; ambang < 3 kerja tanpa persen; alur serah pemberi -> pelaksana (pemberi_id, atau pembuat dari kejadian kerja.buat);
-- kalimat kepala dari SQL; usulan pasang topi untuk pemilik, idempoten dengan kunci, dan bila disetujui memasang topinya;
-- usaha lain tidak terbaca. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  ut uuid := gen_random_uuid(); uk uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; ks text; kd text; kt text; kk text;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_eko uuid; o_tono uuid; o_b uuid;
  t_kasir uuid; t_pelayan uuid; t_gudang uuid; t_b uuid; k_pemilik uuid;
  kunci uuid := gen_random_uuid(); id_usulan uuid;
  r jsonb; e jsonb; g jsonb; v_n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (us, 's@uji.local'), (ud, 'd@uji.local'),
      (ut, 't@uji.local'), (uk, 'k@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kt := json_build_object('sub', ut, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;

    execute 'reset role';
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Uji') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Uji') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama, data) values (pa, 'Dewi Uji', '{"jabatan": "Pelayan"}') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Eko Uji') returning id into o_eko;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Uji') returning id into o_tono;
    insert into public.orang (perusahaan_id, nama) values (pb, 'Rahasia B') returning id into o_b;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_peta_uji', 'Kasir') returning id into t_kasir;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'pelayan_peta_uji', 'Pelayan') returning id into t_pelayan;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'gudang_peta_uji', 'Gudang') returning id into t_gudang;
    insert into public.topi (perusahaan_id, kode, nama) values (pb, 'rak_peta_uji', 'Rak B') returning id into t_b;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi) values
      (pa, o_sari, t_kasir, 100), (pa, o_budi, t_kasir, 50), (pa, o_budi, t_gudang, 50), (pa, o_dewi, t_pelayan, 100), (pa, o_eko, t_gudang, 100),
      (pb, o_b, t_b, 100);
    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values
      (pa, us, 'staf', o_sari), (pa, ud, 'admin', null), (pa, ut, 'admin', null), (pa, uk, 'akuntan', null);

    -- Jendela 4 minggu = 28 hari zona usaha sampai hari ini. Sari kasir 4+4+2 (1, 10, 20 hari lalu) = 10 poin; Budi kasir 2 lewat
    -- buat_kerja pemilik (pemberi dari kejadian kerja.buat); Dewi kasir 3+3 (lintas, diserahkan Sari) dan pelayan 2+2 = 10 poin;
    -- Eko gudang 1+1+1. Tidak dihitung: Sari kasir 30 poin 40 hari lalu, Sari kasir batal 50 poin (selesai_at terisi), Dewi kasir
    -- jalan 9 poin (ikut alur serah), kerja usaha B.
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Setor kas', t_kasir, o_sari, 'selesai', 4, now() - interval '1 day'),
      (pa, 'Tutup kas', t_kasir, o_sari, 'selesai', 4, now() - interval '10 days'),
      (pa, 'Cek laci', t_kasir, o_sari, 'selesai', 2, now() - interval '20 days'),
      (pa, 'Kas lama', t_kasir, o_sari, 'selesai', 30, now() - interval '40 days'),
      (pa, 'Stok opname', t_kasir, o_sari, 'batal', 50, now() - interval '2 days'),
      (pa, 'Antar pesanan', t_pelayan, o_dewi, 'selesai', 2, now() - interval '3 days'),
      (pa, 'Lap meja', t_pelayan, o_dewi, 'selesai', 2, now() - interval '4 days'),
      (pa, 'Bongkar beras', t_gudang, o_eko, 'selesai', 1, now() - interval '2 days'),
      (pa, 'Susun rak', t_gudang, o_eko, 'selesai', 1, now() - interval '5 days'),
      (pa, 'Cek gudang', t_gudang, o_eko, 'selesai', 1, now() - interval '6 days');
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, pemberi_id, status, poin_beban, selesai_at) values
      (pa, 'Jaga kasir siang', t_kasir, o_dewi, o_sari, 'selesai', 3, now() - interval '2 days'),
      (pa, 'Jaga kasir sore', t_kasir, o_dewi, o_sari, 'selesai', 3, now() - interval '8 days'),
      (pa, 'Jaga kasir malam', t_kasir, o_dewi, o_sari, 'jalan', 9, null),
      (pa, 'Kasir batal', t_kasir, o_dewi, o_sari, 'batal', 7, null),
      (pb, 'Rak rahasia', t_b, o_b, null, 'selesai', 5, now() - interval '1 day');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    k_pemilik := (public.buat_kerja('Rekap kas pemilik', t_kasir, o_budi, null) ->> 'id')::uuid;
    execute 'reset role';
    update public.kerja set status = 'selesai', poin_beban = 2, selesai_at = now() - interval '1 day' where id = k_pemilik;
    execute 'set local role authenticated';

    -- Akses.
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.peta_organisasi(4);
      perform pg_temp.cek('staf ditolak 42501', false);
    exception when others then perform pg_temp.cek('staf ditolak 42501', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform app.peta_isi(pa, 4);
      perform pg_temp.cek('staf tidak memanggil app.peta_isi langsung', false);
    exception when others then perform pg_temp.cek('staf tidak memanggil app.peta_isi langsung', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.usulkan_pasang_topi(o_dewi, t_kasir, gen_random_uuid());
      perform pg_temp.cek('staf tidak mengusulkan topi', false);
    exception when others then perform pg_temp.cek('staf tidak mengusulkan topi', sqlstate = '42501', sqlerrm);
    end;
    perform set_config('request.jwt.claims', kd, true);
    r := public.peta_organisasi(4);
    perform pg_temp.cek('admin aktif membaca peta', jsonb_array_length(r -> 'orang') = 4, r::text);
    perform set_config('request.jwt.claims', kk, true);
    r := public.peta_organisasi(4);
    perform pg_temp.cek('akuntan aktif membaca peta', jsonb_array_length(r -> 'orang') = 4, r::text);
    begin
      perform public.usulkan_pasang_topi(o_dewi, t_kasir, gen_random_uuid());
      perform pg_temp.cek('akuntan hanya membaca, tidak mengusulkan topi', false);
    exception when others then perform pg_temp.cek('akuntan hanya membaca, tidak mengusulkan topi', sqlstate = '42501', sqlerrm);
    end;
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id = ud;
    update public.anggota set peran = 'staf' where perusahaan_id = pa and user_id = ut;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.peta_organisasi(4);
      perform pg_temp.cek('admin dicabut (aktif=false) dengan JWT lama ditolak 42501', false);
    exception when others then perform pg_temp.cek('admin dicabut (aktif=false) dengan JWT lama ditolak 42501', sqlstate = '42501', sqlerrm);
    end;
    perform set_config('request.jwt.claims', kt, true);
    begin
      perform public.peta_organisasi(4);
      perform pg_temp.cek('admin diturunkan jadi staf dengan JWT lama ditolak 42501', false);
    exception when others then perform pg_temp.cek('admin diturunkan jadi staf dengan JWT lama ditolak 42501', sqlstate = '42501', sqlerrm);
    end;

    -- Pemilik A.
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.peta_organisasi(0);
      perform pg_temp.cek('p_minggu 0 ditolak 22023', false);
    exception when others then perform pg_temp.cek('p_minggu 0 ditolak 22023', sqlstate = '22023', sqlerrm);
    end;
    r := public.peta_organisasi(4);
    perform pg_temp.cek('jendela 28 hari zona usaha sampai hari ini', (r ->> 'akhir')::date = (now() at time zone 'Asia/Jakarta')::date
      and (r ->> 'mulai')::date = (r ->> 'akhir')::date - 27 and r ->> 'zona' = 'Asia/Jakarta' and (r ->> 'minggu')::int = 4 and (r ->> 'ambang')::int = 3, r::text);
    perform pg_temp.cek('11 kerja selesai, 25 poin: batal, jalan, 40 hari lalu, usaha B tidak dihitung',
      (r ->> 'selesai_n')::int = 11 and (r ->> 'poin')::numeric = 25, (r ->> 'selesai_n') || ' ' || (r ->> 'poin'));
    perform pg_temp.cek('orang di peta: punya topi atau kerja (Tono tanpa keduanya dihitung terpisah), urut nama',
      (select array_agg(x ->> 'nama' order by o) from jsonb_array_elements(r -> 'orang') with ordinality y(x, o)) = array['Budi Uji', 'Dewi Uji', 'Eko Uji', 'Sari Uji']
      and (r ->> 'tanpa_peta_n')::int = 1, r ->> 'orang');
    select x into e from jsonb_array_elements(r -> 'orang') x where (x ->> 'id')::uuid = o_dewi;
    perform pg_temp.cek('Dewi: 4 kerja, 10 poin, cukup, jabatan dari data, topi kertas pelayan',
      (e ->> 'n')::int = 4 and (e ->> 'poin')::numeric = 10 and (e ->> 'cukup')::boolean and e ->> 'jabatan' = 'Pelayan'
      and e -> 'topi_ids' = jsonb_build_array(t_pelayan), e::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where (x ->> 'id')::uuid = o_budi;
    perform pg_temp.cek('Budi: 1 kerja, belum cukup', (e ->> 'n')::int = 1 and not (e ->> 'cukup')::boolean, e::text);

    select x into e from jsonb_array_elements(r -> 'topi') x where (x ->> 'id')::uuid = t_kasir;
    perform pg_temp.cek('topi kasir: 6 kerja, 18 poin, cukup', (e ->> 'n')::int = 6 and (e ->> 'poin')::numeric = 18 and (e ->> 'cukup')::boolean, e::text);
    select x into e from jsonb_array_elements(r -> 'topi') x where (x ->> 'id')::uuid = t_pelayan;
    perform pg_temp.cek('ambang: pelayan 2 kerja belum cukup', (e ->> 'n')::int = 2 and not (e ->> 'cukup')::boolean, e::text);
    select x into e from jsonb_array_elements(r -> 'topi') x where (x ->> 'id')::uuid = t_gudang;
    perform pg_temp.cek('ambang: gudang tepat 3 kerja cukup', (e ->> 'n')::int = 3 and (e ->> 'cukup')::boolean, e::text);
    perform pg_temp.cek('topi bawaan paket tanpa pemakai dan tanpa kerja tidak tampil', jsonb_array_length(r -> 'topi') = 3, r ->> 'topi');

    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_sari and (x ->> 'topi_id')::uuid = t_kasir;
    perform pg_temp.cek('Sari-kasir: kertas porsi 100, 3 kerja 10 poin, 56% kasir, 100% Sari, bukan lintas',
      (g ->> 'kertas')::boolean and (g ->> 'porsi')::numeric = 100 and (g ->> 'n')::int = 3 and (g ->> 'poin')::numeric = 10
      and (g ->> 'persen_topi')::int = 56 and (g ->> 'persen_orang')::int = 100 and not (g ->> 'lintas')::boolean and (g ->> 'lintas_n')::int = 0, g::text);
    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_budi and (x ->> 'topi_id')::uuid = t_kasir;
    perform pg_temp.cek('Budi-kasir: 11% kasir, persen orang null (belum cukup)', (g ->> 'persen_topi')::int = 11 and g -> 'persen_orang' = 'null'::jsonb, g::text);
    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_dewi and (x ->> 'topi_id')::uuid = t_kasir;
    perform pg_temp.cek('Dewi-kasir lintas topi: tanpa kertas, 2 kerja lintas (jalan tidak dihitung), 33% kasir, 60% kerja Dewi',
      not (g ->> 'kertas')::boolean and g -> 'porsi' = 'null'::jsonb and (g ->> 'lintas')::boolean and (g ->> 'lintas_n')::int = 2
      and (g ->> 'lintas_poin')::numeric = 6 and (g ->> 'persen_topi')::int = 33 and (g ->> 'persen_lintas')::int = 60, g::text);
    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_dewi and (x ->> 'topi_id')::uuid = t_pelayan;
    perform pg_temp.cek('Dewi-pelayan: persen topi null (pelayan < 3 kerja), 40% kerja Dewi',
      g -> 'persen_topi' = 'null'::jsonb and (g ->> 'persen_orang')::int = 40 and (g ->> 'kertas')::boolean, g::text);
    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_budi and (x ->> 'topi_id')::uuid = t_gudang;
    perform pg_temp.cek('Budi-gudang: di kertas, 0 kerja, 0% gudang', (g ->> 'kertas')::boolean and (g ->> 'n')::int = 0 and (g ->> 'persen_topi')::int = 0, g::text);
    perform pg_temp.cek('lintas topi dihitung dari kerja.lintas_topi',
      (select count(*) from public.kerja where perusahaan_id = pa and status = 'selesai' and lintas_topi and selesai_at > now() - interval '28 days')
      = (select sum((x ->> 'lintas_n')::int) from jsonb_array_elements(r -> 'garis') x), r ->> 'garis');

    perform pg_temp.cek('kalimat kepala dari SQL', r ->> 'kepala' = 'Dewi Uji mengerjakan 60% urusan kasir walau topinya pelayan.', r ->> 'kepala');
    perform pg_temp.cek('saran pasang topi: hanya Dewi-kasir (>= 30% dan belum dipakai)', jsonb_array_length(r -> 'saran') = 1
      and (r #>> '{saran,0,orang_id}')::uuid = o_dewi and (r #>> '{saran,0,topi_id}')::uuid = t_kasir and (r #>> '{saran,0,persen}')::int = 60
      and r #> '{saran,0,usulan_id}' = 'null'::jsonb, r ->> 'saran');

    select x into e from jsonb_array_elements(r -> 'serah') x where (x ->> 'pemberi_id')::uuid = o_sari and (x ->> 'pelaksana_id')::uuid = o_dewi;
    perform pg_temp.cek('alur serah Sari -> Dewi: 3 kerja (2 selesai, 1 jalan), batal tidak dihitung',
      (e ->> 'n')::int = 3 and (e ->> 'selesai_n')::int = 2 and e ->> 'pemberi_nama' = 'Sari Uji' and e ->> 'pelaksana_nama' = 'Dewi Uji', e::text);
    select x into e from jsonb_array_elements(r -> 'serah') x where x ->> 'pemberi_peran' = 'pemilik';
    perform pg_temp.cek('alur serah pemilik tanpa data orang -> Budi: 1 kerja, dari kejadian kerja.buat',
      (e ->> 'pelaksana_id')::uuid = o_budi and (e ->> 'n')::int = 1 and e ->> 'pemberi_nama' = 'Pemilik' and e -> 'pemberi_id' = 'null'::jsonb, e::text);
    perform pg_temp.cek('kerja tanpa pemberi dan tanpa jejak pembuat dihitung terpisah', jsonb_array_length(r -> 'serah') = 2
      and (r ->> 'serah_tanpa_pemberi')::int = 9, (r ->> 'serah_tanpa_pemberi') || ' ' || (r ->> 'serah'));

    r := public.peta_organisasi(1);
    perform pg_temp.cek('jendela 1 minggu: 8 kerja selesai (10 dan 20 hari lalu, 8 hari lalu tidak)', (r ->> 'selesai_n')::int = 8, r ->> 'selesai_n');

    perform pg_temp.cek('isolasi tenant: A tidak membaca usaha B', public.peta_organisasi(4)::text not like '%Rahasia%'
      and public.peta_organisasi(4)::text not like '%' || t_b || '%');
    perform set_config('request.jwt.claims', kb, true);
    r := public.peta_organisasi(4);
    perform pg_temp.cek('isolasi tenant: B hanya orang dan topinya sendiri', jsonb_array_length(r -> 'orang') = 1 and r::text not like '%Uji%'
      and (r ->> 'selesai_n')::int = 1 and r ->> 'kepala' = 'Kerja 4 minggu terakhir sesuai topi di atas kertas.', r::text);
    begin
      perform public.usulkan_pasang_topi(o_dewi, t_kasir, gen_random_uuid());
      perform pg_temp.cek('pemilik B tidak mengusulkan topi untuk orang A', false);
    exception when others then perform pg_temp.cek('pemilik B tidak mengusulkan topi untuk orang A', sqlstate = '22023', sqlerrm);
    end;

    -- Usulan pasang topi.
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.usulkan_pasang_topi(o_sari, t_kasir, gen_random_uuid());
      perform pg_temp.cek('topi yang sudah dipakai tidak diusulkan', false);
    exception when others then perform pg_temp.cek('topi yang sudah dipakai tidak diusulkan', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.usulkan_pasang_topi(o_budi, t_pelayan, gen_random_uuid());
      perform pg_temp.cek('tanpa kerja lintas >= 30% tidak diusulkan', false);
    exception when others then perform pg_temp.cek('tanpa kerja lintas >= 30% tidak diusulkan', sqlstate = '22023', sqlerrm);
    end;
    r := public.usulkan_pasang_topi(o_dewi, t_kasir, kunci);
    id_usulan := (r ->> 'id')::uuid;
    perform pg_temp.cek('usulan pertama dibuat', id_usulan is not null and not (r ->> 'sudah')::boolean and r ->> 'status' = 'menunggu', r::text);
    r := public.usulkan_pasang_topi(o_dewi, t_kasir, kunci);
    perform pg_temp.cek('kiriman ulang kunci sama: usulan yang sama', (r ->> 'id')::uuid = id_usulan and (r ->> 'sudah')::boolean, r::text);
    r := public.usulkan_pasang_topi(o_dewi, t_kasir, gen_random_uuid());
    perform pg_temp.cek('usulan menunggu untuk pasangan sama tidak digandakan', (r ->> 'id')::uuid = id_usulan and (r ->> 'sudah')::boolean, r::text);
    begin
      perform public.usulkan_pasang_topi(o_eko, t_kasir, kunci);
      perform pg_temp.cek('kunci yang sudah dipakai untuk pasangan lain ditolak', false);
    exception when others then perform pg_temp.cek('kunci yang sudah dipakai untuk pasangan lain ditolak', sqlstate = '22023', sqlerrm);
    end;
    execute 'reset role';
    select to_jsonb(u) into e from public.usulan u where id = id_usulan;
    select count(*) into v_n from public.usulan where perusahaan_id = pa and aksi = 'orang.topi';
    perform pg_temp.cek('satu usulan orang.topi untuk pemilik dengan payload, kunci, judul',
      v_n = 1 and e -> 'untuk_peran' = '["pemilik"]'::jsonb and e ->> 'sumber' = 'peta' and e ->> 'judul' = 'Pasang topi kasir ke Dewi Uji'
      and e -> 'payload' = jsonb_build_object('orang_id', o_dewi, 'topi_id', t_kasir, 'persen', 60, 'minggu', 4) and (e ->> 'kunci_klien')::uuid = kunci
      and e ->> 'penjelasan' like 'Dewi Uji mengerjakan 60% urusan kasir 4 minggu terakhir (6 dari 10 poin kerjanya) walau topinya pelayan.%', e::text);
    perform pg_temp.cek('usulan pemilik saja tidak diantre ke rute model',
      not exists (select 1 from public.keputusan where subjek_id = id_usulan) and not exists (select 1 from app.rute_model where usulan_id = id_usulan));
    execute 'set local role authenticated';
    perform pg_temp.cek('peta menandai usulan menunggu pada saran', (public.peta_organisasi(4) #>> '{saran,0,usulan_id}')::uuid = id_usulan);

    r := public.putuskan_usulan(id_usulan, true);
    perform pg_temp.cek('pemilik menyetujui: topi kasir terpasang ke Dewi, satu kejadian', r ->> 'status' = 'diterima' and (r ->> 'dibuat')::int = 1
      and exists (select 1 from public.pakai_topi where orang_id = o_dewi and topi_id = t_kasir and porsi = 60 and selesai is null)
      and exists (select 1 from public.pakai_topi where orang_id = o_dewi and topi_id = t_pelayan and selesai is null)
      and exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'orang.topi' and orang_id = o_dewi and data ->> 'usulan_id' = id_usulan::text), r::text);
    r := public.peta_organisasi(4);
    select x into g from jsonb_array_elements(r -> 'garis') x where (x ->> 'orang_id')::uuid = o_dewi and (x ->> 'topi_id')::uuid = t_kasir;
    perform pg_temp.cek('setelah disetujui: Dewi-kasir di kertas, bukan lintas lagi, tanpa saran, kepala sesuai kertas',
      (g ->> 'kertas')::boolean and not (g ->> 'lintas')::boolean and (g ->> 'lintas_n')::int = 2 and jsonb_array_length(r -> 'saran') = 0
      and r ->> 'kepala' = 'Kerja 4 minggu terakhir sesuai topi di atas kertas.', r::text);

    -- Usaha tanpa kerja selesai.
    execute 'reset role';
    update public.kerja set status = 'batal' where perusahaan_id = pb;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    r := public.peta_organisasi(4);
    perform pg_temp.cek('kosong: kalimat ajakan dari SQL', (r ->> 'selesai_n')::int = 0
      and r ->> 'kepala' = 'Belum ada kerja selesai 4 minggu terakhir. Peta muncul setelah kerja ditandai Selesai di papan.', r ->> 'kepala');

    execute 'set local role anon';
    begin
      perform public.peta_organisasi(4);
      perform pg_temp.cek('anon ditolak 42501', false);
    exception when others then perform pg_temp.cek('anon ditolak 42501', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.usulkan_pasang_topi(o_dewi, t_kasir, gen_random_uuid());
      perform pg_temp.cek('anon tidak mengusulkan topi', false);
    exception when others then perform pg_temp.cek('anon tidak mengusulkan topi', sqlstate = '42501', sqlerrm);
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
