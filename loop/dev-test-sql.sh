#!/bin/sh
# Jalankan tes SQL (supabase/tests/*.test.sql) di Supabase lokal. Setiap tes diakhiri raise exception (HASIL_TES ... atau
# '<nama>: n/m lulus, gagal=[...]'), jadi
# semua perubahan dibatalkan; runner tetap membungkus setiap tes dengan begin ... rollback supaya tes yang lupa
# melempar galat di akhir pun tidak menulis ke database lokal. Pakai: sh loop/dev-test-sql.sh [pola]   (contoh: sh loop/dev-test-sql.sh mod)
cd "$(dirname "$0")/.."
pola="${1:-}"
lulus=0; gagal=0; daftar_gagal=""
for f in supabase/tests/*${pola}*.test.sql; do
  out=$({ echo "begin;"; cat "$f"; printf "
rollback;
"; } | docker exec -i supabase_db_nadi psql -U postgres -d postgres -q 2>&1 | grep -E "HASIL_TES|gagal=\[" | head -1 | sed -E 's/^(ERROR|psql:[^ ]*):? *//')
  if echo "$out" | grep -q "gagal=\[\]"; then lulus=$((lulus + 1)); else gagal=$((gagal + 1)); daftar_gagal="$daftar_gagal\n$(basename "$f"): ${out:-tanpa baris hasil}"; fi
done
echo "tes SQL lokal: $lulus lulus, $gagal gagal"
[ -n "$daftar_gagal" ] && printf "%b\n" "$daftar_gagal" | cut -c1-300
exit 0
