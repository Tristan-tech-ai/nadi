"""TANPA JEJAK: repo dan riwayat git tidak boleh berisi jejak asisten pengembang.

Aturan Tristan 30 Okt 2026, diperjelas 6 Nov 2026: Nadi memang akan sering menyebut bahwa ia bisa disambungkan ke aplikasi AI
umum (asisten Anthropic, ChatGPT, Gemini, dan lainnya) lewat MCP. Penyebutan produk seperti itu boleh. Yang tetap ditolak:
- jejak pengembangan: trailer co-author, alamat noreply penyedia, tautan sesi, "generated with", nama alat ngoding asisten,
  berkas konfigurasi agen yang ikut di-commit, dan nama asisten sebagai penulis/pengirim commit;
- nama asisten yang berdiri sendiri. Nama itu hanya boleh muncul di baris yang juga menyebut aplikasi AI lain atau MCP
  (konteks produk: "sambungkan ..., ChatGPT, atau Gemini lewat MCP").

Pakai:
  python -I loop/hooks/jejak.py repo          # isi berkas, penulis, pesan, dan diff seluruh riwayat (dipakai gate.sh)
  python -I loop/hooks/jejak.py pesan BERKAS  # satu pesan commit (dipakai hook commit-msg)
  python -I loop/hooks/jejak.py selftest
Pola ditulis terpecah (c[l]aude) supaya berkas ini tidak menandai dirinya sendiri.
"""
import re
import subprocess
import sys

NAMA = re.compile(r"c[l]aude", re.I)
# Jejak pengembangan: selalu ditolak, apa pun konteksnya.
JEJAK = re.compile(
    r"co-a[u]thored-by|noreply@a[n]thropic|c[l]aude\.ai/code|c[l]aude[ -]code|generated with \S*c[l]aude|c[l]aude-session|🤖",
    re.I,
)
# Konteks produk: baris yang sama menyebut aplikasi AI lain atau MCP.
PRODUK = re.compile(r"\b(chat ?gpt|gpt-?\d|gemini|copilot|perplexity|grok|deepseek|mistral|llama|mcp)\b", re.I)
BERKAS_AGEN = re.compile(r"(^|/)(c[l]aude\.md|\.c[l]aude/|agents\.md)", re.I)


def baris_salah(baris: str) -> str | None:
    """Alasan baris ditolak, atau None bila boleh."""
    if JEJAK.search(baris):
        return "jejak pengembangan"
    if NAMA.search(baris) and not PRODUK.search(baris):
        return "nama asisten tanpa konteks produk (sebut bersama aplikasi AI lain atau MCP)"
    return None


def periksa_teks(teks: str, sumber: str) -> list[str]:
    hasil = []
    for i, b in enumerate(teks.splitlines(), 1):
        alasan = baris_salah(b)
        if alasan:
            hasil.append(f"{sumber}:{i}: {alasan}: {b.strip()[:120]}")
    return hasil


def git(*a: str) -> str:
    return subprocess.run(["git", *a], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout


def periksa_repo() -> list[str]:
    salah = []
    for f in git("ls-files").splitlines():
        if BERKAS_AGEN.search(f):
            salah.append(f"{f}: berkas konfigurasi agen tidak boleh di repo")
    # Isi berkas yang dilacak (teks saja: git grep -I melewati biner).
    keluar = subprocess.run(["git", "grep", "-niI", "-E", "c[l]aude|co-a[u]thored-by|noreply@a[n]thropic", "--", "."],
                            capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    for b in keluar.splitlines():
        jalur, _, sisa = b.partition(":")
        nomor, _, isi = sisa.partition(":")
        if jalur == "loop/hooks/jejak.py":
            continue
        alasan = baris_salah(isi)
        if alasan:
            salah.append(f"{jalur}:{nomor}: {alasan}: {isi.strip()[:120]}")
    # Penulis dan pengirim commit tidak boleh nama asisten sama sekali.
    for b in git("log", "--format=%h %an <%ae> %cn <%ce>").splitlines():
        if NAMA.search(b) or JEJAK.search(b):
            salah.append(f"commit {b[:9]}: penulis/pengirim berjejak")
    # Pesan commit dan baris diff seluruh riwayat.
    for b in git("log", "--format=%h%x00%B%x01").split("\x01"):
        if "\x00" in b:
            h, _, pesan = b.strip().partition("\x00")
            salah += periksa_teks(pesan, f"pesan {h}")
    for b in git("log", "-p", "--no-color", "--format=commit %h").splitlines():
        # Baris diff: hanya nama asisten dan alamat noreply (trailer co-author di pesan diperiksa di atas; riwayat lama gate.sh
        # memuat pola co-author tanpa dipecah dan riwayat tidak ditulis ulang karena dilarang force push).
        if b.startswith(("+", "-")) and not b.startswith(("+++", "---")) and (NAMA.search(b) or re.search(r"noreply@a[n]thropic", b, re.I)):
            alasan = baris_salah(b)
            if alasan:
                salah.append(f"diff: {alasan}: {b.strip()[:120]}")
    return salah


def selftest() -> int:
    n = "C" + "laude"
    tolak = [
        f"Co-{'Authored'}-By: {n} <noreply@{'anthropic'}.com>",
        f"Generated with {n} Code",
        f"https://{n.lower()}.ai/code/session_x",
        f"Dibuat dengan bantuan {n}.",
        f"{n} menulis fungsi ini",
        f"{n} Code dipakai lewat MCP",
    ]
    boleh = [
        f"Sambungkan {n}, ChatGPT, atau Gemini lewat MCP",
        f"Pakai dari {n} atau Gemini: lempar berkas, mengobrol, lalu setujui di Nadi",
        f"Server MCP Nadi bisa dipakai {n}",
        "aplikasi asisten Anthropic",
        "ANTHROPIC_API_KEY",
    ]
    gagal = [t for t in tolak if baris_salah(t) is None] + [t for t in boleh if baris_salah(t) is not None]
    agen = [f for f in [f"{n.upper()}.md", f".{n.lower()}/settings.json", "docs/AGENTS.md"] if not BERKAS_AGEN.search(f)]
    if gagal or agen:
        print("SELFTEST GAGAL", gagal, agen)
        return 1
    print(f"SELFTEST LULUS {len(tolak)} tolak, {len(boleh)} boleh, 3 berkas agen")
    return 0


def main(a: list[str]) -> int:
    if a[:1] == ["selftest"]:
        return selftest()
    if a[:1] == ["pesan"] and len(a) == 2:
        salah = periksa_teks(open(a[1], encoding="utf-8", errors="replace").read(), "pesan")
    elif a[:1] == ["repo"]:
        salah = periksa_repo()
    else:
        print(__doc__)
        return 2
    for s in salah[:30]:
        print(s, file=sys.stderr)
    if salah:
        print(f"TANPA JEJAK: {len(salah)} temuan", file=sys.stderr)
    return 1 if salah else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
