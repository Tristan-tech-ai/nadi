import { CORS, anonRpc } from "@/lib/mcp/http";

// Pendaftaran klien dinamis (RFC 7591). Usang di MCP 2026-07-28, dipertahankan untuk klien lama.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
  const uris = Array.isArray(b?.redirect_uris) ? b.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  try {
    const r = (await anonRpc("oauth_daftar", { p_nama: typeof b?.client_name === "string" ? b.client_name : "", p_redirects: uris })) as { error?: string };
    return Response.json(r, { status: r.error ? 400 : 201, headers: CORS });
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400, headers: CORS });
  }
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
