-- M-23 dasbor wawasan HR dan bisnis (menutup TA-16, QO-08). Satu RPC untuk pemilik/admin yang menghitung angka dari tabel sumber:
-- orang aktif (karyawan/magang), masuk dari orang.data.mulai, keluar dari berhenti selesai, turnover 12 bulan = keluar / rata-rata
-- (aktif sekarang, aktif 12 bulan lalu = aktif - masuk + keluar), hadir dari kejadian absen.masuk (orang-hari), lembur dari tabel
-- lembur, biaya gaji dari periode gaji disetujui terakhir (hanya pemilik, data gaji rahasia), karyawan berisiko dari app.sinyal_beban
-- (hanya pemilik, sama dengan kartu Feed), penjualan dari laporan_keuangan (M-01) bulan berjalan, invoice terbuka dari tabel invoice.

create or replace function public.insight_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), ''); v_hari date; v_awal date; v_lalu date;
  aktif int; masuk int; keluar int; hadir_hari int; hadir_bulan int; lembur_jam int; gaji jsonb; risiko jsonb; jual jsonb; terbuka jsonb;
begin
  if v_pid is null or v_peran not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat wawasan usaha' using errcode = '42501';
  end if;
  v_hari := app.hari_ini(v_pid);
  v_awal := date_trunc('month', v_hari)::date;
  v_lalu := v_hari - 365;
  select count(*) into aktif from public.orang o where o.perusahaan_id = v_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang'];
  select count(*) into masuk from public.orang o where o.perusahaan_id = v_pid and o.jenis && array['karyawan', 'magang']
     and o.data ->> 'mulai' ~ '^\d{4}-\d{2}-\d{2}$' and (o.data ->> 'mulai')::date > v_lalu and (o.data ->> 'mulai')::date <= v_hari;
  select count(*) into keluar from public.berhenti b where b.perusahaan_id = v_pid and b.status = 'selesai' and b.tanggal_efektif > v_lalu and b.tanggal_efektif <= v_hari;
  select count(distinct k.orang_id) into hadir_hari from public.kejadian k
   where k.perusahaan_id = v_pid and k.jenis = 'absen.masuk' and k.terjadi_at >= ((v_hari)::timestamp at time zone app.zona(v_pid)) and k.terjadi_at < ((v_hari + 1)::timestamp at time zone app.zona(v_pid));
  select count(*) into hadir_bulan from (select distinct k.orang_id, (k.terjadi_at at time zone app.zona(v_pid))::date from public.kejadian k
   where k.perusahaan_id = v_pid and k.jenis = 'absen.masuk' and k.terjadi_at >= ((v_awal)::timestamp at time zone app.zona(v_pid)) and k.terjadi_at < ((v_hari + 1)::timestamp at time zone app.zona(v_pid))) x;
  select coalesce(sum(l.jam), 0) into lembur_jam from public.lembur l where l.perusahaan_id = v_pid and l.tanggal >= v_awal and l.tanggal <= v_hari;
  if v_peran = 'pemilik' then
    select jsonb_build_object('bulan', to_char(p.bulan, 'YYYY-MM'), 'bruto', coalesce(sum(s.bruto), 0), 'neto', coalesce(sum(s.neto), 0), 'orang', count(s.id))
      into gaji from (select pg.* from public.periode_gaji pg where pg.perusahaan_id = v_pid and pg.status = 'disetujui' order by pg.bulan desc limit 1) p
      left join public.slip_gaji s on s.periode_id = p.id group by p.bulan;
    select coalesce(jsonb_agg(jsonb_build_object('orang', s.orang_id, 'nama', s.nama, 'berat', s.berat, 'lintas', s.lintas, 'sakit', s.sakit) order by s.nama), '[]')
      into risiko from app.sinyal_beban(v_pid, date_trunc('week', v_hari)::date) s where s.nyala;
  end if;
  jual := public.laporan_keuangan(v_awal, v_hari) -> 'laba_rugi';
  select jsonb_build_object('jumlah', count(*), 'nilai', coalesce(sum(i.total), 0),
      'lewat', count(*) filter (where i.jatuh_tempo < v_hari), 'nilai_lewat', coalesce(sum(i.total) filter (where i.jatuh_tempo < v_hari), 0))
    into terbuka from public.invoice i where i.perusahaan_id = v_pid and i.status = 'terbit';
  return jsonb_build_object(
    'hari', v_hari, 'bulan', to_char(v_awal, 'YYYY-MM'),
    'hr', jsonb_build_object('aktif', aktif, 'masuk_12', masuk, 'keluar_12', keluar,
      'turnover_persen', case when (aktif + greatest(aktif - masuk + keluar, 0)) > 0 then round(100.0 * keluar / ((aktif + greatest(aktif - masuk + keluar, 0)) / 2.0), 1) end,
      'hadir_hari_ini', hadir_hari, 'hadir_bulan', hadir_bulan, 'lembur_jam_bulan', lembur_jam, 'gaji', gaji, 'berisiko', risiko),
    'bisnis', jsonb_build_object('pendapatan_bulan', coalesce((jual ->> 'pendapatan')::bigint, 0), 'beban_bulan', coalesce((jual ->> 'beban')::bigint, 0),
      'laba_bulan', coalesce((jual ->> 'laba')::bigint, 0), 'invoice_terbuka', terbuka));
end $$;

revoke all on function public.insight_dashboard() from public, anon;
grant execute on function public.insight_dashboard() to authenticated;
