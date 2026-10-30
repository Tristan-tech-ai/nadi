# Anti-slop: pola terlarang yang bisa diperiksa

Setiap aturan punya ID.
- **[M] (mesin):** diperiksa otomatis oleh `scripts/cek-slop.py`, yang menjadi langkah `slop` di `loop/gate.sh`.
- **[T] (tinjauan):** diperiksa di tangkapan layar 390 px dan 1440 px sebelum tugas UI ditutup, dan hasilnya ditulis di bukti tugas.

Sumber pola: DIRECTION.md, referensi 1 sampai 7.

## Warna dan permukaan
- **S01 [M]** Tidak ada ungu, indigo, atau violet: kelas Tailwind `indigo-*`, `violet-*`, `purple-*`, `fuchsia-*`, dan heksadesimal dengan rona 250°-300°.
- **S02 [M]** Tidak ada `linear-gradient`/`bg-gradient-*` di kode UI, kecuali yang ditandai komentar `slop-ok: <alasan>`. Maksimal satu per halaman.
- **S03 [M]** Tidak ada `backdrop-blur`/glassmorphism, kecuali satu elemen bertanda `slop-ok`.
- **S04 [T]** Tidak ada glow (`box-shadow` berwarna lebar) di kartu. Bayangan tipis atau tanpa bayangan.
- **S05 [M]** Warna hanya lewat token (`var(--...)` atau kelas token). Tidak ada heksadesimal lepas di komponen, kecuali di berkas token.
- **S06 [T]** Status tidak pernah hanya warna: selalu ada teks atau ikon.

## Huruf
- **S10 [M]** Tidak memakai Inter, Roboto, Arial, atau Poppins sebagai font produk.
- **S11 [T]** Huruf kalimat. Kapital penuh hanya untuk label cap ≤ 2 kata.
- **S12 [T]** Judul tampilan ≤ 3 baris di 390 px.
- **S13 [M]** Angka uang memakai `tabular-nums` (komponen `Rupiah` wajib dipakai untuk setiap nilai rupiah).

## Tata letak
- **S20 [T]** Tidak ada deretan tiga kartu fitur sama besar dengan ikon di atas judul.
- **S21 [M]** Tidak ada `h-screen`/`100vh` untuk pahlawan di HP. Pakai `min-h-[70svh]` atau tinggi isi.
- **S22 [T]** Satu tombol utama per layar. Tombol lain bertingkat (sekunder/teks).
- **S23 [T]** Teks panjang rata kiri. Tengah hanya untuk keadaan kosong pendek.
- **S24 [T]** Radius menurut peran: input 6 px, kartu 10 px, lembar bawah/modal 16 px, pil 9999 px.

## Isi dan kata (detail di VOICE.md)
- **S30 [M]** Tidak ada "Lorem", "John Doe", "Jane Doe", "Acme", "TechCorp", "example.com" di teks yang tampil.
- **S31 [M]** Tidak ada tanda pisah panjang (—) atau en dash (–) di teks UI.
- **S32 [M]** Tidak ada emoji di teks UI dan judul.
- **S33 [M]** Tidak ada kata terlarang VOICE.md: "silakan", "revolusioner", "inovatif", "memberdayakan", "solusi terbaik", "all-in-one", "seamless", "tingkatkan produktivitas", "game changer", "mudah dan cepat", "Mohon maaf atas ketidaknyamanannya".
- **S34 [T]** Tidak ada angka bulat karangan ("10.000+ pengguna", "100% puas") dan tidak ada logo pelanggan palsu. Angka hanya dari data nyata.
- **S35 [M]** Rupiah ditulis `Rp1.250.000`: tanpa spasi, tanpa titik setelah Rp, pemisah ribuan titik (lewat `formatRupiah`, bukan tulisan tangan).

## Gerak
- **S40 [M]** Tidak ada `transition-all`. Sebut properti (`transform`, `opacity`, `color`, `background-color`).
- **S41 [M]** Tidak menganimasikan `width`/`height`/`top`/`left`.
- **S42 [M]** Durasi transisi ≤ 300 ms di UI aplikasi.
- **S43 [M]** Setiap berkas yang memakai animasi menghormati `prefers-reduced-motion` (global di globals.css).
- **S44 [T]** Tidak ada fade-up saat gulir di setiap elemen. Maksimal satu gerak bermakna per layar.

## Komponen
- **S50 [T]** Setiap komponen interaktif punya keadaan diam, sorot, fokus terlihat, aktif, nonaktif.
- **S51 [T]** Memuat memakai skeleton yang meniru isi, bukan pemutar di tengah layar.
- **S52 [M]** Tidak ada `alert()`/`confirm()` bawaan browser.
- **S53 [T]** Tidak ada interaksi yang hanya bisa lewat hover (HP).
- **S54 [T]** Grafik memakai palet token, bukan warna bawaan pustaka.

## Gambar
- **S60 [T]** Tidak ada foto stok dan tidak ada latar abstrak tanpa informasi.
- **S61 [M]** Gambar memakai `next/image` atau SVG sebaris dengan `width`/`height`/`alt` (tanpa CLS).
