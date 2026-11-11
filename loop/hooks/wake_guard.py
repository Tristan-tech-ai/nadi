"""wake_guard (Nadi, 30 Okt 2026): penjaga mekanis loop pengembangan otonom.
Diadaptasi dari loop riset Tristan (research startup), yang ditulis setelah forensik 60 kompaksi:
 - prompt wakeup terkikis sedikit demi sedikit karena ditulis ulang dari ringkasan; tidak ada yang membandingkan dengan header kanonik;
 - tick "hanya pemantauan" terjadi karena menulis satu baris log sudah dihitung sebagai kerja.
Aturan di sini (hanya aktif selama loop/LOOP_ON ada):
  pre   (PreToolUse ScheduleWakeup) menolak (exit 2) bila:
        a) loop/DONE_OK ada (aplikasi 100%: loop berhenti, jangan jadwalkan lagi);
        b) ada kalimat loop/wake_header.txt yang hilang dari prompt, atau header itu sendiri kehilangan frasa jangkar;
        c) delaySeconds di luar 600..900 (perintah Tristan 3 Nov 2026: iterasi tiap 10 menit);
        d) tick ini tidak menjalankan loop/next_task.py;
        e) tick ini dan tick sebelumnya tidak menghasilkan artefak substantif (kode/migrasi/desain/riset/korpus, git commit,
           next_task.py done/add). Menulis STATE.md atau LOG.md saja tidak dihitung. Kecuali sertifikat antrean kosong segar;
        f) HEAD repo belum lulus loop/gate.sh, atau ada kode belum di-commit, kecuali loop/.gate_merah berisi alasan (< 60 menit);
        g) ada commit yang belum di-push;
        h) loop/STATE.md tidak diperbarui dalam 30 menit terakhir;
        i) BOBOT ITERASI (Tristan 4 Nov 2026, keras): sejak ScheduleWakeup sebelumnya kurang dari 5 tugas WAJIB
           berstatus done di loop/WORK_QUEUE.json, padahal masih ada tugas wajib READY yang tidak terblokir.
  stop  (Stop) menolak sekali bila giliran berakhir tanpa ScheduleWakeup, atau teks akhir mengaku "hanya pemantauan" tanpa sertifikat.
  start (SessionStart) mencetak header kanonik dan daftar wajib baca ke konteks.
Jalan keluar: buat loop/LOOP_PAUSE (hanya Tristan) untuk mematikan semua aturan. Uji diri: python wake_guard.py selftest"""
import datetime
import json
import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
L = os.path.join(REPO, "loop")
HDR = os.path.join(L, "wake_header.txt")
ON = os.path.join(L, "LOOP_ON")
PAUSE = os.path.join(L, "LOOP_PAUSE")
DONE = os.path.join(L, "DONE_OK")
CERT = os.path.join(L, ".queue_empty")
GATE = os.path.join(L, "gate_last.json")
GATE_RED = os.path.join(L, ".gate_merah")
STATE = os.path.join(L, "STATE.md")
MUSTREAD = os.path.join(L, "MUST_READ.txt")
LOG = os.path.join(L, ".wake_guard.log")
TAIL_BYTES = 12_000_000
CERT_MIN, GATE_RED_MIN, STATE_MIN = 20, 60, 30
DELAY_MIN, DELAY_MAX = 600, 900
QUEUE = os.path.join(L, "WORK_QUEUE.json")
MIN_WAJIB = 5

SUB_PATH = re.compile(r"nadi[\\/]+(apps|packages|supabase|fixtures|scripts|docs[\\/]+(design|research|quality)|loop[\\/]+LEARN\.md|\.github)[\\/]?", re.I)
SUB_CMD = re.compile(r"(\bgit\b[^\n|;&]*\bcommit\b|next_task\.py\s+(done|add)|apply_migration)")
NEXT_CMD = re.compile(r"next_task\.py")
WRITE_BASH = re.compile(r"(>>|\bcat\s*>|\bsed\s+-i|\bcp\s|\bmv\s|\btee\s|Out-File|Set-Content|Add-Content|\.write\(|json\.dump)")
SUB_MCP = re.compile(r"(apply_migration|deploy_edge_function|create_project_env|create_project)$")
MONITOR = ("hanya pemantauan", "tick tenang", "putaran tenang", "monitoring only", "quiet tick", "tidak ada yang dikerjakan")
ANCHORS = ("KONTRAK TICK", "next_task.py", "PERINTAH TETAP", "HANYA AUTENTIKASI", "Ide adalah kerja", "GROUND TRUTH",
           "GERBANG", "PENJAGA", "TANPA JEJAK", "ANTI-MACET", "ANTI-SLOP", "SETIAP GILIRAN BERAKHIR DENGAN ScheduleWakeup", "delaySeconds 600", "LAPORAN", "BOBOT ITERASI")


def log(msg):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n")
    except Exception:
        pass


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def header_text():
    with open(HDR, encoding="utf-8") as f:
        return f.read()


def header_sentences(h=None):
    h = header_text() if h is None else h
    return [s for s in re.split(r"(?<=[\.;:\?!])\s+", norm(h)) if len(s) >= 25]


def fresh(path, minutes):
    try:
        return (time.time() - os.path.getmtime(path)) < minutes * 60
    except Exception:
        return False


def events(path):
    """('WAKE'|'WAKE_REFUSED'|'WRITE'|'SUB'|'NEXT'|'USER') dalam urutan transkrip (ekor TAIL_BYTES)"""
    ev, pending = [], {}
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        if size > TAIL_BYTES:
            f.seek(size - TAIL_BYTES)
            f.readline()
        for raw in f:
            if b"tool_use" not in raw and b"tool_result" not in raw and b'"type":"user"' not in raw:
                continue
            try:
                d = json.loads(raw)
            except Exception:
                continue
            c = d.get("message", {}).get("content")
            if d.get("type") == "user":
                if isinstance(c, str) or (isinstance(c, list) and any(isinstance(b, dict) and b.get("type") == "text" for b in c)
                                          and not any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c)):
                    ev.append(("USER",))
                if isinstance(c, list):
                    for b in c:
                        if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("tool_use_id") in pending and b.get("is_error"):
                            ev[pending.pop(b["tool_use_id"])] = ("WAKE_REFUSED",)  # wakeup yang ditolak hook bukan batas tick
                continue
            if not isinstance(c, list):
                continue
            for b in c:
                if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                    continue
                n, inp = b.get("name", ""), b.get("input") or {}
                if n == "ScheduleWakeup":
                    pending[b.get("id")] = len(ev)
                    ev.append(("WAKE", d.get("timestamp")))
                elif n in ("Write", "Edit", "NotebookEdit"):
                    ev.append(("WRITE",))
                    if SUB_PATH.search(str(inp.get("file_path", ""))):
                        ev.append(("SUB",))
                elif n in ("Bash", "PowerShell"):
                    cmd = str(inp.get("command", ""))
                    if WRITE_BASH.search(cmd):
                        ev.append(("WRITE",))
                    if SUB_CMD.search(cmd):
                        ev.append(("SUB",))
                    if NEXT_CMD.search(cmd):
                        ev.append(("NEXT",))
                elif SUB_MCP.search(n):
                    ev.append(("SUB",))
    return ev


def ticks(ev):
    ev = list(ev)
    if ev and ev[-1][0] == "WAKE":
        ev = ev[:-1]
    spans = [[]]
    for e in ev:
        if e[0] == "WAKE":
            spans.append([])
        elif e[0] != "USER":
            spans[-1].append(e[0])
    return spans


def tick_problems(ev, cert_ok):
    sp = ticks(ev)
    msgs = []
    if "NEXT" not in sp[-1]:
        msgs.append("PENJAGA: tick ini belum menjalankan python loop/next_task.py. Jalankan, kerjakan tugas yang dicetak sampai kriteria terimanya terbukti, lalu `next_task.py done ID BUKTI`.")
    recent = sp[-1] + (sp[-2] if len(sp) >= 2 else [])
    if len(sp) >= 2 and "SUB" not in recent and not cert_ok:
        msgs.append("PENJAGA: tick ini dan tick sebelumnya tidak menghasilkan artefak substantif (kode di apps/packages/supabase, migrasi, docs/design|research|quality, korpus, git commit, next_task.py done/add). Memperbarui STATE.md atau LOG.md tidak dihitung. Ambil tugas READY teratas dan selesaikan.")
    return msgs


def lokal(ts):
    """stempel waktu transkrip (UTC, ...Z) -> ISO waktu lokal tanpa zona, sebanding dengan next_task.now()"""
    try:
        return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().replace(tzinfo=None).isoformat(timespec="seconds")
    except Exception:
        return None


def mulai_tick(ev):
    """waktu lokal ScheduleWakeup terakhir yang diterima (batas awal tick ini), None bila tidak ada"""
    ev = list(ev)
    if ev and ev[-1][0] == "WAKE":
        ev = ev[:-1]
    for e in reversed(ev):
        if e[0] == "WAKE" and len(e) > 1 and e[1]:
            return lokal(e[1])
    return None


def siap_wajib(d, hari=None):
    hari = hari or datetime.date.today().isoformat()
    ids = {u["id"]: u for u in d["tasks"]}
    hasil = []
    for t in d["tasks"]:
        if t.get("status") != "ready" or not t.get("wajib"):
            continue
        if t.get("tidak_sebelum") and t["tidak_sebelum"] > hari:
            continue
        if t.get("blocked_by"):
            deps = [x.strip() for x in str(t["blocked_by"]).split(",") if x.strip()]
            if not (deps and all(x in ids for x in deps) and all(ids[x]["status"] == "done" for x in deps)):
                continue
        hasil.append(t["id"])
    return hasil


def bobot_problems(mulai, d, hari=None):
    """BOBOT ITERASI: minimal MIN_WAJIB tugas wajib done sejak mulai, kecuali tidak ada lagi tugas wajib siap"""
    if not mulai:
        return []
    selesai = [t["id"] for t in d["tasks"] if t.get("wajib") and t.get("status") == "done" and str(t.get("done", "")) >= mulai]
    siap = siap_wajib(d, hari)
    if len(selesai) >= MIN_WAJIB or not siap:
        return []
    return [f"BOBOT ITERASI (perintah keras Tristan 4 Nov 2026): tick ini baru menyelesaikan {len(selesai)} tugas WAJIB "
            f"({', '.join(selesai) or 'belum ada'}) sejak {mulai}; minimal {MIN_WAJIB}. Masih ada {len(siap)} tugas wajib siap "
            f"({', '.join(siap[:6])}). Jangan berhenti setengah: lanjutkan dalam giliran yang sama (boleh 30-60 menit atau lebih, "
            "kompaksi tidak apa), selesaikan tugas berikutnya sampai `next_task.py done`. Bila tugas benar-benar terblokir, "
            "catat dengan `next_task.py block ID alasan` dan kerjakan yang lain."]


def git(*args):
    try:
        return subprocess.run(["git", "-C", REPO] + list(args), capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return ""


TANPA_COMMIT = os.path.join(L, "TANPA_COMMIT")


def repo_problems():
    msgs = []
    head = git("rev-parse", "HEAD")
    try:
        g = json.load(open(GATE, encoding="utf-8"))
    except Exception:
        g = {}
    # Mode TANPA_COMMIT (Tristan 11 Nov 2026, juri sedang menilai repo dan produksi): tidak ada commit dan push.
    # Gerbang tetap wajib: gate.sh lulus pada working tree dalam 60 menit terakhir.
    if os.path.exists(TANPA_COMMIT):
        if not (g.get("ok") and fresh(GATE, GATE_RED_MIN)) and not fresh(GATE_RED, GATE_RED_MIN):
            msgs.append("GERBANG (tanpa commit): `bash loop/gate.sh` belum lulus pada working tree dalam 60 menit terakhir. Jalankan dan perbaiki sampai LULUS.")
        if not fresh(STATE, STATE_MIN):
            msgs.append("PENJAGA: loop/STATE.md tidak diperbarui dalam 30 menit. Tulis keadaan sekarang, tugas berikutnya, dan pemblokir sebelum menjadwalkan.")
        return msgs
    dirty = [l for l in git("status", "--porcelain", "--", "apps", "packages", "supabase", "scripts").splitlines() if l.strip()]
    gate_bad = (not g.get("ok")) or g.get("head") != head or g.get("kode_belum_commit", 1) != 0 or dirty
    if gate_bad and not fresh(GATE_RED, GATE_RED_MIN):
        msgs.append(f"GERBANG: HEAD {head[:8]} belum lulus `bash loop/gate.sh` (gate_last: head {str(g.get('head'))[:8]}, ok {g.get('ok')}, kode belum commit {len(dirty)}). Commit, jalankan gerbang, perbaiki sampai LULUS. Bila tidak bisa dalam tick ini: tulis alasannya ke loop/.gate_merah dan tambah tugas kind=fix prioritas 0.")
    ahead = git("rev-list", "--count", "@{u}..HEAD")
    if ahead and ahead.isdigit() and int(ahead) > 0:
        msgs.append(f"PENJAGA: {ahead} commit belum di-push. git push dulu (commit yang tertinggal pernah membuat HEAD tidak bisa dijalankan).")
    if not fresh(STATE, STATE_MIN):
        msgs.append("PENJAGA: loop/STATE.md tidak diperbarui dalam 30 menit. Tulis keadaan sekarang, tugas berikutnya, dan pemblokir sebelum menjadwalkan.")
    return msgs


def check_prompt(prompt, h=None):
    p = norm(prompt)
    return [s for s in header_sentences(h) if s not in p]


def active():
    return os.path.exists(ON) and not os.path.exists(PAUSE)


def pre(inp):
    if inp.get("tool_name") != "ScheduleWakeup" or not active():
        return 0, ""
    ti = inp.get("tool_input", {}) or {}
    if ti.get("stop"):
        return 0, ""
    if os.path.exists(DONE):
        return 2, "PENJAGA: loop/DONE_OK ada, aplikasi dinyatakan 100%. Jangan jadwalkan lagi; kirim laporan akhir ke Tristan dan akhiri loop (ScheduleWakeup stop=true)."
    msgs = []
    h = header_text()
    miss_anchor = [a for a in ANCHORS if a not in h]
    if miss_anchor:
        msgs.append("PENJAGA: loop/wake_header.txt kehilangan frasa jangkar " + ", ".join(miss_anchor) + ". Pulihkan dari git (git checkout -- loop/wake_header.txt).")
    miss = check_prompt(ti.get("prompt", ""), h)
    if miss:
        msgs.append(f"PENJAGA: prompt ScheduleWakeup kehilangan {len(miss)} dari {len(header_sentences(h))} kalimat header kanonik. Prompt pendek atau sekadar penunjuk dilarang. Tempel header ini KATA PER KATA di awal prompt, lalu tambahkan keadaan dan SATU aksi berikutnya:\n" + h)
    d = ti.get("delaySeconds")
    if not isinstance(d, (int, float)) or not (DELAY_MIN <= d <= DELAY_MAX):
        msgs.append(f"PENJAGA: delaySeconds harus 600..900 (perintah Tristan 3 Nov 2026: iterasi tiap 10 menit), bukan {d}.")
    tp = inp.get("transcript_path")
    if tp and os.path.exists(tp):
        msgs += tick_problems(events(tp), fresh(CERT, CERT_MIN))
    try:
        if tp and os.path.exists(tp):
            msgs += bobot_problems(mulai_tick(events(tp)), json.load(open(QUEUE, encoding="utf-8")))
    except Exception as e:
        log(f"bobot galat: {e!r}")
    msgs += repo_problems()
    if msgs:
        log("pre DITOLAK: " + " | ".join(m[:80] for m in msgs))
        return 2, "\n\n".join(msgs)
    log("pre ok")
    return 0, ""


def last_text(path):
    txt = ""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        if size > TAIL_BYTES:
            f.seek(size - TAIL_BYTES)
            f.readline()
        for raw in f:
            if b'"type":"assistant"' not in raw:
                continue
            try:
                d = json.loads(raw)
            except Exception:
                continue
            c = d.get("message", {}).get("content")
            if isinstance(c, list):
                t = " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
                if t.strip():
                    txt = t
    return txt


def stop(inp):
    if not active() or os.path.exists(DONE) or inp.get("stop_hook_active"):
        return 0, ""
    tp = inp.get("transcript_path")
    if not tp or not os.path.exists(tp):
        return 0, ""
    ev = events(tp)
    last_user = max([i for i, e in enumerate(ev) if e[0] == "USER"], default=-1)
    turn = [e[0] for e in ev[last_user + 1:]]
    msgs = []
    if "WAKE" not in turn:
        msgs.append("PENJAGA: SETIAP GILIRAN BERAKHIR DENGAN ScheduleWakeup (delaySeconds 600, prompt = header kanonik + keadaan + satu aksi berikutnya). Panggil sekarang sebelum teks akhir. Bila Tristan meminta berhenti, ia membuat loop/LOOP_PAUSE.")
    t = last_text(tp).lower()
    if any(p in t for p in MONITOR) and not fresh(CERT, CERT_MIN):
        msgs.append("PENJAGA: teks akhir mengaku tidak ada kerja, padahal tidak ada sertifikat antrean kosong (python loop/next_task.py check). Kerjakan tugas READY teratas.")
    if msgs:
        log("stop DITOLAK")
        return 2, "\n\n".join(msgs)
    return 0, ""


def start(inp):
    if not active():
        return 0, ""
    out = ["LOOP NADI AKTIF. Header kanonik (tempel kata per kata di setiap ScheduleWakeup):", header_text()]
    try:
        files = [l.strip() for l in open(MUSTREAD, encoding="utf-8") if l.strip() and not l.startswith("#")]
        out.append("WAJIB BACA PENUH dengan Read sebelum bekerja (setelah mulai/kompaksi): " + ", ".join(files))
    except Exception:
        pass
    print("\n".join(out))
    return 0, ""


def selftest():
    ok = tot = 0

    def case(n, got, want):
        nonlocal ok, tot
        tot += 1
        ok += got == want
        print(("ok  " if got == want else "BAD ") + n, got, "expected", want)
    h = "KONTRAK TICK: jalankan python loop/next_task.py setiap tick tanpa kecuali. PERINTAH TETAP: hanya autentikasi oleh Tristan sampai selesai."
    case("prompt lengkap lolos", check_prompt(h + " keadaan: F0-01 berikutnya.", h), [])
    case("prompt dipendekkan ditolak", len(check_prompt("lanjutkan loop sesuai loop/wake_header.txt", h)), 2)
    W, N, S, U = ("WAKE",), ("NEXT",), ("SUB",), ("USER",)
    case("tick tanpa next_task ditolak", any("next_task" in m for m in tick_problems([W, S], False)), True)
    case("tick dengan next_task dan commit lolos", tick_problems([W, N, S], False), [])
    case("dua tick tanpa artefak ditolak", any("artefak" in m for m in tick_problems([N, W, N, W], False)), True)
    case("artefak di tick sebelumnya cukup", tick_problems([N, S, W, N, W], False), [])
    case("sertifikat antrean kosong membebaskan aturan artefak", tick_problems([N, W, N, W], True), [])
    case("pola jalur substantif: kode", bool(SUB_PATH.search(r"C:\Users\Tristan\Downloads\project-pkl\nadi\apps\web\src\app\page.tsx")), True)
    case("pola jalur substantif: STATE bukan", bool(SUB_PATH.search(r"C:\Users\Tristan\Downloads\project-pkl\nadi\loop\STATE.md")), False)
    case("pola jalur substantif: LEARN ya", bool(SUB_PATH.search(r"C:/Users/Tristan/Downloads/project-pkl/nadi/loop/LEARN.md")), True)
    case("git commit dihitung", bool(SUB_CMD.search('cd nadi && git commit -m "x"')), True)
    case("git status tidak dihitung", bool(SUB_CMD.search("git status")), False)
    case("migrasi MCP dihitung", bool(SUB_MCP.search("mcp__x_Supabase__apply_migration")), True)
    Q = {"tasks": [dict(id=f"A{i}", wajib=True, status="done", done="2026-11-04T21:0%d:00" % i) for i in range(3)]
         + [dict(id="B", wajib=True, status="ready"), dict(id="C", wajib=False, status="done", done="2026-11-04T21:30:00"),
            dict(id="D", wajib=True, status="done", done="2026-11-04T19:00:00")]}
    case("bobot: 3 wajib done + ada siap ditolak", len(bobot_problems("2026-11-04T20:30:00", Q, "2026-11-04")), 1)
    Q5 = {"tasks": Q["tasks"] + [dict(id=f"E{i}", wajib=True, status="done", done="2026-11-04T22:00:00") for i in range(2)]}
    case("bobot: 5 wajib done lolos", bobot_problems("2026-11-04T20:30:00", Q5, "2026-11-04"), [])
    case("bobot: tugas tidak wajib dan done sebelum tick tidak dihitung", len(bobot_problems("2026-11-04T20:30:00", {"tasks": Q["tasks"][3:]}, "2026-11-04")), 1)
    Qb = {"tasks": Q["tasks"][:3] + [dict(id="B", wajib=True, status="ready", blocked_by="kartu belum ada")]}
    case("bobot: semua sisa terblokir lolos", bobot_problems("2026-11-04T20:30:00", Qb, "2026-11-04"), [])
    case("bobot: batas tick dari wakeup sebelumnya", mulai_tick([("WAKE", "2026-11-04T13:00:00Z"), ("NEXT",), ("WAKE", "2026-11-04T14:00:00Z")]) == lokal("2026-11-04T13:00:00Z"), True)
    print(f"SELFTEST wake_guard: {ok} dari {tot}", "LULUS" if ok == tot else "GAGAL")
    return 0 if ok == tot else 1


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "selftest":
        sys.exit(selftest())
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    try:
        code, msg = {"pre": pre, "stop": stop, "start": start}.get(mode, lambda i: (0, ""))(data)
    except Exception as e:  # penjaga yang rusak tidak boleh menghentikan kerja; dicatat untuk diperbaiki
        log(f"GALAT {mode}: {e!r}")
        code, msg = 0, ""
    if msg:
        sys.stderr.write(msg + "\n")
    sys.exit(code)
