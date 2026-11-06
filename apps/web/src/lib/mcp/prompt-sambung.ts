// Prompt lengkap yang disalin pemilik ke AI miliknya supaya AI itu yang memasang sambungan MCP ke Nadi dan menyiapkan usaha
// (permintaan Tristan 6 Nov 2026). Isinya hanya alamat server, nama alat yang benar-benar ada di ALAT (diuji), petunjuk
// per aplikasi dari halaman resmi yang sudah dibaca (kamus siapkan.app*Ket), dan batasan. Tidak ada data usaha di dalamnya.
import type { Bahasa } from "@/lib/i18n/bahasa";

export type PetunjukApp = { nama: string; ket: string };

export function promptSambung({ alamat, asal, app, bahasa }: { alamat: string; asal: string; app: PetunjukApp[]; bahasa: Bahasa }): string {
  const daftarApp = app.map((a) => `  * ${a.nama}: ${a.ket}`).join("\n");
  const draf = `${asal}/app/siapkan/draf`;
  if (bahasa === "en") return `Please connect yourself to Nadi, the app I use to run my business, and then set my business up there.

STEP 1. CONNECT NADI (MCP)
Nadi MCP server address: ${alamat}
Type: remote MCP server over HTTP (Streamable HTTP), sign-in with OAuth. I approve the connection myself on the Nadi page that opens the first time.
- If you can add an MCP server yourself (for example an agent in a terminal or code editor), add that address with the name "nadi", then ask me to open the approval link that appears.
- If you cannot, guide me step by step in your app. What Nadi knows from each app's official help pages (checked 4 Nov 2026):
${daftarApp}
  Do not invent menus you are not sure about. If your app does not support remote MCP servers, say so plainly and suggest I use the "Copy prompt" button (text format) on Nadi's "Set up with AI" page instead.

STEP 2. KNOW MY BUSINESS
Once connected, call the siapa_saya tool, then read the nadi://skill/en resource (how Nadi works, vocabulary, safety rules). Tell me the business name and my role you see, so I know you are connected to the right business.

STEP 3. PREPARE A DRAFT
Ask me for my business documents: employee list (Excel or a photo), structure and work roles, leave rules, and the features I want. Then:
1. Write ONE draft with the tulis_draf tool, rows per section (orang, topi, izin, fitur, usaha, gaji). Fill alasan with where each row came from (file name and row) and keyakinan 0-100; anything you are unsure about gets below 70.
2. Write only what is in my documents. Do not guess. Duplicate names or different spellings: ask me.
3. Never send ID card numbers (NIK) or bank account numbers; Nadi rejects them. Salaries only if they are in my documents; salary rows are never ticked automatically and I check them myself.
4. When I ask for changes, use baca_draf then ubah_draf. Do not write a new draft unless I ask, because a new draft closes the old one.

STEP 4. HAND IT TO ME
You cannot (and do not need to) apply the draft. When it is ready, ask me to open ${draf}, check the rows marked Perlu dicek (needs checking), then press Terapkan (apply). After applying I have 10 minutes to undo.

LIMITS
- Never approve, pay, or move money; Nadi gives you no tool for that.
- Never ask for my Nadi password. Access only goes through Nadi's approval page, and I can revoke it any time under Usahamu.
- Anything outside setup: submit it as a suggestion with buat_usulan; I decide in Nadi's Feed.
- Nadi's screens are in Indonesian; reply to me in English.`;
  return `Tolong sambungkan dirimu ke Nadi, aplikasi yang saya pakai untuk menjalankan usaha, lalu siapkan usaha saya di sana.

LANGKAH 1. SAMBUNGKAN NADI (MCP)
Alamat server MCP Nadi: ${alamat}
Jenis: server MCP jarak jauh lewat HTTP (Streamable HTTP), masuk memakai OAuth. Saya sendiri yang mengizinkan di halaman Nadi yang terbuka saat pertama kali tersambung.
- Kalau kamu bisa menambah server MCP sendiri (misalnya agen di terminal atau editor kode), tambahkan alamat itu dengan nama "nadi", lalu minta saya membuka tautan izin yang muncul.
- Kalau tidak bisa, pandu saya langkah demi langkah di aplikasimu. Yang Nadi tahu dari halaman bantuan resmi tiap aplikasi (dicek 4 Nov 2026):
${daftarApp}
  Jangan mengarang menu yang tidak kamu yakini. Kalau aplikasimu tidak mendukung server MCP jarak jauh, katakan terus terang dan sarankan saya memakai tombol "Salin prompt" (format teks) di halaman Siapkan usaha dengan AI di Nadi.

LANGKAH 2. KENALI USAHA SAYA
Setelah tersambung, panggil alat siapa_saya, lalu baca sumber nadi://skill (cara kerja Nadi, kosakata, aturan aman). Sebutkan nama usaha dan peran saya yang terbaca, supaya saya tahu kamu tersambung ke usaha yang benar.

LANGKAH 3. SIAPKAN DRAF
Minta saya memberi dokumen usaha: daftar karyawan (Excel atau foto), struktur dan peran kerja, aturan izin dan cuti, dan fitur yang ingin dipakai. Lalu:
1. Tulis SATU draf dengan alat tulis_draf, baris per bagian (orang, topi, izin, fitur, usaha, gaji). Isi alasan dari mana baris itu berasal (nama berkas dan baris) dan keyakinan 0-100; yang ragu beri di bawah 70.
2. Tulis hanya yang ada di dokumen saya. Jangan menebak. Nama ganda atau ejaan berbeda: tanyakan ke saya.
3. Jangan pernah mengirim NIK, nomor KTP, atau nomor rekening; Nadi menolaknya. Gaji hanya bila ada di dokumen; baris gaji tidak pernah tercentang otomatis dan saya periksa sendiri.
4. Kalau saya minta perubahan, pakai baca_draf lalu ubah_draf. Jangan menulis draf baru kecuali saya minta, karena draf baru menutup draf lama.

LANGKAH 4. SERAHKAN KE SAYA
Kamu tidak bisa (dan tidak perlu) menerapkan draf. Setelah draf jadi, minta saya membuka ${draf}, memeriksa baris yang ditandai Perlu dicek, lalu menekan Terapkan. Setelah diterapkan saya punya 10 menit untuk membatalkan.

BATASAN
- Jangan pernah menyetujui, membayar, atau memindahkan uang; Nadi juga tidak memberimu alat untuk itu.
- Jangan meminta kata sandi Nadi saya. Izin hanya lewat halaman izin Nadi dan bisa saya cabut kapan saja di Usahamu.
- Hal lain di luar persiapan usaha: ajukan sebagai usulan dengan buat_usulan; saya yang memutuskan di Feed Nadi.`;
}

/** Petunjuk per aplikasi dari kamus halaman Siapkan (sumber resmi, 4 Nov 2026), dipakai halaman Siapkan dan Usahamu. */
export const petunjukApp = (t: { app1: string; app1Ket: string; app2Prompt: string; app3Ket: string; app4Ket: string }): PetunjukApp[] =>
  [{ nama: t.app1, ket: t.app1Ket }, { nama: "Cursor", ket: t.app2Prompt }, { nama: "VS Code", ket: t.app3Ket }, { nama: "ChatGPT", ket: t.app4Ket }];
