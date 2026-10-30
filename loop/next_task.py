"""next_task: antrean kerja loop Nadi (diadaptasi dari loop riset Tristan, 10 Okt 2026).
Pelajaran asal: tanpa daftar tugas yang jelas, tick yang sepi berakhir dengan "hanya pemantauan". Di sini setiap tick
mengambil tugas READY teratas dan menyelesaikannya sampai ada bukti.

WORK_QUEUE.json berisi tugas: id, title, fase (F0..F6, Q, D, R), kind (build|test|design|research|fix|hunt|deploy|maint),
priority (angka kecil = lebih dulu), size (s|m|l), accept (kriteria terima, ditulis SEBELUM dikerjakan), how, wajib (bagian dari
definisi 100%), blocked_by, status (ready|running|done|blocked|cancelled), result (bukti: commit, berkas, URL).

Perintah (dari folder nadi/):
  python loop/next_task.py              cetak tugas READY teratas (tidak mencatat apa pun)
  python loop/next_task.py list [fase]  semua tugas
  python loop/next_task.py start ID
  python loop/next_task.py done ID BUKTI    BUKTI wajib menyebut commit/berkas/URL/angka, bukan "selesai"
  python loop/next_task.py add ID fase kind priority size wajib(0|1) "judul" "kriteria terima" "cara"
  python loop/next_task.py block ID "alasan"  /  unblock ID  /  cancel ID "alasan"
  python loop/next_task.py check        gerbang klaim "tidak ada yang bisa dikerjakan": READY n; exit 0 bila n >= 3,
                                        exit 3 (REFILL) bila 1..2; bila 0 menulis loop/.queue_empty (sertifikat 20 menit)
  python loop/next_task.py progress     persentase tugas wajib yang selesai (dipakai done_check.py)
Uji diri: python loop/next_task.py selftest"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
Q = os.path.join(HERE, "WORK_QUEUE.json")
CERT = os.path.join(HERE, ".queue_empty")
KINDS = ("build", "test", "design", "research", "fix", "hunt", "deploy", "maint")
WEAK_PROOF = re.compile(r"^\s*(ok|selesai|done|beres|sudah)\s*\.?\s*$", re.I)


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def load(path=Q):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(d, path=Q):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, indent=1, ensure_ascii=False)
        f.write("\n")


def blocked(t, d):
    if t.get("blocked_by"):
        ids = {u["id"]: u for u in d["tasks"]}
        deps = [x.strip() for x in str(t["blocked_by"]).split(",") if x.strip()]
        # blocked_by berisi ID tugas lain: terbuka otomatis saat semuanya selesai; teks bebas = blokir manual
        if deps and all(x in ids for x in deps):
            return not all(ids[x]["status"] == "done" for x in deps)
        return True
    return False


def ready(d):
    r = [t for t in d["tasks"] if t["status"] == "ready" and not blocked(t, d)]
    # fix dulu (gerbang merah), lalu prioritas, lalu yang kecil
    return sorted(r, key=lambda t: (0 if t["kind"] == "fix" else 1, t["priority"], {"s": 0, "m": 1, "l": 2}.get(t.get("size", "m"), 1), t["id"]))


def show(t):
    print(f"TUGAS {t['id']} [{t['fase']}, {t['kind']}, prioritas {t['priority']}, ukuran {t.get('size', 'm')}{', WAJIB' if t.get('wajib') else ''}]: {t['title']}")
    print(f"KRITERIA TERIMA (ditulis sebelum dikerjakan): {t['accept']}")
    print(f"CARA: {t['how']}")


def check(d, cert=CERT):
    r = ready(d)
    n = len(r)
    print(f"READY {n}: " + ", ".join(t["id"] for t in r[:15]) + (" ..." if n > 15 else ""))
    if n >= 3:
        return 0
    if n == 0:
        with open(cert, "w", encoding="utf-8") as f:
            f.write(now() + " antrean kosong; terblokir: " + ", ".join(f"{t['id']} ({t.get('blocked_by')})" for t in d["tasks"] if t["status"] in ("ready", "blocked") and blocked(t, d)))
        print("ANTREAN KOSONG: sertifikat ditulis (berlaku 20 menit). Isi ulang dari docs/PLAN.md, hasil perburuan bug, dan riset sekarang juga.")
        return 0
    print("REFILL: kurang dari 3 tugas siap. Ide adalah kerja: tambah kandidat dengan kriteria terima (python loop/next_task.py add ...).")
    return 3


def progress(d):
    w = [t for t in d["tasks"] if t.get("wajib") and t["status"] != "cancelled"]
    done = [t for t in w if t["status"] == "done"]
    pct = (100.0 * len(done) / len(w)) if w else 0.0
    return len(done), len(w), pct


def main(a):
    d = load()
    if not a:
        run = [t for t in d["tasks"] if t["status"] == "running"]
        for t in run:
            print("MASIH BERJALAN (selesaikan dulu atau beri alasan): " + t["id"] + " " + t["title"][:100])
        r = ready(d)
        if not r and not run:
            print("tidak ada tugas READY: jalankan python loop/next_task.py check")
            return 0
        if r:
            show(r[0])
            print(f"({len(r) - 1} tugas siap lainnya)")
        return 0
    c = a[0]
    if c == "list":
        f = a[1] if len(a) > 1 else None
        for t in sorted(d["tasks"], key=lambda t: (t["status"] != "running", t["status"] != "ready", t["priority"], t["id"])):
            if f and t["fase"] != f:
                continue
            flag = " [terblokir: " + str(t.get("blocked_by")) + "]" if blocked(t, d) and t["status"] not in ("done", "cancelled") else ""
            print(f"{t['id']:7s} {t['status']:9s} p{t['priority']:<3} {t['fase']:3s} {t['kind']:8s} {'W' if t.get('wajib') else ' '} {t['title'][:80]}{flag}" + (f"  -> {t['result'][:60]}" if t.get("result") else ""))
    elif c == "start":
        for t in d["tasks"]:
            if t["id"] == a[1]:
                t.update(status="running", started=now())
        save(d)
        print("mulai", a[1])
    elif c == "done":
        if len(a) < 3 or WEAK_PROOF.match(a[2]) or len(a[2].strip()) < 12:
            print("DITOLAK: BUKTI harus menyebut commit, berkas, URL, atau angka hasil uji (bukan 'selesai').")
            return 4
        for t in d["tasks"]:
            if t["id"] == a[1]:
                t.update(status="done", done=now(), result=a[2])
        save(d)
        print("selesai", a[1])
    elif c == "add":
        if len(a) < 10:
            print("format: add ID fase kind priority size wajib(0|1) judul kriteria cara")
            return 4
        _, tid, fase, kind, pr, size, wajib, title, accept, how = a[:10]
        if kind not in KINDS:
            print("DITOLAK: kind harus salah satu dari " + ", ".join(KINDS))
            return 4
        if any(t["id"] == tid for t in d["tasks"]):
            print("DITOLAK: ID sudah ada")
            return 4
        if len(accept.strip()) < 15:
            print("DITOLAK: kriteria terima harus spesifik dan bisa diuji")
            return 4
        d["tasks"].append(dict(id=tid, fase=fase, kind=kind, priority=int(pr), size=size, wajib=wajib == "1", title=title, accept=accept, how=how, blocked_by="", status="ready", created=now()))
        save(d)
        print("ditambah", tid)
    elif c == "block":
        for t in d["tasks"]:
            if t["id"] == a[1]:
                t.update(blocked_by=a[2], status="blocked")
        save(d)
    elif c == "unblock":
        for t in d["tasks"]:
            if t["id"] == a[1]:
                t.update(blocked_by="", status="ready")
        save(d)
    elif c == "cancel":
        for t in d["tasks"]:
            if t["id"] == a[1]:
                t.update(status="cancelled", result="DIBATALKAN: " + (a[2] if len(a) > 2 else ""), done=now())
        save(d)
    elif c == "check":
        return check(d)
    elif c == "progress":
        n, w, pct = progress(d)
        print(f"WAJIB SELESAI {n}/{w} = {pct:.1f}%")
    return 0


def selftest():
    import tempfile
    tmp = tempfile.mkdtemp()
    cert = os.path.join(tmp, "cert")
    ok = tot = 0

    def case(n, got, want):
        nonlocal ok, tot
        tot += 1
        ok += got == want
        print(("ok  " if got == want else "BAD ") + n, got, "expected", want)

    def t(i, status="ready", kind="build", pr=5, size="m", by="", wajib=True):
        return dict(id=i, fase="F0", kind=kind, priority=pr, size=size, wajib=wajib, title="t", accept="kriteria yang bisa diuji", how="h", blocked_by=by, status=status)
    case("tiga siap: exit 0, tanpa sertifikat", (check({"tasks": [t("A"), t("B"), t("C")]}, cert), os.path.exists(cert)), (0, False))
    case("dua siap: REFILL exit 3", check({"tasks": [t("A"), t("B"), t("C", "done")]}, cert), 3)
    case("nol siap: sertifikat ditulis", (check({"tasks": [t("A", "done")]}, cert), os.path.exists(cert)), (0, True))
    case("fix didahulukan", [x["id"] for x in ready({"tasks": [t("A", pr=1), t("B", kind="fix", pr=9)]})], ["B", "A"])
    case("ketergantungan ID terbuka saat selesai", [x["id"] for x in ready({"tasks": [t("A", "done"), t("B", by="A")]})], ["B"])
    case("ketergantungan belum selesai memblokir", [x["id"] for x in ready({"tasks": [t("A"), t("B", by="A")]})], ["A"])
    case("blokir teks bebas tetap memblokir", [x["id"] for x in ready({"tasks": [t("B", by="butuh akun bank")]})], [])
    case("prioritas lalu ukuran", [x["id"] for x in ready({"tasks": [t("A", pr=2, size="s"), t("B", pr=1, size="l"), t("C", pr=1, size="s")]})], ["C", "B", "A"])
    case("bukti lemah ditolak", bool(WEAK_PROOF.match("selesai")), True)
    case("progres wajib", progress({"tasks": [t("A", "done"), t("B"), t("C", "done", wajib=False), t("D", "cancelled")]})[:2], (1, 2))
    print(f"SELFTEST next_task: {ok} dari {tot}", "LULUS" if ok == tot else "GAGAL")
    return 0 if ok == tot else 1


if __name__ == "__main__":
    sys.exit(selftest() if sys.argv[1:2] == ["selftest"] else main(sys.argv[1:]))
