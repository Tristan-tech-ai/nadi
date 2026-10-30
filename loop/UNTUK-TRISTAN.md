# Hal yang hanya bisa dilakukan Tristan

Loop tidak pernah menunggu isi berkas ini; ia lanjut ke tugas lain. Isinya hanya autentikasi, pembayaran, atau identitas.

| Tanggal | Butuh | Kenapa | Cara (langkah persis) | Status |
|---|---|---|---|---|
| 31 Okt 2026 | Pasang Vercel GitHub App di akun Tristan-tech-ai untuk repo `nadi` | Tanpa ini Vercel tidak melihat repo (galat repo_not_found 31 Okt), jadi deploy dikirim manual dari berkas dan tidak otomatis per push (tugas F0-02B menunggu ini) | Masuk GitHub sebagai Tristan-tech-ai, buka https://github.com/apps/vercel/installations/new, pilih akun Tristan-tech-ai, Only select repositories, pilih nadi, Install | menunggu |
| 31 Okt 2026 | Matikan "Confirm email" di Supabase (atau pasang SMTP sendiri) | Layanan email bawaan Supabase hanya untuk mencoba: dibatasi sedikit email per jam untuk seluruh proyek (docs.supabase.com/guides/auth/rate-limits), jadi penguji yang mendaftar bisa tertahan di tahap konfirmasi (galat over_email_send_rate_limit). Aplikasi sudah menangani kedua keadaan (langsung masuk atau minta cek email) | Buka https://supabase.com/dashboard/project/izyesrryiljitpusaqvf/auth/providers, buka Email, matikan Confirm email, Save | menunggu |
