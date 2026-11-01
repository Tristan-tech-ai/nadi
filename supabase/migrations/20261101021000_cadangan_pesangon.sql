-- F4-09 Dana cadangan pesangon (docs/research/pesangon-f4-09.md, docs/design/cadangan-pesangon.md).
-- Aturan pesangon.pp35: tabel PP 35/2021 Pasal 40 ayat (2) (uang pesangon) dan ayat (3) (uang penghargaan masa kerja) sebagai
-- [batas masa kerja dalam tahun penuh, bulan upah], pengali rentang dari Pasal 43 ayat (1) (0,5 kali, efisiensi karena rugi) dan
-- Pasal 56 (1,75 kali, usia pensiun); dicek ke halaman PDF resmi 1 Nov 2026. Hitungan ada di apps/web/src/lib/gaji/pesangon.ts
-- (tabel contoh yang sama diuji vitest dan tes SQL); database hanya memberi bahan hitung dan menjaga siapa yang boleh melihat.
-- Angka per orang berasal dari data gaji rahasia, jadi hanya pemilik (app.peran_aktif() dari tabel anggota, bukan klaim JWT).

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan) values (
  'pesangon.pp35',
  '{"pesangon": [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]], "upmk": [[3,2],[6,3],[9,4],[12,5],[15,6],[18,7],[21,8],[24,10]], "pengali": {"rugi": 0.5, "pensiun": 1.75}}',
  date '2021-02-02',
  'PP 35/2021 Pasal 40 ayat (2) dan (3), Pasal 43 ayat (1), Pasal 56 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf); dasar upah pokok + tunjangan tetap Pasal 157 UU 13/2003 diubah UU 6/2023 (https://peraturan.bpk.go.id/Download/302681/UU%20Nomor%206%20Tahun%202023.pdf)',
  true,
  'Skenario dasar 1 kali untuk perencanaan kas. Belum final: jumlah sungguhan tergantung alasan PHK (Pasal 41-57) dan aturan yang berlaku saat itu (UU Pelindungan Ketenagakerjaan disahkan DPR 6 Okt 2026, teks belum terbit).'
);

-- Kolom id dibutuhkan app.catat_audit (baris_id).
create table public.cadangan_pesangon (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null unique references public.perusahaan(id) on delete cascade,
  saldo bigint not null default 0 check (saldo between 0 and 100000000000),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now()
);
alter table public.cadangan_pesangon enable row level security;
create policy cadangan_pesangon_baca on public.cadangan_pesangon for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) = 'pemilik');
grant select on public.cadangan_pesangon to authenticated;
create trigger audit_cadangan_pesangon after insert or update or delete on public.cadangan_pesangon for each row execute function app.catat_audit();

create or replace function public.cadangan_pesangon() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_hari date; a public.aturan_bertanggal;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat cadangan pesangon' using errcode = '42501';
  end if;
  v_hari := app.hari_ini(v_pid);
  select * into a from public.aturan_bertanggal
   where kunci = 'pesangon.pp35' and berlaku_dari <= v_hari and (berlaku_sampai is null or berlaku_sampai >= v_hari)
   order by berlaku_dari desc limit 1;
  return jsonb_build_object(
    'hari_ini', v_hari,
    'saldo', coalesce((select c.saldo from public.cadangan_pesangon c where c.perusahaan_id = v_pid), 0),
    'aturan', case when a.id is null then null
      else jsonb_build_object('nilai', a.nilai, 'sumber', a.sumber, 'berlaku_dari', a.berlaku_dari, 'terverifikasi', a.terverifikasi) end,
    'orang', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'nama', o.nama,
               'mulai', app.tanggal_teks(o.data ->> 'mulai'),
               'kontrak_selesai', nullif(btrim(o.data ->> 'kontrak_selesai'), ''),
               'pokok', case when jsonb_typeof(r.gaji -> 'pokok') = 'number' then (r.gaji -> 'pokok')::numeric end,
               'tunjangan_tetap', case when jsonb_typeof(r.gaji -> 'tunjangan_tetap') = 'number' then (r.gaji -> 'tunjangan_tetap')::numeric end)
             order by o.nama)
        from public.orang o left join public.orang_rahasia r on r.orang_id = o.id
       where o.perusahaan_id = v_pid and o.status = 'aktif' and 'karyawan' = any(o.jenis)), '[]'::jsonb)
  );
end $$;

create or replace function public.atur_saldo_pesangon(p_saldo bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengatur saldo cadangan pesangon' using errcode = '42501';
  end if;
  if p_saldo is null or p_saldo < 0 or p_saldo > 100000000000 then
    raise exception 'Isi saldo cadangan dalam rupiah, 0 atau lebih' using errcode = '22023';
  end if;
  insert into public.cadangan_pesangon (perusahaan_id, saldo, diubah_oleh) values (v_pid, p_saldo, auth.uid())
  on conflict (perusahaan_id) do update set saldo = excluded.saldo, diubah_oleh = excluded.diubah_oleh, diubah_at = now();
  return p_saldo;
end $$;

revoke all on function public.cadangan_pesangon(), public.atur_saldo_pesangon(bigint) from public, anon;
grant execute on function public.cadangan_pesangon(), public.atur_saldo_pesangon(bigint) to authenticated;
