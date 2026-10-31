-- Tes peringatan bias lowongan (F2-02): kolom bawaan [], hanya larik (maks 8), tersimpan bersama lowongan tertutup,
-- tidak bocor ke halaman publik anon, dan usaha lain tidak bisa membaca atau mengubahnya. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  lw uuid; lw2 uuid; v_kode text; r jsonb; n int;
  p jsonb := '[{"kode":"usia","kutipan":"maks 25 th","alasan":"a","saran":"s"},{"kode":"penampilan","kutipan":"berpenampilan menarik","alasan":"a","saran":"s"}]';
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
  insert into public.lowongan (perusahaan_id, judul) values (pa, 'Kasir pagi') returning id into lw;
  perform pg_temp.cek('bawaan peringatan larik kosong', (select peringatan from public.lowongan where id = lw) = '[]'::jsonb);
  insert into public.lowongan (perusahaan_id, judul, ringkasan, peringatan, buka) values (pa, 'Pelayan', 'maks 25 th, berpenampilan menarik', p, false)
    returning id, kode into lw2, v_kode;
  perform pg_temp.cek('peringatan tersimpan dan lowongan tertutup', (select peringatan = p and not buka from public.lowongan where id = lw2));
  begin
    update public.lowongan set peringatan = '{"kode":"usia"}' where id = lw;
    perform pg_temp.cek('bukan larik ditolak', false);
  exception when check_violation then perform pg_temp.cek('bukan larik ditolak', true);
  end;
  begin
    update public.lowongan set peringatan = (select jsonb_agg(x) from generate_series(1, 9) x) where id = lw;
    perform pg_temp.cek('lebih dari 8 ditolak', false);
  exception when check_violation then perform pg_temp.cek('lebih dari 8 ditolak', true);
  end;
  update public.lowongan set buka = true where id = lw2;
  perform pg_temp.cek('pemilik boleh membuka lowongan berperingatan', (select buka from public.lowongan where id = lw2));

  -- Usaha lain.
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.lowongan where id in (lw, lw2);
  perform pg_temp.cek('usaha lain tidak melihat lowongan dan peringatannya', n = 0, n::text);
  update public.lowongan set peringatan = '[]' where id = lw2;
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('usaha lain tidak bisa menghapus peringatan', (select peringatan = p from public.lowongan where id = lw2));

  -- Tanpa akun: halaman publik tidak memuat peringatan.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.lowongan_publik(v_kode);
  perform pg_temp.cek('halaman publik tanpa peringatan', r is not null and not (r ? 'peringatan'), r::text);
  begin
    select count(*) into n from public.lowongan;
    perform pg_temp.cek('anon tidak bisa membaca tabel lowongan', false, n::text);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca tabel lowongan', true);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
