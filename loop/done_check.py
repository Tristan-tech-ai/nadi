"""done_check: satu-satunya jalan menulis loop/DONE_OK (aplikasi 100%, loop berhenti).
Syarat (semua harus benar, dicek mesin, bukan klaim):
  1. semua tugas wajib di WORK_QUEUE.json berstatus done (yang dibatalkan harus punya alasan dan tidak boleh lebih dari 10%);
  2. DONE-01 (skenario akhir di produksi) selesai;
  3. loop/gate_last.json lulus untuk HEAD, tanpa kode belum commit, dan semua commit sudah di-push;
  4. URL produksi di loop/prod_url.txt menjawab 200;
  5. tidak ada tugas kind=fix yang masih terbuka.
Pemakaian: python -I loop/done_check.py   (exit 0 dan menulis DONE_OK bila lulus; exit 1 dan mencetak kekurangan bila belum)"""
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def main():
    q = json.load(open(os.path.join(HERE, "WORK_QUEUE.json"), encoding="utf-8"))["tasks"]
    kurang = []
    w = [t for t in q if t.get("wajib")]
    batal = [t for t in w if t["status"] == "cancelled"]
    belum = [t["id"] for t in w if t["status"] not in ("done", "cancelled")]
    if belum:
        kurang.append(f"{len(belum)} tugas wajib belum selesai: " + ", ".join(belum[:20]))
    if len(batal) > 0.1 * max(1, len(w)):
        kurang.append(f"terlalu banyak tugas wajib dibatalkan ({len(batal)} dari {len(w)})")
    if not any(t["id"] == "DONE-01" and t["status"] == "done" for t in q):
        kurang.append("DONE-01 (skenario akhir di produksi) belum selesai")
    fix = [t["id"] for t in q if t["kind"] == "fix" and t["status"] not in ("done", "cancelled")]
    if fix:
        kurang.append("tugas fix masih terbuka: " + ", ".join(fix))
    head = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    try:
        g = json.load(open(os.path.join(HERE, "gate_last.json"), encoding="utf-8"))
    except Exception:
        g = {}
    if not (g.get("ok") and g.get("head") == head and g.get("kode_belum_commit") == 0):
        kurang.append("gerbang belum lulus untuk HEAD")
    ahead = subprocess.run(["git", "-C", REPO, "rev-list", "--count", "@{u}..HEAD"], capture_output=True, text=True).stdout.strip()
    if ahead != "0":
        kurang.append(f"commit belum di-push: {ahead}")
    try:
        url = open(os.path.join(HERE, "prod_url.txt"), encoding="utf-8").read().strip()
        code = urllib.request.urlopen(url, timeout=20).status
        if code != 200:
            kurang.append(f"produksi menjawab {code}")
    except Exception as e:
        kurang.append(f"produksi tidak bisa diperiksa: {e!r}"[:200])
    if kurang:
        print("BELUM 100%:\n- " + "\n- ".join(kurang))
        return 1
    with open(os.path.join(HERE, "DONE_OK"), "w", encoding="utf-8") as f:
        f.write(f"HEAD {head}; {len(w)} tugas wajib selesai; produksi {url} 200\n")
    print("100%: DONE_OK ditulis. Loop berhenti setelah laporan akhir.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
