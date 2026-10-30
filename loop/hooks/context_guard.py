"""context_guard (Nadi): diadaptasi dari loop riset Tristan (15 Okt 2026, perintah: "setiap setelah compact kamu WAJIB membaca semua
konteks penting kembali sebelum lanjut kerja"). Mengukur konteks terpakai, memberi peringatan sebelum kompaksi, dan setelah kompaksi
menolak semua alat selain Read/Grep/Glob/ToolSearch sampai setiap berkas di loop/MUST_READ.txt (yang ada) dibaca penuh.
Hanya aktif saat loop/LOOP_ON ada. Jalan keluar: loop/LOOP_PAUSE. Uji diri: python context_guard.py selftest"""

import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CL = os.path.join(ROOT, "loop")
FLAG = os.path.join(CL, ".compaction_flag.json")
GAUGE = os.path.join(CL, ".context_gauge.json")
LIST = os.path.join(CL, "MUST_READ.txt")
OFF = os.path.join(CL, "LOOP_PAUSE")
ON = os.path.join(CL, "LOOP_ON")
LOG = os.path.join(CL, ".context_guard.log")
WARN, CRIT, AUTO = 850_000, 920_000, 960_000
ALLOWED_WHILE_FLAGGED = {"Read", "Grep", "Glob", "ToolSearch"}


def log(msg):
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(time.strftime("%Y-%m-%d %H:%M:%S") + " " + msg + "\n")


def norm(p):
    return os.path.normcase(os.path.normpath(os.path.abspath(p))) if p else ""


def must_read():
    out = []
    for line in open(LIST, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            p = line if os.path.isabs(line) else os.path.join(ROOT, line)
            if os.path.exists(p):
                out.append(norm(p))
    return out


def last_usage(transcript):
    """Context in use = prompt size of the last assistant request in the transcript (JSONL)."""
    if not transcript or not os.path.exists(transcript):
        return None
    size = os.path.getsize(transcript)
    with open(transcript, "rb") as fh:
        fh.seek(max(0, size - 4_000_000))
        lines = fh.read().decode("utf-8", errors="replace").splitlines()
    for line in reversed(lines):
        if '"usage"' not in line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        msg = d.get("message") if isinstance(d, dict) else None
        u = msg.get("usage") if isinstance(msg, dict) else None
        if isinstance(u, dict) and "input_tokens" in u:
            return int(u.get("input_tokens", 0)) + int(u.get("cache_creation_input_tokens", 0) or 0) + int(u.get("cache_read_input_tokens", 0) or 0)
    return None


def read_flag():
    try:
        return json.load(open(FLAG, encoding="utf-8"))
    except Exception:
        return None


def write_flag(f):
    json.dump(f, open(FLAG, "w", encoding="utf-8"), indent=1)


def emit(event, text):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}))


def mode_gauge(inp):
    ctx = last_usage(inp.get("transcript_path"))
    flag = read_flag()
    if flag and inp.get("tool_name") == "Read":
        fp = norm((inp.get("tool_input") or {}).get("file_path", ""))
        if fp in flag.get("required", []) and fp not in flag.get("done", []):
            flag.setdefault("done", []).append(fp)
            write_flag(flag)
            log("read after compaction: " + fp)
    if ctx is None:
        return 0
    prev = {}
    try:
        prev = json.load(open(GAUGE, encoding="utf-8"))
    except Exception:
        pass
    level = "CRITICAL" if ctx >= CRIT else "WARN" if ctx >= WARN else "OK"
    json.dump({"time": time.strftime("%Y-%m-%d %H:%M:%S"), "context_tokens": ctx, "level": level, "auto_compact_near": AUTO,
               "warned": prev.get("warned", []) if prev.get("context_tokens", 0) <= ctx else []}, open(GAUGE, "w", encoding="utf-8"))
    g = json.load(open(GAUGE, encoding="utf-8"))
    if level != "OK" and level not in g["warned"]:
        g["warned"].append(level)
        json.dump(g, open(GAUGE, "w", encoding="utf-8"))
        log("gauge %s %d" % (level, ctx))
        if level == "WARN":
            emit("PostToolUse", "CONTEXT GUARD: context in use %d tokens (warning at %d, auto-compaction near %d). Write the checkpoint NOW: "
                 "rewrite the state block of the handoff files named in loop/MUST_READ.txt (loop/STATE.md terutama) so that work can continue "
                 "after a compaction without this conversation." % (ctx, WARN, AUTO))
        else:
            emit("PostToolUse", "CONTEXT GUARD CRITICAL: context in use %d tokens; auto-compaction near %d. Do not start long work; finish "
                 "the checkpoint (handoff and state files) in the next step." % (ctx, AUTO))
    return 0


def mode_precompact(inp):
    if not os.path.exists(ON):
        return 0
    write_flag({"time": time.strftime("%Y-%m-%d %H:%M:%S"), "trigger": inp.get("trigger", "?"),
                "context_tokens": last_usage(inp.get("transcript_path")), "required": must_read(), "done": []})
    log("precompact flag set (trigger %s)" % inp.get("trigger", "?"))
    return 0


def mode_start(inp):
    flag = read_flag()
    if not flag:
        return 0
    todo = [p for p in flag["required"] if p not in flag.get("done", [])]
    print("CONTEXT GUARD (after compaction at %s): before ANY other work, read each of these files IN FULL with the Read tool "
          "(the summary is not enough; every other tool is refused until all are read):\n" % flag["time"]
          + "\n".join("  - " + p for p in todo))
    log("start: %d files to read" % len(todo))
    return 0


def mode_pretool(inp):
    if os.path.exists(OFF):
        return 0
    flag = read_flag()
    if not flag:
        return 0
    todo = [p for p in flag["required"] if p not in flag.get("done", [])]
    if not todo:
        os.remove(FLAG)
        log("flag cleared: all must-read files were read")
        return 0
    tool = inp.get("tool_name", "")
    if tool in ALLOWED_WHILE_FLAGGED:
        return 0
    reason = ("CONTEXT GUARD: a compaction happened at %s. Read these files in full with the Read tool before using %s:\n%s"
              % (flag["time"], tool, "\n".join("  - " + p for p in todo)))
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": reason}}))
    log("refused %s (%d unread)" % (tool, len(todo)))
    return 0


def selftest():
    import tempfile
    global FLAG, GAUGE, LIST, LOG, OFF, ON
    d = tempfile.mkdtemp()
    FLAG, GAUGE, LIST, LOG, OFF, ON = (os.path.join(d, n) for n in ("flag.json", "gauge.json", "list.txt", "log.txt", "off", "on"))
    open(ON, "w").write("x")
    a, b = os.path.join(d, "a.md"), os.path.join(d, "b.md")
    for p in (a, b):
        open(p, "w").write("x")
    open(LIST, "w").write("# test\n%s\n%s\n" % (a, b))
    tr = os.path.join(d, "t.jsonl")
    open(tr, "w").write(json.dumps({"type": "assistant", "message": {"usage": {"input_tokens": 10, "cache_creation_input_tokens": 1000,
                                                                               "cache_read_input_tokens": 870000}}}) + "\n")
    ok = last_usage(tr) == 871010
    mode_precompact({"transcript_path": tr, "trigger": "auto"})
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    with redirect_stdout(buf):
        mode_pretool({"tool_name": "Bash"})
    ok &= '"deny"' in buf.getvalue()
    buf = io.StringIO()
    with redirect_stdout(buf):
        mode_pretool({"tool_name": "Read"})
    ok &= buf.getvalue() == ""
    mode_gauge({"transcript_path": tr, "tool_name": "Read", "tool_input": {"file_path": a}})
    mode_gauge({"transcript_path": tr, "tool_name": "Read", "tool_input": {"file_path": b}})
    buf = io.StringIO()
    with redirect_stdout(buf):
        mode_pretool({"tool_name": "Bash"})
    ok &= '"deny"' not in buf.getvalue() and not os.path.exists(FLAG)
    g = json.load(open(GAUGE))
    ok &= g["level"] == "WARN"
    print("selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "selftest":
        return selftest()
    try:
        inp = json.load(sys.stdin)
    except Exception:
        inp = {}
    try:
        return {"gauge": mode_gauge, "precompact": mode_precompact, "start": mode_start, "pretool": mode_pretool}[mode](inp)
    except Exception as e:
        log("error in %s: %r" % (mode, e))
        return 0


if __name__ == "__main__":
    sys.exit(main())
