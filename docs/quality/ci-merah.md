# CI GitHub merah di setiap push, tidak terlihat oleh loop

Ditemukan 1 Nov 2026 (tick 196) saat menyelidiki kenapa push agen tidak membuat deploy Vercel.

## Fakta
- `gh run list`: 25 run terakhir workflow CI (.github/workflows/ci.yml, menjalankan `bash loop/gate.sh`) semuanya **failure**, setidaknya sejak commit 9c40a6b.
- Penyebab di run 846c2df: `src/lib/mcp/pengerasan.test.ts:47` mengharapkan terkirim < 1.000.000 byte, tetapi tercatat 1.000.448. Tes ini mengukur bahwa ambilTeksAman berhenti membaca setelah 5 KB. Server uji hanya berniat mengirim 1 MB. Di Linux runner, buffer soket kernel cukup besar untuk menampung hampir seluruh 1 MB sebelum klien menutup koneksi, sehingga batas 1 MB tercapai walau klien sudah berhenti. Di Windows lokal, buffer lebih kecil, jadi tes lulus.
- Gate lokal lulus, sehingga loop tidak pernah melihat merahnya CI. Pre-push hanya memeriksa gate lokal.

## Perbaikan (tick 196)
- Total kiriman server uji dinaikkan ke 32 MB (`TOTAL`), jauh di atas buffer kernel Linux yang lazim (beberapa MB), dan yang diperiksa tetap bahwa pengiriman berhenti sebelum total. Vitest lokal 10/10.
- Tes SQL slip_gaji juga bergantung tanggal: absen `now() - 2 hari` keluar dari jendela 30 hari gerbang_gaji(akhir bulan) di hari pertama bulan. Diganti `now() - 1 jam`; hasilnya HASIL_TES 27 | gagal=[] (1 Nov 2026).

## Aturan baru loop
Setelah setiap push, loop memeriksa `gh run list --limit 1` untuk commit itu. CI merah diperlakukan seperti gate merah: dicari penyebabnya, bukan diabaikan.

## Soal deploy Vercel (terkait, belum tuntas)
- Proyek Vercel `nadi`: `gitProviderOptions.createDeployments = "disabled"`, tetapi deployment produksi tetap tercatat dengan source `git` untuk push loop (b7e8032, 48b00a6, 839adc3, ...). Push agen 48b27e1 dan 846c2df tidak tercatat.
- Penyebab belum diketahui. CI merah tidak menjelaskannya, karena push loop yang ter-deploy juga CI-nya merah.
- Cara kerja aman sementara: setelah push agen, loop memeriksa deployment dan memastikan commit agen terbawa push loop berikutnya.
