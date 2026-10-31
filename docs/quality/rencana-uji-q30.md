# Rencana verifikasi loop untuk Q-30 (daftar beban tanpa jam anggapan)

Ditulis 1 Nov 2026 (tick 200), sebelum kode. Rancangan: docs/design/beban-tanpa-jam.md. Dikerjakan sesudah F3-05 di-commit, karena F3-05 juga mengubah apps/web/src/app/app/kerja/page.tsx.

1. **Merah dulu.**
   - Vitest untuk pembantu `kolomBeban(jamSamaRata)` ditulis sebelum fungsinya ada, dan gagal.
   - Asersi e2e bagi-adil "beban-poin tidak memuat jam saat jam-sama-rata" dijalankan terhadap produksi sekarang (6d76733), yang masih menulis "· 40 jam ·". Hasilnya harus gagal.
2. **Vitest hijau** untuk dua keadaan:
   - sama rata: lebar batang = poin / poin terbesar, `pakaiJam` false;
   - jam dari jadwal: lebar = per jam / per jam terbesar, `pakaiJam` true.

   Seluruh rangkaian vitest tetap hijau.
3. **grep komponen:** kolom "Jam jadwal" dan "Poin per jam" hanya dirender di cabang `pakaiJam`. Testid `beban-per-jam` tidak ada di DOM saat sama rata (dicek oleh e2e).
4. **Foto 390 terang dan gelap, 1440 terang dan gelap,** dibandingkan dengan foto Q-28 (scratchpad/foto-q28):
   - baris HP hanya menulis poin;
   - tabel desktop tiga kolom tanpa ruang kosong yang janggal;
   - urutan dan "paling berat" sama;
   - keterangan tambahan tanpa tanda pisah panjang.
5. **axe tanpa pelanggaran serius**, termasuk kepala tabel `aria-hidden` yang selaras dengan isi baris.
6. **Gate LULUS, push, CI GitHub success.** Deploy produksi lewat git bila kuota sudah pulih (setelah sekitar 14.40 WIB), atau lewat CLI bila apps bersih. Lalu e2e produksi bagi-adil.spec dan kerja.spec.
7. **Kartu KPI dan peta tidak berubah:** e2e kpi.spec dan peta.spec lokal tetap lulus, karena keduanya ada di halaman /app/kerja yang sama.
