import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-04: tiga orang dan tiga topi sintetis di Warung Uji A. Sari memakai topi kasir, Budi gudang, Dewi pelayan; Dewi juga
// menyelesaikan dua kerja kasir (lintas topi). Pemilik melihat kalimat kepala dari SQL, label teks "lintas topi" (bukan warna
// saja), graf aria-hidden dengan tabel buku kas yang sama isinya, daftar per topi di HP, lalu menekan "Pasang topi kasir ke Dewi"
// yang menjadi usulan di Feed pemilik. Bersih tanpa penghapusan: usulan ditolak lewat putuskan_usulan, orang dan topi dinonaktifkan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function axeDanFoto(p: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      const lebarHalaman = await p.evaluate(() => document.documentElement.scrollWidth);
      expect(lebarHalaman, `${nama} ${lebar}: tanpa gulir mendatar`).toBeLessThanOrEqual(lebar);
      await p.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.emulateMedia({ colorScheme: "light" });
}

type PetaRpc = {
  kepala: string;
  garis: { orang_id: string; topi_id: string; kertas: boolean; lintas: boolean; lintas_n: number; persen_topi: number | null; persen_lintas: number | null }[];
  topi: { id: string; n: number; cukup: boolean }[];
  saran: { orang_id: string; topi_id: string; persen: number }[];
  serah: { pemberi_nama: string; pelaksana_id: string; n: number }[];
};

test("peta organisasi: kalimat kepala, lintas topi sebagai teks, tabel, usulan pasang topi di Feed pemilik", async ({ page }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  const { data: usaha } = await sb.from("perusahaan").select("nama").eq("id", pid!).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");

  const jejak = String(Date.now()).slice(-6);
  const namaTopi = { kasir: `Kasir Peta ${jejak}`, pelayan: `Pelayan Peta ${jejak}`, gudang: `Gudang Peta ${jejak}` };
  const topi: Record<keyof typeof namaTopi, string> = { kasir: "", pelayan: "", gudang: "" };
  const nama = { sari: `Sari Peta ${jejak}`, budi: `Budi Peta ${jejak}`, dewi: `Dewi Peta ${jejak}` };
  const id: Record<keyof typeof nama, string> = { sari: "", budi: "", dewi: "" };
  let idUsulan: string | null = null;

  try {
    for (const k of Object.keys(namaTopi) as (keyof typeof namaTopi)[]) {
      const { data: t, error } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `${k}_peta_${jejak}`, nama: namaTopi[k] }).select("id").single();
      expect(error).toBeNull();
      topi[k] = t!.id as string;
    }
    const pakai: Record<keyof typeof nama, keyof typeof namaTopi> = { sari: "kasir", budi: "gudang", dewi: "pelayan" };
    for (const k of Object.keys(nama) as (keyof typeof nama)[]) {
      const { data: o, error } = await sb.from("orang").insert({ perusahaan_id: pid, nama: nama[k], data: {} }).select("id").single();
      expect(error).toBeNull();
      id[k] = o!.id as string;
      expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: id[k], topi_id: topi[pakai[k]] })).error).toBeNull();
    }
    // Sari kasir 3+2+2, Budi gudang 1+1+1, Dewi pelayan 2 dan kasir 3+3 (lintas topi: 6 dari 8 poin Dewi = 75%).
    const rencana: [keyof typeof nama, keyof typeof namaTopi, string, number][] = [
      ["sari", "kasir", "Setor kas", 3], ["sari", "kasir", "Tutup kas", 2], ["sari", "kasir", "Cek laci", 2],
      ["budi", "gudang", "Bongkar beras", 1], ["budi", "gudang", "Susun rak", 1], ["budi", "gudang", "Cek stok", 1],
      ["dewi", "pelayan", "Antar pesanan", 2], ["dewi", "kasir", "Jaga kasir siang", 3], ["dewi", "kasir", "Jaga kasir sore", 3],
    ];
    for (const [siapa, t, judul, poin] of rencana) {
      const j = `${judul} ${jejak}`;
      const { data: r, error: eb } = await sb.rpc("buat_kerja", { p_judul: j, p_topi: topi[t], p_pelaksana: id[siapa], p_tenggat: null });
      expect(eb, j).toBeNull();
      const idKerja = (r as { id: string }).id;
      expect((await sb.rpc("simpan_estimasi_kerja", { p_kerja: idKerja, p_menit: poin * 15, p_sumber: "manual", p_alasan: "Data uji peta" })).error).toBeNull();
      expect((await sb.rpc("ubah_status_kerja", { p_kerja: idKerja, p_aksi: "selesai" })).error).toBeNull();
    }

    // Database langsung.
    const kepala = `${nama.dewi} mengerjakan 75% urusan kasir Peta ${jejak} walau topinya pelayan Peta ${jejak}.`;
    const { data: d, error: ep } = await sb.rpc("peta_organisasi", { p_minggu: 4 });
    expect(ep).toBeNull();
    const peta = d as PetaRpc;
    expect(peta.kepala).toBe(kepala);
    const dewiKasir = peta.garis.find((g) => g.orang_id === id.dewi && g.topi_id === topi.kasir)!;
    expect(dewiKasir).toMatchObject({ kertas: false, lintas: true, lintas_n: 2, persen_topi: 46, persen_lintas: 75 });
    expect(peta.garis.find((g) => g.orang_id === id.sari && g.topi_id === topi.kasir)).toMatchObject({ kertas: true, lintas: false, persen_topi: 54 });
    expect(peta.topi.find((t) => t.id === topi.pelayan)).toMatchObject({ n: 1, cukup: false });
    expect(peta.saran.find((s) => s.orang_id === id.dewi)).toMatchObject({ topi_id: topi.kasir, persen: 75 });
    expect(peta.serah.find((s) => s.pelaksana_id === id.sari)).toMatchObject({ pemberi_nama: "Pemilik", n: 3 });

    // Pemilik di layar.
    await page.goto("/masuk?next=/app");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app");
    await page.goto("/app/kerja");
    await page.getByRole("navigation", { name: "Bagian kerja" }).getByRole("link", { name: "Peta organisasi" }).click();
    await page.waitForURL((x) => x.searchParams.get("tab") === "peta");
    await expect(page.getByTestId("kepala-peta")).toHaveText(kepala);

    // Desktop: graf aria-hidden dengan ringkasan teks, tabel dengan teks "lintas topi" pada baris Dewi-kasir.
    await expect(page.getByTestId("graf-peta")).toBeVisible();
    await expect(page.getByTestId("graf-peta")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("ringkasan-graf")).toContainText("garis lintas topi");
    const baris = (o: string, t: string) => page.locator(`[data-testid="baris-peta"][data-orang="${o}"][data-topi="${t}"]`);
    await expect(baris(nama.dewi, namaTopi.kasir)).toContainText("lintas topi");
    await expect(baris(nama.dewi, namaTopi.kasir).getByTestId("sel-persen-topi")).toHaveText("46%");
    await expect(baris(nama.sari, namaTopi.kasir).getByTestId("sel-persen-topi")).toHaveText("54%");
    await expect(baris(nama.sari, namaTopi.kasir)).not.toContainText("lintas topi");
    await expect(baris(nama.dewi, namaTopi.pelayan).getByTestId("sel-persen-topi")).toHaveText("belum cukup kerja");
    await expect(page.getByTestId("tabel-peta").getByRole("columnheader", { name: "Bagian di topi" })).toBeVisible();
    await expect(page.getByTestId("alur-serah").first()).toContainText(`Pemilik menyerahkan 3 kerja ke ${nama.sari} (semua sudah selesai).`);

    // Panel: pilih Dewi, kalimatnya muncul.
    await page.getByTestId("panel-peta").getByRole("button", { name: nama.dewi }).click();
    await expect(page.getByTestId("kalimat-pilihan")).toContainText(`75% kerjanya urusan kasir Peta ${jejak} (lintas topi), padahal topinya pelayan Peta ${jejak}.`);
    await page.getByTestId("panel-peta").getByRole("button", { name: nama.dewi }).click();

    const tombol = page.getByRole("button", { name: `Pasang topi kasir Peta ${jejak} ke ${nama.dewi}` });
    await expect(tombol).toBeVisible();
    await axeDanFoto(page, "peta");

    // HP: daftar per topi dengan teks "lintas topi", pil Per orang dan Alur serah.
    await page.setViewportSize({ width: 390, height: 844 });
    const kasirHp = page.locator(`[data-testid="topi-peta"][data-nama="${namaTopi.kasir}"]`);
    await expect(kasirHp.locator(`[data-testid="bagian-topi"][data-nama="${nama.dewi}"]`)).toContainText("46%");
    await expect(kasirHp.locator(`[data-testid="bagian-topi"][data-nama="${nama.dewi}"]`)).toContainText("lintas topi");
    await page.getByTestId("pil-per-orang").click();
    await expect(page.getByTestId("pil-per-orang")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("daftar-orang-peta")).toContainText(`${nama.budi}: 3 poin dari 3 kerja selesai 4 minggu terakhir.`);
    await page.getByTestId("pil-alur-serah").click();
    await expect(page.locator("main").getByTestId("alur-serah").last()).toContainText(`ke ${nama.dewi}`);
    await axeDanFoto(page, "peta-hp-serah");

    // Tombol utama: usulan untuk pemilik.
    await tombol.click();
    await expect(page.getByTestId("hasil-pasang-topi")).toHaveText("Terkirim ke Feed pemilik. Topi dipasang setelah pemilik menyetujui.", { timeout: 20_000 });
    const { data: u } = await sb.from("usulan").select("id, aksi, judul, status, untuk_peran, sumber, payload").eq("aksi", "orang.topi").eq("payload->>orang_id", id.dewi);
    expect(u).toHaveLength(1);
    idUsulan = u![0].id as string;
    expect(u![0]).toMatchObject({ status: "menunggu", untuk_peran: ["pemilik"], sumber: "peta", payload: { orang_id: id.dewi, topi_id: topi.kasir, persen: 75, minggu: 4 } });
    const judulUsulan = `Pasang topi kasir Peta ${jejak} ke ${nama.dewi}`;
    expect(u![0].judul).toBe(judulUsulan);

    await page.reload();
    await expect(page.getByTestId("saran-menunggu")).toContainText("sudah menunggu");
    await page.goto("/app?jenis=orang&urut=terbaru");
    await expect(page.getByText(judulUsulan)).toBeVisible();
    await expect(page.getByText("Dari peta organisasi").first()).toBeVisible();
  } finally {
    // Usulan yang sempat dibuat tetapi idnya belum terbaca (tes gagal di tengah) ikut ditolak.
    if (!idUsulan && id.dewi) {
      const { data: sisa } = await sb.from("usulan").select("id").eq("aksi", "orang.topi").eq("status", "menunggu").eq("payload->>orang_id", id.dewi);
      idUsulan = (sisa?.[0]?.id as string | undefined) ?? null;
    }
    if (idUsulan) await sb.rpc("putuskan_usulan", { p_usulan: idUsulan, p_setuju: false });
    for (const o of Object.values(id)) if (o) await sb.from("orang").update({ status: "nonaktif" }).eq("id", o);
    const ids = Object.values(topi).filter(Boolean);
    if (ids.length) await sb.from("topi").update({ aktif: false }).in("id", ids);
  }
});
