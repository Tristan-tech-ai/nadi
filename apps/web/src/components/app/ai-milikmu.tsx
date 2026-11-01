import { headers } from "next/headers";
import { cabutAsisten } from "@/app/app/ai-actions";
import { formatTanggal } from "@/lib/format";
import { resourceMcp } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Token = { client_id: string; nama_klien: string; cakupan: string[]; dibuat_at: string; dipakai_at: string | null };

const asalKlien = (id: string) => {
  try {
    return new URL(id).host;
  } catch {
    return "terdaftar di Nadi";
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
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-ai-milikmu" data-testid="ai-milikmu">
      <h2 id="judul-ai-milikmu" className="text-lg font-semibold">Asisten AI milikmu</h2>
      <p className="mt-1 text-sm text-tinta-2">
        Asisten AI yang kamu pakai (lewat MCP) bisa membaca data usaha ini dan mengajukan usulan. Alamat untuk menyambungkan: <span className="break-all font-mono text-tinta">{alamat}</span>
      </p>
      <p className="mt-2 text-sm text-tinta-2">
        <a href="/app/skill" download className="font-semibold text-laut underline underline-offset-4" data-testid="unduh-skill">Unduh paket skill usaha ini (.zip)</a>.
        Isinya cara kerja usahamu (topi, aturan izin, penomoran, bagan akun) tanpa nama orang atau gaji. Pasang di asisten yang mendukung Agent Skills: unggah zip ini, atau ekstrak foldernya ke folder skills asistenmu.
      </p>
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="ai-milikmu-kosong">Belum ada asisten yang tersambung.</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis">
          {daftar.map((t) => (
            <li key={t.client_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.nama_klien}</p>
                <p className="text-sm text-tinta-2">
                  {asalKlien(t.client_id)}. {t.cakupan.includes("nadi.usul") ? "Boleh membaca dan mengajukan usulan" : "Hanya membaca"}.{" "}
                  {t.dipakai_at ? `Terakhir dipakai ${formatTanggal(new Date(t.dipakai_at), zona)}.` : `Tersambung ${formatTanggal(new Date(t.dibuat_at), zona)}.`}
                </p>
              </div>
              <form action={cabutAsisten}>
                <input type="hidden" name="client_id" value={t.client_id} />
                <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-cap px-3 text-sm font-semibold text-cap transition-[background-color,color] duration-150 hover:bg-cap hover:text-kertas" aria-label={`Cabut izin ${t.nama_klien}`}>
                  Cabut
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
