import { Suspense } from "react";
import { AksiPutusan } from "@/components/app/putusan";
import { KartuUsulan } from "@/components/ui/kartu-usulan";
import { catatanRubrik, nilaiPelamar, rubrikDariTopi, saringCv } from "@/lib/rekrut/rubrik";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

const SUMBER: Record<string, string> = { lempar: "Dari Lempar Saja", analis: "Dari Analis Malam", aturan: "Dari aturan", mcp: "Dari asisten AI-mu", mata: "Dari kamera" };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };
type UsulanFeed = { id: string; aksi: string; payload: unknown; berkas_id: string | null };

/** Skor rubrik untuk usulan pelamar yang datang lewat lowongan bertopi. CV dinilai tanpa atribut terlindungi (F2-02). */
async function catatanPelamar(supabase: Awaited<ReturnType<typeof createClient>>, usulan: UsulanFeed[]): Promise<Map<string, string>> {
  const hasil = new Map<string, string>();
  const pelamar = usulan.filter((u) => u.aksi === "rekrut.pelamar" && u.berkas_id);
  if (!pelamar.length) return hasil;
  const { data } = await supabase.from("lamaran").select("berkas_id, lowongan(topi(nama, keahlian, tanggung_jawab))").in("berkas_id", pelamar.map((u) => u.berkas_id!));
  const topiDari = new Map<string, Topi>();
  for (const l of (data ?? []) as unknown as { berkas_id: string; lowongan: { topi: Topi | null } | null }[]) if (l.lowongan?.topi) topiDari.set(l.berkas_id, l.lowongan.topi);
  for (const u of pelamar) {
    const topi = topiDari.get(u.berkas_id!);
    if (!topi) continue;
    const bidang = (u.payload as { bidang?: unknown } | null)?.bidang;
    const c = catatanRubrik(topi.nama, nilaiPelamar(rubrikDariTopi(topi), saringCv(bidang)));
    if (c) hasil.set(u.id, c);
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
  const catatan = await catatanPelamar(supabase, usulan ?? []);
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
            <KartuUsulan key={u.id} usulan={{ judul: u.judul, penjelasan: u.penjelasan ?? "", sumber: SUMBER[u.sumber] ?? u.sumber, keyakinan: u.keyakinan ?? undefined, dampakRp: u.dampak_rp ?? undefined, catatan: catatan.get(u.id) }} aksi={<AksiPutusan usulanId={u.id} />} />
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
