-- Tes rekrut: lowongan berkode, halaman publik tanpa data lain, lamar tanpa akun dengan batas (tutup, kuota harian, 3 per nomor HP,
-- jenis/ukuran berkas), unggah anon hanya ke jalur lamar terdaftar, lamar_selesai menunggu berkas ada, lamaran jadi 'usulan' saat
-- usulan dibuat, anon tidak bisa membaca data, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; lw uuid; kode text; r jsonb; n int; x text;
  la uuid; bid uuid; jalur text;
  sha text := repeat('a', 64);
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
  insert into public.lowongan (perusahaan_id, judul, ringkasan) values (pa, 'Pelayan shift malam', 'Melayani tamu 17.00 sampai 23.00') returning id, kode into lw, kode;
  perform pg_temp.cek('kode lowongan 8 huruf tanpa karakter mirip', kode ~ '^[A-HJ-NP-Z2-9]{8}$', kode);

  -- Tanpa akun.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.lowongan_publik(lower(kode));
  perform pg_temp.cek('halaman publik: judul, ringkasan, usaha saja', r = jsonb_build_object('judul', 'Pelayan shift malam', 'ringkasan', 'Melayani tamu 17.00 sampai 23.00', 'usaha', 'Warung Uji A', 'buka', true), r::text);
  r := public.lamar_daftar(kode, 'Dewi Lestari', '0812-3456-7890', sha, 'application/pdf', 120000);
  la := (r ->> 'lamaran')::uuid; bid := (r ->> 'berkas')::uuid; jalur := r ->> 'jalur';
  perform pg_temp.cek('lamar mendapat slot unggah di jalur lamar', (r ->> 'perlu_unggah')::boolean and jalur = pa || '/lamar/' || sha || '.pdf', r::text);
  begin
    perform public.lamar_selesai(la);
    perform pg_temp.cek('selesai sebelum unggah ditolak', false);
  exception when others then perform pg_temp.cek('selesai sebelum unggah ditolak', sqlerrm like 'CV belum terunggah%', sqlerrm);
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('berkas', pa || '/lamar/' || repeat('b', 64) || '.pdf');
    perform pg_temp.cek('anon tidak bisa unggah ke jalur tak terdaftar', false);
  exception when others then perform pg_temp.cek('anon tidak bisa unggah ke jalur tak terdaftar', sqlstate = '42501', sqlerrm);
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('berkas', pa || '/lempar/' || repeat('c', 64) || '.pdf');
    perform pg_temp.cek('anon tidak bisa unggah ke jalur lempar', false);
  exception when others then perform pg_temp.cek('anon tidak bisa unggah ke jalur lempar', sqlstate = '42501', sqlerrm);
  end;
  insert into storage.objects (bucket_id, name) values ('berkas', jalur);
  perform pg_temp.cek('anon bisa unggah ke jalur lamar terdaftar', true);
  r := public.lamar_selesai(la);
  perform pg_temp.cek('selesai: lamaran diproses', r ->> 'status' = 'diproses', r::text);
  begin
    perform public.lamar_daftar(kode, 'Dewi', '0812 0000 0000', sha, 'image/gif', 1000);
    perform pg_temp.cek('jenis berkas selain foto/PDF ditolak', false);
  exception when others then perform pg_temp.cek('jenis berkas selain foto/PDF ditolak', sqlerrm like 'CV harus berupa foto atau PDF%', sqlerrm);
  end;
  begin
    perform public.lamar_daftar(kode, ' ', '0812 0000 0000', sha, 'application/pdf', 1000);
    perform pg_temp.cek('nama kosong ditolak', false);
  exception when others then perform pg_temp.cek('nama kosong ditolak', sqlerrm like 'Tulis nama%', sqlerrm);
  end;
  -- Nomor HP sama (format beda) paling banyak 3 kali.
  perform public.lamar_daftar(kode, 'Dewi Lestari', '+62 812 3456 7890', repeat('d', 64), 'image/jpeg', 1000);
  perform public.lamar_daftar(kode, 'Dewi Lestari', '081234567890', repeat('e', 64), 'image/jpeg', 1000);
  begin
    perform public.lamar_daftar(kode, 'Dewi Lestari', '0812-3456-7890', repeat('f', 64), 'image/jpeg', 1000);
    perform pg_temp.cek('nomor HP yang sama ke-4 ditolak', false);
  exception when others then perform pg_temp.cek('nomor HP yang sama ke-4 ditolak', sqlerrm like 'Nomor HP ini sudah melamar%', sqlerrm);
  end;
  begin
    perform count(*) from public.lamaran;
    perform pg_temp.cek('anon tidak bisa membaca lamaran', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca lamaran', true);
  end;
  begin
    perform count(*) from public.lowongan;
    perform pg_temp.cek('anon tidak bisa membaca tabel lowongan', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca tabel lowongan', true);
  end;
  execute 'reset role';
  perform pg_temp.cek('berkas lamar antre untuk dibaca', (select status = 'antre' and diunggah_oleh is null from public.berkas where id = bid));

  -- Kuota harian dan lowongan tutup.
  update public.lowongan set kuota_harian = 3 where id = lw;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.lamar_daftar(kode, 'Bagus', '0813 1111 2222', repeat('9', 64), 'application/pdf', 1000);
    perform pg_temp.cek('kuota harian penuh ditolak', false);
  exception when others then perform pg_temp.cek('kuota harian penuh ditolak', sqlerrm like 'Lowongan ini sedang menerima banyak lamaran%', sqlerrm);
  end;
  execute 'reset role';
  update public.lowongan set kuota_harian = 50, buka = false where id = lw;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.lamar_daftar(kode, 'Bagus', '0813 1111 2222', repeat('9', 64), 'application/pdf', 1000);
    perform pg_temp.cek('lowongan tutup ditolak', false);
  exception when others then perform pg_temp.cek('lowongan tutup ditolak', sqlerrm like 'Lowongan ini sudah ditutup%', sqlerrm);
  end;
  execute 'reset role';

  -- Usulan dari berkas lamaran menandai lamaran.
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, berkas_id) values (pa, 'lempar', 'rekrut.pelamar', 'Catat Dewi Lestari sebagai pelamar', '{}', bid);
  perform pg_temp.cek('lamaran menjadi usulan saat CV terbaca', (select status = 'usulan' from public.lamaran where id = la));

  -- Pengelola dan isolasi.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.lamaran where lowongan_id = lw;
  perform pg_temp.cek('pemilik melihat lamaran usahanya', n = 3, n::text);
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.lamaran;
  perform pg_temp.cek('usaha lain tidak melihat lamaran', n = 0, n::text);
  select count(*) into n from public.lowongan;
  perform pg_temp.cek('usaha lain tidak melihat lowongan', n = 0, n::text);
  begin
    update public.lowongan set buka = true where id = lw;
    get diagnostics n = row_count;
    perform pg_temp.cek('usaha lain tidak bisa membuka lowongan', n = 0, n::text);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
