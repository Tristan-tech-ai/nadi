-- Tes wawancara suara (F2-03): pertanyaan per lowongan tampil di halaman publik; pelamar tanpa akun mendaftarkan jawaban audio
-- (jenis dan ukuran dibatasi, urutan dalam jumlah pertanyaan, sekali per pertanyaan, dalam 2 jam sejak melamar), mengunggah ke
-- slot wawancara saja, menyelesaikan setelah berkas ada; pengelola membaca jawaban dan menyimpan transkrip; usaha lain dan anon
-- tidak bisa membaca. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  lw uuid; v_kode text; r jsonb; la uuid; j1 uuid; jalur text; n int;
  sha_cv text := repeat('c', 64); sha1 text := repeat('d', 64); sha2 text := repeat('e', 64);
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
  insert into public.lowongan (perusahaan_id, judul, pertanyaan)
  values (pa, 'Pelayan', '["Ceritakan pengalamanmu melayani pelanggan.", "Apa yang kamu lakukan bila pelanggan marah?"]')
  returning id, kode into lw, v_kode;
  begin
    update public.lowongan set pertanyaan = (select jsonb_agg('Pertanyaan ' || x) from generate_series(1, 6) x) where id = lw;
    perform pg_temp.cek('lebih dari 5 pertanyaan ditolak', false);
  exception when check_violation then perform pg_temp.cek('lebih dari 5 pertanyaan ditolak', true);
  end;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.lowongan_publik(v_kode);
  perform pg_temp.cek('halaman publik memuat pertanyaan', jsonb_array_length(r -> 'pertanyaan') = 2, r::text);
  r := public.lamar_daftar(v_kode, 'Dewi Lestari', '0812-3456-7000', sha_cv, 'application/pdf', 1000);
  la := (r ->> 'lamaran')::uuid;

  r := public.wawancara_daftar(la, 0, sha1, 'audio/webm', 200000, 42);
  j1 := (r ->> 'jawaban')::uuid; jalur := r ->> 'jalur';
  perform pg_temp.cek('jawaban pertama mendapat slot di folder wawancara', jalur = pa || '/wawancara/' || sha1 || '.webm' and (r ->> 'perlu_unggah')::boolean, r::text);
  begin
    perform public.wawancara_daftar(la, 0, sha2, 'audio/webm', 200000, 30);
    perform pg_temp.cek('satu pertanyaan hanya dijawab sekali', false);
  exception when others then perform pg_temp.cek('satu pertanyaan hanya dijawab sekali', sqlstate = '23505', sqlerrm);
  end;
  begin
    perform public.wawancara_daftar(la, 2, sha2, 'audio/webm', 200000, 30);
    perform pg_temp.cek('urutan di luar jumlah pertanyaan ditolak', false);
  exception when others then perform pg_temp.cek('urutan di luar jumlah pertanyaan ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.wawancara_daftar(la, 1, sha2, 'video/mp4', 200000, 30);
    perform pg_temp.cek('jenis berkas selain audio ditolak', false);
  exception when others then perform pg_temp.cek('jenis berkas selain audio ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.wawancara_daftar(la, 1, sha2, 'audio/webm', 6000000, 30);
    perform pg_temp.cek('audio lebih dari 5 MB ditolak', false);
  exception when others then perform pg_temp.cek('audio lebih dari 5 MB ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.wawancara_daftar(la, 1, sha2, 'audio/webm', 200000, 200);
    perform pg_temp.cek('jawaban lebih dari 2 menit ditolak', false);
  exception when others then perform pg_temp.cek('jawaban lebih dari 2 menit ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.wawancara_selesai(j1);
    perform pg_temp.cek('selesai sebelum audio terunggah ditolak', false);
  exception when others then perform pg_temp.cek('selesai sebelum audio terunggah ditolak', sqlstate = '55000', sqlerrm);
  end;
  insert into storage.objects (bucket_id, name) values ('berkas', jalur);
  perform pg_temp.cek('anon mengunggah ke slot wawancara yang didaftarkan', true);
  begin
    insert into storage.objects (bucket_id, name) values ('berkas', pa || '/wawancara/' || repeat('f', 64) || '.webm');
    perform pg_temp.cek('anon tidak bisa mengunggah ke jalur wawancara tak terdaftar', false);
  exception when others then perform pg_temp.cek('anon tidak bisa mengunggah ke jalur wawancara tak terdaftar', sqlerrm like '%row-level security%', sqlerrm);
  end;
  r := public.wawancara_selesai(j1);
  perform pg_temp.cek('selesai setelah audio ada', r ->> 'status' = 'masuk', r::text);
  begin
    select count(*) into n from public.jawaban_wawancara;
    perform pg_temp.cek('anon tidak bisa membaca jawaban', false, n::text);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca jawaban', true);
  end;

  -- Lamaran lama (lebih dari 2 jam) tidak bisa menambah jawaban.
  execute 'reset role';
  update public.lamaran set dibuat_at = now() - interval '3 hours' where id = la;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.wawancara_daftar(la, 1, sha2, 'audio/webm', 200000, 30);
    perform pg_temp.cek('lamaran lebih dari 2 jam tidak bisa menambah jawaban', false);
  exception when others then perform pg_temp.cek('lamaran lebih dari 2 jam tidak bisa menambah jawaban', sqlstate = 'P0002', sqlerrm);
  end;

  -- Pengelola membaca dan menyimpan transkrip; usaha lain tidak.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.jawaban_wawancara where lamaran_id = la;
  perform pg_temp.cek('pemilik melihat jawaban pelamarnya', n = 1, n::text);
  perform public.simpan_transkrip(j1, 'Saya pernah jadi pelayan dua tahun.', '{"skor": 60}');
  perform pg_temp.cek('transkrip tersimpan', (select transkrip = 'Saya pernah jadi pelayan dua tahun.' and ditranskrip_at is not null from public.jawaban_wawancara where id = j1));
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.jawaban_wawancara;
  perform pg_temp.cek('usaha lain tidak melihat jawaban', n = 0, n::text);
  begin
    perform public.simpan_transkrip(j1, 'diubah orang lain', '{}');
    perform pg_temp.cek('usaha lain tidak bisa menyimpan transkrip', false);
  exception when others then perform pg_temp.cek('usaha lain tidak bisa menyimpan transkrip', sqlstate = 'P0002', sqlerrm);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
