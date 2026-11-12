import { perluCatatan, UU_BARU } from "@/lib/aturan/uu-ketenagakerjaan";
import type { Bahasa } from "@/lib/i18n/bahasa";

// Q-52: tanda jujur di setiap hitungan ketenagakerjaan yang dasarnya dicabut atau terdampak UU 27/2026 (lib/aturan/uu-ketenagakerjaan.ts).
const TEKS: Record<Bahasa, { judul: string; isi: string; tautan: string }> = {
  id: {
    judul: "Aturan ketenagakerjaan baru",
    isi: "UU 27/2026 tentang Pelindungan Ketenagakerjaan berlaku sejak 28 Okt 2026 dan mencabut UU 13/2003. Hitungan di sini masih memakai aturan sebelumnya. Nadi sedang mencocokkan pasalnya dengan UU baru, jadi periksa lagi sebelum membayar atau memutuskan.",
    tautan: "Baca teks resminya",
  },
  en: {
    judul: "New labour law",
    isi: "Law 27/2026 on Labour Protection has applied since 28 Oct 2026 and revokes Law 13/2003. This calculation still uses the earlier rules. Nadi is matching its articles against the new law, so check again before paying or deciding.",
    tautan: "Read the official text",
  },
};

// Tanpa tanggal hari ini (halaman dirender statis): UU 27/2026 sudah berlaku sejak 28 Okt 2026, jadi tanggal berlakunya dipakai.
export function CatatanUuBaru({ dasar, bahasa = "id", hari = UU_BARU.berlaku }: { dasar: string; bahasa?: Bahasa; hari?: string }) {
  if (!perluCatatan(dasar, hari)) return null;
  const t = TEKS[bahasa] ?? TEKS.id;
  return (
    <div role="note" lang={bahasa} className="my-6 max-w-2xl rounded-[var(--radius-kartu)] border border-garis bg-kertas-2 p-4 text-sm" data-testid="catatan-uu-baru">
      <p className="font-semibold">{t.judul}</p>
      <p className="mt-1 text-tinta-2">{t.isi}</p>
      <a href={UU_BARU.sumber} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-laut underline underline-offset-4">{t.tautan}</a>
    </div>
  );
}
