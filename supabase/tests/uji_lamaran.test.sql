-- Tes uji kerja dan IPIP (F2-04): pelamar tanpa akun mendapat benih soal dari database (sama bila dipanggil ulang), lowongan
-- tanpa topi tidak punya uji kerja, jawaban dikirim sekali dengan bentuk yang divalidasi, dalam 2 jam sejak melamar;
-- pengelola usaha itu membaca, usaha lain dan anon tidak. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  lw uuid; lw2 uuid; v_kode text; v_kode2 text; r jsonb; r2 jsonb; la uuid; la2 uuid; n int;
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
  if not exists (select 1 from public.topi where perusahaan_id = pa and kode = 'kasir') then perform public.pasang_paket('fnb'); end if;
  insert into public.lowongan (perusahaan_id, judul, topi_id)
  values (pa, 'Kasir sore', (select id from public.topi where perusahaan_id = pa and kode = 'kasir' limit 1))
  returning id, kode into lw, v_kode;
  insert into public.lowongan (perusahaan_id, judul) values (pa, 'Serabutan') returning id, kode into lw2, v_kode2;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  la := (public.lamar_daftar(v_kode, 'Dewi Lestari', '0812-3456-7000', repeat('c', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
  la2 := (public.lamar_daftar(v_kode2, 'Rudi Hartono', '0812-3456-7001', repeat('d', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;

  r := public.uji_mulai(la);
  perform pg_temp.cek('uji kerja memakai kode topi lowongan', r ->> 'topi' = 'kasir' and (r ->> 'benih') is not null, r::text);
  r2 := public.uji_mulai(la);
  perform pg_temp.cek('memanggil ulang mengembalikan benih yang sama', r2 ->> 'benih' = r ->> 'benih', r2::text);
  perform pg_temp.cek('lowongan tanpa topi tidak punya uji kerja', public.uji_mulai(la2) is null);

  begin
    perform public.uji_kirim(la, 'kerja', '"bukan larik"');
    perform pg_temp.cek('jawaban kerja harus larik', false);
  exception when others then perform pg_temp.cek('jawaban kerja harus larik', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.uji_kirim(la, 'kerja', jsonb_build_array(repeat('9', 41)));
    perform pg_temp.cek('jawaban kerja lebih dari 40 huruf ditolak', false);
  exception when others then perform pg_temp.cek('jawaban kerja lebih dari 40 huruf ditolak', sqlstate = '22023', sqlerrm);
  end;
  perform public.uji_kirim(la, 'kerja', '["Rp12.500", "3000", "-2"]');
  perform pg_temp.cek('jawaban kerja tersimpan', true);
  begin
    perform public.uji_kirim(la, 'kerja', '["1", "2", "3"]');
    perform pg_temp.cek('uji kerja hanya dikirim sekali', false);
  exception when others then perform pg_temp.cek('uji kerja hanya dikirim sekali', sqlstate = '23505', sqlerrm);
  end;
  begin
    perform public.uji_kirim(la2, 'kerja', '["1"]');
    perform pg_temp.cek('kirim uji kerja tanpa mulai ditolak', false);
  exception when others then perform pg_temp.cek('kirim uji kerja tanpa mulai ditolak', sqlstate = 'P0002', sqlerrm);
  end;

  begin
    perform public.uji_kirim(la, 'ipip', '{"51": 3}');
    perform pg_temp.cek('nomor butir IPIP di luar 1-50 ditolak', false);
  exception when others then perform pg_temp.cek('nomor butir IPIP di luar 1-50 ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.uji_kirim(la, 'ipip', '{"1": 6}');
    perform pg_temp.cek('nilai IPIP di luar 1-5 ditolak', false);
  exception when others then perform pg_temp.cek('nilai IPIP di luar 1-5 ditolak', sqlstate = '22023', sqlerrm);
  end;
  perform public.uji_kirim(la, 'ipip', (select jsonb_object_agg(x::text, 1 + x % 5) from generate_series(1, 50) x));
  perform pg_temp.cek('IPIP lengkap tersimpan', true);
  perform public.uji_kirim(la2, 'ipip', '{"1": 4, "2": 2}');
  perform pg_temp.cek('IPIP sebagian boleh (opsional, faktor kosong tidak dinilai)', true);
  begin
    perform public.uji_kirim(la, 'lain', '{}');
    perform pg_temp.cek('jenis uji tak dikenal ditolak', false);
  exception when others then perform pg_temp.cek('jenis uji tak dikenal ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    select count(*) into n from public.uji_lamaran;
    perform pg_temp.cek('anon tidak bisa membaca hasil uji', false, n::text);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca hasil uji', true);
  end;

  execute 'reset role';
  update public.lamaran set dibuat_at = now() - interval '3 hours' where id = la2;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.uji_mulai(la2);
    perform pg_temp.cek('lamaran lebih dari 2 jam tidak bisa mulai uji', false);
  exception when others then perform pg_temp.cek('lamaran lebih dari 2 jam tidak bisa mulai uji', sqlstate = 'P0002', sqlerrm);
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.uji_lamaran where lamaran_id = la;
  perform pg_temp.cek('pemilik melihat uji kerja dan IPIP pelamarnya', n = 2, n::text);
  perform pg_temp.cek('jawaban kerja utuh', (select jawaban = '["Rp12.500", "3000", "-2"]'::jsonb and selesai_at is not null from public.uji_lamaran where lamaran_id = la and jenis = 'kerja'));
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.uji_lamaran;
  perform pg_temp.cek('usaha lain tidak melihat hasil uji', n = 0, n::text);
  begin
    insert into public.uji_lamaran (perusahaan_id, lamaran_id, jenis) values (pa, la, 'ipip');
    perform pg_temp.cek('pengguna tidak bisa menulis langsung', false);
  exception when insufficient_privilege then perform pg_temp.cek('pengguna tidak bisa menulis langsung', true);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
