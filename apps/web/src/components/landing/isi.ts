// Isi landing (D-11, docs/design/iterasi/landing). Hanya fitur yang sudah berjalan di produksi dan teruji e2e; angka rupiah
// adalah contoh dari usaha contoh /demo (data sintetis), angka uji dari docs/quality.
export type Peran = "Pemilik" | "Admin" | "Staf" | "Akuntan" | "Nadi";

export type BarisHari = { jam: string; peran: Peran; kejadian: string; nadi: string };

/** Satu hari di warung, urut jam. */
export const HARI: BarisHari[] = [
  { jam: "07.55", peran: "Staf", kejadian: "Sari datang dan absen di tablet pintu.", nadi: "Kode QR berganti tiap 15 detik dan ada cek kedip, jadi absen tidak bisa dititipkan lewat foto." },
  { jam: "08.10", peran: "Pemilik", kejadian: "Pemilik membuka HP sambil sarapan.", nadi: "Sarapan Data: paling banyak 3 kabar berangka, misalnya 2 tagihan lewat jatuh tempo. Tidak ada kabar penting, tidak ada pesan." },
  { jam: "09.30", peran: "Admin", kejadian: "Nota pemasok datang, difoto.", nadi: "Lempar Saja membaca barang, harga, dan total, lalu mencocokkan jumlah per baris. Nota berikutnya dari pemasok yang sama dibaca tanpa AI." },
  { jam: "10.05", peran: "Staf", kejadian: "Budi izin sakit lewat HP.", nadi: "Disetujui otomatis bila sesuai aturan yang kamu pasang (batas hari, bukti), dengan alasan tertulis. Pemilik bisa membatalkan." },
  { jam: "12.30", peran: "Nadi", kejadian: "Jam makan siang, meja penuh.", nadi: "Mata membaca kamera di perangkatmu: meja terisi, kosong, dan panjang antrean muncul di Peta Usaha secara langsung. Gambar tidak diunggah." },
  { jam: "14.00", peran: "Pemilik", kejadian: "Pesanan katering kantor sebelah.", nadi: "Invoice bernomor dengan QRIS milikmu, halaman bayar untuk pelanggan, dan pengingat H-3 yang kamu kirim sendiri lewat WhatsApp." },
  { jam: "15.20", peran: "Admin", kejadian: "Mutasi bank minggu ini diunduh.", nadi: "Cocok mutasi menandai tagihan yang sudah dibayar tanpa AI. Yang ragu ditampilkan sebagai pilihan, melunasi tetap lewat tombolmu." },
  { jam: "16.00", peran: "Admin", kejadian: "Menyusun jadwal minggu depan.", nadi: "Usulan jadwal per topi (peran kerja) mengikuti batas jam kerja PP 35/2021. Staf bisa melepas shift ke rekan bertopi sama." },
  { jam: "19.00", peran: "Pemilik", kejadian: "Butuh satu pelayan baru.", nadi: "Lowongan diperiksa dari kalimat yang diskriminatif, pelamar menjawab wawancara lewat rekaman suara, kamu mendengar klipnya." },
  { jam: "21.00", peran: "Nadi", kejadian: "Warung tutup.", nadi: "Analis Malam menyusun kabar untuk besok pagi dan Alur nyata menunjukkan tagihan mana yang lunas terlambat tanpa pengingat." },
  { jam: "Akhir bulan", peran: "Akuntan", kejadian: "Gaji dan tutup buku.", nadi: "Slip gaji dengan PPh 21 dan BPJS, Gerbang Gaji menahan rekening ganda atau karyawan tanpa absen, ekspor BPMP untuk Coretax, kunci bulan." },
];

export type IsiPeran = { peran: Exclude<Peran, "Nadi">; ringkas: string; fitur: string[] };

/** Siapa memakai apa. */
export const PERAN: IsiPeran[] = [
  { peran: "Pemilik", ringkas: "Memutuskan dari HP dengan satu tangan.", fitur: ["Feed Keputusan: setujui atau tolak usulan", "Sarapan Data tiap pagi", "Gaji dan slip, Gerbang Gaji", "Invoice dan QRIS", "Peta Usaha langsung", "Kompas Pajak UMKM"] },
  { peran: "Admin", ringkas: "Merapikan berkas tanpa mengetik ulang.", fitur: ["Lempar nota, KTP, Excel, CSV mutasi", "Jadwal shift dan lembur", "Lowongan, pelamar, wawancara suara", "Surat keluar bernomor dan agenda surat masuk", "Cocok mutasi bank"] },
  { peran: "Staf", ringkas: "Satu tugas per layar, tanpa email.", fitur: ["Masuk dengan kode usaha, ID staf, dan PIN", "Absen dari HP atau tablet pintu", "Ajukan izin dan lihat alasannya", "Slip gaji sendiri", "Lepas atau ambil shift"] },
  { peran: "Akuntan", ringkas: "Data rapi tanpa minta file.", fitur: ["Ruang Akuntan untuk beberapa usaha", "Buku besar dan kunci bulan", "Ekspor BPMP PPh 21 untuk Coretax", "Melihat dan mengekspor tanpa bisa menyetujui gaji"] },
];

/** Bukti yang bisa diperiksa (angka uji internal, docs/quality). */
export const BUKTI: { angka: string; isi: string }[] = [
  { angka: "5 dari 5", isi: "tata letak berkas contoh terbaca ulang tanpa AI setelah dibaca sekali" },
  { angka: "91,7%", isi: "ketepatan Mata membaca status meja pada video uji, dihitung di perangkat" },
  { angka: "0", isi: "keputusan uang yang diambil AI sendiri: AI hanya mengusulkan" },
  { angka: "20 contoh", isi: "hitungan PPh 21 resmi yang dicocokkan sampai rupiah" },
];

export const FAQ: { tanya: string; jawab: string }[] = [
  { tanya: "Apakah Nadi sudah bisa dipakai?", jawab: "Ya. Semua yang ada di halaman ini sudah berjalan. Selama masa uji semua paket gratis dan belum ada tagihan." },
  { tanya: "Apakah AI bisa mengubah data tanpa izinku?", jawab: "Tidak. AI membaca berkas dan mengusulkan. Data baru tercatat setelah kamu setujui. Yang berjalan otomatis hanya aturan yang kamu pasang sendiri, seperti izin sakit, dan setiap keputusan otomatis tercatat dan bisa dibatalkan." },
  { tanya: "Dataku disimpan di mana?", jawab: "Di database di Singapura. Data setiap usaha dipisah dan diperiksa per baris. NIK tidak disimpan utuh, hanya sidik acak dan 4 digit akhirnya." },
  { tanya: "Apakah aku perlu WhatsApp Business?", jawab: "Tidak. Kamu bisa membagikan foto dari WhatsApp ke Nadi, dan pesan ke pelanggan atau karyawan dikirim lewat WhatsApp di HP-mu sendiri." },
  { tanya: "Apakah karyawan perlu email?", jawab: "Tidak. Staf masuk dengan kode usaha, ID staf, dan PIN 6 angka." },
  { tanya: "Apakah Nadi menggantikan aplikasi kasir?", jawab: "Tidak. Nadi mengurus pekerjaan di belakang kasir: nota, karyawan, absen, gaji, tagihan, dan pembukuan." },
  { tanya: "Seberapa bisa dipercaya hitungan PPh 21-nya?", jawab: "Tarif dan aturan diambil dari PP 58/2023 dan PMK 168/2023, lalu dicocokkan dengan 20 contoh resmi sampai rupiah. Angka yang belum terverifikasi tidak dipakai dan diberi peringatan. Tetap periksa bersama akuntanmu." },
  { tanya: "Bagaimana kalau internet putus?", jawab: "Nadi bisa dipasang di HP seperti aplikasi. Saat sinyal hilang, halaman luring muncul dan isianmu tidak hilang." },
];

export const SEDANG_DIBUAT: string[] = [
  "Tampilan bahasa Inggris",
  "Kamera CCTV lewat kotak kecil di tempat usaha (sekarang Mata memakai kamera HP atau laptop)",
];
