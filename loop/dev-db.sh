#!/bin/sh
# Terapkan migrasi ke Supabase lokal mengikuti urutan produksi (supabase/urutan-produksi.txt).
# Pakai: sh loop/dev-db.sh            (semua yang belum tercatat di app_dev.terapan)
#        sh loop/dev-db.sh nama_migrasi (satu migrasi, untuk migrasi baru)
# Setelah migrasi: loop/dev-seed.sql (konfigurasi yang di produksi diisi di luar migrasi).
# Tidak pernah menyentuh produksi. Butuh: npx supabase start (container supabase_db_nadi).
set -e
cd "$(dirname "$0")/.."
DB="docker exec -i supabase_db_nadi psql -1 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$DB -c "create schema if not exists app_dev; create table if not exists app_dev.terapan (nama text primary key, waktu timestamptz default now());" >/dev/null
terapkan() {
  nama="$1"
  ada=$($DB -tAc "select 1 from app_dev.terapan where nama = '$nama'" < /dev/null)
  [ "$ada" = "1" ] && return 0
  f=$(ls supabase/migrations/*_"$nama".sql 2>/dev/null | head -1)
  [ -z "$f" ] && { echo "TIDAK ADA BERKAS: $nama"; return 1; }
  if $DB < "$f" >/tmp/dev-db.log 2>&1; then
    $DB -c "insert into app_dev.terapan (nama) values ('$nama')" >/dev/null < /dev/null
    echo "ok $nama"
  else
    echo "GAGAL $nama"; tail -5 /tmp/dev-db.log; return 1
  fi
}
if [ -n "$1" ]; then terapkan "$1"; exit $?; fi
grep -vE '^\s*(#|$)' supabase/urutan-produksi.txt | while read -r n; do terapkan "$n" || exit 1; done
$DB < loop/dev-seed.sql >/dev/null && echo "seed konfigurasi lokal: ok (loop/dev-seed.sql)"
# Kunci VAPID lokal sekali pakai (produksi menyimpan kuncinya sendiri di vault). SQL dipipa langsung, tidak dicetak.
if [ "$($DB -tAc 'select count(*) from app.vapid' < /dev/null)" = "0" ]; then
  node loop/dev-vapid.mjs | $DB >/dev/null && echo "kunci VAPID lokal: dibuat"
fi
echo "selesai: $($DB -tAc 'select count(*) from app_dev.terapan') migrasi tercatat"
