// Uji sambungan Realtime Broadcast dari Node: dengar topik publik denah demo selama N detik dan cetak pesan yang tiba.
// Jalankan dari apps/web: node scripts/dengar-peta.mjs [kunci=fnb] [detik=75]. Kunci publik dibaca dari .env.local, tidak dicetak.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(join(import.meta.dirname, "..", ".env.local"), "utf8").split("\n").filter((l) => l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const kunci = process.argv[2] ?? "fnb";
const detik = Number(process.argv[3] ?? 75);
let n = 0;
sb.channel(`peta-demo:${kunci}`).on("broadcast", { event: "zona" }, ({ payload }) => {
  n++;
  console.log(new Date().toISOString(), JSON.stringify(payload));
}).subscribe((s) => console.log("status", s));
setTimeout(() => {
  console.log(`selesai: ${n} pesan dalam ${detik} detik`);
  process.exit(n > 0 ? 0 : 1);
}, detik * 1000);
