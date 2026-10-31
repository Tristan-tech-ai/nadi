# Kuota deploy Vercel Hobby habis: penyebab push tidak ter-deploy

Ditemukan 1 Nov 2026 (tick 197). Menggantikan dugaan di docs/quality/ci-merah.md bagian "Soal deploy Vercel", yaitu bahwa push agen tidak ter-deploy. Dugaan itu salah.

## Fakta
- **Batas resmi:** docs/limits (https://vercel.com/docs/limits, last_updated 2026-09-16, diakses 1 Nov 2026) menyebut "Deployments Created per Day: Hobby 100". Rinciannya: "You are able to deploy 100 times every 86400 seconds (1 day). Should you hit the rate limit, you will need to wait another day before you can deploy again."
- **Pemakaian proyek:** API deployments proyek nadi, 24 jam terakhir: 100 deployment, semuanya READY. 206 commit dalam periode yang sama. Slot pertama baru bebas sekitar 585 menit lagi (dihitung tick 197).
- **Commit yang tidak ter-deploy:** 48b27e1, 846c2df, 3a34deb, 6d76733. Ada push agen dan ada push loop. Polanya bukan "push agen", tetapi kuota yang sudah penuh.
- **Ignored Build Step tidak menolong.** docs/project-configuration/project-settings (diakses 1 Nov 2026): "Canceled builds are counted as full deployments ... will still count towards your deployment quotas".
- **Deploy lewat CLI tetap jalan saat kuota git penuh.**
  - Bukti: `npx vercel@latest deploy --prod --yes` dari akar repo (tertaut ke prj_ySaKIq..., rootDirectory apps/web) menghasilkan dpl_HDLdqSr9j3LP6anJnZj1KrxrJfPu, source cli, target production, READY, githubCommitSha 6d76733. Domain produksi nadi-tristan-tech-ais-projects.vercel.app langsung melayaninya (e2e bagi-adil lulus).
  - Changelog "CLI deployment limits removed" (17 Jun 2026) hanya menyebut batas khusus CLI dihapus. Apakah deploy CLI tetap dihitung ke kuota 100/hari tidak dinyatakan. Bukti tick 197 menunjukkan deploy CLI tidak ditolak saat kuota git penuh.
- **CLI mengunggah isi folder kerja, bukan isi commit.** Deploy CLI hanya boleh dijalankan saat `git status --short apps` kosong dan HEAD sudah di-push, supaya yang tayang sama persis dengan commit.

## Aturan loop baru (DECISIONS 1 Nov 2026)
1. **Hemat deploy dari git.** Dokumen loop (docs/, loop/) tidak di-push sendirian setiap tick. Dokumen itu menunggu dan ikut push kode berikutnya, atau dikumpulkan paling sering sekali per jam. Wake_guard hanya menolak commit yang belum di-push, bukan berkas yang belum di-commit.
2. **Setelah setiap push yang menyentuh apps/web**, periksa deployment untuk commit itu. Bila tidak ada dalam 5 menit dan `git status --short apps` kosong, deploy lewat CLI dari akar repo, lalu catat id deploy-nya di bukti.
3. **Bila CLI juga ditolak**, tugas yang butuh e2e produksi menunggu slot kuota. Waktunya dihitung dari daftar deployment 24 jam terakhir (yang tertua + 24 jam). Loop tidak menunggu: ia mengerjakan tugas lain.
