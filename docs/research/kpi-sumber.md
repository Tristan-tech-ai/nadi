# Sumber data KPI dari jejak (F3-03)

Ditulis 1 Nov 2026 dari kueri produksi `select jenis, count(*), count(distinct perusahaan_id) from public.kejadian group by jenis` (data uji sintetis). Rancangan layar: docs/design/kpi-cermin.md.

## Jenis kejadian yang benar-benar ada sekarang
| Jenis | Baris | Usaha | Dipakai untuk ukuran |
|---|---|---|---|
| izin.sakit | 42 | 2 | hadir sesuai jadwal (izin disetujui tidak dihitung absen) |
| absen.harian | 30 | 1 | hadir (dari impor rekap Excel) |
| uang.keluar | 27 | 5 | bukan KPI orang |
| izin.batal | 16 | 2 | koreksi izin |
| kerja.buat / mulai / tunggu / lanjut / selesai / batal | 4 / 3 / 3 / 3 / 3 / 1 | 1 | poin selesai, tepat tenggat, lintas topi |

## Temuan
- **Tidak ada satu pun `absen.masuk` / `absen.pulang`** di kejadian produksi. Diperiksa (Q-19, 1 Nov 2026): bukan bug pencatatan. Tes SQL supabase/tests/absen_qr.test.sql (baris 87) membuktikan absen_catat menulis kejadian absen.masuk/pulang; di produksi belum ada absen berhasil karena belum ada pengguna sungguhan, dan e2e absen.spec (lulus terhadap produksi, 2/2) hanya menguji jalur penolakan karena cek wajah di perangkat tidak lolos dengan kamera palsu. Celah yang tersisa: jalur absen berhasil belum pernah diuji ujung ke ujung di browser.
- Kerja baru ada di 1 usaha uji dengan 3 kerja selesai; ambang "minimal 5 kerja selesai" di rancangan bagi-adil dan KPI berarti layar akan menampilkan keadaan "belum bisa dibandingkan" untuk hampir semua usaha pada minggu pertama. Itu jujur dan disengaja.

## Kueri contoh (dasar fungsi KPI, per orang per minggu di zona usaha)
Versi awal kueri ini memakai 'Asia/Makassar' tetap; diperbaiki 1 Nov 2026 karena perusahaan.zona_waktu ada (bawaan 'Asia/Jakarta'). Batas minggu sama dengan app.beban_orang di F3-02. Rancangan lengkap: docs/research/kpi-f3-03-sql.md.
```sql
-- poin kerja selesai dan tepat tenggat, minggu [mulai, mulai + 7) di zona usaha
with w as (
  select p.id as pid,
         (app.awal_minggu(p.id, null)::timestamp at time zone p.zona_waktu) as mulai,
         ((app.awal_minggu(p.id, null) + 7)::timestamp at time zone p.zona_waktu) as akhir
    from public.perusahaan p where p.id = app.pid()
)
select k.pelaksana_id,
       sum(k.poin_beban) as poin_selesai,
       count(*) filter (where k.tenggat is not null) as bertenggat,
       count(*) filter (where k.tenggat is not null and k.selesai_at <= k.tenggat) as tepat,
       array_agg(k.id order by k.selesai_at) as kerja_ids
  from public.kerja k join w on k.perusahaan_id = w.pid
 where k.status = 'selesai' and k.selesai_at >= w.mulai and k.selesai_at < w.akhir
 group by k.pelaksana_id;
```
Catatan: app.awal_minggu dicabut dari authenticated, jadi kueri ini hanya jalan di dalam fungsi security definer (atau execute_sql), bukan dari klien.
Setiap angka KPI menyimpan id kejadian/kerja yang dihitung agar penjelasan bisa menyebut kejadian nyata (kriteria F3-03).

## Akibat untuk F3-03
KPI "hadir sesuai jadwal" bernilai null sampai jadwal shift F3-06 ada (keputusan di docs/research/kpi-f3-03-sql.md); setelah itu diuji dengan data kejadian sintetis yang disisipkan tes SQL (pola absen_qr.test.sql), bukan dengan menunggu absen produksi.

Diuji 1 Nov 2026 lewat execute_sql (baca saja, pid ditulis langsung karena app.pid() kosong di luar JWT): usaha uji Asia/Jakarta, minggu 2026-10-25 17:00 UTC sampai 2026-11-01 17:00 UTC (Senin 00.00 sampai Senin berikutnya WIB), 9 baris pelaksana, poin 1 sampai 6, setiap baris membawa larik id kerja. Migrasi bagi_adil (app.awal_minggu) sudah ada di database (49 migrasi) walau berkasnya belum di-commit agen.
