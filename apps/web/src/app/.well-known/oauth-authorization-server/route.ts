import { CAKUPAN, CORS, asal } from "@/lib/mcp/http";

// RFC 8414: metadata server otorisasi. CIMD sebagai jalur utama (MCP 2026-07-28), DCR untuk klien lama, iss di respons (RFC 9207).
export function GET(req: Request) {
  const o = asal(req.headers);
  return Response.json({
    issuer: o,
    authorization_endpoint: `${o}/oauth/izinkan`,
    token_endpoint: `${o}/api/oauth/token`,
    registration_endpoint: `${o}/api/oauth/daftar`,
    scopes_supported: CAKUPAN,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }, { headers: CORS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
