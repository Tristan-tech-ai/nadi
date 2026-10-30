import { readPublicEnv } from "@/lib/env";
import { RpcGalat } from "./protokol";

// Asal situs dari header permintaan (Vercel meneruskan x-forwarded-*). Huruf kecil, tanpa garis miring akhir.
export function asal(h: Headers): string {
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim().toLowerCase();
  const lokal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = (h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (lokal ? "http" : "https")).toLowerCase();
  return `${proto}://${host}`;
}

/** URI kanonis server MCP (RFC 8707 `resource`), dipakai sebagai audiens token. */
export const resourceMcp = (h: Headers) => `${asal(h)}/api/mcp`;
export const urlPrm = (h: Headers) => `${asal(h)}/.well-known/oauth-protected-resource/api/mcp`;
export const CAKUPAN = ["nadi.baca", "nadi.usul"] as const;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Cache-Control": "no-store",
} as const;

/** Panggil RPC Supabase sebagai anon (tanpa cookie): untuk klien MCP dan titik token yang membawa kredensial sendiri. */
export async function anonRpc(fungsi: string, param: Record<string, unknown>): Promise<unknown> {
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${fungsi}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${supabasePublishableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(param),
  });
  const isi = (await r.json().catch(() => null)) as { message?: string; code?: string } | null;
  if (!r.ok) throw new RpcGalat(isi?.message ?? `RPC ${fungsi} gagal (${r.status})`, isi?.code);
  return isi;
}

/** Body form-urlencoded atau JSON (titik token OAuth). */
export async function bacaForm(req: Request): Promise<Record<string, string>> {
  const jenis = req.headers.get("content-type") ?? "";
  try {
    if (jenis.includes("application/json")) return Object.fromEntries(Object.entries((await req.json()) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    return Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return {};
  }
}
