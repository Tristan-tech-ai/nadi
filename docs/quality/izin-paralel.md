# e2e izin gagal saat paralel dengan kerja (Q-29)

Diselidiki 1 Nov 2026 (tick 198) dari kegagalan nyata, bukan tebakan.

## Bukti
- Putaran 1, izin.spec + kerja.spec paralel (2 worker) terhadap produksi (deploy CLI 6d76733): izin.spec gagal di baris 134. Daftar izin staf masih menampilkan "Disetujui ... Disetujui otomatis", bukan "Persetujuan otomatis dibatalkan: ...".
- Database sesudahnya (execute_sql): keputusan izin.otopilot milik jalan itu dibatalkan pukul 21.51.34 UTC dengan alasan yang benar, dan pengajuan_izin kembali `menunggu` dengan alasan_putusan pembatalan. Jadi datanya benar; yang terlambat adalah tesnya.

## Penyebab
- Tes menunggu `getByText("Alasan batal: Hari itu ada pesanan besar").first()`. Teks yang persis sama sudah ada di kartu Keputusan otomatis dari jalan-jalan sebelumnya, sehingga penantian itu langsung lolos sebelum aksi batalkanKeputusan selesai.
- Tes lalu memuat ulang halaman staf sebelum pembatalan tersimpan. Saat server lebih lambat karena kerja.spec berjalan bersamaan, jarak waktu itu cukup untuk membuat halaman staf terbaca sebelum pembatalan, dan expect tidak memuat ulang lagi.

## Perbaikan
Alasan pembatalan dibuat unik per jalan (`Hari itu ada pesanan besar ${nama}`). Tes menunggu tepat kartu dengan alasan itu, lalu memeriksa teks yang sama di halaman staf. Aplikasi tidak diubah.

## Hasil
izin.spec + kerja.spec paralel terhadap produksi: 3 putaran berturut-turut lulus (43,5 / 41,5 / 42,9 dtk).

## Pelajaran untuk tes lain
Penantian berbasis teks tetap (`getByText(...).first()`) di data uji yang menumpuk antar jalan bisa lolos karena sisa jalan lama. Teks yang ditunggu sesudah aksi harus memuat penanda unik jalan itu.

## Kandidat serupa (belum diubah, dicek bila rapuh)
grep `getByText("...").first()` di e2e: kpi.spec.ts:163 ("Dari karyawan"), lempar.spec.ts:61 ("Agus Astuti"), peta.spec.ts:167 ("Dari peta organisasi"). Ketiganya menunggu teks tetap yang bisa tersisa dari jalan sebelumnya. Belum pernah gagal; dicatat supaya bila gagal, penyebab pertama yang diperiksa adalah ini.
