-- Q-44: indeks parsial untuk baris yang masih aktif. app.kerja_saya dan app.divisi_saya (dipakai RLS) mencari menurut usaha
-- dan orang dengan lepas_at / keluar_at kosong; baris orang yang sudah keluar tetap disimpan sebagai riwayat dan tidak ikut
-- dipindai.
create index if not exists kerja_pelaksana_aktif on public.kerja_pelaksana (perusahaan_id, orang_id) where lepas_at is null;
create index if not exists divisi_anggota_aktif on public.divisi_anggota (perusahaan_id, orang_id) where keluar_at is null;
