# Eval dokumen pabean (B-EKSIM3)

Dijalankan 2026-11-04T05:13:49.608Z oleh `node scripts/eval-pabean.ts` (apps/web) terhadap Edge Function baca-berkas produksi.
Korpus sintetis fixtures/korpus/pabean (dibuat `node scripts/korpus/pabean.mjs`; tata letak meniru elemen formulir PIB BC 2.0 Lampiran PER-44/BC/2011 dan PEB BC 3.0 Lampiran PER-07/BC/2020; semua isi karangan, bertanda CONTOH).
Bidang kunci per jenis: fungsi `nilai` di supabase/functions/baca-berkas/inti.ts (PIB 12 bidang termasuk NDPBM, nilai CIF, nilai pabean, BM, PPN, PPh, jumlah baris, HS baris pertama; PEB 7; SPPB 3).

**Akurasi bidang: 34/34 = 100.0%** (syarat >= 90%). Total token tercatat: 12908.

| Berkas | Jenis terbaca | Keyakinan | Bidang benar | Salah | Usulan | Token | Waktu |
|---|---|---|---|---|---|---|---|
| pabean/pib-01.pdf | pib | 95% | 12/12 | semua benar | ada | 3623 | 11.3 dtk |
| pabean/pib-02.pdf | pib | 92% | 12/12 | semua benar | ada | 3756 | 6.2 dtk |
| pabean/peb-01.pdf | peb | 85% | 7/7 | semua benar | ada | 3274 | 5.8 dtk |
| pabean/sppb-01.pdf | sppb | 95% | 3/3 | semua benar | ada | 2255 | 4.9 dtk |
