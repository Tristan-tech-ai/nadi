# Gerbang Gaji: pegawai siluman (F1-04)

Ditulis 31 Okt 2026 sebelum kode. Masalah P03: gaji dibayarkan ke orang yang tidak bekerja, atau ke rekening orang lain. Gerbang ini dijalankan sebelum gaji disetujui. Orang yang tertangkap ditahan dari daftar bayar sampai pemilik memeriksa. Fitur penggajian (F2) memanggilnya; dalam tugas ini gerbang berdiri sendiri sebagai RPC.

## Siapa yang diperiksa
Orang berstatus `aktif`, berjenis karyawan atau magang, dengan gaji pokok tercatat (`orang_rahasia.gaji.pokok > 0`). Kandidat, pemasok, dan orang tanpa gaji tidak ikut gerbang.

## Enam sinyal
| Kode | Tertangkap bila | Pengecualian (mencegah positif palsu) |
|---|---|---|
| `tanpa_tanda_hidup` | tidak ada kejadian `absen.*` atau `izin.*` atas orang itu dalam 30 hari sebelum tanggal periksa | orang yang mulai bekerja kurang dari 30 hari lalu (`data.mulai`, atau tanggal dibuat); izin yang disetujui dihitung sebagai tanda hidup |
| `rekening_ganda` | `rekening_hash` sama dengan orang aktif lain di usaha yang sama | tidak ada; dua gaji ke satu rekening selalu perlu dilihat |
| `hp_ganda` | nomor HP (dinormalkan ke +62, hanya angka) sama dengan orang aktif lain | HP kosong tidak dihitung |
| `nik_ganda` | `nik_hash` sama dengan orang aktif lain | NIK kosong tidak dihitung |
| `kontrak_habis` | `data.kontrak_selesai` sebelum tanggal periksa, orang masih aktif | orang tanpa tanggal kontrak (karyawan tetap) |
| `pemisahan_tugas` | penyetuju gaji yang bukan pemilik juga yang membuat orang itu atau mengubah data rahasianya (rekening, gaji, NIK) dalam 35 hari terakhir, atau penyetuju menyetujui gajinya sendiri | pemilik yang mengerjakan semuanya sendiri tidak ditandai (lazim di UMKM, risikonya milik pemilik sendiri) |

Sumber "siapa dan kapan" untuk pemisahan tugas adalah `audit_log` (trigger yang sudah ada di `orang` dan `orang_rahasia`; nilai rahasia tidak disalin ke audit).

## Keluaran
`public.gerbang_gaji(p_tanggal date default hari ini WITA)` untuk pemilik/admin: satu baris per temuan `{orang_id, nama, kode, alasan}`. Alasan ditulis untuk manusia dan tidak menuduh: "Belum ada absen atau izin sejak 1 Okt. Pastikan orang ini masih bekerja sebelum gajinya dibayar." Tidak ada temuan berarti gerbang lolos.

## Tes
- Data bersih: 30 karyawan dari korpus `fixtures/korpus/excel_karyawan/karyawan-30.json` diimpor lewat usulan, masing-masing punya absen 30 hari terakhir dan NIK/rekening unik, ditambah karyawan baru 5 hari tanpa absen dan karyawan yang sedang izin sakit. Hasil wajib 0 temuan, baik bila diperiksa pemilik maupun admin.
- Siluman: enam orang, masing-masing memicu tepat satu sinyal di atas, semuanya tertangkap dengan kode yang benar.
- Isolasi usaha; staf tidak bisa menjalankan gerbang.
