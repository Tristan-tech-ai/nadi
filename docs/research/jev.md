# Jev (TypeSafe AI): cara akses, harga, batas, format keputusan

Diriset 31 Okt 2026 (sesi loop, tick 17). Semua angka dari sumber yang disebut; yang tidak ditemukan ditulis "tidak ditemukan", bukan ditebak.

## Apa itu
Jev adalah model keputusan "System One" dari TypeSafe AI, bukan LLM generatif. Ia menerima **state** (teks) dan **pertanyaan bertipe**, lalu mengembalikan jawaban terstruktur dalam satu jalan: pilihan (choice), skor bertingkat (score), atau peluang ya/tidak (boolean/predicate). Beberapa pertanyaan dijawab sekaligus dalam satu permintaan. Situs resmi menyebut Jev masih **early access**.

## Jalur akses (terverifikasi 31 Okt 2026, 20:56 UTC)

| Jalur | Endpoint | Autentikasi | Uji tanpa kredensial |
|---|---|---|---|
| API TypeSafe langsung | `POST https://api.typesafe.ai/v1/systemone` | `Authorization: Bearer $TYPESAFE_API_KEY` (konsol: console.typesafe.ai) | 403 `authentication_error: Must supply an API key!` |
| Vercel AI Gateway | `POST https://ai-gateway.vercel.sh/v1/evaluate`, atau `.../typesafe/v1/systemone`, atau AI SDK `experimental_decide` + `gateway.decisionModel('typesafe-ai/jev')` | `AI_GATEWAY_API_KEY`, atau `VERCEL_OIDC_TOKEN` otomatis di deployment Vercel (tanpa kunci terpisah) | 401 `Authentication failed` |
| OpenRouter | hanya `typesafe/jev-router` (router LLM yang memakai Jev untuk memilih model), bukan API keputusan Jev | kunci OpenRouter | tidak diuji (bukan yang dibutuhkan) |

Model di AI Gateway (daftar publik `GET https://ai-gateway.vercel.sh/v1/models`): `typesafe-ai/jev` (teks), `typesafe-ai/jev-1.13.0` dan `typesafe-ai/jev-1.14.0` (teks + gambar), tipe `evaluation`, konteks 32.000 token, region `us`, `no_training: all`.

## Harga dan batas
- **Harga:** $0,042 per juta token input ($42 per miliar); token output gratis. Sama di docs TypeSafe dan daftar model AI Gateway (`input: 0.000000042`, `output: 0`).
  Sebagai pembanding, baca satu nota di baca-berkas sekitar 500-600 token (lihat docs/quality/eval-lempar.md); keputusan Jev atas ringkasan teks seukuran itu kurang dari Rp1.
- **Konteks:** 64 rb token per permintaan, 32 rb per pertanyaan (docs TypeSafe); 32 rb di AI Gateway. Header `TypeSafe-Danger-Zone-Long-Context: true` menaikkan ke 262 rb dengan akurasi lebih rendah.
- **Batas laju:** per organisasi (token/detik dan permintaan/detik), angka tidak dipublikasikan; lewat batas: 429.
- **Streaming:** tidak ada. **SLA:** tidak ditemukan. **Free tier:** tidak disebut di situs TypeSafe.
- **Versi:** Jev 1.14 tersedia sejak 14 Okt 2026; `jev-latest` dan `jev-preview` menunjuk 1.14.0.

## Format keputusan
Permintaan (TypeSafe, contoh LiteLLM): `{ model, state, questions: { <nama>: { type: "choice", instructions, criteria: { <opsi>: <keterangan> } } } }`.
Jawaban: `{ model, answers: { <nama>: { type, choice, probabilities, confidence } }, usage: { input_tokens, output_tokens } }`.

AI Gateway `/v1/evaluate`: `{ model, state, questions: { <nama>: { type: "boolean", instructions } } }` menjawab `{ model, answers: { <nama>: { type: "boolean", probability } }, usage: { inputTokens, outputTokens }, providerMetadata.gateway.cost }`.
Bentuk "decisions" ala OpenAI di AI Gateway: tipe `predicate` (probability), `choice` (1-255 pilihan; choice, confidence, probabilities), `score` (2-10 level; score, confidence, probabilities). Pertanyaan yang ditolak model dijawab `{ type: "refusal" }`.

AI Gateway punya **decision fallback** bawaan: `providerOptions.gateway.models: [{ model, when: { question, probabilityBetween: [0.4, 0.6] } }]` meneruskan ke model lain bila keyakinan Jev di rentang ragu.

## Dipakai di Nadi untuk apa
Gerbang keputusan cepat sebelum LLM (tangga kecerdasan):
1. **Rute Feed:** usulan masuk ke pemilik atau cukup admin; mendesak atau tidak (choice/boolean atas judul + penjelasan).
2. **Izin dan cuti:** apakah alasan izin cocok dengan aturan perusahaan (boolean dengan instruksi dari aturan tertulis).
3. **Keadilan tugas (P11):** apakah pembagian kerja minggu ini timpang (score 0-4 atas ringkasan beban kerja).
4. **Penilaian HR (P16):** rubrik wawancara atau CV terhadap topi yang dicari (score per kriteria).

Ambang: keyakinan >= 0,85 langsung dipakai; 0,5-0,85 diteruskan ke model ringan dengan keluaran terstruktur; di bawah itu jadi usulan untuk manusia.

## Fallback (berlaku sampai Jev bisa dipanggil)
Model ringan yang sudah dipakai baca-berkas (ID di tabel `konfigurasi.model_ai`), dengan keluaran terstruktur yang meniru bentuk jawaban Jev: `{ choice: enum, probabilities: {...}, confidence }`. Bentuk ini dipilih supaya pemanggil tidak berubah saat Jev diaktifkan; hanya adapternya yang berganti.

## Status spike
**Uji nyata 31 Okt 2026 10.10 WITA (tick 34, R-02B):** route sementara `/api/cek-jev` di produksi (commit 3285a9f, dihapus setelah uji) memanggil `POST https://ai-gateway.vercel.sh/v1/evaluate` dengan token OIDC dari header `x-vercel-oidc-token` dan model dari env `NADI_MODEL_KEPUTUSAN`.
- Tanpa JWT pemilik: 401 (817 ms dari luar). Dengan JWT pemilik: route jalan, OIDC **diterima** (bukan 401), tetapi gateway menjawab **403** dalam 694 ms: `AI Gateway requires a valid credit card on file to service requests ... add a card and unlock your free credits.`
- Artinya: jalur teknis (OIDC deployment, bentuk permintaan, auth pemilik) sudah benar; yang kurang hanya kartu di tim Vercel. Itu urusan pembayaran, diteruskan ke loop/UNTUK-TRISTAN.md. Loop tidak menambah kartu atau membeli apa pun.
- Belum ada jawaban model, usage, atau biaya nyata. Saat kartu sudah ada, ulangi uji (tugas R-02C) dengan pustaka `apps/web/src/lib/jev.ts` (panggilKeputusan, bentukKeputusan, langkahBerikut; 7 tes unit).
- Sampai itu, gerbang keputusan memakai fallback model ringan dengan bentuk jawaban yang sama (`Keputusan`: pilihan, peluang, yakin).

## Sumber (diakses 31 Okt 2026)
1. TypeSafe, ringkasan model Jev: https://docs.typesafe.ai/models
2. TypeSafe, situs (early access, harga, konsol): https://www.typesafe.ai
3. Vercel AI Gateway, decision models: https://vercel.com/docs/ai-gateway/modalities/decision
4. Vercel AI Gateway, decision fallbacks: https://vercel.com/docs/ai-gateway/models-and-providers/decision-fallbacks
5. Vercel AI Gateway, OIDC: https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc
6. Daftar model AI Gateway (publik): https://ai-gateway.vercel.sh/v1/models
7. LiteLLM pass-through TypeSafe (contoh request/response): https://docs.litellm.ai/docs/pass_through/typesafe
8. TanStack AI adapter TypeSafe: https://tanstack.com/ai/latest/docs/adapters/typesafe.md
9. Daftar model OpenRouter (`typesafe/jev-router`): https://openrouter.ai/api/v1/models
