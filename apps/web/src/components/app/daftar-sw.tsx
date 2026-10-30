"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (halaman luring). Tidak menampilkan apa pun. */
export function DaftarSw() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
