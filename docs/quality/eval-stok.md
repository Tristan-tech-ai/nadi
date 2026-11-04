# Eval Lempar: produk dan hitung stok (M-02B)

Dijalankan 2026-11-04T17:17:54.192Z oleh `node scripts/eval-stok.ts` (apps/web) terhadap Edge Function baca-berkas produksi Supabase.
Korpus sintetis fixtures/korpus/stok-indeks.json. Benar bila jenis tepat dan semua bidang kunci (fungsi `nilai` di supabase/functions/baca-berkas/inti.ts) cocok dengan jawaban.

**Hasil: 3 dari 3 benar.** Total token tercatat: 4499.

| Berkas | Jenis terbaca | Keyakinan | Panggilan model | Token | Penilaian | Waktu |
|---|---|---|---|---|---|---|
| produk/produk-01.xlsx | produk | 97% | 1 | 1354 | benar | 11.2 dtk |
| opname/opname-01.xlsx | opname | 90% | 1 | 723 | benar | 4.0 dtk |
| opname/opname-02.png | opname | 95% | 1 | 2422 | benar | 3.4 dtk |
