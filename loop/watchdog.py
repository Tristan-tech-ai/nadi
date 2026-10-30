"""watchdog: pengawas detak loop Nadi, proses terpisah yang tetap hidup walau sesi agen tertahan.
Setiap 60 detik: bila loop/LOOP_ON ada (tanpa LOOP_PAUSE/DONE_OK) dan detak terakhir (loop/.detak, ditulis hook macet_guard pada
setiap pemanggilan alat) lebih tua dari BATAS_MENIT, tulis loop/MACET.md dan munculkan notifikasi Windows untuk Tristan
(diulang tiap 30 menit selama masih macet). Saat detak kembali, MACET.md dihapus dan dicatat di loop/.watchdog.log.
Batas 25 menit: jeda antar tick 10 menit + pekerjaan terpanjang yang wajar (build, uji muat) sekitar 10 menit.
Uji: python -I loop/watchdog.py --uji-notifikasi"""
import json
import os
import subprocess
import sys
import time

L = os.path.dirname(os.path.abspath(__file__))
ON, PAUSE, DONE = (os.path.join(L, n) for n in ("LOOP_ON", "LOOP_PAUSE", "DONE_OK"))
DETAK, MACET, LOG = os.path.join(L, ".detak"), os.path.join(L, "MACET.md"), os.path.join(L, ".watchdog.log")
BATAS_MENIT, ULANG_MENIT = 25, 30


def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n")


def notifikasi(judul, isi):
    # Toast Windows lewat WinRT dari PowerShell bawaan; tanpa modul tambahan.
    ps = (
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
        "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
        f"$x = $t.GetElementsByTagName('text'); $x.Item(0).AppendChild($t.CreateTextNode('{judul}')) > $null; $x.Item(1).AppendChild($t.CreateTextNode('{isi}')) > $null;"
        "$n = [Windows.UI.Notifications.ToastNotification]::new($t);"
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($n)"
    )
    try:
        subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], timeout=30, capture_output=True,
                       creationflags=0x08000000)  # CREATE_NO_WINDOW
    except Exception as e:
        log(f"notifikasi gagal: {e!r}")


def baca_detak():
    try:
        d = json.load(open(DETAK, encoding="utf-8"))
        return float(d["t"]), d.get("alat", "?")
    except Exception:
        return None, None


def main():
    log(f"pengawas mulai pid {os.getpid()}")
    terakhir_lapor = 0.0
    while True:
        if os.path.exists(ON) and not os.path.exists(PAUSE) and not os.path.exists(DONE):
            t, alat = baca_detak()
            if t is not None:
                diam = (time.time() - t) / 60
                if diam > BATAS_MENIT:
                    if time.time() - terakhir_lapor > ULANG_MENIT * 60:
                        pesan = f"Loop Nadi diam {diam:.0f} menit. Alat terakhir: {alat}. Cek terminal agen (mungkin ada jendela persetujuan)."
                        with open(MACET, "w", encoding="utf-8") as f:
                            f.write(f"# Loop macet\n\n{time.strftime('%Y-%m-%d %H:%M:%S')}: {pesan}\n")
                        notifikasi("Loop Nadi macet", pesan)
                        log("MACET " + pesan)
                        terakhir_lapor = time.time()
                elif os.path.exists(MACET):
                    os.remove(MACET)
                    log("pulih: detak kembali")
                    terakhir_lapor = 0.0
        time.sleep(60)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--uji-notifikasi"]:
        notifikasi("Penjaga macet Nadi aktif", "Kalau loop diam lebih dari 25 menit, notifikasi seperti ini akan muncul.")
        print("notifikasi uji dikirim")
    else:
        main()
