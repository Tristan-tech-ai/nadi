-- U-12 lencana live: tabel usulan masuk publikasi Realtime supaya sidebar menghitung ulang usulan menunggu saat ada perubahan.
-- Postgres Changes memeriksa RLS usulan untuk setiap pelanggan, jadi hanya anggota usaha yang boleh membaca usulan yang menerima kabar.
alter publication supabase_realtime add table public.usulan;
