import type { MetadataRoute } from "next";
import { TERTUTUP } from "@/lib/seo/peta-situs";
import { asalSitus } from "@/lib/situs";

export default function robots(): MetadataRoute.Robots {
  const asal = asalSitus();
  return { rules: { userAgent: "*", allow: "/", disallow: TERTUTUP }, sitemap: `${asal}/sitemap.xml`, host: asal };
}
