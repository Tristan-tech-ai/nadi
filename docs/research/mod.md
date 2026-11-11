# Riset: fitur buatan pengguna yang aman (Nadi Mod)

Dibaca 11 Nov 2026. Pertanyaan: bagaimana pengguna (atau AI miliknya lewat MCP) bisa menambah fitur sendiri di Nadi tanpa
mengulang dari awal, tanpa membahayakan usaha lain, dan tanpa menjalankan kode tak tepercaya.

## Sumber primer

| # | Sumber | Yang diambil |
|---|---|---|
| 1 | MCP Security Best Practices, spesifikasi 2025-11-25 (modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices) | Server MCP MUST NOT menerima token yang tidak diterbitkan untuk server itu (tanpa token passthrough); server MUST memverifikasi setiap permintaan dan tidak memakai sesi untuk autentikasi; scope minimal + peningkatan bertahap; blokir rentang IP privat/loopback/link-local untuk URL yang diambil server (SSRF), jangan menulis validator IP sendiri yang mudah dikelabui |
| 2 | OWASP Top 10 LLM 2025, LLM01 Prompt Injection (genai.owasp.org/llmrisk/llm01-prompt-injection) | Batasi perilaku model; validasi format keluaran dengan kode deterministik; least privilege dan fungsi yang bisa diperluas ditangani kode, bukan model; persetujuan manusia untuk tindakan berisiko; pisahkan dan tandai konten eksternal; uji serangan rutin dengan model sebagai pengguna tak tepercaya |
| 3 | Odoo 18 Module Manifest (odoo.com/documentation/18.0/developer/reference/backend/module.html) | Modul = manifest metadata (nama, versi semver, depends, data, demo, auto_install). Diambil: manifest berversi + daftar ketergantungan; DITOLAK: hook Python pre/post init (kode bebas) |
| 4 | Odoo 18 Security (odoo.com/documentation/18.0/developer/reference/backend/security.html) | Hak akses per model bersifat aditif antar grup; record rule diperiksa per baris setelah hak akses. Diambil: akses mod per peran (aditif) + aturan baris "milik sendiri"; Nadi menegakkannya di database (RLS), bukan di ORM aplikasi |
| 5 | Shopify Checkout UI Extensions (shopify.dev/docs/api/checkout-ui-extensions) | Ekstensi berjalan di sandbox terisolasi (Web Worker tanpa akses DOM), terbatas pada komponen dan API yang disediakan platform, tidak bisa melihat data sensitif. Diambil: mod hanya memakai komponen tampilan tetap Nadi, tanpa HTML/JS dari pengguna |
| 6 | Airtable Supported Field Types (support.airtable.com/docs/supported-field-types-in-airtable-overview) | 28 tipe bidang termasuk formula, rollup, lookup, count (dihitung). Diambil: daftar tipe bidang tetap + bidang hitung (rumus) dengan tata bahasa sendiri |
| 7 | Supabase Row Level Security (supabase.com/docs/guides/database/postgres/row-level-security) | RLS wajib di skema terekspos; `(select auth.uid())` agar dievaluasi sekali; jangan memakai user_metadata untuk otorisasi; fungsi security definer tidak boleh di skema terekspos tanpa cek peran |
| 8 | Supabase RLS performance (supabase.com/docs/guides/database/postgres/row-level-security-performance) | Indeks kolom yang dipakai kebijakan, filter juga di kueri klien, hindari join di ekspresi kebijakan. Diambil: indeks (perusahaan_id, mod_id, koleksi) pada tabel catatan bersama |

Salesforce Security Implementation Guide ditolak server (403) saat dibaca, jadi tidak dipakai sebagai sumber.

## Keputusan

1. **Mod = data, bukan kode.** Seperti ekstensi Shopify (komponen tetap) dan seperti Airtable (tipe bidang tetap), mod hanya
   menyusun bagian yang sudah ada. Tidak ada eval, tidak ada SQL dari pengguna, tidak ada HTML. Ini juga pola Nadi sendiri
   untuk belajar format (aturan dari model = data yang dijalankan penafsir tetap, diperiksa pengawas bukan AI).
2. **Satu tabel catatan bersama per jenis, bukan tabel per mod.** Membuat tabel dinamis berarti DDL dari pengguna; tabel
   bersama (`perusahaan_id`, `mod_id`, `koleksi`, `data jsonb`) cukup dengan satu kebijakan RLS yang sudah teruji, dan
   validasi tipe dilakukan fungsi database terhadap manifest aktif.
3. **Akses bertingkat seperti Odoo, ditegakkan database.** Akses per peran aditif; aturan baris "milik sendiri" untuk staf.
   Peran yang diberikan mod tidak pernah melebihi peran pemasangnya.
4. **AI hanya menulis draf** (OWASP: persetujuan manusia untuk tindakan berisiko; MCP: least privilege). Menerapkan versi,
   memperbarui, dan mematikan hanya oleh pemilik/admin di UI Nadi.
5. **Token MCP Nadi hanya untuk server MCP Nadi** (tanpa passthrough), dan setiap panggilan alat diperiksa ulang usahanya.
6. **URL dari mod** (webhook, tautan) memakai aturan yang sudah ada di alur: hanya https ke nama host publik, bukan IP,
   localhost, .local, .internal; pengiriman lewat pg_net setelah commit.
7. **Data mod yang dikembalikan ke AI ditandai tak tepercaya** (OWASP: pisahkan konten eksternal), dan instruksi di dalam data
   tidak pernah menjadi perintah.
8. **Uji serangan rutin**: korpus manifest jahat untuk pengawas dan sesi MCP uji yang mencoba menerobos (X-09).
