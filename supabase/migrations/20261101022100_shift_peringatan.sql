-- F3-06 lanjutan: di simpan_shift, text[] || 'kode' ditafsir PostgreSQL sebagai gabungan dengan literal larik, sehingga shift yang
-- memicu peringatan gagal disimpan (22P02 malformed array literal). Ditemukan tes shift; diganti array_append.
create or replace function public.simpan_shift(p_orang uuid, p_tanggal date, p_mulai time, p_selesai time, p_istirahat integer, p_topi uuid, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_zona text; s public.shift; v_mulai timestamptz; v_selesai timestamptz; v_bruto integer; l record;
  v_lembur_hari integer := 0; v_peringatan text[] := '{}'; v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun jadwal' using errcode = '42501';
  end if;
  select * into s from public.shift where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then
    return jsonb_build_object('id', s.id, 'sudah', true, 'peringatan', '[]'::jsonb);
  end if;
  if not exists (select 1 from public.orang o where o.id = p_orang and o.perusahaan_id = v_pid and o.status = 'aktif') then
    raise exception 'Orang aktif tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if p_tanggal is null or p_mulai is null or p_selesai is null or p_istirahat is null or p_istirahat not between 0 and 240 then
    raise exception 'Isi tanggal, jam mulai, jam selesai, dan istirahat (0 sampai 240 menit)' using errcode = '22023';
  end if;
  v_zona := app.zona(v_pid);
  v_mulai := (p_tanggal + p_mulai) at time zone v_zona;
  v_selesai := ((case when p_selesai > p_mulai then p_tanggal else p_tanggal + 1 end) + p_selesai) at time zone v_zona;
  v_bruto := (extract(epoch from v_selesai - v_mulai) / 60)::int;
  if v_bruto > 960 or v_bruto - p_istirahat <= 0 then
    raise exception 'Shift paling lama 16 jam dan harus lebih panjang dari istirahatnya' using errcode = '22023';
  end if;
  if exists (select 1 from public.shift x where x.orang_id = p_orang and x.status = 'aktif'
               and tstzrange(x.mulai_at, x.selesai_at) && tstzrange(v_mulai, v_selesai)) then
    raise exception 'Bertabrakan dengan shift lain orang ini' using errcode = '23P01';
  end if;
  insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, topi_id, kunci_klien, dibuat_oleh)
  values (v_pid, p_orang, p_tanggal, p_mulai, p_selesai, p_istirahat, v_mulai, v_selesai, p_topi, p_kunci, auth.uid())
  returning id into v_id;
  for l in select * from app.lembur_minggu(v_pid, p_orang, p_tanggal) loop
    if l.lembur_hari > 240 then
      raise exception 'Lembur paling lama 4 jam sehari (PP 35/2021 Pasal 26). Hari ini jadi % jam.', round(l.lembur_hari / 60.0, 1) using errcode = '54000';
    end if;
    if l.lembur_minggu > 1080 then
      raise exception 'Lembur paling lama 18 jam seminggu (PP 35/2021 Pasal 26). Minggu ini jadi % jam.', round(l.lembur_minggu / 60.0, 1) using errcode = '54000';
    end if;
    if l.hari = p_tanggal then v_lembur_hari := l.lembur_hari; end if;
    if l.hari_kerja > (case app.pola_kerja(v_pid) when '5_hari' then 5 else 6 end) and not 'kurang_libur' = any(v_peringatan) then
      v_peringatan := array_append(v_peringatan, 'kurang_libur');
    end if;
    if l.total_minggu > 2400 and not 'lewat_40_minggu' = any(v_peringatan) then
      v_peringatan := array_append(v_peringatan, 'lewat_40_minggu');
    end if;
  end loop;
  if v_bruto > 240 and p_istirahat < 30 then
    v_peringatan := array_append(v_peringatan, 'tanpa_istirahat');
  end if;
  if v_lembur_hari > 0 then
    insert into public.persetujuan_lembur (perusahaan_id, shift_id, orang_id, menit_lembur)
    values (v_pid, v_id, p_orang, least(v_lembur_hari, v_bruto - p_istirahat));
  end if;
  return jsonb_build_object('id', v_id, 'sudah', false, 'peringatan', to_jsonb(v_peringatan), 'lembur_menit', v_lembur_hari);
end $$;
