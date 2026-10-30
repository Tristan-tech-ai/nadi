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

step rahasia bash scripts/check-secrets.sh
# TANPA JEJAK: nama asisten pengembang tidak boleh ada di berkas terlacak maupun riwayat (pola ditulis terpecah agar skrip ini lolos sendiri)
jejak() { local P='c[l]aude|noreply@a[n]thropic|co-a[u]thored-by'; ! git grep -qiIE "$P" -- . && ! git log --format='%an%n%ae%n%cn%n%ce%n%B' | grep -qiE "$P"; }
step jejak jejak
step antrean python -I loop/next_task.py selftest
step penjaga python -I loop/hooks/wake_guard.py selftest
step macet python -I loop/hooks/macet_guard.py selftest
if [ -f package.json ] && [ -d apps/web ]; then
  step lint pnpm -s lint
  step tipe pnpm -s typecheck
  step unit pnpm -s test
  [ $CEPAT = 1 ] || step build env NEXT_PUBLIC_SUPABASE_URL=https://izyesrryiljitpusaqvf.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-build pnpm -s build
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
