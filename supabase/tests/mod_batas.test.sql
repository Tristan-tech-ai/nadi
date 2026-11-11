-- Tes X-19 batas per usaha Nadi Mod yang ditegakkan database (docs/quality/ancaman-mod.md), diuji tepat di ambang: satu di bawah
-- batas lolos, tepat di batas ditolak. Juga penjagaan inti di database bila pengawas TypeScript dilewati (klien memanggil RPC
-- langsung dengan manifest berbahaya). Batas 40 mod dan 2.000 perubahan per jam ada di mod.test.sql. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; man jsonb; r jsonb; v_mod uuid; v_uid uuid := ua; besar jsonb; i int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'batas.mod@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Uji Batas Mod', 'kantor');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    man := '{"skema":1,"kode":"catatan-uji","nama":"Catatan uji","deskripsi":"Uji batas.","ikon":"dokumen","ruang":"dokumen","versi":"1.0.0",
      "koleksi":[{"kode":"catatan","nama":"Catatan","judul":"judul","bidang":[{"kode":"judul","label":"Judul","tipe":"teks","wajib":true},
        {"kode":"isi","label":"Isi","tipe":"teks_panjang"},{"kode":"isi2","label":"Isi 2","tipe":"teks_panjang"},{"kode":"isi3","label":"Isi 3","tipe":"teks_panjang"},
        {"kode":"isi4","label":"Isi 4","tipe":"teks_panjang"},{"kode":"isi5","label":"Isi 5","tipe":"teks_panjang"}],
        "tampilan":[{"jenis":"daftar","kolom":["judul"]}],"akses":{"pemilik":"kelola","admin":"kelola","akuntan":"lihat","staf":"tulis"}}]}';

    -- Manifest lebih dari 64 KB ditolak sebelum disimpan.
    besar := jsonb_set(man, '{deskripsi}', to_jsonb(repeat('panjang ', 9000)));
    begin perform public.mod_draf_simpan(besar, 'sendiri', '{}'); perform pg_temp.cek('manifest lebih dari 64 KB ditolak', false, pg_column_size(besar)::text);
    exception when sqlstate '22023' then perform pg_temp.cek('manifest lebih dari 64 KB ditolak', true); end;

    -- Pengawas TypeScript dilewati: database tetap menandai label berbahaya dan menolak menerapkannya.
    r := public.mod_draf_simpan(jsonb_set(man, '{koleksi,0,bidang,0,label}', '"<script>alert(1)</script>"'), 'sendiri', '{}');
    perform pg_temp.cek('label berisi skrip ditandai database walau pengawas aplikasi dilewati', (r ->> 'lolos')::boolean is false
      and r -> 'alasan' ? 'label bidang tidak sah: judul', r::text);
    begin perform public.mod_terapkan((r ->> 'id')::uuid); perform pg_temp.cek('draf berlabel skrip tidak bisa diterapkan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('draf berlabel skrip tidak bisa diterapkan', true); end;
    r := public.mod_draf_simpan(jsonb_set(man, '{koleksi,0,bidang,0,kode}', '"perusahaan_id"'), 'sendiri', '{}');
    perform pg_temp.cek('kode bidang sistem (perusahaan_id) ditandai database', (r ->> 'lolos')::boolean is false, r::text);
    r := public.mod_draf_simpan(jsonb_set(man, '{koleksi,0,akses,staf}', '"dewa"'), 'sendiri', '{}');
    perform pg_temp.cek('nilai akses asing ditandai database', (r ->> 'lolos')::boolean is false, r::text);

    -- Manifest sah, diterapkan.
    r := public.mod_draf_simpan(man, 'sendiri', '{}');
    perform public.mod_terapkan((r ->> 'id')::uuid);
    v_mod := (r ->> 'id')::uuid;

    -- Catatan lebih dari 32 KB ditolak walau setiap isian di bawah batasnya (5 x 5.000 huruf dua bita = 50 KB).
    begin perform public.mod_catatan_simpan(v_mod, 'catatan', jsonb_build_object('judul', 'Besar', 'isi', repeat('é', 5000), 'isi2', repeat('é', 5000),
        'isi3', repeat('é', 5000), 'isi4', repeat('é', 5000), 'isi5', repeat('é', 5000)));
      perform pg_temp.cek('catatan lebih dari 32 KB ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('catatan lebih dari 32 KB ditolak', sqlerrm like 'Isi catatan maksimal 32 KB%', sqlerrm); end;
    r := public.mod_catatan_simpan(v_mod, 'catatan', jsonb_build_object('judul', 'Hampir batas', 'isi', repeat('é', 5000), 'isi2', repeat('é', 5000), 'isi3', repeat('é', 5000)));
    perform pg_temp.cek('catatan 30 KB masih diterima', r ->> 'id' is not null);

    -- 60 draf per jam: 59 sebelumnya masih boleh, tepat 60 ditolak.
    execute 'reset role';
    insert into public.mod_log (perusahaan_id, mod_id, oleh, jenis, at)
      select pa, v_mod, v_uid, 'draf', now() - interval '10 minutes' from generate_series(1, 59 - (select count(*)::int from public.mod_log where perusahaan_id = pa and jenis = 'draf'));
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.mod_draf_simpan(jsonb_set(man, '{nama}', '"Catatan uji 2"'), 'sendiri', '{}');
    perform pg_temp.cek('draf ke-60 dalam satu jam masih diterima', r ->> 'id' is not null, r::text);
    begin perform public.mod_draf_simpan(jsonb_set(man, '{nama}', '"Catatan uji 3"'), 'sendiri', '{}'); perform pg_temp.cek('draf ke-61 dalam satu jam ditolak', false);
    exception when sqlstate 'P0429' then perform pg_temp.cek('draf ke-61 dalam satu jam ditolak', true); end;

    -- 20.000 catatan per koleksi: 19.999 masih boleh menambah satu, tepat 20.000 ditolak.
    execute 'reset role';
    insert into public.mod_record (perusahaan_id, mod_id, koleksi, data, dibuat_oleh)
      select pa, v_mod, 'catatan', jsonb_build_object('judul', 'C' || g), v_uid from generate_series(1, 19999 - (select count(*)::int from public.mod_record where mod_id = v_mod)) g;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.mod_catatan_simpan(v_mod, 'catatan', '{"judul":"Ke-20000"}');
    perform pg_temp.cek('catatan ke-20.000 masih diterima', r ->> 'id' is not null);
    begin perform public.mod_catatan_simpan(v_mod, 'catatan', '{"judul":"Ke-20001"}'); perform pg_temp.cek('catatan ke-20.001 ditolak', false);
    exception when sqlstate 'P0429' then perform pg_temp.cek('catatan ke-20.001 ditolak', true); end;
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
