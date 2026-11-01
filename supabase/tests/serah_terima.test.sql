-- Tes F3-07 serah terima (docs/research/serah-terima-sql.md): catat berhenti menyusun paket (topi, kerja berjalan dengan
-- pengganti, ilmu dari topi yang hanya dipakai orang itu, akses otomatis dan manual), peringatan 30 hari tidak memblokir,
-- pemilik tidak bisa diberhentikan, kerja dipindah ke pengganti, akses dicabut SETELAH tanggal efektif (bukan pada harinya):
-- anggota nonaktif, orang nonaktif, topi berakhir, token tablet dicabut, akun staf dikunci; JWT lama ditolak; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; ks text; kd text; t_kasir uuid; t_gudang uuid; o_sari uuid; o_budi uuid; o_dewi uuid; o_pem uuid;
  u_sari uuid; u_dewi uuid; k1 uuid; k2 uuid; tp uuid; r jsonb; r2 jsonb; bh uuid; n int; x text; v_hari date; v_ef date; kunci uuid := gen_random_uuid();
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada', to_regclass('public.berhenti') is not null and to_regclass('public.serah_butir') is not null
      and to_regprocedure('public.catat_berhenti(uuid,date,date,text,uuid)') is not null and to_regprocedure('app.cabut_akses_berhenti(date)') is not null);
    perform pg_temp.cek('pencabut tidak bisa dipanggil klien; terjadwal tiap jam', not has_function_privilege('authenticated', 'app.cabut_akses_berhenti(date)', 'execute')
      and exists (select 1 from cron.job where jobname = 'nadi-cabut-berhenti'));
    perform pg_temp.cek('RPC memeriksa peran lewat peran_aktif',
      (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.catat_berhenti(uuid,date,date,text,uuid)'::regprocedure, 'public.pindahkan_ke_pengganti(uuid)'::regprocedure,
                      'public.tandai_butir(uuid,text,uuid)'::regprocedure, 'public.batal_berhenti(uuid,text)'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Serah', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Serah B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_st', 'Kasir ST') returning id into t_kasir;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'gudang_st', 'Gudang ST') returning id into t_gudang;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Serah') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Serah') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Serah') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Pemilik Serah') returning id into o_pem;
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_dewi, '123456');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    v_ef := v_hari + 10;
    select user_id into u_sari from public.orang where id = o_sari;
    select user_id into u_dewi from public.orang where id = o_dewi;
    update public.anggota set orang_id = o_pem where perusahaan_id = pa and user_id = ua;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai) values
      (pa, o_sari, t_kasir, 50, v_hari - 100), (pa, o_sari, t_gudang, 50, v_hari - 100), (pa, o_budi, t_kasir, 100, v_hari - 100), (pa, o_dewi, t_kasir, 100, v_hari - 100);
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status) values (pa, 'Tutup kas malam', t_kasir, o_sari, 'baru') returning id into k1;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status) values (pa, 'Hitung stok gudang', t_gudang, o_sari, 'baru') returning id into k2;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status) values (pa, 'Kerja lama selesai', t_kasir, o_sari, 'selesai');
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status) values (pa, 'Kerja Dewi', t_kasir, o_dewi, 'baru');
    insert into public.tempat (perusahaan_id, jalur, nama, jenis) values (pa, 'outlet_st', 'Outlet ST', 'lokasi') returning id into tp;
    insert into app.token_kios (perusahaan_id, tempat_id, hash, nama, dibuat_oleh) values (pa, tp, repeat('ab', 32), 'Tablet pintu', u_sari);
    ks := json_build_object('sub', u_sari, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kd := json_build_object('sub', u_dewi, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Catat berhenti.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.catat_berhenti(o_sari, v_hari, v_ef, 'mundur', gen_random_uuid());
      perform pg_temp.cek('staf tidak bisa mencatat berhenti', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mencatat berhenti', true);
    end;
    perform set_config('request.jwt.claims', ka, true);
    r := public.catat_berhenti(o_sari, v_hari, v_ef, 'mundur', kunci);
    bh := (r ->> 'id')::uuid;
    perform pg_temp.cek('peringatan kurang 30 hari tidak memblokir', r -> 'peringatan' ? 'kurang_30_hari' and bh is not null, r::text);
    select string_agg(jenis || ':' || c, ',' order by jenis) into x from (select jenis, count(*) c from public.serah_butir where berhenti_id = bh group by jenis) s;
    perform pg_temp.cek('paket: 2 topi, 2 kerja berjalan, 1 ilmu, 2 akses otomatis, 4 akses manual', x = 'akses_manual:4,akses_otomatis:2,ilmu:1,kerja:2,topi:2', x);
    perform pg_temp.cek('ilmu dari topi yang hanya dipakai orang itu', exists (select 1 from public.serah_butir where berhenti_id = bh and jenis = 'ilmu' and topi_id = t_gudang));
    perform pg_temp.cek('pengganti kerja kasir: rekan bertopi sama dengan kerja terbuka paling sedikit (Budi), bukan yang berhenti',
      (select pengganti_id from public.serah_butir where berhenti_id = bh and kerja_id = k1) = o_budi);
    perform pg_temp.cek('kerja gudang tanpa pengganti (tidak ada rekan bertopi gudang)', (select pengganti_id from public.serah_butir where berhenti_id = bh and kerja_id = k2) is null);
    perform pg_temp.cek('kunci sama: paket yang sama', (public.catat_berhenti(o_sari, v_hari, v_ef, 'mundur', kunci) ->> 'id')::uuid = bh
      and (select count(*) from public.berhenti where orang_id = o_sari) = 1);
    begin
      perform public.catat_berhenti(o_sari, v_hari, v_ef + 5, 'mundur', gen_random_uuid());
      perform pg_temp.cek('satu proses berhenti aktif per orang', false);
    exception when others then perform pg_temp.cek('satu proses berhenti aktif per orang', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.catat_berhenti(o_pem, v_hari, v_hari + 40, 'lainnya', gen_random_uuid());
      perform pg_temp.cek('pemilik tidak bisa diberhentikan lewat Nadi', false);
    exception when others then perform pg_temp.cek('pemilik tidak bisa diberhentikan lewat Nadi', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.catat_berhenti(o_budi, v_hari, v_hari - 1, 'lainnya', gen_random_uuid());
      perform pg_temp.cek('tanggal efektif sebelum surat ditolak', false);
    exception when others then perform pg_temp.cek('tanggal efektif sebelum surat ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;

    -- Staf tidak melihat paket; usaha lain terpisah.
    perform set_config('request.jwt.claims', kd, true);
    select count(*) into n from public.serah_butir;
    perform pg_temp.cek('staf lain tidak melihat paket', n = 0 and (select count(*) from public.berhenti) = 0, n::text);
    perform set_config('request.jwt.claims', kb, true);
    select count(*) into n from public.berhenti;
    perform pg_temp.cek('usaha lain tidak melihat berhenti', n = 0, n::text);
    begin
      perform public.pindahkan_ke_pengganti(bh);
      perform pg_temp.cek('usaha lain tidak bisa memindah kerja', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa memindah kerja', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;

    -- Pindahkan ke pengganti.
    perform set_config('request.jwt.claims', ka, true);
    -- Dua pernyataan: subkueri di pernyataan yang sama dengan pemanggilan fungsi memakai snapshot sebelum fungsi menulis.
    n := public.pindahkan_ke_pengganti(bh);
    perform pg_temp.cek('pindahkan memindah kerja yang punya pengganti', n = 1
      and (select pelaksana_id from public.kerja where id = k1) = o_budi and (select pelaksana_id from public.kerja where id = k2) = o_sari
      and (select status from public.serah_butir where berhenti_id = bh and kerja_id = k1) = 'selesai');
    perform public.tandai_butir((select id from public.serah_butir where berhenti_id = bh and jenis = 'akses_manual' order by judul limit 1), 'selesai', null);
    perform pg_temp.cek('pemilik mencentang akses manual', (select count(*) from public.serah_butir where berhenti_id = bh and jenis = 'akses_manual' and status = 'selesai') = 1);

    -- Pencabutan: pada hari efektif belum; sehari sesudahnya ya.
    execute 'reset role';
    perform pg_temp.cek('pada tanggal efektif akses belum dicabut', app.cabut_akses_berhenti(v_ef) = 0
      and (select aktif from public.anggota where perusahaan_id = pa and user_id = u_sari));
    perform pg_temp.cek('sehari setelah tanggal efektif akses dicabut', app.cabut_akses_berhenti(v_ef + 1) = 1);
    perform pg_temp.cek('anggota dan orang nonaktif, topi berakhir di tanggal efektif',
      not (select aktif from public.anggota where perusahaan_id = pa and user_id = u_sari)
      and (select status from public.orang where id = o_sari) = 'nonaktif'
      and not exists (select 1 from public.pakai_topi where orang_id = o_sari and (selesai is null or selesai > v_ef)));
    perform pg_temp.cek('token tablet buatannya dicabut, akun staf dikunci', (select dicabut_at is not null from app.token_kios where dibuat_oleh = u_sari)
      and (select banned_until > now() + interval '100 years' from auth.users where id = u_sari));
    perform pg_temp.cek('paket selesai, butir akses otomatis selesai', (select status = 'selesai' and dicabut_at is not null from public.berhenti where id = bh)
      and not exists (select 1 from public.serah_butir where berhenti_id = bh and jenis = 'akses_otomatis' and status <> 'selesai'));
    perform pg_temp.cek('pencabut idempoten', app.cabut_akses_berhenti(v_ef + 2) = 0);
    perform pg_temp.cek('rekan tidak tersentuh', (select aktif from public.anggota where perusahaan_id = pa and user_id = u_dewi)
      and (select banned_until from auth.users where id = u_dewi) is null);

    -- JWT lama orang yang berhenti.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('JWT lama ditolak: orang, kerja, kejadian, usulan, slip 0 baris',
      (select count(*) from public.orang) = 0 and (select count(*) from public.kerja) = 0 and (select count(*) from public.kejadian) = 0
      and (select count(*) from public.usulan) = 0 and (select count(*) from public.slip_gaji) = 0);

    -- Batal.
    perform set_config('request.jwt.claims', ka, true);
    r := public.catat_berhenti(o_budi, v_hari, v_hari + 45, 'kontrak_selesai', gen_random_uuid());
    perform pg_temp.cek('kontrak selesai tanpa peringatan 30 hari', jsonb_array_length(r -> 'peringatan') = 0, r::text);
    perform public.batal_berhenti((r ->> 'id')::uuid, 'Kontrak diperpanjang');
    execute 'reset role';
    perform pg_temp.cek('berhenti dibatalkan tidak dicabut', app.cabut_akses_berhenti(v_hari + 50) = 0 and (select status from public.orang where id = o_budi) = 'aktif');
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
