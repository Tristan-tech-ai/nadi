# Sinyal risiko beban (F3-07, bagian "sinyal risiko beban")

Ditulis 1 Nov 2026. docs/research/serah-terima.md menjanjikan peringatan dini sebelum orang berhenti: beban terlalu berat berminggu-minggu, kerja lintas topi naik, izin sakit naik. Tulisan ini mengubah janji itu jadi rumus dari data yang sudah ada, dengan batas jujur.

## Bahan yang ada (tanpa tabel baru)
- Beban per minggu per orang: app.beban_orang (F3-02) memberi poin, jam (40 sampai F3-06 ada), beban_per_jam, lintas_poin, selesai_n; beban_saya sudah memakai ambang "> 1,5 x rata-rata" untuk tanda di_atas (20261101007000_bagi_adil.sql baris 104).
- Izin sakit: kejadian izin.sakit (catat_izin) dan pengajuan_izin jenis 'sakit' berstatus disetujui. Catatan: sampai Q-24 selesai, kejadian izin jatuh di hari sebelumnya untuk usaha WIB (docs/quality/zona-fungsi.md); sinyal ini memakai pengajuan_izin.mulai (tanggal, bukan waktu kejadian) agar tidak ikut tergeser.
- Lintas topi: kerja.lintas_topi per minggu (dipakai KPI dan peta).

## Rumus (per orang, dihitung tiap Senin untuk 3 minggu penuh terakhir di zona usaha)
1. **Berat berturut-turut**: beban_per_jam orang > 1,5 x rata-rata beban_per_jam tim di minggu yang sama, **3 minggu berturut-turut**. Rata-rata tim hanya dari orang aktif yang punya kerja minggu itu, dan hanya bila n >= 3 (ambang sama dengan beban_saya; dengan 2 orang perbandingan tidak bermakna).
2. **Lintas topi naik**: poin lintas topi 3 minggu terakhir >= 2 x poin lintas topi 3 minggu sebelumnya, dan minimal 3 kerja lintas topi (menghindari 0 -> 1 dibaca "naik tak terhingga").
3. **Izin sakit naik**: hari sakit disetujui 4 minggu terakhir >= 3 dan >= 2 x rata-rata 4 minggu per orang di 12 minggu sebelumnya (bila riwayat < 12 minggu, sinyal ini tidak dihitung dan ditulis "riwayat belum cukup").
Satu orang memunculkan peringatan bila **minimal dua** dari tiga sinyal menyala, atau sinyal 1 sendirian (beban berat adalah sinyal yang bisa ditindaklanjuti pemilik langsung).

## Kalimat (tanpa stigma, VOICE prinsip 6)
- Untuk pemilik saja, di Feed sebagai usulan berjenis info (tanpa tombol "setujui"), dengan tindakan yang bisa dilakukan: "Sari memikul 1,8 kali rata-rata beban tim selama 3 minggu (12, 14, 13 poin per 40 jam). Pertimbangkan membagi kerja kasir ke Budi atau Dewi." Tautan ke Beban minggu ini dan Pembagi kerja adil.
- Tidak pernah memakai kata "berisiko keluar", "tidak loyal", atau skor risiko 0-100. Tidak ditampilkan ke staf lain. Staf yang bersangkutan melihat bebannya sendiri di cermin (sudah ada: "Bebanmu di atas rata-rata").
- Izin sakit tidak pernah disebut sebagai tuduhan; kalimatnya: "Sari mengambil 4 hari sakit dalam 4 minggu, lebih sering dari biasanya. Mungkin perlu ditanya kabarnya." Bukti sakit dan alasan izin tidak ditampilkan di sini (data kesehatan; prinsip minimisasi).

## Batas jujur
- Ini bukan prediksi orang akan berhenti; tidak ada data berhenti yang cukup untuk memvalidasi rumus. Nadi menyebutnya "beban dan kabar tim", bukan "risiko keluar". Validasi baru mungkin setelah F3-07 mencatat berhenti (tabel berhenti) beberapa bulan: hitung berapa orang yang berhenti didahului sinyal ini (presisi/recall), dan matikan sinyal yang tidak membantu.
- Jam 40 tetap untuk semua sampai F3-06; beban_per_jam akan berubah makna setelah jadwal nyata ada.

## Uji
Tes SQL dengan data sintetis 6 minggu: orang dengan beban 1,8x tiga minggu berturut-turut memunculkan peringatan; 2 minggu saja tidak; tim 2 orang tidak; lintas topi 0 -> 1 tidak; izin sakit tanpa riwayat 12 minggu tidak dihitung; staf tidak bisa membaca peringatan (42501); pemilik/admin yang dicabut ditolak (pola Q-21); zona usaha dipakai untuk batas minggu.
