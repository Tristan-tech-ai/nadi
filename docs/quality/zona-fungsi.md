# Klasifikasi 'Asia/Makassar' di fungsi database (Q-24)

Diperiksa 1 Nov 2026 (tick 169) lewat execute_sql baca saja: setiap baris prosrc di public/app yang memuat 'Asia/Makassar'. Bawaan perusahaan.zona_waktu adalah 'Asia/Jakarta' (not null), jadi WITA tetap salah untuk usaha WIB/WIT.

## A. Benar, biarkan (cadangan coalesce, zona_waktu tetap dipakai)
app.awal_minggu, app.beban_orang (2), public.beban_minggu (2), public.laporan_rekrut, public.papan_kerja.

## B. Benar menurut data, biarkan
- app.isi_demo (2): usaha contoh memang diisi zona 'Asia/Makassar' sebagai nilai kolom (usaha demo di WITA). Itu data, bukan perhitungan.
- app.ukur_kuota: kuota platform harian (bukan per usaha); satu zona platform wajar. Catat di komentar fungsi bahwa itu sengaja.

## C. Salah, berdampak ke data usaha (prioritas)
| Fungsi | Baris | Dampak untuk usaha WIB |
|---|---|---|
| app.catat_izin | `p.mulai::timestamp at time zone 'Asia/Makassar'` | kejadian izin.* tercatat 00.00 WITA = 23.00 WIB **hari sebelumnya**: hitungan izin per tanggal, ringkasan_harian, dan KPI hadir nanti meleset satu hari |
| public.batalkan_keputusan (2) | kejadian izin.batal dengan waktu yang sama | pembatalan izin juga jatuh di hari sebelumnya, sehingga pasangan izin/batal tetap seimbang tetapi di tanggal salah |
| public.ajukan_izin (2) | `v_hari_ini` dan waktu bukti | izin untuk "hari ini" bisa ditolak/diterima keliru di 00.00 sampai 01.00 WIB; jatah tahunan dihitung per hari WITA |
| public.gerbang_gaji (6) | tanggal acuan, mulai kerja, 30 hari tanpa tanda hidup, kontrak habis, 35 hari audit | batas hari geser 1 jam; kontrak yang selesai hari ini dianggap habis/tidak satu jam lebih awal |
| public.izin_ringkas | tahun berjalan | jatah cuti berganti tahun pukul 23.00 WIB 31 Des |
| app.peringatan_rencana | tanggal mulai magang | peringatan magang bisa geser satu hari bila 'mulai' tanpa jam |
| public.putuskan_usulan | tanggal mulai pemasangan topi dari impor | topi dari impor mulai satu hari lebih awal bila jam 00.00 |
| public.catat_jam_rekrut | larangan tanggal masa depan | pukul 23.00 sampai 24.00 WIB tanggal besok masih ditolak/diterima keliru |

## D. Salah, dampak kecil (batas harian kuota per usaha)
app.antre_rute_model, public.rute_model_uji_mulai, app.batas_berkas: batas harian per usaha berganti pukul 23.00 WIB, bukan 00.00. Tidak salah hitung data, hanya jam reset.

## Rancangan perbaikan
- Fungsi app.zona(pid) returns text: `select coalesce(zona_waktu, 'Asia/Jakarta') from perusahaan where id = pid` (sama dengan bawaan kolom), dan app.hari_ini(pid) returns date.
- Kelompok C dan D memakai app.zona(perusahaan_id baris) atau app.zona(app.pid()). Kelompok A dibiarkan (atau dirapikan memakai app.zona, opsional).
- Data lama: kejadian izin.* yang sudah tercatat dengan waktu WITA tidak diubah otomatis (tidak menghapus/menulis ulang tanpa cadangan); tes membuktikan kejadian baru jatuh di tanggal lokal benar. Bila perlu koreksi data lama, itu tugas terpisah dengan cadangan.
- Tes struktur: 0 baris 'Asia/Makassar' di luar kelompok A/B (daftar putih nama fungsi); tes perilaku untuk usaha Asia/Jakarta dan Asia/Jayapura: izin 1 Nov tercatat 1 Nov 00.00 lokal, gerbang kontrak habis tepat di hari lokal, izin_ringkas berganti tahun 00.00 lokal.

## Bukti di produksi (tick 169, execute_sql baca saja)
Kejadian izin.sakit/izin/cuti yang dicatat app.catat_izin, dipasangkan dengan pengajuan_izin.mulai, di usaha Asia/Jakarta: **44 dari 44 jatuh di tanggal lokal sehari sebelum tanggal mulai izin** (contoh: izin mulai 2026-11-01 tercatat 2026-10-31 23.00 WIB), 0 yang cocok. Data uji sintetis, tetapi pola yang sama akan menimpa usaha sungguhan. Koreksi data lama (geser 1 jam) dicatat sebagai bagian Q-24 dengan cadangan: salin baris lama ke audit sebelum update, dan hanya untuk kejadian yang waktunya persis mulai::timestamp at time zone 'Asia/Makassar'.
