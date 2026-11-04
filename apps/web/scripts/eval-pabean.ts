// Eval dokumen pabean (B-EKSIM3): korpus sintetis fixtures/korpus/pabean (PIB, PEB, SPPB) dilempar lewat jalur sungguhan
// (lempar_berkas -> Storage -> baca-berkas produksi) sebagai akun uji A, lalu dinilai per bidang kunci (inti.ts: nilai).
// Lulus bila akurasi bidang >= 90%. Hasil ditulis ke docs/quality/eval-pabean.md.
// Jalankan dari apps/web: node scripts/eval-pabean.ts [--garam]  (--garam menambah byte unik agar berkas diproses ulang)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { nilai, type Hasil } from "../../../supabase/functions/baca-berkas/inti.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..");
const KORPUS = join(AKAR, "fixtures", "korpus");
const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };
const GARAM = process.argv.includes("--garam");
const indeks = JSON.parse(readFileSync(join(KORPUS, "pabean", "indeks.json"), "utf8")) as { berkas: { jenis: string; berkas: string; jawaban: string }[] };

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);

const baris: string[] = [];
let cocok = 0;
let total = 0;
let token = 0;
for (const { jenis, berkas, jawaban } of indeks.berkas) {
  let isi = readFileSync(join(KORPUS, berkas));
  if (GARAM) isi = Buffer.concat([isi, Buffer.from(`\n%${Date.now()}`)]);
  const sha = createHash("sha256").update(isi).digest("hex");
  const mulai = Date.now();
  const { data: d, error: e1 } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: berkas.split("/")[1], p_mime: "application/pdf", p_ukuran: isi.length });
  if (e1) throw e1;
  if (d.status === "unggah") {
    const { error: e2 } = await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: "application/pdf" });
    if (e2 && !/exists/i.test(e2.message)) throw e2;
  }
  const { data: r, error: e3 } = await sb.functions.invoke("baca-berkas", { body: { berkas_id: d.id } });
  if (e3) console.error(berkas, e3.message);
  const { data: row } = await sb.from("berkas").select("status, hasil, token_ai").eq("id", d.id).single();
  const hasil = (r?.hasil ?? row?.hasil) as Hasil | null;
  const benar = JSON.parse(readFileSync(join(KORPUS, jawaban), "utf8"));
  const n = hasil ? nilai(jenis, benar.bidang, hasil) : { benar: false, salah: ["tidak terbaca"], diperiksa: 0 };
  // Jenis salah = semua bidang kunci dihitung salah (diperiksa 0 dari jenis yang benar).
  const kunci = nilai(jenis, benar.bidang, { jenis: jenis as Hasil["jenis"], keyakinan: 1, ringkasan: "", bidang: benar.bidang }).diperiksa;
  const ok = n.diperiksa ? n.diperiksa - n.salah.length : 0;
  cocok += ok;
  total += kunci;
  token += row?.token_ai ?? 0;
  baris.push(`| ${berkas} | ${hasil?.jenis ?? "-"} | ${hasil ? Math.round(hasil.keyakinan * 100) + "%" : "-"} | ${ok}/${kunci} | ${n.salah.length ? n.salah.join(", ") : "semua benar"} | ${r?.usulan_id ? "ada" : "-"} | ${row?.token_ai ?? 0} | ${((Date.now() - mulai) / 1000).toFixed(1)} dtk |`);
  console.log(baris.at(-1));
}

const persen = total ? (100 * cocok) / total : 0;
const laporan = `# Eval dokumen pabean (B-EKSIM3)

Dijalankan ${new Date().toISOString()} oleh \`node scripts/eval-pabean.ts${GARAM ? " --garam" : ""}\` (apps/web) terhadap Edge Function baca-berkas produksi.
Korpus sintetis fixtures/korpus/pabean (dibuat \`node scripts/korpus/pabean.mjs\`; tata letak meniru elemen formulir PIB BC 2.0 Lampiran PER-44/BC/2011 dan PEB BC 3.0 Lampiran PER-07/BC/2020; semua isi karangan, bertanda CONTOH).
Bidang kunci per jenis: fungsi \`nilai\` di supabase/functions/baca-berkas/inti.ts (PIB 12 bidang termasuk NDPBM, nilai CIF, nilai pabean, BM, PPN, PPh, jumlah baris, HS baris pertama; PEB 7; SPPB 3).

**Akurasi bidang: ${cocok}/${total} = ${persen.toFixed(1)}%** (syarat >= 90%). Total token tercatat: ${token}.

| Berkas | Jenis terbaca | Keyakinan | Bidang benar | Salah | Usulan | Token | Waktu |
|---|---|---|---|---|---|---|---|
${baris.join("\n")}
`;
writeFileSync(join(AKAR, "docs", "quality", "eval-pabean.md"), laporan);
console.log(`\nBIDANG ${cocok}/${total} = ${persen.toFixed(1)}%, token ${token}`);
process.exit(persen >= 90 ? 0 : 1);
