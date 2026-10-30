// Edge Function `push`: mengirim Web Push ke perangkat pengguna yang memanggil.
// Kunci VAPID dibuat di sini saat pertama dipakai dan disimpan di Vault; tidak pernah keluar dari server.
// Aksi: { aksi: "siapkan" } memastikan kunci ada dan mengembalikan kunci publik;
//       { aksi: "uji" } mengirim pemberitahuan uji ke semua langganan milik pemanggil.
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ galat: "Pakai POST" }, 405);
  const otorisasi = req.headers.get("Authorization");
  if (!otorisasi) return json({ galat: "Masuk dulu" }, 401);

  // Klien atas nama pemanggil: RLS membatasi ke langganan miliknya di perusahaan aktif.
  const pengguna = createClient(URL_SUPABASE, kunciPublikSupabase(), {
    global: { headers: { Authorization: otorisasi } },
    auth: { persistSession: false },
  });
  const { data: siapa, error: eSiapa } = await pengguna.auth.getUser();
  if (eSiapa || !siapa.user) return json({ galat: "Sesi tidak sah" }, 401);

  const { aksi } = await req.json().catch(() => ({ aksi: null }));
  const kunci = await siapkan(admin());

  if (aksi === "siapkan") return json({ publik: kunci.publik });

  if (aksi === "uji") {
    const { data: langganan, error } = await pengguna.from("langganan_push").select("id, endpoint, p256dh, auth");
    if (error) return json({ galat: error.message }, 400);
    const pesan = JSON.stringify({
      judul: "Pemberitahuan Nadi menyala",
      isi: "Mulai sekarang usulan yang perlu keputusanmu muncul di sini.",
      tautan: "/app",
    });
    let terkirim = 0;
    const gagal: number[] = [];
    for (const l of langganan ?? []) {
      try {
        await kunci.server.subscribe({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } })
          .pushTextMessage(pesan, { ttl: 600 });
        terkirim++;
      } catch (e) {
        const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
        gagal.push(status);
        // 404/410: langganan sudah mati di layanan push, hapus agar tidak dicoba lagi.
        if (status === 404 || status === 410) await pengguna.from("langganan_push").delete().eq("id", l.id);
      }
    }
    return json({ terkirim, gagal });
  }

  return json({ galat: "Aksi tidak dikenal" }, 400);
});
