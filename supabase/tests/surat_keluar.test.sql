-- Tes F4-02 surat keluar (docs/research/surat-keluar.md): draf tanpa nomor, terbit mengambil Nomor Sakti dan kode verifikasi,
-- surat terbit tidak bisa diubah, verifikasi publik (anon) menerima kode asli dan menolak kode palsu atau draf, pembatalan beralasan
-- ikut membatalkan nomornya dan tidak dipakai ulang, peran lewat app.peran_aktif, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pb uuid; o1 uuid; ob uuid; ka text; kb text; ks text; s1 uuid; s2 uuid; r jsonb; v jsonb; n int; x text; v_tgl date;
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada', to_regclass('public.surat_keluar') is not null
      and to_regprocedure('public.verifikasi_surat(text)') is not null and to_regprocedure('public.terbitkan_surat(uuid)') is not null);
    perform pg_temp.cek('verifikasi terbuka untuk anon, tulis tidak', has_function_privilege('anon', 'public.verifikasi_surat(text)', 'execute')
      and not has_function_privilege('anon', 'public.simpan_surat(uuid,text,uuid,jsonb,text,jsonb)', 'execute')
      and not has_table_privilege('authenticated', 'public.surat_keluar', 'insert'));
    perform pg_temp.cek('RPC tulis memeriksa peran lewat peran_aktif',
      (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.simpan_surat(uuid,text,uuid,jsonb,text,jsonb)'::regprocedure, 'public.terbitkan_surat(uuid)'::regprocedure, 'public.batal_surat(uuid,text)'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (us, 's@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Surat Keluar', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Surat Keluar B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Orang Usaha B') returning id into ob;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Santoso') returning id into o1;
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_tgl := app.hari_ini(pa);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    s1 := public.simpan_surat(null, 'sk_mutasi', o1, '{"tujuan":"cabang Denpasar","mulai":"2026-12-01"}', 'Surat Keputusan Mutasi',
      '["Pimpinan memutuskan memindahkan Saudara Budi Santoso ke cabang Denpasar."]');
    perform pg_temp.cek('draf tersimpan tanpa nomor dan kode, nama pihak disalin', (select status = 'draf' and nomor is null and kode_verifikasi is null
      and nama_pihak = 'Budi Santoso' from public.surat_keluar where id = s1));
    perform public.simpan_surat(s1, 'sk_mutasi', o1, '{"tujuan":"cabang Ubud","mulai":"2026-12-01"}', 'Surat Keputusan Mutasi',
      '["Pimpinan memutuskan memindahkan Saudara Budi Santoso ke cabang Ubud."]');
    perform pg_temp.cek('draf bisa diubah', (select bidang ->> 'tujuan' from public.surat_keluar where id = s1) = 'cabang Ubud');
    begin
      perform public.simpan_surat(null, 'surat_cinta', o1, '{}', 'X', '["x"]');
      perform pg_temp.cek('jenis tidak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('jenis tidak dikenal ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.simpan_surat(null, 'sk_mutasi', ob, '{}', 'Surat Keputusan Mutasi', '["x"]');
      perform pg_temp.cek('orang usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('orang usaha lain ditolak', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;

    -- Draf belum bisa diverifikasi.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform pg_temp.cek('kode acak tidak terdaftar = null', public.verifikasi_surat('ABCDEFGHJKLM') is null);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.terbitkan_surat(s1);
    x := '001/' || (select kode from public.perusahaan where id = pa) || '/SK/' ;
    perform pg_temp.cek('terbit: nomor Nomor Sakti dan kode 12 huruf', r ->> 'nomor' like x || '%/' || to_char(v_tgl, 'YYYY')
      and r ->> 'kode' ~ '^[A-HJ-NP-Z2-9]{12}$', r::text);
    perform pg_temp.cek('tanggal surat = hari ini zona usaha', (select tanggal from public.surat_keluar where id = s1) = v_tgl);
    begin
      perform public.terbitkan_surat(s1);
      perform pg_temp.cek('terbit dua kali ditolak', false);
    exception when others then perform pg_temp.cek('terbit dua kali ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.simpan_surat(s1, 'sk_mutasi', o1, '{"tujuan":"diubah"}', 'Surat Keputusan Mutasi', '["diubah"]');
      perform pg_temp.cek('surat terbit tidak bisa diubah', false);
    exception when others then perform pg_temp.cek('surat terbit tidak bisa diubah', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;

    -- Verifikasi publik.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    v := public.verifikasi_surat(r ->> 'kode');
    perform pg_temp.cek('kode asli: status terbit dengan usaha, nomor, judul, tanggal, pihak; tanpa isi', v ->> 'status' = 'terbit'
      and v ->> 'usaha' = 'Warung Uji Surat Keluar' and v ->> 'nomor' = r ->> 'nomor' and v ->> 'judul' = 'Surat Keputusan Mutasi'
      and v ->> 'nama_pihak' = 'Budi Santoso' and (v ->> 'tanggal')::date = v_tgl and not v ? 'isi', v::text);
    perform pg_temp.cek('kode ditulis kecil dan berspasi tetap dikenali', public.verifikasi_surat(' ' || lower(substr(r ->> 'kode', 1, 6)) || ' ' || lower(substr(r ->> 'kode', 7)) || ' ') ->> 'nomor' = r ->> 'nomor');
    perform pg_temp.cek('kode palsu (satu huruf diganti) ditolak', public.verifikasi_surat(overlay(r ->> 'kode' placing
      case when substr(r ->> 'kode', 1, 1) = 'A' then 'B' else 'A' end from 1 for 1)) is null);

    -- Pembatalan.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.batal_surat(s1, 'Staf mencoba');
      perform pg_temp.cek('staf tidak bisa membatalkan', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa membatalkan', true);
    end;
    select count(*) into n from public.surat_keluar;
    perform pg_temp.cek('staf tidak membaca surat keluar', n = 0, n::text);
    perform set_config('request.jwt.claims', kb, true);
    begin
      perform public.terbitkan_surat(s1);
      perform pg_temp.cek('usaha lain tidak bisa menerbitkan', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa menerbitkan', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.batal_surat(s1, ' ');
      perform pg_temp.cek('batal tanpa alasan ditolak', false);
    exception when others then perform pg_temp.cek('batal tanpa alasan ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    perform public.batal_surat(s1, 'Tujuan mutasi berubah');
    perform pg_temp.cek('nomor ikut batal di nomor_terbit', (select t.status = 'batal' and t.alasan_batal = 'Tujuan mutasi berubah'
      from public.nomor_terbit t join public.surat_keluar s on s.nomor_terbit_id = t.id where s.id = s1));
    s2 := public.simpan_surat(null, 'sk_mutasi', o1, '{"tujuan":"gudang","mulai":"2026-12-01"}', 'Surat Keputusan Mutasi', '["Isi."]');
    r := public.terbitkan_surat(s2);
    perform pg_temp.cek('nomor batal tidak dipakai ulang: surat berikutnya 002', r ->> 'nomor' like '002/%', r ->> 'nomor');
    select kode_verifikasi into x from public.surat_keluar where id = s1;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    v := public.verifikasi_surat(x);
    perform pg_temp.cek('surat dibatalkan: verifikasi menyebut batal tanpa alasan internal', v ->> 'status' = 'batal' and v ->> 'batal_at' is not null and not v ? 'alasan_batal', coalesce(v::text, 'null'));
    begin
      perform public.terbitkan_surat(s2);
      perform pg_temp.cek('anon tidak bisa menerbitkan', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa menerbitkan', true);
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
