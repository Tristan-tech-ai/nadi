-- Aturan bertanggal (Bank Publik). terverifikasi=true hanya bila angka dibaca langsung dari situs resmi; selain itu false (tidak dipakai sebagai preset).
insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan) values
('bpjs.jkk.pemberi_kerja', '{"sangat_rendah":0.0024,"rendah":0.0054,"sedang":0.0089,"tinggi":0.0127,"sangat_tinggi":0.0174}', '2026-01-01', 'https://www.bpjsketenagakerjaan.go.id/penerima-upah.html (diakses 31 Okt 2026)', true, 'persen dari upah sebulan menurut tingkat risiko'),
('bpjs.jkm.pemberi_kerja', '0.003', '2026-01-01', 'https://www.bpjsketenagakerjaan.go.id/penerima-upah.html (diakses 31 Okt 2026)', true, null),
('bpjs.jht', '{"pemberi_kerja":0.037,"pekerja":0.02}', '2026-01-01', 'https://www.bpjsketenagakerjaan.go.id/penerima-upah.html (diakses 31 Okt 2026)', true, null),
('bpjs.jp', '{"pemberi_kerja":0.02,"pekerja":0.01,"batas_upah":10547400}', '2026-01-01', 'https://www.bpjsketenagakerjaan.go.id/penerima-upah.html (diakses 31 Okt 2026)', true, 'batas upah iuran JP sesuai halaman resmi'),
('bpjs.kesehatan', '{"pemberi_kerja":0.04,"pekerja":0.01,"batas_upah":12000000}', '2026-01-01', 'riset R3 repo lama; belum dibaca dari situs resmi BPJS Kesehatan', false, 'verifikasi ke bpjs-kesehatan.go.id sebelum dipakai'),
('ump.bali', '{"rupiah":3207459}', '2026-01-01', 'Kepgub Bali 1011/03-M/HK/2025 menurut kompas.tv dan metrotvnews (31 Okt 2026); teks SK belum dibuka langsung', false, 'UMSP akomodasi dan makan minum Rp3.267.693 (sumber sama)'),
('umk.badung', '{"rupiah":3791002.57}', '2026-01-01', 'Kepgub Bali 1021/03-M/HK/2025 menurut kompas.tv (31 Okt 2026); teks SK belum dibuka langsung', false, null),
('pph21.ter', '{"tabel":"belum dimuat"}', '2024-01-01', 'PP 58/2023 dan PMK 168/2023 (jdih.kemenkeu.go.id); tabel TER A/B/C belum dimuat', false, 'muat tabel dari teks PMK sebelum dipakai di F1-05');
