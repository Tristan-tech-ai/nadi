#!/bin/sh
# Next lokal (port 3100) yang memakai Supabase lokal, untuk mode tanpa commit (loop/TANPA_COMMIT).
# Hanya API_URL dan PUBLISHABLE_KEY yang diambil dari `supabase status`; kunci lain (service role, JWT secret) tidak
# pernah dibaca ke variabel atau dicetak. process.env menang atas .env.local (docs bawaan Next 02-guides/environment-variables.md,
# "Environment Variable Load Order"), jadi .env.local produksi tidak ikut terpakai.
# Pemakaian: sh loop/dev.sh            (pnpm dev, distDir .next-dev)
#            sh loop/dev.sh cek        (hanya memastikan env lokal terbaca, tanpa mencetak nilainya)
set -eu
cd "$(dirname "$0")/.."
ambil() { npx supabase status -o env 2>/dev/null | grep -E "^$1=" | head -1 | cut -d= -f2- | tr -d '"'; }
URL=$(ambil API_URL)
KUNCI_PUBLIK=$(ambil PUBLISHABLE_KEY)
[ -n "$URL" ] || { echo "Supabase lokal belum menyala: jalankan npx supabase start" >&2; exit 1; }
case "$URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "API_URL bukan lokal, berhenti" >&2; exit 1 ;; esac
[ -n "$KUNCI_PUBLIK" ] || { echo "PUBLISHABLE_KEY lokal tidak terbaca" >&2; exit 1; }
if [ "${1:-}" = "cek" ]; then echo "dev lokal siap: $URL (kunci publik ${#KUNCI_PUBLIK} huruf)"; exit 0; fi
cd apps/web
NEXT_PUBLIC_SUPABASE_URL="$URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$KUNCI_PUBLIK" NADI_ASAL="http://localhost:3100" \
  NEXT_DIST_DIR=.next-dev exec pnpm exec next dev -p 3100
