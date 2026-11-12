#!/bin/bash
# Gerbang kualitas statis Nadi. Dijalankan dari mana saja; menulis loop/gate_last.json untuk HEAD saat ini.
# wake_guard.py menolak ScheduleWakeup bila HEAD belum lulus gerbang ini (atau ada perubahan belum di-commit di kode).
# Pemakaian: bash loop/gate.sh          (semua langkah)
#            bash loop/gate.sh --cepat  (tanpa build; untuk iterasi kecil, tidak menghasilkan ok=true)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
CEPAT=0; [ "${1:-}" = "--cepat" ] && CEPAT=1
declare -a NAMES=(); declare -a RES=()
step() {  # step NAMA perintah...
  local name="$1"; shift
  local t0=$(date +%s)
  if "$@" > "loop/.gate_$name.log" 2>&1; then RES+=("ok"); else RES+=("GAGAL"); fi
  NAMES+=("$name")
  echo "[$name] ${RES[-1]} ($(( $(date +%s) - t0 )) dtk)"
  [ "${RES[-1]}" = "ok" ] || tail -25 "loop/.gate_$name.log"
}

# Hook git lokal (commit-msg, pre-push) dipasang dari salinan di repo agar tidak hilang saat clone ulang.
for h in scripts/git-hooks/*; do cmp -s "$h" ".git/hooks/$(basename "$h")" || { cp "$h" .git/hooks/ && chmod +x ".git/hooks/$(basename "$h")"; }; done
step rahasia bash scripts/check-secrets.sh
# TANPA JEJAK: nama asisten pengembang tidak boleh ada di berkas terlacak maupun riwayat (pola ditulis terpecah agar skrip ini lolos sendiri)
# TANPA JEJAK (loop/hooks/jejak.py): jejak pengembangan selalu ditolak; nama aplikasi AI boleh hanya dalam konteks produk (Tristan 6 Nov 2026).
step jejak-uji python -I loop/hooks/jejak.py selftest
step jejak python -I loop/hooks/jejak.py repo
step antrean python -I loop/next_task.py selftest
step penjaga python -I loop/hooks/wake_guard.py selftest
step macet python -I loop/hooks/macet_guard.py selftest
step slop-uji python -I scripts/cek-slop.py --selftest
step slop python -I scripts/cek-slop.py
step tulisan-uji python -I scripts/cek-tulisan.py --selftest
step tulisan python -I scripts/cek-tulisan.py
step cadangan-uji python -I scripts/cadangan.py selftest
step mekari-uji python -I docs/research/mekari/alat/cek_cakupan.py --selftest
step mekari python -I docs/research/mekari/alat/cek_cakupan.py
step efaktur-uji python -I scripts/pajak/validasi-xsd.py --selftest
step efaktur python -I scripts/pajak/validasi-xsd.py
if [ -f package.json ] && [ -d apps/web ]; then
  step lint pnpm -s lint
  step tipe pnpm -s typecheck
  step unit pnpm -s test
  [ $CEPAT = 1 ] || step build env NEXT_DIST_DIR=.next-gate NEXT_PUBLIC_SUPABASE_URL=https://izyesrryiljitpusaqvf.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-build NEXT_PUBLIC_NADI_UJI_WAJAH= pnpm -s build
  # Q-20: penanda uji cek wajah tidak boleh ada di JS hasil build tanpa NEXT_PUBLIC_NADI_UJI_WAJAH=1 (setara build Vercel).
  [ $CEPAT = 1 ] || step uji-wajah bash -c '! grep -rlq __nadiUjiWajah apps/web/.next-gate/static'
fi

OK=true; for r in "${RES[@]}"; do [ "$r" = "ok" ] || OK=false; done
[ $CEPAT = 1 ] && OK=false   # gerbang cepat tidak pernah sah untuk menjadwalkan tick
DIRTY=$(git status --porcelain -- apps supabase scripts packages 2>/dev/null | wc -l)
HEAD=$(git rev-parse HEAD 2>/dev/null || echo none)
python -I - "$HEAD" "$OK" "$DIRTY" "${NAMES[*]}" "${RES[*]}" <<'EOF'
import json, sys, datetime
head, ok, dirty, names, res = sys.argv[1:6]
json.dump({"head": head, "ok": ok == "true", "kode_belum_commit": int(dirty), "langkah": dict(zip(names.split(), res.split())),
           "waktu": datetime.datetime.now().isoformat(timespec="seconds")}, open("loop/gate_last.json", "w"), indent=1)
EOF
echo "GERBANG: $([ $OK = true ] && echo LULUS || echo TIDAK LULUS) untuk HEAD ${HEAD:0:8} (kode belum commit: $DIRTY)"
[ $OK = true ]
