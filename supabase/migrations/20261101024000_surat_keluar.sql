-- F4-02 Surat keluar dari kalimat dengan QR verifikasi (docs/research/surat-keluar.md, tes supabase/tests/surat_keluar.test.sql).
-- Draf tidak memakai nomor; terbitkan mengambil nomor dari Nomor Sakti (app.terbit_nomor, templat bawaan per jenis SK/ST/SKK) dan
-- kode verifikasi acak 12 huruf (32 simbol tanpa huruf mirip, 60 bit). Surat terbit tidak bisa diubah; pembatalan beralasan ikut
-- membatalkan nomornya. Verifikasi publik (anon) hanya menampilkan usaha, nomor, judul, tanggal, nama pihak, dan status; isi tidak.
-- Peran lewat app.peran_aktif() (tabel anggota).

create or replace function app.kode_verifikasi() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(x.b, i) % 32) + 1, 1), '' order by i)
    from (select extensions.gen_random_bytes(12) as b) x, generate_series(0, 11) as i
$$;

create table public.surat_keluar (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('sk_mutasi', 'surat_tugas', 'keterangan_kerja')),
  judul text not null check (length(btrim(judul)) between 1 and 120),
  orang_id uuid references public.orang(id) on delete set null,
  nama_pihak text not null check (length(nama_pihak) between 1 and 120),
  bidang jsonb not null default '{}' check (jsonb_typeof(bidang) = 'object'),
  isi jsonb not null check (jsonb_typeof(isi) = 'array' and jsonb_array_length(isi) between 1 and 10),
  status text not null default 'draf' check (status in ('draf', 'terbit', 'batal')),
  nomor text,
  nomor_terbit_id uuid references public.nomor_terbit(id) on delete set null,
  tanggal date,
  kode_verifikasi text unique check (kode_verifikasi is null or kode_verifikasi ~ '^[A-HJ-NP-Z2-9]{12}$'),
  alasan_batal text check (alasan_batal is null or length(alasan_batal) <= 300),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  terbit_at timestamptz,
  terbit_oleh uuid,
  batal_at timestamptz,
  check (status = 'draf' or nomor is not null or status = 'batal')
);
create index on public.surat_keluar (perusahaan_id, dibuat_at desc);
create index on public.surat_keluar (orang_id);
create index on public.surat_keluar (nomor_terbit_id);

alter table public.surat_keluar enable row level security;
create policy surat_keluar_baca on public.surat_keluar for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.surat_keluar to authenticated;
create trigger audit_surat_keluar after insert or update or delete on public.surat_keluar for each row execute function app.catat_audit();

create or replace function public.simpan_surat(p_id uuid, p_jenis text, p_orang uuid, p_bidang jsonb, p_judul text, p_isi jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_nama text; v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membuat surat' using errcode = '42501';
  end if;
  if p_jenis is null or p_jenis not in ('sk_mutasi', 'surat_tugas', 'keterangan_kerja') then
    raise exception 'Jenis surat tidak dikenal' using errcode = '22023';
  end if;
  select o.nama into v_nama from public.orang o where o.id = p_orang and o.perusahaan_id = v_pid;
  if not found then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_isi) is distinct from 'array' or exists (select 1 from jsonb_array_elements(p_isi) e
       where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 1000) then
    raise exception 'Isi surat berupa paragraf teks, masing-masing 1 sampai 1000 huruf' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.surat_keluar (perusahaan_id, jenis, judul, orang_id, nama_pihak, bidang, isi, dibuat_oleh)
    values (v_pid, p_jenis, btrim(p_judul), p_orang, v_nama, coalesce(p_bidang, '{}'), p_isi, auth.uid())
    returning id into v_id;
    return v_id;
  end if;
  update public.surat_keluar
     set jenis = p_jenis, judul = btrim(p_judul), orang_id = p_orang, nama_pihak = v_nama, bidang = coalesce(p_bidang, '{}'), isi = p_isi
   where id = p_id and perusahaan_id = v_pid and status = 'draf'
  returning id into v_id;
  if v_id is null then
    raise exception 'Surat tidak ditemukan atau sudah terbit. Surat terbit tidak bisa diubah; batalkan lalu buat baru.' using errcode = '22023';
  end if;
  return v_id;
end $$;

create or replace function public.terbitkan_surat(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s public.surat_keluar; v_kode_nomor text; r jsonb; v_kode text;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menerbitkan surat' using errcode = '42501';
  end if;
  select * into s from public.surat_keluar where id = p_id and perusahaan_id = v_pid for update;
  if not found then
    raise exception 'Surat tidak ditemukan' using errcode = 'P0002';
  end if;
  if s.status <> 'draf' then
    raise exception 'Surat ini sudah terbit atau dibatalkan' using errcode = '22023';
  end if;
  v_kode_nomor := case s.jenis when 'sk_mutasi' then 'SK' when 'surat_tugas' then 'ST' else 'SKK' end;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, v_kode_nomor, s.judul, '{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, v_kode_nomor, 'surat ' || s.id, auth.uid());
  v_kode := app.kode_verifikasi();
  update public.surat_keluar
     set status = 'terbit', nomor = r ->> 'nomor', nomor_terbit_id = (r ->> 'id')::uuid, tanggal = (r ->> 'tanggal')::date,
         kode_verifikasi = v_kode, terbit_at = now(), terbit_oleh = auth.uid()
   where id = s.id;
  return jsonb_build_object('id', s.id, 'nomor', r ->> 'nomor', 'kode', v_kode, 'tanggal', r ->> 'tanggal');
end $$;

create or replace function public.batal_surat(p_id uuid, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s public.surat_keluar;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membatalkan surat' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan pembatalan surat' using errcode = '22023';
  end if;
  select * into s from public.surat_keluar where id = p_id and perusahaan_id = v_pid and status in ('draf', 'terbit') for update;
  if not found then
    raise exception 'Surat tidak ditemukan atau sudah dibatalkan' using errcode = 'P0002';
  end if;
  update public.surat_keluar set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), batal_at = now() where id = s.id;
  if s.nomor_terbit_id is not null then
    update public.nomor_terbit set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), dibatalkan_oleh = auth.uid(), dibatalkan_at = now()
     where id = s.nomor_terbit_id and status = 'terbit';
  end if;
end $$;

-- Publik: kode dari QR atau diketik (huruf kecil, spasi, dan tanda hubung diabaikan).
create or replace function public.verifikasi_surat(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', s.status, 'usaha', p.nama, 'nomor', s.nomor, 'judul', s.judul, 'tanggal', s.tanggal,
                            'nama_pihak', s.nama_pihak, 'terbit_at', s.terbit_at, 'batal_at', s.batal_at)
    from public.surat_keluar s join public.perusahaan p on p.id = s.perusahaan_id
   where s.kode_verifikasi = upper(regexp_replace(coalesce(p_kode, ''), '[\s-]', '', 'g')) and s.status in ('terbit', 'batal')
$$;

revoke all on function app.kode_verifikasi() from public, anon, authenticated;
revoke all on function public.simpan_surat(uuid, text, uuid, jsonb, text, jsonb), public.terbitkan_surat(uuid), public.batal_surat(uuid, text),
  public.verifikasi_surat(text) from public, anon;
grant execute on function public.simpan_surat(uuid, text, uuid, jsonb, text, jsonb), public.terbitkan_surat(uuid), public.batal_surat(uuid, text)
  to authenticated;
grant execute on function public.verifikasi_surat(text) to anon, authenticated;
