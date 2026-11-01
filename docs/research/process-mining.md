# Process mining: alur nyata vs alur kertas (F6-03)

Ditulis 1 Nov 2026. Kriteria: alur rekrut dan invoice tergambar dari log kejadian demo.

## Keadaan data (diperiksa 1 Nov 2026)
- public.audit_log (terjadi_at, perusahaan_id, user_id, tabel, baris_id, aksi, sebelum, sesudah), dipartisi bulanan; tabel invoice sudah diaudit (trigger audit_invoice), pengingat_invoice punya dikirim_at.
- lamaran BELUM diaudit: hanya tahap dan tahap_at terakhir, jadi riwayat tahap rekrut belum ada. Perlu trigger audit pada lamaran (mulai mencatat sejak migrasi; data lama hanya punya tahap terakhir).
- Dua usaha demo (pengaturan.demo fnb/toko) diisi app.isi_demo dan digeser waktunya oleh app.segarkan_demo; belum ada invoice maupun lamaran demo.

## Rancangan
1. Migrasi: trigger audit_lamaran (app.catat_audit); RPC alur_proses(p_jenis 'invoice'|'rekrut', p_hari) untuk pemilik/admin dan versi anon khusus usaha demo (pola demo_lihat), yang dari audit_log menyusun:
   - jejak per kasus (invoice: terbit -> pengingat 1..4 dikirim -> lunas/batal; rekrut: masuk -> ditinjau -> ditawari -> diterima/ditolak),
   - graf directly-follows: simpul (langkah, jumlah kasus) dan sisi (dari, ke, jumlah, median hari),
   - varian jalur terbanyak beserta jumlahnya,
   - penyimpangan dari alur kertas: invoice lunas tanpa pengingat padahal lewat jatuh tempo, invoice dibatalkan setelah pengingat, lamaran langsung masuk -> diterima tanpa ditinjau, lamaran menggantung (> 14 hari di satu tahap).
2. Data demo sintetis: isi_demo menambah sekitar 20 invoice dan 15 lamaran demo beserta riwayat audit bertanggal (sumber 'demo'), ikut digeser segarkan_demo.
3. Layar: bagian "Alur nyata" di /demo (dan /app/perusahaan untuk pemilik) berupa daftar langkah bergaris buku kas dengan panah teks dan median hari, bukan grafik rumit; penyimpangan sebagai kalimat berangka ("3 dari 20 invoice lunas tanpa pengingat").
4. Tes SQL: kasus sintetis dengan jalur yang diketahui -> graf dan varian persis; isolasi usaha; anon hanya usaha demo.
