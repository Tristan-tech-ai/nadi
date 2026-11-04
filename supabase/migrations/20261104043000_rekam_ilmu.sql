-- F3-07C (docs/research/serah-terima-sql.md "Rekam Ilmu", docs/design/serah-terima-layar.md bagian 2): orang yang berhenti
-- merekam penjelasan butir ilmunya sendiri di HP-nya; pemilik/admin mendengar klip, membuat transkrip di perangkat, dan menyimpan
-- langkah kerja (saran model ringan = masukan tak tepercaya, atau ketikan pemilik). Klip asli selalu tetap ada.

alter table public.serah_butir
  add column if not exists berkas_id uuid references public.berkas(id) on delete set null,
  add column if not exists durasi_detik numeric check (durasi_detik is null or (durasi_detik > 0 and durasi_detik <= 300)),
  add column if not exists transkrip text check (transkrip is null or length(transkrip) <= 20000),
  add column if not exists langkah jsonb check (langkah is null or jsonb_typeof(langkah) = 'array'),
  add column if not exists langkah_sumber text check (langkah_sumber is null or langkah_sumber in ('model', 'pemilik'));
create index if not exists serah_butir_berkas on public.serah_butir (berkas_id);

-- Butir ilmu milik orang yang sedang berhenti (dipakai RLS dan RPC). Hanya selama paket masih disiapkan.
create or replace function app.butir_ilmu_saya(p_butir uuid) returns public.serah_butir
language sql stable security definer set search_path = '' as $$
  select sb.* from public.serah_butir sb join public.berhenti b on b.id = sb.berhenti_id
   where sb.id = p_butir and sb.jenis = 'ilmu' and sb.perusahaan_id = app.pid() and b.status = 'disiapkan'
     and b.orang_id = app.orang_saya()
$$;
revoke all on function app.butir_ilmu_saya(uuid) from public, anon;
grant execute on function app.butir_ilmu_saya(uuid) to authenticated;

create policy serah_butir_baca_ilmu_sendiri on public.serah_butir for select to authenticated
  using (jenis = 'ilmu' and perusahaan_id = (select app.pid()) and exists (
    select 1 from public.berhenti b where b.id = berhenti_id and b.status = 'disiapkan' and b.orang_id = (select app.orang_saya())));

-- Daftarkan rekaman: hanya orang itu sendiri, untuk butir ilmunya. Jalur {usaha}/serah/{berhenti}/{sha256}.{ext}.
create or replace function public.rekam_ilmu_daftar(p_butir uuid, p_sha256 text, p_mime text, p_ukuran bigint, p_durasi numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sb public.serah_butir; v_ext text; b public.berkas;
begin
  sb := app.butir_ilmu_saya(p_butir);
  if sb.id is null then raise exception 'Hanya orang yang berhenti yang merekam penjelasan ilmunya sendiri.' using errcode = '42501'; end if;
  v_ext := case split_part(coalesce(p_mime, ''), ';', 1) when 'audio/webm' then 'webm' when 'audio/mp4' then 'm4a' when 'audio/ogg' then 'ogg' end;
  if v_ext is null then raise exception 'Rekaman harus berupa suara.' using errcode = '22023'; end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then raise exception 'Rekaman tidak terbaca. Rekam ulang.' using errcode = '22023'; end if;
  if p_ukuran is null or p_ukuran <= 0 or p_ukuran > 10485760 then raise exception 'Rekaman paling besar 10 MB.' using errcode = '22023'; end if;
  if p_durasi is null or p_durasi <= 0 or p_durasi > 300 then raise exception 'Penjelasan paling lama 5 menit.' using errcode = '22023'; end if;
  select * into b from public.berkas where perusahaan_id = sb.perusahaan_id and sha256 = p_sha256;
  if b.id is null then
    insert into public.berkas (perusahaan_id, jalur, nama_asli, mime, ukuran, sha256, status, diunggah_oleh)
    values (sb.perusahaan_id, sb.perusahaan_id || '/serah/' || sb.berhenti_id || '/' || p_sha256 || '.' || v_ext,
            'Penjelasan ' || left(sb.judul, 80) || '.' || v_ext, split_part(p_mime, ';', 1), p_ukuran, p_sha256, 'unggah', (select auth.uid()))
    returning * into b;
  end if;
  update public.serah_butir set berkas_id = b.id, durasi_detik = round(p_durasi, 1), transkrip = null, langkah = null, langkah_sumber = null
   where id = sb.id;
  return jsonb_build_object('berkas', b.id, 'jalur', b.jalur, 'perlu_unggah', b.status = 'unggah');
end $$;
revoke all on function public.rekam_ilmu_daftar(uuid, text, text, bigint, numeric) from public, anon;
grant execute on function public.rekam_ilmu_daftar(uuid, text, text, bigint, numeric) to authenticated;

create or replace function public.rekam_ilmu_selesai(p_butir uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare sb public.serah_butir; b public.berkas;
begin
  sb := app.butir_ilmu_saya(p_butir);
  if sb.id is null then raise exception 'Hanya orang yang berhenti yang merekam penjelasan ilmunya sendiri.' using errcode = '42501'; end if;
  select * into b from public.berkas where id = sb.berkas_id;
  if b.id is null then raise exception 'Rekaman belum didaftarkan.' using errcode = 'P0002'; end if;
  if b.status = 'unggah' then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'berkas' and o.name = b.jalur) then
      raise exception 'Rekaman belum terunggah. Coba kirim lagi.' using errcode = '55000';
    end if;
    update public.berkas set status = 'selesai', diubah_at = now() where id = b.id;
  end if;
end $$;
revoke all on function public.rekam_ilmu_selesai(uuid) from public, anon;
grant execute on function public.rekam_ilmu_selesai(uuid) to authenticated;

-- Pemilik/admin menyimpan transkrip dan langkah kerja. Langkah: larik 1-20 kalimat, masing-masing 1-300 huruf.
create or replace function public.simpan_ilmu(p_butir uuid, p_transkrip text, p_langkah jsonb, p_sumber text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyimpan langkah kerja.' using errcode = '42501';
  end if;
  if p_sumber not in ('model', 'pemilik') then raise exception 'Sumber langkah tidak dikenal.' using errcode = '22023'; end if;
  if p_langkah is not null and (jsonb_typeof(p_langkah) <> 'array' or jsonb_array_length(p_langkah) not between 1 and 20
      or exists (select 1 from jsonb_array_elements(p_langkah) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 300)) then
    raise exception 'Langkah harus 1 sampai 20 kalimat, masing-masing paling panjang 300 huruf.' using errcode = '22023';
  end if;
  update public.serah_butir set transkrip = coalesce(left(p_transkrip, 20000), transkrip), langkah = p_langkah,
         langkah_sumber = case when p_langkah is null then null else p_sumber end
   where id = p_butir and perusahaan_id = v_pid and jenis = 'ilmu';
  if not found then raise exception 'Butir ilmu tidak ditemukan.' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.simpan_ilmu(uuid, text, jsonb, text) from public, anon;
grant execute on function public.simpan_ilmu(uuid, text, jsonb, text) to authenticated;
