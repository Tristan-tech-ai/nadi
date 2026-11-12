-- R-UUPK2: aturan ketenagakerjaan diperbarui ke UU 27/2026 tentang Pelindungan Ketenagakerjaan (LN 2026 No. 179, TLN 7222;
-- disahkan, diundangkan, dan berlaku 28 Okt 2026, Pasal 313), teks PDF resmi JDIH BPK
-- https://peraturan.bpk.go.id/Download/425330/UU%20Nomor%2027%20Tahun%202026.pdf (176 halaman, dibaca 12 Nov 2026).
-- Pencocokan pasal per pasal: docs/research/uu-27-2026-cocok.md.
-- 1. pesangon.uu27 (baru, berlaku 28 Okt 2026): tabel uang pesangon dan UPMK Pasal 232 ayat (2)-(3) sama dengan PP 35/2021, tetapi
--    pengali per alasan PHK berubah (Pasal 236-249), alasan efisiensi tidak ada lagi di Pasal 231, uang pisah paling sedikit 1 bulan
--    upah bila perusahaan tidak mengatur (Pasal 233 ayat (2)), dan usaha mikro serta kecil membayar menurut kesepakatan (Pasal 250).
--    pesangon.pp35 ditutup sampai 27 Okt 2026 (tetap untuk PHK sebelum itu).
-- 2. Aturan yang angkanya sama (lembur, kompensasi PKWT, upah sehari) mendapat baris baru berlaku 28 Okt 2026 dengan nilai yang sama
--    dan dasar hukum baru: UU 27/2026 ditambah PP 35/2021 dan PP 36/2021 yang masih berlaku sepanjang tidak bertentangan (Pasal 310).
-- 3. cadangan_pesangon() memakai aturan pesangon terbaru dari kedua kunci.

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select 'pesangon.uu27',
  '{"pesangon": [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]],
    "upmk": [[3,2],[6,3],[9,4],[12,5],[15,6],[18,7],[21,8],[24,10]],
    "pengali": {"rugi": 1, "pensiun": 2},
    "uang_pisah_min_bulan": 1,
    "mikro_kecil_kesepakatan": true,
    "alasan": [
      {"kode": "gabung_pekerja_menolak", "pasal": "Pasal 236 ayat (1)", "pesangon": 1, "upmk": 1, "pisah": false},
      {"kode": "gabung_tidak_diterima", "pasal": "Pasal 236 ayat (2)", "pesangon": 2, "upmk": 1, "pisah": false},
      {"kode": "tutup_rugi", "pasal": "Pasal 237", "pesangon": 1, "upmk": 1, "pisah": false},
      {"kode": "tutup_permanen", "pasal": "Pasal 238", "pesangon": 1, "upmk": 1.5, "pisah": false},
      {"kode": "kahar", "pasal": "Pasal 239", "pesangon": 1, "upmk": 1, "pisah": false},
      {"kode": "pkpu_pailit", "pasal": "Pasal 240", "pesangon": 1, "upmk": 1, "pisah": false},
      {"kode": "pemberi_kerja_melanggar", "pasal": "Pasal 241 ayat (1)", "pesangon": 2, "upmk": 1, "pisah": false},
      {"kode": "tuduhan_tidak_terbukti", "pasal": "Pasal 241 ayat (2)", "pesangon": 0, "upmk": 0, "pisah": true},
      {"kode": "mundur", "pasal": "Pasal 242", "pesangon": 0, "upmk": 0, "pisah": true},
      {"kode": "mangkir", "pasal": "Pasal 243", "pesangon": 0, "upmk": 0, "pisah": true},
      {"kode": "pelanggaran", "pasal": "Pasal 244", "pesangon": 1, "upmk": 1, "pisah": false},
      {"kode": "ditahan_rugi", "pasal": "Pasal 245 ayat (3)", "pesangon": 0, "upmk": 0, "pisah": true},
      {"kode": "ditahan", "pasal": "Pasal 245 ayat (4)", "pesangon": 0, "upmk": 1, "pisah": false},
      {"kode": "sakit_panjang", "pasal": "Pasal 246", "pesangon": 2, "upmk": 2, "pisah": false},
      {"kode": "pensiun", "pasal": "Pasal 247", "pesangon": 2, "upmk": 1, "pisah": false},
      {"kode": "meninggal", "pasal": "Pasal 249", "pesangon": 2, "upmk": 1, "pisah": false}
    ]}'::jsonb,
  date '2026-10-28',
  'UU 27/2026 Pasal 231, 232 ayat (2)-(4), 233, 234, 236-250 (https://peraturan.bpk.go.id/Download/425330/UU%20Nomor%2027%20Tahun%202026.pdf); dibaca 12 Nov 2026',
  true,
  'Semua alasan juga berhak atas uang penggantian hak (Pasal 232 ayat (4)). Dasar upah: upah pokok + tunjangan tetap (Pasal 234). Usaha mikro dan kecil: besaran berdasarkan kesepakatan (Pasal 250). Iuran program pensiun yang dibayar penuh pemberi kerja boleh diperhitungkan (Pasal 248).'
 where not exists (select 1 from public.aturan_bertanggal where kunci = 'pesangon.uu27' and berlaku_dari = date '2026-10-28');

update public.aturan_bertanggal set berlaku_sampai = date '2026-10-27'
 where kunci = 'pesangon.pp35' and berlaku_dari = date '2021-02-02' and berlaku_sampai is null;

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select a.kunci, a.nilai, date '2026-10-28', b.sumber, true, b.catatan
  from (values
    ('lembur.pp35',
     'UU 27/2026 Pasal 116 (paling lama 4 jam sehari dan 18 jam seminggu; jam pertama 1,5 kali, berikutnya 2 kali upah sejam; upah sejam = 1/173 upah sebulan) dan PP 35/2021 Pasal 26, 31, 32 yang tetap berlaku menurut UU 27/2026 Pasal 310 (https://peraturan.bpk.go.id/Download/425330/UU%20Nomor%2027%20Tahun%202026.pdf); dibaca 12 Nov 2026',
     'Angka sama dengan aturan sebelumnya; lembur hari istirahat dan hari libur resmi sama dengan PP 35/2021 Pasal 31.'),
    ('kompensasi.pkwt',
     'UU 27/2026 Pasal 88 (uang kompensasi PKWT sesuai masa kerja, rincian lewat Peraturan Pemerintah) dan PP 35/2021 Pasal 15 ayat (3), Pasal 16 ayat (1), (2), (6), Pasal 17 yang tetap berlaku menurut UU 27/2026 Pasal 310; dibaca 12 Nov 2026',
     'Uang kompensasi PKWT = masa kerja / 12 x 1 bulan upah (pokok + tunjangan tetap). Usaha mikro dan kecil: berdasarkan kesepakatan (PP 35/2021 Pasal 16 ayat (6)).'),
    ('upah.pembagi_harian',
     'PP 36/2021 Pasal 17 yang tetap berlaku menurut UU 27/2026 Pasal 310 (UU 27/2026 tidak mengatur pembagi upah sehari); dibaca 12 Nov 2026',
     'Upah sehari = upah sebulan / 25 (6 hari kerja seminggu) atau / 21 (5 hari kerja seminggu).')
  ) as b(kunci, sumber, catatan)
  join lateral (
    select t.kunci, t.nilai from public.aturan_bertanggal t
     where t.kunci = b.kunci and t.terverifikasi and t.berlaku_dari < date '2026-10-28'
     order by t.berlaku_dari desc limit 1
  ) a on true
 where not exists (select 1 from public.aturan_bertanggal x where x.kunci = b.kunci and x.berlaku_dari = date '2026-10-28');

create or replace function public.cadangan_pesangon() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_hari date; a public.aturan_bertanggal; k public.aturan_bertanggal;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat cadangan pesangon' using errcode = '42501';
  end if;
  v_hari := app.hari_ini(v_pid);
  select * into a from public.aturan_bertanggal
   where kunci in ('pesangon.uu27', 'pesangon.pp35') and terverifikasi and berlaku_dari <= v_hari
     and (berlaku_sampai is null or berlaku_sampai >= v_hari)
   order by berlaku_dari desc limit 1;
  select * into k from public.aturan_bertanggal
   where kunci = 'kompensasi.pkwt' and terverifikasi and berlaku_dari <= v_hari and (berlaku_sampai is null or berlaku_sampai >= v_hari)
   order by berlaku_dari desc limit 1;
  return jsonb_build_object(
    'hari_ini', v_hari,
    'saldo', coalesce((select c.saldo from public.cadangan_pesangon c where c.perusahaan_id = v_pid), 0),
    'aturan', case when a.id is null then null
      else jsonb_build_object('kunci', a.kunci, 'nilai', a.nilai, 'sumber', a.sumber, 'berlaku_dari', a.berlaku_dari, 'terverifikasi', a.terverifikasi) end,
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
