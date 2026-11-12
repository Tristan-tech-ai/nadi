/**
 * D-ALIH: halaman publik di alamat lama nadi-swart.vercel.app dialihkan permanen (308) ke domain utama, lewat redirects
 * next.config dengan syarat host (docs bawaan Next 05-config/01-next-config-js/redirects.md, "Header, Cookie, and Query
 * Matching"). Diproses di routing, bukan di fungsi proxy, jadi halaman publik tetap statis.
 * Sengaja TIDAK dialihkan: /api (MCP dan token yang audiensnya alamat lama), /auth (tautan email lama), /.well-known,
 * /app dan sesi masuk (/masuk/sandi-baru, /masuk/2fa, /masuk/kode), /oauth, dan tautan pribadi yang mungkin sudah dicetak
 * atau dibagikan (struk, slip, tanda, lamar, i, v, sertifikat, servis, janji, katalog, kios, absen).
 * Tanpa impor alias "@/" karena berkas ini dibaca next.config.ts.
 */
export const HOST_LAMA = "nadi-swart.vercel.app";
export const TUJUAN = "https://nadiusaha.my.id";

export const JALUR_PUBLIK = [
  "/", "/en", "/en/:path*",
  "/harga", "/untuk", "/untuk/:path*", "/fitur/:path*", "/integrasi", "/panduan", "/tentang", "/keamanan", "/privasi", "/syarat",
  "/bantuan", "/bantuan/:path*", "/alat", "/alat/:path*", "/kamus", "/kamus/:path*", "/demo",
  "/masuk", "/masuk/staf", "/daftar", "/sitemap.xml", "/robots.txt",
] as const;

export const TIDAK_DIALIHKAN = ["/api", "/auth", "/.well-known", "/app", "/oauth", "/masuk/sandi-baru", "/masuk/2fa", "/masuk/kode", "/masuk/lupa",
  "/struk", "/slip", "/tanda", "/lamar", "/i/", "/v/", "/sertifikat", "/servis", "/janji", "/katalog", "/kios", "/absen", "/cetak"] as const;

export function alihDomainLama() {
  return JALUR_PUBLIK.map((source) => ({
    source,
    has: [{ type: "host" as const, value: HOST_LAMA }],
    destination: `${TUJUAN}${source === "/" ? "/" : source}`,
    permanent: true,
  }));
}
