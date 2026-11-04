-- R-EKSIM2 (docs/research/ekspor-impor.md): aturan bertanggal ekspor-impor yang teks pasalnya sudah dibaca (OCR dari PDF resmi
-- peraturan.bpk.go.id, 4 Nov 2026). Dipakai B-EKSIM2 (perkiraan biaya mendarat impor) dan pengingat DHE; bukan billing resmi.
insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select v.kunci, v.nilai::jsonb, v.berlaku_dari::date, v.sumber, true, v.catatan
  from (values
    ('pph22.impor',
     '{"basis": "nilai_impor", "dengan_api_persen": 2.5, "tanpa_api_persen": 7.5, "barang_tertentu_persen": 10, "barang_tertentu_lain_persen": 7.5, "kedelai_gandum_terigu_api_persen": 0.5, "emas_batangan_persen": 0.25, "lelang_tidak_dikuasai_persen": 7.5, "final": false}',
     '2025-08-01',
     'PMK 51 Tahun 2025 Pasal 3 ayat (1) huruf a angka 1 huruf a) sampai g) (BN 2025 No. 549; peraturan.bpk.go.id/Details/326296)',
     'Daftar barang tertentu (10%) dan barang tertentu lainnya (7,5%) ada di Lampiran PMK 51/2025; Nadi meminta pengguna memilih kelompok barangnya.'),
    ('ppn.impor',
     '{"tarif_persen": 12, "dpp_pengali": [11, 12], "tarif_efektif_persen": 11, "barang_mewah_dpp_penuh": true}',
     '2025-01-01',
     'PMK 131 Tahun 2024 Pasal 3 (penjelasan resmi DJP pajak.go.id/node/113453)',
     'Barang bukan mewah: 12% x 11/12 x nilai impor. Barang mewah: 12% dari nilai impor penuh.'),
    ('dhe.sda',
     '{"batas_nilai_peb_usd": 250000, "non_migas_persen": 100, "non_migas_bulan": 12, "migas_persen_minimal": 30, "migas_bulan_minimal": 3, "batas_penukaran_rupiah_persen": 50, "batas_penempatan": "akhir bulan ketiga setelah bulan pendaftaran PPE", "bilateral_tambang_persen_minimal": 30, "bilateral_tambang_bulan_minimal": 3}',
     '2026-06-01',
     'PP 36 Tahun 2023 sebagaimana diubah PP 8/2025, PP 2/2026 (Pasal 6 ayat (2)-(3), Pasal 11A ayat (1a), sanksi merujuk Pasal 7 ayat (1), (2), (2a)), dan PP 21/2026 (Pasal 18A, berlaku 1 Juni 2026)',
     'Hanya eksportir SDA (pertambangan, perkebunan, kehutanan, perikanan). Nadi hanya mengingatkan kewajiban, tidak menghitung keringanan.')
  ) as v(kunci, nilai, berlaku_dari, sumber, catatan)
 where not exists (select 1 from public.aturan_bertanggal a where a.kunci = v.kunci and a.berlaku_dari = v.berlaku_dari::date);
