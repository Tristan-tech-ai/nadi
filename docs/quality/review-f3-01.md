# Tinjauan perubahan konfigurasi F3-01 (sebelum commit agen)

Ditulis 1 Nov 2026 oleh loop, membaca diff kerja agen F3-01 (belum di-commit) terhadap 9972a5b.

## apps/web/next.config.ts
- Header keamanan Q-01 (X-Frame-Options DENY, CSP frame-ancestors/base-uri/object-src, Permissions-Policy, mikrofon hanya /lamar/:kode) TIDAK disentuh. Aman.
- Tambahan `experimental: { useOffline: true }`. Sumber: apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/useOffline.md (Next 16.4.3, dibaca 1 Nov 2026). Opsi ini berstatus experimental dan berlaku untuk SELURUH aplikasi, bukan hanya /app/kerja.

### Temuan: Server Action yang sedang berjalan bisa terkirim dua kali
Dokumen menyebut: "any navigation, prefetch, or Server Action waits for the next connectivity check to succeed, whether it was newly issued or already in flight when the connection dropped. When the check succeeds, the request runs once". Permintaan yang "already in flight" bisa saja sudah sampai dan diproses server sebelum koneksi putus (jawaban yang hilang, bukan permintaannya). Saat sinyal kembali, aksi itu dijalankan lagi.

Dampak per aksi yang ada:
| Aksi | Akibat bila terulang | Aman? |
|---|---|---|
| putuskan (Feed) | putuskan_usulan menolak usulan yang bukan menunggu | aman, tetapi pengguna bisa melihat galat padahal berhasil |
| catat_lembur | unik orang+tanggal, menimpa | aman |
| buatLowongan, simpan_rencana_magang, buat kerja (F3-01) | baris kembar | TIDAK aman |
| Mulai/Selesai kerja (F3-01) | transisi status kedua | aman hanya bila RPC idempoten (Selesai pada kerja yang sudah selesai = tanpa perubahan, bukan galat, bukan durasi baru) |
| simpanTranskrip, simpan_slip | menimpa | aman |

### Yang diminta sebelum F3-01 diterima
1. RPC transisi kerja idempoten: memanggil Mulai/Selesai dua kali menghasilkan keadaan dan durasi yang sama; tes SQL untuk ini.
2. Buat kerja memakai kunci idempoten dari klien (uuid dibuat di browser, kolom unik) atau ditunda: catat sebagai tugas lanjutan bila tidak dikerjakan di F3-01.
3. Karena opsi berlaku global, aksi lama yang membuat baris (buatLowongan, simpan_rencana_magang) masuk tugas lanjutan Q-16 (kunci idempoten), kecuali opsi dibatasi.

## apps/web/src/app/globals.css
- Kelas `.geser-selesai`: animasi transform + opacity 200 ms dengan kurva token. Sesuai DIRECTION §5 (satu gerak bermakna, <= 300 ms, hanya transform/opacity) dan ANTI-SLOP S40-S42. prefers-reduced-motion global (globals.css baris 128) mematikan durasinya. Aman.
