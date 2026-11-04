import { anonRpc } from "@/lib/mcp/http";
import { RpcGalat } from "@/lib/mcp/protokol";
import { kunciKiriman, uraiKiriman } from "@/lib/pintu/urai";

// W-08: pintu masuk data per usaha. Aplikasi lain, n8n, Make, atau Zapier mengirim POST dengan Authorization: Bearer nmi_...
// Isi JSON {jenis, baris} atau CSV (?jenis=). Hasilnya SATU usulan menunggu di Feed; tidak ada yang tercatat sebelum disetujui.
// Panduan: docs/panduan/pintu-data.md. Pesan galat berbahasa Indonesia karena pembacanya pemilik usaha yang memasang alurnya.
const BATAS_BYTE = 1_000_000;
const json = (isi: unknown, status: number) =>
  new Response(JSON.stringify(isi), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const STATUS: Record<string, number> = { "28000": 401, "54000": 429, "22023": 422, "22P02": 422 };

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("nmi_")) {
    return json({ galat: "Kirim token pintu data di header Authorization: Bearer nmi_..." }, 401);
  }
  const panjang = Number(req.headers.get("content-length") ?? 0);
  if (panjang > BATAS_BYTE) return json({ galat: "Kiriman lebih dari 1 MB. Pecah jadi beberapa kiriman." }, 413);
  const isi = await req.text();
  if (isi.length > BATAS_BYTE) return json({ galat: "Kiriman lebih dari 1 MB. Pecah jadi beberapa kiriman." }, 413);
  const url = new URL(req.url);
  const h = uraiKiriman(req.headers.get("content-type") ?? "application/json", isi, url.searchParams.get("jenis"));
  if (!h.ok) return json({ galat: h.galat }, 422);
  const asal = (req.headers.get("x-nadi-asal") ?? url.searchParams.get("asal") ?? "").slice(0, 60) || null;
  try {
    const r = (await anonRpc("pintu_terima", {
      p_token: token, p_jenis: h.kiriman.jenis, p_baris: h.kiriman.baris,
      p_kunci: kunciKiriman(req.headers.get("idempotency-key"), h.kiriman), p_asal: asal,
    })) as { usulan: string; status: string; sudah: boolean; baris?: number };
    return json({ ...r, pesan: r.sudah ? "Kiriman ini sudah diterima sebelumnya." : "Diterima. Usulannya menunggu di Feed Nadi." }, r.sudah ? 200 : 201);
  } catch (e) {
    if (e instanceof RpcGalat) return json({ galat: e.message }, STATUS[e.code ?? ""] ?? 400);
    return json({ galat: "Nadi belum bisa menerima kiriman ini. Coba lagi sebentar." }, 502);
  }
}

export function GET() {
  return json({ galat: "Pakai POST. Panduan: buka Usahamu di Nadi, bagian Pintu data." }, 405);
}
