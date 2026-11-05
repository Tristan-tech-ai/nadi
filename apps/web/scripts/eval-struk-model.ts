// M-18B: ukur jalur model mode struk baca-berkas pada foto yang ditolak OCR di perangkat (keyakinan < AMBANG_OCR atau total
// tidak terbaca). Memakai Edge Function yang terdeploy dan akun uji A (usaha "Uji Klaim E2E"), persis jalur layar Klaim:
// lempar_berkas -> unggah -> baca-berkas {mode:"struk"}. Byte foto diberi ekor unik per jalan agar tidak dianggap berkas sama.
// Jalankan dari apps/web: TINGKAT=sulit node scripts/eval-struk-model.ts   (BATAS=n untuk n foto pertama)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = (n: string) => {
  try {
    return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
};
const E = { ...env(".env.local"), ...env(".env.e2e.local") } as Record<string, string>;
const KORPUS = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus");
const FOTO = join(KORPUS, "struk-foto", process.env.TINGKAT ?? "");
const harapan = JSON.parse(readFileSync(join(KORPUS, "struk", "harapan.json"), "utf8")) as Record<string, { total: number; tanggal: string | null }>;

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
if ((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error) throw new Error("masuk gagal");
const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", "Uji Klaim E2E").limit(1);
if (!ada?.[0]) throw new Error("usaha Uji Klaim E2E belum ada (jalankan e2e klaim dulu)");
await sb.rpc("pindah_perusahaan", { p_perusahaan: ada[0].id });
await sb.auth.refreshSession();

const ekor = new TextEncoder().encode(`eval-${Date.now().toString(36)}`);
const semua = readdirSync(FOTO).filter((x) => x.endsWith(".jpg")).sort();
// Semua foto dibaca model (pada set sulit kebijakan AMBANG_OCR mengalihkan 31 dari 32 foto, lihat eval-struk-foto.ts).
const dipilih = semua.slice(0, Number(process.env.BATAS ?? 1e9));
let benar = 0;
let tgl = 0;
let token = 0;
const rinci: string[] = [];
try {
  for (const f of dipilih) {
    const asli = readFileSync(join(FOTO, f));
    const isi = new Uint8Array(asli.length + ekor.length);
    isi.set(asli);
    isi.set(ekor, asli.length);
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", isi)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: d, error } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: f, p_mime: "image/jpeg", p_ukuran: isi.byteLength });
    if (error || !d?.id) throw new Error(`daftar ${f}: ${error?.message ?? "tanpa id"}`);
    if (d.status === "unggah") {
      const { error: eU } = await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: "image/jpeg" });
      if (eU) throw new Error(`unggah ${f}: ${eU.message}`);
    }
    const { data: r, error: eB } = await sb.functions.invoke<{ hasil?: { total: number | null; tanggal: string | null; pemasok: string | null; keyakinan: number }; token?: number; model?: string[] }>("baca-berkas", { body: { berkas_id: d.id, mode: "struk" } });
    const j = harapan[f.replace(".jpg", ".txt")];
    const h = r?.hasil;
    const ok = h?.total === j.total;
    benar += ok ? 1 : 0;
    tgl += h?.tanggal === j.tanggal ? 1 : 0;
    token += r?.token ?? 0;
    rinci.push(`${f}: total ${h?.total ?? (eB ? "galat" : "-")} (benar ${j.total}) ${ok ? "ok" : "SALAH"}, tanggal ${h?.tanggal} (benar ${j.tanggal}), pemasok ${h?.pemasok}, yakin ${h?.keyakinan}, model ${r?.model?.length ?? 0}x, token ${r?.token ?? 0}`);
  }
} finally {
  if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
}
const n = rinci.length;
console.log(rinci.join("\n"));
console.log(`model: total benar ${benar}/${n} (${((benar / Math.max(1, n)) * 100).toFixed(1)}%), tanggal benar ${tgl}/${n}, token ${token} (rata-rata ${Math.round(token / Math.max(1, n))} per foto)`);
