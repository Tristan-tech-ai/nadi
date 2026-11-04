-- M-11: app.catat_audit butuh kolom id, profil_kerja berkunci orang_id. Jejak perubahan profil kerja ada di riwayat_kerja (jabatan,
-- level, departemen, atasan) dan audit tidak dipakai untuk tabel ini. Ditemukan tes hr_admin.
drop trigger audit_profil_kerja on public.profil_kerja;
