-- R-ATURAN26: tiga aturan bertanggal 2026 yang sebelumnya terverifikasi=false (sumber berita) dicocokkan ke teks resmi (13 Nov 2026).
-- 1. bpjs.jp: surat BPJS Ketenagakerjaan Nomor B/1226/022026 tanggal 25 Februari 2026 (ditandatangani elektronik, sertifikat BSrE)
--    perihal Ketentuan Batas Upah dan Manfaat Jaminan Pensiun Tahun 2026, butir 5: batas upah paling tinggi Rp10.547.400 (tahun
--    2025) x (1 + 5,11%) = Rp11.086.372, dibulatkan Rp11.086.300, berlaku mulai Maret 2026 (PP 45/2015 Pasal 29 ayat (3) dan (4)).
--    Januari dan Februari 2026 masih memakai batas 2025 Rp10.547.400 yang disebut surat yang sama. Iuran 2% pemberi kerja dan 1%
--    pekerja (PP 45/2015 Pasal 28) tidak berubah.
-- 2. ump.bali: Keputusan Gubernur Bali Nomor 1011/03-M/HK/2025 tanggal 19 Desember 2025, UMP Bali 2026 Rp3.207.459, berlaku
--    1 Januari 2026 (pengumuman dan SK resmi Disnaker ESDM Provinsi Bali,
--    https://cloud-ng.baliprov.go.id/disnakeresdm/2025/12/PENGUMUMAN-DAN-SK-UMP-UMSP-2026.pdf).
-- 3. umk.badung: Keputusan Gubernur Bali Nomor 1021/03-M/HK/2025, UMK Badung 2026 Rp3.791.002,57, berlaku 1 Januari 2026
--    (https://cloud-ng.baliprov.go.id/disnakeresdm/2025/12/PENGUMUMAN-DAN-SK-UMK-UMSK-TAHUN-2026.pdf).
-- Nilai UMP dan UMK sama dengan baris lama; yang berubah sumber dan tanda terverifikasi.

update public.aturan_bertanggal
   set nilai = jsonb_set(nilai, '{batas_upah}', '10547400'::jsonb),
       berlaku_sampai = date '2026-02-28',
       terverifikasi = true,
       sumber = 'Surat BPJS Ketenagakerjaan B/1226/022026 tanggal 25 Februari 2026 butir 5 (batas upah tahun 2025 Rp10.547.400 berlaku sampai Februari 2026); iuran PP 45/2015 Pasal 28; dibaca 13 Nov 2026'
 where kunci = 'bpjs.jp' and berlaku_dari = date '2026-01-01' and not terverifikasi;

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select 'bpjs.jp', '{"pemberi_kerja": 0.02, "pekerja": 0.01, "batas_upah": 11086300}'::jsonb, date '2026-03-01',
       'Surat BPJS Ketenagakerjaan B/1226/022026 tanggal 25 Februari 2026 butir 5: batas upah paling tinggi Rp11.086.300 mulai Maret 2026 (PP 45/2015 Pasal 29 ayat (3) dan (4)); iuran PP 45/2015 Pasal 28; dibaca 13 Nov 2026',
       true, 'Disesuaikan setiap tahun dengan pertumbuhan PDB tahun sebelumnya; surat berikutnya biasanya Februari.'
 where not exists (select 1 from public.aturan_bertanggal where kunci = 'bpjs.jp' and berlaku_dari = date '2026-03-01');

update public.aturan_bertanggal
   set terverifikasi = true,
       sumber = 'Keputusan Gubernur Bali Nomor 1011/03-M/HK/2025 tanggal 19 Desember 2025, UMP Bali 2026 Rp3.207.459 berlaku 1 Januari 2026 (https://cloud-ng.baliprov.go.id/disnakeresdm/2025/12/PENGUMUMAN-DAN-SK-UMP-UMSP-2026.pdf); dibaca 13 Nov 2026'
 where kunci = 'ump.bali' and berlaku_dari = date '2026-01-01' and (nilai ->> 'rupiah')::numeric = 3207459;

update public.aturan_bertanggal
   set terverifikasi = true,
       sumber = 'Keputusan Gubernur Bali Nomor 1021/03-M/HK/2025, UMK Kabupaten Badung 2026 Rp3.791.002,57 berlaku 1 Januari 2026 (https://cloud-ng.baliprov.go.id/disnakeresdm/2025/12/PENGUMUMAN-DAN-SK-UMK-UMSK-TAHUN-2026.pdf); dibaca 13 Nov 2026'
 where kunci = 'umk.badung' and berlaku_dari = date '2026-01-01' and (nilai ->> 'rupiah')::numeric = 3791002.57;
