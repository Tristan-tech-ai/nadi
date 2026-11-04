// Protokol MCP Nadi (docs/research/mcp.md): JSON-RPC tanpa sesi, dua era.
// Modern (2026-07-28): versi dan identitas klien di `_meta` setiap permintaan, header dicerminkan dan wajib cocok.
// Lama (2025-xx): jabat tangan `initialize`; dilayani tanpa sesi (tidak mencetak Mcp-Session-Id).
// Murni: akses database lewat `rpc` yang disuntikkan, jadi bisa diuji tanpa jaringan.
import { createHash } from "node:crypto";
import { PROMPT_ONBOARDING } from "@/lib/onboarding/prompt";
import { uraiTeksNadi } from "@/lib/onboarding/teks-nadi";
import { kontenSkill, type BahasaSkill } from "@/lib/skill/umum";

export const VERSI_MODERN = "2026-07-28";
export const VERSI_LAMA = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const VERSI_DIDUKUNG = [VERSI_MODERN, ...VERSI_LAMA];
const META = "io.modelcontextprotocol/";

export class RpcGalat extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export type Rpc = (fungsi: string, param: Record<string, unknown>) => Promise<unknown>;
export type Jawaban = { status: number; body?: unknown; galatAuth?: "token" | "cakupan"; cakupanPerlu?: string };

type Pesan = { jsonrpc?: unknown; id?: string | number | null; method?: unknown; params?: Record<string, unknown> };
type Siapa = { peran: string; cakupan: string[]; usaha: { nama: string } };

const INSTRUKSI =
  "Nadi: sistem kerja usaha (orang, usulan, uang, absen). Mulai dengan siapa_saya untuk melihat usaha, peran, dan izin token. " +
  "Semua perubahan dari asisten AI menjadi usulan lewat buat_usulan atau usul_onboarding (menyiapkan usaha dari dokumen pengguna) dan baru berlaku setelah disetujui pemilik atau admin di aplikasi Nadi. " +
  "Rupiah ditulis sebagai angka utuh, tanggal YYYY-MM-DD. " +
  "Cara memakai Nadi selengkapnya (peta fitur, kosakata, onboarding, aturan aman, contoh per peran) ada di sumber nadi://skill; bahasa Inggris: nadi://skill/en.";
const INFO = { name: "nadi", title: "Nadi", version: "0.9.1" };
const KAPABILITAS = { tools: { listChanged: false }, resources: {}, prompts: { listChanged: false } };

type Alat = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
  cakupan: "nadi.baca" | "nadi.usul";
  pengelola?: boolean;
  fungsi: string;
  param: (a: Record<string, unknown>) => Record<string, unknown>;
  bungkus?: string;
  /** Tambahan untuk hasil alat (mis. baris cetak biru yang ditolak) dihitung dari argumen. */
  tambahan?: (a: Record<string, unknown>) => Record<string, unknown>;
};

// Tanggal "hari ini" paling timur di Indonesia, supaya tanggal mulai hari ini di WIT tidak dianggap masa depan.
const hariIniTimur = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura" }).format(new Date());
const ALASAN_TOLAK: Record<string, string> = { nik: "berisi NIK atau nomor panjang", uang: "berisi angka uang atau gaji", perintah: "berisi perintah, bukan data",
  nama: "nama tidak sah", tanggal: "tanggal bukan YYYY-MM-DD atau di masa depan", tak_dikenal: "baris tidak dikenal", negara: "negara belum didukung",
  fitur: "fitur tidak dikenal", izin: "aturan izin tidak dipahami atau di luar batas", terlalu_banyak: "lebih dari 60 orang", kosong: "teks kosong",
  json: "JSON rusak", tanpa_kepala: "baris pertama harus NADI ONBOARDING 1" };
function cetakBiru(a: Record<string, unknown>) {
  const h = uraiTeksNadi(String(a.teks ?? ""), hariIniTimur());
  const ditolak = h.baris.filter((b) => !b.dikenali).map((b) => ({ baris: b.no, teks: b.teks.slice(0, 120), alasan: ALASAN_TOLAK[b.alasan ?? ""] ?? b.alasan }));
  return { h, ditolak };
}

const objek = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false,
});

export const ALAT: Alat[] = [
  {
    name: "siapa_saya", title: "Siapa saya", cakupan: "nadi.baca", fungsi: "mcp_siapa_saya",
    description: "Usaha yang tersambung, peran pengguna, izin token (cakupan), jumlah orang aktif, dan jumlah usulan yang menunggu keputusan.",
    inputSchema: objek({}), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    param: () => ({}),
  },
  {
    name: "daftar_orang", title: "Daftar orang", cakupan: "nadi.baca", pengelola: true, fungsi: "mcp_daftar_orang", bungkus: "orang",
    description: "Orang di usaha ini (karyawan, kandidat) dengan ID staf, status, dan jabatan. Tanpa NIK dan gaji. Hanya untuk pemilik dan admin.",
    inputSchema: objek({
      cari: { type: "string", description: "Potongan nama, tidak peka huruf besar" },
      batas: { type: "integer", minimum: 1, maximum: 200, description: "Jumlah maksimal, bawaan 50" },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    param: (a) => ({ p_cari: a.cari ?? null, p_batas: a.batas ?? 50 }),
  },
  {
    name: "daftar_usulan", title: "Daftar usulan", cakupan: "nadi.baca", fungsi: "mcp_daftar_usulan", bungkus: "usulan",
    description: "Usulan terbaru di Feed Nadi (dari Lempar Saja, aturan, atau asisten AI) beserta dampak rupiahnya.",
    inputSchema: objek({
      status: { type: "string", enum: ["menunggu", "diterima", "ditolak"], description: "Bawaan menunggu" },
      batas: { type: "integer", minimum: 1, maximum: 100, description: "Jumlah maksimal, bawaan 20" },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    param: (a) => ({ p_status: a.status ?? "menunggu", p_batas: a.batas ?? 20 }),
  },
  {
    name: "ringkasan_ai", title: "Ringkasan pemakaian AI", cakupan: "nadi.baca", pengelola: true, fungsi: "mcp_ringkasan_ai",
    description: "Pemakaian AI Nadi untuk usaha ini: berkas dibaca model vs dibaca aturan tersimpan (tanpa token), token terpakai, dan perkiraan token yang dihemat. Hanya untuk pemilik dan admin.",
    inputSchema: objek({ hari: { type: "integer", minimum: 1, maximum: 365, description: "Jendela waktu dalam hari, bawaan 30" } }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    param: (a) => ({ p_hari: a.hari ?? 30 }),
  },
  {
    name: "buat_usulan", title: "Buat usulan", cakupan: "nadi.usul", fungsi: "mcp_buat_usulan",
    description:
      "Ajukan perubahan ke Nadi sebagai usulan yang harus disetujui pemilik atau admin. Aksi: orang.buat (bidang: nama, jabatan, telepon), " +
      "uang.keluar (bidang: tanggal, pemasok, keterangan; isi dampak_rp), izin.sakit (bidang: nama, mulai YYYY-MM-DD, lama_hari), catatan (bidang: isi). Jangan kirim NIK.",
    inputSchema: objek({
      aksi: { type: "string", enum: ["orang.buat", "uang.keluar", "izin.sakit", "catatan"] },
      judul: { type: "string", minLength: 3, maxLength: 140, description: "Kalimat pendek diawali kata kerja, mis. Tambah Budi sebagai kasir" },
      penjelasan: { type: "string", maxLength: 1000, description: "Alasan dan sumber informasinya" },
      bidang: { type: "object", description: "Data untuk aksi itu" },
      dampak_rp: { type: "number", minimum: 0, description: "Nilai rupiah utuh bila ada" },
    }, ["aksi", "judul", "bidang"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    param: (a) => ({ p_aksi: a.aksi, p_judul: a.judul, p_penjelasan: a.penjelasan ?? null, p_bidang: a.bidang ?? {}, p_dampak_rp: a.dampak_rp ?? null }),
  },
  {
    name: "usul_onboarding", title: "Siapkan usaha dari dokumen", cakupan: "nadi.usul", fungsi: "mcp_usul_onboarding",
    description:
      "Siapkan usaha di Nadi dari dokumen pengguna (daftar karyawan, struktur, aturan kerja) dengan mengirim Teks Nadi: baris pertama NADI ONBOARDING 1, " +
      "lalu USAHA, JENIS, KOTA | NEGARA | ORANG | CABANG, ORANG: (satu orang per baris: - nama | peran kerja | mulai YYYY-MM-DD), FITUR, ATURAN IZIN. " +
      "JSON setara juga diterima. Setiap baris menjadi usulan di Feed yang harus disetujui pemilik atau admin. Jangan menulis gaji, nominal uang, rekening, atau NIK: baris seperti itu ditolak. " +
      "Hasil menyebut jumlah usulan dan baris yang ditolak beserta alasannya.",
    inputSchema: objek({
      teks: { type: "string", minLength: 18, maxLength: 20000, description: "Teks Nadi (atau JSON dengan nadi_onboarding: 1)" },
      kunci: { type: "string", minLength: 8, maxLength: 100, description: "Opsional. Kunci yang sama tidak menggandakan usulan; bawaan dihitung dari teks." },
    }, ["teks"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    param: (a) => {
      const { h, ditolak } = cetakBiru(a);
      if (h.galat || !h.butir.length) {
        const sebab = h.galat ? (ALASAN_TOLAK[h.galat] ?? h.galat) : ditolak.map((d) => `baris ${d.baris}: ${d.alasan}`).join("; ");
        throw new RpcGalat(`Tidak ada baris yang bisa dijadikan usulan. ${sebab}`.slice(0, 480), "22023");
      }
      const kunci = typeof a.kunci === "string" && a.kunci.length >= 8 ? a.kunci : createHash("sha256").update(String(a.teks)).digest("hex").slice(0, 40);
      return { p_butir: h.butir, p_kunci: kunci };
    },
    tambahan: (a) => ({ ditolak: cetakBiru(a).ditolak }),
  },
];

/** Daftar alat untuk pemanggil ini: alat pengelola disembunyikan dari staf, alat tulis dari token tanpa nadi.usul. Urutan tetap. */
export function daftarAlat(siapa: Pick<Siapa, "peran" | "cakupan">) {
  return ALAT.filter((t) => siapa.cakupan.includes(t.cakupan) && (!t.pengelola || ["pemilik", "admin"].includes(siapa.peran)))
    .map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }));
}

type Sumber = { uri: string; name: string; title: string; description: string; pengelola?: boolean; fungsi: string; param: Record<string, unknown>; skill?: BahasaSkill };

/** Resources: paket konteks ringkas (hemat token) yang bisa dipilih pengguna untuk dimasukkan ke percakapan. */
export const SUMBER: Sumber[] = [
  { uri: "nadi://usaha", name: "usaha", title: "Usaha dan peranmu", description: "Nama usaha, peran, izin token, jumlah orang aktif, dan usulan menunggu.", fungsi: "mcp_siapa_saya", param: {} },
  { uri: "nadi://usulan/menunggu", name: "usulan-menunggu", title: "Usulan yang menunggu", description: "Usulan di Feed yang belum diputuskan.", fungsi: "mcp_daftar_usulan", param: { p_status: "menunggu", p_batas: 50 } },
  { uri: "nadi://orang", name: "orang", title: "Daftar orang", description: "Orang di usaha ini tanpa NIK dan gaji.", pengelola: true, fungsi: "mcp_daftar_orang", param: { p_cari: null, p_batas: 200 } },
  // W-05: skill umum Nadi, isinya sama persis dengan unduhan /skill?bahasa=id|en (src/lib/skill/umum.ts).
  { uri: "nadi://skill", name: "skill", title: "Skill Nadi", description: "Cara memakai Nadi: peta fitur, kosakata, alur onboarding, aturan aman, contoh per peran.", fungsi: "mcp_siapa_saya", param: {}, skill: "id" },
  { uri: "nadi://skill/en", name: "skill-en", title: "Nadi skill (English)", description: "How to use Nadi: feature map, vocabulary, onboarding, safety rules, examples per role.", fungsi: "mcp_siapa_saya", param: {}, skill: "en" },
];

type Arg = { name: string; description: string; required: boolean };
type Prompt = { name: string; title: string; description: string; arguments: Arg[]; cakupan: "nadi.baca" | "nadi.usul"; teks: (a: Record<string, string>) => string };

/** Prompts: alur kerja siap pakai yang dipilih pengguna (mis. sebagai perintah garis miring). */
export const PROMPT: Prompt[] = [
  {
    name: "tutup_hari", title: "Tutup hari", cakupan: "nadi.baca", arguments: [],
    description: "Ringkas yang perlu diputuskan hari ini di Nadi.",
    teks: () => "Pakai alat Nadi. Panggil siapa_saya lalu daftar_usulan (status menunggu). Tulis ringkasan singkat dalam bahasa Indonesia: berapa usulan menunggu, tiga yang dampak rupiahnya paling besar, dan mana yang sebaiknya diputuskan hari ini. Jangan mengubah apa pun.",
  },
  {
    name: "catat_dari_catatan", title: "Ubah catatan jadi usulan", cakupan: "nadi.usul",
    arguments: [{ name: "catatan", description: "Catatan bebas, mis. hasil obrolan dengan karyawan atau pemasok", required: true }],
    description: "Ubah catatan bebas menjadi usulan Nadi yang menunggu persetujuan.",
    teks: (a) => `Ubah catatan berikut menjadi usulan Nadi lewat alat buat_usulan. Satu usulan per hal yang perlu dicatat, aksi dipilih dari orang.buat, uang.keluar, izin.sakit, atau catatan. Judul diawali kata kerja, rupiah sebagai angka utuh, tanggal YYYY-MM-DD, tanpa NIK. Sebutkan usulan apa saja yang kamu buat.\n\nCatatan:\n${a.catatan}`,
  },
  {
    name: "siapkan_usaha", title: "Siapkan usaha dari dokumen", cakupan: "nadi.usul", arguments: [],
    description: "Baca dokumen usahamu (daftar karyawan, aturan kerja) lalu siapkan Nadi lewat usulan yang kamu setujui.",
    teks: () => `${PROMPT_ONBOARDING}

Setelah blok selesai, kirim isinya ke alat usul_onboarding (argumen teks), lalu sebutkan berapa usulan dibuat dan baris mana yang ditolak beserta alasannya. Ingatkan saya membuka Feed Nadi untuk menyetujui.`,
  },
];

const pengelola = (peran: string) => ["pemilik", "admin"].includes(peran);
export const daftarSumber = (s: Pick<Siapa, "peran">) =>
  SUMBER.filter((x) => !x.pengelola || pengelola(s.peran)).map(({ uri, name, title, description, skill }) => ({ uri, name, title, description, mimeType: skill ? "text/markdown" : "application/json" }));
export const daftarPrompt = (s: Pick<Siapa, "cakupan">) =>
  PROMPT.filter((x) => s.cakupan.includes(x.cakupan)).map(({ name, title, description, arguments: args }) => ({ name, title, description, arguments: args }));

/** Nilai header yang boleh dikodekan `=?base64?...?=` (Mcp-Name, Mcp-Param-*). */
export function bacaNilaiHeader(v: string | null): string | null {
  if (v === null) return null;
  const m = v.match(/^=\?base64\?([A-Za-z0-9+/=]*)\?=$/);
  if (!m) return v;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

const galat = (id: Pesan["id"], code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });
const hasil = (id: Pesan["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });

/** Tangani satu pesan JSON-RPC. `token` sudah dipastikan ada oleh route; keabsahannya diperiksa database. */
export async function tangani(h: Headers, body: unknown, rpc: Rpc, token: string, resource: string): Promise<Jawaban> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, body: galat(null, -32600, "Kirim satu pesan JSON-RPC per POST") };
  const m = body as Pesan;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return { status: 400, body: galat(m.id, -32600, "Permintaan JSON-RPC tidak valid") };
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;
  const meta = (params._meta && typeof params._meta === "object" ? params._meta : {}) as Record<string, unknown>;
  const versiMeta = meta[META + "protocolVersion"];
  const versiHeader = h.get("mcp-protocol-version");
  const modern = typeof versiMeta === "string" || versiHeader === VERSI_MODERN;

  if (modern) {
    // Validasi header terhadap body (spesifikasi: 400 + -32020 HeaderMismatch).
    if (typeof versiMeta !== "string" || versiHeader !== versiMeta) return { status: 400, body: galat(m.id, -32020, "Header MCP-Protocol-Version tidak sama dengan _meta protocolVersion") };
    if (versiMeta !== VERSI_MODERN) {
      return { status: 400, body: galat(m.id, -32022, "Unsupported protocol version", { supported: VERSI_DIDUKUNG, requested: versiMeta }) };
    }
    if (h.get("mcp-method") !== m.method) return { status: 400, body: galat(m.id, -32020, "Header Mcp-Method tidak sama dengan method") };
    if (["tools/call", "resources/read", "prompts/get"].includes(m.method)) {
      const nama = m.method === "resources/read" ? params.uri : params.name;
      if (typeof nama !== "string" || bacaNilaiHeader(h.get("mcp-name")) !== nama) return { status: 400, body: galat(m.id, -32020, "Header Mcp-Name tidak sama dengan nama di body") };
    }
  } else if (versiHeader !== null && !VERSI_DIDUKUNG.includes(versiHeader)) {
    return { status: 400, body: galat(m.id, -32022, "Unsupported protocol version", { supported: VERSI_DIDUKUNG, requested: versiHeader }) };
  }

  if (m.id === undefined) return { status: 202 }; // notifikasi (mis. notifications/initialized era lama)
  const selesai = (r: Record<string, unknown>) => ({ status: 200, body: hasil(m.id, modern ? { resultType: "complete", ...r } : r) });

  try {
    switch (m.method) {
      case "server/discover": {
        if (!modern) break;
        await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource });
        return selesai({
          supportedVersions: VERSI_DIDUKUNG, capabilities: KAPABILITAS,
          _meta: { [META + "serverInfo"]: INFO }, instructions: INSTRUKSI, ttlMs: 3_600_000, cacheScope: "public",
        });
      }
      case "initialize": {
        if (modern) break;
        await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource });
        const minta = String(params.protocolVersion ?? "");
        return selesai({ protocolVersion: (VERSI_LAMA as readonly string[]).includes(minta) ? minta : VERSI_LAMA[0], capabilities: KAPABILITAS, serverInfo: INFO, instructions: INSTRUKSI });
      }
      case "ping":
        return selesai({});
      case "tools/list": {
        const s = (await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource })) as Siapa;
        // Daftar berbeda per peran dan cakupan, jadi tembolok hanya untuk pemanggil ini.
        return selesai({ tools: daftarAlat(s), ...(modern ? { ttlMs: 300_000, cacheScope: "private" } : {}) });
      }
      case "resources/list": {
        const s = (await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource })) as Siapa;
        return selesai({ resources: daftarSumber(s), ...(modern ? { ttlMs: 300_000, cacheScope: "private" } : {}) });
      }
      case "resources/read": {
        const sb = SUMBER.find((x) => x.uri === params.uri);
        if (!sb) return { status: 200, body: galat(m.id, -32602, "Resource not found", { uri: params.uri }) };
        if (sb.skill) {
          // Token tetap diperiksa, tetapi isinya sama untuk semua usaha (tidak ada data usaha di skill umum).
          await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource });
          return selesai({ contents: kontenSkill(sb.skill, resource), ...(modern ? { ttlMs: 3_600_000, cacheScope: "public" } : {}) });
        }
        try {
          const isi = await rpc(sb.fungsi, { p_token: token, p_resource: resource, ...sb.param });
          return selesai({ contents: [{ uri: sb.uri, mimeType: "application/json", text: JSON.stringify(isi) }], ...(modern ? { ttlMs: 60_000, cacheScope: "private" } : {}) });
        } catch (e) {
          if (e instanceof RpcGalat && e.code === "P0403") return { status: 200, body: galat(m.id, -32602, e.message, { uri: sb.uri }) };
          throw e;
        }
      }
      case "prompts/list": {
        const s = (await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource })) as Siapa;
        return selesai({ prompts: daftarPrompt(s), ...(modern ? { ttlMs: 600_000, cacheScope: "private" } : {}) });
      }
      case "prompts/get": {
        const pr = PROMPT.find((x) => x.name === params.name);
        if (!pr) return { status: 200, body: galat(m.id, -32602, `Prompt tidak dikenal: ${String(params.name)}`) };
        const a = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, string>;
        const kurang = pr.arguments.filter((x) => x.required && !String(a[x.name] ?? "").trim()).map((x) => x.name);
        if (kurang.length) return { status: 200, body: galat(m.id, -32602, `Argumen wajib belum diisi: ${kurang.join(", ")}`) };
        await rpc("mcp_siapa_saya", { p_token: token, p_resource: resource });
        return selesai({ description: pr.description, messages: [{ role: "user", content: { type: "text", text: pr.teks(a) } }] });
      }
      case "tools/call": {
        const alat = ALAT.find((t) => t.name === params.name);
        if (!alat) return { status: 200, body: galat(m.id, -32602, `Alat tidak dikenal: ${String(params.name)}`) };
        const a = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
        try {
          const keluar = await rpc(alat.fungsi, { p_token: token, p_resource: resource, ...alat.param(a) });
          const dasar = alat.bungkus ? { [alat.bungkus]: keluar } : keluar;
          const terstruktur = alat.tambahan && dasar && typeof dasar === "object" ? { ...(dasar as Record<string, unknown>), ...alat.tambahan(a) } : dasar;
          return selesai({ content: [{ type: "text", text: JSON.stringify(terstruktur) }], structuredContent: terstruktur, isError: false });
        } catch (e) {
          if (!(e instanceof RpcGalat)) throw e;
          if (e.code === "P0401") throw e;
          if (e.code === "P0403" && /cakupan/.test(e.message)) return { status: 403, galatAuth: "cakupan", cakupanPerlu: alat.cakupan, body: galat(m.id, -32001, e.message) };
          // Galat yang bisa diperbaiki model (isian salah, peran, batas laju) dikembalikan sebagai hasil alat.
          return selesai({ content: [{ type: "text", text: e.message.slice(0, 500) }], isError: true });
        }
      }
    }
    return modern ? { status: 404, body: galat(m.id, -32601, `Metode tidak dikenal: ${m.method}`) } : { status: 200, body: galat(m.id, -32601, `Metode tidak dikenal: ${m.method}`) };
  } catch (e) {
    if (e instanceof RpcGalat && e.code === "P0401") return { status: 401, galatAuth: "token", body: galat(m.id, -32001, "Token tidak sah atau kedaluwarsa. Sambungkan ulang Nadi.") };
    throw e;
  }
}
