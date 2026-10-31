-- F2-05 keputusan rekrut, status pelamar, Bank Talenta (docs/research/keputusan-rekrut.md).
-- Tahap lamaran terpisah dari status proses berkas; pelamar melihat tahapnya lewat tautan bertoken (hanya hash yang disimpan,
-- pola slip gaji); izin dihubungi untuk lowongan lain disimpan per lamaran dan bawaannya tidak.

alter table public.lamaran
  add column tahap text not null default 'masuk' check (tahap in ('masuk', 'ditinjau', 'ditawari', 'diterima', 'ditolak')),
  add column pesan_tahap text check (char_length(pesan_tahap) <= 500),
  add column tahap_at timestamptz,
  add column boleh_dihubungi boolean not null default false,
  add column token_status text unique check (token_status ~ '^[0-9a-f]{64}$');

-- Bank Talenta: pelamar lama yang memberi izin, per usaha, 12 bulan terakhir.
create index lamaran_bank_talenta_idx on public.lamaran (perusahaan_id, dibuat_at) where boleh_dihubungi;

-- Pelamar (anon) menyimpan izin dihubungi dan menerima tautan status sekali, dalam 2 jam sejak melamar.
create or replace function public.lamar_lanjut(p_lamaran uuid, p_boleh_dihubungi boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare la public.lamaran; v_token text := app.token_baru('nml_');
begin
  select * into la from public.lamaran where id = p_lamaran and dibuat_at > now() - interval '2 hours' for update;
  if la.id is null then raise exception 'Sesi lamaran sudah lewat. Lamaranmu tetap tersimpan.' using errcode = 'P0002'; end if;
  if la.token_status is not null then raise exception 'Tautan status lamaran ini sudah dibuat.' using errcode = '23505'; end if;
  update public.lamaran set boleh_dihubungi = coalesce(p_boleh_dihubungi, false), token_status = app.hash_token(v_token) where id = la.id;
  return v_token;
end $$;

-- Dibuka tanpa akun lewat tautan /lamar/status#nml_... Berlaku 180 hari sejak melamar. Galat sama untuk token salah atau kedaluwarsa.
create or replace function public.status_lamaran(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('usaha', p.nama, 'lowongan', l.judul, 'nama', la.nama, 'tahap', la.tahap, 'pesan', la.pesan_tahap,
           'tahap_at', la.tahap_at, 'dibuat_at', la.dibuat_at)
    into r
    from public.lamaran la join public.lowongan l on l.id = la.lowongan_id join public.perusahaan p on p.id = la.perusahaan_id
   where la.token_status = app.hash_token(coalesce(p_token, '')) and la.dibuat_at > now() - interval '180 days';
  if r is null then
    raise exception 'Tautan status lamaran ini tidak berlaku. Tautan berlaku 180 hari sejak melamar; tanyakan kabarnya langsung ke usaha tempatmu melamar.'
      using errcode = '28000';
  end if;
  return r;
end $$;

-- Pemilik/admin usaha pelamar mengubah tahap, boleh dengan pesan singkat untuk pelamar.
create or replace function public.ubah_tahap_lamaran(p_lamaran uuid, p_tahap text, p_pesan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pesan text := nullif(btrim(coalesce(p_pesan, '')), ''); la public.lamaran;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  if p_tahap is null or p_tahap not in ('masuk', 'ditinjau', 'ditawari', 'diterima', 'ditolak') then
    raise exception 'Tahap lamaran tidak dikenal.' using errcode = '22023';
  end if;
  if char_length(v_pesan) > 500 then raise exception 'Pesan untuk pelamar paling panjang 500 huruf.' using errcode = '22023'; end if;
  update public.lamaran set tahap = p_tahap, pesan_tahap = v_pesan, tahap_at = now()
   where id = p_lamaran and perusahaan_id = app.pid()
  returning * into la;
  if la.id is null then raise exception 'Lamaran tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  return jsonb_build_object('tahap', la.tahap, 'tahap_at', la.tahap_at);
end $$;

revoke all on function public.lamar_lanjut(uuid, boolean), public.status_lamaran(text), public.ubah_tahap_lamaran(uuid, text, text) from public, anon;
grant execute on function public.lamar_lanjut(uuid, boolean), public.status_lamaran(text) to anon, authenticated;
grant execute on function public.ubah_tahap_lamaran(uuid, text, text) to authenticated;
