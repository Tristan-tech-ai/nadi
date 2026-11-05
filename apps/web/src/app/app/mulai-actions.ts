"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieMulai } from "@/lib/mulai";
import { wajibPerusahaan } from "@/lib/sesi";

// U-05: daftar Mulai di Nadi ditutup per usaha di perangkat ini (cookie setahun) dan dipanggil lagi dari bantuan "?".
const SETAHUN = 60 * 60 * 24 * 365;

export async function tutupMulai() {
  const sesi = await wajibPerusahaan();
  (await cookies()).set(cookieMulai(sesi.perusahaanId), "tutup", { path: "/app", maxAge: SETAHUN, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}

export async function tampilkanMulai() {
  const sesi = await wajibPerusahaan();
  (await cookies()).delete({ name: cookieMulai(sesi.perusahaanId), path: "/app" });
  redirect("/app#mulai-nadi");
}
