import type { Bahasa } from "@/lib/i18n/bahasa";
import { kamusEn } from "./en";
import { kamusId, type Kamus } from "./id";

export type { Kamus } from "./id";
export { isiTeks } from "./id";

const KAMUS: Record<Bahasa, Kamus> = { id: kamusId, en: kamusEn };

export function ambilKamus(b: Bahasa): Kamus {
  return KAMUS[b];
}
