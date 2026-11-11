-- Tes H-02: app.rasio_baca(hari) merangkum per jenis berkas berapa yang dibaca aturan (tanpa model) dan berapa lewat model,
-- rasio tanpa model, dan token AI per jenis (baca_berkas + tulis_aturan); berkas di luar jendela hari tidak ikut; total semua
-- jenis ada di baris "semua"; authenticated tidak bisa memanggil.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; r jsonb; cv jsonb; semua jsonb; b1 uuid; b2 uuid; b3 uuid; b4 uuid;
  sebelum jsonb;
begin
  begin
    sebelum := app.rasio_baca(7);
    insert into auth.users (id, email) values (ua, 'rasio-a@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Rasio', 'fnb');
    execute 'reset role';
    insert into public.berkas (perusahaan_id, jalur, nama_asli, mime, ukuran, sha256, status, jenis_terdeteksi, hasil, dibuat_at, diunggah_oleh)
    values
      (pa, pa || '/lempar/r1.pdf', 'r1.pdf', 'application/pdf', 10, repeat('a', 64), 'selesai', 'cv', '{"jenis":"cv","sumber":"aturan"}', now(), ua),
      (pa, pa || '/lempar/r2.pdf', 'r2.pdf', 'application/pdf', 10, repeat('b', 64), 'selesai', 'cv', '{"jenis":"cv","sumber":"model"}', now(), ua),
      (pa, pa || '/lempar/r3.pdf', 'r3.pdf', 'application/pdf', 10, repeat('c', 64), 'selesai', 'cv', '{"jenis":"cv","sumber":"aturan"}', now(), ua),
      (pa, pa || '/lempar/r4.png', 'r4.png', 'image/png', 10, repeat('d', 64), 'selesai', 'nota', '{"jenis":"nota","sumber":"model"}', now() - interval '30 days', ua);
    select id into b2 from public.berkas where perusahaan_id = pa and nama_asli = 'r2.pdf';
    select id into b4 from public.berkas where perusahaan_id = pa and nama_asli = 'r4.png';
    insert into public.pemakaian_ai (perusahaan_id, berkas_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis)
    values (pa, b2, 'baca_berkas', 'uji', 1000, 200, 0, 0), (pa, b2, 'tulis_aturan', 'uji', 500, 100, 0, 0), (pa, b4, 'baca_berkas', 'uji', 9000, 0, 0, 0);

    r := app.rasio_baca(7);
    select x into cv from jsonb_array_elements(r -> 'jenis') x where x ->> 'jenis' = 'cv';
    perform pg_temp.cek('cv: tambahan 2 aturan 1 model', (cv ->> 'aturan')::int - coalesce((select (x ->> 'aturan')::int from jsonb_array_elements(sebelum -> 'jenis') x where x ->> 'jenis' = 'cv'), 0) = 2
      and (cv ->> 'model')::int - coalesce((select (x ->> 'model')::int from jsonb_array_elements(sebelum -> 'jenis') x where x ->> 'jenis' = 'cv'), 0) = 1, cv::text);
    perform pg_temp.cek('rasio tanpa model = aturan / (aturan + model)', abs((cv ->> 'rasio')::numeric - (cv ->> 'aturan')::numeric / nullif((cv ->> 'aturan')::numeric + (cv ->> 'model')::numeric, 0)) < 0.001, cv::text);
    perform pg_temp.cek('token cv termasuk tulis_aturan', (cv ->> 'token')::bigint - coalesce((select (x ->> 'token')::bigint from jsonb_array_elements(sebelum -> 'jenis') x where x ->> 'jenis' = 'cv'), 0) = 1800, cv::text);
    perform pg_temp.cek('berkas 30 hari lalu tidak ikut jendela 7 hari', coalesce((select (x ->> 'token')::bigint from jsonb_array_elements(r -> 'jenis') x where x ->> 'jenis' = 'nota'), 0)
      = coalesce((select (x ->> 'token')::bigint from jsonb_array_elements(sebelum -> 'jenis') x where x ->> 'jenis' = 'nota'), 0), r::text);
    semua := r -> 'semua';
    perform pg_temp.cek('baris semua menjumlah semua jenis', (semua ->> 'aturan')::int = (select sum((x ->> 'aturan')::int) from jsonb_array_elements(r -> 'jenis') x)
      and (semua ->> 'model')::int = (select sum((x ->> 'model')::int) from jsonb_array_elements(r -> 'jenis') x), semua::text);
    -- daftar satu jenis (database kosong) sudah urut, jadi tanpa pasangan dianggap lulus
    perform pg_temp.cek('urut token terbanyak dulu', (select coalesce(bool_and(a >= b), true) from (select (x ->> 'token')::bigint a, lead((x ->> 'token')::bigint) over (order by o) b from jsonb_array_elements(r -> 'jenis') with ordinality t(x, o)) q where b is not null), r::text);

    execute 'set local role authenticated';
    begin perform app.rasio_baca(7); perform pg_temp.cek('authenticated ditolak', false);
    exception when others then perform pg_temp.cek('authenticated ditolak', sqlstate = '42501', sqlerrm); end;
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
