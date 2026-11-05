#!/usr/bin/env bash
# V-04: footage CCTV asli untuk Mata (Pexels 37706044, Pexels License; lihat docs/ASSETS.md). Berkas utuh TIDAK masuk repo.
# Menyiapkan: (1) fixture uji fixtures/korpus/mata-nyata (abu-abu 160x90 5 fps), (2) potongan film docs/promo/demo-v3/assets/mata/pasar.mp4.
# Potongan = lorong bawah 1440x810 mulai y 1750 (tanpa papan merek; orang hanya tampak dari atas). Jalankan dari folder nadi.
set -euo pipefail
SEM="${TMPDIR:-/tmp}/cctv-nyata"; mkdir -p "$SEM"
curl -sL -A "Mozilla/5.0" -o "$SEM/pasar.mp4" "https://videos.pexels.com/video-files/37706044/15989238_1440_2560_30fps.mp4"
ffmpeg -v error -y -i "$SEM/pasar.mp4" -vf "crop=1440:810:0:1750,fps=5,scale=160:90,format=gray" -f rawvideo fixtures/korpus/mata-nyata/pasar-bawah-160x90-5fps.gray
mkdir -p docs/promo/demo-v3/assets/mata
ffmpeg -v error -y -i "$SEM/pasar.mp4" -t 9.5 -an -vf "crop=1440:810:0:1750,fps=30" -c:v libx264 -crf 18 -pix_fmt yuv420p docs/promo/demo-v3/assets/mata/pasar.mp4
# Jejak untuk film: keluaran Pelacak aplikasi pada fixture, dan fungsi gambar yang sama dengan layar Mata.
(cd apps/web && MATA_TULIS="../../docs/promo/demo-v3/assets/mata/jejak.json" npx vitest run src/lib/mata/jejak-nyata.test.ts)
(cd apps/web && npx tsc src/lib/mata/gambar.ts --outDir ../../docs/promo/demo-v3/assets/mata --target es2020 --module es2020 --lib es2020,dom || true)
