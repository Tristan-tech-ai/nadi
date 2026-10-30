import { anonRpc, resourceMcp, urlPrm } from "@/lib/mcp/http";
import { tangani } from "@/lib/mcp/protokol";

export const maxDuration = 60;

const tanpaSimpan = { "Cache-Control": "no-store" };

function tantangan(h: Headers, scope: string, galat?: string) {
  return `Bearer resource_metadata="${urlPrm(h)}", scope="${scope}"${galat ? `, error="${galat}"` : ""}`;
}

// MCP Streamable HTTP tanpa sesi (spesifikasi 2026-07-28, juga melayani klien era initialize). docs/research/mcp.md
export async function POST(req: Request) {
  const h = req.headers;
  // Cegah DNS rebinding: Origin asing ditolak (klien MCP server-ke-server tidak mengirim Origin).
  const origin = h.get("origin");
  if (origin) {
    let sama = false;
    try {
      sama = new URL(origin).host === (h.get("x-forwarded-host") ?? h.get("host"));
    } catch {}
    if (!sama) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Origin tidak diizinkan" } }, { status: 403, headers: tanpaSimpan });
  }
  const token = (h.get("authorization") ?? "").match(/^Bearer\s+(nmc_[a-f0-9]{64})$/i)?.[1];
  if (!token) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Butuh izin. Sambungkan Nadi lewat OAuth." } },
      { status: 401, headers: { ...tanpaSimpan, "WWW-Authenticate": tantangan(h, "nadi.baca") } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON tidak valid" } }, { status: 400, headers: tanpaSimpan });
  }
  const j = await tangani(h, body, anonRpc, token, resourceMcp(h));
  const kepala: Record<string, string> = { ...tanpaSimpan };
  if (j.galatAuth === "token") kepala["WWW-Authenticate"] = tantangan(h, "nadi.baca", "invalid_token");
  if (j.galatAuth === "cakupan") kepala["WWW-Authenticate"] = tantangan(h, `nadi.baca ${j.cakupanPerlu}`, "insufficient_scope");
  if (j.body === undefined) return new Response(null, { status: j.status, headers: kepala });
  return Response.json(j.body, { status: j.status, headers: kepala });
}

// Revisi 2026-07-28 menghapus aliran GET dan sesi (DELETE).
export function GET() {
  return new Response("Nadi MCP: pakai POST (Streamable HTTP).", { status: 405, headers: { Allow: "POST", ...tanpaSimpan } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST", ...tanpaSimpan } });
}
