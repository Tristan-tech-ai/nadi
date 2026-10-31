# Peta Organisasi Nyata (F3-04)

Ditulis 1 Nov 2026. Kriteria: "graf tampil untuk perusahaan demo; lintas topi terlihat". Janji di docs/PLAN.md baris 121: organisasi sebagaimana kerja sebenarnya mengalir, di samping organisasi di atas kertas ("Admin keuangan ternyata mengerjakan 40% urusan HR").

## Data yang ada (tanpa tabel baru)
- **Di atas kertas**: pakai_topi (orang memakai topi, porsi) dan orang.data.jabatan.
- **Sebenarnya**: kerja selesai 4 minggu terakhir: pelaksana_id, topi_id (topi yang seharusnya), poin_beban, lintas_topi (pelaksana tidak memakai topi itu), pemberi_id (siapa yang menyerahkan kerja).
- Tidak memakai model AI: semua angka dari SQL.

## Ukuran
- **Bagian nyata per topi**: untuk setiap topi, persen poin kerja selesai yang dikerjakan tiap orang. "Kasir: Sari 62%, Budi 30%, Dewi 8% (Dewi tidak memakai topi kasir)".
- **Selisih kertas vs nyata per orang**: topi yang dipakai di kertas tetapi 0 poin 4 minggu ("Budi memakai topi gudang, belum ada kerja gudang 4 minggu"), dan topi yang tidak dipakai tetapi dikerjakan (lintas topi) dengan persen dari total poin orang itu ("Dewi: 35% kerjanya urusan kasir, padahal topinya pelayan").
- **Alur serah**: pasangan pemberi -> pelaksana dengan jumlah kerja 4 minggu ("Pemilik menyerahkan 18 kerja ke Sari").
- Ambang jujur: topi dengan < 3 kerja selesai dalam 4 minggu ditampilkan "belum cukup kerja", tanpa persen.

## Layar /app/kerja?tab=peta (pemilik/admin/akuntan; tab keempat di samping Papan, Beban, Kinerja)
- **Desktop 1440**: graf dua kolom SVG buatan sendiri (tanpa pustaka graf): kiri orang, kanan topi. Garis tipis tinta-2 = di atas kertas (pakai_topi); garis tebal sesuai poin = sebenarnya; garis putus-putus berwarna kunyit-stabilo + label teks "lintas topi" = dikerjakan tanpa memakai topi itu (status tidak hanya warna). Ketuk orang atau topi: garis lain memudar dan panel kanan menulis kalimat angkanya. Di bawah graf, tabel bergaris buku kas yang sama isinya (aksesibel untuk pembaca layar; graf diberi aria-hidden dan ringkasan teks).
- **HP 390**: tanpa graf (tidak terbaca). Daftar per topi: nama topi, lalu baris orang dengan persen dan batang tipis; baris lintas topi ditandai teks "lintas topi" + stabilo. Pil di atas: "Per topi" / "Per orang" / "Alur serah".
- Kalimat kepala (satu, paling mencolok, dihitung SQL): "35% kerja Dewi 4 minggu terakhir adalah urusan kasir, walau topinya pelayan." (bukan "Dewi mengerjakan 35% urusan kasir": itu terbaca sebagai 35% dari semua kerja kasir; dikoreksi di F3-04B) Bila tidak ada lintas topi: "Kerja 4 minggu terakhir sesuai topi di atas kertas."
- Satu tombol utama: "Pasang topi kasir ke Dewi" bila ada orang dengan lintas topi >= 30% dari poinnya (membuat usulan orang.topi untuk pemilik, bukan langsung). Lainnya teks.
- Keadaan: kosong ("Belum ada kerja selesai 4 minggu terakhir. Peta muncul setelah kerja ditandai Selesai di papan."), memuat (skeleton dua kolom), galat.

## Keamanan
- RPC public.peta_organisasi(p_minggu int default 4) security definer, hanya pemilik/admin/akuntan (app.peran_aktif(), pola Q-21); staf 42501. Tanpa data gaji atau kinerja per orang di luar poin kerja.
- Isolasi tenant; tes SQL: staf ditolak, usaha lain kosong, kerja batal tidak dihitung, lintas topi dihitung dari kerja.lintas_topi, ambang < 3 kerja.

## Uji
Tes SQL peta_organisasi; vitest untuk penyusun kalimat dan tata letak kolom (urutan, ketebalan garis); e2e di usaha demo (data sintetis: 3 orang, 3 topi, satu lintas topi) memeriksa kalimat kepala, label "lintas topi" teks, tabel; foto 390/1440 terang/gelap; axe.
