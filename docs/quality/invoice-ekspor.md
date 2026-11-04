# Invoice dan packing list ekspor (B-EKSIM1)

Ditulis 4 Nov 2026. Dasar: docs/research/ekspor-impor.md bagian 3 ("Bisa": invoice dan packing list ekspor berbahasa Inggris dan valuta asing dengan kurs yang dicatat dan sumbernya).

## Apa yang dibangun
- Tabel `public.invoice_ekspor` (migrasi `20261104047000_invoice_ekspor.sql`, sidik md5 tanpa spasi `98896149`). Satu baris = satu pengapalan: pembeli luar negeri, Incoterms 2020 + tempat, pelabuhan muat/tujuan, baris barang (uraian, kode HS isian pengguna, jumlah, satuan, harga USD, berat bersih/kotor kg, koli).
- Kurs Rp per USD (sampai 4 angka di belakang koma), sumber kurs (teks, mis. nomor KMK kurs pajak mingguan), dan tanggal kurs (paling lama 31 hari lalu, tidak di masa depan) disimpan per invoice. Total rupiah = total USD x kurs dibulatkan.
- RPC `buat_invoice_ekspor(p jsonb, p_kunci uuid)` (pemilik/admin/akuntan, idempoten per kunci klien) menghitung ulang total USD (nilai baris dibulatkan sen), berat, dan koli. Penerbitannya:
  - memberi nomor Nomor Sakti `EXP` (`{no:3}/EXP/{bulan_romawi}/{tahun}`);
  - memasang akun `1-210 Tagihan valas belum dibayar (piutang USD)` dan `4-110 Penjualan ekspor` bila belum ada;
  - memposting jurnal rupiah 1-210 / 4-110 dengan keterangan baris `USD x Rp kurs (sumber)`.
- `batal_invoice_ekspor(id, alasan)`: jurnal balik + nomor batal.
- Layar `/app/ekspor` (kamus `ekspor`/`eksporForm`/`eksporPesan`, id dan en) dengan pratinjau total USD, setara rupiah, dan isi packing list (`src/lib/ekspor/hitung.ts`, sama dengan hitungan database). Tautan dari `/app/invoice`.
- Cetak `/cetak/ekspor/<id>`: dua lembar A4 berbahasa Inggris (Commercial invoice, Packing list) untuk pembeli luar negeri. Dokumen mengikuti bahasa penerima, sama dengan `/i` dan cetak surat yang berbahasa Indonesia. Catatan kaki: PEB diajukan terpisah, kode HS dinyatakan eksportir.

## Yang sengaja tidak dikerjakan
- Tidak mengisi atau mengirim PEB ke CEISA, tidak menentukan kode HS (DECISIONS 4 Nov 2026).
- Pelunasan valas dan selisih kurs saat uang masuk belum ada. Jurnal terbit memakai kurs pilihan pengguna; selisih kurs pelunasan perlu aturan pembukuan sendiri dan akan menjadi tugas terpisah bila dibutuhkan.
- Mata uang selain USD belum ada (CHECK `mata_uang = 'USD'`).
- Kurs tidak diambil otomatis dari fiskal.kemenkeu.go.id; pengguna mengisi angka dan sumbernya.

## Bukti
- Tes SQL `supabase/tests/invoice_ekspor.test.sql` 26/26. Tes ini merah dulu: tabel dan fungsi belum ada. Satu salah hitung di harapan tes sendiri (143.675.784) dikoreksi ke 143.672.852 = round(8.821,05 x 16.287,5).
- vitest `src/lib/ekspor/hitung.test.ts` 5/5, merah dulu karena modul belum ada.
- e2e `e2e/invoice-ekspor.spec.ts`, yang menjalankan ini:
  - terbit dan memeriksa total USD 8,821.05 dan Rp143.672.852;
  - kurs dan sumber tampil di daftar, nomor EXP;
  - lembar cetak Inggris dengan total yang sama dan packing list 21 koli, 1,203.000 kg / 1,227.700 kg;
  - batal;
  - axe tanpa pelanggaran serius di 390 dan 1440 px, terang dan gelap;
  - tanpa gulir datar di layar aplikasi.
- e2e `@bahasa-akun` memeriksa `/app/ekspor` dalam mode Inggris.
- Advisor: hanya WARN SECURITY DEFINER dapat dipanggil authenticated untuk dua RPC. Ini pola yang sama dengan `buat_invoice`, dan hak diperiksa di dalam lewat `app.wajib_penagih`.
- Galat yang ditemukan e2e: `<div>` bersarang di dalam `<dl>` (axe definition-list) diperbaiki; berat di layar Indonesia memakai format id.
