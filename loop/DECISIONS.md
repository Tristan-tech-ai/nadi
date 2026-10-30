# Keputusan

Setiap keputusan produk, desain, atau teknis yang diambil loop, dengan alasan dan sumber. Terbaru di atas.

| Tanggal | Keputusan | Alasan | Sumber |
|---|---|---|---|
| 30 Okt 2026 | Kunci API model AI disimpan sebagai secret Edge Function Supabase; semua panggilan AI lewat Edge Function | Kunci tidak pernah terlihat oleh agen; satu tempat | percakapan dengan Tristan |
| 30 Okt 2026 | Tanpa WhatsApp Business API. Penggantinya: PWA dengan Web Push, Web Share Target (bagikan dari WA ke Nadi), tautan wa.me untuk pesan keluar, Telegram opsional | Tristan tidak bisa mendapatkan API WA; gateway tidak resmi melanggar ketentuan WA dan berisiko nomor diblokir | percakapan; riset harga Meta Okt 2026 |
| 30 Okt 2026 | Stack: SQL di Postgres untuk logika data, TypeScript (Next.js di Vercel) untuk web, Rust ke WASM untuk jalur CPU berat, Rust untuk agen edge Mata, Python untuk ML | Beban utama adalah I/O dan database, bukan CPU aplikasi | percakapan |
| 30 Okt 2026 | Klaim perusahaan aktif dan peran ada di app_metadata JWT; RLS membandingkan konstanta (initPlan) | RLS tanpa join per baris, skala baik | docs Supabase RLS performance |
| 30 Okt 2026 | Tolak secara bawaan: default privileges di public dicabut, setiap tabel diberi hak eksplisit | Partisi bulanan pg_partman tidak boleh otomatis terbuka ke API | analisis sendiri |
| 30 Okt 2026 | Jev (TypeSafe AI) dipakai sebagai gerbang keputusan cepat dengan fallback model kecil | Jev: model keputusan non-generatif rilis Sep 2026, belum ada SLA dan pendaftaran sempat ditutup | riset web 30 Okt 2026 |
