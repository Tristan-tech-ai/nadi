import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Suspense } from "react";
import { HalamanFeed, TautanBerikut } from "@/components/app/halaman-feed";
import { AksiPutusan } from "@/components/app/putusan";
import { KartuUsulan } from "@/components/ui/kartu-usulan";
import { bacaTampilan, halaman, hitungJenis, hrefFeed, JENIS, JENIS_DIKENAL, LABEL_JENIS, PER_HALAMAN, usulanBaru, type Jenis, type JenisDikenal, type Tampilan, type Urut } from "@/lib/feed";
import { catatanRubrik, nilaiPelamar, rubrikDariTopi, saringCv } from "@/lib/rekrut/rubrik";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

const SUMBER: Record<string, string> = { lempar: "Dari Lempar Saja", analis: "Dari Analis Malam", aturan: "Dari aturan", mcp: "Dari asisten AI-mu", mata: "Dari kamera" };

type Topi = { nama: string; keahlian: unknown; tanggung_jawab: unknown };
type UsulanFeed = { id: string; aksi: string; payload: unknown; berkas_id: string | null };

type Pelamar = { catatan?: string; tautan?: { href: string; label: string } };
type LamaranFeed = { id: string; berkas_id: string; lowongan: { topi: Topi | null } | null; jawaban_wawancara: { count: number }[]; uji_lamaran: { count: number }[] };
type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Skor rubrik untuk usulan pelamar yang datang lewat lowongan bertopi (CV dinilai tanpa atribut terlindungi, F2-02),
 *  dan tautan ke wawancara suaranya bila ada jawaban (F2-03). */
async function catatanPelamar(supabase: Supabase, usulan: UsulanFeed[]): Promise<Map<string, Pelamar>> {
  const hasil = new Map<string, Pelamar>();
  const pelamar = usulan.filter((u) => u.aksi === "rekrut.pelamar" && u.berkas_id);
  if (!pelamar.length) return hasil;
  const { data } = await supabase.from("lamaran").select("id, berkas_id, lowongan(topi(nama, keahlian, tanggung_jawab)), jawaban_wawancara(count), uji_lamaran(count)").in("berkas_id", pelamar.map((u) => u.berkas_id!));
  const lamaranDari = new Map(((data ?? []) as unknown as LamaranFeed[]).map((l) => [l.berkas_id, l]));
  for (const u of pelamar) {
    const l = lamaranDari.get(u.berkas_id!);
    if (!l) continue;
    const topi = l.lowongan?.topi;
    const bidang = (u.payload as { bidang?: unknown } | null)?.bidang;
    const catatan = topi ? (catatanRubrik(topi.nama, nilaiPelamar(rubrikDariTopi(topi), saringCv(bidang))) ?? undefined) : undefined;
    const n = l.jawaban_wawancara?.[0]?.count ?? 0;
    const uji = l.uji_lamaran?.[0]?.count ?? 0;
    const label = n ? `Dengar wawancara suara (${n} jawaban)${uji ? " dan lihat uji" : ""}` : "Lihat hasil uji pelamar";
    hasil.set(u.id, { catatan, tautan: n || uji ? { href: `/app/wawancara/${l.id}`, label } : undefined });
  }
  return hasil;
}

// Feed tidak menyembunyikan usulan (D-05, docs/design/feed-penuh.md): jumlahnya dihitung persis, sisanya dibuka 20 per halaman
// (?lagi=), bisa disaring per jenis (?jenis=) dan diurutkan menurut waktu masuk (?urut=terbaru).
const KOLOM = "id, judul, penjelasan, sumber, keyakinan, dampak_rp, aksi, payload, berkas_id, dibuat_at";

function hitungMenunggu(supabase: Supabase, jenis?: JenisDikenal) {
  const q = supabase.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu");
  return jenis ? q.like("aksi", `${jenis}.%`) : q;
}

function daftarUsulan(supabase: Supabase, t: Tampilan) {
  let q = supabase.from("usulan").select(KOLOM).eq("status", "menunggu");
  if (t.jenis === "lainnya") for (const j of JENIS_DIKENAL) q = q.not("aksi", "like", `${j}.%`);
  else if (t.jenis) q = q.like("aksi", `${t.jenis}.%`);
  q = t.urut === "terbaru"
    ? q.order("dibuat_at", { ascending: false })
    : q.order("tenggat", { ascending: true, nullsFirst: false }).order("dampak_rp", { ascending: false, nullsFirst: false }).order("dibuat_at", { ascending: false });
  // id (uuid7, urut waktu) memutus seri: usulan yang masuk dalam satu transaksi punya dibuat_at sama, dan tanpa urutan pasti
  // halaman berikut bisa mengulang atau melewatkan usulan.
  return q.order("id", { ascending: false }).range(t.lagi, t.lagi + PER_HALAMAN - 1);
}

const PIL = "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-[background-color,color] duration-150";
const PIL_DIAM = "border-garis-kuat hover:bg-kertas-2";
const PIL_AKTIF = "border-tinta bg-tinta text-kertas";
const TAUTAN = "inline-flex min-h-11 items-center text-sm font-semibold text-laut underline underline-offset-4";
const URUT: { kunci: Urut; label: string }[] = [{ kunci: "mendesak", label: "Paling mendesak" }, { kunci: "terbaru", label: "Terbaru" }];

/** Pil saringan: yang aktif ditandai aria-current, centang, dan warna terbalik (status tidak hanya warna, ANTI-SLOP S06). */
function Pil({ href, aktif, label, jumlah, testid }: { href: string; aktif: boolean; label: string; jumlah?: number; testid: string }) {
  return (
    <li>
      <Link href={href} aria-current={aktif ? "page" : undefined} className={`${PIL} ${aktif ? PIL_AKTIF : PIL_DIAM}`} data-testid={testid}>
        {aktif ? <CheckIcon size={14} weight="bold" aria-hidden /> : null}
        {label}
        {jumlah !== undefined ? <span className="angka font-normal">{jumlah}</span> : null}
      </Link>
    </li>
  );
}

function Saringan({ t, total, perJenis }: { t: Tampilan; total: number; perJenis: Record<Jenis, number> }) {
  return (
    <div className="mt-3 grid gap-2">
      <nav aria-label="Saring jenis usulan">
        <ul className="flex flex-wrap gap-2">
          <Pil href={hrefFeed({ urut: t.urut })} aktif={!t.jenis} label="Semua" jumlah={total} testid="pil-semua" />
          {JENIS.map((j) => (
            <Pil key={j} href={hrefFeed({ jenis: j, urut: t.urut })} aktif={t.jenis === j} label={LABEL_JENIS[j]} jumlah={perJenis[j]} testid={`pil-${j}`} />
          ))}
        </ul>
      </nav>
      <nav aria-label="Urutan usulan">
        <ul className="flex flex-wrap gap-2">
          {URUT.map((u) => (
            <Pil key={u.kunci} href={hrefFeed({ jenis: t.jenis, urut: u.kunci })} aktif={t.urut === u.kunci} label={u.label} testid={`urut-${u.kunci}`} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Semua bacaan Feed sekaligus (paralel). Umur usulan dihitung di sini, bukan di komponen, agar render tetap murni. */
async function muatFeed(t: Tampilan) {
  const supabase = await createClient();
  const [{ count: orang }, { count: total }, hitung, { data, error }] = await Promise.all([
    supabase.from("orang").select("id", { count: "exact", head: true }),
    hitungMenunggu(supabase),
    Promise.all(JENIS_DIKENAL.map((j) => hitungMenunggu(supabase, j))),
    daftarUsulan(supabase, t),
  ]);
  // Offset di luar jangkauan (tautan lama setelah usulan diputuskan) bisa dijawab PostgREST dengan galat rentang: anggap kosong.
  const usulan = error ? [] : (data ?? []);
  const semua = total ?? 0;
  const perJenis = hitungJenis(semua, Object.fromEntries(JENIS_DIKENAL.map((j, i) => [j, hitung[i].count ?? 0])) as Record<JenisDikenal, number>);
  const pelamar = await catatanPelamar(supabase, usulan);
  const sekarang = Date.now();
  return { orang: orang ?? 0, semua, perJenis, pelamar, usulan: usulan.map((u) => ({ ...u, baru: usulanBaru(u.dibuat_at, sekarang) })) };
}

// Beranda aplikasi: Feed Keputusan (usulan menunggu, yang paling mendesak dan berdampak di atas).
async function Ringkasan({ searchParams }: { searchParams: PageProps<"/app">["searchParams"] }) {
  const t = bacaTampilan(await searchParams);
  const sesi = await wajibPerusahaan();
  const { orang, semua, perJenis, pelamar, usulan } = await muatFeed(t);
  const tersaring = t.jenis ? perJenis[t.jenis] : semua;
  const h = halaman(tersaring, t.lagi);
  const label = t.jenis ? LABEL_JENIS[t.jenis] : null;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Hari ini</h1>
      <p className="mt-2 text-tinta-2" data-testid="peran">Kamu masuk sebagai {sesi.peran}.</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Orang tercatat</dt>
          <dd className="angka mt-1 text-2xl font-semibold" data-testid="jumlah-orang">{orang}</dd>
        </div>
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Usulan menunggu</dt>
          <dd className="angka mt-1 text-2xl font-semibold" data-testid="jumlah-usulan">{semua}</dd>
        </div>
      </dl>
      <h2 className="mt-8 text-lg font-semibold">Perlu keputusanmu</h2>
      {semua === 0 ? (
        <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="feed-kosong">
          Belum ada usulan. Lempar berkas pertamamu, misalnya foto nota hari ini, dan Nadi akan menyiapkan isinya untuk kamu setujui.
        </p>
      ) : (
        <HalamanFeed>
          <Saringan t={t} total={semua} perJenis={perJenis} />
          {h.dari > 0 ? (
            <p className="mt-4 text-sm text-tinta-2" data-testid="posisi-feed">
              Usulan <span className="angka">{h.dari}</span> sampai <span className="angka">{h.sampai}</span> dari <span className="angka">{tersaring}</span>
              {label ? ` jenis ${label}` : ""}
              {t.urut === "terbaru" ? ", yang terbaru di atas." : ", yang paling mendesak di atas."}
            </p>
          ) : null}
          {usulan.length ? (
            <div className="mt-3 grid gap-3" data-testid="daftar-usulan">
              {usulan.map((u) => (
                <KartuUsulan key={u.id} usulan={{ judul: u.judul, penjelasan: u.penjelasan ?? "", sumber: SUMBER[u.sumber] ?? u.sumber, keyakinan: u.keyakinan ?? undefined, dampakRp: u.dampak_rp ?? undefined, catatan: pelamar.get(u.id)?.catatan, tautan: pelamar.get(u.id)?.tautan, baru: u.baru }} aksi={<AksiPutusan usulanId={u.id} />} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="saringan-kosong">
              {h.lewat ? "Halaman ini sudah kosong, mungkin usulannya sudah diputuskan." : `Tidak ada usulan jenis ${label ?? ""} yang menunggu.`}{" "}
              <Link href={hrefFeed({ jenis: h.lewat ? t.jenis : null, urut: t.urut })} className="font-semibold text-laut underline underline-offset-4">
                {h.lewat ? "Kembali ke awal daftar" : "Lihat semua jenis"}
              </Link>
            </p>
          )}
          {h.sisa > 0 || h.sebelum !== null ? (
            <nav aria-label="Halaman usulan" className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4">
              {h.sisa > 0 ? (
                <p data-testid="sisa-usulan">
                  Masih ada <span className="angka font-semibold">{h.sisa}</span> usulan{label ? ` ${label}` : ""} lagi.
                </p>
              ) : (
                <p data-testid="akhir-usulan">Itu semua usulan{label ? ` ${label}` : ""} yang menunggu.</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-5">
                {h.berikut !== null ? (
                  <TautanBerikut t={t} berikut={h.berikut} className={TAUTAN}>
                    Lihat {h.ukuranBerikut} berikutnya
                  </TautanBerikut>
                ) : null}
                {h.sebelum !== null && h.sebelum > 0 ? (
                  <Link href={hrefFeed({ ...t, lagi: h.sebelum })} className={TAUTAN} data-testid="lihat-sebelumnya">
                    Lihat {PER_HALAMAN} sebelumnya
                  </Link>
                ) : null}
                {h.sebelum !== null ? (
                  <Link href={hrefFeed({ ...t, lagi: 0 })} className={TAUTAN} data-testid="ke-awal">
                    Kembali ke {PER_HALAMAN} teratas
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </HalamanFeed>
      )}
    </section>
  );
}

export default function BerandaApp(props: PageProps<"/app">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-8 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Ringkasan searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
