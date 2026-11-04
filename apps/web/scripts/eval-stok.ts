// Eval stok M-02B: 3 berkas korpus stok (scripts/korpus/stok.mjs: daftar produk Excel, hitung stok Excel dan foto) dilempar lewat jalur sungguhan (lempar_berkas -> Storage -> baca-berkas)
// sebagai akun uji A, lalu dinilai dengan bidang kunci (inti.ts: nilai). Hasil ditulis ke docs/quality/eval-stok.md.
// Jalankan dari apps/web: node scripts/eval-stok.ts [--garam]  (--garam menambah byte unik agar berkas diproses ulang)
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

const SAMPEL = [
  ["produk", "produk/produk-01.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["opname", "opname/opname-01.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["opname", "opname/opname-02.png", "image/png"],
] as const;

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);

const baris: string[] = [];
let benar = 0;
let token = 0;
for (const [jenis, jalurKorpus, mime] of SAMPEL) {
  let isi = readFileSync(join(KORPUS, jalurKorpus));
  // PNG/PDF/CSV/XLSX tetap sah dengan byte tambahan di ujung (diabaikan pembacanya).
  if (GARAM) isi = Buffer.concat([isi, Buffer.from(`\n${Date.now()}`)]);
  const sha = createHash("sha256").update(isi).digest("hex");
  const mulai = Date.now();
  const { data: d, error: e1 } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: jalurKorpus.split("/")[1], p_mime: mime, p_ukuran: isi.length });
  if (e1) throw e1;
  if (d.status === "unggah") {
    const { error: e2 } = await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: mime });
    if (e2 && !/exists/i.test(e2.message)) throw e2;
  }
  const { data: r, error: e3 } = await sb.functions.invoke("baca-berkas", { body: { berkas_id: d.id } });
  if (e3) console.error(jalurKorpus, e3.message, await (e3 as { context?: Response }).context?.text?.());
  // Berkas yang sudah selesai tidak diproses ulang: hasilnya diambil dari baris berkas.
  const { data: row } = await sb.from("berkas").select("status, hasil, token_ai").eq("id", d.id).single();
  const hasil = (r?.hasil ?? row?.hasil) as Hasil | null;
  const jawaban = JSON.parse(readFileSync(join(KORPUS, jalurKorpus.replace(/\.\w+$/, ".json")), "utf8"));
  const n = hasil ? nilai(jenis, jawaban.bidang, hasil) : { benar: false, salah: ["tidak terbaca"] };
  if (n.benar) benar++;
  token += row?.token_ai ?? 0;
  const ulang = r?.diproses_ulang === false ? " (sudah pernah, tidak diproses ulang)" : "";
  baris.push(`| ${jalurKorpus} | ${hasil?.jenis ?? "-"} | ${hasil ? Math.round(hasil.keyakinan * 100) + "%" : "-"} | ${(r?.model ?? []).length || "-"} | ${row?.token_ai ?? 0} | ${n.benar ? "benar" : "salah: " + n.salah.join(", ")}${ulang} | ${((Date.now() - mulai) / 1000).toFixed(1)} dtk |`);
  console.log(baris.at(-1));
}

const laporan = `# Eval Lempar: produk dan hitung stok (M-02B)

Dijalankan ${new Date().toISOString()} oleh \`node scripts/eval-stok.ts${GARAM ? " --garam" : ""}\` (apps/web) terhadap Edge Function baca-berkas produksi Supabase.
Korpus sintetis fixtures/korpus/stok-indeks.json. Benar bila jenis tepat dan semua bidang kunci (fungsi \`nilai\` di supabase/functions/baca-berkas/inti.ts) cocok dengan jawaban.

**Hasil: ${benar} dari ${SAMPEL.length} benar.** Total token tercatat: ${token}.

| Berkas | Jenis terbaca | Keyakinan | Panggilan model | Token | Penilaian | Waktu |
|---|---|---|---|---|---|---|
${baris.join("\n")}
`;
writeFileSync(join(AKAR, "docs", "quality", "eval-stok.md"), laporan);
console.log(`\nBENAR ${benar}/${SAMPEL.length}, token ${token}`);
process.exit(benar === SAMPEL.length ? 0 : 1);
