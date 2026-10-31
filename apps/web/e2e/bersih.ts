import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feed hanya menampilkan 20 usulan teratas (tenggat, lalu dampak). Akun uji menumpuk usulan sisa jalan sebelumnya, sehingga
 * usulan baru tanpa dampak (pelamar, KTP) bisa terdorong keluar. Sebelum menguji Feed, usulan uji yang sudah menunggu lebih dari
 * `menit` ditolak lewat RPC putuskan_usulan (tombol Tolak biasa, bukan penghapusan). Usulan jalan paralel yang masih baru tidak disentuh.
 */
export async function tolakUsulanLama(sb: SupabaseClient, menit = 15): Promise<number> {
  const batas = new Date(Date.now() - menit * 60_000).toISOString();
  const { data } = await sb.from("usulan").select("id").eq("status", "menunggu").lt("dibuat_at", batas).limit(200);
  let n = 0;
  for (const u of data ?? []) if (!(await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false })).error) n++;
  return n;
}
