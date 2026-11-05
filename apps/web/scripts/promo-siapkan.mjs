// D-28: siapkan usaha contoh bersih "Toko Bu Sari" di akun uji B (produksi) agar film promo memakai layar dan hasil Nadi
// sungguhan: lima berkas korpus dilempar lewat layar Lempar (dibaca baca-berkas asli), QRIS statis sintetis + satu invoice,
// denah Mata v2 + rekap kunjungan dari pelacak Mata yang dijalankan pada korpus video toko (fixtures/korpus/mata-v2).
// Semua data sintetis. Idempoten: langkah yang sudah ada dilewati. Jalankan dari apps/web: node scripts/promo-siapkan.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { Pelacak, deteksi, latarDari, rekapJam } from "../src/lib/mata/jejak.ts";
import { buatSkenario, DENAH, KORPUS_V2, renderBingkai } from "../src/lib/mata/toko-sintetis.ts";

const baca = (n) => { try { return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])); } catch { return {}; } };
const E = { ...baca(".env.local"), ...baca(".env.e2e.local") };
const BASE = process.argv[2] ?? "https://nadi-swart.vercel.app";
const NAMA = "Toko Bu Sari";
const KORPUS = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus");
const BERKAS = [["nota/nota-01.png", "image/png"], ["invoice/invoice-01.pdf", "application/pdf"], ["absen/absen-01.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["mutasi/mutasi-01.csv", "text/csv"], ["slip_gaji/slip-01.pdf", "application/pdf"]];

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
if ((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error) throw new Error("masuk akun B gagal");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID", timezoneId: "Asia/Makassar" });
await ctx.route("https://wa.me/**", (r) => r.abort());
const p = await ctx.newPage();
async function masuk(next) {
  await ctx.clearCookies();
  await p.goto(`${BASE}/masuk?next=${encodeURIComponent(next)}`);
  await p.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await p.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await p.getByRole("button", { name: "Masuk" }).click();
  await p.waitForURL((u) => u.pathname === next);
}

// 1. Usaha.
let { data: usaha } = await sb.from("perusahaan").select("id, nama").eq("nama", NAMA).maybeSingle();
if (!usaha) {
  await masuk("/app/mulai");
  await p.getByLabel("Nama usaha").fill(NAMA);
  await p.getByText("Toko, grosir, minimarket").click();
  await p.getByText("2 sampai 5").click();
  await p.getByLabel("Kota").fill("Denpasar");
  await p.getByRole("button", { name: "Siapkan usahaku" }).click();
  await p.waitForURL((u) => u.pathname === "/app");
  usaha = (await sb.from("perusahaan").select("id, nama").eq("nama", NAMA).single()).data;
}
await sb.rpc("pindah_perusahaan", { p_perusahaan: usaha.id });
await sb.auth.refreshSession();
console.log("usaha", usaha.id);

// 2. Lempar lima jenis berkas lewat layar.
const { count: nUsulan } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("perusahaan_id", usaha.id).eq("sumber", "lempar");
await masuk("/app/lempar");
if ((nUsulan ?? 0) < BERKAS.length) {
  await p.getByTestId("input-berkas").setInputFiles(BERKAS.map(([j, mimeType]) => ({ name: j.split("/")[1], mimeType, buffer: readFileSync(join(KORPUS, j)) })));
  await p.getByTestId("daftar-lempar").locator('li[data-status="usulan"]').nth(BERKAS.length - 1).waitFor({ timeout: 180_000 });
  console.log("lempar", await p.getByTestId("daftar-lempar").innerText());
}

// 3. QRIS statis sintetis + satu invoice.
const tlv = (id, v) => `${id}${String(v.length).padStart(2, "0")}${v}`;
const crc16 = (s) => { let c = 0xffff; for (const x of new TextEncoder().encode(s)) { c ^= x << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c.toString(16).toUpperCase().padStart(4, "0"); };
const { count: nInv } = await sb.from("invoice").select("id", { count: "exact", head: true }).eq("perusahaan_id", usaha.id);
if (!nInv) {
  const isi = [tlv("00", "01"), tlv("01", "11"), tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1026000000002") + tlv("03", "UMI")),
    tlv("52", "5411"), tlv("53", "360"), tlv("58", "ID"), tlv("59", "TOKO BU SARI"), tlv("60", "DENPASAR")].join("") + "6304";
  const qr = join(import.meta.dirname, "..", "test-results", "qris-bu-sari.png");
  await QRCode.toFile(qr, isi + crc16(isi), { width: 600, margin: 4 });
  await p.goto(`${BASE}/app/invoice`);
  const bayar = p.getByRole("form", { name: "Tujuan bayar" });
  await bayar.getByTestId("foto-qris").setInputFiles(qr);
  await bayar.getByTestId("baca-qris").filter({ hasText: "TOKO BU SARI" }).waitFor();
  await bayar.getByRole("button", { name: "Simpan tujuan bayar" }).click();
  await p.getByRole("form", { name: "Tujuan bayar" }).getByRole("status").waitFor();
  const f = p.getByRole("form", { name: "Invoice baru" });
  await f.getByLabel("Pelanggan", { exact: true }).fill("Hotel Segara");
  await f.getByLabel("Uraian baris 1").fill("Air mineral 600 ml (dus)");
  await f.getByLabel("Jumlah baris 1").fill("20");
  await f.getByLabel("Harga satuan baris 1").fill("52.000");
  await f.getByRole("button", { name: "Tambah baris" }).click();
  await f.getByLabel("Uraian baris 2").fill("Teh botol (krat)");
  await f.getByLabel("Jumlah baris 2").fill("6");
  await f.getByLabel("Harga satuan baris 2").fill("68.000");
  const tempo = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date(Date.now() + 7 * 86400_000));
  await f.getByLabel("Jatuh tempo").fill(tempo);
  await f.getByRole("button", { name: "Terbitkan invoice" }).click();
  await p.getByRole("form", { name: "Invoice baru" }).getByRole("status").filter({ hasText: "Terbit:" }).waitFor();
}
const { data: inv } = await sb.from("invoice").select("nomor, kode_verifikasi").eq("perusahaan_id", usaha.id).limit(1).maybeSingle();
console.log("invoice", inv);

// 4. Mata v2: denah korpus + rekap kunjungan hasil pelacak pada korpus video (empat skenario di empat jam hari ini).
const { data: zona } = await sb.rpc("save_vision_zones", { p_zones: DENAH.zona.map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon })) });
await sb.rpc("set_vision_notice", { p_on: true });
const idNama = new Map(zona.map((z) => [z.nama, z.id]));
const idKorpus = new Map(DENAH.zona.map((z) => [z.id, idNama.get(z.nama)]));
const jamSekarang = Math.floor(Date.now() / 3600_000) * 3600_000;
for (const [i, nama] of ["sepi", "ramai", "antrean", "ramai-2", "sepi-2", "ramai"].entries()) {
  const s = buatSkenario(KORPUS_V2.find((k) => k.nama === nama));
  const latar = latarDari(renderBingkai(s, 0));
  const pl = new Pelacak(s.zona);
  const k = [];
  for (let f = 1; f < Math.round(s.durasi * s.fps); f++) k.push(...pl.langkah(f / s.fps, deteksi(latar, renderBingkai(s, f))));
  k.push(...pl.selesai());
  for (const x of k) x.zonaDetik = Object.fromEntries(Object.entries(x.zonaDetik).map(([id, d]) => [idKorpus.get(id), d]));
  const asal = jamSekarang - (7 - i) * 3600_000 + 5 * 60_000;
  const r = await sb.rpc("record_vision_visits", { p_hours: rekapJam(k, asal), p_key: `promo-bu-sari-${nama}-${i}-${new Date(asal).toISOString().slice(0, 13)}` });
  console.log("rekap", nama, k.length, r.error?.message ?? JSON.stringify(r.data));
}
writeFileSync(join(import.meta.dirname, "..", "test-results", "promo-bu-sari.json"), JSON.stringify({ usaha: usaha.id, invoice: inv }, null, 1));
await b.close();
