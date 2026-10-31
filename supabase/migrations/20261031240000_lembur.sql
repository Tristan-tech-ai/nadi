-- F1-05B: lembur per orang per hari (PP 35/2021 Pasal 26, 31, 32; docs/research/gaji.md bagian 3).
-- Upah lembur dihitung di server Next (src/lib/gaji/bpjs-lembur.ts upahLembur) saat menyiapkan slip, dari aturan bertanggal lembur.pp35.
-- Tulis hanya lewat catat_lembur (pemilik/admin). Batal = jam 0 (baris tidak dihapus). Bulan yang gajinya sudah disetujui terkunci.
create table public.lembur (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tanggal date not null,
  jenis text not null check (jenis in ('hari_kerja', 'libur_pola_6_hari', 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', 'libur_pola_5_hari')),
  jam integer not null check (jam between 0 and 12),
  catatan text check (char_length(catatan) <= 200),
  dicatat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (orang_id, tanggal)
);
create index on public.lembur (perusahaan_id, tanggal);
alter table public.lembur enable row level security;

-- Pengelola melihat semua lembur usaha; staf hanya lemburnya sendiri.
create policy lembur_baca on public.lembur for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.pengelola()) or orang_id = (select app.orang_saya())));
grant select on public.lembur to authenticated;

create or replace function public.catat_lembur(p_orang uuid, p_tanggal date, p_jenis text, p_jam integer, p_catatan text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_id uuid; v_minggu integer;
  v_maks integer := case p_jenis when 'hari_kerja' then 4 when 'libur_pola_6_hari' then 11
    when 'libur_pola_6_hari_jatuh_hari_kerja_terpendek' then 9 when 'libur_pola_5_hari' then 12 end;
begin
  if not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa mencatat lembur' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = '42501';
  end if;
  if v_maks is null then raise exception 'Jenis hari lembur tidak dikenal' using errcode = '22023'; end if;
  if p_jam is null or p_jam < 0 or p_jam > v_maks then
    raise exception 'Lembur % paling lama % jam sehari (PP 35/2021)', replace(p_jenis, '_', ' '), v_maks using errcode = '22023';
  end if;
  if exists (select 1 from public.periode_gaji where perusahaan_id = v_pid and bulan = date_trunc('month', p_tanggal)::date and status = 'disetujui') then
    raise exception 'Gaji bulan ini sudah disetujui; lembur tidak bisa diubah lagi' using errcode = '55000';
  end if;
  -- Pasal 26 ayat (1): paling lama 18 jam seminggu untuk lembur di hari kerja (libur mingguan dan hari libur resmi tidak dihitung, ayat (2)).
  if p_jenis = 'hari_kerja' then
    select coalesce(sum(jam), 0) into v_minggu from public.lembur
      where orang_id = p_orang and jenis = 'hari_kerja' and tanggal <> p_tanggal
        and date_trunc('week', tanggal) = date_trunc('week', p_tanggal::timestamp);
    if v_minggu + p_jam > 18 then
      raise exception 'Lembur hari kerja minggu ini jadi % jam; paling lama 18 jam seminggu (PP 35/2021)', v_minggu + p_jam using errcode = '22023';
    end if;
  end if;
  insert into public.lembur (perusahaan_id, orang_id, tanggal, jenis, jam, catatan, dicatat_oleh)
  values (v_pid, p_orang, p_tanggal, p_jenis, p_jam, nullif(trim(p_catatan), ''), (select auth.uid()))
  on conflict (orang_id, tanggal) do update set jenis = excluded.jenis, jam = excluded.jam, catatan = excluded.catatan,
    dicatat_oleh = excluded.dicatat_oleh, diubah_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.catat_lembur(uuid, date, text, integer, text) from public, anon;
grant execute on function public.catat_lembur(uuid, date, text, integer, text) to authenticated;
