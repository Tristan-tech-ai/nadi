"use client";

import { useEffect, useRef, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { sha256Hex } from "@/lib/lempar";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BITRATE_SUARA, DURASI_MAKS_DETIK, formatDurasi, mimeDasar, pilihMime } from "@/lib/wawancara/rekam";

type Rekaman = { blob: Blob; url: string; mime: string; detik: number };
type Slot = { jawaban: string; jalur: string; perlu_unggah: boolean };

/** Wawancara suara opsional setelah CV terkirim (F2-03): satu rekaman per pertanyaan, dikirim lewat slot anon seperti CV. */
export function RekamWawancara({ lamaran, pertanyaan, usaha }: { lamaran: string; pertanyaan: string[]; usaha: string }) {
  const [aktif, setAktif] = useState<number | null>(null);
  const [selesai, setSelesai] = useState<Set<number>>(new Set());
  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-5" aria-labelledby="judul-wawancara" data-testid="wawancara">
      <h2 id="judul-wawancara" className="text-lg font-semibold">Wawancara suara</h2>
      <p className="mt-1 text-tinta-2">
        Tidak wajib. Jawab dengan suaramu, paling lama {formatDurasi(DURASI_MAKS_DETIK)} per pertanyaan. {usaha} akan mendengarkannya bersama CV-mu.
        Bisa dijawab sampai 2 jam setelah melamar.
      </p>
      <p className="mt-2 text-sm text-tinta-2">{selesai.size} dari {pertanyaan.length} pertanyaan terjawab</p>
      <ol className="mt-4 flex flex-col gap-4">
        {pertanyaan.map((p, i) => (
          <Pertanyaan
            key={i}
            urutan={i}
            teks={p}
            lamaran={lamaran}
            terkunci={aktif !== null && aktif !== i}
            onMerekam={(ya) => setAktif(ya ? i : null)}
            onTerkirim={() => setSelesai((s) => new Set(s).add(i))}
          />
        ))}
      </ol>
    </section>
  );
}

function pesanMikrofon(e: unknown): string {
  const nama = e instanceof DOMException ? e.name : "";
  if (nama === "NotAllowedError" || nama === "SecurityError") return "Mikrofon belum diizinkan. Izinkan mikrofon untuk halaman ini di pengaturan peramban, lalu tekan Rekam lagi.";
  if (nama === "NotFoundError") return "Mikrofon tidak ditemukan. Pakai HP atau pasang mikrofon, lalu tekan Rekam lagi.";
  return "Mikrofon tidak bisa dibuka. Tutup aplikasi lain yang memakai mikrofon, lalu coba lagi.";
}

function Pertanyaan(p: { urutan: number; teks: string; lamaran: string; terkunci: boolean; onMerekam: (ya: boolean) => void; onTerkirim: () => void }) {
  const { urutan: i } = p;
  const [merekam, setMerekam] = useState(false);
  const [detik, setDetik] = useState(0);
  const [rekaman, setRekaman] = useState<Rekaman | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [terdaftar, setTerdaftar] = useState(false);
  const perekam = useRef<MediaRecorder | null>(null);
  const aliran = useRef<MediaStream | null>(null);
  const jam = useRef<number | null>(null);
  // Slot dari wawancara_daftar disimpan: bila unggah putus, kirim ulang memakai slot yang sama (daftar hanya sekali per pertanyaan).
  const slot = useRef<Slot | null>(null);

  function lepas() {
    if (jam.current !== null) window.clearInterval(jam.current);
    jam.current = null;
    aliran.current?.getTracks().forEach((t) => t.stop());
    aliran.current = null;
  }
  useEffect(() => () => {
    if (perekam.current?.state === "recording") perekam.current.stop();
    lepas();
  }, []);
  useEffect(() => () => { if (rekaman) URL.revokeObjectURL(rekaman.url); }, [rekaman]);

  async function mulai() {
    setGalat("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return setGalat("Peramban ini belum bisa merekam suara. Buka tautan lamaran di Chrome atau Safari terbaru.");
    }
    const mime = pilihMime((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return setGalat("Peramban ini belum bisa merekam suara. Buka tautan lamaran di Chrome atau Safari terbaru.");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return setGalat(pesanMikrofon(e));
    }
    aliran.current = s;
    // Bawaan Chromium ±112 kbps (1,3 MB per 90 detik); BITRATE_SUARA memangkasnya tanpa menurunkan WER korpus.
    const r = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: BITRATE_SUARA });
    const potongan: Blob[] = [];
    const awal = performance.now();
    r.ondataavailable = (e) => { if (e.data.size > 0) potongan.push(e.data); };
    r.onstop = () => {
      const lama = Math.min((performance.now() - awal) / 1000, DURASI_MAKS_DETIK);
      lepas();
      setMerekam(false);
      p.onMerekam(false);
      const tipe = r.mimeType || mime;
      const blob = new Blob(potongan, { type: tipe });
      if (blob.size === 0 || lama < 1) return setGalat("Rekaman terlalu pendek. Tekan Rekam dan jawab beberapa kalimat.");
      setRekaman({ blob, url: URL.createObjectURL(blob), mime: tipe, detik: lama });
    };
    perekam.current = r;
    setRekaman(null);
    setDetik(0);
    r.start(1000);
    setMerekam(true);
    p.onMerekam(true);
    jam.current = window.setInterval(() => {
      const d = (performance.now() - awal) / 1000;
      setDetik(d);
      if (d >= DURASI_MAKS_DETIK && r.state === "recording") r.stop();
    }, 250);
  }

  function berhenti() {
    if (perekam.current?.state === "recording") perekam.current.stop();
  }

  async function kirim() {
    if (!rekaman) return;
    setGalat("");
    setSibuk(true);
    try {
      const sb = createBrowserSupabase();
      const mime = mimeDasar(rekaman.mime);
      if (!slot.current) {
        const isi = await rekaman.blob.arrayBuffer();
        const { data, error } = await sb.rpc("wawancara_daftar", {
          p_lamaran: p.lamaran, p_urutan: i, p_sha256: await sha256Hex(isi), p_mime: mime, p_ukuran: rekaman.blob.size, p_durasi: Math.round(rekaman.detik * 10) / 10,
        });
        if (error) return setGalat(error.message);
        slot.current = data as Slot;
        setTerdaftar(true);
      }
      if (slot.current.perlu_unggah) {
        const { error: eUnggah } = await sb.storage.from("berkas").upload(slot.current.jalur, rekaman.blob, { contentType: mime });
        if (eUnggah && !/exists|duplicate/i.test(eUnggah.message)) return setGalat("Unggah rekaman terputus. Periksa sinyal, lalu tekan Kirim jawaban lagi.");
      }
      const { error: eSelesai } = await sb.rpc("wawancara_selesai", { p_jawaban: slot.current.jawaban });
      if (eSelesai) return setGalat(eSelesai.message);
      setTerkirim(true);
      p.onTerkirim();
    } catch {
      setGalat("Jawaban gagal terkirim. Periksa sinyal, lalu tekan Kirim jawaban lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <li className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
      <p className="text-sm text-tinta-2">Pertanyaan {i + 1}</p>
      <p className="mt-1 font-semibold">{p.teks}</p>
      {terkirim ? (
        <p role="status" className="mt-3 text-sm" data-testid={`jawaban-terkirim-${i}`}>Jawaban terkirim ({formatDurasi(rekaman?.detik ?? 0)}).</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {merekam ? (
            <div className="flex flex-wrap items-center gap-3">
              <Tombol ragam="kedua" onClick={berhenti} data-testid={`berhenti-${i}`}>Berhenti</Tombol>
              <p className="text-sm tabular-nums" role="timer" aria-label={`Merekam, ${formatDurasi(detik)} dari ${formatDurasi(DURASI_MAKS_DETIK)}`}>
                <span className="font-semibold text-cap">Merekam</span> {formatDurasi(detik)} / {formatDurasi(DURASI_MAKS_DETIK)}
              </p>
            </div>
          ) : rekaman ? (
            <>
              <audio controls src={rekaman.url} className="w-full" aria-label={`Rekaman jawaban pertanyaan ${i + 1}`} />
              <div className="flex flex-wrap items-center gap-2">
                <Tombol onClick={kirim} disabled={sibuk} data-testid={`kirim-jawaban-${i}`}>{sibuk ? "Mengirim..." : "Kirim jawaban"}</Tombol>
                {!terdaftar && <Tombol ragam="teks" onClick={mulai} disabled={sibuk || p.terkunci}>Rekam ulang</Tombol>}
                <span className="text-sm tabular-nums text-tinta-2">{formatDurasi(rekaman.detik)}</span>
              </div>
            </>
          ) : (
            <Tombol ragam="kedua" onClick={mulai} disabled={p.terkunci} className="self-start" data-testid={`rekam-${i}`}>Rekam jawaban</Tombol>
          )}
          {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
        </div>
      )}
    </li>
  );
}
