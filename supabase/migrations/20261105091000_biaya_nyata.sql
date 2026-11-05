-- M-27 biaya nyata Nadi per usaha di layar (perluasan Hemat AI). Pemilik/admin membaca biaya operasi usahanya sendiri bulan ini
-- dari sumber yang sama dengan hitungan operator (app.biaya_usaha H-01: harga per model di public.konfigurasi harga_ai, storage dan
-- database di biaya_platform) ditambah jumlah berkas yang dilempar bulan itu. Bulan dihitung dari tanggal usaha (zona usaha).
-- Peran lain mendapat null; usaha lain tidak bisa diminta karena pid diambil dari sesi.

create or replace function public.nadi_cost(p_bulan date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_bulan date; j jsonb; v_berkas int;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then return null; end if;
  v_bulan := date_trunc('month', coalesce(p_bulan, app.hari_ini(v_pid)))::date;
  j := app.biaya_usaha(v_pid, v_bulan);
  select count(*) into v_berkas from public.berkas b
   where b.perusahaan_id = v_pid and b.dibuat_at >= (v_bulan::timestamp at time zone 'UTC') and b.dibuat_at < ((v_bulan + interval '1 month')::timestamp at time zone 'UTC');
  return jsonb_build_object(
    'bulan', j ->> 'bulan',
    'panggilan', (j -> 'ai' ->> 'panggilan')::int,
    'token', (j -> 'ai' ->> 'token_masuk')::bigint + (j -> 'ai' ->> 'token_keluar')::bigint + (j -> 'ai' ->> 'token_cache_baca')::bigint + (j -> 'ai' ->> 'token_cache_tulis')::bigint,
    'token_masuk', (j -> 'ai' ->> 'token_masuk')::bigint, 'token_keluar', (j -> 'ai' ->> 'token_keluar')::bigint,
    'token_cache', (j -> 'ai' ->> 'token_cache_baca')::bigint + (j -> 'ai' ->> 'token_cache_tulis')::bigint,
    'token_tanpa_harga', (j -> 'ai' ->> 'token_tanpa_harga')::bigint,
    'usd_ai', (j -> 'ai' ->> 'usd')::numeric,
    'berkas', v_berkas, 'storage_byte', (j ->> 'storage_byte')::bigint, 'db_byte', (j ->> 'db_byte')::bigint,
    'usd', (j ->> 'usd')::numeric, 'kurs_idr', (j ->> 'kurs_idr')::numeric,
    'idr', round((j ->> 'usd')::numeric * (j ->> 'kurs_idr')::numeric, 2),
    'sumber_harga', j ->> 'sumber_harga', 'diakses', j ->> 'diakses');
end $$;

revoke all on function public.nadi_cost(date) from public, anon;
grant execute on function public.nadi_cost(date) to authenticated;
