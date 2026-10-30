import { CORS } from "@/lib/mcp/http";
import { prm } from "../../prm";

export const GET = prm;
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
