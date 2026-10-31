# Penyusun jadwal shift otomatis (F3-06, bagian solver)

Ditulis 1 Nov 2026. Melengkapi docs/research/shift-f3-06-sql.md (skema dan batasan) yang belum mencakup solver, padahal kriteria F3-06 meminta "jadwal memenuhi semua batasan pada 3 skenario uji; keadilan shift malam terukur".

## Sumber primer
- Google OR-Tools, Employee Scheduling, https://developers.google.com/optimization/scheduling/employee_scheduling (diakses 1 Nov 2026). Contoh perawat memakai solver CP-SAT. Variabel Boolean: "`shifts[(n, d, s)]` equals 1 if shift s is assigned to nurse n on day d, and 0 otherwise". Batasan: setiap shift diisi tepat satu orang (exactly-one), satu orang paling banyak satu shift sehari, dan pemerataan: "Try to distribute the shifts evenly, so that each nurse works min_shifts_per_nurse shifts", dengan batas bawah/atas = pembulatan bawah/atas total shift dibagi jumlah orang. Contoh kedua memaksimalkan jumlah permintaan shift yang terpenuhi. Kode tersedia untuk Python, C++, Java, C#; halaman itu tidak menyebut JavaScript/WASM.

## Pilihan untuk Nadi
| Pilihan | Untuk | Melawan |
|---|---|---|
| OR-Tools CP-SAT | optimal terbukti, model batasan bersih | butuh server Python/Java/C# (Nadi hanya Vercel Next + Supabase Edge Deno); paket berbayar/server baru di luar aturan PENJAGA |
| Pemrograman linear di JS/WASM (mis. HiGHS atau glpk versi WASM) | jalan di browser/Edge | belum dibaca sumber resminya (TIDAK terverifikasi); model biner puluhan ribu variabel bisa lambat di HP |
| **Serakah + perbaikan lokal di TS murni** | UMKM kecil (2 sampai 30 orang, 7 hari, 1 sampai 3 shift/hari = paling banyak ±630 variabel); bisa diuji penuh di vitest; batasan dipakai bersama dengan app.cek_shift | tidak terbukti optimal |

**Keputusan**: serakah + perbaikan lokal di `apps/web/src/lib/jadwal/susun.ts` (murni, tanpa jaringan), meniru rumus pemerataan OR-Tools (setiap orang antara floor dan ceil dari total shift / jumlah orang yang tersedia). Penyusun hanya **mengusulkan**; pemilik menyimpan lewat simpan_shift, yang tetap menegakkan batasan keras di database. Dengan begitu bug solver tidak pernah bisa melanggar aturan lembur. Bila nanti terbukti kurang (mis. usaha > 30 orang), uji pilihan WASM dengan sumber resmi dulu.

## Algoritma
1. Masukan: slot kebutuhan (hari, jam mulai/selesai, topi, jumlah orang), orang (topi, hari tidak bisa, jam maks), riwayat 4 minggu (jumlah shift malam per orang), pola usaha (6 atau 5 hari).
2. Urutkan slot dari yang paling sulit diisi (paling sedikit kandidat bertopi cocok), lalu shift malam lebih dulu.
3. Untuk setiap slot pilih kandidat sah (topi cocok, belum bekerja hari itu atau tidak tumpang tindih, jam harian/mingguan dalam batas normal, hari libur minimal masih mungkin) dengan skor terkecil: (shift minggu ini, shift malam 4 minggu + minggu ini, id). Pemutus seri id membuat hasil deterministik.
4. Perbaikan lokal: tukar pasangan penugasan selama ketimpangan shift malam (lihat ukuran) turun dan semua batasan tetap sah; berhenti setelah tidak ada perbaikan atau 2.000 langkah.
5. Slot yang tidak bisa diisi tanpa melanggar batasan dibiarkan kosong dan dilaporkan ("Sabtu 22.00-06.00 butuh 1 orang lagi: tidak ada kasir yang masih punya jam"), bukan dipaksa jadi lembur.

## Ukuran keadilan shift malam
Shift malam = shift yang menyentuh 22.00 sampai 06.00 zona usaha. Ukuran: selisih maks-min jumlah shift malam per orang dalam jendela 4 minggu bergulir di antara orang yang bisa malam (topi cocok dan tidak menandai tidak bisa malam), ditambah Gini (fungsi giniDari dari src/lib/kerja/adil.ts, dipakai ulang). Target: selisih <= 1 dalam 4 minggu bila kapasitas cukup.

## Tiga skenario uji (vitest, data sintetis)
1. **Warung kecil**: 4 orang, 1 topi kasir, buka 07.00-22.00 setiap hari, 2 shift/hari (07.00-14.00, 14.00-21.00 + 1 jam tutup). Harapan: semua slot terisi, tiap orang 40 jam atau kurang, 1 hari libur, tanpa istirahat kurang.
2. **Kafe 24 jam**: 9 orang, 3 shift (06-14, 14-22, 22-06), 2 topi (barista, kasir). Harapan: semua slot terisi; setelah 4 minggu simulasi, selisih shift malam <= 1 dan Gini malam lebih rendah dari penugasan bergilir sederhana.
3. **Kurang orang**: 3 orang untuk kebutuhan 4 orang/hari. Harapan: tidak ada batasan keras yang dilanggar; slot kosong dilaporkan dengan alasan; tidak ada lembur otomatis.
Tes merah sengaja: matikan pemeriksaan hari libur, skenario 1 harus gagal.

## Di luar bagian ini
Ramalan kebutuhan (berapa orang per jam dari kejadian penjualan/absen) dan tukar shift antarstaf dari judul F3-06 masih perlu dirancang; ramalan butuh data penjualan (F4/F5) yang belum ada, jadi untuk awal kebutuhan diisi pemilik per hari.
