import { describe, expect, it } from "vitest";
import { ALAT, RpcGalat, VERSI_MODERN, bacaNilaiHeader, daftarAlat, tangani, type Rpc } from "./protokol";

const RES = "https://nadi.uji/api/mcp";
const meta = { "io.modelcontextprotocol/protocolVersion": VERSI_MODERN, "io.modelcontextprotocol/clientInfo": { name: "Uji", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} };
const hdr = (o: Record<string, string>) => new Headers(o);
const modern = (method: string, params: Record<string, unknown> = {}, extra: Record<string, string> = {}, id: number | null = 1) => ({
  h: hdr({ "MCP-Protocol-Version": VERSI_MODERN, "Mcp-Method": method, ...extra }),
  body: { jsonrpc: "2.0", ...(id === null ? {} : { id }), method, params: { ...params, _meta: meta } },
});

function rpcPalsu(peran = "pemilik", cakupan = ["nadi.baca", "nadi.usul"]) {
  const panggilan: { fungsi: string; param: Record<string, unknown> }[] = [];
  const rpc: Rpc = async (fungsi, param) => {
    panggilan.push({ fungsi, param });
    if (param.p_token === "salah") throw new RpcGalat("Token tidak sah", "P0401");
    if (fungsi === "mcp_siapa_saya") return { peran, cakupan, usaha: { nama: "Warung Uji" } };
    if (fungsi === "mcp_daftar_orang") return [{ nama: "Sari" }];
    if (fungsi === "mcp_buat_usulan") {
      if (!cakupan.includes("nadi.usul")) throw new RpcGalat("Butuh cakupan nadi.usul", "P0403");
      if (param.p_aksi === "gaji.bayar") throw new RpcGalat("Aksi tidak dikenal", "22023");
      return { id: "u1", status: "menunggu" };
    }
    return null;
  };
  return { rpc, panggilan };
}

describe("MCP modern 2026-07-28", () => {
  it("server/discover: versi, kapabilitas, serverInfo di _meta, resultType complete", async () => {
    const { h, body } = modern("server/discover");
    const r = await tangani(h, body, rpcPalsu().rpc, "nmc_x", RES);
    expect(r.status).toBe(200);
    const res = (r.body as { result: Record<string, unknown> }).result;
    expect(res.resultType).toBe("complete");
    expect(res.supportedVersions).toContain(VERSI_MODERN);
    expect((res._meta as Record<string, unknown>)["io.modelcontextprotocol/serverInfo"]).toMatchObject({ name: "nadi" });
  });
  it("header tidak sama dengan body: 400 -32020", async () => {
    const a = modern("tools/list", {}, { "Mcp-Method": "tools/call" });
    expect((await tangani(a.h, a.body, rpcPalsu().rpc, "t", RES))).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
    const b = modern("tools/call", { name: "siapa_saya", arguments: {} }, { "Mcp-Name": "daftar_orang" });
    expect((await tangani(b.h, b.body, rpcPalsu().rpc, "t", RES))).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
    const c = modern("tools/list", {}, { "MCP-Protocol-Version": "2025-11-25" });
    expect((await tangani(c.h, c.body, rpcPalsu().rpc, "t", RES))).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
  });
  it("Mcp-Name base64 dibaca sebelum dibandingkan", async () => {
    expect(bacaNilaiHeader("=?base64?c2lhcGFfc2F5YQ==?=")).toBe("siapa_saya");
    expect(bacaNilaiHeader("biasa")).toBe("biasa");
    const a = modern("tools/call", { name: "siapa_saya", arguments: {} }, { "Mcp-Name": "=?base64?c2lhcGFfc2F5YQ==?=" });
    expect((await tangani(a.h, a.body, rpcPalsu().rpc, "t", RES)).status).toBe(200);
  });
  it("versi tak didukung: 400 -32022 dengan daftar versi", async () => {
    const h = hdr({ "MCP-Protocol-Version": "1900-01-01", "Mcp-Method": "tools/list" });
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "1900-01-01" } } };
    const r = await tangani(h, body, rpcPalsu().rpc, "t", RES);
    expect(r).toMatchObject({ status: 400, body: { error: { code: -32022, data: { requested: "1900-01-01" } } } });
  });
  it("metode tak dikenal: 404 -32601; notifikasi: 202; initialize bukan metode modern", async () => {
    const a = modern("sampling/apa");
    expect(await tangani(a.h, a.body, rpcPalsu().rpc, "t", RES)).toMatchObject({ status: 404, body: { error: { code: -32601 } } });
    const b = modern("notifications/apa", {}, {}, null);
    expect((await tangani(b.h, b.body, rpcPalsu().rpc, "t", RES)).status).toBe(202);
    const c = modern("initialize");
    expect((await tangani(c.h, c.body, rpcPalsu().rpc, "t", RES)).status).toBe(404);
  });
  it("tools/call buat_usulan memanggil RPC dengan token dan resource; galat isian jadi isError", async () => {
    const { rpc, panggilan } = rpcPalsu();
    const a = modern("tools/call", { name: "buat_usulan", arguments: { aksi: "catatan", judul: "Catat stok", bidang: { isi: "x" } } }, { "Mcp-Name": "buat_usulan" });
    const r = await tangani(a.h, a.body, rpc, "nmc_x", RES);
    expect(r.status).toBe(200);
    expect(panggilan.at(-1)).toMatchObject({ fungsi: "mcp_buat_usulan", param: { p_token: "nmc_x", p_resource: RES, p_aksi: "catatan" } });
    expect((r.body as { result: { structuredContent: unknown } }).result.structuredContent).toEqual({ id: "u1", status: "menunggu" });
    const b = modern("tools/call", { name: "buat_usulan", arguments: { aksi: "gaji.bayar", judul: "Bayar", bidang: {} } }, { "Mcp-Name": "buat_usulan" });
    expect(await tangani(b.h, b.body, rpc, "nmc_x", RES)).toMatchObject({ status: 200, body: { result: { isError: true } } });
  });
  it("cakupan kurang: 403 insufficient_scope; token salah: 401", async () => {
    const a = modern("tools/call", { name: "buat_usulan", arguments: { aksi: "catatan", judul: "Catat", bidang: {} } }, { "Mcp-Name": "buat_usulan" });
    expect(await tangani(a.h, a.body, rpcPalsu("pemilik", ["nadi.baca"]).rpc, "t", RES)).toMatchObject({ status: 403, galatAuth: "cakupan", cakupanPerlu: "nadi.usul" });
    const b = modern("tools/list");
    expect(await tangani(b.h, b.body, rpcPalsu().rpc, "salah", RES)).toMatchObject({ status: 401, galatAuth: "token" });
  });
  it("alat tak dikenal: galat protokol -32602", async () => {
    const a = modern("tools/call", { name: "hapus_semua", arguments: {} }, { "Mcp-Name": "hapus_semua" });
    expect(await tangani(a.h, a.body, rpcPalsu().rpc, "t", RES)).toMatchObject({ body: { error: { code: -32602 } } });
  });
  it("array (batch) ditolak", async () => {
    expect((await tangani(hdr({}), [{}, {}], rpcPalsu().rpc, "t", RES)).status).toBe(400);
  });
});

describe("daftar alat per peran dan cakupan", () => {
  it("staf tidak melihat daftar_orang; token baca saja tidak melihat buat_usulan; urutan tetap", () => {
    expect(daftarAlat({ peran: "pemilik", cakupan: ["nadi.baca", "nadi.usul"] }).map((t) => t.name)).toEqual(ALAT.map((t) => t.name));
    expect(daftarAlat({ peran: "staf", cakupan: ["nadi.baca", "nadi.usul"] }).map((t) => t.name)).not.toContain("daftar_orang");
    expect(daftarAlat({ peran: "pemilik", cakupan: ["nadi.baca"] }).map((t) => t.name)).not.toContain("buat_usulan");
  });
  it("skema masukan valid: objek, nama alat aman untuk header", () => {
    for (const t of ALAT) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    }
  });
});

describe("era lama (initialize)", () => {
  it("initialize memilih versi lama yang diminta, tanpa resultType; tools/list tanpa header baru", async () => {
    const r = await tangani(hdr({}), { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }, rpcPalsu().rpc, "t", RES);
    expect(r.status).toBe(200);
    const res = (r.body as { result: Record<string, unknown> }).result;
    expect(res.protocolVersion).toBe("2025-06-18");
    expect(res.resultType).toBeUndefined();
    const l = await tangani(hdr({ "MCP-Protocol-Version": "2025-06-18" }), { jsonrpc: "2.0", id: 2, method: "tools/list" }, rpcPalsu("staf").rpc, "t", RES);
    expect(((l.body as { result: { tools: { name: string }[] } }).result.tools).map((t) => t.name)).toEqual(["siapa_saya", "daftar_usulan", "buat_usulan"]);
  });
  it("notifications/initialized: 202; metode tak dikenal era lama: 200 -32601", async () => {
    expect((await tangani(hdr({}), { jsonrpc: "2.0", method: "notifications/initialized" }, rpcPalsu().rpc, "t", RES)).status).toBe(202);
    expect(await tangani(hdr({}), { jsonrpc: "2.0", id: 3, method: "resources/list" }, rpcPalsu().rpc, "t", RES)).toMatchObject({ status: 200, body: { error: { code: -32601 } } });
  });
});
