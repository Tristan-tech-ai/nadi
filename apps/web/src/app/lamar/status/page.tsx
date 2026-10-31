import type { Metadata } from "next";
import { StatusLamaran } from "@/components/lamar/status-lamaran";
import { LogoNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Status lamaran", robots: { index: false } };

// Status lamaran tanpa akun (F2-05). Token ada di fragmen URL (#nml_...), jadi tidak masuk log server; dibaca di browser lalu RPC anon.
export default function Status() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <LogoNadi />
      <StatusLamaran />
    </main>
  );
}
