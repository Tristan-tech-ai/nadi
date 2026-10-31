# Rancangan SQL KPI F3-03 (per orang per minggu)

Ditulis 1 Nov 2026 dari skema yang ada: public.kerja (graf_usaha: poin_beban, tenggat, selesai_at, lintas_topi, status), public.kejadian (orang_id, kerja_id, jenis, terjadi_at), public.pengajuan_izin (mulai, selesai, status), dan helper F3-02 app.awal_minggu. Layar: docs/design/kpi-cermin.md. Sumber kejadian: docs/research/kpi-sumber.md.

## Koreksi dari catatan sebelumnya
Kueri contoh di kpi-sumber.md memakai `'Asia/Makassar'` tetap. Itu salah untuk usaha di zona lain: kolom perusahaan.zona_waktu ada (not null, bawaan 'Asia/Jakarta'). Batas minggu wajib lewat app.awal_minggu(pid, mulai) dan `(tanggal)::timestamp at time zone p.zona_waktu`, sama dengan app.beban_orang di F3-02, supaya beban dan KPI menghitung minggu yang sama.

## Fungsi
1. **app.kpi_orang(p_pid, p_mulai)** (sql stable, search_path '', dicabut dari public/anon/authenticated, seperti app.beban_orang). Satu baris per orang aktif (karyawan/magang):
   - `poin_selesai` = sum(poin_beban) kerja status selesai dengan selesai_at di [mulai, mulai+7) zona usaha; `kerja_selesai` = larik id kerja itu (bahan penjelasan).
   - `bertenggat`, `tepat` = kerja selesai minggu itu yang punya tenggat / yang selesai_at <= tenggat; `lewat` = larik {id, judul, lewat_menit} untuk yang terlambat (bahan kalimat "Dua yang lewat: ...").
   - `lintas_poin`, `lintas_kerja` = kerja selesai dengan lintas_topi = true (hanya kontribusi, tidak pernah minus).
   - `hadir` = **null** sampai F3-06 (jadwal shift) ada. Tanpa jadwal tidak ada arti "sesuai jadwal"; layar menulis "Hadir sesuai jadwal muncul setelah jadwal shift diisi". Tidak memakai absen.harian impor sebagai pengganti diam-diam.
   - `minggu_lalu` = angka yang sama untuk p_mulai - 7 (pembanding dirinya).
2. **public.kpi_saya(p_mulai date default null) returns jsonb**: anggota aktif mana pun; hanya baris milik app.orang_saya(), plus `rata_rata_tim` per ukuran **hanya bila n >= 3** orang yang punya minimal satu kerja selesai minggu itu (ambang sama dengan beban_saya). Tanpa id atau nama rekan. Penjelasan dari larik id milik dirinya saja.
3. **public.kpi_minggu(p_mulai date default null) returns jsonb**: pemilik/admin (dan akuntan baca); semua orang, untuk tabel buku kas.
4. Kejadian bantahan memakai tabel yang sudah ada: staf menandai "Ada yang keliru?" menjadi usulan jenis `kpi.banding` (untuk_peran {pemilik, admin}, invariant Q-17 terpenuhi) dengan payload {kerja_id, alasan}. Tidak ada tabel baru.

## Ambang jujur
- Kurang dari 5 kerja selesai seminggu: angka tetap tampil, tetapi pembanding "naik/turun" disembunyikan dan diganti "belum cukup kerja untuk dibandingkan" (rancangan bagi-adil memakai ambang 5 yang sama).
- Tim 3 orang: staf bisa menghitung total dua rekan dari rata-rata (temuan docs/quality/review-f3-02.md). Diterima karena hanya total, bukan per orang; ambang tidak diturunkan di bawah 3.

## Tes SQL yang wajib (supabase/tests/kpi.test.sql)
- Staf A memanggil kpi_saya: tidak ada id kerja milik B di penjelasan; kpi_minggu ditolak 42501.
- Dua staf saja: rata_rata_tim null.
- Kerja selesai tepat di batas minggu (Minggu 23.59 dan Senin 00.00 zona usaha) jatuh ke minggu yang benar; usaha 'Asia/Jayapura' dan 'Asia/Jakarta' memberi minggu berbeda untuk instan yang sama.
- Kerja lintas topi menambah lintas_poin dan tidak mengurangi apa pun.
- Setiap ukuran bukan null punya larik id tidak kosong, atau angka 0 dengan teks "belum ada kerja selesai minggu ini".
- Isolasi tenant: kpi_saya di usaha B tidak pernah membaca kerja usaha A.
