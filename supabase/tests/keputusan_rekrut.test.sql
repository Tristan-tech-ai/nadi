-- Tes keputusan rekrut (F2-05): tautan status dibuat sekali dalam 2 jam sejak melamar dan hanya hash-nya disimpan, izin dihubungi
-- tersimpan, status terbaca lewat token (salah atau lewat 180 hari ditolak dengan pesan jelas), pemilik mengubah tahap dan halaman
-- status ikut berubah, usaha lain dan anon tidak bisa mengubah atau membaca lamaran. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  lw uuid; v_kode text; la uuid; la2 uuid; la3 uuid; tok text; tok2 text; r jsonb; n int;
begin
  -- Semua di dalam blok agar galat tak terduga (mis. fungsi belum ada) tercatat sebagai kegagalan, bukan menghentikan tes.
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.lowongan (perusahaan_id, judul) values (pa, 'Pelayan shift malam') returning id, kode into lw, v_kode;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    la := (public.lamar_daftar(v_kode, 'Dewi Lestari', '0812-3456-7100', repeat('e', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    la2 := (public.lamar_daftar(v_kode, 'Rudi Hartono', '0812-3456-7101', repeat('f', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    la3 := (public.lamar_daftar(v_kode, 'Sari Wulandari', '0812-3456-7102', repeat('9', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;

    tok := public.lamar_lanjut(la, true);
    perform pg_temp.cek('token status berawalan nml_ dan 64 heksa', tok ~ '^nml_[0-9a-f]{64}$', tok);
    begin
      perform public.lamar_lanjut(la, false);
      perform pg_temp.cek('token status hanya dibuat sekali', false);
    exception when others then perform pg_temp.cek('token status hanya dibuat sekali', sqlstate = '23505', sqlerrm);
    end;
    tok2 := public.lamar_lanjut(la2, false);
    perform pg_temp.cek('pelamar tanpa izin tetap mendapat tautan', tok2 ~ '^nml_', tok2);

    r := public.status_lamaran(tok);
    perform pg_temp.cek('status terbaca lewat token: usaha, lowongan, nama, tahap masuk',
      r ->> 'usaha' = 'Warung Uji A' and r ->> 'lowongan' = 'Pelayan shift malam' and r ->> 'nama' = 'Dewi Lestari'
        and r ->> 'tahap' = 'masuk' and r -> 'pesan' = 'null'::jsonb and (r ->> 'dibuat_at') is not null, r::text);
    perform pg_temp.cek('status hanya berisi tujuh kunci (tanpa telepon)',
      (select array_agg(k order by k) from jsonb_object_keys(r) k) = array['dibuat_at', 'lowongan', 'nama', 'pesan', 'tahap', 'tahap_at', 'usaha'], r::text);
    begin
      perform public.status_lamaran('nml_' || repeat('0', 64));
      perform pg_temp.cek('token salah ditolak dengan pesan jelas', false);
    exception when others then perform pg_temp.cek('token salah ditolak dengan pesan jelas', sqlstate = '28000' and sqlerrm like 'Tautan status lamaran ini tidak berlaku%', sqlerrm);
    end;
    begin
      perform public.status_lamaran(null);
      perform pg_temp.cek('token kosong ditolak', false);
    exception when others then perform pg_temp.cek('token kosong ditolak', sqlstate = '28000', sqlerrm);
    end;
    begin
      select count(*) into n from public.lamaran;
      perform pg_temp.cek('anon tidak bisa membaca lamaran', false, n::text);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca lamaran', true);
    end;
    begin
      perform public.ubah_tahap_lamaran(la, 'diterima', null);
      perform pg_temp.cek('anon tidak bisa mengubah tahap', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa mengubah tahap', true);
    end;

    -- Pemilik A.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('izin dihubungi tersimpan (ya dan tidak), bawaan tidak',
      (select boleh_dihubungi from public.lamaran where id = la) and not (select boleh_dihubungi from public.lamaran where id = la2)
        and not (select boleh_dihubungi from public.lamaran where id = la3));
    perform pg_temp.cek('hanya hash token yang disimpan',
      (select token_status = encode(sha256(convert_to(tok, 'utf8')), 'hex') and token_status <> tok from public.lamaran where id = la));
    perform pg_temp.cek('tahap bawaan masuk', (select tahap = 'masuk' and tahap_at is null from public.lamaran where id = la3));
    r := public.ubah_tahap_lamaran(la, 'ditawari', '  Datang Senin 09.00 ke warung, bawa KTP.  ');
    perform pg_temp.cek('pemilik mengubah tahap', r ->> 'tahap' = 'ditawari' and (r ->> 'tahap_at') is not null, r::text);
    begin
      perform public.ubah_tahap_lamaran(la, 'lulus', null);
      perform pg_temp.cek('tahap tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('tahap tak dikenal ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.ubah_tahap_lamaran(la, 'ditolak', repeat('x', 501));
      perform pg_temp.cek('pesan lebih dari 500 huruf ditolak', false);
    exception when others then perform pg_temp.cek('pesan lebih dari 500 huruf ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      update public.lamaran set tahap = 'diterima' where id = la;
      perform pg_temp.cek('pemilik tidak bisa menulis lamaran langsung', false);
    exception when insufficient_privilege then perform pg_temp.cek('pemilik tidak bisa menulis lamaran langsung', true);
    end;

    -- Usaha lain.
    perform set_config('request.jwt.claims', kb, true);
    begin
      perform public.ubah_tahap_lamaran(la, 'ditolak', 'Bukan urusanmu');
      perform pg_temp.cek('usaha lain tidak bisa mengubah tahap', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa mengubah tahap', sqlstate = 'P0002', sqlerrm);
    end;
    select count(*) into n from public.lamaran where id = la;
    perform pg_temp.cek('usaha lain tidak melihat lamaran', n = 0, n::text);

    -- Pelamar membuka tautannya lagi.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    r := public.status_lamaran(tok);
    perform pg_temp.cek('perubahan tahap pemilik terlihat di status, pesan dirapikan',
      r ->> 'tahap' = 'ditawari' and r ->> 'pesan' = 'Datang Senin 09.00 ke warung, bawa KTP.' and (r ->> 'tahap_at') is not null, r::text);

    execute 'reset role';
    update public.lamaran set dibuat_at = now() - interval '181 days' where id = la;
    update public.lamaran set dibuat_at = now() - interval '3 hours' where id = la3;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      perform public.status_lamaran(tok);
      perform pg_temp.cek('token lewat 180 hari ditolak', false);
    exception when others then perform pg_temp.cek('token lewat 180 hari ditolak', sqlstate = '28000', sqlerrm);
    end;
    begin
      perform public.lamar_lanjut(la3, true);
      perform pg_temp.cek('tautan status tidak bisa dibuat setelah 2 jam', false);
    exception when others then perform pg_temp.cek('tautan status tidak bisa dibuat setelah 2 jam', sqlstate = 'P0002', sqlerrm);
    end;
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
