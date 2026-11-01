// Edge Function `push`: mengirim Web Push ke perangkat pengguna yang memanggil.
// Kunci VAPID dibuat di sini saat pertama dipakai dan disimpan di Vault; tidak pernah keluar dari server.
// Aksi: { aksi: "siapkan" } memastikan kunci ada dan mengembalikan kunci publik;
//       { aksi: "uji" } mengirim pemberitahuan uji ke semua langganan milik pemanggil;
//       { aksi: "usulan", perusahaan_id, jumlah, judul } dari database (pg_cron + pg_net, header x-nadi-token dari Vault)
//       mengabari pemilik/admin usaha itu bahwa ada usulan menunggu;
//       { aksi: "sarapan", perusahaan_id, judul, isi } dari app.kirim_sarapan mengirim Sarapan Data pagi ke pemilik/admin.
//       Fungsi ini di-deploy tanpa verify_jwt dan memeriksa sendiri.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const KONTAK = Deno.env.get("NADI_PUSH_KONTAK") ?? "https://nadi-well-13fd.vercel.app";

function kunciRahasia(): string {
  const baru = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function kunciPublikSupabase(): string {
  const baru = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (baru) return JSON.parse(baru)["default"];
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}

const admin = () => createClient(URL_SUPABASE, kunciRahasia(), { auth: { persistSession: false } });

let server: webpush.ApplicationServer | null = null;
let publik: string | null = null;

async function siapkan(db: SupabaseClient): Promise<{ server: webpush.ApplicationServer; publik: string }> {
  if (server && publik) return { server, publik };
  const { data: tersimpan, error } = await db.rpc("vapid_ambil");
  if (error) throw new Error(`vapid_ambil: ${error.message}`);
  let jwk: webpush.ExportedVapidKeys;
  if (tersimpan) {
    jwk = JSON.parse(tersimpan);
  } else {
    const kunci = await webpush.generateVapidKeys({ extractable: true });
    jwk = await webpush.exportVapidKeys(kunci);
    const { error: e2 } = await db.rpc("vapid_simpan", {
      p_publik: await webpush.exportApplicationServerKey(kunci),
      p_jwk: JSON.stringify(jwk),
    });
    if (e2) throw new Error(`vapid_simpan: ${e2.message}`);
    // Bila ada pemanggil lain yang lebih dulu menyimpan, pakai kunci miliknya.
    const { data: ulang } = await db.rpc("vapid_ambil");
    jwk = JSON.parse(ulang);
  }
  const vapidKeys = await webpush.importVapidKeys(jwk, { extractable: false });
  server = await webpush.ApplicationServer.new({ contactInformation: KONTAK, vapidKeys });
  publik = await webpush.exportApplicationServerKey(vapidKeys);
  return { server, publik };
}

function json(isi: unknown, status = 200) {
  return new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json" } });
}

type Langganan = { id: string; endpoint: string; p256dh: string; auth: string };

/** Kirim satu pesan ke daftar langganan; langganan mati (404/410) dihapus lewat `hapus`. */
async function kirim(server: webpush.ApplicationServer, daftar: Langganan[], pesan: string, hapus: (id: string) => Promise<unknown>) {
  let terkirim = 0;
  const gagal: number[] = [];
  for (const l of daftar) {
    try {
      await server.subscribe({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }).pushTextMessage(pesan, { ttl: 3600 });
      terkirim++;
    } catch (e) {
      const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
      gagal.push(status);
      if (status === 404 || status === 410) await hapus(l.id);
    }
  }
  return { terkirim, gagal };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const isi = await req.json().catch(() => ({}));

  // Panggilan dari database: token acak di Vault, dicocokkan lewat RPC khusus peran layanan.
  const token = req.headers.get("x-nadi-token");
  if (token) {
    const db = admin();
    const { data: cocok } = await db.rpc("push_token_cocok", { p_token: token });
    if (!cocok) return json({ galat: "Token tidak sah" }, 401);
    if ((isi.aksi !== "usulan" && isi.aksi !== "sarapan") || typeof isi.perusahaan_id !== "string") return json({ galat: "Aksi tidak dikenal" }, 400);
    const kunci = await siapkan(db);
    const { data: target } = await db.rpc("target_push", { p_perusahaan: isi.perusahaan_id, p_peran: ["pemilik", "admin"] });
    const jumlah = Number(isi.jumlah) || 1;
    const pesan = isi.aksi === "sarapan"
      ? JSON.stringify({ judul: String(isi.judul ?? "Sarapan data"), isi: String(isi.isi ?? ""), tautan: "/app#sarapan" })
      : JSON.stringify({
        judul: jumlah > 1 ? `${jumlah} usulan menunggu keputusanmu` : "Usulan baru menunggu keputusanmu",
        isi: String(isi.judul ?? "Buka Feed untuk menyetujui atau menolak."),
        tautan: "/app",
      });
    return json(await kirim(kunci.server, (target ?? []) as Langganan[], pesan, (id) => db.from("langganan_push").delete().eq("id", id)));
  }

  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);

  // Klien atas nama pemanggil: RLS membatasi ke langganan miliknya di perusahaan aktif.
  const pengguna = createClient(URL_SUPABASE, kunciPublikSupabase(), {
    global: { headers: { Authorization: otorisasi } },
    auth: { persistSession: false },
  });
  const { data: siapa, error: eSiapa } = await pengguna.auth.getUser();
  if (eSiapa || !siapa.user) return json({ galat: "Sesi tidak sah" }, 401);

  const kunci = await siapkan(admin());

  if (isi.aksi === "siapkan") return json({ publik: kunci.publik });

  if (isi.aksi === "uji") {
    const { data: langganan, error } = await pengguna.from("langganan_push").select("id, endpoint, p256dh, auth");
    if (error) return json({ galat: error.message }, 400);
    const pesan = JSON.stringify({
      judul: "Pemberitahuan Nadi menyala",
      isi: "Mulai sekarang usulan yang perlu keputusanmu muncul di sini.",
      tautan: "/app",
    });
    return json(await kirim(kunci.server, langganan ?? [], pesan, (id) => pengguna.from("langganan_push").delete().eq("id", id)));
  }

  return json({ galat: "Aksi tidak dikenal" }, 400);
});
