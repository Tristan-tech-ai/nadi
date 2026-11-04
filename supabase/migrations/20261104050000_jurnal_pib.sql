-- B-EKSIM3 (docs/research/ekspor-impor.md bagian 3): PIB yang dilempar menjadi usulan uang.impor (baca-berkas inti.ts usulanDari);
-- saat pemilik/admin menyetujuinya, trigger ini memposting jurnal impor dengan rumus yang sama dengan jurnalPib di inti.ts:
--   debit 1-300 Persediaan barang = nilai pabean (CIF rupiah) + bea masuk + cukai + PPnBM
--   debit 1-410 PPN masukan impor = PPN impor (pajak masukan bila PKP)
--   debit 1-420 PPh 22 impor dibayar di muka = PPh Pasal 22 impor (kredit pajak, tidak final, PMK 51/2025)
--   kredit 2-110 Utang pemasok valas = nilai pabean (CIF x NDPBM)
--   kredit 1-110 Bank = pungutan yang dibayar (BM + cukai + PPN + PPnBM + PPh)
-- CIF rupiah dari bidang nilai_pabean_rp; bila 0, nilai_cif x ndpbm. Tanggal jurnal = tanggal pendaftaran PIB bila tidak di masa
-- depan dan bulannya belum dikunci, selain itu hari ini. Idempoten lewat kunci pib:<usulan>. Pola trigger sama dengan agenda surat
-- (putuskan_usulan tidak disalin ulang). Tes: supabase/tests/jurnal_pib.test.sql.

create or replace function app.jurnal_pib() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b jsonb := new.payload -> 'bidang'; v_n numeric; v_cif bigint; v_bm bigint; v_cukai bigint; v_ppn bigint; v_ppnbm bigint; v_pph bigint;
  v_tgl date; v_hari date := app.hari_ini(new.perusahaan_id); v_baris jsonb := '[]'::jsonb;
  f_angka constant text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  if new.aksi <> 'uang.impor' or new.status <> 'diterima' or old.status = 'diterima' or b is null then return new; end if;
  v_bm := case when coalesce(b ->> 'bm', '') ~ f_angka then greatest(0, round((b ->> 'bm')::numeric)) else 0 end;
  v_cukai := case when coalesce(b ->> 'cukai', '') ~ f_angka then greatest(0, round((b ->> 'cukai')::numeric)) else 0 end;
  v_ppn := case when coalesce(b ->> 'ppn', '') ~ f_angka then greatest(0, round((b ->> 'ppn')::numeric)) else 0 end;
  v_ppnbm := case when coalesce(b ->> 'ppnbm', '') ~ f_angka then greatest(0, round((b ->> 'ppnbm')::numeric)) else 0 end;
  v_pph := case when coalesce(b ->> 'pph', '') ~ f_angka then greatest(0, round((b ->> 'pph')::numeric)) else 0 end;
  v_cif := case when coalesce(b ->> 'nilai_pabean_rp', '') ~ f_angka then greatest(0, round((b ->> 'nilai_pabean_rp')::numeric)) else 0 end;
  if v_cif = 0 and coalesce(b ->> 'nilai_cif', '') ~ f_angka and coalesce(b ->> 'ndpbm', '') ~ f_angka then
    v_n := (b ->> 'nilai_cif')::numeric * (b ->> 'ndpbm')::numeric;
    v_cif := greatest(0, round(v_n));
  end if;
  if v_cif = 0 then return new; end if;

  v_tgl := app.tanggal_teks(b ->> 'tanggal_daftar');
  if v_tgl is null or v_tgl > v_hari or exists (select 1 from public.periode_buku p where p.perusahaan_id = new.perusahaan_id
       and p.bulan = date_trunc('month', v_tgl)::date and p.terkunci) then
    v_tgl := v_hari;
  end if;

  perform app.pasang_bagan_bawaan(new.perusahaan_id);
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (new.perusahaan_id, '1-410', 'PPN masukan impor', 'aset', 'debit', true),
         (new.perusahaan_id, '1-420', 'PPh 22 impor dibayar di muka (kredit pajak)', 'aset', 'debit', true),
         (new.perusahaan_id, '2-110', 'Utang ke pemasok luar negeri (valas)', 'kewajiban', 'kredit', true)
  on conflict (perusahaan_id, kode) do nothing;

  v_baris := jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_cif + v_bm + v_cukai + v_ppnbm,
    'keterangan', left('CIF ' || coalesce(b ->> 'valuta', '') || ' ' || coalesce(b ->> 'nilai_cif', '') || ' x NDPBM ' || coalesce(b ->> 'ndpbm', '') || ' + bea masuk', 200)));
  if v_ppn > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-410', 'debit', v_ppn)); end if;
  if v_pph > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-420', 'debit', v_pph)); end if;
  v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '2-110', 'kredit', v_cif,
    'keterangan', left('Utang ' || coalesce(nullif(b ->> 'pemasok', ''), 'pemasok') || ' ' || coalesce(b ->> 'valuta', '') || ' ' || coalesce(b ->> 'nilai_cif', ''), 200)));
  if v_bm + v_cukai + v_ppn + v_ppnbm + v_pph > 0 then
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-110', 'kredit', v_bm + v_cukai + v_ppn + v_ppnbm + v_pph, 'keterangan', 'Pungutan impor dibayar'));
  end if;
  perform app.posting_jurnal(new.perusahaan_id,
    jsonb_build_object('tanggal', v_tgl,
      'keterangan', left('Impor PIB ' || coalesce(nullif(b ->> 'nomor_daftar', ''), nullif(b ->> 'nomor_pengajuan', ''), '-') || ' ' || coalesce(b ->> 'pemasok', ''), 200),
      'sumber', 'pib', 'sumber_id', new.id::text, 'kunci_idempoten', 'pib:' || new.id),
    v_baris, coalesce(new.diputuskan_oleh, auth.uid()));
  return new;
end $$;
revoke all on function app.jurnal_pib() from public, anon, authenticated;
create trigger jurnal_pib after update of status on public.usulan for each row
  when (new.aksi = 'uang.impor' and new.status = 'diterima') execute function app.jurnal_pib();
