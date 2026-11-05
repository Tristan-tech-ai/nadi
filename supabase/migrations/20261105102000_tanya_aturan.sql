-- T-01A belajar format jalur tanya data. Kalimat yang tidak dikenali pengurai bawaan (src/lib/tanya/urai.ts) dipelajari sekali
-- lewat model di Edge Function pelajari-tanya: model memilih satu dari 13 niat tetap dan kata kunci yang ada di kalimat, pengawas
-- bukan AI memeriksanya, lalu aturan "kata -> niat" disimpan berstatus bayangan. Bayangan dibandingkan dengan model sampai cocok
-- 2 kali baru aktif (constraint), beda sekali mati. Aturan hanya struktur: kata huruf kecil 1-3 kata, tanpa angka atau data.
-- Ditulis hanya oleh Edge Function (kunci rahasia server); klien hanya membaca aturan usahanya dan aturan bersama.

create table public.tanya_aturan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid references public.perusahaan (id) on delete cascade,
  kata text not null check (kata ~ '^[a-z]+( [a-z]+){0,2}$' and length(kata) between 3 and 40),
  niat text not null check (niat in ('pendapatan', 'beban', 'laba', 'kas', 'piutang', 'piutang_lewat', 'hutang', 'invoice_terbit', 'karyawan', 'hadir', 'lembur', 'gaji', 'stok')),
  status text not null default 'bayangan' check (status in ('bayangan', 'aktif', 'mati')),
  bayangan_cocok integer not null default 0 check (bayangan_cocok >= 0),
  asal jsonb not null default '{}'::jsonb,
  alasan_mati text,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  constraint tanya_aturan_aktif_lolos_bayangan check (status <> 'aktif' or bayangan_cocok >= 2)
);
-- Satu aturan per kata per usaha; aturan bersama (perusahaan_id null) satu per kata.
create unique index tanya_aturan_kata on public.tanya_aturan (coalesce(perusahaan_id, '00000000-0000-0000-0000-000000000000'::uuid), kata);
create index tanya_aturan_usaha on public.tanya_aturan (perusahaan_id) where status <> 'mati';

alter table public.tanya_aturan enable row level security;
create policy tanya_aturan_baca on public.tanya_aturan for select to authenticated
  using ((perusahaan_id = (select app.pid()) or perusahaan_id is null) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select (id, perusahaan_id, kata, niat, status, bayangan_cocok, dibuat_at) on public.tanya_aturan to authenticated;

-- Konteks untuk Edge Function: usaha dan peran pemanggil dari JWT-nya sendiri (security invoker).
create or replace function public.learn_question_context() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  if v_pid is null or v_peran not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Tanya data hanya untuk pemilik, admin, dan akuntan' using errcode = '42501';
  end if;
  return jsonb_build_object('perusahaan_id', v_pid, 'peran', v_peran);
end $$;
revoke all on function public.learn_question_context() from public, anon;
grant execute on function public.learn_question_context() to authenticated;
