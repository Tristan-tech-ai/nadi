# Templat email Supabase Auth

Dipasang di dashboard Supabase > Authentication > Emails (bisa diubah hanya setelah SMTP sendiri aktif).
Setelah terpasang, setel env Vercel `NADI_KODE_EMAIL=1` supaya halaman masuk, lupa sandi, dan daftar menampilkan isian kode.

| Templat Supabase | Berkas | Subjek |
|---|---|---|
| Magic link or OTP | masuk.html | Kode masuk Nadi: {{ .Token }} |
| Confirm sign up | daftar.html | Aktifkan akun Nadi: {{ .Token }} |
| Reset password | atur-ulang.html | Atur ulang kata sandi Nadi |

Tautan memakai `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=...` (pola docs Supabase "Redirecting the user to a
server-side endpoint", dibaca 6 Nov 2026). RedirectTo selalu `.../auth/konfirmasi?next=...` dari aplikasi, dan rute itu
memanggil verifyOtp dengan token_hash, sehingga tautan jalan di perangkat mana pun (tautan PKCE bawaan hanya jalan di
peramban yang memintanya). Kode `{{ .Token }}` adalah cadangan bila tautan gagal atau sudah dibuka pemindai email.
