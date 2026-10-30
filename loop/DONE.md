# Definisi 100% jadi

Loop berhenti hanya saat `python -I loop/done_check.py` menulis `loop/DONE_OK`. Skrip itu memeriksa:

1. Semua tugas wajib di `loop/WORK_QUEUE.json` selesai dengan bukti (pembatalan maksimal 10%, masing-masing beralasan).
2. DONE-01: skenario "satu hari di warung" lulus di URL produksi lewat Playwright:
   - pemilik daftar, buat perusahaan, pasang paket F&B;
   - lempar 10 berkas campuran, terima usulan;
   - staf absen lewat QR berputar dan selfie, ajukan izin, dan izin disetujui otopilot;
   - lowongan dibuka, kandidat melamar dari HP dan diwawancara suara, tawaran dikirim;
   - tugas dibagi adil, KPI tampil dengan penjelasan;
   - surat bernomor dibuat dan QR verifikasinya valid;
   - invoice ditagih dan dicocokkan dengan mutasi;
   - posisi pajak tampil dengan dasar hukum;
   - Mata membaca video meja dan Peta Usaha berubah;
   - Sarapan Data terkirim;
   - asisten AI pelanggan terhubung lewat MCP dan membuat usulan.
3. Gerbang kualitas lulus di HEAD, semua commit ter-push, produksi menjawab 200.
4. Tidak ada tugas `fix` terbuka.

Ambang kualitas yang berlaku untuk setiap fitur, bukan hanya di akhir:
- **Uji**: tes unit untuk logika, tes SQL untuk setiap tabel atau fungsi baru (termasuk isolasi tenant), e2e untuk alur utama.
- **Antarmuka**:
  - axe tanpa pelanggaran serius;
  - Lighthouse mobile: performa minimal 90, aksesibilitas 100;
  - tangkapan layar 390 px dan 1440 px, terang dan gelap, ditinjau terhadap `docs/design/ANTI-SLOP.md`.
- **Teks**: lolos `docs/design/VOICE.md`.
- **Keamanan**: get_advisors security tanpa ERROR, pemindai rahasia bersih.
