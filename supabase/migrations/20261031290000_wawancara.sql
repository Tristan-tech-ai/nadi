-- F2-03 wawancara suara asinkron (docs/research/wawancara.md): pertanyaan per lowongan, jawaban audio pelamar tanpa akun,
-- transkrip dan nilai disimpan pengelola dari perangkatnya (Whisper di browser; tidak ada AI di server untuk audio).

-- Pertanyaan lowongan (maks 5), diturunkan dari topi oleh server Next saat lowongan dibuat; boleh diubah pengelola.
alter table public.lowongan add column pertanyaan jsonb not null default '[]'::jsonb
  check (jsonb_typeof(pertanyaan) = 'array' and jsonb_array_length(pertanyaan) <= 5);

create or replace function public.lowongan_publik(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('judul', l.judul, 'ringkasan', l.ringkasan, 'usaha', p.nama, 'buka', l.buka, 'pertanyaan', l.pertanyaan)
    from public.lowongan l join public.perusahaan p on p.id = l.perusahaan_id where l.kode = upper(p_kode)
$$;

-- Bucket berkas menerima rekaman suara (MediaRecorder: webm di Chromium/Firefox, mp4 di Safari, ogg di sebagian Firefox).
update storage.buckets set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'audio/webm', 'audio/mp4', 'audio/ogg']
where id = 'berkas';

create table public.jawaban_wawancara (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  lamaran_id uuid not null references public.lamaran(id) on delete cascade,
  urutan integer not null check (urutan between 0 and 4),
  pertanyaan text not null,
  berkas_id uuid not null references public.berkas(id),
  durasi_detik numeric not null check (durasi_detik > 0 and durasi_detik <= 120),
  status text not null default 'unggah' check (status in ('unggah', 'masuk')),
  transkrip text check (char_length(transkrip) <= 4000),
  nilai jsonb,
  ditranskrip_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (lamaran_id, urutan)
);
create index on public.jawaban_wawancara (perusahaan_id);
create index on public.jawaban_wawancara (berkas_id);
alter table public.jawaban_wawancara enable row level security;
create policy jawaban_wawancara_baca on public.jawaban_wawancara for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
grant select on public.jawaban_wawancara to authenticated;

-- Pelamar (anon) mendaftarkan satu jawaban: dalam 2 jam sejak melamar, urutan dalam jumlah pertanyaan, sekali per pertanyaan.
create or replace function public.wawancara_daftar(p_lamaran uuid, p_urutan integer, p_sha256 text, p_mime text, p_ukuran bigint, p_durasi numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare la public.lamaran; v_tanya jsonb; v_ext text; b public.berkas; v_id uuid;
begin
  select * into la from public.lamaran where id = p_lamaran and dibuat_at > now() - interval '2 hours';
  if la.id is null then raise exception 'Sesi wawancara sudah lewat. Lamaranmu tetap tersimpan.' using errcode = 'P0002'; end if;
  select pertanyaan into v_tanya from public.lowongan where id = la.lowongan_id;
  if p_urutan is null or p_urutan < 0 or p_urutan >= jsonb_array_length(v_tanya) then
    raise exception 'Pertanyaan tidak ditemukan.' using errcode = '22023';
  end if;
  v_ext := case split_part(coalesce(p_mime, ''), ';', 1) when 'audio/webm' then 'webm' when 'audio/mp4' then 'm4a' when 'audio/ogg' then 'ogg' end;
  if v_ext is null then raise exception 'Rekaman harus berupa suara.' using errcode = '22023'; end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then raise exception 'Rekaman tidak terbaca. Rekam ulang.' using errcode = '22023'; end if;
  if p_ukuran is null or p_ukuran <= 0 or p_ukuran > 5242880 then raise exception 'Rekaman paling besar 5 MB.' using errcode = '22023'; end if;
  if p_durasi is null or p_durasi <= 0 or p_durasi > 120 then raise exception 'Jawaban paling lama 2 menit.' using errcode = '22023'; end if;
  if exists (select 1 from public.jawaban_wawancara where lamaran_id = la.id and urutan = p_urutan) then
    raise exception 'Pertanyaan ini sudah kamu jawab.' using errcode = '23505';
  end if;
  select * into b from public.berkas where perusahaan_id = la.perusahaan_id and sha256 = p_sha256;
  if b.id is null then
    insert into public.berkas (perusahaan_id, jalur, nama_asli, mime, ukuran, sha256, status)
    values (la.perusahaan_id, la.perusahaan_id || '/wawancara/' || p_sha256 || '.' || v_ext, 'Jawaban ' || la.nama || ' ' || (p_urutan + 1) || '.' || v_ext,
            split_part(p_mime, ';', 1), p_ukuran, p_sha256, 'unggah')
    returning * into b;
  end if;
  insert into public.jawaban_wawancara (perusahaan_id, lamaran_id, urutan, pertanyaan, berkas_id, durasi_detik)
  values (la.perusahaan_id, la.id, p_urutan, v_tanya ->> p_urutan, b.id, round(p_durasi, 1))
  returning id into v_id;
  return jsonb_build_object('jawaban', v_id, 'berkas', b.id, 'jalur', b.jalur, 'perlu_unggah', b.status = 'unggah');
end $$;

-- Setelah unggah: pastikan objek ada, tandai berkas selesai (tidak dibaca AI) dan jawaban masuk.
create or replace function public.wawancara_selesai(p_jawaban uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.jawaban_wawancara; b public.berkas;
begin
  select * into j from public.jawaban_wawancara where id = p_jawaban and dibuat_at > now() - interval '2 hours';
  if j.id is null then raise exception 'Jawaban tidak ditemukan' using errcode = 'P0002'; end if;
  select * into b from public.berkas where id = j.berkas_id;
  if b.status = 'unggah' then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'berkas' and o.name = b.jalur) then
      raise exception 'Rekaman belum terunggah. Coba kirim lagi.' using errcode = '55000';
    end if;
    update public.berkas set status = 'selesai', diubah_at = now() where id = b.id;
  end if;
  update public.jawaban_wawancara set status = 'masuk' where id = j.id;
  return jsonb_build_object('status', 'masuk');
end $$;

-- Pengelola menyimpan transkrip dan nilai rubrik yang dihitung di perangkatnya.
create or replace function public.simpan_transkrip(p_jawaban uuid, p_transkrip text, p_nilai jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  if char_length(coalesce(p_transkrip, '')) > 4000 then raise exception 'Transkrip terlalu panjang' using errcode = '22023'; end if;
  update public.jawaban_wawancara set transkrip = btrim(p_transkrip), nilai = p_nilai, ditranskrip_at = now()
   where id = p_jawaban and perusahaan_id = app.pid();
  if not found then raise exception 'Jawaban tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Slot unggah anon: lamar (CV) dan wawancara (audio), hanya jalur yang baru didaftarkan dan masih berstatus unggah.
create or replace function app.slot_lamar(p_jalur text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.berkas b
                  where b.jalur = p_jalur and split_part(p_jalur, '/', 2) in ('lamar', 'wawancara')
                    and b.status = 'unggah' and b.diunggah_oleh is null and b.dibuat_at > now() - interval '10 minutes')
$$;
alter policy berkas_unggah_lamar on storage.objects
  with check (bucket_id = 'berkas' and (storage.foldername(name))[2] in ('lamar', 'wawancara') and app.slot_lamar(name));

revoke all on function public.wawancara_daftar(uuid, integer, text, text, bigint, numeric), public.wawancara_selesai(uuid), public.simpan_transkrip(uuid, text, jsonb) from public;
grant execute on function public.wawancara_daftar(uuid, integer, text, text, bigint, numeric), public.wawancara_selesai(uuid) to anon, authenticated;
grant execute on function public.simpan_transkrip(uuid, text, jsonb) to authenticated;
