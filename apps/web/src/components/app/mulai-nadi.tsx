import { CheckCircleIcon, CircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { tutupMulai } from "@/app/app/mulai-actions";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { cookieMulai, langkahMulai, type Fakta } from "@/lib/mulai";
import { fiturUsaha } from "@/lib/ruang-sesi";
import { createClient } from "@/lib/supabase/server";

// U-05 daftar "Mulai di Nadi" di Hari ini (pemilik/admin). Langkah tercentang dari data; daftar hilang sendiri bila semua selesai,
// bisa ditutup (cookie per usaha), dan dipanggil lagi dari bantuan "?" di kepala halaman. Dirender tanpa Suspense sendiri supaya
// ikut menunggu bersama isi Hari ini dan tidak menggeser kartu di bawahnya (CLS).
async function fakta(perusahaanId: string): Promise<Fakta> {
  const sb = await createClient();
  const n = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0, () => 0);
  const h = { count: "exact" as const, head: true };
  const [berkas, orang, produk, invoice, draf, token, staf, servis, janji] = await Promise.all([
    n(sb.from("berkas").select("id", h)),
    n(sb.from("orang").select("id", h).eq("status", "aktif")),
    n(sb.from("produk").select("id", h).eq("aktif", true)),
    n(sb.from("invoice").select("id", h).neq("status", "batal")),
    n(sb.from("ai_draft").select("id", h)),
    n(sb.from("mcp_token").select("id", h).eq("perusahaan_id", perusahaanId).is("dicabut_at", null)),
    n(sb.from("anggota").select("user_id", h).eq("peran", "staf").eq("aktif", true)),
    n(sb.from("service_order").select("id", h)),
    n(sb.from("booking_setting").select("kunci", h).eq("aktif", true)),
  ]);
  return { berkas, orang, produk, invoice, ai: draf + token, staf, servis, janji };
}

export async function MulaiDiNadi({ bahasa, perusahaanId, paksa }: { bahasa: Bahasa; perusahaanId: string; paksa?: boolean }) {
  if (!paksa && (await cookies()).get(cookieMulai(perusahaanId))?.value === "tutup") return null;
  const [nyala, f] = await Promise.all([fiturUsaha(perusahaanId), fakta(perusahaanId)]);
  const langkah = langkahMulai(nyala, f);
  const selesai = langkah.filter((l) => l.selesai).length;
  if (selesai === langkah.length) return null;
  const en = bahasa === "en";
  const judul = en ? "Getting started with Nadi" : "Mulai di Nadi";
  return (
    <section id="mulai-nadi" aria-labelledby="judul-mulai" className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="mulai-nadi">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="judul-mulai" className="text-lg font-semibold">{judul}</h2>
          <p className="mt-0.5 text-sm text-tinta-2" data-testid="mulai-progres">
            {en ? `${selesai} of ${langkah.length} done` : `${selesai} dari ${langkah.length} selesai`}
          </p>
        </div>
        <form action={tutupMulai}>
          <button type="submit" title={en ? "Close" : "Tutup"} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-tinta-2 hover:bg-kertas-2 hover:text-tinta">
            <XIcon size={18} aria-hidden /><span className="sr-only">{en ? `Close ${judul}` : `Tutup ${judul}`}</span>
          </button>
        </form>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-kertas-2" aria-hidden>
        <div className="h-full origin-left rounded-full bg-tinta" style={{ transform: `scaleX(${selesai / langkah.length})` }} />
      </div>
      <ol className="mt-3 grid gap-1">
        {langkah.map((l) => (
          <li key={l.id} data-langkah={l.id} data-selesai={l.selesai ? "ya" : "belum"}>
            <Link href={l.href} className="flex min-h-12 items-start gap-3 rounded-[var(--radius-isian)] px-2 py-2 hover:bg-kertas-2">
              {l.selesai
                ? <CheckCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-daun" aria-hidden />
                : <CircleIcon size={22} className="mt-0.5 shrink-0 text-tinta-2" aria-hidden />}
              <span className="min-w-0">
                <span className={`block font-semibold ${l.selesai ? "text-tinta-2" : ""}`}>
                  {l.label[bahasa]}<span className="sr-only">{l.selesai ? (en ? ", done" : ", selesai") : (en ? ", not done yet" : ", belum")}</span>
                </span>
                {!l.selesai && <span className="block text-sm text-tinta-2">{l.guna[bahasa]}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
