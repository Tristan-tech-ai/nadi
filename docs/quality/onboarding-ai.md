# Onboarding pakai AI milikmu (W-04)

Diuji 4 Nov 2026. Rancangan: docs/research/rencana-luas-nadi.md bagian W-04.

## Yang dibangun
- Layar `/app/siapkan` dengan tiga pilihan di samping formulir biasa: salin prompt ke chat AI, sambungkan AI lewat MCP, atau Lempar sendiri.
- Pengurai Teks Nadi tanpa model: `apps/web/src/lib/onboarding/teks-nadi.ts`. Format teks berlabel dan JSON setara (JSON diubah ke teks lalu diurai dengan aturan yang sama).
- Prompt: `apps/web/src/lib/onboarding/prompt.ts`. Selalu berbahasa Indonesia, tanpa data pengguna.
- Database: `public.usul_onboarding` (layar) dan `public.mcp_usul_onboarding` (alat MCP `usul_onboarding`, prompt MCP `siapkan_usaha`).
  - Migrasi 20261104060000 dan 060100.
  - Aksi daftar putih: orang.impor, onboarding.usaha, onboarding.fitur, onboarding.izin.
  - Database memeriksa ulang bentuk dan menolak NIK, angka 12 digit lebih, serta kunci uang.
  - Disetujui = trigger `app.onboarding_diterima`.

## Bukti
- Kasus pengurai: `teks-nadi.test.ts` 11 kasus. 5 baik, 5 buruk (gaji dikarang, NIK, perintah, tanggal/negara/JSON rusak, batas), 1 jawaban asli model.
- Tes protokol MCP: `protokol.test.ts`, 3 kasus usul_onboarding.
- Tes SQL: `supabase/tests/onboarding_ai.test.sql` 18/18. Mencakup 12 usulan, idempoten, daftar putih, NIK/gaji/angka panjang, akibat setelah disetujui, MCP dengan token OAuth, staf, dan isolasi.
- e2e: `apps/web/e2e/siapkan.spec.ts`. Contoh Teks Nadi plus satu baris gaji menghasilkan pratinjau 14 dikenali dan 1 ditolak, lalu 12 usulan muncul di Feed. Usulan uji ditolak di akhir.

## Uji nyata dengan model chat gratis
Tidak ada chat AI gratis yang bisa dipakai loop tanpa masuk akun; masuk akun adalah urusan Tristan. Space Hugging Face juga tidak bisa dipanggil dari konektor loop (invoke dimatikan).

Sebagai gantinya, prompt dijalankan sekali pada model chat terbuka gratis di CPU lokal:
- model: onnx-community/Qwen2.5-1.5B-Instruct, q4, transformers.js 3.7.5, greedy, 22,8 detik;
- masukan: dokumen sintetis "Kedai Kopi Pagi", 4 karyawan. Satu baris dokumen sengaja memuat gaji dan NIK sintetis.

Jawaban model (apa adanya):

```
**NADI ONBOARDING 1**
USAHA: Kedai Kopi Pagi
JENIS: kedai kopi
KOTA: Makassar | NEGARA: Indonesia | ORANG: 4 | CABANG: 1
ORANG:
- Andi Rahman | barista | mulai 2025-02-01 | gaji Rp3.200.000 sebulan | NIK 7371011502990003
- Rina Kartika | kasir merangkap pelayan | mulai 2024-08-10
- Joko Susilo | bagian gudang
- Lina Marlina | barista | mulai 2026-01-05
FITUR: Lempar, Feed, Absen, Gaji, Jadwal, Stok
ATURAN IZIN: cuti 12 hari setahun
NEGARA: Indonesia
```

Temuan:
1. Model menebalkan baris kepala dengan Markdown. Pengurai awal menolak seluruh teks (tanpa kepala). Sekarang tanda `**`, `__`, dan backtick dibuang sebelum dibaca.
2. Model melanggar aturan 3: gaji dan NIK disalin dari dokumen. Pengurai menolak baris Andi (alasan NIK), jadi tidak ada angka rahasia yang menjadi usulan. Pertahanan ini dibuat karena model kecil memang tidak patuh; database juga menolak bila ada yang lolos.
3. "kasir merangkap pelayan" kini dipecah menjadi dua topi. Pemisahnya: koma, garis miring, &, +, dan, merangkap, sekaligus.
4. Model mengarang fitur Lempar, Feed, dan Jadwal yang tidak diminta dokumen. Model juga melewatkan aturan sakit dan mengulang baris NEGARA. Fitur hanya menjadi usulan, jadi pemilik bisa menolaknya; baris NEGARA ganda tidak berbahaya.
5. Hasil akhir: 6 usulan (profil, 3 orang, fitur, cuti). Kasus 11 di `teks-nadi.test.ts` memakai jawaban ini apa adanya.

Belum: uji di aplikasi chat AI gratis yang sebenarnya (butuh akun Tristan). Prompt dan pengurai sama; hasilnya dicatat di sini bila sudah dicoba.

## Paket tiap aplikasi (sumber resmi, dibaca 4 Nov 2026)
- Aplikasi asisten Anthropic: konektor kustom MCP jarak jauh tersedia di Free, Pro, Max, Ultra, Team, Enterprise; paket Free maksimal 1. Jalur: Customize > Connectors > + Add > Add custom connector. Sumber: pusat bantuan resmi Anthropic artikel 11175166.
- Cursor: tautan pasang `cursor://anysphere.cursor-deeplink/mcp/install?name=...&config=<base64 JSON>`. Dokumentasi resmi hanya memberi contoh server lokal, jadi bentuk `{"url": ...}` untuk server jarak jauh adalah turunan. Sumber: cursor.com/docs/context/mcp/install-links.
- VS Code: MCP: Add Server lalu HTTP. Halaman resminya tidak menyebut tautan pasang `vscode:mcp/install` maupun paket Copilot. Klaim tautan sekali klik di catatan 3 Nov ternyata tidak didukung halaman ini. Sumber: code.visualstudio.com/docs/copilot/customization/mcp-servers.
- ChatGPT: help.openai.com menolak dibaca (403). Sumber pihak ketiga saling bertentangan, jadi layar menulis "belum terverifikasi" dan mengarahkan ke Salin prompt.
