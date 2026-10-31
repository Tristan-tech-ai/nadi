# Layar Nomor Sakti (F4-01)

Ditulis 1 Nov 2026, pasangan docs/research/nomor-sakti.md.

## Pengaturan penomoran (/app/perusahaan, kartu "Penomoran dokumen")
- Satu baris per jenis dokumen (Surat keputusan, Surat tugas, Invoice, Agenda surat): templat dalam huruf mono, contoh nomor berikutnya ("Nomor berikutnya: 013/WRG/SK/XI/2026"), dan kapan reset (tahunan/bulanan, diturunkan dari templat).
- Ubah templat lewat isian dengan sisipan token yang bisa diketuk ({no:3}, {kode}, {jenis}, {bulan_romawi}, {tahun}); pratinjau langsung di bawahnya. Templat yang tidak memuat {no} ditolak dengan pesan "Templat butuh {no} supaya nomor tidak kembar."

## Daftar nomor terpakai (/app/surat, tab "Nomor")
- Tabel bergaris buku kas: nomor (mono), dokumen, tanggal, status. Nomor batal tetap tampil dengan cap "BATAL" dan alasannya, bukan dihapus.
- Saringan per jenis dan per tahun. Tidak ada lubang yang tak terjelaskan: bila nomor 012 batal, barisnya ada.

## Keadaan
Kosong ("Belum ada nomor terpakai. Nomor pertama dibuat saat dokumen pertama disetujui."), memuat (skeleton baris), galat.
