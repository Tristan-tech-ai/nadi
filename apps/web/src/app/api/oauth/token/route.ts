import { CORS, anonRpc, bacaForm } from "@/lib/mcp/http";

// Titik token OAuth 2.1: authorization_code (PKCE S256) dan refresh_token (rotasi). Klien publik, tanpa rahasia klien.
export async function POST(req: Request) {
  const p = await bacaForm(req);
  const tolak = (error: string, status = 400) => Response.json({ error }, { status, headers: CORS });
  let r: { error?: string } & Record<string, unknown>;
  try {
    if (p.grant_type === "authorization_code") {
      r = (await anonRpc("oauth_tukar", { p_kode: p.code ?? "", p_client: p.client_id ?? "", p_redirect: p.redirect_uri ?? "", p_verifier: p.code_verifier ?? "", p_resource: p.resource || null })) as typeof r;
    } else if (p.grant_type === "refresh_token") {
      r = (await anonRpc("oauth_segarkan", { p_segar: p.refresh_token ?? "", p_client: p.client_id ?? "", p_resource: p.resource || null })) as typeof r;
    } else {
      return tolak("unsupported_grant_type");
    }
  } catch {
    return tolak("invalid_grant");
  }
  if (r.error) return Response.json(r, { status: 400, headers: CORS });
  return Response.json(r, { headers: CORS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
