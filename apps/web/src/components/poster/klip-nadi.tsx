"use client";

import { useEffect, useRef } from "react";

// L-01: potongan rekaman layar Nadi sungguhan (dari film demo docs/promo/nadi-demo.mp4, data contoh), tanpa suara.
// Diputar sendiri hanya saat terlihat dan hanya bila pengunjung tidak meminta gerak dikurangi; kontrol selalu ada supaya
// gerak yang lebih dari 5 detik bisa dihentikan (WCAG 2.2.2). Berkas tidak dimuat sebelum mendekati layar.
export function KlipNadi({ nama, label, ket }: { nama: string; label: string; ket: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.preload = "auto";
        void el.play().catch(() => {});
      } else el.pause();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="klip-nadi" data-testid="klip-nadi">
      <video ref={v} src={`/video/${nama}.mp4`} poster={`/video/${nama}.jpg`} width={960} height={540} muted loop playsInline controls preload="none" aria-label={label} />
      <figcaption>{ket}</figcaption>
    </figure>
  );
}

/** Film demo utuh di landing: diputar pengunjung sendiri, dengan suara. */
export function FilmNadi({ label, ket, kredit }: { label: string; ket: string; kredit: string }) {
  return (
    <figure className="klip-nadi film-nadi" data-testid="film-nadi">
      <video src="/video/nadi-demo.mp4" poster="/video/nadi-demo.jpg" width={1280} height={720} controls playsInline preload="none" aria-label={label} />
      <figcaption>{ket} <span className="kredit-film">{kredit}</span></figcaption>
    </figure>
  );
}
