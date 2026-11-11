# Rencana ekstensi: Nadi untuk perusahaan spesifik mana pun

Ditulis 11 Nov 2026 atas permintaan Tristan, setelah perbandingan dengan contoh project Laravel (agensi: developer, kreatif,
digital marketing) menunjukkan 12 fitur yang belum ada. Contoh itu hanya satu dari ratusan jenis perusahaan, jadi jawabannya
bukan menambal satu per satu, tetapi membuat Nadi bisa diperluas dengan aman.

## Aturan selama penilaian juri

- Tidak ada commit atau push (loop/TANPA_COMMIT). Produksi (Supabase izyesrryiljitpusaqvf, Vercel) tidak disentuh.
- Semua migrasi dan Edge Function dijalankan di Supabase lokal (Docker, `npx supabase start`) dan aplikasi Next lokal. Membuat proyek Supabase kedua ditolak penjaga loop (alat yang bisa menagih), jadi tidak dipakai.
- Migrasi baru tetap disalin persis ke `supabase/migrations`, tes SQL ke `supabase/tests`, sehingga nanti cukup di-apply ke produksi.

## Tiga lapis

1. **Inti** (selalu ada, sesuai jenis usaha): Hari ini, Uang, Orang, Dokumen dasar, Pengaturan.
2. **Fitur tambahan resmi**: 10 modul bawaan yang sudah ada (kasir, stok, produksi, ...) ditambah paket resmi baru. Dipasang
   dari halaman Tambah fitur atau saran onboarding. Tampil di sidebar bagian "Fitur tambahan".
3. **Mod buatan pengguna**: fitur yang dibuat pemilik sendiri (pembangun visual) atau oleh AI miliknya lewat MCP.

## Nadi Mod: fitur sebagai data, bukan kode

Mod adalah manifest JSON yang dijalankan penafsir tetap Nadi. Tidak ada kode pengguna yang dieksekusi di server atau peramban.

- **Koleksi**: daftar catatan (misalnya "Rapat", "Konten"), maksimal 10 per mod.
- **Bidang** bertipe tetap: teks, teks panjang, angka, rupiah, tanggal, tanggal-jam, pilihan, pilihan banyak, centang,
  tautan, berkas, orang, pelanggan, produk, proyek, kerja, rujukan ke koleksi lain di mod yang sama.
- **Alur status**: daftar status, transisi yang boleh, dan peran yang boleh memindahkan; status akhir mengisi waktu selesai.
- **Tampilan**: daftar (kolom, saring, urut), papan (per status), kalender (per bidang tanggal), formulir, rincian.
- **Rumus**: bahasa ekspresi kecil yang diurai sendiri (angka, teks, tanggal, jika), tanpa eval.
- **Otomasi**: memakai mesin alur yang sudah ada: pemicu `mod.<koleksi>.buat|status|tenggat`, aksi kartu Feed, kerja baru,
  pengingat. Batas laju sama dengan alur.
- **Akses**: per peran (pemilik, admin, akuntan, staf): lihat semua, lihat milik sendiri, tulis, pindah status.
- **Menu**: letak di ruang mana dan label; tampil di bagian Fitur tambahan.

### Pengaman (wajib, diuji)

- Data mod disimpan di tabel bersama dengan `perusahaan_id` dan RLS `(select app.pid())`; mod tidak punya tabel sendiri,
  tidak bisa menulis SQL, tidak bisa membaca usaha lain.
- Pengawas manifest deterministik (TypeScript + salinan PL/pgSQL yang diuji sama): skema, batas ukuran, nama tanpa skrip/HTML,
  ikon dari daftar tetap, rumus hanya dari tata bahasa sendiri, rujukan hanya ke sumber daftar putih, peran mod tidak boleh
  melebihi peran pemasang, webhook hanya https ke host publik (aturan alur).
- AI lewat MCP hanya bisa membuat dan mengubah **draf**. Menerapkan, memperbarui versi, dan mematikan hanya oleh pemilik/admin
  di UI. Setiap versi disimpan; rollback satu klik; sakelar mati per mod.
- Data mod yang dibaca AI ditandai sebagai masukan tak tepercaya (pola docs/quality/injeksi-prompt.md).
- Batas per usaha: jumlah mod, catatan per koleksi, perubahan per jam, ukuran manifest dan catatan.
- Audit: setiap pasang, terapkan, ubah, matikan tercatat.

## Inti kerja tim (untuk perusahaan proyek)

Banyak pelaksana dengan porsi, PIC, checklist subtask, kirim hasil + review lewat Feed, tenggat dengan baseline dan pengajuan
geser tenggat lewat Feed, kerja tertaut proyek; proyek operasional (PIC, status, tipe sekali/berulang/berkelanjutan, klien,
tim, periode) dengan template proyek/kerja dan periode berulang lewat pg_cron.

## Bukti

Sesi asisten ngoding terpisah disambungkan ke MCP Nadi lokal memakai token akun uji, diminta membangun fitur dari dokumen
Laravel lewat MCP; pemilik menerapkan; e2e memakai fitur itu. Sesi yang sama mencoba serangan (data usaha lain, skrip,
naik peran, rumus berbahaya, webhook ke jaringan dalam) dan semuanya harus ditolak, dicatat di docs/quality/uji-mod-mcp.md.
