import { aturModulFitur } from "@/app/app/perusahaan/actions";
import { MODUL } from "@/lib/fitur-usaha";
import type { Bahasa } from "@/lib/i18n/bahasa";

// U-06: daftar modul fitur dengan keadaan tampil/tersembunyi di menu. Satu tombol per modul; tidak menghapus data apa pun.
export function FiturDipakai({ nyala, paket, bahasa: b }: { nyala: ReadonlySet<string>; paket: string | null; bahasa: Bahasa }) {
  const en = b === "en";
  return (
    <section id="fitur" aria-labelledby="judul-fitur" className="mt-10 scroll-mt-20" data-testid="fitur-dipakai">
      <h2 id="judul-fitur" className="text-lg font-semibold">{en ? "Features in your menu" : "Fitur yang dipakai"}</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {en ? "Hidden features keep their data and can still be found with Search." : "Fitur yang disembunyikan tetap menyimpan datanya dan tetap bisa dicari."}
        {paket ? (en ? ` Default follows your business type (${paket}).` : ` Bawaan mengikuti jenis usahamu (${paket}).`) : ""}
      </p>
      <ul className="mt-3 divide-y divide-garis border-y border-garis">
        {MODUL.map((m) => {
          const on = nyala.has(m.kode);
          return (
            <li key={m.kode} className="flex items-center justify-between gap-3 py-3" data-modul={m.kode} data-nyala={on ? "ya" : "tidak"}>
              <div className="min-w-0">
                <p className="font-semibold">{m.label[b]}</p>
                <p className="text-sm text-tinta-2">{m.guna[b]} <span className="font-semibold text-tinta">{on ? (en ? "In menu" : "Tampil") : (en ? "Hidden" : "Disembunyikan")}</span></p>
              </div>
              <form action={aturModulFitur} className="shrink-0">
                <input type="hidden" name="modul" value={m.kode} />
                <input type="hidden" name="nyala" value={on ? "tidak" : "ya"} />
                <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold hover:bg-kertas-2">
                  {on ? (en ? "Hide" : "Sembunyikan") : (en ? "Show" : "Tampilkan")}<span className="sr-only"> {m.label[b]}</span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
