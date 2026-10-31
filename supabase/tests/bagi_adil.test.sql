-- Tes Pembagi kerja adil (F3-02): beban minggu dari poin estimasi (bukan durasi aktual), hanya kerja selesai minggu ini dan yang
-- berjalan, kerja batal dan minggu lalu tidak dihitung, orang nonaktif tidak ikut; staf hanya melihat bebannya dan rata-rata tim
-- tanpa nama rekan; usulan pelaksana memilih yang paling ringan di topi yang cocok, seri diputus dengan yang paling lama tidak
-- diberi kerja, antre ikut dihitung; usaha lain tidak melihat apa pun. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; pa uuid; pb uuid; ka text; kb text; ks text;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_tono uuid; o_lama uuid; o_b uuid; t_kasir uuid; t_cuci uuid; t_gudang uuid; t_b uuid;
  v_mulai timestamptz; v_zona text; r jsonb; e jsonb;
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
    insert into public.topi (perusahaan_id, kode, nama) values (pb, 'kasir_b_uji', 'Kasir B') returning id into t_b;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pb, o_b, t_b);

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Uji') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Uji') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Uji') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Uji') returning id into o_tono;
    insert into public.orang (perusahaan_id, nama, status) values (pa, 'Lama Uji', 'nonaktif') returning id into o_lama;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_adil_uji', 'Kasir Adil') returning id into t_kasir;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'cuci_adil_uji', 'Pencuci Adil') returning id into t_cuci;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'gudang_adil_uji', 'Gudang Adil') returning id into t_gudang;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values
      (pa, o_sari, t_kasir), (pa, o_budi, t_kasir), (pa, o_dewi, t_kasir), (pa, o_tono, t_cuci), (pa, o_lama, t_kasir);
    perform public.buat_akun_staf(o_sari, '123456');
    select user_id into us from public.orang where id = o_sari;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Data minggu ini (zona usaha). Sari: 5 + 3 selesai (aktual 600 menit, tidak dipakai) + 1 lintas topi = 9. Budi: 2 selesai + 1
    -- jalan = 3. Dewi: 3 selesai; 10 minggu lalu (tidak dihitung).
    -- Budi 10 batal (tidak dihitung). Lama (nonaktif) 1 selesai. Tono 0. Kerja selesai usaha minggu ini: 3 + 1 + 1 + 1 + 1 = 7.
    execute 'reset role';
    select (date_trunc('week', now() at time zone p.zona_waktu))::timestamp at time zone p.zona_waktu, p.zona_waktu into v_mulai, v_zona
      from public.perusahaan p where p.id = pa;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, mulai_at, selesai_at, dibuat_at, data) values
      (pa, 'Tutup kas', t_kasir, o_sari, 'selesai', 5, v_mulai + interval '1 hour', v_mulai + interval '11 hours', v_mulai, '{"aktual_menit": 600}'),
      (pa, 'Rekap nota', t_kasir, o_sari, 'selesai', 3, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai, '{"aktual_menit": 600}'),
      (pa, 'Cuci gelas', t_cuci, o_sari, 'selesai', 1, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai, '{}'),
      (pa, 'Buka kas', t_kasir, o_budi, 'selesai', 2, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai, '{"aktual_menit": 1}'),
      (pa, 'Hitung laci', t_kasir, o_budi, 'jalan', 1, v_mulai + interval '1 hour', null, v_mulai, '{}'),
      (pa, 'Stok opname', t_kasir, o_budi, 'batal', 10, null, null, v_mulai, '{}'),
      (pa, 'Setor bank', t_kasir, o_dewi, 'selesai', 3, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai, '{}'),
      (pa, 'Kas minggu lalu', t_kasir, o_dewi, 'selesai', 10, v_mulai - interval '3 days', v_mulai - interval '2 days', now() - interval '9 days', '{}'),
      (pa, 'Kerja orang lama', t_kasir, o_lama, 'selesai', 1, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai, '{}');
    -- Kerja minggu ini tanpa pelaksana, ikut hitungan selesai usaha.
    insert into public.kerja (perusahaan_id, judul, status, poin_beban, selesai_at) values (pa, 'Sapu teras', 'selesai', 1, v_mulai + interval '3 hours');
    -- Terakhir diberi kerja: Dewi 1 menit lewat awal minggu, Budi 2 menit, jadi Dewi yang paling lama tidak diberi kerja.
    update public.kerja set dibuat_at = v_mulai + interval '1 minute' where perusahaan_id = pa and pelaksana_id = o_dewi and judul = 'Setor bank';
    update public.kerja set dibuat_at = v_mulai + interval '2 minutes' where perusahaan_id = pa and pelaksana_id = o_budi;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);

    -- Pemilik: beban minggu ini.
    r := public.beban_minggu();
    perform pg_temp.cek('beban: minggu mulai Senin zona usaha, jam sama rata 40', (r ->> 'mulai')::date = (v_mulai at time zone v_zona)::date
      and (r ->> 'jam_sama_rata')::boolean and (r ->> 'jam_bawaan')::int = 40 and (r ->> 'akhir')::date = (r ->> 'mulai')::date + 6, r::text);
    perform pg_temp.cek('beban: hanya 4 orang aktif (nonaktif tidak ikut)', jsonb_array_length(r -> 'orang') = 4
      and not exists (select 1 from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Lama Uji'), (r -> 'orang')::text);
    perform pg_temp.cek('kerja selesai usaha minggu ini = 7 (termasuk tanpa pelaksana dan orang nonaktif)', (r ->> 'selesai_n')::int = 7, r ->> 'selesai_n');
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Sari Uji';
    perform pg_temp.cek('Sari 9 poin dari estimasi, bukan durasi aktual 600 menit', (e ->> 'poin')::numeric = 9, e::text);
    perform pg_temp.cek('Sari: 1 poin lintas topi, 3 kerja selesai, beban per jam 0,225',
      (e ->> 'lintas_poin')::numeric = 1 and (e ->> 'lintas_n')::int = 1 and (e ->> 'selesai_n')::int = 3 and (e ->> 'beban_per_jam')::numeric = 0.225
      and e -> 'topi' = '["Kasir Adil"]'::jsonb, e::text);
    perform pg_temp.cek('urut beban per jam terbesar: Sari pertama, Tono terakhir',
      r -> 'orang' -> 0 ->> 'nama' = 'Sari Uji' and r -> 'orang' -> 3 ->> 'nama' = 'Tono Uji', (r -> 'orang')::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Budi Uji';
    perform pg_temp.cek('Budi 3 = 2 selesai + 1 berjalan; kerja batal 10 tidak dihitung', (e ->> 'poin')::numeric = 3 and (e ->> 'antre')::numeric = 0, e::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Dewi Uji';
    perform pg_temp.cek('Dewi 3: kerja minggu lalu 10 tidak dihitung', (e ->> 'poin')::numeric = 3, e::text);
    r := public.beban_minggu(((v_mulai at time zone v_zona)::date - 7));
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Dewi Uji';
    perform pg_temp.cek('minggu lalu: Dewi 10', (e ->> 'poin')::numeric = 10, e::text);

    -- Usulan pelaksana.
    r := public.usulan_pelaksana(t_kasir, 2);
    perform pg_temp.cek('usulan kasir: Budi dan Dewi seri 3 poin, Dewi lebih lama tidak diberi kerja',
      (r ->> 'orang_id')::uuid = o_dewi and (r ->> 'seri')::boolean and (r ->> 'kandidat')::int = 3, r::text);
    perform pg_temp.cek('alasan satu kalimat', r ->> 'alasan' = 'Dewi Uji: 3 poin minggu ini, paling ringan di antara kasir adil; sama ringan dengan Budi Uji.', r ->> 'alasan');
    perform pg_temp.cek('Tono (0 poin) tidak diusulkan untuk kasir karena tidak memakai topi kasir', (r ->> 'orang_id')::uuid <> o_tono);
    perform public.buat_kerja('Tata etalase', t_kasir, o_dewi, null);
    execute 'reset role';
    update public.kerja set poin_beban = 2 where perusahaan_id = pa and judul = 'Tata etalase';
    execute 'set local role authenticated';
    r := public.usulan_pelaksana(t_kasir, null);
    perform pg_temp.cek('antre ikut dihitung: Dewi 3 + 2 antre, usulan pindah ke Budi', (r ->> 'orang_id')::uuid = o_budi and not (r ->> 'seri')::boolean
      and r ->> 'alasan' = 'Budi Uji: 3 poin minggu ini, paling ringan di antara kasir adil.', r::text);
    select x into e from jsonb_array_elements(public.beban_minggu() -> 'orang') x where x ->> 'nama' = 'Dewi Uji';
    perform pg_temp.cek('antre tampil terpisah, tidak menambah poin minggu ini', (e ->> 'poin')::numeric = 3 and (e ->> 'antre')::numeric = 2, e::text);
    r := public.usulan_pelaksana(t_cuci, 1);
    perform pg_temp.cek('satu-satunya pemakai topi', (r ->> 'orang_id')::uuid = o_tono
      and r ->> 'alasan' = 'Tono Uji: satu-satunya yang memakai topi pencuci adil, 0 poin minggu ini.', r::text);
    perform pg_temp.cek('topi tanpa pemakai: tanpa usulan', public.usulan_pelaksana(t_gudang, 1) is null);
    begin
      perform public.usulan_pelaksana(t_b, 1);
      perform pg_temp.cek('topi usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('topi usaha lain ditolak', sqlstate = 'P0002', sqlerrm);
    end;
    begin
      perform public.usulan_pelaksana(null, 1);
      perform pg_temp.cek('usulan tanpa topi ditolak', false);
    exception when others then perform pg_temp.cek('usulan tanpa topi ditolak', sqlstate = '22023', sqlerrm);
    end;

    -- Staf: hanya bebannya dan rata-rata tim, tanpa nama atau angka rekan.
    perform set_config('request.jwt.claims', ks, true);
    r := public.beban_saya();
    perform pg_temp.cek('staf: bebannya 9, rata-rata tim (9 + 3 + 3 + 0) / 4 = 3,8, di atas 1,5 kali',
      (r ->> 'poin')::numeric = 9 and (r ->> 'rata_rata')::numeric = 3.8 and (r ->> 'n')::int = 4 and (r ->> 'di_atas')::boolean, r::text);
    perform pg_temp.cek('staf: jawaban tanpa nama dan tanpa daftar orang',
      not (r ? 'orang') and r::text not like '%Budi%' and r::text not like '%Dewi%' and r::text not like '%Tono%', r::text);
    begin
      perform public.beban_minggu();
      perform pg_temp.cek('staf tidak melihat beban semua orang', false);
    exception when others then perform pg_temp.cek('staf tidak melihat beban semua orang', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.usulan_pelaksana(t_kasir, 1);
      perform pg_temp.cek('staf tidak meminta usulan pelaksana', false);
    exception when others then perform pg_temp.cek('staf tidak meminta usulan pelaksana', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform app.beban_orang(pa, current_date);
      perform pg_temp.cek('staf tidak memanggil app.beban_orang langsung', false);
    exception when others then perform pg_temp.cek('staf tidak memanggil app.beban_orang langsung', sqlstate = '42501', sqlerrm);
    end;

    -- Usaha lain.
    perform set_config('request.jwt.claims', kb, true);
    r := public.beban_minggu();
    perform pg_temp.cek('usaha lain hanya melihat orangnya sendiri', jsonb_array_length(r -> 'orang') = 1 and r -> 'orang' -> 0 ->> 'nama' = 'Rahasia B'
      and r::text not like '%Uji%' and (r ->> 'selesai_n')::int = 0, r::text);
    r := public.beban_saya();
    perform pg_temp.cek('usaha lain: tim kurang dari 3 orang, rata-rata disembunyikan', r -> 'rata_rata' = 'null'::jsonb and (r ->> 'n')::int = 1, r::text);
    execute 'set local role anon';
    begin
      perform public.beban_minggu();
      perform pg_temp.cek('anon tidak memanggil beban_minggu', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil beban_minggu', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.beban_saya();
      perform pg_temp.cek('anon tidak memanggil beban_saya', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil beban_saya', sqlstate = '42501', sqlerrm);
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
