-- M-11 (docs/research/hr-admin.md): HR administrasi tahap 1.
-- Profil kerja (jabatan, level, departemen/cost center, atasan langsung, status kerja) + riwayat jabatan; surat peringatan berurutan
-- dengan masa berlaku (PP 35/2021 Pasal 36 huruf k dan Penjelasan Pasal 52 ayat (1)); pengumuman + tanda baca; daftar periksa
-- onboarding/offboarding. Staf hanya melihat datanya sendiri. Tes: supabase/tests/hr_admin.test.sql.

create table public.profil_kerja (
  orang_id uuid primary key references public.orang(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jabatan text check (jabatan is null or length(btrim(jabatan)) between 2 and 80),
  level text check (level is null or length(btrim(level)) between 1 and 40),
  departemen text check (departemen is null or length(btrim(departemen)) between 2 and 60),
  atasan_id uuid references public.orang(id) on delete set null,
  status_kerja text check (status_kerja is null or status_kerja in ('pkwtt', 'pkwt', 'harian_lepas', 'magang', 'paruh_waktu')),
  kontrak_sampai date,
  diubah_at timestamptz not null default now(),
  check (atasan_id is null or atasan_id <> orang_id)
);
create index on public.profil_kerja (perusahaan_id, atasan_id);

create table public.riwayat_kerja (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  berlaku_dari date not null,
  jenis text not null check (jenis in ('masuk', 'promosi', 'mutasi', 'demosi', 'perubahan')),
  jabatan text, level text, departemen text, atasan_id uuid,
  catatan text check (catatan is null or length(catatan) <= 300),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);
create index on public.riwayat_kerja (perusahaan_id, orang_id, berlaku_dari);

create table public.surat_peringatan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tingkat smallint not null check (tingkat between 1 and 3),
  terakhir boolean not null default false,
  tanggal date not null,
  berlaku_sampai date not null,
  pelanggaran text not null check (length(btrim(pelanggaran)) between 5 and 500),
  dasar text check (dasar is null or length(dasar) <= 200),
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  check (berlaku_sampai >= tanggal)
);
create index on public.surat_peringatan (perusahaan_id, orang_id, tanggal);

create table public.pengumuman (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 120),
  isi text not null check (length(btrim(isi)) between 3 and 4000),
  untuk_peran text[] check (untuk_peran is null or untuk_peran <@ array['pemilik', 'admin', 'akuntan', 'staf']),
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien)
);
create index on public.pengumuman (perusahaan_id, dibuat_at desc);

create table public.pengumuman_baca (
  pengumuman_id uuid not null references public.pengumuman(id) on delete cascade,
  user_id uuid not null,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dibaca_at timestamptz not null default now(),
  primary key (pengumuman_id, user_id)
);
create index on public.pengumuman_baca (perusahaan_id);

create table public.daftar_periksa (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  jenis text not null check (jenis in ('onboarding', 'offboarding')),
  urutan smallint not null,
  butir text not null check (length(btrim(butir)) between 3 and 120),
  selesai_at timestamptz,
  selesai_oleh uuid,
  unique (orang_id, jenis, butir)
);
create index on public.daftar_periksa (perusahaan_id, orang_id);

alter table public.profil_kerja enable row level security;
alter table public.riwayat_kerja enable row level security;
alter table public.surat_peringatan enable row level security;
alter table public.pengumuman enable row level security;
alter table public.pengumuman_baca enable row level security;
alter table public.daftar_periksa enable row level security;

-- Pengelola (pemilik/admin) melihat semua; staf hanya miliknya sendiri. Penulisan hanya lewat RPC.
create policy profil_kerja_baca on public.profil_kerja for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
create policy riwayat_kerja_baca on public.riwayat_kerja for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
create policy surat_peringatan_baca on public.surat_peringatan for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
create policy daftar_periksa_baca on public.daftar_periksa for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
create policy pengumuman_baca_isi on public.pengumuman for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or untuk_peran is null or (select app.peran_aktif()) = any(untuk_peran)));
create policy pengumuman_baca_tanda on public.pengumuman_baca for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or user_id = (select auth.uid())));
grant select on public.profil_kerja, public.riwayat_kerja, public.surat_peringatan, public.pengumuman, public.pengumuman_baca, public.daftar_periksa to authenticated;

create trigger audit_profil_kerja after insert or update or delete on public.profil_kerja for each row execute function app.catat_audit();
create trigger audit_surat_peringatan after insert or update or delete on public.surat_peringatan for each row execute function app.catat_audit();

create or replace function app.wajib_pengelola() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Khusus pemilik atau admin' using errcode = '42501';
  end if;
  return v_pid;
end $$;

-- Profil kerja + riwayat. Atasan harus orang di usaha yang sama dan tidak membuat lingkaran (A atasan B atasan A).
create or replace function public.ubah_profil_kerja(p_orang uuid, p_jabatan text, p_level text, p_departemen text, p_atasan uuid,
  p_status text, p_kontrak_sampai date, p_jenis text, p_berlaku_dari date, p_catatan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); lama public.profil_kerja; v_cek uuid; i int := 0; v_berubah boolean;
begin
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if p_atasan is not null then
    if not exists (select 1 from public.orang where id = p_atasan and perusahaan_id = v_pid) then raise exception 'Atasan tidak ditemukan di usaha ini' using errcode = 'P0002'; end if;
    if p_atasan = p_orang then raise exception 'Seseorang tidak bisa menjadi atasannya sendiri' using errcode = '22023'; end if;
    v_cek := p_atasan;
    while v_cek is not null and i < 100 loop
      select atasan_id into v_cek from public.profil_kerja where orang_id = v_cek;
      if v_cek = p_orang then raise exception 'Atasan ini membuat lingkaran: dia sudah berada di bawah orang yang diubah' using errcode = '22023'; end if;
      i := i + 1;
    end loop;
  end if;
  if p_jenis not in ('masuk', 'promosi', 'mutasi', 'demosi', 'perubahan') then raise exception 'Jenis perubahan tidak dikenal' using errcode = '22023'; end if;
  if p_status = 'pkwt' and p_kontrak_sampai is null then raise exception 'Karyawan kontrak (PKWT) butuh tanggal akhir kontrak' using errcode = '22023'; end if;
  select * into lama from public.profil_kerja where orang_id = p_orang;
  v_berubah := lama.orang_id is null or lama.jabatan is distinct from nullif(btrim(p_jabatan), '') or lama.level is distinct from nullif(btrim(p_level), '')
    or lama.departemen is distinct from nullif(btrim(p_departemen), '') or lama.atasan_id is distinct from p_atasan;
  insert into public.profil_kerja as pk (orang_id, perusahaan_id, jabatan, level, departemen, atasan_id, status_kerja, kontrak_sampai)
  values (p_orang, v_pid, nullif(btrim(p_jabatan), ''), nullif(btrim(p_level), ''), nullif(btrim(p_departemen), ''), p_atasan, nullif(p_status, ''),
          case when p_status = 'pkwt' then p_kontrak_sampai end)
  on conflict (orang_id) do update set jabatan = excluded.jabatan, level = excluded.level, departemen = excluded.departemen, atasan_id = excluded.atasan_id,
    status_kerja = excluded.status_kerja, kontrak_sampai = excluded.kontrak_sampai, diubah_at = now();
  if v_berubah then
    insert into public.riwayat_kerja (perusahaan_id, orang_id, berlaku_dari, jenis, jabatan, level, departemen, atasan_id, catatan, dibuat_oleh)
    values (v_pid, p_orang, coalesce(p_berlaku_dari, app.hari_ini(v_pid)), case when lama.orang_id is null and p_jenis = 'perubahan' then 'masuk' else p_jenis end,
            nullif(btrim(p_jabatan), ''), nullif(btrim(p_level), ''), nullif(btrim(p_departemen), ''), p_atasan, nullif(btrim(coalesce(p_catatan, '')), ''), auth.uid());
  end if;
  return jsonb_build_object('orang', p_orang, 'riwayat', v_berubah);
end $$;

-- Surat peringatan berurutan (Penjelasan PP 35/2021 Pasal 52 ayat (1)): SP berikutnya hanya bila pelanggaran terjadi saat SP
-- sebelumnya masih berlaku; bila sudah lewat, kembali SP pertama. Masa berlaku bawaan 6 bulan kecuali PK/PP/PKB menetapkan lain.
-- Selama SP ketiga (atau SP pertama dan terakhir) berlaku, pelanggaran berikutnya dapat menjadi dasar PHK (Pasal 36 huruf k),
-- bukan SP baru.
create or replace function public.beri_sp(p_orang uuid, p_tanggal date, p_pelanggaran text, p_dasar text, p_masa_bulan int, p_terakhir boolean, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); akt public.surat_peringatan; s public.surat_peringatan; v_tingkat int; v_masa int := coalesce(p_masa_bulan, 6);
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into s from public.surat_peringatan where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if s.id is not null then return jsonb_build_object('id', s.id, 'tingkat', s.tingkat, 'berlaku_sampai', s.berlaku_sampai, 'sudah', true); end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) then raise exception 'Tanggal surat peringatan tidak boleh di masa depan' using errcode = '22023'; end if;
  if v_masa not between 1 and 12 then raise exception 'Masa berlaku 1 sampai 12 bulan (bawaan 6 bulan)' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_pelanggaran, ''))) < 5 then raise exception 'Tulis pelanggarannya (aturan PK, PP, atau PKB yang dilanggar)' using errcode = '22023'; end if;
  select * into akt from public.surat_peringatan where perusahaan_id = v_pid and orang_id = p_orang and p_tanggal between tanggal and berlaku_sampai
   order by tingkat desc, tanggal desc limit 1;
  if akt.id is not null and (akt.tingkat = 3 or akt.terakhir) then
    raise exception 'Surat peringatan % masih berlaku sampai %. Pelanggaran berikutnya dalam masa ini dapat menjadi dasar PHK (PP 35/2021 Pasal 36 huruf k dan Pasal 52), bukan surat peringatan baru.',
      case when akt.terakhir then 'pertama dan terakhir' else 'ketiga' end, to_char(akt.berlaku_sampai, 'DD-MM-YYYY') using errcode = '22023';
  end if;
  v_tingkat := case when coalesce(p_terakhir, false) then coalesce(akt.tingkat, 0) + 1 when akt.id is null then 1 else akt.tingkat + 1 end;
  insert into public.surat_peringatan (perusahaan_id, orang_id, tingkat, terakhir, tanggal, berlaku_sampai, pelanggaran, dasar, kunci_klien, dibuat_oleh)
  values (v_pid, p_orang, least(v_tingkat, 3), coalesce(p_terakhir, false), p_tanggal, (p_tanggal + make_interval(months => v_masa))::date - 1, btrim(p_pelanggaran),
          nullif(btrim(coalesce(p_dasar, '')), ''), p_kunci, auth.uid())
  returning * into s;
  return jsonb_build_object('id', s.id, 'tingkat', s.tingkat, 'terakhir', s.terakhir, 'berlaku_sampai', s.berlaku_sampai, 'sudah', false);
end $$;

create or replace function public.buat_pengumuman(p_judul text, p_isi text, p_untuk text[], p_kunci uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select id into v_id from public.pengumuman where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if v_id is not null then return v_id; end if;
  if length(btrim(coalesce(p_judul, ''))) < 3 or length(btrim(coalesce(p_isi, ''))) < 3 then raise exception 'Isi judul dan isi pengumuman' using errcode = '22023'; end if;
  insert into public.pengumuman (perusahaan_id, judul, isi, untuk_peran, kunci_klien, dibuat_oleh)
  values (v_pid, btrim(p_judul), btrim(p_isi), case when p_untuk is null or cardinality(p_untuk) = 0 then null else p_untuk end, p_kunci, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Tanda baca: setiap anggota yang boleh melihat pengumuman itu (RLS dicek ulang lewat select sebagai pemanggil).
create or replace function public.tandai_pengumuman_dibaca(p_pengumuman uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := (select app.peran_aktif());
begin
  if v_pid is null or v_peran is null then raise exception 'Belum masuk ke usaha' using errcode = '42501'; end if;
  if not exists (select 1 from public.pengumuman where id = p_pengumuman and perusahaan_id = v_pid
                  and (v_peran in ('pemilik', 'admin') or untuk_peran is null or v_peran = any(untuk_peran))) then
    raise exception 'Pengumuman tidak ditemukan' using errcode = 'P0002';
  end if;
  insert into public.pengumuman_baca (pengumuman_id, user_id, perusahaan_id) values (p_pengumuman, auth.uid(), v_pid) on conflict do nothing;
end $$;

-- Ringkasan tanda baca untuk pengelola: jumlah anggota aktif sasaran dan yang sudah membaca.
create or replace function public.ringkas_pengumuman() returns table (id uuid, sasaran int, dibaca int)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select count(*)::int from public.anggota a where a.perusahaan_id = p.perusahaan_id and a.aktif and (p.untuk_peran is null or a.peran = any(p.untuk_peran))),
         (select count(*)::int from public.pengumuman_baca b where b.pengumuman_id = p.id)
    from public.pengumuman p
   where p.perusahaan_id = app.pid() and coalesce((select app.peran_aktif()), '') in ('pemilik', 'admin')
$$;

-- Daftar periksa onboarding/offboarding bawaan; butir bisa ditambah.
create or replace function public.mulai_daftar_periksa(p_orang uuid, p_jenis text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_butir text[]; n int;
begin
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  v_butir := case p_jenis
    when 'onboarding' then array['Perjanjian kerja ditandatangani', 'Data rekening, NPWP, dan PTKP diisi', 'Didaftarkan BPJS Ketenagakerjaan dan Kesehatan', 'Akun staf Nadi dibuat', 'Perkenalan tim dan SOP kerja', 'Jadwal shift pertama dibuat']
    when 'offboarding' then array['Serah terima kerja dicatat', 'Aset usaha dikembalikan', 'Hak berhenti dihitung dan disetujui', 'Akun staf Nadi dinonaktifkan', 'BPJS dinonaktifkan', 'Surat keterangan kerja dibuat']
  end;
  if v_butir is null then raise exception 'Jenis daftar periksa tidak dikenal' using errcode = '22023'; end if;
  insert into public.daftar_periksa (perusahaan_id, orang_id, jenis, urutan, butir)
  select v_pid, p_orang, p_jenis, u.i, u.b from unnest(v_butir) with ordinality as u(b, i) on conflict (orang_id, jenis, butir) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.centang_periksa(p_id uuid, p_selesai boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  update public.daftar_periksa set selesai_at = case when p_selesai then coalesce(selesai_at, now()) end, selesai_oleh = case when p_selesai then auth.uid() end
   where id = p_id and perusahaan_id = v_pid;
  if not found then raise exception 'Butir tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

revoke all on function app.wajib_pengelola() from public, anon, authenticated;
revoke all on function public.ubah_profil_kerja(uuid, text, text, text, uuid, text, date, text, date, text), public.beri_sp(uuid, date, text, text, int, boolean, uuid),
  public.buat_pengumuman(text, text, text[], uuid), public.tandai_pengumuman_dibaca(uuid), public.ringkas_pengumuman(),
  public.mulai_daftar_periksa(uuid, text), public.centang_periksa(uuid, boolean) from public, anon;
grant execute on function public.ubah_profil_kerja(uuid, text, text, text, uuid, text, date, text, date, text), public.beri_sp(uuid, date, text, text, int, boolean, uuid),
  public.buat_pengumuman(text, text, text[], uuid), public.tandai_pengumuman_dibaca(uuid), public.ringkas_pengumuman(),
  public.mulai_daftar_periksa(uuid, text), public.centang_periksa(uuid, boolean) to authenticated;
