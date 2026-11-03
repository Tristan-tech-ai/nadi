-- H-01 biaya operasi per usaha per bulan (dasar ekonomi unit B-02). Harga ada di public.konfigurasi, bukan di kode:
-- harga_ai {kurs_idr, diskon_batch, tugas_batch[], sumber, diakses, model: {<id>: {masuk, keluar, cache_baca, cache_tulis,
-- panjang?: {ambang, masuk, keluar, cache_baca, cache_tulis}}}} dalam USD per juta token; biaya_platform {storage_usd_gb, db_usd_gb,
-- byte_baris: {tabel: byte}, sumber}. Hanya untuk operator (postgres/loop), tidak dibuka ke API.

create or replace function app.biaya_usaha(p_pid uuid, p_bulan date default current_date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  h jsonb := coalesce((select k.nilai from public.konfigurasi k where k.kunci = 'harga_ai'), '{}'::jsonb);
  b jsonb := coalesce((select k.nilai from public.konfigurasi k where k.kunci = 'biaya_platform'), '{}'::jsonb);
  awal timestamptz := date_trunc('month', p_bulan::timestamp) at time zone 'UTC';
  akhir timestamptz := (date_trunc('month', p_bulan::timestamp) + interval '1 month') at time zone 'UTC';
  kurs numeric := coalesce((h ->> 'kurs_idr')::numeric, 0);
  ai jsonb; st bigint; db numeric; usd_ai numeric; usd numeric;
begin
  with q as (
    select p.*, case when p.m ? 'panjang' and p.tin + p.cb + p.cw > (p.m -> 'panjang' ->> 'ambang')::numeric
                     then p.m -> 'panjang' else p.m end hm
    from (
      select pa.tugas, pa.model, coalesce(pa.token_masuk, 0)::bigint tin, coalesce(pa.token_keluar, 0)::bigint tout,
        coalesce(pa.token_cache_baca, 0)::bigint cb, coalesce(pa.token_cache_tulis, 0)::bigint cw,
        h -> 'model' -> pa.model m,
        case when pa.tugas in (select jsonb_array_elements_text(coalesce(h -> 'tugas_batch', '[]'::jsonb)))
             then coalesce((h ->> 'diskon_batch')::numeric, 1) else 1 end f
      from public.pemakaian_ai pa
      where pa.perusahaan_id = p_pid and pa.dibuat_at >= awal and pa.dibuat_at < akhir
    ) p
  ), x as (
    select q.tugas, q.tin, q.tout, q.cb, q.cw,
      case when q.m is null then null else
        (q.tin * (q.hm ->> 'masuk')::numeric + q.tout * (q.hm ->> 'keluar')::numeric
         + q.cb * (q.hm ->> 'cache_baca')::numeric + q.cw * (q.hm ->> 'cache_tulis')::numeric) / 1000000 * q.f end usd
    from q
  )
  select round(coalesce(sum(x.usd), 0), 6),
    jsonb_build_object(
      'panggilan', count(*),
      'token_masuk', coalesce(sum(x.tin), 0), 'token_keluar', coalesce(sum(x.tout), 0),
      'token_cache_baca', coalesce(sum(x.cb), 0), 'token_cache_tulis', coalesce(sum(x.cw), 0),
      'token_tanpa_harga', coalesce(sum(x.tin + x.tout + x.cb + x.cw) filter (where x.usd is null), 0),
      'usd', round(coalesce(sum(x.usd), 0), 6),
      'per_tugas', coalesce((select jsonb_object_agg(t.tugas, t.usd) from (
        select y.tugas, round(coalesce(sum(y.usd), 0), 6) usd from x y group by y.tugas) t), '{}'::jsonb))
  into usd_ai, ai from x;

  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into st
  from storage.objects o where o.bucket_id = 'berkas' and o.name like p_pid::text || '/%';

  db := coalesce((b -> 'byte_baris' ->> 'kejadian')::numeric, 0) * (select count(*) from public.kejadian x where x.perusahaan_id = p_pid)
      + coalesce((b -> 'byte_baris' ->> 'usulan')::numeric, 0) * (select count(*) from public.usulan x where x.perusahaan_id = p_pid)
      + coalesce((b -> 'byte_baris' ->> 'audit_log')::numeric, 0) * (select count(*) from public.audit_log x where x.perusahaan_id = p_pid)
      + coalesce((b -> 'byte_baris' ->> 'slip_gaji')::numeric, 0) * (select count(*) from public.slip_gaji x where x.perusahaan_id = p_pid)
      + coalesce((b -> 'byte_baris' ->> 'orang')::numeric, 0) * (select count(*) from public.orang x where x.perusahaan_id = p_pid);

  usd := usd_ai + st::numeric / 1073741824 * coalesce((b ->> 'storage_usd_gb')::numeric, 0)
              + db / 1073741824 * coalesce((b ->> 'db_usd_gb')::numeric, 0);
  return jsonb_build_object(
    'perusahaan_id', p_pid, 'bulan', to_char(awal at time zone 'UTC', 'YYYY-MM'),
    'ai', ai, 'storage_byte', st, 'db_byte', round(db),
    'usd', round(usd, 6), 'kurs_idr', kurs, 'idr', round(usd * kurs),
    'sumber_harga', h ->> 'sumber', 'diakses', h ->> 'diakses');
end $$;

create or replace function app.biaya_platform(p_bulan date default current_date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare r jsonb;
begin
  with per as (
    select p.id, coalesce((p.pengaturan ->> 'demo') is not null, false) demo, app.biaya_usaha(p.id, p_bulan) j from public.perusahaan p
  ), angka as (
    select per.id, per.demo, (per.j ->> 'usd')::numeric usd, (per.j -> 'ai' ->> 'panggilan')::int panggilan, (per.j ->> 'storage_byte')::bigint st
    from per
  )
  select jsonb_build_object(
    'bulan', to_char(p_bulan, 'YYYY-MM'),
    'usaha', count(*), 'usaha_demo', count(*) filter (where demo),
    'usaha_aktif', count(*) filter (where panggilan > 0 or st > 0),
    'total_usd', round(coalesce(sum(usd), 0), 6),
    'median_usd', round(coalesce(percentile_cont(0.5) within group (order by usd), 0)::numeric, 6),
    'p90_usd', round(coalesce(percentile_cont(0.9) within group (order by usd), 0)::numeric, 6),
    'maks_usd', round(coalesce(max(usd), 0), 6),
    'median_aktif_usd', round(coalesce(percentile_cont(0.5) within group (order by usd) filter (where panggilan > 0 or st > 0), 0)::numeric, 6))
  into r from angka;
  return r;
end $$;

revoke all on function app.biaya_usaha(uuid, date) from public, anon, authenticated;
revoke all on function app.biaya_platform(date) from public, anon, authenticated;
