-- F4-09B (docs/research/pesangon-f4-09.md): cadangan pesangon untuk karyawan kontrak dan iuran dana pensiun pengusaha.
-- 1. Aturan kompensasi.pkwt dari PP 35/2021 (teks PDF resmi peraturan.bpk.go.id/Download/154582, dibaca 4 Nov 2026):
--    Pasal 15 ayat (3) minimal masa kerja 1 bulan terus menerus; Pasal 16 ayat (1) masa kerja / 12 x 1 bulan upah, ayat (2) upah
--    pokok + tunjangan tetap, ayat (6) usaha mikro dan kecil berdasarkan kesepakatan; Pasal 17 berakhir lebih awal dihitung sampai
--    jangka waktu yang telah dilaksanakan. Hitungan di apps/web/src/lib/gaji/pesangon.ts.
-- 2. public.iuran_pensiun: iuran dana pensiun yang sudah dibayar usaha per orang (Pasal 58; bukan BPJS JP), hanya pemilik.
-- 3. cadangan_pesangon() kini juga mengirim iuran_pensiun per orang dan aturan kompensasi.

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select 'kompensasi.pkwt', '{"pembagi_bulan": 12, "minimal_bulan": 1, "mikro_kecil_kesepakatan": true}'::jsonb, date '2021-02-02',
       'PP 35/2021 Pasal 15 ayat (3), Pasal 16 ayat (1), (2), (6), Pasal 17 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf); dibaca 4 Nov 2026',
       true,
       'Uang kompensasi PKWT = masa kerja / 12 x 1 bulan upah (pokok + tunjangan tetap). Untuk usaha mikro dan kecil besarnya berdasarkan kesepakatan (Pasal 16 ayat (6)); angka Nadi acuan.'
 where not exists (select 1 from public.aturan_bertanggal where kunci = 'kompensasi.pkwt');

create table public.iuran_pensiun (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null unique references public.orang(id) on delete cascade,
  nilai bigint not null default 0 check (nilai between 0 and 100000000000),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now()
);
create index on public.iuran_pensiun (perusahaan_id);
alter table public.iuran_pensiun enable row level security;
create policy iuran_pensiun_baca on public.iuran_pensiun for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) = 'pemilik');
grant select on public.iuran_pensiun to authenticated;
create trigger audit_iuran_pensiun after insert or update or delete on public.iuran_pensiun for each row execute function app.catat_audit();

create or replace function public.atur_iuran_pensiun(p_orang uuid, p_nilai bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengisi iuran dana pensiun' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orang o where o.id = p_orang and o.perusahaan_id = v_pid) then
    raise exception 'Orang tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_nilai is null or p_nilai < 0 or p_nilai > 100000000000 then
    raise exception 'Isi iuran dana pensiun dalam rupiah, 0 atau lebih' using errcode = '22023';
  end if;
  insert into public.iuran_pensiun (perusahaan_id, orang_id, nilai, diubah_oleh) values (v_pid, p_orang, p_nilai, auth.uid())
  on conflict (orang_id) do update set nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_at = now();
  return p_nilai;
end $$;
revoke all on function public.atur_iuran_pensiun(uuid, bigint) from public, anon;
grant execute on function public.atur_iuran_pensiun(uuid, bigint) to authenticated;

create or replace function public.cadangan_pesangon() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_hari date; a public.aturan_bertanggal; k public.aturan_bertanggal;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat cadangan pesangon' using errcode = '42501';
  end if;
  v_hari := app.hari_ini(v_pid);
  select * into a from public.aturan_bertanggal
   where kunci = 'pesangon.pp35' and berlaku_dari <= v_hari and (berlaku_sampai is null or berlaku_sampai >= v_hari)
   order by berlaku_dari desc limit 1;
  select * into k from public.aturan_bertanggal
   where kunci = 'kompensasi.pkwt' and terverifikasi and berlaku_dari <= v_hari and (berlaku_sampai is null or berlaku_sampai >= v_hari)
   order by berlaku_dari desc limit 1;
  return jsonb_build_object(
    'hari_ini', v_hari,
    'saldo', coalesce((select c.saldo from public.cadangan_pesangon c where c.perusahaan_id = v_pid), 0),
    'aturan', case when a.id is null then null
      else jsonb_build_object('nilai', a.nilai, 'sumber', a.sumber, 'berlaku_dari', a.berlaku_dari, 'terverifikasi', a.terverifikasi) end,
    'kompensasi', case when k.id is null then null else jsonb_build_object('nilai', k.nilai, 'sumber', k.sumber) end,
    'orang', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'nama', o.nama,
               'mulai', app.tanggal_teks(o.data ->> 'mulai'),
               'kontrak_selesai', nullif(btrim(o.data ->> 'kontrak_selesai'), ''),
               'pokok', case when jsonb_typeof(r.gaji -> 'pokok') = 'number' then (r.gaji -> 'pokok')::numeric end,
               'tunjangan_tetap', case when jsonb_typeof(r.gaji -> 'tunjangan_tetap') = 'number' then (r.gaji -> 'tunjangan_tetap')::numeric end,
               'iuran_pensiun', ip.nilai)
             order by o.nama)
        from public.orang o left join public.orang_rahasia r on r.orang_id = o.id
        left join public.iuran_pensiun ip on ip.orang_id = o.id
       where o.perusahaan_id = v_pid and o.status = 'aktif' and 'karyawan' = any(o.jenis)), '[]'::jsonb)
  );
end $$;
