// L-06 kamus istilah publik (setara glosarium Mekari dan Kamus HR Talenta): arti sehari-hari, dasar aturan bila ada, dan
// tempat istilah itu dipakai di Nadi. Angka tarif sengaja tidak ditulis di sini; angka yang dipakai menghitung ada di tabel
// aturan bertanggal (dan tampil di alat gratis bersama sumbernya), supaya kamus tidak basi saat aturan berubah.
export type Istilah = { slug: string; istilah: string; arti: string; dasar?: string; tautan: { href: string; label: string }[]; cari: string };

const t = (slug: string, istilah: string, arti: string, tautan: [string, string][] = [], dasar?: string, cari = ""): Istilah =>
  ({ slug, istilah, arti, dasar, tautan: tautan.map(([href, label]) => ({ href, label })), cari });

export const ISTILAH: Istilah[] = [
  t("piutang", "Piutang", "Tagihan yang belum dibayar pelanggan. Di layar pemilik Nadi menyebutnya tagihan belum dibayar.", [["/app/invoice", "Invoice"]], undefined, "tagihan belum dibayar receivable"),
  t("utang-usaha", "Utang usaha", "Tagihan pemasok yang belum kamu bayar.", [["/app/beli", "Pembelian"]], undefined, "hutang payable pemasok"),
  t("invoice", "Invoice", "Tagihan tertulis bernomor yang dikirim ke pelanggan: siapa, apa, berapa, dan kapan jatuh temponya.", [["/app/invoice", "Invoice"]], undefined, "tagihan faktur"),
  t("qris", "QRIS", "Standar kode QR pembayaran nasional. Satu kode bisa dibayar dari aplikasi bank atau dompet digital mana pun.", [["/app/invoice", "Invoice"]], "Standar Bank Indonesia.", "qr bayar pembayaran"),
  t("mutasi-rekening", "Mutasi rekening", "Daftar uang masuk dan keluar di rekening bank dalam satu periode.", [["/app/kas", "Kas dan bank"]], undefined, "rekening koran bank statement"),
  t("rekonsiliasi-bank", "Rekonsiliasi bank", "Mencocokkan catatan kas usaha dengan mutasi rekening, supaya setiap uang masuk dan keluar punya catatannya.", [["/app/kas", "Kas dan bank"]], undefined, "cocokkan mutasi"),
  t("laba-rugi", "Laba rugi", "Laporan pendapatan dikurangi beban dalam satu periode. Hasilnya untung atau rugi.", [["/app/buku", "Laporan keuangan"]], undefined, "untung rugi profit loss"),
  t("neraca", "Neraca", "Laporan aset, utang, dan modal usaha pada satu tanggal.", [["/app/buku", "Laporan keuangan"]], undefined, "balance sheet aset modal"),
  t("arus-kas", "Arus kas", "Laporan uang masuk dan keluar menurut kegiatannya: operasi, investasi, dan pendanaan.", [["/app/buku", "Laporan keuangan"]], undefined, "cash flow"),
  t("buku-besar", "Buku besar", "Kumpulan semua transaksi yang dikelompokkan per akun, misalnya semua yang menyentuh akun kas.", [["/app/buku", "Laporan keuangan"]], undefined, "ledger"),
  t("jurnal", "Jurnal", "Catatan satu transaksi dengan sisi debit dan kredit yang jumlahnya selalu sama.", [["/app/buku", "Laporan keuangan"]], undefined, "debit kredit"),
  t("bagan-akun", "Bagan akun", "Daftar akun yang dipakai untuk mencatat transaksi, misalnya kas, piutang, penjualan, dan beban gaji.", [["/app/buku", "Laporan keuangan"]], undefined, "chart of accounts coa akun"),
  t("hpp", "HPP (harga pokok penjualan)", "Biaya barang yang sudah terjual. Penjualan dikurangi HPP menjadi laba kotor.", [["/app/barang", "Barang dan stok"]], undefined, "cogs harga pokok"),
  t("stok-opname", "Stok opname", "Menghitung stok fisik di gudang atau toko lalu mencocokkannya dengan catatan.", [["/app/barang", "Barang dan stok"]], undefined, "hitung stok inventory"),
  t("aset-tetap", "Aset tetap", "Barang usaha yang dipakai lebih dari setahun, seperti mesin, kendaraan, dan peralatan.", [["/app/aset", "Aset tetap"]], undefined, "fixed asset peralatan"),
  t("penyusutan", "Penyusutan", "Membebankan harga aset tetap sedikit demi sedikit selama masa manfaatnya.", [["/app/aset", "Aset tetap"]], undefined, "depresiasi depreciation"),
  t("landed-cost", "Landed cost", "Total biaya barang impor sampai di gudang: harga barang, ongkos kirim, asuransi, bea masuk, dan pajak impor.", [["/app/impor", "Impor"]], undefined, "biaya impor bea masuk"),
  t("resep-produksi", "Resep produksi (BoM)", "Daftar bahan dan jumlahnya untuk membuat satu barang jadi.", [["/app/produksi", "Produksi"]], undefined, "bill of material bom"),
  t("rab", "RAB", "Rencana anggaran biaya sebuah proyek, dibandingkan dengan realisasinya.", [["/app/proyek", "Proyek"]], undefined, "anggaran proyek"),
  t("kasir", "Kasir (POS)", "Aplikasi untuk mencatat penjualan langsung di toko dan mencetak struk.", [["/app/kasir", "Kasir"]], undefined, "pos point of sale struk"),
  t("pph-21", "PPh 21", "Pajak penghasilan atas gaji, upah, dan imbalan lain yang dipotong pemberi kerja dari penghasilan pekerja.", [["/alat/gaji", "Kalkulator gaji bersih"], ["/app/gaji", "Gaji"]], "UU PPh Pasal 21; PP 58/2023 dan PMK 168/2023.", "pajak gaji"),
  t("ter", "TER (tarif efektif rata-rata)", "Tarif PPh 21 bulanan berdasarkan penghasilan bruto sebulan dan kategori A, B, atau C. Dipakai Januari sampai November; Desember dihitung ulang setahun.", [["/alat/gaji", "Kalkulator gaji bersih"]], "PP 58/2023.", "tarif efektif pph21"),
  t("ptkp", "PTKP", "Penghasilan tidak kena pajak: bagian penghasilan setahun yang bebas pajak, tergantung status kawin dan jumlah tanggungan (TK/0 sampai K/3).", [["/alat/gaji", "Kalkulator gaji bersih"]], "UU PPh Pasal 7.", "tk k status pajak"),
  t("biaya-jabatan", "Biaya jabatan", "Pengurang penghasilan bruto saat PPh 21 pegawai tetap dihitung setahun.", [["/app/gaji", "Gaji"]], "UU PPh Pasal 6; PMK 168/2023.", "pengurang pph21"),
  t("bukti-potong", "Bukti potong (e-Bupot)", "Dokumen yang menunjukkan pajak penghasilan sudah dipotong pemberi kerja atau pembeli.", [["/app/pajak/faktur", "Faktur pajak"]], undefined, "ebupot bupot"),
  t("ppn", "PPN", "Pajak pertambahan nilai atas penyerahan barang atau jasa kena pajak.", [["/app/pajak", "Kompas Pajak"]], undefined, "pajak pertambahan nilai vat"),
  t("pkp", "PKP", "Pengusaha kena pajak: pengusaha yang dikukuhkan untuk memungut dan menyetor PPN.", [["/app/pajak", "Kompas Pajak"]], undefined, "pengusaha kena pajak"),
  t("faktur-pajak", "Faktur pajak", "Bukti pungutan PPN yang dibuat PKP. Di Nadi, faktur hanya untuk dokumen pajak; tagihan ke pelanggan disebut invoice.", [["/app/pajak/faktur", "Faktur pajak"]], undefined, "efaktur"),
  t("coretax", "Coretax", "Sistem administrasi pajak Direktorat Jenderal Pajak untuk lapor, faktur pajak, dan bukti potong.", [["/app/pajak/faktur", "Faktur pajak"]], undefined, "djp pajak online"),
  t("npwp", "NPWP", "Nomor pokok wajib pajak. Untuk orang pribadi penduduk Indonesia, NIK dipakai sebagai NPWP.", [["/app/pajak", "Kompas Pajak"]], "PMK 112/2022.", "nomor pajak nik"),
  t("pph-final-umkm", "PPh final UMKM", "Pajak penghasilan yang dihitung dari omzet untuk usaha dengan peredaran bruto sampai batas tertentu setahun.", [["/app/pajak", "Kompas Pajak"]], "PP 55/2022.", "omzet pajak umkm"),
  t("bpjs-kesehatan", "BPJS Kesehatan", "Jaminan kesehatan nasional. Iurannya dibagi antara pemberi kerja dan pekerja.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "jkn kesehatan"),
  t("bpjs-ketenagakerjaan", "BPJS Ketenagakerjaan", "Program jaminan sosial pekerja: JHT, JKK, JKM, dan JP.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "jamsostek"),
  t("jht", "JHT", "Jaminan Hari Tua: tabungan pekerja yang dibayarkan saat berhenti bekerja, pensiun, atau meninggal.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "jaminan hari tua"),
  t("jkk", "JKK", "Jaminan Kecelakaan Kerja. Iurannya dibayar pemberi kerja menurut tingkat risiko pekerjaan.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "kecelakaan kerja"),
  t("jkm", "JKM", "Jaminan Kematian. Iurannya dibayar pemberi kerja.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "jaminan kematian"),
  t("jp", "JP", "Jaminan Pensiun: iuran bulanan dengan batas upah yang diperbarui setiap tahun.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "jaminan pensiun"),
  t("thr", "THR", "Tunjangan hari raya keagamaan. Wajib dibayar kepada pekerja dengan masa kerja minimal 1 bulan, paling lambat 7 hari sebelum hari raya.", [["/alat/thr", "Kalkulator THR"], ["/app/gaji/thr", "THR di Nadi"]], "Permenaker 6/2016.", "tunjangan hari raya"),
  t("tunjangan-tetap", "Tunjangan tetap", "Tunjangan yang dibayar teratur dan tidak tergantung kehadiran. Bersama gaji pokok menjadi dasar THR, lembur, dan pesangon.", [["/alat/gaji", "Kalkulator gaji bersih"]], undefined, "upah tetap"),
  t("lembur", "Lembur", "Kerja di luar waktu kerja. Upah lemburnya dihitung dari upah sebulan dibagi 173 lalu dikali pengali per jam.", [["/alat/gaji", "Kalkulator gaji bersih"], ["/app/izin", "Izin dan cuti"]], "UU 27/2026 Pasal 116; pengali per jam PP 35/2021 Pasal 31 dan 32 yang tetap berlaku menurut UU 27/2026 Pasal 310.", "overtime jam lembur"),
  t("pkwt", "PKWT", "Perjanjian kerja waktu tertentu (karyawan kontrak). Saat kontrak berakhir pekerja berhak uang kompensasi.", [["/alat/pesangon", "Kalkulator pesangon"]], "UU 27/2026 Pasal 82 (paling lama 2 tahun, diperpanjang paling banyak 2 kali masing-masing 1 tahun) dan Pasal 88; rincian kompensasi PP 35/2021 Pasal 15 sampai 17.", "kontrak kompensasi"),
  t("pkwtt", "PKWTT", "Perjanjian kerja waktu tidak tertentu (karyawan tetap).", [["/app/orang/kerja", "Data kerja"]], undefined, "karyawan tetap"),
  t("pesangon", "Pesangon", "Uang yang dibayar pengusaha saat hubungan kerja berakhir, besarnya menurut masa kerja dan alasan berhenti.", [["/alat/pesangon", "Kalkulator pesangon"]], "UU 27/2026 Pasal 232 sampai 250.", "phk severance"),
  t("upmk", "UPMK", "Uang penghargaan masa kerja: dibayar bersama pesangon untuk masa kerja 3 tahun atau lebih.", [["/alat/pesangon", "Kalkulator pesangon"]], "UU 27/2026 Pasal 232 ayat (3).", "penghargaan masa kerja"),
  t("ump-umk", "UMP dan UMK", "Upah minimum provinsi dan upah minimum kabupaten atau kota, ditetapkan setiap tahun.", [["/app/gaji", "Gaji"]], undefined, "upah minimum umr"),
  t("kasbon", "Kasbon", "Pinjaman karyawan yang dicicil lewat potongan gaji.", [["/app/gaji/kasbon", "Kasbon"]], undefined, "pinjaman karyawan"),
  t("reimburse", "Klaim pengeluaran (reimburse)", "Penggantian biaya yang lebih dulu dibayar karyawan untuk keperluan usaha.", [["/app/klaim", "Klaim pengeluaran"]], undefined, "reimbursement ganti biaya"),
  t("surat-peringatan", "Surat peringatan (SP)", "Teguran tertulis berjenjang kepada pekerja yang melanggar aturan kerja.", [["/app/orang/kerja", "Data kerja"]], undefined, "sp teguran"),
  t("topi", "Topi", "Istilah Nadi untuk peran kerja. Satu orang bisa memakai beberapa topi, misalnya kasir dan admin stok.", [["/app/orang", "Orang"]], undefined, "peran jabatan"),
  t("usulan", "Usulan", "Istilah Nadi untuk perubahan yang disiapkan Nadi atau AI dan menunggu persetujuanmu di Feed.", [["/app", "Feed keputusan"]], undefined, "proposal setujui"),
  t("lempar", "Lempar", "Istilah Nadi untuk mengirim berkas apa saja (foto nota, Excel, PDF) supaya dibaca dan dijadikan usulan.", [["/app/lempar", "Lempar berkas"]], undefined, "unggah upload"),
  t("mcp", "MCP", "Model Context Protocol: standar terbuka agar aplikasi AI seperti ChatGPT atau Gemini bisa memakai alat dari aplikasi lain, misalnya Nadi.", [["/app/siapkan", "Siapkan dengan AI"]], undefined, "model context protocol ai konektor"),
  t("ocr", "OCR", "Membaca teks dari gambar, misalnya foto struk. Di Nadi, OCR berjalan di HP.", [["/app/klaim", "Klaim pengeluaran"]], undefined, "baca teks foto"),
  t("fitur-tambahan", "Fitur tambahan", "Fitur di luar menu inti yang dipasang sesuai kebutuhan usahamu: paket resmi, buatan sendiri, atau disusun AI-mu.", [["/app/tambah-fitur", "Tambah fitur"], ["/app/mod", "Fitur tambahan"]], undefined, "mod plugin ekstensi add-on"),
  t("paket-resmi", "Paket resmi", "Fitur tambahan siap pakai yang disusun dan diuji tim Nadi untuk kebutuhan umum, misalnya log rapat atau armada kendaraan.", [["/app/tambah-fitur", "Tambah fitur"]], undefined, "paket katalog template"),
  t("manifest-fitur", "Manifest fitur", "Susunan sebuah fitur tambahan dalam bentuk data: bagian, isian, alur status, tampilan, dan siapa yang boleh mengisi. Nadi menjalankannya tanpa kode dari luar.", [["/app/tambah-fitur/buat", "Susun fitur"]], undefined, "json manifest skema mod"),
  t("draf-fitur", "Draf fitur", "Fitur yang sudah disusun tetapi belum aktif. Draf diperiksa pemeriksa Nadi dan baru dipakai setelah pemilik atau admin menerapkannya.", [["/app/tambah-fitur", "Tambah fitur"]], undefined, "draft terapkan apply"),
];

export const istilah = (slug: string) => ISTILAH.find((i) => i.slug === slug) ?? null;

/** Cari tanpa model: setiap kata harus ada di istilah, arti, atau kata cari; istilah diberi bobot lebih. */
export function cariIstilah(q: string): Istilah[] {
  const kata = q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((k) => k.length > 1);
  if (!kata.length) return [];
  const skor = (i: Istilah) => {
    const judul = i.istilah.toLowerCase();
    const isi = `${i.arti} ${i.cari} ${i.dasar ?? ""}`.toLowerCase();
    let s = 0;
    for (const k of kata) { if (judul.includes(k)) s += 3; else if (isi.includes(k)) s += 1; else return 0; }
    return s;
  };
  return ISTILAH.map((i) => [i, skor(i)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
}
