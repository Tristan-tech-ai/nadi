import { Fragment, type ReactNode } from "react";

/** Isi {kunci} di teks kamus dengan simpul React (mis. angka bergaya), supaya urutan kata tetap milik tiap bahasa. */
export function sisip(teks: string, isi: Record<string, ReactNode>): ReactNode[] {
  return teks.split(/(\{\w+\})/).filter((b) => b !== "").map((b, i) => {
    const m = /^\{(\w+)\}$/.exec(b);
    return <Fragment key={i}>{m && m[1] in isi ? isi[m[1]] : b}</Fragment>;
  });
}
