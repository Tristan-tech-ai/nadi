# Tinjauan film demo v3 berdampingan dengan rujukan

Cara: bingkai film disandingkan dengan bingkai rujukan pada momen yang setara (`scratchpad/banding.py`, film di kiri, rujukan di kanan). Bunyi ditinjau lewat pengukuran (MENDENGAR.md, audio.json), bukan telinga.
Setiap putaran mencatat masalah, perbaikan, dan bukti bingkainya.

## Putaran 1 (6 Nov 2026, film 4:35)

| Momen | Film | Rujukan | Temuan | Tindakan |
|---|---|---|---|---|
| Pindai berkas | 1,0 dtk nota dekat 2,4×, pita kunyit | 7 @16 dtk: dokumen di tengah, teks besar di kiri dan kanan | setara: bidikan dekat berkas yang dibaca | tetap |
| Tarik mundur | 2,4 dtk | 8 @10,85 dtk | kurva sama (MUNDUR, puncak ±30%); rujukan memotong ke makro tombol yang memenuhi bingkai | tetap |
| Kalimat diketik | 8,5 dtk | 8 @7,5 dtk: satu baris serif di tengah | setara: satu baris di tengah, ≤ 8 kata; latar berkas samar 38% menambah konteks | tetap |
| **Isolasi fokus** | 109 dtk: kartu diangkat dari Feed yang meredup | 1 @25 dtk: satu tombol mengisi ±25% bingkai, teks besar | **teks kartu kecil**; kartu hanya ±35% lebar bingkai | **diperbaiki**: dorong 1,35× ke kartu yang diangkat, bertahan 1,12× saat Setujui (kartu terbuka 595 px sudah hampir setinggi jendela, jadi skala isi tidak bisa dinaikkan) |
| Persetujuan | 118 dtk: cap DITERIMA di kartu | 7 @37 dtk: daftar penyetuju dengan centang | Nadi memakai cap sebagai karakter (keputusan GERAK.md) | tetap |
| **Status bukti** | 223 dtk: struk dan pil token di dua kolom | 4 @28 dtk: satu baris status besar | **separuh bingkai kosong**, struk ±30% lebar | **diperbaiki**: dorong 1,4× ke kolom yang sedang dibahas, tarik mundur, lalu dorong ke kolom kedua |
| **Penutup** | 270 dtk: logo langsung | 8 @82 dtk: tarik mundur ke dinding banyak pekerjaan, baru logo | **keputusan GERAK.md 1 belum dijalankan** | **diperbaiki**: dinding 9 layar asli (Feed, tinjau draf, tagihan, gaji, peta panas, alur, tanya, Sarapan, Hari ini), dekat 2,6× lalu tarik mundur 60 bingkai, lalu cap menjadi logo (film 4:38) |
| Mata | 160-170 dtk | (tidak ada padanan; Tristan menolak animasi sintetis) | footage CCTV asli + lapisan pelacakan aplikasi | sudah diganti putaran ini (CATATAN.md) |

Bukti setelah perbaikan (render putaran 2): bingkai 108,6, 118,5, 223,5, 228,5, 267,4, 269,8, 272,5, 276,0 dtk.
- Teks kartu Feed terbaca.
- Struk dan pil token mengisi bingkai.
- Dinding karya terlihat utuh sebelum logo.

## Bunyi (putaran 1)

| Ukuran | Film | Sasaran |
|---|---|---|
| Kenyaringan terintegrasi | −14,1 LUFS | −14 LUFS |
| Rentang kenyaringan | 8,6 LU | 6-9 LU |
| Puncak | −2,9 dBFS | ≤ −1 dBTP |
| Efek vs rujukan | serangan dan pusat spektrum sejenis (MENDENGAR.md) | lolos |
| Sinkron cap | −7 / +27 / −1 ms | ≤ 1 bingkai |

## Sisa yang diketahui (belum diperbaiki, tidak besar)

- **Babak Mata:** label "Ujung atas" tertutup panel kepala. Satu deteksi di zona Stan (zona kerja, tidak dihitung).
- **Babak Lempar dan MCP:** jendela 1,0-1,45× dengan teks UI 14-16 px. Terbaca di layar 1080p, kecil di HP.
- **Dinding karya:** potongan atas tiap layar memperlihatkan sidebar. Lebih rapi bila dipotong ke isi halaman.
- **Telinga:** titik sambung birama lagu dan keras ketikan belum didengar manusia (UNTUK-TRISTAN, opsional).
