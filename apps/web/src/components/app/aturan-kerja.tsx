import { FormAturanKerja } from "@/components/app/form-aturan-kerja";
import { polaSah, POLA_BAWAAN } from "@/lib/gaji/pola-kerja";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

type Aturan = { pola_kerja: string; tersimpan: boolean; jam_kerja_diatur_sendiri: boolean; bisa_ubah: boolean; lembur_libur: number; slip: number };

/**
 * Kartu "Aturan kerja" (Q-22, docs/design/aturan-kerja.md): pola kerja usaha satu sumber. Pemilik mengubah; admin dan akuntan
 * membaca saja; staf tidak melihat kartu. Hak ubah dan jumlah lembur libur diambil dari aturan_kerja() (tabel anggota yang aktif),
 * bukan dari klaim JWT.
 */
export async function AturanKerja() {
  const sesi = await bacaSesi();
  if (!sesi?.peran || !["pemilik", "admin", "akuntan"].includes(sesi.peran)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aturan_kerja");
  if (error?.code === "42501") return null;
  const a = (data ?? null) as Aturan | null;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-aturan-kerja" data-testid="aturan-kerja">
      <h2 id="judul-aturan-kerja" className="text-lg font-semibold">Aturan kerja</h2>
      {!a ? (
        <p role="alert" className="mt-2 text-sm text-cap">Aturan kerja belum terbaca. Muat ulang halaman sebentar lagi.</p>
      ) : (
        <FormAturanKerja
          pola={polaSah(a.pola_kerja) ? a.pola_kerja : POLA_BAWAAN}
          tersimpan={a.tersimpan}
          diaturSendiri={a.jam_kerja_diatur_sendiri}
          bisaUbah={a.bisa_ubah}
          lemburLibur={Number(a.lembur_libur)}
          slip={Number(a.slip)}
        />
      )}
    </section>
  );
}
