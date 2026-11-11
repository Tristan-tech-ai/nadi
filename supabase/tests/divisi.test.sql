-- Tes X-13 (supabase/migrations/20261111135000_divisi.sql): divisi + kepala divisi menjadi penyetuju izin anggota (setelah atasan
-- langsung, dilewati bila kepala sedang izin) dan pemutus hasil kerja anggota (tidak untuk kerja yang ikut ia kerjakan); peran kustom
-- kerja.kelola dan proyek.kelola; kepala divisi dan pemegang peran kustom tidak membaca gaji, rekening, atau slip; isolasi usaha.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; k1 text; k2 text; k3 text; k4 text; o1 uuid; o2 uuid; o3 uuid; o4 uuid; ob uuid; hari date;
  r jsonb; dv uuid; kr1 uuid; kr2 uuid; kr3 uuid; us1 uuid; us2 uuid; us3 uuid; us4 uuid; peran uuid; per uuid; iz uuid;
begin
  insert into auth.users (id, email) values (ua, 'dv-a@uji.local'), (ub, 'dv-b@uji.local'), (u1, 'dv-1@uji.local'), (u2, 'dv-2@uji.local'),
    (u3, 'dv-3@uji.local'), (u4, 'dv-4@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Agensi Divisi A', 'kantor');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Agensi Divisi B', 'kantor');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Sari Desain', array['karyawan'], u1) returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kepala Desain', array['karyawan'], u2) returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Dewi Desain', array['karyawan'], u3) returning id into o3;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Koordinator Luar', array['karyawan'], u4) returning id into o4;
  insert into public.orang (perusahaan_id, nama, jenis) values (pb, 'Orang Usaha B', array['karyawan']) returning id into ob;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, u1, 'staf', o1), (pa, u2, 'staf', o2), (pa, u3, 'staf', o3), (pa, u4, 'staf', o4);
  -- Data rahasia yang tidak boleh terbaca kepala divisi.
  insert into public.orang_rahasia (orang_id, perusahaan_id, rekening_akhir, gaji) values (o1, pa, '4321', '{"pokok": 4500000}');
  insert into public.periode_gaji (perusahaan_id, bulan) values (pa, date_trunc('month', hari)::date) returning id into per;
  insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, bruto, neto) values (pa, per, o1, 4500000, 4300000);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  k1 := json_build_object('sub', u1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k2 := json_build_object('sub', u2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k3 := json_build_object('sub', u3, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k4 := json_build_object('sub', u4, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'set local role authenticated';

  -- Mengatur divisi.
  perform set_config('request.jwt.claims', k2, true);
  begin perform public.simpan_divisi(null, 'Desain', o2, array[o1]); perform pg_temp.cek('staf tidak bisa membuat divisi', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa membuat divisi', true); end;
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.simpan_divisi(null, 'Desain', ob, array[o1]); perform pg_temp.cek('kepala dari usaha lain ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('kepala dari usaha lain ditolak', true); end;
  begin perform public.simpan_divisi(null, 'Desain', o2, array[o1, ob]); perform pg_temp.cek('anggota dari usaha lain ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('anggota dari usaha lain ditolak', true); end;
  begin perform public.simpan_divisi(null, 'D', o2, array[o1]); perform pg_temp.cek('nama divisi terlalu pendek ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('nama divisi terlalu pendek ditolak', true); end;
  r := public.simpan_divisi(null, 'Desain', o2, array[o1, o3, o3]);
  dv := (r ->> 'id')::uuid;
  perform pg_temp.cek('divisi tersimpan dengan 2 anggota (ganda diabaikan)', (select count(*) from public.divisi_anggota where divisi_id = dv and keluar_at is null) = 2, r::text);
  begin perform public.simpan_divisi(null, 'Desain', o2, array[o1]); perform pg_temp.cek('nama divisi ganda ditolak', false);
  exception when sqlstate '23505' then perform pg_temp.cek('nama divisi ganda ditolak', true); end;
  perform public.simpan_divisi(null, 'Konten', null, array[o4]);
  perform pg_temp.cek('pemilik melihat 2 divisi', (select count(*) from public.divisi) = 2);
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('kepala hanya melihat divisinya', (select count(*) from public.divisi) = 1 and (select count(*) from public.divisi_anggota) = 2);
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('anggota melihat divisinya', (select count(*) from public.divisi where id = dv) = 1);
  perform set_config('request.jwt.claims', k4, true);
  perform pg_temp.cek('staf divisi lain tidak melihat divisi Desain', (select count(*) from public.divisi where id = dv) = 0);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak melihat divisi', (select count(*) from public.divisi) = 0 and (select count(*) from public.divisi_anggota) = 0);
  begin perform public.simpan_divisi(dv, 'Curian', null, '{}'); perform pg_temp.cek('usaha lain tidak bisa mengubah divisi', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa mengubah divisi', true); end;

  -- Izin: kepala divisi menjadi penyetuju anggota yang tidak punya atasan langsung.
  perform set_config('request.jwt.claims', ka, true);
  perform public.ubah_profil_kerja(o3, 'Desainer', 'S1', 'Desain', o4, 'pkwtt', null, 'perubahan', null, null);
  perform set_config('request.jwt.claims', k1, true);
  r := public.ajukan_izin('izin', hari + 3, hari + 3, 'Urusan keluarga', null);
  execute 'reset role';
  select id into us1 from public.usulan where perusahaan_id = pa and (payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid;
  perform pg_temp.cek('izin anggota menunggu kepala divisi', (select status = 'menunggu_atasan' from public.usulan where id = us1)
    and (select penyetuju_orang = o2 from public.langkah_persetujuan where usulan_id = us1), r::text);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('kepala melihat langkah izin anggotanya', (select count(*) from public.langkah_saya()) = 1);
  perform public.putuskan_langkah((select id from public.langkah_saya() limit 1), true, null);
  execute 'reset role';
  perform pg_temp.cek('setelah kepala setuju: masuk Feed pemilik', (select status = 'menunggu' from public.usulan where id = us1));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k3, true);
  r := public.ajukan_izin('izin', hari + 4, hari + 4, null, null);
  execute 'reset role';
  perform pg_temp.cek('atasan langsung didahulukan dari kepala divisi', (select l.penyetuju_orang = o4 from public.langkah_persetujuan l join public.usulan u on u.id = l.usulan_id
     where (u.payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid));
  execute 'set local role authenticated';
  -- Kepala sedang cuti hari ini (penyetuju dipilih menurut hari pengajuan): izin anggota tidak menunggu kepala.
  perform set_config('request.jwt.claims', k2, true);
  r := public.ajukan_izin('cuti', hari, hari + 1, null, null);
  execute 'reset role';
  select id into iz from public.usulan where perusahaan_id = pa and (payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid;
  perform pg_temp.cek('izin kepala sendiri tidak ke dirinya', (select status = 'menunggu' from public.usulan where id = iz), r::text);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan(iz, true);
  perform set_config('request.jwt.claims', k1, true);
  r := public.ajukan_izin('izin', hari + 6, hari + 6, null, null);
  execute 'reset role';
  perform pg_temp.cek('kepala sedang cuti: izin anggota langsung ke Feed pemilik', (select status = 'menunggu' from public.usulan
     where (payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid));
  execute 'set local role authenticated';

  -- Kerja: kepala divisi meninjau hasil anggota.
  perform set_config('request.jwt.claims', ka, true);
  kr1 := (public.buat_kerja('Desain logo klien', null, o1, now() + interval '3 days', null) ->> 'id')::uuid;
  kr2 := (public.buat_kerja('Riset kompetitor', null, o4, now() + interval '3 days', null) ->> 'id')::uuid;
  kr3 := (public.buat_kerja('Poster bersama', null, o1, now() + interval '3 days', null) ->> 'id')::uuid;
  perform public.atur_pelaksana_kerja(kr3, jsonb_build_array(jsonb_build_object('orang_id', o1, 'porsi', 60, 'pic', true), jsonb_build_object('orang_id', o2, 'porsi', 40)));
  perform set_config('request.jwt.claims', k1, true);
  perform public.ubah_status_kerja(kr1, 'mulai');
  us1 := (public.kirim_hasil_kerja(kr1, 'https://drive.example.org/logo-v1', 'Versi pertama') ->> 'usulan')::uuid;
  perform public.ubah_status_kerja(kr3, 'mulai');
  us3 := (public.kirim_hasil_kerja(kr3, 'https://drive.example.org/poster', null) ->> 'usulan')::uuid;
  perform set_config('request.jwt.claims', k4, true);
  perform public.ubah_status_kerja(kr2, 'mulai');
  us2 := (public.kirim_hasil_kerja(kr2, null, 'Ringkasan riset terlampir') ->> 'usulan')::uuid;
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('kepala melihat kerja anggota divisinya, bukan kerja di luar divisi', (select count(*) from public.kerja where id = kr1) = 1
    and (select count(*) from public.kerja where id = kr2) = 0 and (select count(*) from public.kerja_hasil where kerja_id = kr1) = 1);
  perform set_config('request.jwt.claims', k3, true);
  perform pg_temp.cek('anggota tidak melihat kerja rekan divisinya', (select count(*) from public.kerja where id = kr1) = 0);
  perform set_config('request.jwt.claims', k2, true);
  r := public.daftar_review_kelola();
  perform pg_temp.cek('kepala melihat review anggota saja', jsonb_array_length(r) = 1 and r -> 0 ->> 'judul' = 'Desain logo klien' and r -> 0 ->> 'oleh' = 'Sari Desain', r::text);
  begin perform public.terima_hasil_kerja(us2); perform pg_temp.cek('kepala tidak menerima kerja di luar divisinya', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('kepala tidak menerima kerja di luar divisinya', true); end;
  begin perform public.minta_revisi_kerja(us2, 'Kurang lengkap'); perform pg_temp.cek('kepala tidak merevisi kerja di luar divisinya', false);
  exception when sqlstate '42501' then perform pg_temp.cek('kepala tidak merevisi kerja di luar divisinya', true); end;
  begin perform public.terima_hasil_kerja(us3); perform pg_temp.cek('kepala tidak menerima kerja yang ikut ia kerjakan', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('kepala tidak menerima kerja yang ikut ia kerjakan', true); end;
  begin perform public.minta_revisi_kerja(us1, 'ok'); perform pg_temp.cek('revisi tanpa alasan cukup ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('revisi tanpa alasan cukup ditolak', true); end;
  perform public.minta_revisi_kerja(us1, 'Logo terlalu kecil di HP');
  execute 'reset role';
  perform pg_temp.cek('revisi kepala: kerja kembali jalan dengan alasan', (select status from public.kerja where id = kr1) = 'jalan'
    and (select alasan from public.kerja_hasil where kerja_id = kr1 order by dibuat_at desc limit 1) = 'Logo terlalu kecil di HP');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k1, true);
  us4 := (public.kirim_hasil_kerja(kr1, 'https://drive.example.org/logo-v2', null) ->> 'usulan')::uuid;
  perform set_config('request.jwt.claims', k3, true);
  begin perform public.terima_hasil_kerja(us4); perform pg_temp.cek('anggota lain tidak bisa menerima hasil', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('anggota lain tidak bisa menerima hasil', true); end;
  perform pg_temp.cek('anggota lain tidak melihat daftar review', jsonb_array_length(public.daftar_review_kelola()) = 0);
  perform set_config('request.jwt.claims', kb, true);
  begin perform public.terima_hasil_kerja(us4); perform pg_temp.cek('usaha lain tidak bisa menerima hasil', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menerima hasil', true); end;
  perform set_config('request.jwt.claims', k2, true);
  r := public.terima_hasil_kerja(us4);
  perform pg_temp.cek('terima kedua kali tidak mengulang', (public.terima_hasil_kerja(us4) ->> 'sudah')::boolean);
  execute 'reset role';
  perform pg_temp.cek('kepala menerima: kerja selesai, usulan tercatat diputus kepala', (select status from public.kerja where id = kr1) = 'selesai'
    and (select status = 'diterima' and diputuskan_oleh = u2 from public.usulan where id = us4)
    and (select status from public.kerja_hasil where usulan_id = us4) = 'diterima', r::text);
  execute 'set local role authenticated';

  -- Kepala divisi tetap staf: tidak membaca gaji, rekening, slip orang lain, dan tidak bisa membuat kerja.
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('kepala tidak membaca data rahasia anggota', (select count(*) from public.orang_rahasia) = 0);
  perform pg_temp.cek('kepala tidak membaca slip anggota', (select count(*) from public.slip_gaji) = 0);
  begin perform public.buat_kerja('Kerja kepala', null, o1, null, null); perform pg_temp.cek('kepala tanpa peran kustom tidak membuat kerja', false);
  exception when sqlstate '42501' then perform pg_temp.cek('kepala tanpa peran kustom tidak membuat kerja', true); end;

  -- Peran kustom kerja.kelola dan proyek.kelola.
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.save_custom_role(null, 'Gaji', array['gaji.lihat']); perform pg_temp.cek('izin di luar katalog ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('izin di luar katalog ditolak', true); end;
  peran := public.save_custom_role(null, 'Koordinator proyek', array['kerja.kelola', 'proyek.kelola']);
  perform public.assign_custom_role(u4, peran);
  perform set_config('request.jwt.claims', k3, true);
  begin perform public.buat_proyek(jsonb_build_object('nama', 'Proyek staf', 'tipe', 'sekali')); perform pg_temp.cek('staf tanpa proyek.kelola tidak membuat proyek', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tanpa proyek.kelola tidak membuat proyek', true); end;
  perform set_config('request.jwt.claims', k4, true);
  r := public.buat_kerja('Briefing klien', null, o3, now() + interval '2 days', null);
  perform pg_temp.cek('pemegang kerja.kelola membuat kerja', r ->> 'id' is not null, r::text);
  perform public.atur_pelaksana_kerja((r ->> 'id')::uuid, jsonb_build_array(jsonb_build_object('orang_id', o3, 'porsi', 50, 'pic', true), jsonb_build_object('orang_id', o1, 'porsi', 50)));
  perform pg_temp.cek('pemegang kerja.kelola mengatur tim kerja', (select count(*) from public.kerja_pelaksana where kerja_id = (r ->> 'id')::uuid) = 2);
  perform pg_temp.cek('pemegang kerja.kelola melihat semua kerja usaha', (select count(*) from public.kerja where id in (kr1, kr2, kr3)) = 3);
  perform pg_temp.cek('pemegang kerja.kelola melihat review di luar divisinya', jsonb_array_length(public.daftar_review_kelola()) >= 1);
  r := public.buat_proyek(jsonb_build_object('nama', 'Kampanye Hotel', 'tipe', 'sekali', 'pic', o3));
  perform pg_temp.cek('pemegang proyek.kelola membuat proyek', r ->> 'id' is not null, r::text);
  perform pg_temp.cek('pemegang peran kustom tidak membaca gaji', (select count(*) from public.orang_rahasia) = 0 and (select count(*) from public.slip_gaji) = 0);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak melihat peran kustom', (select count(*) from public.custom_role where id = peran) = 0);

  -- Mengubah anggota divisi.
  perform set_config('request.jwt.claims', ka, true);
  perform public.simpan_divisi(dv, 'Desain grafis', o2, array[o1]);
  perform pg_temp.cek('anggota divisi diganti, anggota lama tercatat keluar (tidak dihapus)', (select count(*) from public.divisi_anggota where divisi_id = dv and keluar_at is null) = 1
    and (select keluar_at is not null from public.divisi_anggota where divisi_id = dv and orang_id = o3)
    and (select nama from public.divisi where id = dv) = 'Desain grafis');
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
