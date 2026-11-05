# Uji gerak 10 dtk berdampingan dengan rujukan 8 (V-13I)

6 Nov 2026. Aku menirukan satu gerak dari rujukan 8, yaitu tarik mundur di 40,62 dtk: bidikan dekat sel lembar kerja mundur ke jendela utuh yang mengambang di kertas krem.

- **Bahan:** HyperFrames 0.9.8 dan DOM asli Feed Nadi (Toko Bu Sari, data sintetis, `docs/promo/film-langsung/assets/app/feed.html`).
- **Berkas uji:** ada di scratchpad (`uji-gerak/uji.mp4`, `uji-gerak/berdampingan.mp4`) dan tidak masuk repo.
- **Cara menilai:** gerak hasil render diukur dengan alat yang sama dengan pengukur rujukan (ORB + RANSAC per bingkai, `bedah/kurva.py`).

## Angka

| | Rujukan 8 (40,62 dtk) | Uji Nadi (1,02 dtk) |
|---|---|---|
| Skala total tarik mundur | 0,466× | 0,476× |
| Durasi gerak terukur | 33 bingkai | 24 bingkai di atas ambang (33 bingkai ditulis) |
| Puncak kecepatan | 31% durasi | 13% durasi |
| Kurva terdekat | ease-out cubic (galat 0,140) | ease-out cubic (galat 0,094) |
| Dorong penekanan ke tombol | 1,14× dalam 16 bingkai, ease-in-out (36,62 dtk) | terukur 1,05× dalam 9 bingkai (ditulis 1,14× dalam 16) |

**Pelajaran dari angka:**
- `power3.out` di GSAP memuncak sejak bingkai pertama. Rujukan memuncak di sepertiga awal: geraknya dimulai sedikit lebih lembut, baru melesat, lalu mendarat lama.
- Kurva yang lebih dekat dengan rujukan adalah bezier khusus dengan awalan pelan, kira-kira `cubic-bezier(0.35, 0, 0.1, 1)`. Ini harus diukur ulang dengan alat yang sama sebelum dipakai.
- Dorong ke tombol terukur lebih kecil dari yang kutulis. Kemungkinan penyebabnya: pusat skala tidak di tombol, dan pengukur kehilangan fitur saat kursor menutupi tombol. Ini harus diperiksa ulang, jangan dianggap benar.

## Penilaian rasa (bingkai besar dilihat berdampingan, jujur)

Kurvanya hampir sama, **tetapi hasilnya belum terasa seperti rujukan**. Ada enam sebab, semuanya bisa diperbaiki:

1. **Subjek bidikan dekat lemah.** Rujukan membuka dengan angka sel raksasa (±5% tinggi frame) yang sedang terisi, dengan kotak pilihan hijau, jadi mata langsung tahu apa yang penting. Ujiku membuka dengan potongan kartu dan tombol Setujui tanpa satu angka yang menonjol.
2. **Stabilo meleset.** Sorot kunyit jatuh di bawah tombol, bukan di angka total. Posisinya dihitung dari kotak kartu, bukan dari elemen angka. Lapisan harus diambil dari posisi elemen yang diukur (ukur.mjs), bukan dari tebakan sepertiga kartu.
3. **Bingkai akhir kosong.** Jendela rujukan mengisi ±80% lebar frame dan berisi lembar kerja plus grafik. Jendelaku kolom sempit ±20% lebar dengan kertas kosong di kiri-kanan. Untuk Nadi: pakai tata letak desktop 1440 (sidebar + Feed + rincian usulan), atau tarik mundur berhenti lebih dekat (0,6×).
4. **Teks gelembung dan ukurannya salah.** Gelembung rujukan adalah pesan pengguna yang mendesak ("What if volume drops further? …"), besar (±3,5% tinggi frame), dan menindih tepi jendela. Gelembungku kecil, di samping, dan berbunyi seperti narasi ("Ini nota dari pemasok tadi pagi").
5. **Cap DISETUJUI jatuh di kartu yang salah.** Kursor di kartu keempat, cap di kartu ketiga. Penyebabnya sama dengan nomor 2.
6. **Tidak ada yang hidup saat tahan.** Di rujukan, selama tahan sel terus terisi, garis grafik tergambar, dan kolom baru muncul. Ujiku diam 4 detik.

## Yang dipakai untuk storyboard baru

- Masuk lewat potongan ke bidikan dekat satu angka atau label yang sedang berubah, lalu tarik mundur ±0,47× dalam ±33 bingkai dengan awalan lembut.
- Semua lapisan (stabilo, cap, kursor, gelembung) ditempatkan dari posisi elemen DOM yang diukur, tidak ditebak.
- Bingkai akhir diisi 70-80% oleh jendela Nadi lebar.
- Selama tahan, selalu ada satu perubahan isi yang nyata di layar.
- Gelembung hanya untuk kalimat pengguna yang mendesak, ditulis dalam bahasa sehari-hari VOICE.md.
- Uji berikutnya diulang sampai keenam masalah di atas hilang, **sebelum** produksi V-07.
