import { headers } from "next/headers";
import { cabutAsisten } from "@/app/app/ai-actions";
import { formatTanggal } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { resourceMcp } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Token = { client_id: string; nama_klien: string; cakupan: string[]; dibuat_at: string; dipakai_at: string | null };

const asalKlien = (id: string, cadangan: string) => {
  try {
    return new URL(id).host;
  } catch {
    return cadangan;
  }
};

/** Asisten AI (MCP) yang tersambung atas nama pengguna ini di usaha yang dibuka, dengan tombol cabut. */
export async function AiMilikmu() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mcp_token")
    .select("client_id, nama_klien, cakupan, dibuat_at, dipakai_at")
    .eq("jenis", "akses")
    .is("dicabut_at", null)
    .gt("kedaluwarsa_at", new Date().toISOString())
    .order("dibuat_at", { ascending: false });
  const perKlien = new Map<string, Token>();
  // Satu baris per asisten; token hasil penyegaran tetap dihitung, jadi "terakhir dipakai" diambil dari semua tokennya.
  for (const t of (data ?? []) as Token[]) {
    const ada = perKlien.get(t.client_id);
    if (!ada) perKlien.set(t.client_id, { ...t });
    else if (t.dipakai_at && (!ada.dipakai_at || t.dipakai_at > ada.dipakai_at)) ada.dipakai_at = t.dipakai_at;
  }
  const daftar = [...perKlien.values()];
  const alamat = resourceMcp(await headers());
  const zona = await zonaSesi();
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).aiMilikmu;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-ai-milikmu" data-testid="ai-milikmu" lang={bahasa}>
      <h2 id="judul-ai-milikmu" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {sisip(t.ket, { alamat: <span className="break-all font-mono text-tinta">{alamat}</span> })}
      </p>
      <p className="mt-2 text-sm text-tinta-2">
        <a href="/app/skill" download className="font-semibold text-laut underline underline-offset-4" data-testid="unduh-skill">{t.unduh}</a>. {t.unduhKet}
      </p>
      <p className="mt-2 text-sm text-tinta-2">
        <a href={`/skill?bahasa=${bahasa}`} download className="font-semibold text-laut underline underline-offset-4" data-testid="unduh-skill-umum">{t.unduhUmum}</a>{" "}
        (<a href={`/skill?bahasa=${bahasa === "en" ? "id" : "en"}`} download className="text-laut underline underline-offset-4" hrefLang={bahasa === "en" ? "id" : "en"}>{t.unduhUmumEn}</a>). {t.unduhUmumKet}
      </p>
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="ai-milikmu-kosong">{t.kosong}</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis">
          {daftar.map((x) => (
            <li key={x.client_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" data-pengguna>{x.nama_klien}</p>
                <p className="text-sm text-tinta-2">
                  {asalKlien(x.client_id, t.terdaftar)}. {x.cakupan.includes("nadi.usul") ? t.bacaUsul : t.bacaSaja}.{" "}
                  {x.dipakai_at ? isiTeks(t.terakhir, { t: formatTanggal(new Date(x.dipakai_at), zona, bahasa) }) : isiTeks(t.tersambung, { t: formatTanggal(new Date(x.dibuat_at), zona, bahasa) })}
                </p>
              </div>
              <form action={cabutAsisten}>
                <input type="hidden" name="client_id" value={x.client_id} />
                <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-cap px-3 text-sm font-semibold text-cap transition-[background-color,color] duration-150 hover:bg-cap hover:text-kertas" aria-label={isiTeks(t.cabutAria, { nama: x.nama_klien })}>
                  {t.cabut}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
