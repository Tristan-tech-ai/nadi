"""macet_guard (Nadi, 30 Okt 2026): mencegah loop tertahan menunggu manusia.
Insiden 30 Okt 2026 20:34-23:26: migrasi berisi `drop policy` dianggap destruktif oleh MCP Supabase, yang lalu menunggu konfirmasi
manusia. Tidak ada yang menyetujui, loop diam sekitar 3 jam. Tristan: "buatkan gate agar loop ga macet saat ada yang macet gini".
Tristan (30 Okt, setelah melihat dialog "MCP server requests your input"): boleh memodifikasi diri agar dialog itu tidak menahan loop.
Hanya aktif saat loop/LOOP_ON ada (tanpa loop, dialog tampil seperti biasa). Mode (argv[1]), membaca JSON hook di stdin:
  pre   PreToolUse semua alat: (a) catat detak; (b) TOLAK sebelum dipanggil: SQL yang bisa menghapus DATA (drop table/schema/column,
        truncate, delete, cascade, update tanpa where), AskUserQuestion, alat berbayar, perintah shell interaktif (login).
        DROP objek tanpa data (policy, function, trigger, index, view) lolos dan konfirmasinya dijawab oleh mode elisitasi.
  elisitasi  hook Elicitation: konfirmasi MCP Supabase disetujui otomatis (SQL-nya sudah lolos penyaring pre), server lain ditolak,
        semua dicatat di loop/.elisitasi.log.
  post  PostToolUse: catat detak.
  start SessionStart: pastikan pengawas (loop/watchdog.py) berjalan.
Uji diri: python macet_guard.py selftest"""
import json
import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
L = os.path.join(REPO, "loop")
ON, PAUSE = os.path.join(L, "LOOP_ON"), os.path.join(L, "LOOP_PAUSE")
DETAK = os.path.join(L, ".detak")
WATCH_PID = os.path.join(L, ".watchdog.pid")

# Menghapus DATA: ditolak di depan. DROP objek tanpa data (policy, function, trigger, index, view, constraint) diizinkan.
HAPUS_DATA = re.compile(r"\bdrop\s+(table|schema|database|extension|materialized\s+view|owned)\b|\bdrop\s+column\b|\btruncate\b"
                        r"|\bdelete\s+from\b|\bdrop\b[^;]*\bcascade\b|\bupdate\s+\S+\s+set\b(?![^;]*\bwhere\b)", re.I)
ELISITASI_LOG = os.path.join(L, ".elisitasi.log")
SQL_TOOLS = re.compile(r"(apply_migration|execute_sql)$")
TANYA = {"AskUserQuestion"}
BERBAYAR = re.compile(r"(Supabase__create_project|Supabase__create_branch|Vercel__buy_domain|Vercel__create_or_transfer_domain|Vercel__get_purchase_quote)$")
SHELL_INTERAKTIF = re.compile(r"\b(vercel\s+login|gh\s+auth\s+login|supabase\s+login|npm\s+login|git\s+rebase\s+-i|git\s+add\s+-i)\b")


def aktif():
    return os.path.exists(ON) and not os.path.exists(PAUSE)


def tulis_detak(tool):
    try:
        with open(DETAK, "w", encoding="utf-8") as f:
            f.write(json.dumps({"t": time.time(), "alat": tool}))
    except Exception:
        pass


def tanpa_komentar(sql):
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"'(?:[^']|'')*'", "''", sql)  # isi string literal (mis. pesan galat) bukan perintah


def masalah(tool, inp):
    """None bila boleh; teks alasan bila harus ditolak agar loop tidak menunggu manusia."""
    if SQL_TOOLS.search(tool):
        q = tanpa_komentar(str(inp.get("query", "")))
        m = HAPUS_DATA.search(q)
        if m:
            return (f"PENJAGA MACET: SQL memuat '{m.group(0)}', yang bisa menghapus data (penjaga: tidak ada SQL yang menghapus data tanpa cadangan). "
                    "Pakai jalan lain: kolom status/arsip (bukan delete), ALTER TABLE ... ADD (bukan drop column), retensi lewat pg_partman/pg_cron "
                    "di dalam fungsi. DROP objek tanpa data (policy, function, trigger, index, view) boleh. Bila benar-benar harus menghapus data, "
                    "ekspor cadangan dulu, tulis ke loop/UNTUK-TRISTAN.md, lalu kerjakan tugas lain.")
    if tool in TANYA:
        return "PENJAGA MACET: loop tidak bertanya kepada Tristan (perintah tetap 2). Putuskan sendiri, catat di loop/DECISIONS.md; hal yang butuh Tristan ke loop/UNTUK-TRISTAN.md."
    if BERBAYAR.search(tool):
        return "PENJAGA MACET: alat ini bisa meminta konfirmasi biaya atau membuat tagihan. Dilarang di loop (penjaga: tidak menaikkan paket berbayar)."
    if tool in ("Bash", "PowerShell"):
        cmd = str(inp.get("command", ""))
        m = SHELL_INTERAKTIF.search(cmd)
        if m:
            return f"PENJAGA MACET: perintah interaktif '{m.group(0)}' akan menunggu masukan manusia. Autentikasi adalah tugas Tristan: tulis ke loop/UNTUK-TRISTAN.md."
    return None


def elisitasi(data):
    """Jawaban hook Elicitation saat loop aktif: setujui konfirmasi Supabase (SQL-nya sudah lolos penyaring pre), tolak yang lain."""
    server = str(data.get("mcp_server_name", ""))
    mode = data.get("mode") or "form"
    props = (data.get("requested_schema") or {}).get("properties") or {}
    if "supabase" in server.lower() and mode == "form":
        isi = {}
        for k, v in props.items():
            v = v or {}
            if v.get("type") == "boolean":
                isi[k] = True
            elif v.get("enum"):
                pil = [str(x) for x in v["enum"]]
                isi[k] = next((x for x in pil if x.lower() in ("accept", "yes", "ya", "apply", "confirm")), pil[0])
            elif v.get("const") is not None:
                isi[k] = v["const"]
        keputusan = {"hookEventName": "Elicitation", "action": "accept", "content": isi}
    else:
        keputusan = {"hookEventName": "Elicitation", "action": "decline"}
    try:
        with open(ELISITASI_LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + json.dumps({"server": server, "mode": mode, "pesan": str(data.get("message", ""))[:200],
                                                                     "keputusan": keputusan["action"], "isi": keputusan.get("content")}, ensure_ascii=False) + "\n")
    except Exception:
        pass
    return keputusan


def pastikan_pengawas():
    try:
        pid = int(open(WATCH_PID).read().strip())
        cek = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True, timeout=10).stdout
        if str(pid) in cek:
            return "berjalan"
    except Exception:
        pass
    py = sys.executable.replace("python.exe", "pythonw.exe")
    if not os.path.exists(py):
        py = sys.executable
    flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP: tetap hidup walau sesi tertahan
    p = subprocess.Popen([py, "-I", os.path.join(L, "watchdog.py")], creationflags=flags, close_fds=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
    with open(WATCH_PID, "w") as f:
        f.write(str(p.pid))
    return f"dinyalakan pid {p.pid}"


def selftest():
    ok = tot = 0

    def case(n, got, want):
        nonlocal ok, tot
        tot += 1
        ok += got == want
        print(("ok  " if got == want else "BAD ") + n, got, "expected", want)
    A = "mcp__x_Supabase__apply_migration"
    case("drop policy boleh (tanpa data)", masalah(A, {"query": "drop policy x on t;"}), None)
    case("drop table ditolak", masalah(A, {"query": "drop table t;"}) is not None, True)
    case("drop column ditolak", masalah(A, {"query": "alter table t drop column a;"}) is not None, True)
    case("cascade ditolak", masalah(A, {"query": "drop function f() cascade;"}) is not None, True)
    case("on delete cascade di FK boleh", masalah(A, {"query": "create table t (a uuid references p(id) on delete cascade);"}), None)
    case("update tanpa where ditolak", masalah(A, {"query": "update t set a = 1;"}) is not None, True)
    case("update dengan where boleh", masalah(A, {"query": "update t set a = 1 where id = 2;"}), None)
    global ELISITASI_LOG
    import tempfile
    ELISITASI_LOG = os.path.join(tempfile.mkdtemp(), "e.log")
    case("elisitasi Supabase disetujui", elisitasi({"mcp_server_name": "remote Supabase", "mode": "form", "requested_schema": {"properties": {}}})["action"], "accept")
    case("elisitasi boolean diisi true", elisitasi({"mcp_server_name": "x Supabase", "requested_schema": {"properties": {"ok": {"type": "boolean"}}}})["content"], {"ok": True})
    case("elisitasi server lain ditolak", elisitasi({"mcp_server_name": "github", "mode": "form"})["action"], "decline")
    case("elisitasi url ditolak", elisitasi({"mcp_server_name": "remote Supabase", "mode": "url"})["action"], "decline")
    case("delete from ditolak", masalah("mcp__x_Supabase__execute_sql", {"query": "delete from t where a=1"}) is not None, True)
    case("truncate ditolak", masalah(A, {"query": "truncate t"}) is not None, True)
    case("create biasa boleh", masalah(A, {"query": "create table t (id int); alter policy p on t using (true);"}), None)
    case("kata drop di komentar boleh", masalah(A, {"query": "-- jangan drop apa pun\ncreate table t (id int);"}), None)
    case("kata drop di string boleh", masalah(A, {"query": "raise exception 'tidak boleh drop';"}), None)
    case("kolom bernama dropship boleh", masalah(A, {"query": "alter table t add column dropship boolean;"}), None)
    case("AskUserQuestion ditolak", masalah("AskUserQuestion", {}) is not None, True)
    case("create_project berbayar ditolak", masalah("mcp__x_Supabase__create_project", {}) is not None, True)
    case("vercel login ditolak", masalah("Bash", {"command": "vercel login"}) is not None, True)
    case("git commit boleh", masalah("Bash", {"command": "git commit -m x"}), None)
    print(f"SELFTEST macet_guard: {ok} dari {tot}", "LULUS" if ok == tot else "GAGAL")
    return 0 if ok == tot else 1


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "selftest":
        sys.exit(selftest())
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    if not aktif():
        sys.exit(0)
    tool = data.get("tool_name", "")
    try:
        if mode in ("pre", "post"):
            tulis_detak(tool)
        if mode == "pre":
            why = masalah(tool, data.get("tool_input") or {})
            if why:
                print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": why}}))
        elif mode == "elisitasi":
            print(json.dumps({"hookSpecificOutput": elisitasi(data)}))
        elif mode == "start":
            print("Pengawas macet: " + pastikan_pengawas())
    except Exception:
        pass
    sys.exit(0)
