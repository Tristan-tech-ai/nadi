# Bedah rujukan 7: wwIt5ZvROrs (asisten pembayaran invoice fintech, buatan studio Zelios)

Dibedah 6 Nov 2026 (V-13H). Gambar analisis ada di scratchpad (bedah/r7):
- 12 lembar 6 bingkai/dtk;
- grafik gerak dan kurva;
- stem demucs dan jendela spektrogram.

Dari kedelapan rujukan, ini yang **paling dekat dengan cerita Nadi**: invoice masuk, isinya dibaca, draf dibuat, lalu disetujui.

## Metadata

| Hal | Nilai |
|---|---|
| Durasi | 48 dtk (film ±47 dtk), 1920×1080, 30 fps, VP9 |
| Suara | Opus, −16,2 LUFS terintegrasi, LRA sangat sempit 2,3 LU, puncak −1,0 dBFS |
| Kanal | studio animasi (portofolio), unggah 19 Sep 2025, ±264 rb tonton |
| Narasi | tidak ada (stem vocals hanya −33 dBFS: potongan synth, bukan suara orang) |

## Struktur (47 dtk, 9 langkah)

| Waktu | Isi | Teknik |
|---|---|---|
| 0-4,5 | **masalah diketik dengan kursor teks**: "Still manually entering payment details?" (kata terakhir berubah ungu), di atas tumpukan formulir pembayaran dan invoice yang samar di belakang | ketik masalah + UI kacau samar |
| 4,6-7,8 | "Meet [produk]": huruf masuk dengan blur gerak lebar, logo berputar masuk, pil "AI-powered payment assistant" mengembang dari kecil | judul produk |
| 8,0-9,6 | "Send one or multiple invoices": kamera menggeser horizontal mengikuti kata | geser mengikuti teks |
| 9,6-11,0 | tombol "New mail" ditarik keluar dari bilah alat dan **tarik mundur 0,58× dalam 34 bingkai**: tombol kembali menjadi bagian aplikasi surel | elemen membuka dunia |
| 11,0-12,8 | **tarik mundur lagi 0,40× dalam 53 bingkai (ease-out expo)**: jendela surel miring; lampiran invoice diseret ke badan surel oleh kursor tangan | tarik mundur + seret |
| 12,8-14,3 | "to your [produk] email": kalimat bersambung dari 8,0 dtk | **satu kalimat dipecah di sepanjang tiga adegan** |
| 14,3-17,0 | kartu invoice kecil terbang dari surel ke tengah, kata pengapit kiri-kanan "It extracts … all key details", lalu **dorong 1,7× dalam 12 bingkai** ke invoice | kata pengapit + dorong cepat |
| 17,0-19,6 | **pemindaian**: bingkai sudut ungu di sekeliling invoice, pita sorot ungu bergerak turun baris per baris, dan setiap bidang yang dibaca diberi kotak garis (nomor, tanggal, total $15,500) | metafora baca dokumen yang jelas |
| 19,6-21,0 | invoice memudar, "And seconds later" | jembatan waktu |
| 21,0-23,6 | jendela surel kembali dalam perspektif, surel balasan "Your payment draft is ready" dengan centang hijau dan tabel invoice; kursor menekan "Login to review" | hasil di kanal yang sama |
| 23,6-27,0 | ikon bintang membesar lalu menjadi kursor kecil yang melesat, "Time for a quick check" | transisi ikon |
| 27,0-30,0 | dasbor miring masuk; baris pembayaran berstatus **DRAFT** diangkat keluar dari tabel menjadi pil besar; kursor menekan DRAFT | isolasi baris |
| 30,0-33,4 | formulir "Send a payment" sudah terisi dari invoice (penerima, jumlah 15,500, tanggal) di samping invoice aslinya; **kamera menggulir 1.615 px sambil dorong 1,57× dalam 99 bingkai**; kursor memilih opsi | formulir terisi + gulir |
| 33,4-35,1 | tombol "Send for approval" dibesarkan, ditekan | isolasi tombol |
| 35,1-37,1 | kartu "Approvers / Status": pemberi persetujuan pertama muncul dengan pemutar kecil yang **berubah menjadi centang hijau**, lalu orang kedua | persetujuan bertingkat |
| 37,1-40,0 | pil "Payment approved", lalu morph menjadi cincin pemuat, lalu centang hijau, lalu "Payment sent" dan "Download PDF confirmation" | morph status |
| 40,0-40,6 | kartu gelap "Payment sent" menyusut dan terlempar ke atas keluar layar | lempar keluar |
| 40,6-43,8 | "Save time. Avoid errors", "Stay in control" (garis lengkung ungu tergambar) | penutup manfaat |
| 43,8-47,1 | logo segitiga digambar garis, nama perusahaan, pil URL | logo |

## Gerak kamera (terukur)

| Jendela | Gerak | Besar | Durasi | Kurva |
|---|---|---|---|---|
| 9,8 | tarik mundur | 0,58× | 34 bingkai | linear sampai potongan |
| 11,0 | tarik mundur | 0,40× | 53 bingkai | **ease-out expo** (puncak di 4%) |
| 14,6 | dorong | 1,21× | 13 bingkai | ease-out cubic |
| 16,6 | dorong | 1,71× | 12 bingkai | ease-out cubic (mulai penuh kecepatan) |
| 21,0 | masuk dengan gulir + dorong | 1,67×, 1.297 px | 42 bingkai | hampir linear |
| 30,1 | gulir + dorong | 1,57×, 1.615 px | 99 bingkai | ease-out cubic |
| 33,4 | geser | 607 px | 47 bingkai | ease-out expo |

Polanya:
- Gerak masuk ke detail cepat dan pendek, 12-13 bingkai.
- Gerak memperlihatkan konteks panjang, 34-99 bingkai, hampir selalu ease-out (expo atau cubic).
- Hampir tidak ada potongan keras. Adegan bersambung lewat kamera, kata, dan elemen yang berubah.

## Cara UI direkonstruksi

- **Aplikasi surel, invoice, formulir pembayaran, dasbor, dan kartu persetujuan digambar ulang sebagai lapisan sederhana:**
  - teks kecil yang tidak penting dibiarkan tidak terbaca;
  - hanya angka kunci yang dibuat jelas: $15,500, DRAFT, nama pemberi persetujuan.
- **Invoice "dibaca" lewat pita sorot dan kotak garis per bidang.** Gambar ini langsung menjelaskan "AI mengekstrak isi" tanpa kata teknis.
- **Hasil kembali ke tempat orang bekerja** (surel balasan), lalu ke aplikasi untuk satu pemeriksaan cepat. Ini sama dengan janji Nadi: AI menyiapkan, manusia menyetujui.
- **Persetujuan bertingkat digambarkan sebagai daftar orang dengan status** yang berubah dari pemutar menjadi centang.

## Bunyi (dibaca dari sinyal dan stem)

- **Musik:**
  - pop elektronik ±100 BPM, rapat dan keras: −16,2 LUFS dengan LRA hanya 2,3 LU, artinya volume hampir rata dari awal sampai akhir;
  - bass dan drum sama kuat (−20 dBFS rms).
- **Titik penting di musik:**
  - ±10,8-12,5 dtk: drum dan bass berhenti, tersisa pad yang naik-turun, tepat saat tarik mundur panjang ke aplikasi surel (ruang napas sebelum fitur);
  - ±15,5 dan ±18 dtk: jeda singkat bass di adegan invoice;
  - ±36-37 dtk: drum berhenti sebentar dan stem vocals berisi aksen synth bernada, tepat saat persetujuan dan "Payment approved";
  - ±45,1 dtk: semua berhenti serentak saat logo, lalu ekor pad panjang ±3 dtk.
- **Efek suara:**
  - tidak terlihat efek UI terpisah yang menonjol;
  - pita atas 8-10 kHz terpotong (pengodean).
  - Peran efek digantikan oleh ketukan musik dan jeda musik di titik cerita.

## 5 hal yang layak ditiru Nadi

1. **Membuka dengan pertanyaan masalah yang diketik**, satu kalimat dengan kursor teks, di atas tumpukan berkas asli yang samar. Contoh: "Masih mengetik ulang nota satu per satu?" di atas nota, Excel, dan buku kas.
2. **Pemindaian dokumen yang terlihat.** Bingkai sudut, pita sorot kunyit bergerak turun, dan kotak garis di setiap bidang yang dibaca (pemasok, tanggal, total). Cocok untuk Lempar dan struk T-01B.
3. **Persetujuan sebagai status yang berubah**: "Siap ditinjau" lalu Setujui, lalu cap DISETUJUI dan "Tersimpan". Untuk usulan yang butuh lebih dari satu orang, tampilkan daftar orang dengan status.
4. **Jeda musik tepat sebelum fitur kunci**: drum berhenti ±1,5 dtk saat kamera tarik mundur, lalu masuk lagi saat aksi pertama.
5. **Satu kalimat yang dipecah sepanjang beberapa adegan** ("Kirim satu atau banyak nota … ke Nadi … dan beberapa detik kemudian"), supaya cerita mengalir tanpa narasi.

## 3 hal yang tidak ditiru

1. **Latar ungu tua bercahaya dan pil bergradien ungu.** Ini dilarang ANTI-SLOP S01-S02. Nadi memakai kertas, tinta, dan kunyit.
2. **Kemiringan perspektif di hampir setiap adegan UI.** DIRECTION melarang UI dimiringkan 3D.
3. **Mix rata dengan LRA 2,3 LU.** Untuk video 5 menit melelahkan; Nadi butuh naik-turun yang terasa (LRA ±5-8 LU) dengan jeda musik yang disengaja.
