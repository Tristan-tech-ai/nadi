# Storyboard video demo Nadi (v3, 4:35)

Ditulis ulang dari nol 6 Nov 2026, setelah 8 rujukan dibedah bingkai demi bingkai dan bunyi demi bunyi (docs/promo/riset-video/GERAK.md, MENDENGAR.md). Storyboard v2 lama dan videonya dilupakan.

- **Implementasi:** docs/promo/demo-v3/buat.py (gambar) dan campur.py (suara). Durasi babak = daftar `D` di buat.py.
- **Format:** 1920×1080 30 fps, tanpa narator. Cerita dibawa kalimat pendek yang diketik (≤ 8 kata, ditahan 1-1,5 dtk) dan UI asli Nadi yang bekerja.

## Bahasa visual

| Unsur | Pilihan | Sumber |
|---|---|---|
| Palet | kertas #F6F2EA, tinta #1C1B18, satu aksen kunyit (stabilo), cap untuk tolak, daun untuk lunas/aktif | DIRECTION.md |
| Huruf | Plus Jakarta Sans (UI dan kalimat), IBM Plex Mono (nota, struk, kode, token) | DIRECTION.md |
| UI | DOM asli aplikasi (Toko Bu Sari, data sintetis) direkonstruksi berlapis; lapisan (stabilo, cap, kursor, kotak) diposisikan dari elemen terukur (ukur.mjs) atau ditanam langsung di teks DOM | perintah Tristan 6 Nov 2026 |
| Karakter | cap stempel: Setujui menjadi DITERIMA, tagihan dicap LUNAS, aturan buruk dicap DITOLAK, lalu cap menjadi logo di kartu akhir | GERAK.md (rujukan 1 dan 3) |
| Transisi | potongan keras ke bidikan dekat; dorong 1,3-1,5× dalam 14-16 bingkai (TEKAN, ease-in-out); tarik mundur 36-48 bingkai dengan ease-out berawalan lembut (MUNDUR = cubic-bezier(0.35,0,0.1,1)); tanpa miring 3D, tanpa guncangan | GERAK.md, UJI-GERAK.md |
| Tulisan | VOICE.md: kamu, kalimat pendek, angka mengalahkan kata sifat, tanpa tanda pisah panjang, tanpa klaim mutlak | VOICE.md |
| Merek | tanpa logo pihak ketiga; chat AI digambar netral ("AI-mu, tersambung ke Nadi lewat MCP") | pedoman merek |

## Babak

| # | Waktu | Isi | DOM asli | Kamera | Suara |
|---|---|---|---|---|---|
| 0 Kait | 0:00-0:06 | Nota dipindai baris demi baris (pita kunyit), kotak di TOTAL, nota menjadi kartu usulan asli, stabilo Rp376.500 | kartu-nota | potongan dekat 2,4× ke TOTAL, tarik mundur 36 bingkai (MUNDUR), dorong 2,6× 14 bingkai ke angka | sunyi; kertas saat nota menjadi kartu |
| 1 Masalah | 0:06-0:36 | "Masih mengetik ulang nota satu per satu?" diketik, "satu per satu?" disorot lalu dihapus jadi "setiap malam?"; "Otomatis itu mahal. Yang murah, manual."; Excel karyawan asli direkonstruksi sel per sel (format tanggal/gaji campur disorot, nama dobel dikotak, rumus total salah); kartu harga resmi bertanggal (kasir/operasional, modul AI asisten +Rp499.000 per outlet, gaji/HR per karyawan, akuntansi) | aset-demo/karyawan-berantakan.xlsx, docs/bisnis/harga-pesaing.md (3 Nov 2026) | Excel: dorong 1,5× ke baris dobel, lalu 1,7× ke rumus | suara toko nyata (Supermarket Ambience); ketikan rumpun; kertas saat berkas muncul; intro lagu masuk menjelang babak 2 |
| 2 Lempar | 0:36-0:56 | "Lempar berkasnya. Nadi yang merapikan."; 4 berkas jatuh ke area Lempar; Membaca lalu Siap ditinjau; daftar ditelusuri per berkas (nota PNG, invoice PDF, absen XLSX, mutasi CSV, slip PDF), tiap "Siap disetujui" disorot, berakhir di "Lihat semua usulan di Feed" | lempar-kosong, lempar-membaca, lempar-siap | dekat 2,2× ke area; gulir ease-in-out per berkas | alas penuh masuk saat Nadi muncul; whoosh + kertas sekali (berkas berjatuhan) |
| 3 Kerja dari AI-mu (MCP) | 0:56-1:44 | "Atau kerja dari AI-mu sendiri."; chat netral: Excel dan daftar harga dilempar, AI membaca, kartu alat tulis_draf (15 baris), pemilik merevisi ("Budi pindah ke kasir pagi"), ubah_draf, "Gaji tidak aku centang"; layar tinjau draf asli: ringkasan, baris Perlu dicek, gaji tidak dicentang otomatis, Terapkan, "10 baris diterapkan. Bisa dibatalkan selama 10 menit." | tinjau-draf (draf AI sungguhan lewat save_ai_draft, tidak diterapkan) | dekat 1,6× ke ringkasan, tarik mundur 44 bingkai; gulir ke gaji dan Terapkan | ketikan; notifikasi |
| 4 Feed | 1:44-2:06 | "Tahu dulu, datanya masuk ke mana."; Feed meredup, kartu tagihan INV/2026/X/0007 diangkat; "Kalau disetujui: Masuk Pembelian sebagai tagihan pemasok" disorot; Lihat rincian terbuka (Akan ditambah (3)); Setujui menjadi cap DITERIMA; "Disetujui." | feed-rincian (Feed produksi sekarang, U-10/U-13) | dorong 1,3× ke rincian, tarik mundur 40 bingkai, mundur 0,86× di akhir | drum berhenti 2 birama sebelum cap; klik 1 bingkai setelah tekan; cap karet asli |
| 5 Tagihan + QRIS | 2:06-2:16 | "Tagih. Pelanggan bayar QRIS."; QRIS dekat lalu tagihan publik utuh; "Pembayaran masuk Rp1.448.000 dari Hotel Segara, lewat QRIS"; BELUM DIBAYAR dicap LUNAS; stabilo total | invoice-publik | dekat 2,4× ke QRIS, tarik mundur 40 bingkai | drum berhenti sebelum LUNAS; notifikasi; cap |
| 6 Gaji | 2:16-2:38 | "Gaji dihitung. Yang janggal, ditahan dulu."; draf gaji November: ringkasan "2 ditahan Gerbang Gaji" disorot; dorong ke Dodi DITAHAN dengan alasan asli; Rincian BPJS Kesehatan dan PPh 21 disorot; alasan melepas Rina diketik, Lepas, "Dilepas. Alasanmu tercatat di slip." | gaji-draf (gaji pokok sintetis lewat formulir Orang, draf tidak disetujui) | dorong 1,35× 14 bingkai, tarik mundur 44 bingkai; gulir ease-in-out | drum berhenti sebelum Lepas; ketikan; klik |
| 7 Mata | 2:38-3:11 | "Kamera menghitung. Wajah tidak disimpan."; **footage CCTV asli** kamera atas (lorong mal, stan bazar) dengan lapisan pelacakan Nadi: kotak sudut per orang, nomor anonim #n mengikuti gerak, jejak 3 dtk memudar, zona menyala dengan jumlah orang, Masuk/Keluar bertambah saat jejak melewati ujung lorong; peta panas asli; kunjungan 177 dihitung naik; jalur paling sering disorot; papan informasi kamera UU 27/2022 Pasal 17 | footage Pexels 37706044 + jejak keluaran Pelacak aplikasi (jejak-nyata.test.ts), lapisan src/lib/mata/gambar.ts; peta-panas, mata-panel | peta panas: dekat 1,9× ke Antrean, tarik mundur 44 bingkai; dorong 1,35× ke angka; panel: tarik mundur 44 bingkai | musik turun 6 dB; suara toko nyata |
| 8 Otomasi, tanya data, Sarapan | 3:11-3:39 | "Yang berulang, biar jalan sendiri."; alur: nama "Kirim pesanan setelah lunas", Ketika Invoice lunas, kerja "Kirim pesanan {nomor}", Buat alur, "Alur dibuat dan langsung aktif."; "Tanya angkanya. Nadi tunjukkan sumbernya."; "Laba bulan ini berapa?" dijawab Rp1.448.000 + Lihat sumbernya; "Tiap pagi, yang berdampak rupiah."; Sarapan Data dua butir | alur, tanya (jawaban produksi), sarapan | dekat 1,45× ke nama alur, tarik mundur 44 bingkai; dorong 1,3× ke jawaban | ketikan; klik; notifikasi |
| 9 Belajar sendiri + pengawas bukan AI | 3:39-4:15 | "Format yang sama, dibaca tanpa AI."; struk SPBU ke-1 dibaca AI (600 token) + "Nadi sedang mempelajari format baru, sekali saja"; struk ke-4 tanpa AI, 0 token; "Aturan dari AI diperiksa kode biasa."; aturan buruk dari model ditolak dengan 4 alasan keluaran asli periksaAturan, cap DITOLAK; aturan baik lulus, bayangan 0/1/2 dari 2, aktif; "Beda sekali saja, aturan dimatikan."; tiga kartu: struk, tanya data, pindah data belajar sekali | kamus klaim asli; pengawas.ts dijalankan pada aturan contoh | potongan keras antar bagian | drum berhenti sebelum token 0 dan sebelum DITOLAK; cap |
| 10 Satu kerangka | 4:15-4:27 | "Di laptop dan HP, tempatnya sama."; Hari ini di 1440 (sidebar), 768 (rail), 390 (bilah bawah) | hari-1440/768/390 (iframe selebar perangkat) | muncul berselang 0,5 dtk, MUNDUR | alas penuh |
| 11 Kartu akhir | 4:27-4:35 | cap DITERIMA turun lalu menjadi logo Nadi asli; "Lempar berkasnya. Nadi yang merapikan."; nadi-swart.vercel.app/demo | logo dari DOM | diam | musik berhenti sebelum logo; sonic logo (kertas bergeser, cap mendarat, ruang 1,2 dtk) |

## Suara (campur.py)

- **Alas:** lagu "Inspiring Advertising" (Rafael Krux, CC BY 4.0, atribusi wajib di deskripsi), dipisah stem dan disusun ulang per birama (±120 BPM).
- **Efek:** rekaman nyata CC0, hanya untuk aksi yang terlihat, ditaruh dari timeline gambar:
  - ketikan berupa rumpun 45-90 ms;
  - klik 1 bingkai setelah tekan;
  - cap saat mendarat.
- **Mix:** −14 LUFS, LRA 6-9 LU, ≤ −1 dBTP.
