-- Q-14 (docs/quality/keamanan-f0.md RENDAH, A6): audiens token MCP wajib (resource null tidak lagi lolos karena perbandingan
-- dengan null bernilai null), pencabutan token tidak bisa dibatalkan pengguna, endpoint push hanya ke host layanan push dikenal.

-- RFC 8707: token hanya untuk resource yang sama persis; null atau kosong ditolak.
create or replace function app.mcp_konteks(p_token text, p_resource text, p_cakupan text default 'nadi.baca')
returns table (user_id uuid, perusahaan_id uuid, peran text, cakupan text[], nama_klien text)
language plpgsql security definer set search_path = '' as $$
declare t public.mcp_token; v_peran text;
begin
  select * into t from public.mcp_token m
   where m.token_hash = app.hash_token(coalesce(p_token, '')) and m.jenis = 'akses' and m.dicabut_at is null and m.kedaluwarsa_at > now();
  if t.id is null or p_resource is null or t.resource is distinct from p_resource then raise exception 'Token tidak sah' using errcode = 'P0401'; end if;
  select a.peran into v_peran from public.anggota a where a.perusahaan_id = t.perusahaan_id and a.user_id = t.user_id and a.aktif;
  if v_peran is null then raise exception 'Token tidak sah' using errcode = 'P0401'; end if;
  if not (p_cakupan = any (t.cakupan)) then raise exception 'Butuh cakupan %', p_cakupan using errcode = 'P0403'; end if;
  update public.mcp_token m
     set dipakai_at = now(),
         menit_mulai = case when m.menit_mulai is null or m.menit_mulai < now() - interval '1 minute' then now() else m.menit_mulai end,
         panggilan_menit = case when m.menit_mulai is null or m.menit_mulai < now() - interval '1 minute' then 1 else m.panggilan_menit + 1 end
   where m.id = t.id
  returning m.panggilan_menit into t.panggilan_menit;
  if t.panggilan_menit > 120 then raise exception 'Terlalu banyak panggilan, tunggu sebentar' using errcode = 'P0429'; end if;
  return query select t.user_id, t.perusahaan_id, v_peran, t.cakupan, t.nama_klien;
end $$;

-- Pengguna boleh mencabut tokennya sendiri (dicabut_at dari null menjadi waktu), tetapi tidak membatalkan atau menggeser pencabutan.
create or replace function app.jaga_cabut_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and old.dicabut_at is not null and new.dicabut_at is distinct from old.dicabut_at then
    raise exception 'Token yang sudah dicabut tidak bisa diaktifkan lagi' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger mcp_token_jaga_cabut before update of dicabut_at on public.mcp_token
  for each row execute function app.jaga_cabut_token();

-- Endpoint push hanya https ke layanan push peramban yang dikenal (sama dengan hostPushDikenal di src/lib/push.ts).
alter table public.langganan_push add constraint langganan_push_host_dikenal check (
  endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
);
