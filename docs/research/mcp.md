# Server MCP Nadi (F0-09)

Dibaca 31 Okt 2026 dari spesifikasi resmi revisi **2026-07-28** (modelcontextprotocol.io, sumber di akhir). Kode lama (repo-pkl, revisi 2025-06-18, JSON-RPC tulisan sendiri + OAuth di Postgres) dipakai sebagai titik awal, bukan disalin mentah.

## Yang berubah di 2026-07-28 dan berpengaruh ke Nadi

| Hal | 2025-xx (kode lama) | 2026-07-28 |
|---|---|---|
| Jabat tangan | `initialize` membuat sesi | **Tidak ada.** Setiap permintaan membawa `_meta`: `io.modelcontextprotocol/protocolVersion`, `.../clientInfo`, `.../clientCapabilities` |
| Penemuan server | hasil `initialize` | **`server/discover` wajib**: `supportedVersions`, `capabilities`, `_meta["io.modelcontextprotocol/serverInfo"]`, `instructions`, `ttlMs`, `cacheScope` |
| Sesi HTTP | `Mcp-Session-Id`, GET SSE, DELETE | **Dihapus.** GET/DELETE ke endpoint: 405. `Mcp-Session-Id` dan `Last-Event-ID` diabaikan |
| Header HTTP | `MCP-Protocol-Version` | Wajib `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` (untuk `tools/call`, `resources/read`, `prompts/get`). Harus sama dengan isi body, kalau beda: 400 + JSON-RPC `-32020` HeaderMismatch. `Mcp-Name` boleh `=?base64?...?=` |
| Versi tak didukung | negosiasi di initialize | 400 + `-32022` dengan `data: {supported, requested}` |
| Metode tak dikenal | 200 + -32601 | **404** + `-32601` |
| Hasil | `{tools}` | setiap hasil membawa `resultType: "complete"`; `tools/list` boleh `ttlMs`/`cacheScope` |
| Server ke klien | permintaan di SSE | lewat `InputRequiredResult` (MRTR); Nadi tidak memakainya di v2 |
| Notifikasi klien | 202 | tetap 202 tanpa body |
| Registrasi klien | DCR (`/register`) | **Client ID Metadata Document (CIMD)** SHOULD; DCR usang tapi boleh demi kompatibilitas |
| Penerbit | - | AS SHOULD mengirim `iss` di respons otorisasi (RFC 9207) dan `authorization_response_iss_parameter_supported: true` |

Kompatibilitas: klien lama (`initialize`, tanpa header baru) masih banyak. Spesifikasi mengizinkan server **dua era**: permintaan dengan `_meta` modern dilayani tanpa status; `initialize` memilih semantik lama. Nadi memilih dua era karena asisten pelanggan belum tentu sudah 2026-07-28. Untuk klien lama, Nadi tetap tanpa sesi (tidak mencetak `Mcp-Session-Id`; spesifikasi lama membolehkan server tanpa sesi).

## Rancangan

### Endpoint
- `POST /api/mcp`: satu pesan JSON-RPC per POST (array ditolak di modern; diterima maks 20 untuk era lama seperti kode lama). Respons `application/json` saja (tanpa SSE; semua alat cepat). `Origin` ada dan bukan host sendiri: 403.
- `GET`/`DELETE /api/mcp`: 405 `Allow: POST`.
- `/.well-known/oauth-protected-resource/api/mcp` dan `/.well-known/oauth-protected-resource`: `{resource: "<origin>/api/mcp", authorization_servers: ["<origin>"], scopes_supported: ["nadi.baca", "nadi.usul"], bearer_methods_supported: ["header"], resource_name: "Nadi"}`.
- `/.well-known/oauth-authorization-server`: `issuer` = origin persis, `authorization_endpoint` `/oauth/izinkan`, `token_endpoint` `/api/oauth/token`, `registration_endpoint` `/api/oauth/daftar` (DCR, demi klien lama), `client_id_metadata_document_supported: true`, `authorization_response_iss_parameter_supported: true`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported: ["authorization_code", "refresh_token"]`, `response_types_supported: ["code"]`, `token_endpoint_auth_methods_supported: ["none"]`, `scopes_supported`.
- 401: `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/api/mcp", scope="nadi.baca"`. Alat tulis dengan token tanpa `nadi.usul`: 403 `error="insufficient_scope", scope="nadi.baca nadi.usul"`.

### Token dan tenant
- Token akses buram `nmc_` + 64 hex, hanya sha256-nya disimpan (`mcp_token`: pengguna, perusahaan, cakupan, `resource`, klien, kedaluwarsa 30 hari, dicabut). Token dikunci ke **satu perusahaan** yang dipilih di halaman izin (pengguna bisa punya beberapa usaha) dan ke `resource` = `<origin>/api/mcp` (audiens, RFC 8707). Token dengan `resource` lain ditolak 401.
- Token penyegar `nmr_` (rotasi sekali pakai, 90 hari).
- Server Next memanggil RPC Postgres `mcp_*` dengan kunci publishable (peran anon); setiap RPC SECURITY DEFINER memeriksa token, masa berlaku, cakupan, dan **keanggotaan aktif saat ini** (orang yang dikeluarkan dari usaha langsung kehilangan akses walau tokennya masih berlaku). Tanpa service-role key.
- Peran mengikuti `anggota.peran`; alat untuk pengelola (pemilik/admin) disembunyikan dari `tools/list` untuk staf (spesifikasi membolehkan daftar alat beda per otorisasi).

### Alat v2 (tulisan selalu jadi Usulan)
| Alat | Cakupan | Isi |
|---|---|---|
| `siapa_saya` | baca | usaha, peran, cakupan token, jumlah usulan menunggu |
| `daftar_orang` | baca (pengelola) | orang aktif + topi, tanpa NIK/gaji |
| `daftar_usulan` | baca | usulan menunggu/terbaru (judul, aksi, dampak_rp, sumber) |
| `buat_usulan` | usul | aksi dari daftar putih (`orang.buat`, `uang.keluar`, `izin.sakit`, `tugas.buat`, `catatan`), judul, penjelasan, payload, dampak_rp; masuk Feed dengan sumber `mcp` dan nama klien, harus disetujui pemilik/admin di Nadi |

Ringkasan pemakaian AI, resources, dan prompts menyusul (F0-09B). MCP Apps (kartu persetujuan di chat) menyusul setelah Feed stabil.

### Halaman izin `/oauth/izinkan`
- Validasi parameter: `response_type=code`, `code_challenge_method=S256`, `code_challenge` 43-128 base64url, `resource` (wajib, harus `<origin>/api/mcp`), `state`, `scope` ⊆ didukung.
- `client_id`:
  - URL https dengan path: ambil dokumen CIMD di server (batas 5 KB, 5 dtk, tanpa redirect, tolak host IP privat/localhost/link-local), `client_id` di dokumen harus sama persis, wajib `client_name` dan `redirect_uris`, `redirect_uri` permintaan harus ada di daftar. Disimpan di tembolok `oauth_klien` (berlaku sesuai Cache-Control, maks 24 jam).
  - selain itu: klien DCR terdaftar (`nkc_...`).
- Tampilkan nama klien + host `client_id` (bukan hanya nama yang bisa dipalsukan), usaha yang dipilih, cakupan dalam bahasa sehari-hari. Tombol Izinkan / Tolak. Redirect membawa `code`, `state`, dan `iss`.
- Kode otorisasi sekali pakai 10 menit, PKCE gagal menghanguskan kode (pola kode lama).

### Uji (kriteria terima)
- SQL: token salah/kedaluwarsa/dicabut/resource lain ditolak; anggota nonaktif ditolak; staf tidak melihat alat pengelola; `buat_usulan` tanpa cakupan usul ditolak; isolasi antar usaha; kode sekali pakai; PKCE salah menghanguskan kode; penyegaran berotasi.
- Vitest: parser header (`Mcp-Name` base64, mismatch -32020), versi tak didukung -32022, metode tak dikenal 404, notifikasi 202, era lama `initialize`.
- e2e (Playwright, server lokal): alur OAuth penuh seperti klien MCP: 401 → PRM → metadata AS → izinkan (masuk sebagai akun uji) → kode + `iss` → token (PKCE) → `server/discover` → `tools/call siapa_saya` → `buat_usulan` → usulan muncul di Feed. Klien CIMD diuji dengan dokumen metadata yang dilayani server uji lokal (http localhost diizinkan HANYA di mode uji).

## Sumber (diakses 31 Okt 2026)
- Authorization: https://modelcontextprotocol.io/specification/latest/basic/authorization (revisi 2026-07-28)
- Authorization server discovery: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery
- Client registration (CIMD): https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration
- Transports: https://modelcontextprotocol.io/specification/latest/basic/transports dan .../2026-07-28/basic/transports/streamable-http
- Versioning: https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- server/discover: https://modelcontextprotocol.io/specification/2026-07-28/server/discover
- Tools: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- SDK TypeScript resmi `@modelcontextprotocol/sdk` 1.32.2 (npm, 23 Okt 2026). Tidak dipakai: server cukup kecil dan dua era lebih mudah dikendalikan dengan JSON-RPC tulisan sendiri (pola kode lama).
