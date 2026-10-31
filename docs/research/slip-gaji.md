# Slip gaji (F1-05): rancangan

Ditulis 31 Okt 2026 sebelum kode. Angka aturan (TER, PTKP, Pasal 17, BPJS, lembur) ada di `docs/research/gaji.md` dan `gaji-aturan.json` (riset sumber resmi). Berkas ini mengatur bentuk data, alur, dan batasnya.

## Prinsip
1. **Hitungan murni dan teruji.** Satu modul TypeScript `src/lib/gaji/` tanpa akses jaringan: masukan (komponen, status PTKP, aturan bertanggal) menjadi keluaran (rincian per baris). Tes unit memakai contoh resmi dari `gaji.md` (minimal 5 kasus PPh 21 TER, BPJS, lembur) dan harus cocok sampai rupiah.
2. **Aturan adalah data.** Tarif dibaca dari `aturan_bertanggal` sesuai tanggal periode. Baris `terverifikasi=false` tidak dipakai otomatis: slip tetap bisa dibuat, tetapi komponen itu dikosongkan dan slip memuat peringatan "Tarif BPJS Kesehatan belum diperiksa ke sumber resmi. Isi manual atau tunggu pembaruan Nadi." Pemilik bisa mengisi angka sendiri (tercatat sebagai isian manual).
3. **Tidak ada fitur penghindaran pajak.** Nadi menghitung sesuai aturan; tidak ada saran mengecilkan pajak di luar ketentuan.
4. **Gerbang Gaji dulu.** Sebelum periode disetujui, `gerbang_gaji()` dijalankan; orang yang punya temuan ditahan (cap "Ditahan") sampai pemilik memeriksa dan melepasnya dengan alasan.

## Data
- `periode_gaji`: usaha, bulan (tanggal 1), status `draf | disetujui | dibayar`, disetujui_oleh/at, catatan.
- `slip_gaji`: periode, orang, `komponen jsonb` (daftar baris: kode, label, jenis `pendapatan|potongan|pemberi_kerja`, nilai, sumber `aturan:<kunci>@<tanggal>|manual|absen|lembur`), bruto, potongan, neto (dihitung ulang di database dari komponen, bukan dipercaya dari klien), `ditahan` + alasan, `peringatan text[]`.
- Gaji pokok dan tunjangan tetap diambil dari `orang_rahasia.gaji`; status PTKP dari `orang_rahasia.gaji.ptkp` (isian pemilik, mis. `TK/0`, `K/1`).
- Lembur dari kejadian `lembur.*` (jam per hari dan jenis hari) bila ada; v1 juga boleh isian manual jam lembur per orang.

## Alur
1. Pemilik/admin membuka "Gaji bulan ini": Nadi menyiapkan draf untuk semua karyawan aktif bergaji, menjalankan Gerbang Gaji, menghitung komponen.
2. Draf bisa disunting per baris (isian manual dicatat sumbernya).
3. Setujui periode (pemilik, atau admin yang lolos pemisahan tugas). Setelah disetujui, slip dikunci; perubahan berikutnya lewat koreksi bertanggal, bukan menimpa.
4. Slip tautan aman: setiap slip punya token buram `nms_` (hanya hash disimpan, seperti token kios), berlaku 30 hari, bisa dicabut; tautan dibagikan lewat wa.me oleh pemilik. Staf yang punya akun juga melihat slipnya di aplikasi tanpa tautan.

## Tampilan slip (dokumen resmi, sapaan "Anda" boleh di cetak)
Kepala: nama usaha, periode, nama dan ID staf. Badan: pendapatan, potongan, iuran yang ditanggung pemberi kerja (sebagai informasi), neto. Angka rupiah `Rp1.250.000`, tabular. Kaki: dasar hitung (mis. "PPh 21 memakai TER kategori A, PMK 168/2023"), peringatan bila ada aturan yang belum terverifikasi.

## Tes yang direncanakan
- Unit: contoh resmi PPh 21 TER (>= 5), BPJS (>= 1), lembur (>= 1); pembulatan; batas upah BPJS; masa Desember memakai Pasal 17 setahun (bila contoh resmi tersedia).
- SQL: isolasi usaha, staf hanya melihat slipnya, slip disetujui tidak bisa diubah, aturan belum terverifikasi tidak dipakai, orang bertemuan Gerbang Gaji ditahan, token slip hanya membuka satu slip dan bisa dicabut.
- e2e: pemilik membuat draf, melihat peringatan, menyetujui; staf membuka slip lewat tautan di HP.
