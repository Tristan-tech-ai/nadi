"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatTanggal } from "@/lib/format";
import { buatIcs } from "@/lib/rekrut/ics";
import { LABEL_PELAMAR, tahapSah, tokenStatusSah } from "@/lib/rekrut/keputusan";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Wawancara = { id: string; mulai: string; selesai: string; lokasi: string; catatan: string | null; urutan: number };
type Status = { usaha: string; lowongan: string; nama: string; tahap: string; pesan: string | null; tahap_at: string | null; dibuat_at: string; zona?: string; wawancara?: Wawancara[] };

const ZONA: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

/** Unduh .ics buatan peramban (tanpa server): kalender HP membuka berkas ini dan menambahkan acaranya. */
function simpanKalender(w: Wawancara, s: Status) {
  const teks = buatIcs({ uid: `${w.id}@nadi`, mulai: new Date(w.mulai), selesai: new Date(w.selesai), urutan: w.urutan,
    judul: `Wawancara ${s.lowongan}, ${s.usaha}`, lokasi: w.lokasi, keterangan: w.catatan });
  const url = URL.createObjectURL(new Blob([teks], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "wawancara.ics" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Tautan baru yang ditempel di tab yang sama hanya mengubah fragmen (tanpa muat ulang), jadi ikuti hashchange.
const langganan = (ubah: () => void) => {
  window.addEventListener("hashchange", ubah);
  return () => window.removeEventListener("hashchange", ubah);
};
const bacaToken = () => {
  const t = decodeURIComponent(window.location.hash.slice(1));
  return tokenStatusSah(t) ? t : "";
};

/** Halaman status lamaran tanpa akun: token dari fragmen URL, data lewat RPC anon status_lamaran. */
export function StatusLamaran() {
  // undefined saat prerender, "" bila fragmen tidak berisi token yang sah.
  const token = useSyncExternalStore<string | undefined>(langganan, bacaToken, () => undefined);
  // Hasil disimpan bersama tokennya; hasil token lama tidak pernah tampil untuk token baru.
  const [hasil, setHasil] = useState<{ token: string; status?: Status; galat?: string } | null>(null);
  const kini = hasil && hasil.token === token ? hasil : null;
  const status = kini?.status ?? null;
  const galat = token === "" ? "Tautan status tidak lengkap. Buka lagi tautan yang kamu simpan setelah melamar, salin seluruhnya sampai akhir." : (kini?.galat ?? "");

  useEffect(() => {
    if (!token) return;
    let batal = false;
    createBrowserSupabase()
      .rpc("status_lamaran", { p_token: token })
      .then(({ data, error }) => {
        if (batal) return;
        if (error) setHasil({ token, galat: error.code === "28000" ? error.message : "Status gagal dimuat. Periksa internetmu lalu muat ulang halaman ini." });
        else setHasil({ token, status: data as Status });
      });
    return () => { batal = true; };
  }, [token]);

  if (galat) {
    return (
      <div role="alert" className="mt-8 rounded-[var(--radius-kartu)] border border-garis p-5" data-testid="status-galat">
        <h1 className="font-semibold">Status lamaran tidak bisa dibuka</h1>
        <p className="mt-1 text-tinta-2">{galat}</p>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="mt-8" aria-busy="true" aria-label="Memuat status lamaran">
        <div className="h-4 w-32 animate-pulse rounded bg-kertas-2" />
        <div className="mt-2 h-8 w-56 animate-pulse rounded bg-kertas-2" />
        <div className="mt-6 h-28 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
      </div>
    );
  }
  const tahap = tahapSah(status.tahap) ? status.tahap : "masuk";
  // Pelamar bukan anggota usaha (perusahaan tertutup untuk anon): tanggal kiriman ditampilkan di zona perangkat pelamar sendiri.
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const diperbarui = status.tahap_at ?? status.dibuat_at;
  return (
    <article className="mt-8" data-testid="status-lamaran">
      <p className="text-sm text-tinta-2">{status.usaha}</p>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{status.lowongan}</h1>
      <p className="mt-1 text-sm text-tinta-2">Lamaran {status.nama}, dikirim {formatTanggal(new Date(status.dibuat_at), zona)}</p>

      <section className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-5" aria-labelledby="judul-tahap">
        <h2 id="judul-tahap" className="text-sm text-tinta-2">Kabar terakhir</h2>
        <p className="mt-1 text-xl font-semibold" data-testid="status-tahap" data-tahap={tahap}>{LABEL_PELAMAR[tahap]}</p>
        <p className="mt-1 text-sm text-tinta-2">Diperbarui {formatTanggal(new Date(diperbarui), zona)}</p>
        {status.pesan && (
          <figure className="mt-4 border-l-2 border-kunyit pl-3" data-testid="status-pesan">
            <figcaption className="text-sm text-tinta-2">Pesan dari {status.usaha}</figcaption>
            <blockquote className="mt-1 whitespace-pre-line">{status.pesan}</blockquote>
          </figure>
        )}
      </section>

      {(status.wawancara ?? []).length > 0 && (
        <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-5" aria-labelledby="judul-wawancara" data-testid="status-wawancara">
          <h2 id="judul-wawancara" className="font-semibold">Jadwal wawancara</h2>
          <ul className="mt-2 grid gap-3">
            {status.wawancara!.map((w) => (
              <li key={w.id}>
                <p>{new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: status.zona || zona }).format(new Date(w.mulai)).replace(/(\d{2}):(\d{2})/, "$1.$2")} {ZONA[status.zona || zona] ?? ""}</p>
                <p className="text-tinta-2">{w.lokasi}</p>
                {w.catatan && <p className="text-tinta-2">{w.catatan}</p>}
                <button type="button" onClick={() => simpanKalender(w, status)} className="mt-2 inline-flex h-11 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold">
                  Simpan ke kalender
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-sm text-tinta-2">
        Nadi hanya menyampaikan kabar dari {status.usaha}. Untuk pertanyaan soal lowongan ini, hubungi mereka langsung. Tautan ini berlaku 180 hari sejak kamu melamar.
      </p>
    </article>
  );
}
