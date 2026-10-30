-- Ringkasan pemakaian AI per usaha untuk pemilik/admin: berkas dibaca model vs aturan tersimpan, token dipakai,
-- dan perkiraan token yang dihemat (rata-rata token bacaan model untuk jenis itu x berkas yang dibaca aturan).
-- SECURITY INVOKER: RLS pemakaian_ai, berkas, dan ekstraktor tetap berlaku; bukan pengelola mendapat null.
create or replace function public.ringkasan_ai(p_hari integer default 30) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_pid uuid := app.pid(); hasil jsonb;
begin
  if v_pid is null or not app.pengelola() then return null; end if;
  with b as (
    select jenis_terdeteksi as j, coalesce(hasil ->> 'sumber', 'model') as s, token_ai as t, dibuat_at
      from public.berkas
     where perusahaan_id = v_pid and status in ('usulan', 'selesai')
  ),
  rata as (select j, avg(t) filter (where s = 'model' and t > 0) as r from b group by j),
  umum as (select avg(t) filter (where s = 'model' and t > 0) as r from b),
  jendela as (select * from b where dibuat_at > now() - make_interval(days => p_hari)),
  p as (
    select coalesce(sum(token_masuk + token_keluar) filter (where tugas = 'baca_berkas'), 0) as baca,
           coalesce(sum(token_masuk + token_keluar) filter (where tugas = 'tulis_aturan'), 0) as tulis,
           coalesce(sum(token_cache_baca), 0) as cache
      from public.pemakaian_ai
     where perusahaan_id = v_pid and dibuat_at > now() - make_interval(days => p_hari)
  )
  select jsonb_build_object(
    'hari', p_hari,
    'berkas_model', (select count(*) from jendela where s = 'model'),
    'berkas_aturan', (select count(*) from jendela where s = 'aturan'),
    'token_baca', (select baca from p),
    'token_tulis_aturan', (select tulis from p),
    'token_cache', (select cache from p),
    'token_hemat', coalesce((select round(sum(coalesce(r.r, (select r from umum), 0)))
                               from jendela w left join rata r on r.j = w.j where w.s = 'aturan'), 0),
    'aturan_aktif', (select count(*) from public.ekstraktor where perusahaan_id = v_pid and aktif)
  ) into hasil;
  return hasil;
end $$;
revoke all on function public.ringkasan_ai(integer) from public, anon;
grant execute on function public.ringkasan_ai(integer) to authenticated;
