"""Memastikan setiap migrasi di database identik dengan berkasnya di supabase/migrations (gerbang "migrasi sama persis").
Jalankan di database lewat MCP execute_sql:
  select json_object_agg(name, md5(regexp_replace(array_to_string(statements, ''), '\\s+', '', 'g'))) from supabase_migrations.schema_migrations;
lalu berikan hasil JSON-nya ke skrip ini:
  python -I scripts/cek-migrasi.py '{"fondasi": "...", "graf_usaha": "..."}'
Pembanding mengabaikan spasi (pemformatan), bukan isi. Exit 1 bila ada yang beda, hilang dari repo, atau belum ter-apply."""
import hashlib
import json
import os
import re
import sys

DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supabase", "migrations")


def sidik(teks):
    return hashlib.md5(re.sub(r"\s+", "", teks).encode("utf-8")).hexdigest()


def main(db):
    berkas = {}
    for f in sorted(os.listdir(DIR)):
        if f.endswith(".sql"):
            nama = re.sub(r"^\d+_", "", f[:-4])
            berkas[nama] = sidik(open(os.path.join(DIR, f), encoding="utf-8").read())
    gagal = 0
    for nama in sorted(set(berkas) | set(db)):
        if nama not in berkas:
            print(f"GAGAL {nama}: ada di database, tidak ada berkasnya di repo"); gagal += 1
        elif nama not in db:
            print(f"GAGAL {nama}: berkas ada, belum ter-apply"); gagal += 1
        elif berkas[nama] != db[nama]:
            print(f"GAGAL {nama}: isi berbeda (repo {berkas[nama][:8]}, db {db[nama][:8]})"); gagal += 1
        else:
            print(f"ok    {nama} {db[nama][:8]}")
    print("MIGRASI SAMA PERSIS" if not gagal else f"{gagal} MIGRASI TIDAK COCOK")
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main(json.loads(sys.argv[1])))
