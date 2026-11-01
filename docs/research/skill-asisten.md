# Paket skill asisten AI per usaha (F6-05)

Ditulis 1 Nov 2026. Masalah: asisten AI milik pemilik (lewat MCP, F0-09) tahu cara memanggil alat Nadi, tetapi tidak tahu cara kerja
usaha itu (topi, aturan izin, penomoran, bagan akun) dan aturan main Nadi (semua perubahan lewat usulan, rupiah bulat, tanpa NIK).

## Sumber (dibaca 1 Nov 2026)
- Spesifikasi Agent Skills, https://agentskills.io/specification: folder bernama sama dengan `name`, berisi `SKILL.md` dengan
  frontmatter YAML `name` (1-64, huruf kecil/angka/tanda hubung, tidak diawali/diakhiri/berurutan tanda hubung) dan `description`
  (1-1024, apa dan kapan dipakai); opsional `license`, `compatibility`, `metadata` (peta teks ke teks), `allowed-tools`; badan
  disarankan < 500 baris dan < 5000 token, rincian di `references/` yang dimuat bila perlu (progressive disclosure).
- Validator resmi skills-ref 0.1.1 (PyPI, perintah `agentskills validate <folder>`).

## Keputusan
1. Unduhan `/app/skill` (pemilik, admin, akuntan) menghasilkan zip berisi satu folder `nadi-<nama-usaha>` dengan `SKILL.md` (cara
   menyambung ke server MCP, alat, aturan, contoh) dan `references/usaha.md` (topi aktif dengan jumlah orang, pola kerja, aturan izin,
   templat nomor, bagan akun).
2. Tanpa data pribadi: struktur data paket tidak punya tempat untuk nama orang, gaji, NIK, atau rekening; hanya jumlah orang per topi.
3. Alamat MCP diambil dari host permintaan (sama dengan resource OAuth), sehingga paket cocok dengan server yang dipakai.
4. Paket tidak diperbarui otomatis; berkas menyebut tanggal dibuat dan meminta unduh ulang bila aturan usaha berubah.
5. Tautan ada di kartu "Asisten AI milikmu" di /app/perusahaan. Teks pemasangan umum ("unggah zip ini, atau ekstrak foldernya ke
   folder skills asistenmu") karena cara pasang tiap produk asisten belum dibaca dari dokumen resminya.
