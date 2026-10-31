// Tautan tablet absen: token kios dibawa di fragmen URL (#nmk_...) supaya tidak terkirim ke server atau tercatat di log,
// lalu disimpan di perangkat dan fragmen dihapus dari bilah alamat.

export const KUNCI_SIMPAN = "nadi-kios";

const POLA = /^nmk_[0-9a-f]{64}$/;

/** Token dari fragmen URL ("#nmk_..." atau "#t=nmk_..."), atau null bila bentuknya salah. */
export function tokenDariHash(hash: string): string | null {
  const isi = decodeURIComponent(hash.replace(/^#/, "")).replace(/^t=/, "").trim();
  return POLA.test(isi) ? isi : null;
}

export const tokenSah = (t: string | null | undefined): t is string => !!t && POLA.test(t);

export const tautanTablet = (asal: string, token: string) => `${asal.replace(/\/$/, "")}/kios/tablet#${token}`;
