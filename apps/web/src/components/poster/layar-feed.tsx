import { KartuUsulan, TEKS_KARTU_ID, type TeksKartu, type Usulan } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";

// Isi layar HP di landing (W-01): Feed Keputusan memakai komponen aplikasi asli (KartuUsulan, Cap, Rupiah), bukan kartu gambaran.
// Data sintetis dari korpus. `.layar-app` mengembalikan token aplikasi (kertas, tinta) di dalam lapangan poster dan mengecilkan
// isi supaya kartu berukuran asli muat di layar HP gambar.
export function LayarFeed({ kartu, teks = TEKS_KARTU_ID, bahasa = "id", jumlah = 3 }: { kartu: Usulan[]; teks?: TeksKartu; bahasa?: Bahasa; jumlah?: number }) {
  return (
    <div className="layar-app" data-ui>
      <p className="layar-app-judul">Feed</p>
      <div className="layar-app-isi">
        {kartu.slice(0, jumlah).map((u) => <KartuUsulan key={u.judul} usulan={u} teks={teks} bahasa={bahasa} />)}
      </div>
    </div>
  );
}
