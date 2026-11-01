-- F4-07 Kompas Pajak (docs/research/kompas-pajak.md). Angka PPh final UMKM sebagai aturan bertanggal bersumber naskah resmi;
-- posisi pajak dari jurnal (bruto pendapatan per bulan); profil pajak usaha (bentuk, gabungan usaha pemilik dan pasangan) di
-- perusahaan.pengaturan -> 'pajak', diubah hanya oleh pemilik. Hitungan ada di apps/web/src/lib/pajak/kompas.ts.
-- Tes: supabase/tests/kompas_pajak.test.sql.

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select 'pph.final_umkm', '{"tarif_persen": 0.5, "batas_bruto": 4800000000, "bebas_op": 500000000, "koperasi_tahun": 4}'::jsonb, date '2026-04-22',
       'PP 55/2022 Pasal 56 ayat (2), Pasal 57, Pasal 58, Pasal 60 ayat (2)-(5), Pasal 61 sebagaimana diubah PP 20/2026 (LN 2026 No. 43, ditetapkan dan diundangkan 22 Apr 2026); naskah pajak.go.id/sites/default/files/lampiran/PP_20_2026_Perubahan PP 55 Tahun 2022.pdf dan peraturan.bpk.go.id/Download/284096; dibaca 1 Nov 2026',
       true, 'Subjek: orang pribadi, perseroan perorangan satu orang, koperasi (4 tahun pajak sejak terdaftar). Batas dihitung gabungan dengan perseroan perorangan milik pemilik dan pasangan pisah harta. Pasal 59 (batas waktu) dihapus.'
 where not exists (select 1 from public.aturan_bertanggal where kunci = 'pph.final_umkm' and berlaku_dari = date '2026-04-22');

-- Bruto pendapatan per bulan setahun dari jurnal (kredit dikurangi debit akun golongan pendapatan; jurnal balik ikut mengurangi).
create or replace function public.posisi_pajak(p_tahun integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang melihat posisi pajak' using errcode = '42501';
  end if;
  if p_tahun is null or p_tahun not between 2020 and 2100 then
    raise exception 'Tahun tidak dikenal' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'tahun', p_tahun,
    'hari', app.hari_ini(v_pid),
    'profil', coalesce((select p.pengaturan -> 'pajak' from public.perusahaan p where p.id = v_pid), '{}'::jsonb),
    'bulanan', (select jsonb_agg(coalesce(x.bruto, 0) order by m.bulan)
                  from generate_series(1, 12) m(bulan)
                  left join (select extract(month from j.tanggal)::int as bulan, sum(b.kredit - b.debit) as bruto
                               from public.jurnal j join public.jurnal_baris b on b.jurnal_id = j.id
                               join public.akun a on a.id = b.akun_id and a.golongan = 'pendapatan'
                              where j.perusahaan_id = v_pid and extract(year from j.tanggal) = p_tahun
                              group by 1) x on x.bulan = m.bulan),
    'aturan', (select jsonb_build_object('nilai', t.nilai, 'berlaku_dari', t.berlaku_dari, 'sumber', t.sumber, 'terverifikasi', t.terverifikasi)
                 from public.aturan_bertanggal t
                where t.kunci = 'pph.final_umkm' and t.berlaku_dari <= make_date(p_tahun, 12, 31) and t.terverifikasi
                order by t.berlaku_dari desc limit 1));
end $$;

-- Profil pajak: bentuk usaha dan bruto pembanding (usaha lain milik pemilik, pasangan pisah harta, tahun lalu bila belum di Nadi).
create or replace function public.atur_profil_pajak(p_profil jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k text; v jsonb;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengatur profil pajak' using errcode = '42501';
  end if;
  if jsonb_typeof(p_profil) is distinct from 'object' or (p_profil ->> 'bentuk') is null
     or (p_profil ->> 'bentuk') not in ('op', 'pt_perorangan', 'koperasi', 'badan_lain') then
    raise exception 'Pilih bentuk usaha.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(p_profil) loop
    if k = 'bentuk' then continue; end if;
    if k not in ('bruto_lalu', 'usaha_lain_lalu', 'usaha_lain_ini', 'pasangan_lalu', 'pasangan_ini') then
      raise exception 'Isian % tidak dikenal', k using errcode = '22023';
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 1e15 or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
      raise exception 'Isi rupiah bulat, tidak negatif.' using errcode = '22023';
    end if;
  end loop;
  update public.perusahaan set pengaturan = jsonb_set(coalesce(pengaturan, '{}'::jsonb), '{pajak}', p_profil) where id = v_pid;
end $$;

revoke all on function public.posisi_pajak(integer), public.atur_profil_pajak(jsonb) from public, anon;
grant execute on function public.posisi_pajak(integer), public.atur_profil_pajak(jsonb) to authenticated;
