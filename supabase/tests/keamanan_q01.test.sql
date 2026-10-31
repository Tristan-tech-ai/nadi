-- Tes perbaikan Q-01 (docs/quality/keamanan-f0.md): T1 ambil alih akun lewat orang.user_id + buat_akun_staf,
-- T2 admin menurunkan pemilik / admin yang dicabut memulihkan diri / admin mengubah peran, S1 jalur berkas lintas usaha,
-- S2 usulan menunjuk berkas usaha lain, S4 tulis berkas langsung, T3 batas unggah harian. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uv uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; kd text; o1 uuid; o2 uuid; ob uuid; bb uuid; ba uuid; r jsonb; v_hash text; n int;
begin
  insert into auth.users (id, email, encrypted_password) values (ua, 'a@uji.local', 'x'), (ub, 'b@uji.local', 'x'), (ud, 'd@uji.local', 'x'),
    (uv, 'korban@uji.local', 'sandi-asli');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin');
  execute 'set local role authenticated';
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;

  -- T1: orang.user_id tidak bisa diisi klien; PIN hanya untuk akun staf sintetis.
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  begin
    update public.orang set user_id = uv where id = o1;
    perform pg_temp.cek('T1 klien tidak bisa menautkan orang ke akun lain (update)', false);
  exception when others then perform pg_temp.cek('T1 klien tidak bisa menautkan orang ke akun lain (update)', sqlstate = '42501', sqlerrm);
  end;
  begin
    insert into public.orang (perusahaan_id, nama, user_id) values (pa, 'Palsu', uv);
    perform pg_temp.cek('T1 klien tidak bisa menautkan orang ke akun lain (insert)', false);
  exception when others then perform pg_temp.cek('T1 klien tidak bisa menautkan orang ke akun lain (insert)', sqlstate = '42501', sqlerrm);
  end;
  -- Seandainya tautan ke akun sungguhan sudah ada (data lama), buat_akun_staf tetap menolak mengganti sandinya.
  execute 'reset role';
  insert into public.orang (perusahaan_id, nama, user_id) values (pa, 'Tertaut', uv) returning id into o2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.buat_akun_staf(o2, '000000');
    perform pg_temp.cek('T1 PIN akun email sungguhan tidak bisa diganti', false);
  exception when others then perform pg_temp.cek('T1 PIN akun email sungguhan tidak bisa diganti', sqlstate = '42501', sqlerrm);
  end;
  execute 'reset role';
  perform pg_temp.cek('T1 sandi korban tetap', (select encrypted_password from auth.users where id = uv) = 'sandi-asli');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r := public.buat_akun_staf(o1, '123456');
  execute 'reset role';
  select encrypted_password into v_hash from auth.users where id = (select user_id from public.orang where id = o1);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.buat_akun_staf(o1, '654321');
  execute 'reset role';
  perform pg_temp.cek('T1 PIN akun staf sintetis tetap bisa diganti', (select encrypted_password from auth.users where id = (select user_id from public.orang where id = o1)) <> v_hash);
  execute 'set local role authenticated';

  -- T2: admin tidak menyentuh baris pemilik, tidak mengubah barisnya sendiri, tidak mengubah peran; pemilik boleh.
  perform set_config('request.jwt.claims', kd, true);
  update public.anggota set peran = 'admin', aktif = false where perusahaan_id = pa and user_id = ua;
  get diagnostics n = row_count;
  perform pg_temp.cek('T2 admin tidak bisa menurunkan pemilik', n = 0, n::text);
  perform pg_temp.cek('T2 pemilik tetap pemilik aktif', (select peran = 'pemilik' and aktif from public.anggota where perusahaan_id = pa and user_id = ua));
  begin
    update public.anggota set peran = 'admin' where perusahaan_id = pa and user_id = (select user_id from public.orang where id = o1);
    perform pg_temp.cek('T2 admin tidak bisa mengubah peran', false);
  exception when others then perform pg_temp.cek('T2 admin tidak bisa mengubah peran', sqlstate = '42501', sqlerrm);
  end;
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = (select user_id from public.orang where id = o1);
  get diagnostics n = row_count;
  perform pg_temp.cek('T2 admin boleh menonaktifkan staf', n = 1, n::text);
  -- Admin dicabut pemilik; JWT lamanya masih berklaim admin.
  perform set_config('request.jwt.claims', ka, true);
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = ud;
  perform set_config('request.jwt.claims', kd, true);
  update public.anggota set aktif = true where perusahaan_id = pa;
  get diagnostics n = row_count;
  perform pg_temp.cek('T2 admin yang dicabut tidak bisa memulihkan diri atau orang lain', n = 0, n::text);
  perform set_config('request.jwt.claims', ka, true);
  update public.anggota set peran = 'admin', aktif = true where perusahaan_id = pa and user_id = (select user_id from public.orang where id = o1);
  get diagnostics n = row_count;
  perform pg_temp.cek('T2 pemilik boleh mengubah peran', n = 1, n::text);
  perform set_config('request.jwt.claims', kb, true);
  insert into public.orang (perusahaan_id, nama) values (pb, 'Orang B') returning id into ob;
  perform set_config('request.jwt.claims', ka, true);
  begin
    update public.anggota set orang_id = ob where perusahaan_id = pa and user_id = (select user_id from public.orang where id = o1);
    perform pg_temp.cek('T2 orang_id usaha lain ditolak', false);
  exception when others then perform pg_temp.cek('T2 orang_id usaha lain ditolak', sqlerrm like '%row-level security%', sqlerrm);
  end;

  -- S4: tulis berkas langsung ditolak; S1: jalur harus di folder usaha sendiri.
  begin
    insert into public.berkas (perusahaan_id, jalur, diunggah_oleh) values (pa, pb || '/lempar/x.pdf', ua);
    perform pg_temp.cek('S4 klien tidak bisa menulis berkas langsung', false);
  exception when insufficient_privilege then perform pg_temp.cek('S4 klien tidak bisa menulis berkas langsung', true);
  end;
  execute 'reset role';
  begin
    insert into public.berkas (perusahaan_id, jalur) values (pa, pb || '/lempar/x.pdf');
    perform pg_temp.cek('S1 jalur di folder usaha lain ditolak', false);
  exception when check_violation then perform pg_temp.cek('S1 jalur di folder usaha lain ditolak', true);
  end;
  insert into public.berkas (perusahaan_id, jalur) values (pb, pb || '/lempar/b.pdf') returning id into bb;
  insert into public.berkas (perusahaan_id, jalur) values (pa, pa || '/lempar/a.pdf') returning id into ba;

  -- S2: usulan hanya menunjuk berkas usaha yang sama.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, berkas_id) values (pa, 'aturan', 'uang.keluar', 'Uji', '{}', bb);
    perform pg_temp.cek('S2 usulan dengan berkas usaha lain ditolak', false);
  exception when others then perform pg_temp.cek('S2 usulan dengan berkas usaha lain ditolak', sqlerrm like '%bukan milik usaha ini%', sqlerrm);
  end;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, berkas_id) values (pa, 'aturan', 'uang.keluar', 'Uji', '{}', ba);
  perform pg_temp.cek('S2 usulan dengan berkas sendiri tetap boleh', true);

  -- T3: batas harian per usaha (disetel kecil di dalam tes).
  execute 'reset role';
  update public.konfigurasi set nilai = nilai || '{"usaha_berkas": 1}' where kunci = 'batas_berkas';
  begin
    insert into public.berkas (perusahaan_id, jalur) values (pa, pa || '/lempar/c.pdf');
    perform pg_temp.cek('T3 melewati batas harian usaha ditolak', false);
  exception when others then perform pg_temp.cek('T3 melewati batas harian usaha ditolak', sqlstate = '54000', sqlerrm);
  end;
  update public.konfigurasi set nilai = nilai || '{"usaha_berkas": 200, "usaha_mb": 1}' where kunci = 'batas_berkas';
  begin
    insert into public.berkas (perusahaan_id, jalur, ukuran) values (pa, pa || '/lempar/d.pdf', 2 * 1048576);
    perform pg_temp.cek('T3 melewati batas MB harian ditolak', false);
  exception when others then perform pg_temp.cek('T3 melewati batas MB harian ditolak', sqlstate = '54000', sqlerrm);
  end;
  update public.konfigurasi set nilai = nilai || '{"usaha_mb": 200, "lamar_platform": 0}' where kunci = 'batas_berkas';
  begin
    insert into public.berkas (perusahaan_id, jalur) values (pa, pa || '/lamar/e.pdf');
    perform pg_temp.cek('T3 batas lamaran seluruh platform', false);
  exception when others then perform pg_temp.cek('T3 batas lamaran seluruh platform', sqlerrm like 'Lamaran sedang ramai%', sqlerrm);
  end;
  insert into public.berkas (perusahaan_id, jalur) values (pa, pa || '/lempar/f.pdf');
  perform pg_temp.cek('T3 di bawah batas tetap boleh', true);
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
