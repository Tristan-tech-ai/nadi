import { cookies } from "next/headers";
import { bacaSesi } from "@/lib/sesi";
import { KUKI_BAHASA, pilihBahasa, type Bahasa } from "./bahasa";

/** Bahasa aplikasi pengguna yang masuk: pilihan di akun, lalu cookie perangkat, lalu Indonesia (I-02).
 *  Membaca cookie, jadi hanya dipanggil di balik Suspense atau di server action. */
export async function bahasaAplikasi(sesiBahasa?: string | null): Promise<Bahasa> {
  const dariAkun = sesiBahasa !== undefined ? sesiBahasa : (await bacaSesi())?.bahasa;
  return pilihBahasa(dariAkun, (await cookies()).get(KUKI_BAHASA)?.value);
}
