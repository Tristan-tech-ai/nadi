"use client";

import { useState } from "react";
import { KenaliDiri } from "@/components/lamar/kenali-diri";
import { RekamWawancara } from "@/components/lamar/rekam-wawancara";
import { UjiKerja } from "@/components/lamar/uji-kerja";
import { Tombol } from "@/components/ui/tombol";
import { periksaLamaran } from "@/lib/lamar";
import { mimeBerkas, sha256Hex } from "@/lib/lempar";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const isian = "h-12 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

/** Formulir lamaran tanpa akun: daftar slot lewat RPC, unggah CV ke jalur slot, lalu minta Nadi membacanya. */
export function FormLamar({ kode, usaha, pertanyaan = [] }: { kode: string; usaha: string; pertanyaan?: string[] }) {
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [lamaran, setLamaran] = useState<string | null>(null);
  const [tautan, setTautan] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  async function kirim(form: FormData) {
    setGalat("");
    const nama = String(form.get("nama") ?? "");
    const telepon = String(form.get("telepon") ?? "");
    const cv = form.get("cv");
    const berkas = cv instanceof File ? cv : null;
    const mime = berkas ? mimeBerkas(berkas.name, berkas.type) : null;
    const salah = periksaLamaran({ nama, telepon, mime, ukuran: berkas?.size ?? 0 });
    if (salah || !berkas || !mime) return setGalat(salah ?? "Pilih berkas CV dulu.");
    setSibuk(true);
    try {
      const sb = createBrowserSupabase();
      const isi = await berkas.arrayBuffer();
      const { data, error } = await sb.rpc("lamar_daftar", { p_kode: kode, p_nama: nama, p_telepon: telepon, p_sha256: await sha256Hex(isi), p_mime: mime, p_ukuran: isi.byteLength });
      if (error) return setGalat(error.message);
      const d = data as { lamaran: string; jalur: string; perlu_unggah: boolean };
      if (d.perlu_unggah) {
        const { error: eUnggah } = await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: mime });
        if (eUnggah && !/exists|duplicate/i.test(eUnggah.message)) return setGalat("Unggah CV terputus. Periksa sinyal, lalu kirim lagi.");
      }
      const { error: eSelesai } = await sb.rpc("lamar_selesai", { p_lamaran: d.lamaran });
      if (eSelesai) return setGalat(eSelesai.message);
      // F2-05: izin dihubungi lagi + tautan status tanpa akun. Gagal di sini tidak membatalkan lamaran.
      const { data: token } = await sb.rpc("lamar_lanjut", { p_lamaran: d.lamaran, p_boleh_dihubungi: form.get("boleh_dihubungi") === "ya" });
      if (typeof token === "string") setTautan(`${window.location.origin}/lamar/status#${token}`);
      setLamaran(d.lamaran);
    } catch {
      setGalat("Lamaran gagal terkirim. Periksa sinyal, lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  if (lamaran) {
    return (
      <>
        <div role="status" className="mt-8 rounded-[var(--radius-kartu)] bg-kertas-2 p-5" data-testid="lamaran-terkirim">
          <p className="text-lg font-semibold">Lamaran terkirim</p>
          <p className="mt-1 text-tinta-2">{usaha} akan membaca CV-mu dan menghubungi lewat nomor HP yang kamu tulis.</p>
          {tautan && (
            <div className="mt-4 border-t border-garis pt-3" data-testid="tautan-status">
              <p className="text-sm font-semibold">Simpan tautan ini untuk melihat kabar lamaranmu.</p>
              <p className="mt-1 break-all font-mono text-sm" data-testid="tautan-status-isi">{tautan}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Tombol ragam="kedua" onClick={async () => { try { await navigator.clipboard.writeText(tautan); setTersalin(true); } catch {} }}>
                  {tersalin ? "Tersalin" : "Salin tautan"}
                </Tombol>
                <a href={tautan} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center px-2 text-sm font-semibold underline underline-offset-4">Buka halaman status</a>
              </div>
            </div>
          )}
        </div>
        <UjiKerja lamaran={lamaran} />
        {pertanyaan.length > 0 && <RekamWawancara lamaran={lamaran} pertanyaan={pertanyaan} usaha={usaha} />}
        <KenaliDiri lamaran={lamaran} usaha={usaha} />
      </>
    );
  }
  return (
    <form action={kirim} className="mt-8 flex flex-col gap-4" data-testid="form-lamar">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Nama lengkap</span>
        <input name="nama" required autoComplete="name" className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Nomor HP (WhatsApp)</span>
        <input name="telepon" required inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">CV: foto atau PDF, paling besar 10 MB</span>
        <input name="cv" type="file" required accept="image/*,application/pdf" className="text-base file:mr-3 file:h-10 file:rounded-[var(--radius-isian)] file:border file:border-garis-kuat file:bg-kertas-2 file:px-3 file:font-semibold file:text-tinta" />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input name="boleh_dihubungi" type="checkbox" value="ya" className="mt-0.5 size-5 shrink-0 accent-tinta" />
        <span>Boleh dihubungi lagi untuk lowongan lain di {usaha}</span>
      </label>
      <Tombol type="submit" ukuran="besar" disabled={sibuk}>{sibuk ? "Mengirim..." : "Kirim lamaran"}</Tombol>
      {galat && <p role="alert" className="text-sm text-cap">{galat}</p>}
    </form>
  );
}
