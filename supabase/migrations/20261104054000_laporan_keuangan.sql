-- M-01 Laporan keuangan baku dari ledger (docs/research/mekari/rencana.md, menutup JU-01, JU-02, JU-18; tes
-- supabase/tests/laporan_keuangan.test.sql). Semua angka dihitung dari public.jurnal_baris, satu sumber.
-- Penggolongan memakai kode akun bagan Nadi:
--   - kas dan bank = akun aset berkode 1-1xx;
--   - aset 1-5xx ke atas (peralatan, aset tetap) = arus kas investasi;
--   - kewajiban 2-5xx ke atas (pinjaman jangka panjang) dan modal 3-xxx = pendanaan;
--   - sisanya operasi.
-- Neraca memasukkan laba yang belum ditutup sebagai baris modal, sehingga aset = kewajiban + modal di tanggal mana pun.
-- Laba rugi dan arus kas mengabaikan jurnal tutup buku (sumber 'tutup_buku'). Jurnal itu hanya memindahkan saldo
-- pendapatan/beban ke laba ditahan dan tidak menyentuh kas.

create or replace function app.wajib_buku(p_tulis boolean default false) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  if v_pid is null or v_peran not in ('pemilik', 'admin', 'akuntan') or (p_tulis and v_peran not in ('pemilik', 'akuntan')) then
    raise exception '%', case when p_tulis then 'Hanya pemilik atau akuntan yang mengubah saldo awal atau menutup buku'
                              else 'Laporan keuangan hanya untuk pemilik, admin, atau akuntan' end using errcode = '42501';
  end if;
  return v_pid;
end $$;

-- Saldo per akun dalam arah golongannya (aset dan beban: debit dikurangi kredit; kewajiban, modal, pendapatan: sebaliknya),
-- sehingga akun lawan (prive, akumulasi penyusutan) bernilai negatif dan jumlah per golongan benar. Kolom: awal (sebelum p_dari), mutasi debit/kredit di [p_dari, p_sampai], akhir.
create or replace function app.saldo_akun(p_pid uuid, p_dari date, p_sampai date, p_tanpa_tutup boolean default false)
returns table (kode text, nama text, golongan text, saldo_normal text, awal bigint, debit bigint, kredit bigint, akhir bigint)
language sql stable security definer set search_path = '' as $$
  with m as (
    select b.akun_id,
           coalesce(sum(b.debit - b.kredit) filter (where j.tanggal < p_dari), 0) as net_awal,
           coalesce(sum(b.debit) filter (where j.tanggal between p_dari and p_sampai), 0) as d,
           coalesce(sum(b.kredit) filter (where j.tanggal between p_dari and p_sampai), 0) as k
      from public.jurnal_baris b
      join public.jurnal j on j.id = b.jurnal_id and j.perusahaan_id = p_pid
     where b.perusahaan_id = p_pid and j.tanggal <= p_sampai and not (p_tanpa_tutup and j.sumber = 'tutup_buku')
     group by b.akun_id
  )
  select a.kode, a.nama, a.golongan, a.saldo_normal,
         (case when a.golongan in ('aset', 'beban') then 1 else -1 end * coalesce(m.net_awal, 0))::bigint,
         coalesce(m.d, 0)::bigint, coalesce(m.k, 0)::bigint,
         (case when a.golongan in ('aset', 'beban') then 1 else -1 end * (coalesce(m.net_awal, 0) + coalesce(m.d, 0) - coalesce(m.k, 0)))::bigint
    from public.akun a left join m on m.akun_id = a.id
   where a.perusahaan_id = p_pid and (a.aktif or m.akun_id is not null)
   order by a.kode
$$;

create or replace function public.laporan_keuangan(p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_buku();
  v_akun jsonb; v_nr jsonb; v_lr jsonb; v_ak jsonb;
  aset bigint; kew bigint; modal bigint; laba_tutup bigint; pend bigint; beban bigint; laba bigint;
  kas_awal bigint; kas_akhir bigint; operasi bigint; investasi bigint; pendanaan bigint;
begin
  if p_dari is null or p_sampai is null or p_dari > p_sampai then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  if p_sampai - p_dari > 3700 then
    raise exception 'Rentang paling lama 10 tahun' using errcode = '22023';
  end if;
  -- Neraca per p_sampai (semua jurnal).
  select coalesce(sum(akhir) filter (where golongan = 'aset'), 0), coalesce(sum(akhir) filter (where golongan = 'kewajiban'), 0),
         coalesce(sum(akhir) filter (where golongan = 'modal'), 0),
         coalesce(sum(akhir) filter (where golongan = 'pendapatan'), 0) - coalesce(sum(akhir) filter (where golongan = 'beban'), 0),
         jsonb_agg(jsonb_build_object('kode', kode, 'nama', nama, 'golongan', golongan, 'saldo', akhir) order by kode)
           filter (where golongan in ('aset', 'kewajiban', 'modal') and akhir <> 0)
    into aset, kew, modal, laba_tutup, v_nr
    from app.saldo_akun(v_pid, p_dari, p_sampai);
  -- Laba rugi dan arus kas dalam rentang (tanpa jurnal tutup buku).
  with s as (select * from app.saldo_akun(v_pid, p_dari, p_sampai, true)),
  g as (select s.*, case when s.golongan in ('aset', 'beban') then s.debit - s.kredit else s.kredit - s.debit end as gerak from s)
  select coalesce(sum(gerak) filter (where golongan = 'pendapatan'), 0), coalesce(sum(gerak) filter (where golongan = 'beban'), 0),
         jsonb_agg(jsonb_build_object('kode', kode, 'nama', nama, 'golongan', golongan, 'nilai', gerak) order by kode)
           filter (where golongan in ('pendapatan', 'beban') and gerak <> 0),
         coalesce(sum(awal) filter (where golongan = 'aset' and kode like '1-1%'), 0),
         coalesce(sum(akhir) filter (where golongan = 'aset' and kode like '1-1%'), 0),
         -- perubahan sumber kas: kenaikan kewajiban/modal menambah kas, kenaikan aset non-kas mengurangi kas
         coalesce(sum(-gerak) filter (where golongan = 'aset' and kode not like '1-1%' and kode < '1-5'), 0)
           + coalesce(sum(gerak) filter (where golongan = 'kewajiban' and kode < '2-5'), 0),
         coalesce(sum(-gerak) filter (where golongan = 'aset' and kode >= '1-5'), 0),
         coalesce(sum(gerak) filter (where golongan = 'kewajiban' and kode >= '2-5'), 0)
           + coalesce(sum(gerak) filter (where golongan = 'modal'), 0)
    into pend, beban, v_lr, kas_awal, kas_akhir, operasi, investasi, pendanaan
    from g;
  laba := pend - beban;
  operasi := operasi + laba;
  select jsonb_agg(jsonb_build_object('kode', kode, 'nama', nama, 'golongan', golongan, 'saldo_normal', saldo_normal,
           'awal', awal, 'debit', debit, 'kredit', kredit, 'akhir', akhir) order by kode)
    into v_akun from app.saldo_akun(v_pid, p_dari, p_sampai) where awal <> 0 or debit <> 0 or kredit <> 0 or akhir <> 0;
  return jsonb_build_object(
    'dari', p_dari, 'sampai', p_sampai,
    'neraca', jsonb_build_object('baris', coalesce(v_nr, '[]'), 'aset', aset, 'kewajiban', kew, 'modal', modal,
      'laba_belum_ditutup', laba_tutup, 'seimbang', aset = kew + modal + laba_tutup),
    'laba_rugi', jsonb_build_object('baris', coalesce(v_lr, '[]'), 'pendapatan', pend, 'beban', beban, 'laba', laba),
    'arus_kas', jsonb_build_object('laba', laba, 'operasi', operasi, 'investasi', investasi, 'pendanaan', pendanaan,
      'kas_awal', kas_awal, 'kas_akhir', kas_akhir, 'cocok', kas_awal + operasi + investasi + pendanaan = kas_akhir),
    'neraca_saldo', coalesce(v_akun, '[]'));
end $$;

create or replace function public.buku_besar(p_kode text, p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); a public.akun; v_awal bigint; v_baris jsonb; v_tanda int;
begin
  select * into a from public.akun where perusahaan_id = v_pid and kode = p_kode;
  if not found then
    raise exception 'Akun % tidak ada', p_kode using errcode = 'P0002';
  end if;
  if p_dari is null or p_sampai is null or p_dari > p_sampai then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  v_tanda := case when a.saldo_normal = 'debit' then 1 else -1 end;
  select coalesce(sum(b.debit - b.kredit), 0) * v_tanda into v_awal
    from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id
   where b.perusahaan_id = v_pid and b.akun_id = a.id and j.tanggal < p_dari;
  select jsonb_agg(jsonb_build_object('tanggal', x.tanggal, 'keterangan', x.keterangan, 'sumber', x.sumber, 'jurnal', x.jurnal_id,
           'debit', x.debit, 'kredit', x.kredit, 'saldo', v_awal + x.jalan) order by x.tanggal, x.dibuat_at, x.id)
    into v_baris
    from (select j.tanggal, j.keterangan, j.sumber, j.dibuat_at, b.id, b.jurnal_id, b.debit, b.kredit,
                 sum((b.debit - b.kredit) * v_tanda) over (order by j.tanggal, j.dibuat_at, b.id) as jalan
            from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id
           where b.perusahaan_id = v_pid and b.akun_id = a.id and j.tanggal between p_dari and p_sampai
           order by j.tanggal, j.dibuat_at, b.id limit 2000) x;
  return jsonb_build_object('kode', a.kode, 'nama', a.nama, 'saldo_normal', a.saldo_normal, 'awal', v_awal,
    'baris', coalesce(v_baris, '[]'), 'akhir', v_awal + coalesce((select sum((e ->> 'debit')::bigint - (e ->> 'kredit')::bigint)
      from jsonb_array_elements(coalesce(v_baris, '[]')) e), 0) * v_tanda);
end $$;

-- Umur tagihan belum dibayar (invoice rupiah berstatus terbit) per tanggal.
create or replace function public.umur_piutang(p_per date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); v_baris jsonb; v_kel jsonb;
begin
  with b as (
    select i.nomor, i.pelanggan, i.total, i.tanggal, i.jatuh_tempo, (p_per - i.jatuh_tempo) as hari,
           case when p_per <= i.jatuh_tempo then 'belum' when p_per - i.jatuh_tempo <= 30 then 'h1_30'
                when p_per - i.jatuh_tempo <= 60 then 'h31_60' when p_per - i.jatuh_tempo <= 90 then 'h61_90' else 'lebih_90' end as kelompok
      from public.invoice i
     where i.perusahaan_id = v_pid and i.status = 'terbit' and i.tanggal <= p_per
  )
  select jsonb_agg(jsonb_build_object('nomor', nomor, 'pelanggan', pelanggan, 'total', total, 'tanggal', tanggal,
           'jatuh_tempo', jatuh_tempo, 'hari', hari, 'kelompok', kelompok) order by jatuh_tempo, nomor),
         jsonb_build_object('belum', coalesce(sum(total) filter (where kelompok = 'belum'), 0),
           'h1_30', coalesce(sum(total) filter (where kelompok = 'h1_30'), 0), 'h31_60', coalesce(sum(total) filter (where kelompok = 'h31_60'), 0),
           'h61_90', coalesce(sum(total) filter (where kelompok = 'h61_90'), 0), 'lebih_90', coalesce(sum(total) filter (where kelompok = 'lebih_90'), 0),
           'total', coalesce(sum(total), 0))
    into v_baris, v_kel from b;
  return jsonb_build_object('per', p_per, 'baris', coalesce(v_baris, '[]'), 'kelompok', v_kel);
end $$;

-- Ringkasan uang untuk Feed: kas dan bank, tagihan belum dibayar, utang, dan laba bulan berjalan dibanding bulan lalu.
create or replace function public.ringkasan_uang() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_buku(); v_hari date := app.hari_ini(v_pid); v_awal date := date_trunc('month', v_hari)::date;
  v_lalu date := (date_trunc('month', v_hari) - interval '1 month')::date; r jsonb; l jsonb;
begin
  select jsonb_build_object(
      'kas_bank', coalesce(sum(akhir) filter (where golongan = 'aset' and kode like '1-1%'), 0),
      'piutang', coalesce(sum(akhir) filter (where golongan = 'aset' and kode like '1-2%'), 0),
      'utang', coalesce(sum(akhir) filter (where golongan = 'kewajiban' and kode like '2-1%'), 0),
      'pendapatan', coalesce(sum(kredit - debit) filter (where golongan = 'pendapatan'), 0),
      'beban', coalesce(sum(debit - kredit) filter (where golongan = 'beban'), 0),
      'ada_jurnal', exists (select 1 from public.jurnal j where j.perusahaan_id = v_pid))
    into r from app.saldo_akun(v_pid, v_awal, v_hari, true);
  select jsonb_build_object(
      'pendapatan', coalesce(sum(kredit - debit) filter (where golongan = 'pendapatan'), 0),
      'beban', coalesce(sum(debit - kredit) filter (where golongan = 'beban'), 0))
    into l from app.saldo_akun(v_pid, v_lalu, v_awal - 1, true);
  return r || jsonb_build_object('hari', v_hari, 'laba', (r ->> 'pendapatan')::bigint - (r ->> 'beban')::bigint,
    'laba_bulan_lalu', (l ->> 'pendapatan')::bigint - (l ->> 'beban')::bigint);
end $$;

-- Saldo awal: satu jurnal pembuka untuk akun neraca. Selisihnya dicatat di akun penyeimbang 3-900 agar pemilik bisa mengisi
-- sebagian dulu (misalnya kas dan piutang saja). Saldo awal yang masih berlaku harus dibalik dulu sebelum diganti.
create or replace function public.atur_saldo_awal(p_tanggal date, p_baris jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); e jsonb; a public.akun; v_d bigint; v_k bigint; v_net bigint := 0; v_baris jsonb := '[]'; n int; r jsonb;
begin
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) then
    raise exception 'Tanggal saldo awal tidak boleh di masa depan' using errcode = '22023';
  end if;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) = 0 or jsonb_array_length(p_baris) > 200 then
    raise exception 'Isi saldo awal 1 sampai 200 akun' using errcode = '22023';
  end if;
  if exists (select 1 from public.jurnal j where j.perusahaan_id = v_pid and j.sumber = 'saldo_awal' and j.dibalik_oleh is null) then
    raise exception 'Saldo awal sudah ada. Balik jurnal saldo awal lama dulu, lalu isi ulang.' using errcode = '23505';
  end if;
  if not exists (select 1 from public.akun where perusahaan_id = v_pid) then
    perform app.pasang_bagan_bawaan(v_pid);
  end if;
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (v_pid, '3-900', 'Penyeimbang saldo awal', 'modal', 'kredit', true) on conflict (perusahaan_id, kode) do nothing;
  for e in select * from jsonb_array_elements(p_baris) loop
    select * into a from public.akun where perusahaan_id = v_pid and kode = e ->> 'akun' and aktif;
    if not found or a.golongan not in ('aset', 'kewajiban', 'modal') or a.kode = '3-900' then
      raise exception 'Saldo awal hanya untuk akun neraca (aset, kewajiban, modal): %', coalesce(e ->> 'akun', '(kosong)') using errcode = '22023';
    end if;
    v_d := coalesce((e ->> 'debit')::bigint, 0); v_k := coalesce((e ->> 'kredit')::bigint, 0);
    if v_d < 0 or v_k < 0 or (v_d > 0) = (v_k > 0) then
      raise exception 'Setiap akun berisi debit atau kredit saja, rupiah bulat positif' using errcode = '22023';
    end if;
    v_net := v_net + v_d - v_k;
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', a.kode, 'debit', v_d, 'kredit', v_k));
  end loop;
  if v_net > 0 then
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '3-900', 'kredit', v_net));
  elsif v_net < 0 then
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '3-900', 'debit', -v_net));
  end if;
  select count(*) into n from public.jurnal j where j.perusahaan_id = v_pid and j.sumber = 'saldo_awal';
  r := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal, 'keterangan', 'Saldo awal', 'sumber', 'saldo_awal',
         'kunci_idempoten', 'saldo_awal:' || (n + 1)), v_baris, auth.uid());
  return r || jsonb_build_object('penyeimbang', v_net);
end $$;

-- Tutup buku tahunan: saldo pendapatan dan beban tahun itu dipindah ke 3-300 Laba ditahan pada 31 Desember, lalu
-- 12 bulan tahun itu dikunci. Hanya tahun yang sudah lewat. Idempoten per tahun.
create or replace function public.tutup_buku(p_tahun int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_buku(true); v_awal date; v_akhir date; v_baris jsonb; v_laba bigint; r jsonb; m date;
begin
  if p_tahun is null or p_tahun >= extract(year from app.hari_ini(v_pid))::int or p_tahun < 2000 then
    raise exception 'Hanya tahun yang sudah lewat yang bisa ditutup' using errcode = '22023';
  end if;
  v_awal := make_date(p_tahun, 1, 1); v_akhir := make_date(p_tahun, 12, 31);
  if exists (select 1 from public.jurnal j where j.perusahaan_id = v_pid and j.kunci_idempoten = 'tutup:' || p_tahun) then
    return jsonb_build_object('id', (select j.id from public.jurnal j where j.perusahaan_id = v_pid and j.kunci_idempoten = 'tutup:' || p_tahun), 'baru', false);
  end if;
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (v_pid, '3-300', 'Laba ditahan', 'modal', 'kredit', true) on conflict (perusahaan_id, kode) do nothing;
  with s as (
    select a.kode, sum(b.kredit - b.debit) as net
      from public.jurnal_baris b join public.jurnal j on j.id = b.jurnal_id join public.akun a on a.id = b.akun_id
     where b.perusahaan_id = v_pid and j.tanggal between v_awal and v_akhir and a.golongan in ('pendapatan', 'beban')
     group by a.kode having sum(b.kredit - b.debit) <> 0
  )
  select jsonb_agg(case when net > 0 then jsonb_build_object('akun', kode, 'debit', net) else jsonb_build_object('akun', kode, 'kredit', -net) end order by kode),
         coalesce(sum(net), 0)
    into v_baris, v_laba from s;
  if v_baris is not null then
    v_baris := v_baris || jsonb_build_array(case when v_laba > 0 then jsonb_build_object('akun', '3-300', 'kredit', v_laba)
                                                 when v_laba < 0 then jsonb_build_object('akun', '3-300', 'debit', -v_laba) end);
    v_baris := (select jsonb_agg(x) from jsonb_array_elements(v_baris) x where x <> 'null'::jsonb);
    r := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_akhir, 'keterangan', 'Tutup buku ' || p_tahun, 'sumber', 'tutup_buku',
           'kunci_idempoten', 'tutup:' || p_tahun), v_baris, auth.uid());
  else
    r := jsonb_build_object('id', null, 'baru', false, 'kosong', true);
  end if;
  for m in select generate_series(v_awal, make_date(p_tahun, 12, 1), interval '1 month')::date loop
    insert into public.periode_buku (perusahaan_id, bulan, terkunci, terkunci_at, terkunci_oleh)
    values (v_pid, m, true, now(), auth.uid())
    on conflict (perusahaan_id, bulan) do update set terkunci = true, terkunci_at = now(), terkunci_oleh = auth.uid()
    where not public.periode_buku.terkunci;
  end loop;
  return r || jsonb_build_object('laba', v_laba);
end $$;

revoke all on function app.wajib_buku(boolean), app.saldo_akun(uuid, date, date, boolean) from public, anon, authenticated;
revoke all on function public.laporan_keuangan(date, date), public.buku_besar(text, date, date), public.umur_piutang(date),
  public.ringkasan_uang(), public.atur_saldo_awal(date, jsonb), public.tutup_buku(int) from public, anon;
grant execute on function public.laporan_keuangan(date, date), public.buku_besar(text, date, date), public.umur_piutang(date),
  public.ringkasan_uang(), public.atur_saldo_awal(date, jsonb), public.tutup_buku(int) to authenticated;
