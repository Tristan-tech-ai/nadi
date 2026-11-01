-- F6-02 Pembanding anonim lintas usaha (k >= 10). Untuk usaha yang sedang dibuka: nilai sendiri dan sebaran (kuartil) usaha lain
-- sejenis (industri sama, bukan usaha demo) untuk tiga ukuran 90 hari terakhir: hari rata-rata dari invoice terbit sampai lunas,
-- jumlah orang aktif, dan kerja selesai per orang per minggu. Bila kelompok (usaha yang punya nilai, termasuk usaha ini) kurang
-- dari 10, TIDAK ada angka kelompok sama sekali (hanya jumlah kelompoknya), supaya usaha lain tidak bisa ditebak.
-- Tes: supabase/tests/pembanding.test.sql.

create or replace function app.ukuran_usaha(p_pid uuid) returns table(ukuran text, nilai numeric)
language sql stable security definer set search_path = '' as $$
  select 'hari_lunas', (select avg(i.lunas_tanggal - i.tanggal)::numeric from public.invoice i
                         where i.perusahaan_id = p_pid and i.status = 'lunas' and i.lunas_tanggal >= current_date - 90)
  union all
  select 'orang_aktif', (select count(*)::numeric from public.orang o where o.perusahaan_id = p_pid and o.status = 'aktif')
  union all
  select 'kerja_per_orang_minggu', (select case when count(distinct k.pelaksana_id) > 0 then round(count(*)::numeric / count(distinct k.pelaksana_id) / (90 / 7.0), 2) end
                                     from public.kerja k where k.perusahaan_id = p_pid and k.status = 'selesai' and k.selesai_at >= now() - interval '90 days')
$$;

create or replace function public.pembanding_usaha() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_ind text; k_min constant int := 10;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat pembanding' using errcode = '42501';
  end if;
  select industri into v_ind from public.perusahaan where id = v_pid;
  return jsonb_build_object('industri', v_ind, 'k_min', k_min, 'ukuran', (
    with kelompok as (
      select p.id, u.ukuran, u.nilai from public.perusahaan p cross join lateral app.ukuran_usaha(p.id) u
       where p.industri is not distinct from v_ind and coalesce((p.pengaturan ->> 'demo'), '') = '' and u.nilai is not null),
    ringkas as (
      select ukuran, count(*) as n,
             percentile_cont(0.25) within group (order by nilai) as q1,
             percentile_cont(0.5) within group (order by nilai) as median,
             percentile_cont(0.75) within group (order by nilai) as q3
        from kelompok group by ukuran)
    select coalesce(jsonb_object_agg(s.ukuran, case when coalesce(r.n, 0) >= k_min
             then jsonb_build_object('n', r.n, 'cukup', true, 'sendiri', s.nilai, 'q1', round(r.q1::numeric, 2), 'median', round(r.median::numeric, 2), 'q3', round(r.q3::numeric, 2))
             else jsonb_build_object('n', coalesce(r.n, 0), 'cukup', false, 'sendiri', s.nilai) end), '{}'::jsonb)
      from app.ukuran_usaha(v_pid) s left join ringkas r on r.ukuran = s.ukuran));
end $$;

revoke all on function app.ukuran_usaha(uuid) from public, anon, authenticated;
revoke all on function public.pembanding_usaha() from public, anon;
grant execute on function public.pembanding_usaha() to authenticated;
