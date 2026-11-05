-- T-01C belajar format jalur pindah data. Berkas ekspor aplikasi lain yang judul kolomnya tidak dikenali kenali() (src/lib/pindah/
-- format.ts) dipetakan model sekali di Edge Function pelajari-pindah: model hanya melihat judul dan tipe kolom, tidak pernah isi
-- baris. Pengawas bukan AI (src/lib/pindah/peta.ts periksaPeta) memeriksa peta, lalu peta disimpan bayangan per usaha dengan sidik
-- judul kolom. Bayangan dibandingkan dengan peta model sampai cocok 2 kali baru aktif (constraint); beda sekali mati. Peta hanya
-- struktur: bidang dari daftar tetap -> judul kolom (huruf kecil), tanpa isi baris. Ditulis hanya oleh Edge Function.

create table public.pindah_peta (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan (id) on delete cascade,
  sidik text not null check (sidik ~ '^[0-9a-f]{8}$'),
  format text not null check (format in ('karyawan', 'produk')),
  peta jsonb not null check (jsonb_typeof(peta) = 'object' and pg_column_size(peta) < 4000),
  status text not null default 'bayangan' check (status in ('bayangan', 'aktif', 'mati')),
  bayangan_cocok integer not null default 0 check (bayangan_cocok >= 0),
  asal jsonb not null default '{}'::jsonb,
  alasan_mati text,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  constraint pindah_peta_aktif_lolos_bayangan check (status <> 'aktif' or bayangan_cocok >= 2),
  unique (perusahaan_id, sidik)
);

-- Isi peta hanya bidang tetap -> judul kolom pendek; nilai bukan teks atau terlalu panjang ditolak (bukan tempat menyimpan data).
create or replace function app.pindah_peta_sah() returns trigger
language plpgsql set search_path = '' as $$
declare k text; v jsonb;
begin
  for k, v in select * from jsonb_each(new.peta) loop
    if k not in ('nama', 'id', 'jabatan', 'telepon', 'mulai', 'gaji_pokok', 'kode', 'satuan', 'harga_jual', 'stok') then
      raise exception 'Bidang peta tidak dikenal: %', left(k, 30) using errcode = '22023';
    end if;
    if jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 1 and 60 or (v #>> '{}') ~ '\d{6,}' then
      raise exception 'Judul kolom peta tidak sah' using errcode = '22023';
    end if;
  end loop;
  return new;
end $$;
create trigger pindah_peta_sah before insert or update on public.pindah_peta for each row execute function app.pindah_peta_sah();
revoke all on function app.pindah_peta_sah() from public, anon, authenticated;

alter table public.pindah_peta enable row level security;
create policy pindah_peta_baca on public.pindah_peta for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select (id, perusahaan_id, sidik, format, peta, status, bayangan_cocok, dibuat_at) on public.pindah_peta to authenticated;

-- Konteks untuk Edge Function: usaha pemanggil dari JWT-nya, hanya pemilik/admin (sama dengan propose_migration).
create or replace function public.learn_migration_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  return jsonb_build_object('perusahaan_id', v_pid);
end $$;
revoke all on function public.learn_migration_context() from public, anon;
grant execute on function public.learn_migration_context() to authenticated;
