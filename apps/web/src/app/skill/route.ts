import { headers } from "next/headers";
import { resourceMcp } from "@/lib/mcp/http";
import { periksaSkill, zipSkill } from "@/lib/skill/paket";
import { skillUmum } from "@/lib/skill/umum";

// W-05: unduhan skill umum Nadi (zip berformat Agent Skills) untuk asisten AI pengguna, tanpa masuk karena tidak berisi data usaha.
// Isinya sama dengan sumber MCP nadi://skill (bahasa=en: nadi://skill/en). Paket per usaha tetap di /app/skill.
export async function GET(req: Request) {
  const bahasa = new URL(req.url).searchParams.get("bahasa") === "en" ? "en" : "id";
  const paket = skillUmum(bahasa, resourceMcp(await headers()));
  const masalah = periksaSkill(paket.nama, paket.berkas["SKILL.md"]);
  if (masalah.length) return new Response(masalah.join("; "), { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(zipSkill(paket) as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${paket.nama}${bahasa === "en" ? "-en" : ""}.zip"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
