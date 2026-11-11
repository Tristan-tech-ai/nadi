-- Tes X-04 Nadi Mod (supabase/migrations/20261111120000_mod.sql): draf hanya pemilik/admin, terapkan butuh lolos pemeriksaan,
-- akses per peran dibatasi database, isi catatan divalidasi terhadap manifest (kunci asing, tipe, pilihan, https, rujukan usaha
-- sendiri), transisi status dan wajib_isi, milik_sendiri, isolasi usaha lain, MCP hanya draf/data, batas jumlah. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid; o_lain uuid;
  man jsonb; r jsonb; v_mod uuid; v_mod_b uuid; rec uuid; rec2 uuid; rec_b uuid; i int; n int; tok text := 'nmc_' || repeat('ab', 32);
begin
  begin
    insert into auth.users (id, email) values (ua, 'mod.a@uji.local'), (ub, 'mod.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Agensi Uji Mod', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Mod', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Mod') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '640001');
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Orang Lain') returning id into o_lain;
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;
    man := '{"skema":1,"kode":"tugas-tim","nama":"Tugas tim","deskripsi":"Tugas dengan review.","ikon":"kanban","ruang":"orang","versi":"1.0.0",
      "koleksi":[{"kode":"tugas","nama":"Tugas","judul":"judul","bidang":[
        {"kode":"judul","label":"Judul","tipe":"teks","wajib":true},
        {"kode":"pelaksana","label":"Pelaksana","tipe":"orang","banyak":true,"penugasan":true},
        {"kode":"prioritas","label":"Prioritas","tipe":"pilihan","pilihan":[{"kode":"biasa","label":"Biasa"},{"kode":"tinggi","label":"Tinggi"}]},
        {"kode":"jam","label":"Jam","tipe":"angka","min":0,"max":100},
        {"kode":"hasil","label":"Tautan hasil","tipe":"tautan"},
        {"kode":"induk","label":"Bagian dari","tipe":"rujukan","koleksi":"tugas"},
        {"kode":"tenggat","label":"Tenggat","tipe":"tanggal"}],
        "status":{"awal":"antrian","daftar":[{"kode":"antrian","label":"Antrian"},{"kode":"review","label":"Review"},{"kode":"selesai","label":"Selesai","akhir":true}],
          "transisi":[{"dari":["antrian"],"ke":"review","peran":["ditugaskan"],"wajib_isi":["hasil"]},{"dari":["review"],"ke":"selesai","peran":["pemilik","admin"]}]},
        "tampilan":[{"jenis":"papan","kolom_kartu":["pelaksana"]}],
        "akses":{"pemilik":"kelola","admin":"kelola","akuntan":"lihat","staf":"milik_sendiri"}}]}';

    -- draf
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.mod_draf_simpan(man); perform pg_temp.cek('staf tidak bisa menyusun draf', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa menyusun draf', true); end;
    perform set_config('request.jwt.claims', ka, true);
    r := public.mod_draf_simpan(man);
    v_mod := (r->>'id')::uuid;
    perform pg_temp.cek('pemilik menyimpan draf yang lolos', (r->>'lolos')::boolean, r::text);
    perform pg_temp.cek('draf belum aktif', (select status from public.mod where id = v_mod) = 'draf');
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', '{"judul":"x"}'); perform pg_temp.cek('mod draf belum bisa diisi', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('mod draf belum bisa diisi', true); end;
    r := public.mod_draf_simpan(jsonb_set(man, '{nama}', '"<script>x</script>"'));
    perform pg_temp.cek('draf berbahaya tersimpan dengan alasan', not (r->>'lolos')::boolean, r::text);
    perform pg_temp.cek('daftar draf pemilik memuat draf dengan alasannya',
      exists (select 1 from jsonb_array_elements(public.mod_draf_daftar()) d where (d->>'id')::uuid = v_mod and jsonb_array_length(d->'alasan') > 0));
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.mod_draf_daftar(); perform pg_temp.cek('staf tidak bisa membaca daftar draf', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa membaca daftar draf', true); end;
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.mod_terapkan(v_mod); perform pg_temp.cek('draf dengan alasan tidak bisa diterapkan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('draf dengan alasan tidak bisa diterapkan', true); end;
    r := public.mod_draf_simpan(man, 'sendiri', array['bidang x salah']);
    begin perform public.mod_terapkan(v_mod); perform pg_temp.cek('alasan pengawas aplikasi menahan terapkan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('alasan pengawas aplikasi menahan terapkan', true); end;
    perform public.mod_draf_simpan(man);
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.mod_terapkan(v_mod); perform pg_temp.cek('staf tidak bisa menerapkan', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa menerapkan', true); end;
    perform set_config('request.jwt.claims', ka, true);
    r := public.mod_terapkan(v_mod);
    perform pg_temp.cek('pemilik menerapkan versi 1', (r->>'versi')::int = 1 and (select status from public.mod where id = v_mod) = 'aktif', r::text);

    -- akses dibatasi database
    perform pg_temp.cek('akses staf kelola diturunkan ke tulis', app.mod_akses('{"koleksi":[{"kode":"k","akses":{"staf":"kelola"}}]}', 'k', 'staf') = 'tulis');
    perform pg_temp.cek('akses nilai asing menjadi tidak', app.mod_akses('{"koleksi":[{"kode":"k","akses":{"staf":"super"}}]}', 'k', 'staf') = 'tidak');
    perform pg_temp.cek('pemilik selalu kelola', app.mod_akses('{"koleksi":[{"kode":"k","akses":{"pemilik":"tidak"}}]}', 'k', 'pemilik') = 'kelola');
    perform pg_temp.cek('peran asing tidak punya akses', app.mod_akses(man, 'tugas', 'service_role') = 'tidak');

    -- validasi isi
    rec := (public.mod_catatan_simpan(v_mod, 'tugas', jsonb_build_object('judul', 'Desain landing', 'pelaksana', jsonb_build_array(o_budi), 'prioritas', 'tinggi', 'jam', 4)) ->> 'id')::uuid;
    perform pg_temp.cek('catatan sah tersimpan dengan status awal', (select status from public.mod_record where id = rec) = 'antrian');
    perform pg_temp.cek('pelaksana menjadi ditugaskan', (select o_budi = any (ditugaskan) from public.mod_record where id = rec));
    n := 0;
    for i in 1..9 loop
      begin
        perform public.mod_catatan_simpan(v_mod, 'tugas', (array[
          '{"judul":"a","sql":"drop"}', '{"pelaksana":[]}', '{"judul":"a","prioritas":"darurat"}', '{"judul":"a","jam":500}',
          '{"judul":"a","hasil":"http://contoh.test"}', '{"judul":"a","hasil":"javascript:alert(1)"}', '{"judul":"a","tenggat":"2026-13-40"}',
          '{"judul":"a","jam":"empat"}', '{"judul":"a","induk":"00000000-0000-0000-0000-000000000000"}'])[i]::jsonb);
      exception when sqlstate '22023' then n := n + 1; end;
    end loop;
    perform pg_temp.cek('9 isi tidak sah ditolak (kunci asing, wajib, pilihan, batas, http, javascript, tanggal, tipe, rujukan)', n = 9, n::text);
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', jsonb_build_object('judul', 'Curi', 'pelaksana', jsonb_build_array(o_lain)));
      perform pg_temp.cek('orang usaha lain tidak bisa dirujuk', false);
    exception when sqlstate '22023' then perform pg_temp.cek('orang usaha lain tidak bisa dirujuk', true); end;
    rec2 := (public.mod_catatan_simpan(v_mod, 'tugas', jsonb_build_object('judul', 'Sub', 'induk', rec)) ->> 'id')::uuid;
    perform pg_temp.cek('rujukan ke catatan sendiri diterima', rec2 is not null);

    -- transisi + wajib_isi + milik_sendiri
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.mod_catatan_status(rec, 'review'); perform pg_temp.cek('wajib_isi hasil ditegakkan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('wajib_isi hasil ditegakkan', true); end;
    perform public.mod_catatan_simpan(v_mod, 'tugas', jsonb_build_object('judul', 'Desain landing', 'pelaksana', jsonb_build_array(o_budi), 'hasil', 'https://contoh.test/hasil'), rec);
    perform pg_temp.cek('staf ditugaskan mengubah catatannya', true);
    perform public.mod_catatan_status(rec, 'review');
    perform pg_temp.cek('pelaksana mengirim ke review', (select status from public.mod_record where id = rec) = 'review');
    begin perform public.mod_catatan_status(rec, 'selesai'); perform pg_temp.cek('staf tidak bisa menerima hasilnya sendiri', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa menerima hasilnya sendiri', true); end;
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', '{"judul":"Ubah sub"}', rec2); perform pg_temp.cek('milik_sendiri: staf tidak mengubah catatan orang lain', false);
    exception when sqlstate '42501' then perform pg_temp.cek('milik_sendiri: staf tidak mengubah catatan orang lain', true); end;
    begin perform public.mod_catatan_arsip(rec); perform pg_temp.cek('staf tidak bisa mengarsipkan', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa mengarsipkan', true); end;
    perform pg_temp.cek('staf membaca catatan koleksi yang boleh dilihat', (select count(*) from public.mod_record where mod_id = v_mod) = 2);
    perform pg_temp.cek('staf tidak membaca kolom draf', not has_column_privilege('authenticated', 'public.mod', 'draf', 'select'));
    perform set_config('request.jwt.claims', ka, true);
    perform public.mod_catatan_status(rec, 'selesai');
    perform pg_temp.cek('pemilik menerima, selesai_at terisi', (select selesai_at is not null from public.mod_record where id = rec));
    begin perform public.mod_catatan_status(rec, 'antrian'); perform pg_temp.cek('transisi yang tidak ada ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('transisi yang tidak ada ditolak', true); end;

    -- isolasi usaha lain
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat mod', (select count(*) from public.mod where id = v_mod) = 0);
    perform pg_temp.cek('usaha lain tidak melihat catatan', (select count(*) from public.mod_record where mod_id = v_mod) = 0);
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', '{"judul":"masuk"}'); perform pg_temp.cek('usaha lain tidak bisa menulis ke mod ini', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menulis ke mod ini', true); end;
    begin perform public.mod_atur(v_mod, 'matikan'); perform pg_temp.cek('usaha lain tidak bisa mematikan', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa mematikan', true); end;
    v_mod_b := (public.mod_draf_simpan(man) ->> 'id')::uuid;
    perform public.mod_terapkan(v_mod_b);
    begin perform public.mod_catatan_simpan(v_mod_b, 'tugas', jsonb_build_object('judul', 'Rujuk A', 'induk', rec));
      perform pg_temp.cek('catatan usaha lain tidak bisa dirujuk', false);
    exception when sqlstate '22023' then perform pg_temp.cek('catatan usaha lain tidak bisa dirujuk', true); end;

    -- matikan, rollback
    perform set_config('request.jwt.claims', ka, true);
    perform public.mod_atur(v_mod, 'matikan');
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', '{"judul":"x"}'); perform pg_temp.cek('mod mati menolak tulis', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('mod mati menolak tulis', true); end;
    perform pg_temp.cek('catatan mod mati tersembunyi dari pengguna', (select count(*) from public.mod_record where mod_id = v_mod) = 0);
    execute 'reset role';
    perform pg_temp.cek('data tetap ada saat mod mati (tidak dihapus)', (select count(*) from public.mod_record where mod_id = v_mod and perusahaan_id = pa) = 2);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.mod_atur(v_mod, 'rollback', 1);
    perform pg_temp.cek('rollback ke versi 1 menyalakan lagi', (select status from public.mod where id = v_mod) = 'aktif');

    execute 'reset role';

    -- MCP: token pemilik bisa draf dan data, tidak ada jalur terapkan
    insert into public.mcp_token (perusahaan_id, user_id, token_hash, jenis, resource, cakupan, kedaluwarsa_at, nama_klien, client_id, petunjuk)
    values (pa, ua, app.hash_token(tok), 'akses', 'http://uji.local/api/mcp', array['nadi.baca', 'nadi.usul'], now() + interval '1 hour', 'uji', 'klien-uji-mod', right(tok, 4));
    r := public.mcp_mod_draf_tulis(tok, 'http://uji.local/api/mcp', jsonb_set(man, '{kode}', '"mod-dari-ai"'));
    perform pg_temp.cek('MCP menulis draf bersumber ai', (select sumber = 'ai' and status = 'draf' from public.mod where perusahaan_id = pa and kode = 'mod-dari-ai'), r::text);
    -- X-07: draf dari AI tampil di halaman Tambah fitur pemilik (mod_draf_daftar) untuk diterapkan pemilik sendiri
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('draf AI muncul di daftar draf pemilik', exists (select 1 from jsonb_array_elements(public.mod_draf_daftar()) d where d->>'kode' = 'mod-dari-ai' and d->>'sumber' = 'ai'));
    execute 'reset role';
    perform pg_temp.cek('tidak ada fungsi MCP untuk menerapkan', not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname like 'mcp_mod%' and p.proname ~ '(terapkan|atur|matikan|rollback)'));
    begin perform public.mcp_mod_draf_tulis('nmc_' || repeat('cd', 32), 'http://uji.local/api/mcp', man); perform pg_temp.cek('token palsu ditolak', false);
    exception when sqlstate 'P0401' then perform pg_temp.cek('token palsu ditolak', true); end;
    r := public.mcp_mod_data_baca(tok, 'http://uji.local/api/mcp', 'tugas-tim', 'tugas');
    perform pg_temp.cek('MCP membaca data usaha sendiri saja', jsonb_array_length(r) = 2, r::text);
    perform pg_temp.cek('log mencatat jalur mcp', exists (select 1 from public.mod_log where perusahaan_id = pa and lewat = 'mcp'));
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- batas jumlah mod
    n := 0;
    for i in 1..45 loop
      begin perform public.mod_draf_simpan(jsonb_set(man, '{kode}', to_jsonb('mod-uji-' || i))); exception when sqlstate 'P0429' then n := n + 1; end;
    end loop;
    perform pg_temp.cek('maksimal 40 mod per usaha', (select count(*) from public.mod where perusahaan_id = pa) = 40 and n > 0, n::text);
    execute 'reset role';
    -- X-09 banjir: lebih dari 2.000 perubahan catatan per usaha dalam satu jam ditolak database (lapis di belakang batas laju MCP)
    insert into public.mod_log (perusahaan_id, mod_id, oleh, jenis) select pa, v_mod, ua, 'buat' from generate_series(1, 2000);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.mod_catatan_simpan(v_mod, 'tugas', '{"judul":"banjir"}'); perform pg_temp.cek('banjir catatan ditahan 2.000 per jam', false);
    exception when sqlstate 'P0429' then perform pg_temp.cek('banjir catatan ditahan 2.000 per jam', true); end;
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
