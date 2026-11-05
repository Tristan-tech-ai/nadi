-- Tes M-20 alur (supabase/migrations/20261105093000_alur.sql): formulir kustom menjadi kejadian, alur dengan syarat memicu kartu
-- Feed dan kerja, batas jalan per jam (selebihnya 'dibatasi'), alur tidak memicu alur lain, webhook https publik saja dan antre di
-- pg_net (tes dibatalkan, jadi tidak ada yang terkirim), rahasia tidak terbaca klien, aksi gagal tercatat tanpa membatalkan
-- kejadian, staf dan usaha lain tidak bisa mengatur atau melihat alur. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid;
  fm uuid; fa uuid; fw uuid; r jsonb; k uuid; i int; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'al.a@uji.local'), (ub, 'al.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Alur', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Alur', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '540001');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.save_form('{"nama": "Palsu", "bidang": [{"kunci": "a", "label": "A", "jenis": "teks"}]}'); perform pg_temp.cek('staf tidak membuat formulir', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat formulir', true); end;

    perform set_config('request.jwt.claims', ka, true);
    begin perform public.save_form('{"nama": "Kembar", "bidang": [{"kunci": "a", "label": "A", "jenis": "teks"}, {"kunci": "a", "label": "B", "jenis": "teks"}]}');
      perform pg_temp.cek('kode isian kembar ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kode isian kembar ditolak', true); end;
    fm := public.save_form('{"nama": "Laporan kerusakan alat", "bidang": [{"kunci": "alat", "label": "Alat", "jenis": "teks", "wajib": true},
      {"kunci": "tingkat", "label": "Tingkat", "jenis": "pilihan", "pilihan": ["ringan", "parah"], "wajib": true}, {"kunci": "biaya", "label": "Perkiraan biaya", "jenis": "angka"}]}');
    r := public.save_flow(jsonb_build_object('nama', 'Kerusakan parah', 'pemicu', 'formulir.kirim', 'formulir', fm, 'batas_jam', 3,
      'syarat', '[{"bidang": "tingkat", "op": "=", "nilai": "parah"}]'::jsonb,
      'aksi', '[{"jenis": "kartu", "judul": "Alat rusak parah: {alat}"}, {"jenis": "kerja", "judul": "Perbaiki {alat}"}]'::jsonb));
    fa := (r ->> 'id')::uuid;
    perform pg_temp.cek('alur tanpa webhook tidak punya rahasia', r -> 'rahasia' = 'null'::jsonb, r::text);
    -- URL webhook tidak sah.
    n := 0;
    for i in 1..5 loop
      begin
        perform public.save_flow(jsonb_build_object('nama', 'Kirim keluar', 'pemicu', 'invoice.lunas', 'aksi',
          jsonb_build_array(jsonb_build_object('jenis', 'webhook', 'url', (array['http://contoh.nadi.test/a', 'https://127.0.0.1/a', 'https://localhost/a', 'https://db.internal/a', 'https://router.local'])[i]))));
      exception when sqlstate '22023' then n := n + 1; end;
    end loop;
    perform pg_temp.cek('5 URL webhook tidak sah ditolak (http, IP, localhost, .internal, .local)', n = 5, n::text);
    r := public.save_flow(jsonb_build_object('nama', 'Kirim ke sistem gudang', 'pemicu', 'formulir.kirim', 'formulir', fm,
      'aksi', '[{"jenis": "webhook", "url": "https://gudang.contoh-uji.test/hook"}]'::jsonb));
    fw := (r ->> 'id')::uuid;
    perform pg_temp.cek('alur webhook memberi rahasia 48 heksa sekali', length(r ->> 'rahasia') = 48, r::text);
    begin perform (select max(rahasia) from public.flow); perform pg_temp.cek('rahasia tidak bisa dibaca klien', false);
    exception when sqlstate '42501' then perform pg_temp.cek('rahasia tidak bisa dibaca klien', true); end;

    -- Staf mengisi formulir.
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.submit_form(fm, '{"tingkat": "parah"}'); perform pg_temp.cek('isian wajib kosong ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('isian wajib kosong ditolak', true); end;
    begin perform public.submit_form(fm, '{"alat": "Oven", "tingkat": "hancur"}'); perform pg_temp.cek('pilihan tak dikenal ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('pilihan tak dikenal ditolak', true); end;
    begin perform public.submit_form(fm, '{"alat": "Oven", "tingkat": "parah", "biaya": "mahal"}'); perform pg_temp.cek('angka tak sah ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('angka tak sah ditolak', true); end;
    perform public.submit_form(fm, '{"alat": "Kipas", "tingkat": "ringan"}');
    for i in 1..5 loop perform public.submit_form(fm, '{"alat": "Oven", "tingkat": "parah", "biaya": "350000"}'); end loop;
    perform pg_temp.cek('staf tidak melihat alur, jalan, maupun webhook', (select count(*) from (select id from public.flow) x) = 0
      and (select count(*) from public.flow_run) = 0 and (select count(*) from public.flow_webhook) = 0 and jsonb_array_length(public.flow_runs(fa)) = 0);
    perform pg_temp.cek('staf membaca formulir untuk diisi', (select count(*) from public.custom_form) = 1);

    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('syarat: kiriman ringan tidak menjalankan alur parah; 5 parah = 3 jalan + 2 dibatasi',
      (select count(*) from public.flow_run where flow_id = fa and status = 'jalan') = 3 and (select count(*) from public.flow_run where flow_id = fa and status = 'dibatasi') = 2,
      (select string_agg(status, ',') from public.flow_run where flow_id = fa));
    perform pg_temp.cek('kartu Feed dari templat untuk pemilik (3)', (select count(*) from public.usulan where perusahaan_id = pa and aksi = 'info.alur' and judul = 'Alat rusak parah: Oven'
      and 'pemilik' = any(untuk_peran)) = 3);
    perform pg_temp.cek('kerja dibuat (3)', (select count(*) from public.kerja where perusahaan_id = pa and judul = 'Perbaiki Oven') = 3);
    perform pg_temp.cek('webhook: 6 kiriman (tanpa syarat) antre di pg_net', (select count(*) from public.flow_webhook where flow_id = fw and request_id is not null) = 6,
      (select count(*) from public.flow_webhook)::text);
    perform pg_temp.cek('flow_runs menampilkan jalan untuk pemilik', jsonb_array_length(public.flow_runs(fa)) = 5);

    -- Alur tidak memicu alur lain: kejadian yang dibuat saat penanda alur menyala diabaikan.
    execute 'reset role';
    select count(*) into n from public.flow_run where flow_id = fw;
    perform set_config('app.dalam_alur', '1', true);
    insert into public.kejadian (perusahaan_id, jenis, sumber, data) values (pa, 'formulir.kirim', 'sistem', jsonb_build_object('formulir', fm, 'alat', 'Rak', 'tingkat', 'parah'));
    perform set_config('app.dalam_alur', '', true);
    perform pg_temp.cek('kejadian di dalam alur tidak memicu alur', (select count(*) from public.flow_run where flow_id = fw) = n);
    -- Batas webhook usaha tercapai: aksi gagal tercatat, kejadian tetap tersimpan.
    insert into public.flow_webhook (perusahaan_id, flow_id, run_id, url) select pa, fw, (select id from public.flow_run where flow_id = fw limit 1), 'https://x.test' from generate_series(1, 200);
    insert into public.kejadian (perusahaan_id, jenis, sumber, data) values (pa, 'formulir.kirim', 'sistem', jsonb_build_object('formulir', fm, 'alat', 'Rak', 'tingkat', 'ringan')) returning id into k;
    perform pg_temp.cek('aksi gagal tercatat dengan alasannya, kejadian tetap ada', (select status = 'gagal' and catatan like 'Batas 200 webhook%' from public.flow_run where kejadian_id = k and flow_id = fw)
      and exists (select 1 from public.kejadian where id = k));
    -- Alur nonaktif tidak jalan.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.set_flow_active(fw, false);
    perform set_config('request.jwt.claims', ks, true);
    k := public.submit_form(fm, '{"alat": "Meja", "tingkat": "ringan"}');
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('alur nonaktif tidak jalan', not exists (select 1 from public.flow_run where kejadian_id = k));

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat formulir, alur, jalan', (select count(*) from public.custom_form) = 0 and (select count(*) from (select id from public.flow) x) = 0
      and (select count(*) from public.flow_run) = 0 and jsonb_array_length(public.flow_runs(fa)) = 0);
    begin perform public.submit_form(fm, '{"alat": "Oven", "tingkat": "parah"}'); perform pg_temp.cek('usaha lain tidak mengisi formulir asing', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengisi formulir asing', true); end;
    begin perform public.save_flow(jsonb_build_object('nama', 'Curi', 'pemicu', 'formulir.kirim', 'formulir', fm, 'aksi', '[{"jenis": "kartu", "judul": "Curi data"}]'::jsonb));
      perform pg_temp.cek('usaha lain tidak memakai formulir asing', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai formulir asing', true); end;
    begin perform public.set_flow_active(fa, false); perform pg_temp.cek('usaha lain tidak mematikan alur asing', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mematikan alur asing', true); end;
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
