-- Tes F6-01: 8 paket industri tambahan ada dan bentuknya utuh (topi berkode unik, bernama, punya keahlian, tanggung jawab, dan
-- KPI berarah naik/turun; tempat dan resep Mata terisi); setiap paket terpasang ke usaha baru lewat pasang_paket dengan jumlah
-- topi sama dengan isi paket dan asal_paket tercatat; pasang ulang tidak menggandakan; usaha lain tidak terpengaruh.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pb uuid; p uuid; k text; n int; harap int; kosong text;
  daftar text[] := array['kantor', 'bengkel', 'klinik', 'konstruksi', 'logistik', 'hotel', 'salon', 'laundry'];
begin
  begin
    perform pg_temp.cek('8 paket tambahan ada', (select count(*) from public.paket_industri where kode = any(daftar)) = 8);
    select string_agg(pi.kode || ':' || coalesce(t ->> 'kode', '?'), ', ') into kosong
      from public.paket_industri pi, jsonb_array_elements(pi.isi -> 'topi') t
     where pi.kode = any(daftar) and (coalesce(t ->> 'nama', '') = '' or jsonb_array_length(coalesce(t -> 'keahlian', '[]')) = 0
       or jsonb_array_length(coalesce(t -> 'tanggung_jawab', '[]')) = 0 or jsonb_array_length(coalesce(t -> 'kpi', '[]')) = 0
       or exists (select 1 from jsonb_array_elements(t -> 'kpi') q where q ->> 'arah' not in ('naik', 'turun') or coalesce(q ->> 'nama', '') = ''));
    perform pg_temp.cek('setiap topi bernama, berkeahlian, bertanggung jawab, ber-KPI berarah', kosong is null, kosong);
    perform pg_temp.cek('kode topi unik per paket dan berbentuk huruf kecil/garis bawah', not exists (
      select 1 from public.paket_industri pi where pi.kode = any(daftar)
         and ((select count(distinct t ->> 'kode') from jsonb_array_elements(pi.isi -> 'topi') t) <> jsonb_array_length(pi.isi -> 'topi')
          or exists (select 1 from jsonb_array_elements(pi.isi -> 'topi') t where t ->> 'kode' !~ '^[a-z][a-z0-9_]*$'))));
    perform pg_temp.cek('tempat dan resep Mata terisi', not exists (select 1 from public.paket_industri where kode = any(daftar)
      and (jsonb_array_length(coalesce(isi -> 'tempat', '[]')) = 0 or jsonb_array_length(coalesce(isi -> 'resep_mata', '[]')) = 0)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Usaha Lain B', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
    perform public.pasang_paket('fnb');
    foreach k in array daftar loop
      perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
      p := public.buat_perusahaan('Uji Paket ' || k, k);
      perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', p, 'prn', 'pemilik'))::text, true);
      n := public.pasang_paket(k);
      execute 'reset role';
      select jsonb_array_length(isi -> 'topi') into harap from public.paket_industri where kode = k;
      perform pg_temp.cek('paket ' || k || ' terpasang: topi sesuai isi, asal_paket tercatat',
        n = harap and (select count(*) from public.topi where perusahaan_id = p and asal_paket = k) = harap, n || '/' || harap);
      execute 'set local role authenticated';
      perform pg_temp.cek('paket ' || k || ' dipasang ulang tidak menggandakan', public.pasang_paket(k) = 0);
    end loop;
    execute 'reset role';
    perform pg_temp.cek('usaha lain tetap hanya topi fnb', (select count(*) from public.topi where perusahaan_id = pb) = 5
      and not exists (select 1 from public.topi where perusahaan_id = pb and asal_paket <> 'fnb'));
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
