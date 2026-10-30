-- Mode hemat untuk Supabase Free (DB 500 MB): kejadian mentah disimpan 90 hari, audit 180 hari, sisanya hidup sebagai
-- ringkasan harian per perusahaan, jenis, dan orang. Ringkasan dihitung setiap malam dan bersifat idempoten.
-- Pemeliharaan partisi (buat partisi baru, buang yang melewati retensi) dijalankan pg_cron setiap hari.

create table public.ringkasan_harian (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tanggal date not null,
  jenis text not null,
  orang_id uuid,
  jumlah integer not null,
  total_nilai numeric,
  diperbarui_at timestamptz not null default now()
);
create unique index ringkasan_harian_kunci on public.ringkasan_harian
  (perusahaan_id, tanggal, jenis, (coalesce(orang_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create index on public.ringkasan_harian (perusahaan_id, orang_id, tanggal) where orang_id is not null;

alter table public.ringkasan_harian enable row level security;
alter table public.ringkasan_harian force row level security;
create policy ringkasan_harian_baca on public.ringkasan_harian for select to authenticated
  using (perusahaan_id = (select app.pid()));
grant select on public.ringkasan_harian to authenticated;

-- Hari dihitung menurut zona waktu masing-masing perusahaan. Rentang terjadi_at dibatasi agar partisi lain tidak dipindai.
create or replace function app.ringkas_hari(p_tanggal date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.ringkasan_harian (perusahaan_id, tanggal, jenis, orang_id, jumlah, total_nilai)
  select k.perusahaan_id, p_tanggal, k.jenis, k.orang_id, count(*), sum(k.nilai)
    from public.kejadian k
    join public.perusahaan p on p.id = k.perusahaan_id
   where k.terjadi_at >= p_tanggal::timestamptz - interval '1 day'
     and k.terjadi_at < p_tanggal::timestamptz + interval '2 days'
     and (k.terjadi_at at time zone p.zona_waktu)::date = p_tanggal
   group by k.perusahaan_id, k.jenis, k.orang_id
  on conflict (perusahaan_id, tanggal, jenis, (coalesce(orang_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do update set jumlah = excluded.jumlah, total_nilai = excluded.total_nilai, diperbarui_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.ringkas_hari(date) from public, anon, authenticated;

-- Retensi lewat pg_partman: partisi yang seluruhnya lebih tua dari batas dibuang saat pemeliharaan.
update partman.part_config set retention = '90 days', retention_keep_table = false where parent_table = 'public.kejadian';
update partman.part_config set retention = '180 days', retention_keep_table = false where parent_table = 'public.audit_log';

-- 17:30 UTC = 00:30 WIB, 01:30 WITA, 02:30 WIT: hari kemarin sudah lewat di semua zona Indonesia.
select cron.schedule('nadi-ringkas-harian', '30 17 * * *', $$select app.ringkas_hari((now() at time zone 'Asia/Jakarta')::date - 1)$$);
select cron.schedule('nadi-partman', '0 18 * * *', $$call partman.run_maintenance_proc()$$);
