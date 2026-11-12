"""CADANGAN-01: cadangan database Nadi mingguan, terenkripsi, ke Storage Bucket privat Hugging Face.

Dijalankan GitHub Actions (.github/workflows/cadangan-mingguan.yml). Langkah:
1. `supabase db dump` tiga berkas sesuai docs Supabase "Backup and Restore using the CLI" (roles.sql --role-only, schema.sql,
   data.sql --use-copy --data-only) memakai NADI_DB_URL (string Session pooler; secret yang dipasang pemilik, tidak dicetak).
2. Ketiganya diarsip tar.gz lalu dienkripsi AES-256-CBC + PBKDF2 (openssl enc) dengan NADI_KUNCI_CADANGAN, jadi Hugging Face hanya
   menyimpan sandi acak; tanpa kunci itu cadangan tidak bisa dibaca siapa pun, termasuk Nadi.
3. Diunggah ke bucket privat HF_BUCKET (dibuat bila belum ada, selalu privat) dengan token HF_TOKEN, beserta sidik SHA-256.
4. Diunduh balik dan dicek: sidik sama, bisa didekripsi, isinya tiga berkas yang diharapkan.
5. Hanya SIMPAN cadangan terbaru yang dipertahankan; yang lebih lama dihapus dari bucket.
Pulihkan: docs/panduan/cadangan.md. Uji fungsi murni: python -I scripts/cadangan.py selftest (langkah gerbang cadangan-uji).
"""
import datetime as dt
import hashlib
import os
import re
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import urlsplit

SIMPAN = 8
POLA = re.compile(r"^db/nadi-db-(\d{8})\.tar\.gz\.enc$")
BERKAS = ("roles.sql", "schema.sql", "data.sql")


def nama_cadangan(hari: dt.date) -> str:
    return f"db/nadi-db-{hari:%Y%m%d}.tar.gz.enc"


def yang_dihapus(daftar: list[str], simpan: int = SIMPAN) -> list[str]:
    """Cadangan lama yang dihapus: semua berkas cadangan kecuali `simpan` terbaru, beserta berkas sidiknya. Berkas lain tidak disentuh."""
    cadangan = sorted((p for p in daftar if POLA.match(p)), reverse=True)
    lama = cadangan[simpan:]
    return [x for p in lama for x in (p, p + ".sha256") if x == p or x in daftar]


def sidik(jalur: str) -> str:
    h = hashlib.sha256()
    with open(jalur, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def wajib_env(*nama: str) -> dict[str, str]:
    kurang = [n for n in nama if not os.environ.get(n)]
    if kurang:
        sys.exit("Belum dipasang: " + ", ".join(kurang) + ". Lihat docs/panduan/cadangan.md.")
    return {n: os.environ[n] for n in nama}


def jalankan(perintah: list[str], **kw) -> None:
    # Perintah dicetak tanpa argumen rahasia (string sambungan dan kunci lewat env, bukan argumen yang dicetak).
    print("$", " ".join(a if not a.startswith("postgresql://") else "<NADI_DB_URL>" for a in perintah), flush=True)
    subprocess.run(perintah, check=True, **kw)


def masalah_url(db_url: str) -> str | None:
    """Kesalahan bentuk string sambungan Session pooler, tanpa menyebut isinya; None bila bentuknya benar."""
    if "YOUR-PASSWORD" in db_url:
        return "Sandi belum diisi: ganti [YOUR-PASSWORD] dengan sandi database (kurung sikunya ikut dihapus)."
    try:
        u = urlsplit(db_url)
        port = u.port
    except ValueError:
        return "String sambungan tidak terbaca. Bila sandi memuat @ : / # ? atau %, reset sandi database dengan huruf dan angka saja."
    if u.scheme not in ("postgresql", "postgres"):
        return "String sambungan harus diawali postgresql://"
    if not u.password:
        return "Sandi belum diisi: ganti [YOUR-PASSWORD] dengan sandi database (kurung sikunya ikut dihapus)."
    if not (u.username or "").startswith("postgres."):
        return "Nama pengguna Session pooler berbentuk postgres.<id proyek>; salin ulang dari Connect, Session pooler."
    if port not in (5432, 6543) or not (u.hostname or "").endswith("pooler.supabase.com"):
        return "Pakai string Session pooler (host ...pooler.supabase.com, port 5432), bukan direct connection."
    return None


def dump(folder: str, db_url: str) -> None:
    m = masalah_url(db_url)
    if m:
        sys.exit("NADI_DB_URL: " + m)
    try:
        jalankan(["supabase", "db", "dump", "--db-url", db_url, "-f", os.path.join(folder, "roles.sql"), "--role-only"])
    except subprocess.CalledProcessError:
        sys.exit("supabase db dump gagal. Bila log menulis password authentication failed: sandi di NADI_DB_URL salah. Reset sandi database "
                 "(huruf dan angka saja) di Supabase, Database settings, lalu perbarui secret NADI_DB_URL.")
    jalankan(["supabase", "db", "dump", "--db-url", db_url, "-f", os.path.join(folder, "schema.sql")])
    jalankan(["supabase", "db", "dump", "--db-url", db_url, "-f", os.path.join(folder, "data.sql"), "--use-copy", "--data-only"])
    for b in BERKAS:
        ukuran = os.path.getsize(os.path.join(folder, b))
        print(f"{b}: {ukuran} byte")
        if ukuran == 0:
            sys.exit(f"{b} kosong; cadangan dihentikan.")
    with open(os.path.join(folder, "data.sql"), encoding="utf-8", errors="replace") as f:
        isi = f.read(50_000_000)
    if 'COPY "public"."perusahaan"' not in isi and "COPY public.perusahaan" not in isi:
        sys.exit("data.sql tidak memuat tabel perusahaan; cadangan dihentikan.")


def enkripsi(masuk: str, keluar: str) -> None:
    jalankan(["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-salt", "-in", masuk, "-out", keluar, "-pass", "env:NADI_KUNCI_CADANGAN"])


def dekripsi(masuk: str, keluar: str) -> None:
    jalankan(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-in", masuk, "-out", keluar, "-pass", "env:NADI_KUNCI_CADANGAN"])


def utama() -> None:
    env = wajib_env("NADI_DB_URL", "HF_TOKEN", "NADI_KUNCI_CADANGAN", "HF_BUCKET")
    from huggingface_hub import batch_bucket_files, bucket_info, create_bucket, list_bucket_tree  # noqa: PLC0415

    bucket = env["HF_BUCKET"]
    create_bucket(bucket, private=True, exist_ok=True)
    if not bucket_info(bucket).private:
        sys.exit(f"Bucket {bucket} tidak privat; cadangan tidak diunggah.")
    hari = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    nama = nama_cadangan(hari)
    with tempfile.TemporaryDirectory() as tmp:
        dump(tmp, env["NADI_DB_URL"])
        arsip = os.path.join(tmp, "nadi-db.tar.gz")
        with tarfile.open(arsip, "w:gz") as t:
            for b in BERKAS:
                t.add(os.path.join(tmp, b), arcname=b)
        sandi = os.path.join(tmp, "nadi-db.tar.gz.enc")
        enkripsi(arsip, sandi)
        s = sidik(sandi)
        batch_bucket_files(bucket, add=[(sandi, nama), (f"{s}  {os.path.basename(nama)}\n".encode(), nama + ".sha256")])
        print(f"Terunggah {nama} ({os.path.getsize(sandi)} byte, sha256 {s})")

        # Uji pulih: unduh balik, sidik sama, bisa didekripsi, isinya tiga berkas.
        balik = os.path.join(tmp, "balik.enc")
        jalankan(["hf", "buckets", "cp", f"hf://buckets/{bucket}/{nama}", balik])
        if sidik(balik) != s:
            sys.exit("Sidik cadangan yang diunduh balik berbeda.")
        polos = os.path.join(tmp, "balik.tar.gz")
        dekripsi(balik, polos)
        with tarfile.open(polos, "r:gz") as t:
            isi = sorted(t.getnames())
        if isi != sorted(BERKAS):
            sys.exit(f"Isi cadangan tidak lengkap: {isi}")
        print("Uji pulih lulus: sidik sama, dekripsi berhasil, berisi " + ", ".join(isi))

    daftar = [x.path for x in list_bucket_tree(bucket, prefix="db")]
    hapus = yang_dihapus(daftar)
    if hapus:
        batch_bucket_files(bucket, delete=hapus)
    print(f"Cadangan tersimpan: {min(len([p for p in daftar if POLA.match(p)]), SIMPAN)}; dihapus: {len(hapus)}")


def selftest() -> int:
    gagal = []

    def cek(nama, ok):
        if not ok:
            gagal.append(nama)

    cek("url tanpa sandi ditolak", "Sandi belum diisi" in (masalah_url("postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres") or ""))
    cek("url direct connection ditolak", "Session pooler" in (masalah_url("postgresql://postgres:x@db.abc.supabase.co:5432/postgres") or ""))
    cek("url pooler benar diterima", masalah_url("postgresql://postgres.abc:Sandi123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres") is None)
    cek("nama berkas memakai tanggal", nama_cadangan(dt.date(2026, 11, 16)) == "db/nadi-db-20261116.tar.gz.enc")
    daftar = [nama_cadangan(dt.date(2026, 1, 5) + dt.timedelta(weeks=i)) for i in range(10)]
    daftar += [p + ".sha256" for p in daftar] + ["db/README.md", "lain/nadi-db-20200101.tar.gz.enc"]
    h = yang_dihapus(daftar)
    cek("dua cadangan terlama dihapus beserta sidiknya", sorted(h) == sorted([daftar[0], daftar[0] + ".sha256", daftar[1], daftar[1] + ".sha256"]))
    cek("berkas lain tidak disentuh", "db/README.md" not in h and "lain/nadi-db-20200101.tar.gz.enc" not in h)
    cek("delapan atau kurang: tidak ada yang dihapus", yang_dihapus(daftar[2:10]) == [])
    cek("sidik tanpa .sha256 tetap aman", yang_dihapus([nama_cadangan(dt.date(2026, 1, 1) + dt.timedelta(weeks=i)) for i in range(9)]) == [nama_cadangan(dt.date(2026, 1, 1))])
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "a")
        with open(p, "wb") as f:
            f.write(b"nadi")
        cek("sidik sha256", sidik(p) == hashlib.sha256(b"nadi").hexdigest())
    print("cadangan selftest:", "LULUS" if not gagal else "GAGAL " + "; ".join(gagal))
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(selftest() if sys.argv[1:2] == ["selftest"] else utama())
