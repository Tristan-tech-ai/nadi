-- H-02 rasio baca tanpa model per jenis berkas. Berkas dihitung bila hasilnya mencatat sumber (aturan = ekstraktor tersimpan atau
-- pengurai tanpa model, model = dibaca AI); token = baca_berkas + tulis_aturan dari pemakaian_ai untuk berkas yang sama.
-- Hanya untuk operator (postgres/loop), tidak dibuka ke API.
create or replace function app.rasio_baca(p_hari int default 30)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with b as (
    select x.id, coalesce(x.hasil ->> 'jenis', x.jenis_terdeteksi, 'lainnya') jenis, x.hasil ->> 'sumber' sumber
    from public.berkas x
    where x.dibuat_at >= now() - make_interval(days => greatest(coalesce(p_hari, 30), 1))
      and x.hasil ->> 'sumber' in ('aturan', 'model')
  ), t as (
    select p.berkas_id, sum(coalesce(p.token_masuk, 0) + coalesce(p.token_keluar, 0) + coalesce(p.token_cache_baca, 0) + coalesce(p.token_cache_tulis, 0))::bigint token
    from public.pemakaian_ai p
    where p.tugas in ('baca_berkas', 'tulis_aturan') and p.berkas_id in (select id from b)
    group by p.berkas_id
  ), j as (
    select b.jenis, count(*)::int berkas, count(*) filter (where b.sumber = 'aturan')::int aturan,
      count(*) filter (where b.sumber = 'model')::int model, coalesce(sum(t.token), 0)::bigint token
    from b left join t on t.berkas_id = b.id
    group by b.jenis
  )
  select jsonb_build_object(
    'hari', greatest(coalesce(p_hari, 30), 1),
    'jenis', coalesce((select jsonb_agg(jsonb_build_object('jenis', j.jenis, 'berkas', j.berkas, 'aturan', j.aturan, 'model', j.model,
      'rasio', round(j.aturan::numeric / nullif(j.berkas, 0), 3), 'token', j.token) order by j.token desc, j.jenis) from j), '[]'::jsonb),
    'semua', (select jsonb_build_object('berkas', coalesce(sum(j.berkas), 0), 'aturan', coalesce(sum(j.aturan), 0), 'model', coalesce(sum(j.model), 0),
      'rasio', round(coalesce(sum(j.aturan), 0)::numeric / nullif(sum(j.berkas), 0), 3), 'token', coalesce(sum(j.token), 0)) from j));
$$;

revoke all on function app.rasio_baca(int) from public, anon, authenticated;
