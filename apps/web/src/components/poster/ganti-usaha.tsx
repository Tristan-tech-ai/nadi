"use client";

import { useEffect, useState } from "react";

// Pita jenis usaha (W-01, blueprint fixed-anchor-cycle): hanya satu kata tampil, berganti tiap 1,8 detik dengan naik singkat
// (transform saja). Gerak dikurangi = kata pertama diam. Daftar lengkap untuk pembaca layar ada di elemen sr-only.
export function GantiUsaha({ usaha }: { usaha: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % usaha.length), 1800);
    return () => window.clearInterval(t);
  }, [usaha.length]);
  return (
    <>
      <span className="sr-only">{usaha.map((u) => <span key={u} data-usaha={u}>{u}, </span>)}</span>
      <span className="ganti-usaha" aria-hidden="true"><span key={i} className="ganti-usaha-kata">{usaha[i]}</span></span>
    </>
  );
}
