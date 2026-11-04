-- Tes W-04 onboarding AI milikmu (supabase/migrations/20261104060000_onboarding_ai.sql). Cetak biru = 12 butir (hasil pengurai
-- Teks Nadi untuk contoh di prompt: profil, 8 orang, fitur, 2 aturan izin) menjadi 12 usulan; ulang tidak menggandakan;
-- aksi lain, NIK, angka panjang, dan kunci uang ditolak; disetujui = orang bertopi, kebijakan izin, profil, fitur. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  res text := 'https://nadi.uji/api/mcp'; ver text := repeat('v', 50); chal text; kode text; t jsonb;
  r jsonb; k uuid := gen_random_uuid(); butir jsonb; u record; n int;
  orang jsonb := '[]';
begin
  begin
    chal := translate(rtrim(encode(sha256(convert_to(ver, 'utf8')), 'base64'), '='), '+/', '-_');
    insert into auth.users (id, email) values (ua, 'oa@uji.local'), (ub, 'ob@uji.local'), (us, 'os@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Onboarding', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Warung Uji Onboarding B', 'fnb');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    for u in select * from (values ('Sari Dewi', 'kasir, pelayan', '2024-03-01'), ('Komang Ayu', 'koki', '2025-01-15'), ('Made Putra', 'koki', '2023-07-10'),
        ('Wayan Sari', 'pelayan', '2025-06-02'), ('Ketut Arta', 'pelayan', ''), ('Nyoman Budi', 'kurir', '2024-11-20'), ('Putu Lestari', 'kasir', '2026-02-01'), ('Gede Wira', 'gudang', '')) x(nama, topi, mulai) loop
      orang := orang || jsonb_build_array(jsonb_build_object('aksi', 'orang.impor', 'judul', 'Tambah ' || u.nama,
        'bidang', jsonb_build_object('baris', jsonb_build_array(jsonb_build_object('id', '', 'nama', u.nama, 'jabatan', u.topi, 'telepon', '', 'mulai', u.mulai)))));
    end loop;
    butir := jsonb_build_array(jsonb_build_object('aksi', 'onboarding.usaha', 'judul', 'Atur profil usaha', 'bidang', jsonb_build_object('negara', 'ID', 'kota', 'Denpasar', 'skala', '6-15', 'cabang', 1, 'jenis', 'warung makan')))
      || orang
      || jsonb_build_array(jsonb_build_object('aksi', 'onboarding.fitur', 'judul', 'Pakai fitur: lempar, absen', 'bidang', jsonb_build_object('fitur', jsonb_build_array('lempar', 'absen', 'gaji'))),
           jsonb_build_object('aksi', 'onboarding.izin', 'judul', 'Aturan sakit', 'bidang', jsonb_build_object('jenis', 'sakit', 'otomatis', true, 'maks_hari', 1, 'butuh_bukti', true, 'jatah_tahunan', null)),
           jsonb_build_object('aksi', 'onboarding.izin', 'judul', 'Aturan izin', 'bidang', jsonb_build_object('jenis', 'izin', 'otomatis', true, 'maks_hari', 1, 'butuh_bukti', false, 'jatah_tahunan', null)));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.usul_onboarding(butir, k);
    perform pg_temp.cek('cetak biru contoh menjadi 12 usulan', (r ->> 'dibuat')::int = 12 and (select count(*) = 12 from public.usulan where sumber = 'ai_milikmu'), r::text);
    r := public.usul_onboarding(butir, k);
    perform pg_temp.cek('tempel ulang dengan kunci sama tidak menggandakan', (r ->> 'dibuat')::int = 0 and (r ->> 'sudah')::int = 12, r::text);
    perform pg_temp.cek('profil usaha hanya untuk pemilik, lainnya pemilik dan admin',
      (select untuk_peran = '{pemilik}' from public.usulan where aksi = 'onboarding.usaha') and (select bool_and(untuk_peran = '{pemilik,admin}') from public.usulan where aksi = 'orang.impor'));
    perform pg_temp.cek('belum ada yang tercatat sebelum disetujui', (select count(*) = 0 from public.orang where perusahaan_id = pa)
      and not exists (select 1 from public.kebijakan_izin where perusahaan_id = pa));

    begin
      perform public.usul_onboarding('[{"aksi": "uang.keluar", "judul": "Bayar pemasok", "bidang": {"total": 1}}]', gen_random_uuid());
      perform pg_temp.cek('aksi di luar daftar putih ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('aksi di luar daftar putih ditolak', true);
    end;
    begin
      perform public.usul_onboarding('[{"aksi": "orang.impor", "judul": "Tambah Agus", "bidang": {"baris": [{"nama": "Agus", "jabatan": "kasir", "nik": "x"}]}}]', gen_random_uuid());
      perform pg_temp.cek('kunci nik ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kunci nik ditolak', true);
    end;
    begin
      perform public.usul_onboarding('[{"aksi": "orang.impor", "judul": "Tambah Agus 3171012605831840", "bidang": {"baris": [{"nama": "Agus", "jabatan": "kasir"}]}}]', gen_random_uuid());
      perform pg_temp.cek('angka panjang di judul ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('angka panjang di judul ditolak', true);
    end;
    begin
      perform public.usul_onboarding('[{"aksi": "orang.impor", "judul": "Tambah Budi", "bidang": {"baris": [{"nama": "Budi", "jabatan": "kasir", "gaji_pokok": 4500000}]}}]', gen_random_uuid());
      perform pg_temp.cek('gaji dari AI ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('gaji dari AI ditolak', true);
    end;
    begin
      perform public.usul_onboarding('[{"aksi": "onboarding.izin", "judul": "Sakit 90 hari", "bidang": {"jenis": "sakit", "otomatis": true, "maks_hari": 90}}]', gen_random_uuid());
      perform pg_temp.cek('aturan izin di luar batas ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('aturan izin di luar batas ditolak', true);
    end;

    -- Setujui semua.
    for u in select id from public.usulan where sumber = 'ai_milikmu' and perusahaan_id = pa loop
      perform public.putuskan_usulan(u.id, true);
    end loop;
    perform pg_temp.cek('8 orang tercatat, Sari Dewi memakai 2 topi', (select count(*) = 8 from public.orang where perusahaan_id = pa)
      and (select count(*) = 2 from public.pakai_topi pt join public.orang o on o.id = pt.orang_id where o.nama = 'Sari Dewi'),
      (select count(*)::text from public.orang where perusahaan_id = pa));
    perform pg_temp.cek('kebijakan sakit otomatis 1 hari wajib bukti', exists (select 1 from public.kebijakan_izin where perusahaan_id = pa and jenis = 'sakit'
      and otomatis and maks_hari_otomatis = 1 and butuh_bukti));
    perform pg_temp.cek('profil usaha: Denpasar, 6-15 orang, 1 cabang', (select kota = 'Denpasar' and skala = '6-15' and cabang = 1 from public.perusahaan where id = pa));
    perform pg_temp.cek('fitur pilihan tersimpan', (select pengaturan -> 'fitur_dipilih' = '["lempar", "absen", "gaji"]'::jsonb from public.perusahaan where id = pa));

    -- MCP: token OAuth usaha A, alat usul_onboarding.
    kode := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca', 'nadi.usul'], res, pa);
    execute 'reset role';
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    t := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
    r := public.mcp_usul_onboarding(t ->> 'access_token', res, jsonb_build_array(orang -> 0 || jsonb_build_object('judul', 'Tambah Sari Dewi lagi'),
      jsonb_build_object('aksi', 'orang.impor', 'judul', 'Tambah Dewi Lestari', 'bidang', jsonb_build_object('baris', jsonb_build_array(jsonb_build_object('nama', 'Dewi Lestari', 'jabatan', 'kasir'))))), 'kunci-mcp-1');
    perform pg_temp.cek('MCP usul_onboarding membuat 2 usulan bersumber mcp', (r ->> 'dibuat')::int = 2, r::text);
    begin
      perform public.mcp_usul_onboarding('nmc_palsu', res, butir, 'kunci-mcp-2');
      perform pg_temp.cek('token palsu ditolak', false);
    exception when others then perform pg_temp.cek('token palsu ditolak', sqlstate = 'P0401', sqlstate);
    end;
    execute 'reset role';
    perform pg_temp.cek('usulan MCP masuk usaha A dan mencatat klien', (select count(*) = 2 from public.usulan where perusahaan_id = pa and sumber = 'mcp' and payload #>> '{dari,klien}' = 'Klien Uji'));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.usul_onboarding(butir, gen_random_uuid());
      perform pg_temp.cek('staf tidak bisa menempel cetak biru', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menempel cetak biru', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat usulan onboarding usaha A', (select count(*) = 0 from public.usulan where sumber in ('ai_milikmu', 'mcp')));
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
