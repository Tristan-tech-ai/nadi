# Peta injeksi prompt: di mana keluaran model bisa mengubah data

Ditulis 1 Nov 2026 setelah temuan F1-06B (docs/quality/review-f1-06b.md). Prinsip: teks dari luar (berkas yang dilempar, CV pelamar, catatan asisten MCP pelanggan, judul kerja) harus dianggap bisa berisi perintah untuk model. Yang dijaga bukan "model tidak tertipu", tetapi **apa yang paling buruk terjadi bila model tertipu**.

| Jalur | Teks luar yang masuk model | Yang bisa diubah keluaran model | Pagar | Dampak terburuk bila tertipu |
|---|---|---|---|---|
| baca-berkas (Lempar) | isi berkas (nota, invoice, CV, surat) | membuat usulan di Feed (jenis, bidang, ringkasan) | usulan dibuat oleh kode dari skema per jenis (rapikan), tidak pernah diterapkan tanpa Setujui manusia; NIK dibuang setelah diputuskan | usulan dengan angka/judul menyesatkan menunggu di Feed; pemilik/admin tetap melihat buktinya (berkas asli) sebelum menyetujui |
| baca-berkas: tulisAturan | isi berkas berteks | aturan ekstraktor usaha | aturan hanya disimpan bila lulus uji pada berkas asal (cocok, konsisten, 100% bidang sama) | aturan yang salah membaca berkas berikutnya; tetap jadi usulan, bukan data final |
| sumber lamar (CV) | CV pelamar | usulan rekrut.pelamar | usulanLamar: nama dari formulir, keyakinan 0, isi berkas dibuang (Q-11) | tidak ada selain usulan pelamar biasa |
| estimasi-kerja (F3-01) | judul kerja, contoh kerja lain | poin beban satu kerja | batas 1..1485 menit, sekali per kerja, bisa ditimpa manual | poin satu kerja salah; memengaruhi kalibrasi lewat median (tahan pencilan) |
| putuskan (F1-06B) | judul + penjelasan usulan (dari berkas/MCP) | untuk_peran usulan | setelah perbaikan: hanya boleh mempersempit ke {pemilik}; Q-17 CHECK 'pemilik' = any(untuk_peran) | usulan disembunyikan dari admin (bukan dari pemilik); bisa dibatalkan dari kartu Keputusan |
| MCP (asisten pelanggan) | apa pun yang dikirim klien | usulan lewat mcp_buat_usulan (daftar putih aksi) | token terikat satu usaha, cakupan, 120/menit, NIK dibuang, masuk Feed | usulan sampah di Feed; tidak ada tulisan langsung |
| wawancara (transkrip di perangkat) | suara pelamar | nilai rubrik | nilai dihitung server dari transkrip dengan rubrik tanpa model | nilai rubrik menyesatkan; klip asli selalu tersedia |

## Aturan untuk fitur model berikutnya (wajib di brief agen)
1. Keluaran model tidak pernah menjadi tindakan final yang mengurangi kendali pemilik: tidak menyembunyikan dari pemilik, tidak menyetujui uang, tidak menghapus.
2. Setiap tindakan otomatis dari model tercatat di public.keputusan dan bisa dibatalkan.
3. Angka panjang (NIK, rekening, HP) disamarkan sebelum dikirim bila tidak dibutuhkan tugasnya.
4. Batas harian per usaha di konfigurasi, dan token tercatat di pemakaian_ai, termasuk saat gagal.
5. Tes SQL untuk "jawaban model paling jahat" (yakin 1,0 pada pilihan terburuk) harus ada di setiap fitur yang menerapkan keluaran model.

## Penerapan
- 1 Nov 2026: aturan di atas dimasukkan ke loop/README.md bagian Aturan teknis (dibaca setiap brief agen dan setelah kompaksi).
