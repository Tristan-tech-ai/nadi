import type { MetadataRoute } from "next";
import { petaSitus } from "@/lib/seo/peta-situs";
import { asalSitus } from "@/lib/situs";

export default function sitemap(): MetadataRoute.Sitemap {
  return petaSitus(asalSitus());
}
