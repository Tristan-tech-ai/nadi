"use client";

import { useActionState, useState } from "react";
import { bagikanSlip, lepasTahan, setujuiGaji, siapkanGaji, type HasilGaji, type HasilTautanSlip } from "@/app/app/gaji/actions";
import { Tombol } from "@/components/ui/tombol";

function Hasil({ h }: { h: HasilGaji }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

export function FormSiapkan({ bulan, ada }: { bulan: string; ada: boolean }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(siapkanGaji, null);
  return (
    <form action={aksi} className="flex flex-col gap-2" data-testid="form-siapkan">
      <input type="hidden" name="bulan" value={bulan} />
      <Tombol type="submit" ragam={ada ? "kedua" : "utama"} ukuran="besar" disabled={sibuk}>
        {sibuk ? "Menghitung..." : ada ? "Hitung ulang draf" : "Siapkan gaji bulan ini"}
      </Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormSetujui({ periode, jumlah }: { periode: string; jumlah: number }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(setujuiGaji, null);
  return (
    <form action={aksi} className="flex flex-col gap-2">
      <input type="hidden" name="periode" value={periode} />
      <Tombol type="submit" ukuran="besar" disabled={sibuk || jumlah === 0}>{sibuk ? "Menyimpan..." : "Setujui gaji bulan ini"}</Tombol>
      <p className="text-xs text-tinta-2">Setelah disetujui, slip terkunci. Perubahan berikutnya lewat koreksi di bulan depan.</p>
      <Hasil h={h} />
    </form>
  );
}

export function FormLepas({ slip, nama }: { slip: string; nama: string }) {
  const [h, aksi, sibuk] = useActionState<HasilGaji, FormData>(lepasTahan, null);
  return (
    <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="slip" value={slip} />
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-tinta-2">Alasan melepas</span>
        <input name="alasan" required maxLength={200} placeholder="Misalnya: sudah dicek, sedang cuti panjang" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      </label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`Lepas tahanan gaji ${nama}`}>Lepas</Tombol>
      <div className="w-full"><Hasil h={h} /></div>
    </form>
  );
}

export function FormBagikan({ slip, nama }: { slip: string; nama: string }) {
  const [h, aksi, sibuk] = useActionState<HasilTautanSlip, FormData>(bagikanSlip, null);
  const [tersalin, setTersalin] = useState(false);
  if (h && "tautan" in h) {
    const pesan = `Slip gaji ${h.nama}: ${h.tautan}`;
    return (
      <div className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-3 text-sm" data-testid="tautan-slip">
        <p className="break-all font-mono" data-testid="tautan-slip-isi">{h.tautan}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(pesan)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold">
            Kirim lewat WhatsApp
          </a>
          <Tombol ragam="teks" onClick={async () => { try { await navigator.clipboard.writeText(h.tautan); setTersalin(true); } catch {} }}>
            {tersalin ? "Tersalin" : "Salin tautan"}
          </Tombol>
        </div>
        <p className="mt-1 text-xs text-tinta-2">Berlaku 30 hari. Siapa pun yang memegang tautan ini bisa membaca slipnya.</p>
      </div>
    );
  }
  return (
    <form action={aksi} className="mt-2">
      <input type="hidden" name="slip" value={slip} />
      <input type="hidden" name="nama" value={nama} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`Bagikan slip ${nama}`}>{sibuk ? "Membuat..." : "Bagikan slip"}</Tombol>
      {h && "galat" in h && <p role="alert" className="mt-1 text-sm text-cap">{h.galat}</p>}
    </form>
  );
}
