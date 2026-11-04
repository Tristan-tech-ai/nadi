-- M-10 (docs/research/gaji-lanjutan.md): THR, kasbon, dan batas potongan upah.
-- THR: Permenaker 6/2016 Pasal 2 ayat (1) (masa kerja >= 1 bulan terus menerus), Pasal 3 ayat (1) (>= 12 bulan = 1 bulan upah;
-- 1 s.d. < 12 bulan = masa kerja / 12 x 1 bulan upah), ayat (2) huruf b (upah = upah pokok + tunjangan tetap), Pasal 5 ayat (4)
-- (dibayar paling lambat 7 hari sebelum Hari Raya). Masa kerja dihitung dalam bulan penuh sampai tanggal Hari Raya.
-- Kasbon (uang muka upah) dari kas usaha sendiri: PP 36/2021 Pasal 63 ayat (1) huruf c; jumlah semua potongan Pasal 63 paling
-- banyak 50% dari setiap pembayaran upah (Pasal 65), ditegakkan pada slip. Pajak dan iuran BPJS bukan potongan Pasal 63.
-- Tes: supabase/tests/gaji_lanjutan.test.sql.

create or replace function app.masa_kerja_bulan(p_mulai date, p_sampai date) returns int
language sql immutable set search_path = '' as $$
  select case when p_mulai is null or p_sampai < p_mulai then 0
    else (extract(year from age(p_sampai, p_mulai)) * 12 + extract(month from age(p_sampai, p_mulai)))::int end
$$;

-- THR per karyawan aktif untuk satu Hari Raya. Hanya pemilik (data gaji rahasia).
create or replace function public.hitung_thr(p_hari_raya date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang menghitung THR' using errcode = '42501';
  end if;
  if p_hari_raya is null then raise exception 'Isi tanggal Hari Raya' using errcode = '22023'; end if;
  return jsonb_build_object('hari_raya', p_hari_raya, 'batas_bayar', p_hari_raya - 7,
    'dasar', 'Permenaker 6/2016 Pasal 3 ayat (1) dan (2) huruf b; dibayar paling lambat 7 hari sebelum Hari Raya (Pasal 5 ayat (4))',
    'orang', coalesce((select jsonb_agg(x order by x ->> 'nama') from (
      select jsonb_build_object('id', o.id, 'nama', o.nama, 'mulai', m.mulai, 'masa_bulan', app.masa_kerja_bulan(m.mulai, p_hari_raya),
        'upah', u.upah,
        'thr', case when m.mulai is null or u.upah is null then null
                    when app.masa_kerja_bulan(m.mulai, p_hari_raya) < 1 then 0
                    when app.masa_kerja_bulan(m.mulai, p_hari_raya) >= 12 then u.upah
                    else round(app.masa_kerja_bulan(m.mulai, p_hari_raya) * u.upah / 12.0) end,
        'catatan', case when m.mulai is null then 'tanggal mulai kerja belum diisi' when u.upah is null then 'gaji pokok belum diisi'
                        when app.masa_kerja_bulan(m.mulai, p_hari_raya) < 1 then 'masa kerja kurang dari 1 bulan' end) as x
        from public.orang o
        left join public.orang_rahasia r on r.orang_id = o.id
        cross join lateral (select app.tanggal_teks(o.data ->> 'mulai') as mulai) m
        cross join lateral (select case when jsonb_typeof(r.gaji -> 'pokok') = 'number'
          then (r.gaji -> 'pokok')::numeric + coalesce(case when jsonb_typeof(r.gaji -> 'tunjangan_tetap') = 'number' then (r.gaji -> 'tunjangan_tetap')::numeric end, 0) end as upah) u
       where o.perusahaan_id = v_pid and o.status = 'aktif' and 'karyawan' = any(o.jenis)) y), '[]'::jsonb));
end $$;

-- Ajukan THR sebagai satu usulan untuk pemilik (dibayar lewat kas/bank oleh pemilik; Nadi tidak memindahkan uang).
create or replace function public.ajukan_thr(p_hari_raya date, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); h jsonb; v_baris jsonb; v_total numeric; u public.usulan;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into u from public.usulan where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if u.id is not null then return jsonb_build_object('usulan', u.id, 'sudah', true); end if;
  h := public.hitung_thr(p_hari_raya);
  select coalesce(jsonb_agg(jsonb_build_object('orang_id', x ->> 'id', 'nama', x ->> 'nama', 'masa_bulan', (x ->> 'masa_bulan')::int, 'thr', (x ->> 'thr')::numeric)), '[]'),
         coalesce(sum((x ->> 'thr')::numeric), 0)
    into v_baris, v_total from jsonb_array_elements(h -> 'orang') x where coalesce((x ->> 'thr')::numeric, 0) > 0;
  if jsonb_array_length(v_baris) = 0 then raise exception 'Belum ada karyawan yang berhak THR (cek tanggal mulai dan gaji pokok)' using errcode = '22023'; end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, keyakinan, dampak_rp, untuk_peran, status, kunci_klien)
  values (v_pid, 'nadi', 'uang.thr', 'Bayar THR ' || jsonb_array_length(v_baris) || ' karyawan ' || app.rupiah(v_total),
    'Hari Raya ' || to_char(p_hari_raya, 'DD-MM-YYYY') || ', dibayar paling lambat ' || to_char(p_hari_raya - 7, 'DD-MM-YYYY')
      || '. Dihitung menurut Permenaker 6/2016 Pasal 3: masa kerja 12 bulan atau lebih dapat 1 bulan upah (pokok + tunjangan tetap), kurang dari itu proporsional.',
    jsonb_build_object('baris', v_baris, 'bidang', jsonb_build_object('hari_raya', p_hari_raya, 'jumlah_orang', jsonb_array_length(v_baris), 'total', v_total)),
    1, v_total, array['pemilik'], 'menunggu', p_kunci) returning * into u;
  return jsonb_build_object('usulan', u.id, 'total', v_total, 'orang', jsonb_array_length(v_baris), 'sudah', false);
end $$;

create table public.kasbon (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  jumlah bigint not null check (jumlah > 0),
  cicilan bigint not null check (cicilan > 0),
  sisa bigint not null check (sisa >= 0),
  tanggal date not null,
  cara text not null check (cara in ('tunai', 'transfer')),
  alasan text not null check (length(btrim(alasan)) between 3 and 300),
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  check (cicilan <= jumlah)
);
create index on public.kasbon (perusahaan_id, orang_id);
alter table public.kasbon enable row level security;
create policy kasbon_baca on public.kasbon for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
grant select on public.kasbon to authenticated;
create trigger audit_kasbon after insert or update or delete on public.kasbon for each row execute function app.catat_audit();

-- Beri kasbon dari kas usaha: hanya pemilik (uang keluar). Jurnal D 1-150 piutang karyawan / K kas atau bank.
create or replace function public.beri_kasbon(p_orang uuid, p_jumlah bigint, p_cicilan bigint, p_cara text, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kasbon; v_jurnal jsonb; v_hari date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang memberi kasbon' using errcode = '42501';
  end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into k from public.kasbon where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', k.id, 'sudah', true); end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if p_jumlah is null or p_jumlah <= 0 or p_cicilan is null or p_cicilan <= 0 or p_cicilan > p_jumlah then
    raise exception 'Isi jumlah kasbon dan cicilan per bulan (cicilan tidak melebihi jumlah)' using errcode = '22023';
  end if;
  if p_cara not in ('tunai', 'transfer') then raise exception 'Pilih tunai atau transfer' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan kasbon' using errcode = '22023'; end if;
  v_hari := app.hari_ini(v_pid);
  perform app.akun_pastikan(v_pid, '1-150', 'Piutang karyawan (kasbon)', 'aset', 'debit');
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_hari, 'keterangan', left('Kasbon ' || (select nama from public.orang where id = p_orang), 200),
    'sumber', 'gaji', 'sumber_id', p_orang::text, 'kunci_idempoten', 'kasbon:' || p_kunci),
    jsonb_build_array(jsonb_build_object('akun', '1-150', 'debit', p_jumlah), jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'kredit', p_jumlah)), auth.uid());
  insert into public.kasbon (perusahaan_id, orang_id, jumlah, cicilan, sisa, tanggal, cara, alasan, jurnal_id, kunci_klien, dibuat_oleh)
  values (v_pid, p_orang, p_jumlah, p_cicilan, p_jumlah, v_hari, p_cara, btrim(p_alasan), (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid()) returning * into k;
  return jsonb_build_object('id', k.id, 'sisa', k.sisa, 'sudah', false);
end $$;

-- Batas potongan PP 36/2021 Pasal 65: potongan Pasal 63 (denda, ganti rugi, kasbon, sewa, utang, kelebihan bayar) <= 50% pendapatan slip.
create or replace function app.jaga_potongan_upah() returns trigger
language plpgsql set search_path = '' as $$
declare v_pendapatan numeric; v_pasal63 numeric;
begin
  select coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'pendapatan'), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'potongan' and k ->> 'kode' in ('kasbon', 'denda', 'ganti_rugi', 'sewa', 'utang', 'kelebihan_bayar')), 0)
    into v_pendapatan, v_pasal63 from jsonb_array_elements(new.komponen) k;
  if v_pasal63 > v_pendapatan * 0.5 then
    raise exception 'Potongan kasbon, denda, ganti rugi, sewa, utang, dan kelebihan bayar Rp% melebihi 50%% upah Rp% (PP 36/2021 Pasal 65). Kurangi cicilannya.',
      v_pasal63, v_pendapatan using errcode = '22023';
  end if;
  return new;
end $$;
create trigger jaga_potongan_upah before insert or update of komponen on public.slip_gaji for each row execute function app.jaga_potongan_upah();

revoke all on function public.hitung_thr(date), public.ajukan_thr(date, uuid), public.beri_kasbon(uuid, bigint, bigint, text, text, uuid) from public, anon;
grant execute on function public.hitung_thr(date), public.ajukan_thr(date, uuid), public.beri_kasbon(uuid, bigint, bigint, text, text, uuid) to authenticated;
revoke all on function app.masa_kerja_bulan(date, date) from public, anon;
