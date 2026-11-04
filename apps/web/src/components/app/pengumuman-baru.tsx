import Link from "next/link";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { createClient } from "@/lib/supabase/server";

/** M-11: tautan ke pengumuman di Feed, dengan jumlah yang belum dibaca pengguna ini (RLS menyaring sasaran). */
export async function PengumumanBaru({ bahasa }: { bahasa: Bahasa }) {
  const t = ambilKamus(bahasa).hr;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ count: semua }, { count: dibaca }] = await Promise.all([
    supabase.from("pengumuman").select("id", { count: "exact", head: true }),
    supabase.from("pengumuman_baca").select("pengumuman_id", { count: "exact", head: true }).eq("user_id", user?.id ?? ""),
  ]);
  const belum = Math.max(0, (semua ?? 0) - (dibaca ?? 0));
  if (!semua) return null;
  return (
    <p className="mt-4 text-sm" data-testid="pengumuman-baru">
      <Link href="/app/pengumuman" className="underline underline-offset-4">{belum > 0 ? isiTeks(t.belumDibaca, { n: belum }) : t.pengumumanJudul}</Link>
    </p>
  );
}
