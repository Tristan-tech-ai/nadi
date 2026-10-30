#!/bin/bash
# Pemindai rahasia sederhana: gagal bila ada pola kunci/kredensial di berkas yang dilacak git.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
PATTERN='AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|sb_secret_[A-Za-z0-9_-]+|postgres(ql)?://[^:@/ ]+:[^@ ]+@|mongodb(\+srv)?://[^:@/ ]+:[^@ ]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|service_role"?\s*[:=]\s*"?eyJ'
hits=$(git grep -nIE "$PATTERN" -- . ':!scripts/check-secrets.sh' ':!pnpm-lock.yaml' || true)
if [ -n "$hits" ]; then
  echo "Kemungkinan rahasia ditemukan (nilai disembunyikan):"
  echo "$hits" | sed -E 's/(:[0-9]+:).*/\1 [disembunyikan]/'
  exit 1
fi
echo "Tidak ada rahasia terdeteksi."
