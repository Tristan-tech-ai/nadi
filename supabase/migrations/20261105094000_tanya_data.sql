-- M-22 tanya data (menutup JU-29, LA-11). Pertanyaan bahasa sehari-hari diurai di aplikasi menjadi satu niat dari daftar tetap
-- plus rentang tanggal (src/lib/tanya/urai.ts, tanpa model, tanpa SQL bebas), lalu RPC ask_data menghitung jawabannya dari sumber
-- yang sama dengan layar aslinya (laporan_keuangan dan umur_piutang M-01, tabel invoice, tagihan_beli, orang, kejadian absen,
-- lembur, slip gaji, stok) dan mengembalikan tautan ke layar sumber. Hanya pemilik, admin, akuntan; gaji hanya pemilik.
-- Kuota 200 pertanyaan per usaha per hari, tercatat di ask_log (tanpa isi pertanyaan, hanya niat).

create table public.ask_log (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  user_id uuid,
  niat text not null,
  at timestamptz not null default now()
);
create index ask_log_usaha on public.ask_log (perusahaan_id, at desc);
alter table public.ask_log enable row level security;
create policy ask_log_baca on public.ask_log for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.ask_log to authenticated;

create or replace function public.ask_data(p_niat text, p_dari date default null, p_sampai date default null, p_cari text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), ''); v_hari date; d date; s date; z text;
  j jsonb; v_nilai numeric; v_jumlah bigint; v_satuan text; v_sumber text; v_rinci jsonb;
begin
  if v_pid is null or v_peran not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Tanya data hanya untuk pemilik, admin, dan akuntan' using errcode = '42501';
  end if;
  if p_niat not in ('pendapatan', 'beban', 'laba', 'kas', 'piutang', 'piutang_lewat', 'hutang', 'invoice_terbit', 'karyawan', 'hadir', 'lembur', 'gaji', 'stok') then
    raise exception 'Pertanyaan ini belum bisa dijawab' using errcode = '22023';
  end if;
  if p_niat = 'gaji' and v_peran <> 'pemilik' then raise exception 'Data gaji hanya untuk pemilik' using errcode = '42501'; end if;
  v_hari := app.hari_ini(v_pid); z := app.zona(v_pid);
  if (select count(*) from public.ask_log l where l.perusahaan_id = v_pid and l.at >= (v_hari::timestamp at time zone z)) >= 200 then
    raise exception 'Kuota 200 pertanyaan hari ini sudah habis. Coba lagi besok.' using errcode = '22023';
  end if;
  s := least(coalesce(p_sampai, v_hari), v_hari);
  d := coalesce(p_dari, date_trunc('month', s)::date);
  if d > s then raise exception 'Rentang tanggal tidak sah' using errcode = '22023'; end if;
  insert into public.ask_log (perusahaan_id, user_id, niat) values (v_pid, auth.uid(), p_niat);

  if p_niat in ('pendapatan', 'beban', 'laba') then
    j := public.laporan_keuangan(d, s) -> 'laba_rugi';
    v_nilai := (j ->> p_niat)::numeric; v_satuan := 'rupiah';
    v_sumber := '/app/buku?jenis=laba_rugi&dari=' || d || '&sampai=' || s;
  elsif p_niat = 'kas' then
    d := s;
    v_nilai := (public.laporan_keuangan(s, s) -> 'arus_kas' ->> 'kas_akhir')::numeric; v_satuan := 'rupiah'; v_sumber := '/app/kas';
  elsif p_niat in ('piutang', 'piutang_lewat') then
    d := s;
    j := public.umur_piutang(s) -> 'kelompok';
    v_nilai := case when p_niat = 'piutang' then (j ->> 'total')::numeric
                    else (j ->> 'h1_30')::numeric + (j ->> 'h31_60')::numeric + (j ->> 'h61_90')::numeric + (j ->> 'lebih_90')::numeric end;
    v_satuan := 'rupiah'; v_sumber := '/app/buku?jenis=umur_piutang&sampai=' || s;
  elsif p_niat = 'hutang' then
    d := s;
    select coalesce(sum(t.total - t.terbayar - t.dikurangi), 0), count(*) into v_nilai, v_jumlah from public.tagihan_beli t where t.perusahaan_id = v_pid and t.status = 'terbuka';
    v_satuan := 'rupiah'; v_sumber := '/app/beli';
  elsif p_niat = 'invoice_terbit' then
    select coalesce(sum(i.total), 0), count(*) into v_nilai, v_jumlah from public.invoice i where i.perusahaan_id = v_pid and i.status <> 'batal' and i.tanggal between d and s;
    v_satuan := 'rupiah'; v_sumber := '/app/invoice';
  elsif p_niat = 'karyawan' then
    d := s;
    select count(*) into v_nilai from public.orang o where o.perusahaan_id = v_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang'];
    v_satuan := 'orang'; v_sumber := '/app/orang';
  elsif p_niat = 'hadir' then
    select count(distinct k.orang_id), count(*) into v_nilai, v_jumlah from (select distinct k.orang_id, (k.terjadi_at at time zone z)::date hari from public.kejadian k
      where k.perusahaan_id = v_pid and k.jenis = 'absen.masuk' and k.terjadi_at >= (d::timestamp at time zone z) and k.terjadi_at < ((s + 1)::timestamp at time zone z)) k;
    v_satuan := 'orang'; v_sumber := '/app/wawasan';
  elsif p_niat = 'lembur' then
    select coalesce(sum(l.jam), 0) into v_nilai from public.lembur l where l.perusahaan_id = v_pid and l.tanggal between d and s;
    v_satuan := 'jam'; v_sumber := '/app/wawasan';
  elsif p_niat = 'gaji' then
    select coalesce(sum(sg.bruto), 0), count(sg.id) into v_nilai, v_jumlah from public.periode_gaji pg join public.slip_gaji sg on sg.periode_id = pg.id
     where pg.perusahaan_id = v_pid and pg.status = 'disetujui' and pg.bulan between date_trunc('month', d)::date and s;
    v_satuan := 'rupiah'; v_sumber := '/app/gaji';
  elsif p_niat = 'stok' then
    d := s;
    if length(btrim(coalesce(p_cari, ''))) < 2 then raise exception 'Sebut nama barangnya' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('nama', x.nama, 'kode', x.kode, 'satuan', x.satuan, 'jumlah', x.jumlah) order by x.urut, x.nama), '[]') into v_rinci
      from (select p.nama, p.kode, p.satuan, coalesce((select sum(st.jumlah) from public.stok st where st.produk_id = p.id), 0) jumlah,
                   case when lower(p.nama) = lower(btrim(p_cari)) or lower(p.kode) = lower(btrim(p_cari)) then 0 else 1 end urut
              from public.produk p where p.perusahaan_id = v_pid and p.aktif
               and (p.nama ilike '%' || replace(replace(btrim(p_cari), '%', ''), '_', '') || '%' or lower(p.kode) = lower(btrim(p_cari)))
             order by urut, p.nama limit 5) x;
    v_nilai := (v_rinci -> 0 ->> 'jumlah')::numeric; v_satuan := coalesce(v_rinci -> 0 ->> 'satuan', 'satuan'); v_sumber := '/app/barang';
  end if;
  return jsonb_build_object('niat', p_niat, 'nilai', v_nilai, 'jumlah', v_jumlah, 'satuan', v_satuan, 'dari', d, 'sampai', s, 'sumber', v_sumber, 'rincian', v_rinci);
end $$;

revoke all on function public.ask_data(text, date, date, text) from public, anon;
grant execute on function public.ask_data(text, date, date, text) to authenticated;
