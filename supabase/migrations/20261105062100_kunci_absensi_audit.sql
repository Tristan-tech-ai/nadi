-- M-12 perbaikan: app.catat_audit membutuhkan kolom id, sedangkan kunci_absensi berkunci (perusahaan_id, bulan); pemicu audit
-- membuat setiap penguncian gagal (tes waktu_lanjutan merah: record has no field id). Jejaknya tetap di kolom diubah_oleh,
-- diubah_at, dan alasan (membuka kunci wajib beralasan).
drop trigger audit_kunci_absensi on public.kunci_absensi;
