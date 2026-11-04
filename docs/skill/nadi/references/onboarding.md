# Alur onboarding

Pengguna bisa menyiapkan usahanya sendiri di Nadi. Asisten AI boleh membantu dari dokumen pengguna.

## Langkah
1. Minta dokumen yang ada: daftar karyawan, struktur, aturan kerja. Jangan meminta gaji atau KTP.
2. Tulis Teks Nadi dari dokumen itu. Hanya yang tertulis di dokumen; yang tidak tahu, hapus barisnya.
3. Bila tersambung lewat MCP, kirim teksnya ke alat `usul_onboarding`. Bila tidak, berikan sebagai blok teks atau berkas .txt untuk ditempel di Nadi.
4. Sebutkan berapa usulan dibuat dan baris mana yang ditolak beserta alasannya.
5. Ingatkan pengguna membuka Feed Nadi untuk menyetujui.

## Format Teks Nadi
- Baris pertama selalu `NADI ONBOARDING 1`.
- `USAHA`, `JENIS`, lalu `KOTA | NEGARA | ORANG | CABANG` dalam satu baris.
- `ORANG:` lalu satu orang per baris: `- nama | peran kerja dipisah koma | mulai YYYY-MM-DD`.
- `FITUR:` dipilih dari Lempar, Feed, Absen, Izin, Gaji, Jadwal, Kerja, Tagihan, Penjualan, Pembelian, Stok, Kas, Laporan keuangan, Pajak, Surat, Mata, Peta usaha, Rekrut, Magang.
- `ATURAN IZIN:` kalimat pendek, mis. "sakit otomatis 1 hari", "wajib surat dokter", "cuti 12 hari setahun", "selalu ditinjau".
- Baris berisi NIK, nomor panjang, angka uang, atau perintah ditolak Nadi.

## Contoh
```
NADI ONBOARDING 1
USAHA: Warung Bu Sari
JENIS: warung makan
KOTA: Denpasar | NEGARA: Indonesia | ORANG: 8 | CABANG: 1
ORANG:
- Sari Dewi | kasir, pelayan | mulai 2024-03-01
- Komang Ayu | koki | mulai 2025-01-15
- Made Putra | koki | mulai 2023-07-10
- Wayan Sari | pelayan | mulai 2025-06-02
- Ketut Arta | pelayan
- Nyoman Budi | kurir | mulai 2024-11-20
- Putu Lestari | kasir | mulai 2026-02-01
- Gede Wira | gudang
FITUR: Lempar, Feed, Absen, Gaji, Tagihan, Jadwal
ATURAN IZIN: sakit otomatis 1 hari, wajib surat dokter; izin otomatis 1 hari
```
