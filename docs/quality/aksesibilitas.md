# Laporan aksesibilitas per halaman (Q-05)

Diperiksa 1 Nov 2026 terhadap produksi (deploy 0f18c13) dengan `apps/web/e2e/aksesibilitas.spec.ts`
(`E2E_BASE_URL=<produksi> E2E_LAPORAN=<berkas.json> pnpm exec playwright test e2e/aksesibilitas.spec.ts --project=desktop --workers=1`).
Halaman aplikasi diperiksa sebagai pemilik (akun uji A, Warung Uji A). 28 halaman, semuanya lolos.

## Yang diukur di setiap halaman
- axe-core: pelanggaran serius/kritis di 390 px dan 1440 px, skema terang dan gelap (4 kombinasi). Mencakup nama aksesibel tombol, tautan, label isian, gambar (pembaca layar), kontras teks, dan struktur ARIA.
- Satu `h1` dan `lang="id"`.
- Papan ketik: 12 Tab pertama selalu mendarat di elemen (fokus tidak hilang ke body), setiap elemen punya garis fokus minimal 2 px, dan kontras cincin fokus terhadap latar minimal 3:1 (WCAG 1.4.11 dan 2.4.7).
- Aplikasi: Tab pertama adalah "Lompat ke isi" dan Enter memindahkan fokus ke isi halaman (WCAG 2.4.1).

## Hasil (produksi)
| Halaman | axe serius/kritis (390/1440, terang/gelap) | h1 | lang | Fokus papan ketik | Lompat ke isi |
|---|---|---|---|---|---|
| `/` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/demo` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/demo/toko` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/masuk` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/daftar` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/masuk/staf` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/luring` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/lamar/status` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/slip` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/i/3A4U5K6M7HA4` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/v/265NHSEGHHH5` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/lamar/XXSYE47E` | 0 | 1 | id | terlihat, kontras >= 3:1 | tidak berlaku |
| `/app` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/perusahaan` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/orang` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/gaji` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/izin` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/invoice` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/pajak` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/akuntan` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/jadwal` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/kerja` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/surat` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/surat-keluar` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/lempar` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/magang` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/serah-terima` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |
| `/app/mulai` | 0 | 1 | id | terlihat, kontras >= 3:1 | ya |

## Temuan dan perbaikan
| Temuan | Bukti merah | Perbaikan |
|---|---|---|
| Cincin fokus `kunyit` di atas `kertas` terang hanya 1,86:1 (WCAG 1.4.11 butuh 3:1) | audit ke produksi lama: "kontras cincin fokus 1.86:1" di /lamar/<kode> | cincin fokus memakai `tinta` (kontras tinggi di terang dan gelap); DIRECTION.md diperbarui |
| Tidak ada cara melompati kepala aplikasi | "Lompat ke isi" tidak ditemukan | tautan `.lompat-isi` di layout aplikasi, target `#isi` (tabIndex -1) |
| /slip dan /lamar/status tanpa `h1` di keadaan galat | h1 = 0 | keadaan galat diberi judul `h1` |
| Isian tanggal (/app/gaji, /app/serah-terima) tanpa cincin saat dimasuki lewat Tab | "input[type=date][name=surat] (none 3px)" | Chromium memindahkan fokus ke bagian dalam isian, `:focus`/`:focus-visible` tidak cocok; cincin lewat `:focus-within` |
| outline-kunyit sisa di /app/magang dan formulir izin | ditemukan lewat pencarian kode | diganti outline-tinta |

## Di luar cakupan putaran ini
- /absen dan /kios (butuh kamera dan akun staf/tablet): diuji axe di e2e absen dan tablet masing-masing.
- /app/skill bukan layar (route unduhan berkas).
- Pembaca layar sungguhan (NVDA/TalkBack) belum dicoba manual; yang diuji adalah nama aksesibel lewat axe.
