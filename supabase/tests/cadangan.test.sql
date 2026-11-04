-- Tes cadangan (Q-03B): daftar tabel tanpa kredensial/log, kolom penanda akses dibuang, uji pulih menghitung baris,
-- hanya service_role, bucket privat. Transaksi dibatalkan di akhir lewat RAISE EXCEPTION; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare d text[]; v jsonb; r jsonb; boleh boolean;
begin
  d := public.cadangan_daftar();
  perform pg_temp.cek('daftar memuat perusahaan, orang, slip_gaji', d @> array['perusahaan', 'orang', 'slip_gaji']);
  perform pg_temp.cek('daftar tanpa kredensial dan log', not (d && array['mcp_token', 'oauth_kode', 'oauth_klien', 'langganan_push', 'kejadian', 'audit_log', 'pemakaian_ai']), array_to_string(d, ','));
  perform pg_temp.cek('daftar tanpa partisi', not exists (select 1 from unnest(d) x where x ~ '_p[0-9]{8}$'));
  v := public.cadangan_tabel('lamaran');
  perform pg_temp.cek('lamaran tanpa token_status', not exists (select 1 from jsonb_array_elements(v) e where e ? 'token_status'));
  perform pg_temp.cek('lamaran jumlah baris sama', jsonb_array_length(v) = (select count(*) from public.lamaran));
  begin
    perform public.cadangan_tabel('mcp_token');
    perform pg_temp.cek('tabel kredensial ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('tabel kredensial ditolak', true);
  end;
  r := public.cadangan_uji_pulih('orang', public.cadangan_tabel('orang'));
  perform pg_temp.cek('uji pulih orang cocok', (r ->> 'cocok')::boolean and (r ->> 'baris')::bigint = (select count(*) from public.orang), r::text);
  r := public.cadangan_uji_pulih('orang', '[{"id":"00000000-0000-0000-0000-000000000001"},{"id":"00000000-0000-0000-0000-000000000001"}]');
  perform pg_temp.cek('uji pulih menangkap id ganda', not (r ->> 'cocok')::boolean, r::text);
  perform pg_temp.cek('bucket cadangan privat', (select not public from storage.buckets where id = 'cadangan'));
  perform pg_temp.cek('tanpa kebijakan objek untuk bucket cadangan', not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual ilike '%cadangan%' or with_check ilike '%cadangan%')));
  select has_function_privilege('authenticated', 'public.cadangan_tabel(text)', 'execute') into boleh;
  perform pg_temp.cek('authenticated tidak bisa ekspor', not boleh);
  select has_function_privilege('anon', 'public.cadangan_uji_pulih(text, jsonb)', 'execute') into boleh;
  perform pg_temp.cek('anon tidak bisa uji pulih', not boleh);
  perform pg_temp.cek('cron mingguan terdaftar', exists (select 1 from cron.job where jobname = 'nadi-cadangan' and schedule = '30 18 * * 0'));
  perform pg_temp.cek('catat menulis log', public.cadangan_catat('pulih', 'uji', 1, 2, 3, '{}', null) is not null);
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'cadangan: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
