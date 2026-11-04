-- F6-04 (docs/research/mitra.md): direktori psikolog, akuntan publik, dan konsultan pajak mitra; pengguna mengirim permintaan,
-- bukan pembayaran. Tidak ada kolom uang, tarif, atau pembayaran di mana pun. Nadi tidak mengirim pesan ke mitra: permintaan
-- disimpan dan dilihat pengirimnya; mitra sungguhan nanti membaca lewat akun mereka sendiri (belum ada). Selama belum ada mitra
-- sungguhan, direktori berisi data contoh sintetis (contoh = true, terverifikasi = false) dan layar menyebutnya.
-- Dasar izin yang ditampilkan per jenis (dibaca dari teks resmi 4 Nov 2026):
--   psikolog: STR dari induk organisasi profesi himpunan Psikologi + SILP dari Pemerintah Pusat (UU 23/2022 Pasal 15 dan 17)
--   akuntan_publik: izin Menteri Keuangan, berlaku 5 tahun (UU 5/2011 Pasal 5)
--   konsultan_pajak: Izin Praktik dari Sekretaris Jenderal Kemenkeu (PMK 111/PMK.03/2014 diubah PMK 175/PMK.01/2022 Pasal 4)
-- Tes: supabase/tests/mitra.test.sql.

create table public.mitra (
  id uuid primary key default app.uuid7(),
  jenis text not null check (jenis in ('psikolog', 'akuntan_publik', 'konsultan_pajak')),
  nama text not null check (length(btrim(nama)) between 3 and 120),
  kota text not null check (length(btrim(kota)) between 2 and 60),
  layanan text[] not null check (cardinality(layanan) between 1 and 8),
  ringkas text check (ringkas is null or length(ringkas) <= 300),
  nomor_izin text check (nomor_izin is null or length(btrim(nomor_izin)) between 3 and 80),
  terverifikasi boolean not null default false,
  diverifikasi_at timestamptz,
  contoh boolean not null default false,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  check (not (contoh and terverifikasi)),
  check (terverifikasi = (diverifikasi_at is not null))
);
alter table public.mitra enable row level security;
create policy mitra_baca on public.mitra for select to authenticated using (aktif);
grant select on public.mitra to authenticated;

create table public.permintaan_mitra (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  mitra_id uuid not null references public.mitra(id),
  layanan text not null check (length(btrim(layanan)) between 2 and 80),
  pesan text not null check (length(btrim(pesan)) between 10 and 1000),
  status text not null default 'terkirim' check (status in ('terkirim', 'dibatalkan')),
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  dibatalkan_at timestamptz,
  unique (perusahaan_id, kunci_klien),
  check ((status = 'dibatalkan') = (dibatalkan_at is not null))
);
create index on public.permintaan_mitra (perusahaan_id, dibuat_at desc);
create index on public.permintaan_mitra (mitra_id);
alter table public.permintaan_mitra enable row level security;
create policy permintaan_mitra_baca on public.permintaan_mitra for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.permintaan_mitra to authenticated;
create trigger audit_permintaan_mitra after insert or update or delete on public.permintaan_mitra for each row execute function app.catat_audit();

-- Kirim permintaan: pemilik/admin, mitra aktif, layanan harus salah satu layanan mitra, paling banyak 10 permintaan per hari per
-- usaha, idempoten per kunci klien. Tidak ada uang yang berpindah dan tidak ada pesan yang dikirim Nadi.
create or replace function public.kirim_permintaan_mitra(p_mitra uuid, p_layanan text, p_pesan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); m public.mitra; p public.permintaan_mitra; n int;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengirim permintaan ke mitra.' using errcode = '42501';
  end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into p from public.permintaan_mitra where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', p.id, 'sudah', true, 'contoh', (select contoh from public.mitra where id = p.mitra_id)); end if;
  select * into m from public.mitra where id = p_mitra and aktif;
  if not found then raise exception 'Mitra tidak ditemukan.' using errcode = 'P0002'; end if;
  if not (btrim(coalesce(p_layanan, '')) = any (m.layanan)) then
    raise exception 'Pilih salah satu layanan mitra ini.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_pesan, ''))) not between 10 and 1000 then
    raise exception 'Tulis kebutuhanmu, 10 sampai 1.000 huruf.' using errcode = '22023';
  end if;
  select count(*) into n from public.permintaan_mitra where perusahaan_id = v_pid and dibuat_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Paling banyak 10 permintaan sehari. Coba lagi besok.' using errcode = '54000'; end if;
  insert into public.permintaan_mitra (perusahaan_id, mitra_id, layanan, pesan, kunci_klien, dibuat_oleh)
  values (v_pid, m.id, btrim(p_layanan), btrim(p_pesan), p_kunci, auth.uid()) returning * into p;
  return jsonb_build_object('id', p.id, 'sudah', false, 'contoh', m.contoh);
end $$;

create or replace function public.batal_permintaan_mitra(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membatalkan permintaan.' using errcode = '42501';
  end if;
  update public.permintaan_mitra set status = 'dibatalkan', dibatalkan_at = now()
   where id = p_id and perusahaan_id = v_pid and status = 'terkirim';
  if not found then raise exception 'Permintaan tidak ditemukan atau sudah dibatalkan.' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.kirim_permintaan_mitra(uuid, text, text, uuid), public.batal_permintaan_mitra(uuid) from public, anon;
grant execute on function public.kirim_permintaan_mitra(uuid, text, text, uuid), public.batal_permintaan_mitra(uuid) to authenticated;

-- Data contoh sintetis: nama bertanda Contoh, tanpa nomor izin, tidak terverifikasi.
insert into public.mitra (jenis, nama, kota, layanan, ringkas, contoh) values
  ('psikolog', 'Contoh: Biro Psikologi Seruni', 'Denpasar', array['Asesmen calon karyawan', 'Konseling karyawan', 'Pelatihan tim'],
   'Data contoh untuk mencoba alur permintaan; bukan biro sungguhan.', true),
  ('psikolog', 'Contoh: Praktik Psikolog Kemuning', 'Surabaya', array['Asesmen calon karyawan', 'Konseling karyawan'],
   'Data contoh untuk mencoba alur permintaan; bukan praktik sungguhan.', true),
  ('akuntan_publik', 'Contoh: KAP Teratai dan Rekan', 'Jakarta', array['Audit laporan keuangan', 'Jasa reviu'],
   'Data contoh untuk mencoba alur permintaan; bukan kantor akuntan publik sungguhan.', true),
  ('konsultan_pajak', 'Contoh: Konsultan Pajak Cempaka', 'Denpasar', array['Pendampingan SPT Tahunan', 'Konsultasi PPh 21 karyawan', 'Konsultasi pajak impor'],
   'Data contoh untuk mencoba alur permintaan; bukan konsultan sungguhan.', true);
