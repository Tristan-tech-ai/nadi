-- Tes T-01D (supabase/migrations/20261106100000_vision_camera_layout.sql): denah kamera mulai draf, hanya aktif lewat persetujuan
-- pemilik/admin, denah aktif lama kamera yang sama dimatikan, draf diputuskan sekali, klien tidak bisa menulis tabel, usaha lain
-- dan staf tidak melihat atau menyetujui, sidik dan zona dibatasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o uuid; d1 uuid; d2 uuid; r jsonb;
  z jsonb := '[{"nama":"Pintu","jenis":"pintu","poligon":[[0,0.8],[0.3,0.8],[0.3,1],[0,1]]}]';
  sid text := 'a1b2c3d4e5f60718';
begin
  insert into auth.users (id, email) values (ua, 'dk.a@uji.local'), (ub, 'dk.b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Uji Denah A', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji Denah B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o;
  perform public.buat_akun_staf(o, '530104');
  execute 'reset role';
  select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o;

  -- Draf ditulis Edge Function (peran layanan); di tes langsung sebagai pemilik tabel.
  insert into public.vision_camera_layout (perusahaan_id, sidik, zona) values (pa, sid, z) returning id into d1;
  insert into public.vision_camera_layout (perusahaan_id, sidik, zona) values (pa, sid, z) returning id into d2;
  perform pg_temp.cek('denah baru mulai draf', (select status = 'draf' from public.vision_camera_layout where id = d1));
  begin insert into public.vision_camera_layout (perusahaan_id, sidik, zona) values (pa, 'BUKAN-HEX', z);
    perform pg_temp.cek('sidik bukan hex ditolak', false);
  exception when check_violation then perform pg_temp.cek('sidik bukan hex ditolak', true); end;
  begin insert into public.vision_camera_layout (perusahaan_id, sidik, zona) values (pa, sid, '[]');
    perform pg_temp.cek('zona kosong ditolak', false);
  exception when check_violation then perform pg_temp.cek('zona kosong ditolak', true); end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('kamera belum dikenal: null', public.camera_layout(sid) is null);
  begin insert into public.vision_camera_layout (perusahaan_id, sidik, zona) values (pa, sid, z);
    perform pg_temp.cek('klien tidak bisa menulis denah', false);
  exception when insufficient_privilege then perform pg_temp.cek('klien tidak bisa menulis denah', true); end;
  r := public.approve_camera_layout(d1);
  perform pg_temp.cek('pemilik menyetujui draf', r ->> 'id' = d1::text);
  perform pg_temp.cek('kamera dikenal setelah disetujui', (public.camera_layout(sid) ->> 'id') = d1::text);
  begin perform public.approve_camera_layout(d1);
    perform pg_temp.cek('draf diputuskan sekali', false);
  exception when sqlstate '55000' then perform pg_temp.cek('draf diputuskan sekali', true); end;
  r := public.approve_camera_layout(d2, '[{"nama":"Pintu samping","jenis":"pintu","poligon":[[0.7,0],[1,0],[1,0.2],[0.7,0.2]]}]');
  perform pg_temp.cek('zona sunting pemilik dipakai', (public.camera_layout(sid) -> 'zona' -> 0 ->> 'nama') = 'Pintu samping');
  perform pg_temp.cek('denah aktif lama dimatikan', (select status = 'mati' from public.vision_camera_layout where id = d1));

  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak melihat denah', (select count(*) = 0 from public.vision_camera_layout where perusahaan_id = pa));
  perform pg_temp.cek('usaha lain: kamera tidak dikenal', public.camera_layout(sid) is null);
  begin perform public.approve_camera_layout(d2);
    perform pg_temp.cek('usaha lain tidak bisa menyetujui', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menyetujui', true); end;

  perform set_config('request.jwt.claims', ks, true);
  begin perform public.camera_layout(sid);
    perform pg_temp.cek('staf ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf ditolak', true); end;
  perform pg_temp.cek('staf tidak melihat tabel', (select count(*) = 0 from public.vision_camera_layout));
  execute 'reset role';
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
