-- T-01D belajar format jalur Mata: denah zona per kamera. Kamera baru: Edge Function usul-denah meminta model mengusulkan zona dari
-- SATU bingkai yang dikecilkan dan dikaburkan di perangkat, pengawas deterministik (denah.ts) memeriksa poligon, lalu usulan
-- disimpan sebagai draf. Pemilik/admin menyetujui di layar Mata; baru aktif. Kamera dengan sidik yang sama berikutnya memakai denah
-- aktif tanpa model (token 0). Tidak ada gambar yang disimpan: hanya sidik kamera (hash di perangkat) dan zona.
create table public.vision_camera_layout (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  sidik text not null check (sidik ~ '^[0-9a-f]{16,64}$'),
  zona jsonb not null check (jsonb_typeof(zona) = 'array' and jsonb_array_length(zona) between 1 and 12),
  status text not null default 'draf' check (status in ('draf', 'aktif', 'mati')),
  asal jsonb not null default '{}'::jsonb,
  dibuat_at timestamptz not null default now(),
  disetujui_at timestamptz,
  disetujui_oleh uuid
);
create unique index vision_camera_layout_aktif on public.vision_camera_layout (perusahaan_id, sidik) where status = 'aktif';
create index vision_camera_layout_pid on public.vision_camera_layout (perusahaan_id, sidik, dibuat_at desc);
alter table public.vision_camera_layout enable row level security;
create policy vision_camera_layout_baca on public.vision_camera_layout for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.vision_camera_layout to authenticated;

-- Denah aktif untuk kamera ini (null bila kamera belum dikenal). Dipanggil layar Mata saat kamera atau video dibuka.
create or replace function public.camera_layout(p_sidik text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v jsonb;
begin
  select jsonb_build_object('id', l.id, 'zona', l.zona, 'disetujui_at', l.disetujui_at) into v
    from public.vision_camera_layout l where l.perusahaan_id = v_pid and l.sidik = p_sidik and l.status = 'aktif';
  return v;
end $$;

-- Setujui draf (boleh dengan zona yang sudah disunting pemilik di layar): denah aktif lama untuk kamera yang sama dimatikan.
create or replace function public.approve_camera_layout(p_id uuid, p_zones jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); d public.vision_camera_layout;
begin
  select * into d from public.vision_camera_layout where id = p_id and perusahaan_id = v_pid for update;
  if d.id is null then raise exception 'Draf denah tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'draf' then raise exception 'Draf ini sudah diputuskan' using errcode = '55000'; end if;
  if p_zones is not null and (jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) not between 1 and 12) then
    raise exception 'Zona tidak sah' using errcode = '22023';
  end if;
  update public.vision_camera_layout set status = 'mati' where perusahaan_id = v_pid and sidik = d.sidik and status = 'aktif';
  update public.vision_camera_layout set status = 'aktif', zona = coalesce(p_zones, d.zona), disetujui_at = now(), disetujui_oleh = (select auth.uid())
   where id = d.id;
  return jsonb_build_object('id', d.id, 'zona', coalesce(p_zones, d.zona));
end $$;
revoke all on function public.camera_layout(text), public.approve_camera_layout(uuid, jsonb) from public, anon;
grant execute on function public.camera_layout(text), public.approve_camera_layout(uuid, jsonb) to authenticated;
