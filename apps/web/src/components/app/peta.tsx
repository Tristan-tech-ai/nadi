"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { useOffline } from "next/offline";
import { ArrowsLeftRightIcon, CheckIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { usulkanTopi, type HasilKerja } from "@/app/app/kerja/actions";
import { Tombol } from "@/components/ui/tombol";
import { formatTanggalKalender } from "@/lib/format";
import {
  bagianTopi, dasarSaran, kalimatOrang, kalimatSerah, kalimatTopi, ringkasanGraf, tataLetak, teksPasang,
  type Peta, type SaranPeta,
} from "@/lib/kerja/peta";
import { formatPoin } from "@/lib/kerja/poin";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";

type TP = Kamus["peta"];
/** Kalimat peta (lib/kerja/peta dan SQL) masih bahasa Indonesia: di bahasa lain ditandai lang="id". */
type K = { t: TP; bahasa: Bahasa; isiLang?: string };

/** Penanda lintas topi: teks di atas stabilo kunyit, tidak pernah hanya warna (ANTI-SLOP S06). */
function TandaLintas({ t }: { t: TP }) {
  return (
    <span className="stabilo inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold" data-testid="tanda-lintas">
      <ArrowsLeftRightIcon size={12} aria-hidden /> {t.lintasTopi}
    </span>
  );
}

/**
 * "Pasang topi X ke Y": satu tombol utama layar ini. Membuat usulan untuk pemilik, bukan memasang langsung. Kunci idempoten dibuat
 * sekali per niat; kiriman ulang useOffline membawa kunci yang sama sehingga Feed tidak menerima usulan kembar.
 */
function TombolPasang({ s, minggu, k: { t, isiLang } }: { s: SaranPeta; minggu: number; k: K }) {
  const luring = useOffline();
  const kunci = useRef<string | null>(null);
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(async (lalu, fd) => {
    kunci.current ??= crypto.randomUUID();
    fd.set("kunci", kunci.current);
    return usulkanTopi(lalu, fd);
  }, null);
  const terkirim = !!h && "pesan" in h;
  return (
    <form action={aksi} className="mt-3 grid gap-2" aria-label={teksPasang(s)} data-testid="form-pasang-topi">
      <input type="hidden" name="orang" value={s.orang_id} />
      <input type="hidden" name="topi" value={s.topi_id} />
      <p className="text-sm text-tinta-2"><span lang={isiLang}>{dasarSaran(s, minggu)}</span>{t.usulanMasuk}</p>
      <div>
        <Tombol type="submit" disabled={sibuk || terkirim} className="h-auto! min-h-10 py-2 text-left" data-testid="tombol-pasang-topi">
          {terkirim ? <><CheckIcon size={18} aria-hidden /> {t.terkirim}</> : sibuk ? t.mengirim : <span lang={isiLang}>{teksPasang(s)}</span>}
        </Tombol>
      </div>
      {luring && (
        <p role="status" className="flex items-center gap-2 text-sm" data-testid="pasang-luring">
          <WifiSlashIcon size={18} aria-hidden /> {t.luring}
        </p>
      )}
      {h && "pesan" in h && <p role="status" className="text-sm text-daun" data-testid="hasil-pasang-topi">{h.pesan}</p>}
      {h && "galat" in h && <p role="alert" className="text-sm text-cap" data-testid="galat-pasang-topi">{h.galat}</p>}
    </form>
  );
}

/** Saran pasang topi: yang teratas jadi tombol utama (pemilik/admin), sisanya teks. */
function Saran({ p, bolehUsul, k }: { p: Peta; bolehUsul: boolean; k: K }) {
  const { t, isiLang } = k;
  if (!p.saran.length) return null;
  const [utama, ...lain] = p.saran;
  return (
    <div className="mt-3" data-testid="saran-peta">
      {utama.usulan_id ? (
        <p role="status" className="text-sm" data-testid="saran-menunggu">
          <span lang={isiLang}>&quot;{teksPasang(utama)}&quot;.</span>{" "}
          {sisip(t.sudahMenunggu, { feed: <Link href="/app?jenis=orang" className="font-semibold text-laut underline underline-offset-4">{t.feedPemilik}</Link> })}
        </p>
      ) : bolehUsul ? (
        <TombolPasang s={utama} minggu={p.minggu} k={k} />
      ) : (
        <p className="text-sm text-tinta-2">{t.bisaMengusulkan} <span lang={isiLang}>{teksPasang(utama)}. {dasarSaran(utama, p.minggu)}</span></p>
      )}
      {lain.length > 0 && (
        <ul className="mt-2 grid gap-1 text-sm text-tinta-2">
          {lain.map((s) => (
            <li key={`${s.orang_id}-${s.topi_id}`}>
              <span lang={isiLang}>{teksPasang(s)}: {dasarSaran(s, p.minggu)}</span>{t.jugaBisa}{s.usulan_id ? t.menungguFeed : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Pilihan = { jenis: "orang" | "topi"; id: string } | null;

const LEBAR = 760;
const X_ORANG = 212;
const X_TOPI = 548;
const X_TENGAH = (X_ORANG + X_TOPI) / 2;
const pendek = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Graf dua kolom SVG buatan sendiri: kiri orang, kanan topi. Garis tipis = di atas kertas; garis tebal sesuai poin = kerja selesai;
 * garis putus-putus kunyit berlabel "lintas topi" = dikerjakan tanpa memakai topinya. Graf aria-hidden (isinya sama dengan tabel);
 * ketukan pada simpul hanya pintasan untuk tombol pilihan di panel kanan, yang bisa dipakai dengan papan ketik.
 */
function Graf({ p, pilih, setPilih, k: { t, bahasa } }: { p: Peta; pilih: Pilihan; setPilih: (x: Pilihan) => void; k: K }) {
  const l = tataLetak(p);
  const terkait = (orang: string, topi: string) => !pilih || (pilih.jenis === "orang" ? pilih.id === orang : pilih.id === topi);
  const aktif = (jenis: "orang" | "topi", id: string) => pilih?.jenis === jenis && pilih.id === id;
  const ketuk = (jenis: "orang" | "topi", id: string) => setPilih(aktif(jenis, id) ? null : { jenis, id });
  const nyata = (g: (typeof l.garis)[number]) => `M ${X_ORANG} ${g.y1} C ${X_TENGAH} ${g.y1}, ${X_TENGAH} ${g.y2}, ${X_TOPI} ${g.y2}`;
  return (
    <svg viewBox={`0 0 ${LEBAR} ${l.tinggi}`} width="100%" height={l.tinggi} aria-hidden className="block max-w-full" data-testid="graf-peta" style={{ height: "auto" }}>
      <text x={X_ORANG} y={16} textAnchor="end" fontSize={12} fill="var(--tinta-2)">{t.orang}</text>
      <text x={X_TOPI} y={16} fontSize={12} fill="var(--tinta-2)">{t.topi}</text>
      {l.garis.filter((g) => g.kertas).map((g) => (
        <path key={`k-${g.orang_id}-${g.topi_id}`} d={nyata(g)} fill="none" stroke="var(--tinta-2)" strokeWidth={1.25}
          opacity={terkait(g.orang_id, g.topi_id) ? 0.7 : 0.12} />
      ))}
      {l.garis.filter((g) => g.tebal > 0).map((g) => (
        <path key={`n-${g.orang_id}-${g.topi_id}`} d={nyata(g)} fill="none" strokeLinecap="round"
          stroke={g.lintas ? "var(--kunyit)" : "var(--tinta)"} strokeWidth={g.tebal} strokeDasharray={g.lintas ? "10 7" : undefined}
          opacity={terkait(g.orang_id, g.topi_id) ? (g.lintas ? 1 : 0.8) : 0.1} data-lintas={g.lintas ? "ya" : undefined} />
      ))}
      {l.garis.filter((g) => g.lintas).map((g) => {
        const y = (g.y1 + g.y2) / 2;
        return (
          <g key={`l-${g.orang_id}-${g.topi_id}`} opacity={terkait(g.orang_id, g.topi_id) ? 1 : 0.15}>
            <rect x={X_TENGAH - 38} y={y - 10} width={76} height={20} rx={3} fill="var(--kunyit)" />
            <text x={X_TENGAH} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--stabilo-teks)">{t.lintasTopi}</text>
          </g>
        );
      })}
      {l.orang.map((o) => (
        <g key={o.id} onClick={() => ketuk("orang", o.id)} className="cursor-pointer" data-testid="simpul-orang" data-nama={o.nama}>
          <rect x={0} y={o.y - l.baris / 2 + 4} width={X_ORANG + 8} height={l.baris - 8} fill="transparent" />
          <circle cx={X_ORANG} cy={o.y} r={aktif("orang", o.id) ? 8 : 6} fill="var(--tinta)" stroke={aktif("orang", o.id) ? "var(--kunyit)" : "none"} strokeWidth={3} />
          <text x={X_ORANG - 14} y={o.y - 2} textAnchor="end" fontSize={14} fontWeight={600} fill="var(--tinta)">{pendek(o.nama)}</text>
          <text x={X_ORANG - 14} y={o.y + 14} textAnchor="end" fontSize={12} fill="var(--tinta-2)">{formatPoin(o.poin, bahasa)}</text>
        </g>
      ))}
      {l.topi.map((x) => (
        <g key={x.id} onClick={() => ketuk("topi", x.id)} className="cursor-pointer" data-testid="simpul-topi" data-nama={x.nama}>
          <rect x={X_TOPI - 8} y={x.y - l.baris / 2 + 4} width={LEBAR - X_TOPI + 8} height={l.baris - 8} fill="transparent" />
          <rect x={X_TOPI - 6} y={x.y - 6} width={12} height={12} rx={2} fill="var(--tinta)" stroke={aktif("topi", x.id) ? "var(--kunyit)" : "none"} strokeWidth={3} />
          <text x={X_TOPI + 14} y={x.y - 2} fontSize={14} fontWeight={600} fill="var(--tinta)">{pendek(x.nama)}</text>
          <text x={X_TOPI + 14} y={x.y + 14} fontSize={12} fill="var(--tinta-2)">{formatPoin(x.poin, bahasa)}</text>
        </g>
      ))}
    </svg>
  );
}

const PIL = "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-[background-color,color] duration-150";
const PIL_DIAM = "border-garis-kuat hover:bg-kertas-2";
const PIL_AKTIF = "border-tinta bg-tinta text-kertas";

function Pil({ aktif, onClick, children, testid }: { aktif: boolean; onClick: () => void; children: ReactNode; testid?: string }) {
  return (
    <button type="button" aria-pressed={aktif} onClick={onClick} className={`${PIL} ${aktif ? PIL_AKTIF : PIL_DIAM}`} data-testid={testid}>
      {aktif && <CheckIcon size={14} weight="bold" aria-hidden />}
      {children}
    </button>
  );
}

/** Panel kanan desktop: pilih orang atau topi (papan ketik dan ketuk), lalu kalimat angkanya. */
function Panel({ p, pilih, setPilih, k: { t, isiLang } }: { p: Peta; pilih: Pilihan; setPilih: (x: Pilihan) => void; k: K }) {
  const kalimat = !pilih ? [] : pilih.jenis === "orang" ? kalimatOrang(p, pilih.id) : [kalimatTopi(p, pilih.id)];
  const tombol = (jenis: "orang" | "topi", id: string, nama: string) => {
    const aktif = pilih?.jenis === jenis && pilih.id === id;
    return <li key={`${jenis}-${id}`}><Pil aktif={aktif} onClick={() => setPilih(aktif ? null : { jenis, id })}><span data-pengguna>{nama}</span></Pil></li>;
  };
  return (
    <aside aria-labelledby="judul-panel-peta" className="rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="panel-peta">
      <h3 id="judul-panel-peta" className="font-semibold">{t.panelJudul}</h3>
      <p className="mt-1 text-sm text-tinta-2">{t.panelKet}</p>
      <p className="mt-3 text-xs font-semibold text-tinta-2">{t.orang}</p>
      <ul className="mt-1 flex flex-wrap gap-2">{p.orang.map((o) => tombol("orang", o.id, o.nama))}</ul>
      <p className="mt-3 text-xs font-semibold text-tinta-2">{t.topi}</p>
      <ul className="mt-1 flex flex-wrap gap-2">{p.topi.map((x) => tombol("topi", x.id, x.nama))}</ul>
      <div aria-live="polite" className="mt-4 border-t border-garis pt-3" data-testid="kalimat-pilihan">
        {kalimat.length ? kalimat.map((x) => <p key={x} className="mt-1 first:mt-0" lang={isiLang}>{x}</p>)
          : <p className="text-sm text-tinta-2">{t.belumDipilih}</p>}
      </div>
    </aside>
  );
}

const SEL = "border-b border-garis px-2 py-2 align-top";

/** Tabel bergaris buku kas, isi sama dengan graf. */
function Tabel({ p, k: { t, bahasa } }: { p: Peta; k: K }) {
  const orang = new Map(p.orang.map((o) => [o.id, o]));
  const topi = new Map(p.topi.map((t) => [t.id, t]));
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="tabel-peta">
        <caption className="pb-2 text-left font-semibold">{t.tabelCaption}</caption>
        <thead>
          <tr className="text-left text-xs text-tinta-2">
            <th scope="col" className={SEL}>{t.kolOrang}</th>
            <th scope="col" className={SEL}>{t.kolTopi}</th>
            <th scope="col" className={SEL}>{t.kolKertas}</th>
            <th scope="col" className={`${SEL} text-right`}>{t.kolSelesai}</th>
            <th scope="col" className={`${SEL} text-right`}>{t.kolPoin}</th>
            <th scope="col" className={`${SEL} text-right`}>{t.kolBagianTopi}</th>
            <th scope="col" className={`${SEL} text-right`}>{t.kolBagianOrang}</th>
            <th scope="col" className={SEL}>{t.kolCatatan}</th>
          </tr>
        </thead>
        <tbody>
          {p.garis.map((g) => (
            <tr key={`${g.orang_id}-${g.topi_id}`} data-testid="baris-peta" data-orang={orang.get(g.orang_id)?.nama} data-topi={topi.get(g.topi_id)?.nama}>
              <th scope="row" className={`${SEL} text-left font-semibold`} data-pengguna>{orang.get(g.orang_id)?.nama}</th>
              <td className={SEL} data-pengguna>{topi.get(g.topi_id)?.nama}</td>
              <td className={SEL}>{g.kertas ? `${t.ya}${g.porsi !== null ? isiTeks(t.porsi, { n: g.porsi }) : ""}` : t.tidak}</td>
              <td className={`${SEL} angka text-right`}>{g.n}</td>
              <td className={`${SEL} angka text-right`}>{formatPoin(g.poin, bahasa)}</td>
              <td className={`${SEL} angka text-right`} data-testid="sel-persen-topi">{g.persen_topi !== null ? `${g.persen_topi}%` : t.belumCukup}</td>
              <td className={`${SEL} angka text-right`}>{g.persen_orang !== null ? `${g.persen_orang}%` : t.belumCukup}</td>
              <td className={SEL}>{g.lintas ? <TandaLintas t={t} /> : g.kertas && g.n === 0 ? t.belumAdaKerja : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlurSerah({ p, k: { t, isiLang } }: { p: Peta; k: K }) {
  return (
    <div data-testid="alur-serah">
      {p.serah.length ? (
        <ul className="divide-y divide-garis border-y border-garis">
          {p.serah.map((s) => <li key={`${s.pemberi_id ?? s.pemberi_peran}-${s.pelaksana_id}`} className="py-2" data-testid="baris-serah" lang={isiLang}>{kalimatSerah(s)}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-tinta-2">{isiTeks(t.serahKosong, { n: p.minggu })}</p>
      )}
      {p.serah_tanpa_pemberi > 0 && (
        <p className="mt-2 text-sm text-tinta-2">{isiTeks(t.serahTanpa, { n: p.serah_tanpa_pemberi })}</p>
      )}
    </div>
  );
}

/** HP: daftar per topi, persen dan batang tipis; lintas topi bertanda teks di atas stabilo. */
function DaftarTopi({ p, k: { t, bahasa } }: { p: Peta; k: K }) {
  const topi = [...p.topi].sort((a, b) => b.poin - a.poin || a.nama.localeCompare(b.nama, "id"));
  return (
    <ul className="grid gap-5" data-testid="daftar-topi-peta">
      {topi.map((x) => {
        const bagian = bagianTopi(p, x.id);
        return (
          <li key={x.id} data-testid="topi-peta" data-nama={x.nama}>
            <h3 className="font-semibold" data-pengguna>{x.nama}</h3>
            <p className="text-sm text-tinta-2">
              {x.n === 0 ? isiTeks(t.topiNol, { n: p.minggu }) : x.cukup ? isiTeks(t.topiCukup, { n: x.n, poin: formatPoin(x.poin, bahasa) }) : isiTeks(t.topiBelum, { n: x.n, ambang: p.ambang })}
            </p>
            <ul className="mt-2 divide-y divide-garis border-y border-garis">
              {bagian.map((b) => {
                const lebar = x.poin > 0 ? Math.max(b.poin > 0 ? 2 : 0, Math.round((b.poin / x.poin) * 100)) : 0;
                return (
                  <li key={b.orang_id} className="py-2" data-testid="bagian-topi" data-nama={b.nama} data-lintas={b.lintas ? "ya" : undefined}>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold" data-pengguna>{b.nama}</span>
                      <span className="angka text-sm">{b.n === 0 ? t.belumAdaKerja : b.persen !== null ? `${b.persen}%` : formatPoin(b.poin, bahasa)}</span>
                      {b.lintas && <TandaLintas t={t} />}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-garis" aria-hidden>
                      <div className={`h-1.5 rounded-full ${b.lintas ? "bg-kunyit" : "bg-tinta-2"}`} style={{ width: `${lebar}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function DaftarOrang({ p, k: { isiLang } }: { p: Peta; k: K }) {
  return (
    <ul className="divide-y divide-garis border-y border-garis" data-testid="daftar-orang-peta">
      {p.orang.map((o) => (
        <li key={o.id} className="py-3" lang={isiLang}>
          {kalimatOrang(p, o.id).map((k, i) => <p key={k} className={i === 0 ? "font-semibold" : "mt-1 text-sm"}>{k}</p>)}
        </li>
      ))}
    </ul>
  );
}

type Tampil = "topi" | "orang" | "serah";

/**
 * Layar /app/kerja?tab=peta (docs/design/peta-organisasi.md). Kalimat kepala dari SQL paling mencolok, satu tombol utama bila ada
 * saran, desktop graf + panel 8+4 dan tabel buku kas, HP daftar per topi dengan pil Per topi / Per orang / Alur serah.
 */
export function PetaOrganisasi({ p, bolehUsul, teks, bahasa = "id" }: { p: Peta; bolehUsul: boolean; teks: TP; bahasa?: Bahasa }) {
  const t = teks;
  const k: K = { t, bahasa, isiLang: bahasa === "id" ? undefined : "id" };
  const tanggal = (x: string) => formatTanggalKalender(x, bahasa);
  const [pilih, setPilih] = useState<Pilihan>(null);
  const [tampil, setTampil] = useState<Tampil>("topi");
  const kosong = p.selesai_n === 0;
  return (
    <section aria-labelledby="judul-peta" className="mt-6" data-testid="peta" data-selesai={p.selesai_n}>
      <h2 id="judul-peta" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.ket, { a: tanggal(p.mulai), b: tanggal(p.akhir) })}</p>
      {k.isiLang ? <p className="mt-1 text-sm text-tinta-2">{t.catatan}</p> : null}
      <p className="mt-4 max-w-3xl text-xl font-semibold" data-testid="kepala-peta" lang={k.isiLang}>{p.kepala}</p>
      {kosong ? (
        <p className="mt-3 text-sm" data-testid="peta-kosong">
          <Link href="/app/kerja" className="font-semibold text-laut underline underline-offset-4">{t.bukaPapan}</Link>
        </p>
      ) : (
        <>
          <Saran p={p} bolehUsul={bolehUsul} k={k} />
          {p.tanpa_peta_n > 0 && (
            <p className="mt-3 text-sm text-tinta-2" data-testid="tanpa-peta">{isiTeks(t.tanpaPeta, { n: p.tanpa_peta_n, m: p.minggu })}</p>
          )}

          <div className="mt-6 hidden lg:block">
            <p className="text-sm text-tinta-2" data-testid="keterangan-graf">{t.keteranganGraf}</p>
            <p className="sr-only" data-testid="ringkasan-graf" lang={k.isiLang}>{ringkasanGraf(p)}</p>
            <div className="mt-3 grid grid-cols-12 gap-6">
              <div className="col-span-8 min-w-0"><Graf p={p} pilih={pilih} setPilih={setPilih} k={k} /></div>
              <div className="col-span-4"><Panel p={p} pilih={pilih} setPilih={setPilih} k={k} /></div>
            </div>
            <Tabel p={p} k={k} />
            <h3 className="mt-6 font-semibold">{t.alurSerah}</h3>
            <div className="mt-2"><AlurSerah p={p} k={k} /></div>
          </div>

          <div className="mt-6 lg:hidden">
            <div role="group" aria-label={t.tampilanAria} className="flex flex-wrap gap-2">
              <Pil aktif={tampil === "topi"} onClick={() => setTampil("topi")} testid="pil-per-topi">{t.perTopi}</Pil>
              <Pil aktif={tampil === "orang"} onClick={() => setTampil("orang")} testid="pil-per-orang">{t.perOrang}</Pil>
              <Pil aktif={tampil === "serah"} onClick={() => setTampil("serah")} testid="pil-alur-serah">{t.alurSerah}</Pil>
            </div>
            <div className="mt-4">
              {tampil === "topi" ? <DaftarTopi p={p} k={k} /> : tampil === "orang" ? <DaftarOrang p={p} k={k} /> : <AlurSerah p={p} k={k} />}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Memuat: skeleton dua kolom yang meniru graf (ANTI-SLOP S51). */
export function KerangkaPeta() {
  return (
    <div aria-hidden className="mt-6 grid gap-4" data-testid="peta-memuat">
      <div className="h-5 w-40 animate-pulse rounded bg-kertas-2" />
      <div className="h-7 w-full max-w-xl animate-pulse rounded bg-kertas-2" />
      <div className="grid grid-cols-2 gap-16 lg:max-w-3xl">
        {[0, 1].map((k) => (
          <div key={k} className="grid gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-kertas-2" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
