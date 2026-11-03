# Iterasi D-13: Lempar Saja

4 Nov 2026. Mengikuti docs/design/ITERASI.md.

## Riset
- Pola dari D-12 (NN/g contextual swipe, Power Automate approvals): keputusan sebaiknya sedekat mungkin dengan tempat hasil
  muncul; aksi berulang memakai batalkan, bukan konfirmasi.
- DIRECTION §5: "nota yang dilempar tercetak baris demi baris" dan satu indikator hidup per layar (titik berdenyut).
- Pengukuran Lempar lama (produksi 2624b47 + D-12, e2e/lempar-hp.spec.ts, HP 390 px): usulan tampil 6,3 dtk, lalu 2 ketukan dan
  1 pindah layar ke Feed untuk menyetujui; tidak ada keadaan luring; galat tanpa jalan ulang selain memilih berkas lagi.

## Teknik yang dipelajari
Merancang keadaan, bukan hanya layar: setiap berkas punya keadaan siap, dikirim, dibaca, siap disetujui, galat, dan luring,
masing-masing dengan teks, tanda, dan langkah berikutnya.

## Tiga konsep
| Konsep | Gagasan | Kritik | Putusan |
|---|---|---|---|
| 1. Pemindai kamera layar penuh | kamera langsung terbuka, tepi nota dikenali, jepret otomatis | butuh deteksi tepi di HP murah, berat; lebih banyak berkas yang bukan foto (PDF, Excel) | ditolak |
| 2. Lempar seperti obrolan | berkas = pesan, Nadi membalas seperti chat | klise AI (ANTI-SLOP), Nadi tidak berpura-pura manusia (VOICE), menyembunyikan keputusan di antara gelembung | ditolak |
| 3. Baris berkas + usulan di tempat | tiap berkas menunjukkan 4 langkah (Disiapkan, Dikirim, Dibaca, Siap) dengan titik berdenyut di langkah yang berjalan; usulan hasilnya langsung tampil sebagai kartu Feed yang bisa disetujui atau ditolak (dengan Batalkan D-12) dan dibawa ke layar; luring = berkas ditahan dan dikirim otomatis saat sinyal kembali; galat = pesan + Coba lagi | keputusan tanpa pindah layar, keadaan lengkap, satu gerak (denyut) per baris yang berjalan | **dipilih** |

## Hasil
| | Sebelum | Sesudah |
|---|---|---|
| Nota dilempar sampai usulan tampil | 6,3 dtk | 3,7-4,7 dtk (lokal; produksi di bawah) |
| Sampai disetujui | 2 ketukan + 1 pindah layar | 1 ketukan, 0 pindah layar, tombol Setujui sudah di layar |
| Luring | tidak dirancang | berkas ditahan, pesan jelas, terkirim otomatis saat online (e2e) |
| Galat | pesan saja | pesan + Coba lagi yang berhasil (e2e) |
Foto: sebelum/, sesudah/, banding.png (kiri sebelum, tengah sesudah, kanan luring).

Catatan jujur: tes luring mensimulasikan bendera navigator.onLine dan peristiwa online, karena setOffline Playwright membuat
pemilihan berkas macet; respons 500 dari RPC membuat klien Supabase menunggu lama (mencoba ulang), jadi tes galat memakai 400.
