"use client";

import { useEffect, useState, useTransition } from "react";
import { BellIcon, BellSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { hapusLangganan, kirimPushUji, simpanLangganan } from "@/app/app/push-actions";
import { Tombol } from "@/components/ui/tombol";
import { bytesDariBase64Url } from "@/lib/push";

type Keadaan = "memeriksa" | "tak-didukung" | "ditolak" | "mati" | "menyala";

/** Nyalakan atau matikan Web Push untuk perangkat ini (pengganti notifikasi WhatsApp). */
export function Pemberitahuan({ kunciPublik }: { kunciPublik: string | null }) {
  const [keadaan, setKeadaan] = useState<Keadaan>("memeriksa");
  const [pesan, setPesan] = useState<{ jenis: "galat" | "info"; teks: string } | null>(null);
  const [sibuk, mulai] = useTransition();

  useEffect(() => {
    let batal = false;
    (async () => {
      if (!kunciPublik || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!batal) setKeadaan("tak-didukung");
        return;
      }
      if (Notification.permission === "denied") {
        if (!batal) setKeadaan("ditolak");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      // Langganan yang sudah ada disegarkan untuk usaha yang sedang dibuka.
      if (sub) await simpanLangganan(sub.toJSON());
      if (!batal) setKeadaan(sub ? "menyala" : "mati");
    })().catch(() => !batal && setKeadaan("tak-didukung"));
    return () => {
      batal = true;
    };
  }, [kunciPublik]);

  function nyalakan() {
    setPesan(null);
    mulai(async () => {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setKeadaan(izin === "denied" ? "ditolak" : "mati");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDariBase64Url(kunciPublik!) });
        const simpan = await simpanLangganan(sub.toJSON());
        if (simpan.galat) {
          await sub.unsubscribe();
          setPesan({ jenis: "galat", teks: simpan.galat });
          return;
        }
        setKeadaan("menyala");
        const uji = await kirimPushUji();
        setPesan(uji.galat ? { jenis: "galat", teks: uji.galat } : { jenis: "info", teks: uji.pesan ?? "" });
      } catch {
        setPesan({ jenis: "galat", teks: "Browser menolak berlangganan. Coba lagi, atau pakai Chrome terbaru." });
      }
    });
  }

  function matikan() {
    setPesan(null);
    mulai(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await hapusLangganan(sub.endpoint);
        await sub.unsubscribe();
      }
      setKeadaan("mati");
      setPesan({ jenis: "info", teks: "Pemberitahuan dimatikan untuk perangkat ini." });
    });
  }

  function uji() {
    setPesan(null);
    mulai(async () => {
      const hasil = await kirimPushUji();
      setPesan(hasil.galat ? { jenis: "galat", teks: hasil.galat } : { jenis: "info", teks: hasil.pesan ?? "" });
    });
  }

  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-pemberitahuan" data-testid="pemberitahuan" data-keadaan={keadaan}>
      <h2 id="judul-pemberitahuan" className="text-lg font-semibold">Pemberitahuan di perangkat ini</h2>
      <p className="mt-1 text-sm text-tinta-2">
        Nadi mengabari kamu saat ada usulan yang perlu diputuskan, tanpa lewat WhatsApp.
      </p>

      {keadaan === "memeriksa" && <div className="mt-4 h-10 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" aria-hidden />}

      {keadaan === "tak-didukung" && (
        <p className="mt-4 text-sm text-tinta-2">
          Browser ini belum bisa menerima pemberitahuan. Di iPhone, pasang Nadi ke Layar Utama dulu (Bagikan, lalu Tambah ke Layar Utama), lalu buka dari sana.
        </p>
      )}

      {keadaan === "ditolak" && (
        <p className="mt-4 text-sm text-tinta-2">
          Izin pemberitahuan sedang diblokir. Buka pengaturan situs di browser (ikon gembok di samping alamat), izinkan Pemberitahuan, lalu muat ulang halaman ini.
        </p>
      )}

      {keadaan === "mati" && (
        <Tombol className="mt-4" onClick={nyalakan} disabled={sibuk} data-testid="nyalakan-pemberitahuan">
          <BellIcon size={20} aria-hidden />
          {sibuk ? "Menyalakan..." : "Nyalakan pemberitahuan"}
        </Tombol>
      )}

      {keadaan === "menyala" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-daun" data-testid="pemberitahuan-menyala">
            <BellIcon size={20} weight="fill" aria-hidden />
            Menyala
          </span>
          <Tombol ragam="kedua" onClick={uji} disabled={sibuk}>Kirim pemberitahuan uji</Tombol>
          <Tombol ragam="teks" onClick={matikan} disabled={sibuk}>
            <BellSlashIcon size={20} aria-hidden />
            Matikan
          </Tombol>
        </div>
      )}

      <p role="status" className={`mt-3 min-h-5 text-sm ${pesan?.jenis === "galat" ? "text-cap" : "text-tinta-2"}`} data-testid="pesan-pemberitahuan">
        {pesan?.teks}
      </p>
    </section>
  );
}
