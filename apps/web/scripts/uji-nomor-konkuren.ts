// Uji konkuren Nomor Sakti (F4-01, docs/quality/rencana-uji-f4-01.md butir 2): 200 panggilan RPC ambil_nomor serentak dengan
// akun uji A (pemilik usaha aktifnya) ke satu jenis dokumen baru tanpa token waktu (periode 'selamanya'), lalu memeriksa bahwa
// nomor yang terbit tepat 1..200: 0 ganda, 0 loncat, 0 gagal. Data sintetis: tiap jalan menambah satu templat UJI* dan 200 nomor
// di usaha aktif akun A. Jalankan dari apps/web: node scripts/uji-nomor-konkuren.ts [jumlah]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = (f: string) =>
  Object.fromEntries(readFileSync(join(import.meta.dirname, "..", f), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const E = { ...env(".env.local"), ...env(".env.e2e.local") };
const N = Number(process.argv[2] ?? 200);

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: eMasuk } = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
if (eMasuk) throw new Error("masuk gagal: " + eMasuk.message);

const jenis = ("UJI" + Date.now().toString(36)).toUpperCase().slice(0, 10);
const { error: eTemplat } = await sb.rpc("atur_templat_nomor", { p_jenis: jenis, p_nama: "Uji konkuren", p_templat: "{jenis}-{no:3}" });
if (eTemplat) throw new Error("atur templat gagal: " + eTemplat.message);

const mulai = performance.now();
const hasil = await Promise.all(
  Array.from({ length: N }, (_, i) => sb.rpc("ambil_nomor", { p_jenis: jenis, p_ref: `uji konkuren ${i + 1}` })),
);
const lama = performance.now() - mulai;

const gagal = hasil.filter((h) => h.error).map((h) => h.error!.message);
const urut = hasil.filter((h) => !h.error).map((h) => (h.data as { urut: number }).urut).sort((a, b) => a - b);
const ganda = urut.length - new Set(urut).size;
const hilang = Array.from({ length: N }, (_, i) => i + 1).filter((u) => !urut.includes(u));

// Periksa juga dari tabel: yang tersimpan sama dengan yang dikembalikan.
const { data: baris, error: eBaca } = await sb.from("nomor_terbit").select("urut, nomor").eq("jenis", jenis).order("urut");
if (eBaca) throw new Error("baca nomor gagal: " + eBaca.message);
const tersimpan = (baris ?? []).map((b) => b.urut).join(",") === Array.from({ length: N }, (_, i) => i + 1).join(",");

console.log(JSON.stringify({ jenis, permintaan: N, berhasil: urut.length, gagal: gagal.length, ganda, hilang: hilang.length,
  pertama: baris?.[0]?.nomor, terakhir: baris?.at(-1)?.nomor, tabel_tepat_1_sampai_n: tersimpan, lama_ms: Math.round(lama),
  contoh_galat: gagal.slice(0, 3) }));
if (gagal.length || ganda || hilang.length || !tersimpan) process.exit(1);
