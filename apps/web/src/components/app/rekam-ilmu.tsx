"use client";

import { useEffect, useRef, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { sha256Hex } from "@/lib/lempar";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BITRATE_SUARA, DURASI_ILMU_DETIK, formatDurasi, mimeDasar, pilihMime } from "@/lib/wawancara/rekam";

type Teks = Kamus["rekamIlmu"];
type Rekaman = { blob: Blob; url: string; mime: string; detik: number };
export type ButirIlmu = { id: string; judul: string; durasi_detik: number | null };

/** F3-07C: satu butir ilmu yang direkam orang yang berhenti di HP-nya. Daftar -> unggah ke jalur serah/<berhenti> -> selesai. */
export function RekamIlmu({ butir, teks: t, bahasa }: { butir: ButirIlmu; teks: Teks; bahasa: string }) {
  const [merekam, setMerekam] = useState(false);
  const [detik, setDetik] = useState(0);
  const [rekaman, setRekaman] = useState<Rekaman | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [terkirim, setTerkirim] = useState<number | null>(null);
  const perekam = useRef<MediaRecorder | null>(null);
  const aliran = useRef<MediaStream | null>(null);
  const jam = useRef<number | null>(null);
  const db = (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan }));

  function lepas() {
    if (jam.current !== null) window.clearInterval(jam.current);
    jam.current = null;
    aliran.current?.getTracks().forEach((x) => x.stop());
    aliran.current = null;
  }
  useEffect(() => () => {
    if (perekam.current?.state === "recording") perekam.current.stop();
    lepas();
  }, []);
  useEffect(() => () => { if (rekaman) URL.revokeObjectURL(rekaman.url); }, [rekaman]);

  async function mulai() {
    setGalat("");
    setTerkirim(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setGalat(t.belumBisa);
    const mime = pilihMime((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return setGalat(t.belumBisa);
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nama = e instanceof DOMException ? e.name : "";
      return setGalat(nama === "NotAllowedError" || nama === "SecurityError" ? t.micIzin : nama === "NotFoundError" ? t.micTidakAda : t.micGagal);
    }
    aliran.current = s;
    const r = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: BITRATE_SUARA });
    const potongan: Blob[] = [];
    const awal = performance.now();
    r.ondataavailable = (e) => { if (e.data.size > 0) potongan.push(e.data); };
    r.onstop = () => {
      const lama = Math.min((performance.now() - awal) / 1000, DURASI_ILMU_DETIK);
      lepas();
      setMerekam(false);
      const tipe = r.mimeType || mime;
      const blob = new Blob(potongan, { type: tipe });
      if (blob.size === 0 || lama < 1) return setGalat(t.pendek);
      setRekaman({ blob, url: URL.createObjectURL(blob), mime: tipe, detik: lama });
    };
    perekam.current = r;
    setRekaman(null);
    setDetik(0);
    r.start(1000);
    setMerekam(true);
    jam.current = window.setInterval(() => {
      const d = (performance.now() - awal) / 1000;
      setDetik(d);
      if (d >= DURASI_ILMU_DETIK && r.state === "recording") r.stop();
    }, 250);
  }

  async function kirim() {
    if (!rekaman) return;
    setGalat("");
    setSibuk(true);
    try {
      const sb = createBrowserSupabase();
      const mime = mimeDasar(rekaman.mime);
      const isi = await rekaman.blob.arrayBuffer();
      const { data, error } = await sb.rpc("rekam_ilmu_daftar", {
        p_butir: butir.id, p_sha256: await sha256Hex(isi), p_mime: mime, p_ukuran: rekaman.blob.size, p_durasi: Math.round(rekaman.detik * 10) / 10,
      });
      if (error) return setGalat(db(error.message));
      const slot = data as { jalur: string; perlu_unggah: boolean };
      if (slot.perlu_unggah) {
        const { error: eu } = await sb.storage.from("berkas").upload(slot.jalur, rekaman.blob, { contentType: mime });
        if (eu && !/exists|duplicate/i.test(eu.message)) return setGalat(t.unggahPutus);
      }
      const { error: es } = await sb.rpc("rekam_ilmu_selesai", { p_butir: butir.id });
      if (es) return setGalat(db(es.message));
      setTerkirim(rekaman.detik);
      setRekaman(null);
    } catch {
      setGalat(t.gagal);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <li className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="butir-ilmu">
      <p className="font-semibold" lang={bahasa === "id" ? undefined : "id"} data-pengguna>{butir.judul}</p>
      {terkirim !== null ? (
        <p role="status" className="mt-2 text-sm text-daun" data-testid="ilmu-terkirim">{isiTeks(t.terkirim, { durasi: formatDurasi(terkirim) })}</p>
      ) : butir.durasi_detik && !rekaman && !merekam ? (
        <p className="mt-2 text-sm text-tinta-2">{isiTeks(t.sudahDirekam, { durasi: formatDurasi(butir.durasi_detik) })}</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-3">
        {merekam ? (
          <div className="flex flex-wrap items-center gap-3">
            <Tombol ragam="kedua" onClick={() => perekam.current?.state === "recording" && perekam.current.stop()} data-testid="berhenti-ilmu">{t.berhenti}</Tombol>
            <p className="text-sm tabular-nums" role="timer" aria-label={isiTeks(t.merekamAria, { detik: formatDurasi(detik), maks: formatDurasi(DURASI_ILMU_DETIK) })}>
              <span className="font-semibold text-cap">{t.merekam}</span> {formatDurasi(detik)} / {formatDurasi(DURASI_ILMU_DETIK)}
            </p>
          </div>
        ) : rekaman ? (
          <>
            <audio controls src={rekaman.url} className="w-full" aria-label={isiTeks(t.klipAria, { judul: butir.judul })} />
            <div className="flex flex-wrap items-center gap-2">
              <Tombol onClick={kirim} disabled={sibuk} data-testid="kirim-ilmu">{sibuk ? t.mengirim : t.kirim}</Tombol>
              <Tombol ragam="teks" onClick={mulai} disabled={sibuk}>{t.rekamUlang}</Tombol>
              <span className="text-sm tabular-nums text-tinta-2">{formatDurasi(rekaman.detik)}</span>
            </div>
          </>
        ) : (
          <Tombol ragam="kedua" onClick={mulai} className="self-start" data-testid="rekam-ilmu">{butir.durasi_detik || terkirim !== null ? t.rekamUlang : t.rekam}</Tombol>
        )}
        {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
      </div>
    </li>
  );
}
