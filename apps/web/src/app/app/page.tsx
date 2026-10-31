import { Suspense } from "react";
import { AksiPutusan } from "@/components/app/putusan";
import { KartuUsulan } from "@/components/ui/kartu-usulan";
import { catatanRubrik, nilaiPelamar, rubrikDariTopi, saringCv } from "@/lib/rekrut/rubrik";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

const SUMBER: Record<string, string> = { lempar: "Dari Lempar Saja", analis: "Dari Analis Malam", aturan: "Dari aturan", mcp: "Dari asisten AI-mu", mata: "Dari kamera" };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };
type UsulanFeed = { id: string; aksi: string; payload: unknown; berkas_id: string | null };

type Pelamar = { catatan?: string; tautan?: { href: string; label: string } };
type LamaranFeed = { id: string; berkas_id: string; lowongan: { topi: Topi | null } | null; jawaban_wawancara: { count: number }[] };

/** Skor rubrik untuk usulan pelamar yang datang lewat lowongan bertopi (CV dinilai tanpa atribut terlindungi, F2-02),
 *  dan tautan ke wawancara suaranya bila ada jawaban (F2-03). */
async function catatanPelamar(supabase: Awaited<ReturnType<typeof createClient>>, usulan: UsulanFeed[]): Promise<Map<string, Pelamar>> {
  const hasil = new Map<string, Pelamar>();
  const pelamar = usulan.filter((u) => u.aksi === "rekrut.pelamar" && u.berkas_id);
  if (!pelamar.length) return hasil;
  const { data } = await supabase.from("lamaran").select("id, berkas_id, lowongan(topi(nama, keahlian, tanggung_jawab)), jawaban_wawancara(count)").in("berkas_id", pelamar.map((u) => u.berkas_id!));
  const lamaranDari = new Map(((data ?? []) as unknown as LamaranFeed[]).map((l) => [l.berkas_id, l]));
  for (const u of pelamar) {
    const l = lamaranDari.get(u.berkas_id!);
    if (!l) continue;
    const topi = l.lowongan?.topi;
    const bidang = (u.payload as { bidang?: unknown } | null)?.bidang;
    const catatan = topi ? (catatanRubrik(topi.nama, nilaiPelamar(rubrikDariTopi(topi), saringCv(bidang))) ?? undefined) : undefined;
    const n = l.jawaban_wawancara?.[0]?.count ?? 0;
    hasil.set(u.id, { catatan, tautan: n ? { href: `/app/wawancara/${l.id}`, label: `Dengar wawancara suara (${n} jawaban)` } : undefined });
  }
  return hasil;
}

// Beranda aplikasi: Feed Keputusan (usulan menunggu, yang paling mendesak dan berdampak di atas).
async function Ringkasan() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ count: orang }, { data: usulan }] = await Promise.all([
    supabase.from("orang").select("id", { count: "exact", head: true }),
    supabase.from("usulan").select("id, judul, penjelasan, sumber, keyakinan, dampak_rp, aksi, payload, berkas_id").eq("status", "menunggu")
      .order("tenggat", { ascending: true, nullsFirst: false }).order("dampak_rp", { ascending: false, nullsFirst: false }).order("dibuat_at", { ascending: false }).limit(20),
  ]);
  const pelamar = await catatanPelamar(supabase, usulan ?? []);
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Hari ini</h1>
      <p className="mt-2 text-tinta-2" data-testid="peran">Kamu masuk sebagai {sesi.peran}.</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Orang tercatat</dt>
          <dd className="angka mt-1 text-2xl font-semibold" data-testid="jumlah-orang">{orang ?? 0}</dd>
        </div>
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Usulan menunggu</dt>
          <dd className="angka mt-1 text-2xl font-semibold">{usulan?.length ?? 0}</dd>
        </div>
      </dl>
      <h2 className="mt-8 text-lg font-semibold">Perlu keputusanmu</h2>
      {usulan?.length ? (
        <div className="mt-3 grid gap-3">
          {usulan.map((u) => (
            <KartuUsulan key={u.id} usulan={{ judul: u.judul, penjelasan: u.penjelasan ?? "", sumber: SUMBER[u.sumber] ?? u.sumber, keyakinan: u.keyakinan ?? undefined, dampakRp: u.dampak_rp ?? undefined, catatan: pelamar.get(u.id)?.catatan, tautan: pelamar.get(u.id)?.tautan }} aksi={<AksiPutusan usulanId={u.id} />} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="feed-kosong">
          Belum ada usulan. Lempar berkas pertamamu, misalnya foto nota hari ini, dan Nadi akan menyiapkan isinya untuk kamu setujui.
        </p>
      )}
    </section>
  );
}

export default function BerandaApp() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-8 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Ringkasan />
      </Suspense>
    </main>
  );
}
