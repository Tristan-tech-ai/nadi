import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Alur lengkap seperti asisten AI pelanggan (MCP 2026-07-28): 401 -> metadata sumber daya -> metadata server otorisasi ->
// halaman izin (klien CIMD, dokumen dilayani server lokal) -> kode + iss -> token (PKCE) -> server/discover -> alat -> usulan di Feed.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");
const PORT_KLIEN = 4010;
const KLIEN = `http://localhost:${PORT_KLIEN}/klien.json`;
const KEMBALI = `http://localhost:${PORT_KLIEN}/kembali`;
const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

test.describe.configure({ mode: "serial" });

let server: Server | undefined;
test.beforeAll(async ({}, info) => {
  if (info.project.name !== "desktop") return;
  server = createServer((req, res) => {
    if (req.url === "/klien.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ client_id: KLIEN, client_name: "Asisten Uji", redirect_uris: [KEMBALI], token_endpoint_auth_method: "none" }));
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("kembali");
    }
  });
  await new Promise<void>((r) => server!.listen(PORT_KLIEN, r));
});
test.afterAll(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

const META = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "Asisten Uji", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} };

test("asisten AI menyambung lewat OAuth + CIMD, membaca, dan mengajukan usulan yang muncul di Feed", async ({ page, request, baseURL }) => {
  test.setTimeout(90_000);
  const mcp = `${baseURL}/api/mcp`;

  // 1. Tanpa token: 401 dengan petunjuk metadata.
  const awal = await request.post(mcp, { data: { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: META } }, headers: { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "server/discover" } });
  expect(awal.status()).toBe(401);
  const tantangan = awal.headers()["www-authenticate"];
  const prmUrl = tantangan.match(/resource_metadata="([^"]+)"/)?.[1];
  expect(prmUrl).toBe(`${baseURL}/.well-known/oauth-protected-resource/api/mcp`);

  // 2. Metadata sumber daya dan server otorisasi.
  const prm = await (await request.get(prmUrl!)).json();
  expect(prm).toMatchObject({ resource: mcp, authorization_servers: [baseURL] });
  const as = await (await request.get(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();
  expect(as).toMatchObject({ issuer: baseURL, client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true, code_challenge_methods_supported: ["S256"] });

  // 3. Halaman izin: masuk dulu, lalu izinkan.
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(12));
  const izin = new URL(as.authorization_endpoint);
  Object.entries({ response_type: "code", client_id: KLIEN, redirect_uri: KEMBALI, code_challenge: challenge, code_challenge_method: "S256", state, scope: "nadi.baca nadi.usul", resource: mcp })
    .forEach(([k, v]) => izin.searchParams.set(k, v));
  await page.goto(izin.toString());
  await page.waitForURL(/\/masuk/);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Izinkan Asisten Uji memakai Nadi?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`localhost:${PORT_KLIEN}`).first()).toBeVisible();
  // Gerbang UI: axe tanpa pelanggaran serius, tangkapan 390 dan 1440 px, terang dan gelap.
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400); // transisi warna tombol 150 ms selesai dulu, axe membaca warna akhir
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema} ${JSON.stringify(axe.violations.map((v) => v.nodes.map((n) => [n.target, n.failureSummary?.slice(0, 160)])))}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`izinkan-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.getByRole("button", { name: "Izinkan" }).click();
  await page.waitForURL((u) => u.toString().startsWith(KEMBALI), { timeout: 20_000 });
  const kembali = new URL(page.url());
  expect(kembali.searchParams.get("state")).toBe(state);
  expect(kembali.searchParams.get("iss")).toBe(as.issuer);
  const code = kembali.searchParams.get("code")!;

  // 4. Token dengan PKCE dan resource.
  const tok = await request.post(as.token_endpoint, { form: { grant_type: "authorization_code", code, client_id: KLIEN, redirect_uri: KEMBALI, code_verifier: verifier, resource: mcp } });
  expect(tok.status()).toBe(200);
  const t = await tok.json();
  expect(t).toMatchObject({ token_type: "Bearer", scope: "nadi.baca nadi.usul" });
  const ulang = await request.post(as.token_endpoint, { form: { grant_type: "authorization_code", code, client_id: KLIEN, redirect_uri: KEMBALI, code_verifier: verifier, resource: mcp } });
  expect(ulang.status()).toBe(400);

  const panggil = (method: string, params: Record<string, unknown> = {}, nama?: string) =>
    request.post(mcp, {
      data: { jsonrpc: "2.0", id: Date.now(), method, params: { ...params, _meta: META } },
      headers: { Authorization: `Bearer ${t.access_token}`, "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method, ...(nama ? { "Mcp-Name": nama } : {}) },
    });

  // 5. Protokol modern.
  const disc = await (await panggil("server/discover")).json();
  expect(disc.result).toMatchObject({ resultType: "complete", supportedVersions: expect.arrayContaining(["2026-07-28"]) });
  const daftar = await (await panggil("tools/list")).json();
  expect(daftar.result.tools.map((x: { name: string }) => x.name)).toEqual(["siapa_saya", "daftar_orang", "daftar_usulan", "buat_usulan"]);
  const siapa = await (await panggil("tools/call", { name: "siapa_saya", arguments: {} }, "siapa_saya")).json();
  expect(siapa.result.structuredContent).toMatchObject({ peran: "pemilik", klien: "Asisten Uji" });

  const judul = `Catat stok gula dari asisten uji ${Date.now()}`;
  const usul = await (await panggil("tools/call", { name: "buat_usulan", arguments: { aksi: "catatan", judul, penjelasan: "Dari percakapan uji otomatis", bidang: { isi: "Stok gula tinggal 2 kg" } } }, "buat_usulan")).json();
  expect(usul.result).toMatchObject({ isError: false, structuredContent: { status: "menunggu" } });

  // 6. Header tidak cocok ditolak.
  const salah = await request.post(mcp, { data: { jsonrpc: "2.0", id: 9, method: "tools/list", params: { _meta: META } }, headers: { Authorization: `Bearer ${t.access_token}`, "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call" } });
  expect(salah.status()).toBe(400);
  expect((await salah.json()).error.code).toBe(-32020);

  // 7. Usulan dari asisten muncul di Feed pemilik.
  await page.goto("/app");
  await expect(page.getByText(judul)).toBeVisible({ timeout: 15_000 });

  // 8. Token penyegar berotasi.
  const segar = await request.post(as.token_endpoint, { form: { grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: KLIEN, resource: mcp } });
  expect(segar.status()).toBe(200);
  expect((await segar.json()).access_token).not.toBe(t.access_token);
});

test("klien era initialize (lama) tetap bisa memakai alat; GET ditolak 405", async ({ request, baseURL }) => {
  const mcp = `${baseURL}/api/mcp`;
  expect((await request.get(mcp)).status()).toBe(405);
  const dcr = await request.post(`${baseURL}/api/oauth/daftar`, { data: { client_name: "Klien Lama Uji", redirect_uris: ["http://127.0.0.1:4011/cb"] } });
  expect(dcr.status()).toBe(201);
  expect((await dcr.json()).client_id).toMatch(/^nkc_/);
  const palsu = await request.post(mcp, { data: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }, headers: { Authorization: `Bearer nmc_${"0".repeat(64)}` } });
  expect(palsu.status()).toBe(401);
  expect(palsu.headers()["www-authenticate"]).toContain('error="invalid_token"');
});
