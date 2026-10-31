# Kolam Bonus Beban (F3-05)

Ditulis 1 Nov 2026. Kriteria: "pembagian bonus menurut poin kontribusi, dapat diekspor". Janji docs/PLAN.md baris 124: yang rajin dibayar lebih, bukan hanya dibebani lebih.

## Dasar aturan (teks asli PP 36/2021, https://peraturan.go.id/files3/pp-no-36-tahun-2021_asli.pdf, dibaca 1 Nov 2026; pasal ini tidak diubah PP 51/2023 maupun PP 49/2025, lihat docs/research/upah-harian.md)
- **Pasal 8 ayat (2):** selain THR, pengusaha "dapat memberikan pendapatan non-Upah berupa: a. insentif; b. bonus; c. uang pengganti fasilitas kerja; dan/atau d. uang servis".
- **Pasal 10:** "(1) Insentif dapat diberikan oleh Pengusaha kepada Pekerja/Buruh dalam jabatan atau pekerjaan tertentu. (2) Insentif ditetapkan sesuai kebijakan Perusahaan."
- **Pasal 11:** "(1) Bonus dapat diberikan oleh Pengusaha kepada Pekerja/Buruh atas keuntungan Perusahaan. (2) Bonus ... diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama."
- **Pasal 66:** dasar pesangon/UPMK adalah upah pokok + tunjangan tetap, jadi kolam ini tidak masuk dasar pesangon.

Akibat: pembayaran menurut beban kerja paling dekat dengan **insentif** (kebijakan perusahaan), bukan bonus Pasal 11 (keuntungan). Nama fitur tetap "Kolam Bonus Beban" karena itu bahasa pemilik UMKM, tetapi komponen slip berlabel "Insentif beban kerja" dengan keterangan "pendapatan non-upah (PP 36/2021 Pasal 8 dan 10)". Pemilik yang ingin membaginya sebagai bonus keuntungan diberi catatan bahwa bonus diatur di PK/PP/PKB.

## Alur
1. Pemilik membuka /app/kerja?tab=bonus (pemilik saja; admin melihat tanpa menyetujui) dan mengisi: bulan, jumlah kolam (Rp), siapa ikut (bawaan: semua orang aktif yang punya kerja selesai bulan itu; bisa dikecualikan dengan alasan tertulis).
2. Nadi menghitung pembagian = kolam x poin selesai orang / total poin selesai peserta (poin dari kerja.poin_beban, sama dengan KPI F3-03 dan beban F3-02; bukan durasi aktual, jadi yang lambat tidak dihukum dan yang cepat tidak dirugikan). Pembulatan ke rupiah utuh dengan metode sisa terbesar (largest remainder) supaya jumlahnya tepat sama dengan kolam.
3. Pratinjau tabel buku kas: orang, poin, persen, rupiah, alasan satu kalimat dari kerja nyata ("Sari: 42 poin dari 18 kerja, 31% kolam"). Peringatan bila satu orang > 50% kolam ("Sari memikul separuh kerja bulan ini; pertimbangkan beban di Pembagi kerja adil").
4. Setujui: membuat usulan uang untuk pemilik (CHECK Q-17) atau langsung tercatat bila pemilik sendiri yang menyetujui (keputusan tercatat di public.keputusan dan bisa dibatalkan sampai slip bulan itu disetujui). Setelah disetujui, setiap bagian menjadi komponen slip 'insentif_beban' (jenis pendapatan) di periode gaji bulan itu; PPh 21 ikut dihitung susunSlip (masuk bruto bulan dibayar), tidak menambah dasar iuran BPJS (dasar iuran di susunSlip memakai pokok + tunjangan tetap, sama perlakuannya dengan lembur; dicek di apps/web/src/lib/gaji/susun.ts baris 31 dan 69). Dasar hukum bahwa insentif tidak masuk dasar iuran BPJS BELUM TERVERIFIKASI ke aturan BPJS; ini perilaku Nadi saat ini, bukan klaim hukum.
5. Ekspor: CSV (orang, ID staf, poin, persen, rupiah, sumber) dan tautan "Salin ke slip". Staf melihat bagiannya sendiri di cermin kinerja: "Insentif beban Oktober Rp350.000 (12 poin dari 6 kerja)".

## Keadilan dan jujur
- Ambang: kolam tidak bisa dibagi bila total kerja selesai bulan itu < 5 ("Belum cukup kerja tercatat untuk membagi kolam dengan adil").
- Poin hanya dari kerja berstatus selesai; kerja yang dibanding (kpi.banding menunggu) ditandai "sedang dibanding" di pratinjau, tidak dikeluarkan diam-diam.
- Tidak ada model AI dalam angka; poin dan rupiah dari SQL.
- Tidak ada peringkat terbuka antarstaf: staf hanya melihat bagiannya sendiri.

## Data
public.kolam_bonus (id, perusahaan_id, bulan date, jumlah bigint > 0, status draf|disetujui|batal, dikecualikan jsonb [{orang_id, alasan}], dibuat_oleh, disetujui_oleh, kunci_klien unik per usaha) dan public.kolam_bagian (kolam_id, orang_id, poin numeric, persen numeric, rupiah bigint, kerja_ids uuid[]). RPC: hitung_kolam(bulan, jumlah, dikecualikan) -> pratinjau tanpa menulis; simpan_kolam(...) -> draf; setujui_kolam(id) pemilik via app.peran_aktif() = 'pemilik'; kolam_saya(bulan) staf. Tes SQL: jumlah bagian = kolam persis (sisa terbesar), staf hanya bagiannya, admin tidak bisa menyetujui, admin/pemilik yang dicabut ditolak (pola Q-21), isolasi tenant, kerja batal tidak dihitung, ambang 5, idempoten.

## Layar
HP: kartu isian (bulan, Rp kolam, peserta) lalu daftar pratinjau satu kolom; desktop: tabel buku kas + kolom alasan. Satu tombol utama "Setujui pembagian". Rupiah lewat komponen Rupiah (tabular-nums, Rp1.250.000). Keadaan kosong, memuat, galat dirancang.
