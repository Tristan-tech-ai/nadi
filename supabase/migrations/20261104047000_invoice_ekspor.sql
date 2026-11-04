-- B-EKSIM1 (docs/research/ekspor-impor.md): invoice dan packing list ekspor bervaluta USD. Satu baris = satu pengapalan: pembeli
-- luar negeri, Incoterms 2020, pelabuhan, baris barang (kode HS isian pengguna, tidak ditentukan Nadi), berat bersih/kotor dan koli
-- per baris. Kurs Rp per USD, sumber kurs (mis. nomor KMK kurs pajak mingguan), dan tanggal kurs disimpan per invoice; total rupiah =
-- total USD x kurs dibulatkan. Terbit = bernomor (Nomor Sakti EXP) + jurnal 1-210 piutang valas / 4-110 penjualan ekspor dalam rupiah
-- dengan keterangan nilai USD dan kurs; batal = jurnal balik + nomor batal. Nadi tidak mengisi atau mengirim PEB. Hak: pemilik, admin,
-- akuntan (app.wajib_penagih). Tes: supabase/tests/invoice_ekspor.test.sql.

create table public.invoice_ekspor (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nomor text not null,
  nomor_terbit_id uuid not null references public.nomor_terbit(id),
  alamat_penjual text not null check (length(btrim(alamat_penjual)) between 5 and 300),
  pembeli text not null check (length(btrim(pembeli)) between 1 and 120),
  alamat_pembeli text not null check (length(btrim(alamat_pembeli)) between 5 and 300),
  negara text not null check (length(btrim(negara)) between 2 and 60),
  incoterm text not null check (incoterm in ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF')),
  tempat_incoterm text not null check (length(btrim(tempat_incoterm)) between 2 and 80),
  pelabuhan_muat text check (pelabuhan_muat is null or length(btrim(pelabuhan_muat)) between 2 and 80),
  pelabuhan_tujuan text check (pelabuhan_tujuan is null or length(btrim(pelabuhan_tujuan)) between 2 and 80),
  mata_uang text not null default 'USD' check (mata_uang = 'USD'),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 30),
  total_usd numeric(14, 2) not null check (total_usd > 0),
  kurs numeric(12, 4) not null check (kurs between 1000 and 100000),
  kurs_sumber text not null check (length(btrim(kurs_sumber)) between 3 and 120),
  kurs_tanggal date not null,
  total_rupiah bigint not null check (total_rupiah > 0),
  berat_bersih_kg numeric(12, 3) not null check (berat_bersih_kg >= 0),
  berat_kotor_kg numeric(12, 3) not null check (berat_kotor_kg >= berat_bersih_kg),
  koli integer not null check (koli between 1 and 100000),
  tanggal date not null,
  jatuh_tempo date not null check (jatuh_tempo >= tanggal),
  catatan text check (catatan is null or length(catatan) <= 300),
  status text not null default 'terbit' check (status in ('terbit', 'batal')),
  jurnal_terbit uuid,
  alasan_batal text check (alasan_batal is null or length(alasan_batal) <= 300),
  batal_at timestamptz,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  check (kurs_tanggal <= tanggal),
  check ((status = 'batal') = (alasan_batal is not null))
);
create index on public.invoice_ekspor (perusahaan_id, dibuat_at desc);
create index on public.invoice_ekspor (nomor_terbit_id);

alter table public.invoice_ekspor enable row level security;
create policy invoice_ekspor_baca on public.invoice_ekspor for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.invoice_ekspor to authenticated;
create trigger audit_invoice_ekspor after insert or update or delete on public.invoice_ekspor for each row execute function app.catat_audit();

-- Isian: {alamat_penjual, pembeli, alamat_pembeli, negara, incoterm, tempat_incoterm, pelabuhan_muat?, pelabuhan_tujuan?, kurs,
-- kurs_sumber, kurs_tanggal, jatuh_tempo, catatan?, baris: [{uraian, hs?, jumlah, satuan, harga_usd, berat_bersih_kg,
-- berat_kotor_kg, koli}]}. Nilai baris = round(jumlah x harga_usd, 2), sama dengan totalEkspor di apps/web/src/lib/ekspor/hitung.ts.
create or replace function public.buat_invoice_ekspor(p jsonb, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_penagih(); v_hari date; v_id uuid; inv public.invoice_ekspor; e jsonb; r jsonb; v_jurnal jsonb;
  v_baris jsonb := '[]'::jsonb; v_total numeric := 0; v_bersih numeric := 0; v_kotor numeric := 0; v_koli integer := 0;
  v_jml numeric; v_hrg numeric; v_bb numeric; v_bk numeric; v_kl integer; v_uraian text; v_satuan text; v_hs text;
  v_kurs numeric; v_kurs_tgl date; v_jt date; v_rupiah bigint; v_ket text;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into inv from public.invoice_ekspor where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then
    return jsonb_build_object('id', inv.id, 'nomor', inv.nomor, 'total_usd', inv.total_usd, 'total_rupiah', inv.total_rupiah, 'sudah', true);
  end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Isian invoice ekspor tidak lengkap.' using errcode = '22023'; end if;
  v_hari := app.hari_ini(v_pid);
  if length(btrim(coalesce(p ->> 'pembeli', ''))) not between 1 and 120 then
    raise exception 'Tulis nama pembeli (paling panjang 120 huruf).' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p ->> 'alamat_pembeli', ''))) not between 5 and 300 or length(btrim(coalesce(p ->> 'alamat_penjual', ''))) not between 5 and 300 then
    raise exception 'Tulis alamat lengkap usahamu dan alamat pembeli.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p ->> 'negara', ''))) not between 2 and 60 then
    raise exception 'Tulis negara tujuan.' using errcode = '22023';
  end if;
  if coalesce(p ->> 'incoterm', '') not in ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF')
     or length(btrim(coalesce(p ->> 'tempat_incoterm', ''))) not between 2 and 80 then
    raise exception 'Pilih Incoterms 2020 dan tulis tempatnya (mis. FOB Tanjung Perak).' using errcode = '22023';
  end if;
  begin
    v_kurs := (p ->> 'kurs')::numeric;
    v_kurs_tgl := (p ->> 'kurs_tanggal')::date;
    v_jt := (p ->> 'jatuh_tempo')::date;
  exception when others then
    raise exception 'Kurs harus angka dan tanggal harus benar.' using errcode = '22023';
  end;
  if v_kurs is null or v_kurs < 1000 or v_kurs > 100000 or v_kurs <> round(v_kurs, 4) then
    raise exception 'Kurs rupiah per USD antara Rp1.000 dan Rp100.000 (paling banyak 4 angka di belakang koma).' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p ->> 'kurs_sumber', ''))) not between 3 and 120 then
    raise exception 'Tulis sumber kurs, mis. nomor KMK kurs pajak minggu ini.' using errcode = '22023';
  end if;
  if v_kurs_tgl is null or v_kurs_tgl > v_hari or v_kurs_tgl < v_hari - 31 then
    raise exception 'Tanggal kurs paling lama 31 hari lalu dan tidak di masa depan.' using errcode = '22023';
  end if;
  if v_jt is null or v_jt < v_hari or v_jt > v_hari + 365 then
    raise exception 'Jatuh tempo mulai hari ini sampai setahun ke depan.' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'baris') is distinct from 'array' or jsonb_array_length(p -> 'baris') not between 1 and 30 then
    raise exception 'Isi 1 sampai 30 baris barang.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p -> 'baris') loop
    v_uraian := btrim(coalesce(e ->> 'uraian', ''));
    v_satuan := btrim(coalesce(e ->> 'satuan', ''));
    v_hs := nullif(btrim(coalesce(e ->> 'hs', '')), '');
    begin
      v_jml := (e ->> 'jumlah')::numeric;
      v_hrg := (e ->> 'harga_usd')::numeric;
      v_bb := (e ->> 'berat_bersih_kg')::numeric;
      v_bk := (e ->> 'berat_kotor_kg')::numeric;
      v_kl := (e ->> 'koli')::integer;
    exception when others then
      raise exception 'Jumlah, harga, berat, dan koli harus angka.' using errcode = '22023';
    end;
    if length(v_uraian) not between 1 and 120 or length(v_satuan) not between 1 and 12
       or v_jml is null or v_jml <= 0 or v_jml > 10000000 or v_hrg is null or v_hrg < 0 or v_hrg > 1000000000 or v_hrg <> round(v_hrg, 2) then
      raise exception 'Setiap baris butuh uraian, satuan, jumlah lebih dari 0, dan harga USD paling banyak 2 angka di belakang koma.' using errcode = '22023';
    end if;
    if v_hs is not null and v_hs !~ '^[0-9]{4}([.]?[0-9]{2}){0,2}$' then
      raise exception 'Kode HS berupa 4, 6, atau 8 angka, mis. 0901.11.10.' using errcode = '22023';
    end if;
    if v_bb is null or v_bk is null or v_kl is null or v_bb < 0 or v_bk < v_bb or v_bk > 100000000 or v_kl < 0 or v_kl > 100000 then
      raise exception 'Berat kotor tidak boleh lebih kecil dari berat bersih, dan koli tidak boleh negatif.' using errcode = '22023';
    end if;
    v_total := v_total + round(v_jml * v_hrg, 2);
    v_bersih := v_bersih + round(v_bb, 3);
    v_kotor := v_kotor + round(v_bk, 3);
    v_koli := v_koli + v_kl;
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('uraian', v_uraian, 'hs', v_hs, 'jumlah', v_jml, 'satuan', v_satuan,
      'harga_usd', v_hrg, 'nilai_usd', round(v_jml * v_hrg, 2), 'berat_bersih_kg', round(v_bb, 3), 'berat_kotor_kg', round(v_bk, 3), 'koli', v_kl));
  end loop;
  if v_total <= 0 then raise exception 'Total invoice masih USD 0.' using errcode = '22023'; end if;
  if v_koli < 1 then raise exception 'Packing list butuh paling sedikit 1 koli.' using errcode = '22023'; end if;
  v_rupiah := round(v_total * v_kurs)::bigint;

  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, 'EXP', 'Invoice ekspor', '{no:3}/EXP/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  perform app.pasang_bagan_bawaan(v_pid);
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (v_pid, '1-210', 'Tagihan valas belum dibayar (piutang USD)', 'aset', 'debit', true),
         (v_pid, '4-110', 'Penjualan ekspor', 'pendapatan', 'kredit', true)
  on conflict (perusahaan_id, kode) do nothing;

  v_id := app.uuid7();
  r := app.terbit_nomor(v_pid, 'EXP', 'invoice ekspor ' || v_id, auth.uid());
  v_ket := left('USD ' || to_char(v_total, 'FM999999999990.00') || ' x Rp' || trim_scale(v_kurs)::text || ' (' || btrim(p ->> 'kurs_sumber') || ')', 200);
  v_jurnal := app.posting_jurnal(v_pid,
    jsonb_build_object('tanggal', v_hari, 'keterangan', left('Invoice ekspor ' || (r ->> 'nomor') || ' ' || btrim(p ->> 'pembeli'), 200),
                       'sumber', 'invoice_ekspor', 'sumber_id', v_id::text, 'kunci_idempoten', 'invoice-ekspor:' || v_id),
    jsonb_build_array(jsonb_build_object('akun', '1-210', 'debit', v_rupiah, 'keterangan', v_ket),
                      jsonb_build_object('akun', '4-110', 'kredit', v_rupiah, 'keterangan', v_ket)),
    auth.uid());
  insert into public.invoice_ekspor (id, perusahaan_id, nomor, nomor_terbit_id, alamat_penjual, pembeli, alamat_pembeli, negara, incoterm,
    tempat_incoterm, pelabuhan_muat, pelabuhan_tujuan, baris, total_usd, kurs, kurs_sumber, kurs_tanggal, total_rupiah, berat_bersih_kg,
    berat_kotor_kg, koli, tanggal, jatuh_tempo, catatan, jurnal_terbit, kunci_klien, dibuat_oleh)
  values (v_id, v_pid, r ->> 'nomor', (r ->> 'id')::uuid, btrim(p ->> 'alamat_penjual'), btrim(p ->> 'pembeli'), btrim(p ->> 'alamat_pembeli'),
    btrim(p ->> 'negara'), p ->> 'incoterm', btrim(p ->> 'tempat_incoterm'), nullif(btrim(coalesce(p ->> 'pelabuhan_muat', '')), ''),
    nullif(btrim(coalesce(p ->> 'pelabuhan_tujuan', '')), ''), v_baris, v_total, v_kurs, btrim(p ->> 'kurs_sumber'), v_kurs_tgl, v_rupiah,
    v_bersih, v_kotor, v_koli, v_hari, v_jt, nullif(left(btrim(coalesce(p ->> 'catatan', '')), 300), ''), (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid());
  return jsonb_build_object('id', v_id, 'nomor', r ->> 'nomor', 'total_usd', v_total, 'total_rupiah', v_rupiah, 'sudah', false);
end $$;

create or replace function public.batal_invoice_ekspor(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice_ekspor;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan invoice dibatalkan.' using errcode = '22023';
  end if;
  select * into inv from public.invoice_ekspor where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice ekspor tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'batal' then return jsonb_build_object('id', inv.id, 'sudah', true); end if;
  perform public.balik_jurnal(inv.jurnal_terbit, 'Invoice ekspor ' || inv.nomor || ' dibatalkan: ' || btrim(p_alasan));
  update public.nomor_terbit set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), dibatalkan_oleh = auth.uid(), dibatalkan_at = now()
   where id = inv.nomor_terbit_id and status = 'terbit';
  update public.invoice_ekspor set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), batal_at = now() where id = inv.id;
  return jsonb_build_object('id', inv.id, 'sudah', false);
end $$;

revoke all on function public.buat_invoice_ekspor(jsonb, uuid), public.batal_invoice_ekspor(uuid, text) from public, anon;
grant execute on function public.buat_invoice_ekspor(jsonb, uuid), public.batal_invoice_ekspor(uuid, text) to authenticated;
