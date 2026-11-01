-- F2-07 Lingkaran belajar rekrutmen (docs/research/lingkaran-rekrut.md, tes supabase/tests/lingkaran_rekrut.test.sql).
-- 1. lamaran.orang_id: pelamar berstatus diterima dicatat sebagai karyawan lewat jadikan_karyawan (tanggal mulai di orang.data.mulai,
--    topi lowongan dipasang 100%). Idempoten: lamaran yang sudah tertaut mengembalikan orangnya.
-- 2. lingkaran_rekrut: per lamaran tertaut yang sudah bekerja >= 90 hari, sinyal seleksi (skor rubrik per pertanyaan wawancara,
--    uji kerja mentah untuk dinilai ulang di TypeScript) dan kinerja di jendela hari ke-90 sampai ke-180 (dipotong hari ini) di zona
--    usaha: poin kerja selesai per minggu dan persen tepat waktu dari kerja bertenggat. Tanpa nama atau telepon. Pemilik/admin.

alter table public.lamaran add column orang_id uuid references public.orang(id) on delete set null;
create index on public.lamaran (orang_id);

create or replace function public.jadikan_karyawan(p_lamaran uuid, p_mulai date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); la public.lamaran; v_topi uuid; v_orang uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencatat karyawan baru' using errcode = '42501';
  end if;
  select * into la from public.lamaran where id = p_lamaran and perusahaan_id = v_pid for update;
  if not found then
    raise exception 'Lamaran tidak ditemukan di usahamu' using errcode = 'P0002';
  end if;
  if la.orang_id is not null then
    return la.orang_id;
  end if;
  if la.tahap is distinct from 'diterima' then
    raise exception 'Tandai pelamar diterima dulu sebelum dicatat sebagai karyawan' using errcode = '22023';
  end if;
  if p_mulai is null or p_mulai > app.hari_ini(v_pid) + 90 then
    raise exception 'Isi tanggal mulai kerja (paling lambat 90 hari dari sekarang)' using errcode = '22023';
  end if;
  insert into public.orang (perusahaan_id, nama, telepon, jenis, status, data)
  values (v_pid, la.nama, la.telepon, '{karyawan}', 'aktif',
          jsonb_build_object('mulai', to_char(p_mulai, 'YYYY-MM-DD'), 'sumber', 'lamaran', 'lamaran_id', la.id))
  returning id into v_orang;
  select l.topi_id into v_topi from public.lowongan l where l.id = la.lowongan_id;
  if v_topi is not null then
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai) values (v_pid, v_orang, v_topi, 100, p_mulai);
  end if;
  update public.lamaran set orang_id = v_orang where id = la.id;
  return v_orang;
end $$;

create or replace function public.lingkaran_rekrut() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_hari date; v_zona text;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat laporan rekrutmen' using errcode = '42501';
  end if;
  v_hari := app.hari_ini(v_pid);
  v_zona := app.zona(v_pid);
  return jsonb_build_object(
    'hari_ini', v_hari,
    'belum_genap', (select count(*) from public.lamaran la join public.orang o on o.id = la.orang_id
                     where la.perusahaan_id = v_pid
                       and (app.tanggal_teks(o.data ->> 'mulai') is null or app.tanggal_teks(o.data ->> 'mulai') > v_hari - 90)),
    'baris', coalesce((
      select jsonb_agg(jsonb_build_object(
               'lamaran', la.id,
               'minggu', round((w.akhir - w.awal)::numeric / 7, 1),
               'poin_per_minggu', round(coalesce(k.poin, 0) / greatest((w.akhir - w.awal)::numeric / 7, 1), 2),
               'persen_tepat', case when k.bertenggat > 0 then round(100.0 * k.tepat / k.bertenggat, 1) end,
               'wawancara', coalesce((select jsonb_agg(jsonb_build_object('pertanyaan', j.pertanyaan, 'skor', (j.nilai ->> 'skor')::numeric) order by j.urutan)
                                        from public.jawaban_wawancara j where j.lamaran_id = la.id and j.nilai ? 'skor'), '[]'::jsonb),
               'uji', (select jsonb_build_object('topi_kode', u.topi_kode, 'benih', u.benih, 'jawaban', u.jawaban)
                         from public.uji_lamaran u where u.lamaran_id = la.id and u.jenis = 'kerja' and u.jawaban is not null limit 1))
             order by la.dibuat_at)
        from public.lamaran la
        join public.orang o on o.id = la.orang_id
        cross join lateral (select app.tanggal_teks(o.data ->> 'mulai') as mulai) m
        cross join lateral (select m.mulai + 90 as awal, least(m.mulai + 180, v_hari) as akhir) w
        cross join lateral (
          select sum(kr.poin_beban) as poin,
                 count(*) filter (where kr.tenggat is not null) as bertenggat,
                 count(*) filter (where kr.tenggat is not null and kr.selesai_at <= kr.tenggat) as tepat
            from public.kerja kr
           where kr.perusahaan_id = v_pid and kr.pelaksana_id = o.id and kr.status = 'selesai'
             and (kr.selesai_at at time zone v_zona)::date >= w.awal and (kr.selesai_at at time zone v_zona)::date < w.akhir) k
       where la.perusahaan_id = v_pid and m.mulai is not null and m.mulai <= v_hari - 90), '[]'::jsonb)
  );
end $$;

revoke all on function public.jadikan_karyawan(uuid, date), public.lingkaran_rekrut() from public, anon;
grant execute on function public.jadikan_karyawan(uuid, date), public.lingkaran_rekrut() to authenticated;
