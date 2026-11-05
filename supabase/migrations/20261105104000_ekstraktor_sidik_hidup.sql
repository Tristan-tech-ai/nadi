-- T-01B: sidik tata letak unik hanya untuk aturan yang masih hidup (bayangan atau aktif). Sebelumnya aturan yang dimatikan
-- masa bayangan (T-02) tetap memegang sidiknya, sehingga tata letak yang sama tidak pernah bisa dipelajari ulang: insert aturan
-- baru gagal dengan duplicate key dan berkas berikutnya selalu dibaca model. Aturan mati tetap disimpan sebagai jejak.
drop index if exists public.ekstraktor_coalesce_sidik_tata_letak_idx;
create unique index ekstraktor_sidik_hidup_idx on public.ekstraktor
  (coalesce(perusahaan_id, '00000000-0000-0000-0000-000000000000'::uuid), sidik_tata_letak)
  where status <> 'mati';
