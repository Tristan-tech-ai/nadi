-- Lempar Saja: bucket berkas pribadi, pendaftaran berkas anti-duplikat (sha256 per usaha), konfigurasi bersama, catatan pemakaian AI.

-- Konfigurasi bersama (bukan rahasia), mis. tangga model AI. Diisi lewat SQL/konsol, bukan migrasi, agar ID model tidak tertulis di repo.
create table public.konfigurasi (
  kunci text primary key,
  nilai jsonb not null,
  catatan text,
  diubah_at timestamptz not null default now()
);
alter table public.konfigurasi enable row level security;
create policy konfigurasi_baca on public.konfigurasi for select to authenticated using (true);
grant select on public.konfigurasi to authenticated;

-- Setiap panggilan model AI dicatat: dasar hemat token dan tagihan per usaha.
create table public.pemakaian_ai (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  berkas_id uuid references public.berkas(id) on delete set null,
  tugas text not null,                -- baca_berkas, ...
  model text not null,
  token_masuk integer not null default 0,
  token_keluar integer not null default 0,
  token_cache_baca integer not null default 0,
  token_cache_tulis integer not null default 0,
  dibuat_at timestamptz not null default now()
);
create index on public.pemakaian_ai (perusahaan_id, dibuat_at desc);
create index on public.pemakaian_ai (berkas_id);
alter table public.pemakaian_ai enable row level security;
create policy pemakaian_ai_baca on public.pemakaian_ai for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.pemakaian_ai to authenticated;

-- Bucket pribadi; batas 10 MB per berkas dan jenis yang bisa dibaca.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('berkas', 'berkas', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Unggah hanya ke jalur yang sudah didaftarkan lempar_berkas oleh pengunggah yang sama (tidak ada unggahan liar).
create policy berkas_unggah on storage.objects for insert to authenticated
  with check (
    bucket_id = 'berkas'
    and (storage.foldername(name))[1] = (select app.pid())::text
    and exists (select 1 from public.berkas b
                 where b.jalur = name and b.diunggah_oleh = (select auth.uid()) and b.status = 'unggah'));
-- Baca: pemilik/admin usaha itu, atau pengunggahnya sendiri.
create policy berkas_unduh on storage.objects for select to authenticated
  using (
    bucket_id = 'berkas'
    and (storage.foldername(name))[1] = (select app.pid())::text
    and ((select app.pengelola()) or owner_id = (select auth.uid())::text));

-- Daftarkan berkas sebelum diunggah. Berkas yang sama (sha256) di usaha yang sama tidak diunggah dan tidak diproses dua kali.
create or replace function public.lempar_berkas(p_sha256 text, p_nama text, p_mime text, p_ukuran bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_ada public.berkas; v_ext text; v_id uuid;
begin
  if v_pid is null or not app.anggota_aktif() then
    raise exception 'Buka usahamu dulu' using errcode = '42501';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'sha256 tidak sah' using errcode = '22023'; end if;
  if p_ukuran is null or p_ukuran <= 0 or p_ukuran > 10485760 then raise exception 'Ukuran berkas maksimal 10 MB' using errcode = '22023'; end if;
  v_ext := case p_mime
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf' when 'text/csv' then 'csv'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx' end;
  if v_ext is null then raise exception 'Jenis berkas belum bisa dibaca' using errcode = '22023'; end if;

  select * into v_ada from public.berkas where perusahaan_id = v_pid and sha256 = p_sha256;
  if found then
    -- Pengunggah lain di usaha yang sama tidak diberi isi berkas orang lain, hanya tahu sudah ada.
    if v_ada.diunggah_oleh = auth.uid() or app.pengelola() then
      return jsonb_build_object('ada', true, 'id', v_ada.id, 'status', v_ada.status, 'jalur', v_ada.jalur);
    end if;
    return jsonb_build_object('ada', true);
  end if;

  insert into public.berkas (perusahaan_id, jalur, nama_asli, mime, ukuran, sha256, status, diunggah_oleh)
  values (v_pid, v_pid::text || '/lempar/' || p_sha256 || '.' || v_ext, left(p_nama, 200), p_mime, p_ukuran, p_sha256, 'unggah', auth.uid())
  returning id into v_id;
  return jsonb_build_object('ada', false, 'id', v_id, 'status', 'unggah', 'jalur', v_pid::text || '/lempar/' || p_sha256 || '.' || v_ext);
end $$;
revoke all on function public.lempar_berkas(text, text, text, bigint) from public, anon;
grant execute on function public.lempar_berkas(text, text, text, bigint) to authenticated;
