import Link from "next/link";
import { Bagian, GambarBaca, HalamanInfo } from "@/components/landing/halaman-info";
import { BELUM_SAMBUNG, JENIS_USAHA, SAMBUNGAN } from "@/components/landing/untuk-usaha";
import { MODUL } from "@/lib/fitur-usaha";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

const TAUTAN = "font-semibold text-tinta underline underline-offset-4";

const T = {
  daftarJudul: { id: "Nadi untuk usahamu", en: "Nadi for your business" },
  daftarPengantar: { id: "Pilih jenis usahamu. Setiap halaman menunjukkan satu hari kerja dan menu yang menyala sejak awal.", en: "Pick your kind of business. Each page shows one working day and the menu that is on from the start." },
  hari: { id: "Satu hari kerja", en: "One working day" },
  menu: { id: "Menu yang menyala sejak awal", en: "Menu that is on from the start" },
  menuKet: { id: "Feed, Lempar, uang, orang, gaji, dan dokumen selalu ada. Modul lain bisa kamu nyalakan atau matikan kapan saja.", en: "Feed, Lempar, money, people, payroll, and documents are always there. Other modules can be switched on or off any time." },
  fitur: { id: "Lihat fiturnya bekerja", en: "See the features work" },
  lain: { id: "Jenis usaha lain", en: "Other kinds of business" },
  contoh: { id: "Buka usaha contoh", en: "Open the sample business" },
  integrasiJudul: { id: "Integrasi", en: "Integrations" },
  integrasiPengantar: { id: "Nadi tersambung ke alat yang sudah kamu pakai. Data dari luar masuk sebagai usulan, jadi kamu tetap yang memutuskan.", en: "Nadi connects to tools you already use. Outside data arrives as a suggestion, so you still decide." },
  belum: { id: "Belum tersambung", en: "Not connected yet" },
  belumKet: { id: "Ditulis apa adanya. Halaman ini diperbarui begitu sambungannya jadi.", en: "Written as it is. This page is updated once a connection is ready." },
} as const;

/** L-02 /untuk: daftar jenis usaha. */
export function HalamanUntukDaftar({ bahasa }: { bahasa: Bahasa }) {
  const awal = awalanJalur(bahasa);
  return (
    <HalamanInfo bahasa={bahasa} warna="kunyit" judul={T.daftarJudul[bahasa]} pengantar={T.daftarPengantar[bahasa]}>
      <ul className="bagian-baca grid gap-x-10 gap-y-8 md:grid-cols-2" data-testid="daftar-jenis">
        {JENIS_USAHA.map((j) => (
          <li key={j.slug}>
            <Link href={`${awal}/untuk/${j.slug}`} className="papan papan-sedang underline-offset-8 hover:underline">{j.nama[bahasa]}</Link>
            <p className="mt-2">{j.pendukung[bahasa]}</p>
          </li>
        ))}
      </ul>
    </HalamanInfo>
  );
}

/** L-02 /untuk/<slug>: satu hari kerja jenis usaha itu, menu bawaannya (dari MODUL), dan fitur yang terpakai. */
export function HalamanUntuk({ slug, bahasa }: { slug: string; bahasa: Bahasa }) {
  const j = JENIS_USAHA.find((x) => x.slug === slug)!;
  const k = ambilKamus(bahasa);
  const awal = awalanJalur(bahasa);
  const modul = MODUL.filter((m) => m.paket.includes(j.paket));
  return (
    <HalamanInfo bahasa={bahasa} warna={j.warna} judul={j.judul[bahasa]} pengantar={j.pendukung[bahasa]}>
      <Bagian judul={T.hari[bahasa]} gambar={<GambarBaca jenis={k.fitur.find((f) => f.slug === j.fitur[0])?.ilustrasi ?? "nota"} bahasa={bahasa} />}>
        <ol className="space-y-5" data-testid="hari-kerja">
          {j.hari.map((h) => (
            <li key={h.saat.id}>
              <p className="font-bold">{h.saat[bahasa]}: {h.kejadian[bahasa]}</p>
              <p>{h.nadi[bahasa]}</p>
            </li>
          ))}
        </ol>
      </Bagian>
      <Bagian judul={T.menu[bahasa]}>
        <p>{T.menuKet[bahasa]}</p>
        <ul className="list-disc space-y-1 pl-5" data-testid="modul-nyala">
          {modul.map((m) => <li key={m.kode} data-kode={m.kode}><b>{m.label[bahasa]}</b>. {m.guna[bahasa]}</li>)}
        </ul>
      </Bagian>
      <Bagian judul={T.fitur[bahasa]}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {j.fitur.map((s) => {
            const f = k.fitur.find((x) => x.slug === s)!;
            return <li key={s}><Link href={`${awal}/fitur/${s}`} className={TAUTAN}>{f.nama}</Link></li>;
          })}
          <li><Link href={j.contoh} className={TAUTAN} hrefLang="id">{T.contoh[bahasa]}</Link></li>
        </ul>
      </Bagian>
      <Bagian judul={T.lain[bahasa]}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {JENIS_USAHA.filter((x) => x.slug !== slug).map((x) => <li key={x.slug}><Link href={`${awal}/untuk/${x.slug}`} className={TAUTAN}>{x.nama[bahasa]}</Link></li>)}
        </ul>
      </Bagian>
    </HalamanInfo>
  );
}

/** L-02 /integrasi: sambungan yang sudah berjalan, dan yang belum beserta alasannya. */
export function HalamanIntegrasi({ bahasa }: { bahasa: Bahasa }) {
  return (
    <HalamanInfo bahasa={bahasa} warna="laut" judul={T.integrasiJudul[bahasa]} pengantar={T.integrasiPengantar[bahasa]}>
      {SAMBUNGAN.map((s) => (
        <Bagian key={s.kode} judul={s.nama[bahasa]}>
          <p>{s.isi[bahasa]}</p>
          <p className="text-tinta-2">{s.contoh[bahasa]}</p>
        </Bagian>
      ))}
      <Bagian judul={T.belum[bahasa]}>
        <p>{T.belumKet[bahasa]}</p>
        <ul className="list-disc space-y-1 pl-5" data-testid="belum-sambung">{BELUM_SAMBUNG.map((b) => <li key={b.id}>{b[bahasa]}</li>)}</ul>
      </Bagian>
    </HalamanInfo>
  );
}
