-- Klien CIMD dikenali dari client_id berbentuk URL (https; http hanya lolos dari server Next saat uji lokal, lihat src/lib/mcp/cimd.ts).
-- Sebelumnya hanya https sehingga klien CIMD uji lokal dianggap klien DCR yang tidak terdaftar (e2e mcp 31 Okt 2026).
create or replace function public.oauth_terbitkan_kode(p_client text, p_nama_klien text, p_redirect text, p_challenge text,
  p_cakupan text[], p_resource text, p_perusahaan uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); k public.oauth_klien; v_kode text; v_nama text := p_nama_klien;
begin
  if v_uid is null then raise exception 'Masuk dulu' using errcode = '28000'; end if;
  if not exists (select 1 from public.anggota where perusahaan_id = p_perusahaan and user_id = v_uid and aktif) then
    raise exception 'Kamu bukan anggota aktif usaha ini' using errcode = '42501';
  end if;
  if p_client ~ '^https?://' then
    if not app.redirect_aman(p_redirect) then raise exception 'redirect_uri tidak diizinkan' using errcode = '22023'; end if;
  else
    select * into k from public.oauth_klien where client_id = p_client;
    if k.client_id is null or not (p_redirect = any (k.redirect_uris)) then raise exception 'Klien atau redirect_uri tidak dikenal' using errcode = '22023'; end if;
    v_nama := k.nama;
  end if;
  if p_challenge is null or p_challenge !~ '^[A-Za-z0-9_-]{43,128}$' then raise exception 'code_challenge tidak valid (wajib S256)' using errcode = '22023'; end if;
  if p_cakupan is null or cardinality(p_cakupan) = 0 or not (p_cakupan <@ array['nadi.baca', 'nadi.usul']) then raise exception 'Cakupan tidak dikenal' using errcode = '22023'; end if;
  if p_resource is null or p_resource !~ '^https?://[^\s#?]+/api/mcp$' then raise exception 'resource tidak valid' using errcode = '22023'; end if;
  v_kode := app.token_baru('nac_');
  insert into public.oauth_kode (kode_hash, client_id, nama_klien, user_id, perusahaan_id, redirect_uri, code_challenge, cakupan, resource, kedaluwarsa_at)
    values (app.hash_token(v_kode), p_client, left(coalesce(nullif(btrim(v_nama), ''), 'Asisten AI'), 80), v_uid, p_perusahaan, p_redirect,
            p_challenge, (select array_agg(distinct c order by c) from unnest(p_cakupan) c), p_resource, now() + interval '10 minutes');
  return v_kode;
end $$;
