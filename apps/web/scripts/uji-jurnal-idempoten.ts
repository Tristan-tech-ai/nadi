// Uji idempoten paralel ledger (F4-04, docs/quality/rencana-uji-f4-04.md butir 2): 20 panggilan RPC posting_jurnal serentak dengan
// kunci_idempoten yang sama dari akun uji A (pemilik usaha aktifnya) harus menghasilkan tepat satu jurnal, dan semua panggilan
// mengembalikan id yang sama. Data sintetis: tiap jalan menambah satu jurnal Rp1.000 (Kas/Modal pemilik) di usaha aktif akun A.
// Jalankan dari apps/web: node scripts/uji-jurnal-idempoten.ts [jumlah]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };
const N = Number(process.argv[2] ?? 20);

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);

const kunci = `uji:idempoten:${Date.now()}`;
const kepala = { keterangan: "Uji idempoten paralel", kunci_idempoten: kunci, sumber: "uji" };
const baris = [{ akun: "1-100", debit: 1000 }, { akun: "3-100", kredit: 1000 }];
const mulai = performance.now();
const hasil = await Promise.all(Array.from({ length: N }, () => sb.rpc("posting_jurnal", { p_kepala: kepala, p_baris: baris })));
const lama = performance.now() - mulai;

const gagal = hasil.filter((h) => h.error).map((h) => h.error!.message);
const id = new Set(hasil.filter((h) => !h.error).map((h) => (h.data as { id: string }).id));
const baru = hasil.filter((h) => !h.error && (h.data as { baru: boolean }).baru).length;
const { count, error: eHitung } = await sb.from("jurnal").select("id", { count: "exact", head: true }).eq("kunci_idempoten", kunci);
if (eHitung) throw new Error("hitung jurnal gagal: " + eHitung.message);

console.log(JSON.stringify({ kunci, permintaan: N, berhasil: N - gagal.length, gagal: gagal.length, id_berbeda: id.size, baru, jurnal_tersimpan: count, lama_ms: Math.round(lama), contoh_galat: gagal.slice(0, 3) }));
if (gagal.length || id.size !== 1 || baru !== 1 || count !== 1) process.exit(1);
