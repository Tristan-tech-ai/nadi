"""Lingkungan uji staging Nadi (UAT-BEBAN): pasang migrasi produksi ke proyek Supabase staging lewat Management API.

Token akses pribadi (PAT) dibuat Tristan dan disimpan di berkas di luar repo; skrip ini membacanya ke memori dan tidak
pernah mencetaknya. Endpoint: POST https://api.supabase.com/v1/projects/{ref}/database/query (docs Supabase Management API
"Run sql query", dibaca 12 Nov 2026). Hanya untuk proyek staging; ref produksi ditolak.

Pakai:
  python -I loop/staging.py cek REF          koneksi dan jumlah migrasi tercatat
  python -I loop/staging.py migrasi REF      semua migrasi supabase/urutan-produksi.txt yang belum tercatat, lalu loop/dev-seed.sql
Berkas token: env NADI_PAT_STAGING, bawaan ../proposal/alat-staging/supabase-pat.txt (relatif ke repo).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUKSI = "izyesrryiljitpusaqvf"
BERKAS_TOKEN = os.environ.get("NADI_PAT_STAGING") or os.path.join(os.path.dirname(AKAR), "proposal", "alat-staging", "supabase-pat.txt")


def token() -> str:
    with open(BERKAS_TOKEN, encoding="utf-8") as f:
        t = f.read().strip()
    if not t:
        sys.exit("berkas token kosong")
    return t


def sql(ref: str, kueri: str, tok: str, coba: int = 3):
    if ref == PRODUKSI:
        sys.exit("ref produksi ditolak: skrip ini hanya untuk staging")
    badan = json.dumps({"query": kueri}).encode("utf-8")
    for i in range(coba):
        req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=badan, method="POST",
                                     headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "nadi-staging"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read() or b"[]")
        except urllib.error.HTTPError as e:
            pesan = e.read().decode("utf-8", "replace")[:600]
            if e.code == 429 and i < coba - 1:
                time.sleep(10 * (i + 1))
                continue
            raise RuntimeError(f"HTTP {e.code}: {pesan}") from None
    raise RuntimeError("gagal setelah beberapa percobaan")


def urutan() -> list[str]:
    with open(os.path.join(AKAR, "supabase", "urutan-produksi.txt"), encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]


def berkas_migrasi(nama: str) -> str:
    folder = os.path.join(AKAR, "supabase", "migrations")
    cocok = [n for n in os.listdir(folder) if n.endswith(f"_{nama}.sql")]
    if not cocok:
        raise RuntimeError(f"tidak ada berkas migrasi untuk {nama}")
    with open(os.path.join(folder, sorted(cocok)[0]), encoding="utf-8") as f:
        return f.read()


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("cek", "migrasi"):
        sys.exit(__doc__)
    aksi, ref = sys.argv[1], sys.argv[2]
    tok = token()
    sql(ref, "create schema if not exists app_dev; create table if not exists app_dev.terapan (nama text primary key, waktu timestamptz default now());", tok)
    sudah = {r["nama"] for r in sql(ref, "select nama from app_dev.terapan", tok)}
    daftar = urutan()
    if aksi == "cek":
        print(f"staging {ref}: {len(sudah)} dari {len(daftar)} migrasi tercatat")
        return
    for i, nama in enumerate(daftar, 1):
        if nama in sudah:
            continue
        isi = berkas_migrasi(nama)
        try:
            sql(ref, isi, tok)
        except RuntimeError as e:
            sys.exit(f"GAGAL {i}/{len(daftar)} {nama}: {e}")
        sql(ref, f"insert into app_dev.terapan (nama) values ('{nama}') on conflict do nothing", tok)
        print(f"ok {i}/{len(daftar)} {nama}", flush=True)
    with open(os.path.join(AKAR, "loop", "dev-seed.sql"), encoding="utf-8") as f:
        sql(ref, f.read(), tok)
    print("seed konfigurasi: ok (loop/dev-seed.sql)")
    print(f"staging {ref}: {len(sql(ref, 'select 1 from app_dev.terapan', tok))} migrasi tercatat")


if __name__ == "__main__":
    main()
