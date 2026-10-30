import { CAKUPAN, CORS, asal, resourceMcp } from "@/lib/mcp/http";

// RFC 9728: metadata sumber daya terlindungi untuk server MCP di /api/mcp.
export function prm(req: Request) {
  const h = req.headers;
  return Response.json({
    resource: resourceMcp(h), authorization_servers: [asal(h)], scopes_supported: CAKUPAN,
    bearer_methods_supported: ["header"], resource_name: "Nadi",
  }, { headers: CORS });
}
