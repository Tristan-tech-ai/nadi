// Eval ekstraktor terkompilasi: berkas pertama tiap tata letak dibaca model (lalu aturan ditulis di latar belakang),
// berkas kembarannya harus dibaca dengan aturan tersimpan: token 0 dan bidang kunci benar.
// Jalankan dari apps/web: node scripts/eval-ekstraktor.ts   Hasil: docs/quality/eval-ekstraktor.md
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { akurasi } from "../../../supabase/functions/baca-berkas/ekstraktor.ts";
import { nilai, type Hasil } from "../../../supabase/functions/baca-berkas/inti.ts";

const AKAR = join(import.meta.dirname, "..", "..", "..");
const KORPUS = join(AKAR, "fixtures", "korpus");
const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// [jenis, berkas pertama, kembaran yang harus 0 token, mime, garam?] PDF dan CSV diberi byte unik agar dibaca ulang; XLSX tidak.
const PASANGAN = [
  ["invoice", "invoice/invoice-02.pdf", "invoice/invoice-03.pdf", "application/pdf", true],
  ["slip_gaji", "slip_gaji/slip-02.pdf", "slip_gaji/slip-04.pdf", "application/pdf", true],
  ["mutasi", "mutasi/mutasi-02.csv", "mutasi/mutasi-03.csv", "text/csv", true],
  ["absen", "absen/absen-02.xlsx", "absen/absen-03.xlsx", XLSX, false],
] as const;

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lempar(jalur: string, mime: string, garam: boolean) {
  let isi = readFileSync(join(KORPUS, jalur));
  // PDF: byte unik setelah %%EOF; CSV: baris koma kosong (dibuang pembaca) dengan panjang unik. Keduanya mengubah sha256.
  if (garam && mime === "application/pdf") isi = Buffer.concat([isi, Buffer.from(`\n%${Date.now()}`)]);
  if (garam && mime === "text/csv") isi = Buffer.concat([isi, Buffer.from("\n" + ",".repeat(5 + (Date.now() % 997)))]);
  const sha = createHash("sha256").update(isi).digest("hex");
  const { data: d, error } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: jalur.split("/")[1], p_mime: mime, p_ukuran: isi.length });
  if (error) throw error;
  if (d.status === "unggah") await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: mime });
  const mulai = Date.now();
  await sb.functions.invoke("baca-berkas", { body: { berkas_id: d.id } });
  const { data: row } = await sb.from("berkas").select("hasil, token_ai").eq("id", d.id).single();
  return { hasil: row?.hasil as (Hasil & { sumber?: string }) | null, token: row?.token_ai ?? 0, detik: (Date.now() - mulai) / 1000 };
}

const baris: string[] = [];
let lulus = 0;
let cocokBidang = 0;
let totalBidang = 0;
for (const [jenis, pertama, kembar, mime, garam] of PASANGAN) {
  const { count: sebelum } = await sb.from("ekstraktor").select("id", { count: "exact", head: true }).eq("jenis_berkas", jenis);
  const a = await lempar(pertama, mime, garam);
  // Aturan ditulis di latar belakang setelah respons; tunggu sampai tersimpan (atau 90 dtk).
  let ada = (sebelum ?? 0) > 0;
  for (let i = 0; i < 30 && !ada; i++) {
    await tunggu(3000);
    const { count } = await sb.from("ekstraktor").select("id", { count: "exact", head: true }).eq("jenis_berkas", jenis);
    ada = (count ?? 0) > 0;
  }
  const b = await lempar(kembar, mime, garam);
  const jawaban = JSON.parse(readFileSync(join(KORPUS, kembar.replace(/\.\w+$/, ".json")), "utf8")).bidang;
  const n = b.hasil ? nilai(jenis, jawaban, b.hasil) : { benar: false, salah: ["tidak terbaca"] };
  const acc = b.hasil ? akurasi(jawaban, b.hasil.bidang) : { cocok: 0, total: 1 };
  cocokBidang += acc.cocok;
  totalBidang += acc.total;
  const ok = b.hasil?.sumber === "aturan" && b.token === 0 && n.benar;
  if (ok) lulus++;
  baris.push(`| ${jenis} | ${pertama} | ${a.hasil?.sumber ?? "-"}, ${a.token} token | ${ada ? "ya" : "tidak"} | ${kembar} | ${b.hasil?.sumber ?? "-"}, ${b.token} token, ${b.detik.toFixed(1)} dtk | ${acc.cocok}/${acc.total} | ${ok ? "lulus" : "gagal: " + n.salah.join(", ")} |`);
  console.log(baris.at(-1));
}

const persen = ((cocokBidang / totalBidang) * 100).toFixed(1);
writeFileSync(join(AKAR, "docs", "quality", "eval-ekstraktor.md"), `# Eval ekstraktor terkompilasi

Dijalankan ${new Date().toISOString()} oleh \`node scripts/eval-ekstraktor.ts\` (apps/web) terhadap Edge Function baca-berkas produksi Supabase, akun uji sintetis A.
Berkas pertama tiap tata letak dibaca model; model berat lalu menulis aturan yang diuji pada berkas yang sama sebelum disimpan. Berkas kembaran harus dibaca dengan aturan itu: 0 token dan bidang kunci benar.

**Hasil: ${lulus} dari ${PASANGAN.length} tata letak lulus. Akurasi bidang berkas kembaran: ${cocokBidang}/${totalBidang} (${persen}%).**

| Jenis | Berkas pertama | Dibaca dengan | Aturan tersimpan | Berkas kembaran | Dibaca dengan | Bidang benar | Penilaian |
|---|---|---|---|---|---|---|---|
${baris.join("\n")}

Catatan: foto nota belum bisa 0 token (butuh OCR di perangkat, R-03). Berkas CSV/XLSX tidak diberi byte unik, jadi jalan ulang memakai hasil yang sudah tersimpan.
`);
console.log(`\nLULUS ${lulus}/${PASANGAN.length}, bidang ${persen}%`);
process.exit(lulus === PASANGAN.length && cocokBidang / totalBidang >= 0.95 ? 0 : 1);
