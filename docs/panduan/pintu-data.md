# Pintu data: kirim penjualan, pesanan, atau mutasi ke Nadi

Pintu data adalah alamat khusus usahamu. Aplikasi lain, atau alat alur kerja seperti n8n dan Make, bisa mengirim data ke sana.
Setiap kiriman menjadi **satu usulan** di Feed. Tidak ada yang tercatat sampai pemilik atau admin menyetujuinya.

## 1. Buat token
1. Buka **Usahamu** di Nadi, bagian **Pintu data**.
2. Isi nama pintu, mis. "Toko online", dan batas kiriman per hari (bawaan 100).
3. Tekan **Buat pintu**. Token `nmi_...` tampil sekali saja. Simpan di tempat aman, mis. kredensial n8n atau Make.
4. Token yang tidak dipakai lagi dicabut di bagian yang sama. Kiriman dengan token itu langsung ditolak.

## 2. Bentuk kiriman
- Alamat: `https://nadiusaha.my.id/api/pintu`, metode `POST`.
- Header: `Authorization: Bearer nmi_...`.
- Header pilihan: `Idempotency-Key` (kiriman ulang dengan kunci sama tidak menggandakan usulan; tanpa header ini, isi yang sama persis juga dianggap sama), `X-Nadi-Asal` (nama aplikasi pengirim, tampil di usulan).
- Isi JSON: `{"jenis": "penjualan", "baris": [ ... ]}`. CSV juga bisa: `Content-Type: text/csv` dan `?jenis=penjualan` di alamat, judul kolom sama dengan nama bidang.
- Tanggal selalu `YYYY-MM-DD`. Rupiah ditulis angka bulat tanpa titik, mis. `54000`.
- Paling banyak 500 baris dan 1 MB per kiriman.

| Jenis | Bidang per baris | Disetujui menjadi |
|---|---|---|
| `penjualan` | `tanggal`, `jumlah` wajib; `nomor`, `keterangan`, `metode` (tunai, transfer, qris, kartu, marketplace; bawaan transfer) | Jurnal penjualan per baris: tunai ke Kas, lainnya ke Bank |
| `pesanan` | `nomor`, `pelanggan`, `uraian`, `jumlah` (banyak barang), `harga` wajib; `tanggal` | Satu dokumen pesanan (SO) per nomor di Penjualan |
| `mutasi` | `tanggal`, `jumlah`, `arah` (DB keluar, CR masuk) wajib; `keterangan`, `cabang`, `saldo` | Mutasi di rekening bank pertama, lalu dicocokkan di Kas |

Contoh:

```json
{"jenis": "penjualan", "baris": [
  {"tanggal": "2026-11-04", "nomor": "TK-101", "keterangan": "Kopi susu 3", "jumlah": 54000, "metode": "qris"},
  {"tanggal": "2026-11-04", "jumlah": 25000, "metode": "tunai"}
]}
```

Jawaban:
- `201`: diterima, isi `{"usulan": "...", "status": "menunggu", "baris": 2}`.
- `200`: kiriman yang sama sudah diterima, isi `"sudah": true`.
- `401`: token salah atau sudah dicabut.
- `422`: isi salah. Pesannya menyebut nomor baris, mis. "Baris 2: tanggal harus YYYY-MM-DD".
- `429`: batas kiriman per 24 jam tercapai.

## 3. n8n
1. Tambah node **HTTP Request** setelah node yang menghasilkan data (mis. pemicu jadwal dan node toko online).
2. **Method**: POST. **URL**: alamat di atas.
3. **Authentication**: kredensial generik jenis Header auth. Name `Authorization`, Value `Bearer nmi_...`.
4. Nyalakan **Send Body**. **Body Content Type**: JSON. **Specify Body**: Using JSON.
5. Isi JSON dengan ekspresi n8n, mis. `{"jenis": "penjualan", "baris": {{ JSON.stringify($json.baris) }} }`.
6. Bila perlu kunci sendiri, nyalakan **Send Headers** dan tambah `Idempotency-Key` dari nomor pesanan atau tanggal.

## 4. Make
1. Tambah modul **HTTP** > **Make a request**.
2. **URL**: alamat di atas. **Method**: POST.
3. **Headers**: `Authorization` = `Bearer nmi_...`, dan bila perlu `Idempotency-Key`.
4. **Body content type**: application/JSON. **Body input method**: JSON string.
5. **Body content**: JSON seperti contoh di atas, dengan nilai dipetakan dari modul sebelumnya.
6. Nyalakan **Parse response** supaya nomor usulan bisa dipakai modul berikutnya.

Zapier dan aplikasi lain memakai pola yang sama: POST JSON dengan header Authorization.

Sumber label: dokumentasi resmi node HTTP Request n8n (docs.n8n.io) dan aplikasi HTTP Make (apps.make.com/http), dibaca 5 Nov 2026.
