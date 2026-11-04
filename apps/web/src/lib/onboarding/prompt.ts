// W-04: prompt yang disalin pemilik ke chat AI miliknya (termasuk paket gratis) bersama dokumen usahanya. AI menjawab dengan
// Teks Nadi yang lalu ditempel atau dilempar ke Nadi. Prompt selalu berbahasa Indonesia karena isinya untuk usaha Indonesia
// dan istilahnya harus sama dengan pengurai (teks-nadi.ts). Tidak ada data pengguna di dalam prompt.
import { KEPALA } from "./teks-nadi";

export const CONTOH_TEKS_NADI = `${KEPALA}
USAHA: Warung Bu Sari
JENIS: warung makan
KOTA: Denpasar | NEGARA: Indonesia | ORANG: 8 | CABANG: 1
ORANG:
- Sari Dewi | kasir, pelayan | mulai 2024-03-01
- Komang Ayu | koki | mulai 2025-01-15
- Made Putra | koki | mulai 2023-07-10
- Wayan Sari | pelayan | mulai 2025-06-02
- Ketut Arta | pelayan
- Nyoman Budi | kurir | mulai 2024-11-20
- Putu Lestari | kasir | mulai 2026-02-01
- Gede Wira | gudang
FITUR: Lempar, Feed, Absen, Gaji, Tagihan, Jadwal
ATURAN IZIN: sakit otomatis 1 hari, wajib surat dokter; izin otomatis 1 hari`;

export const PROMPT_ONBOARDING = `Kamu membantu saya menyiapkan usaha saya di aplikasi Nadi. Baca dokumen atau penjelasan yang saya berikan (daftar karyawan, struktur, aturan kerja), lalu tulis HANYA satu blok teks dengan format persis seperti contoh di bawah. Jangan menambah penjelasan di luar blok.

Aturan:
1. Baris pertama selalu: ${KEPALA}
2. Tulis hanya yang benar-benar ada di dokumen saya. Kalau tidak tahu, hapus barisnya. Jangan menebak.
3. JANGAN menulis gaji, upah, nominal uang, nomor rekening, NIK, atau nomor KTP. Nadi menolak baris yang berisi itu; angka gaji diisi pemilik sendiri di Nadi.
4. ORANG: satu orang per baris, diawali tanda "-": nama | peran kerja dipisah koma | mulai YYYY-MM-DD (bila tahu).
5. FITUR dipilih dari: Lempar, Feed, Absen, Izin, Gaji, Jadwal, Kerja, Tagihan, Penjualan, Pembelian, Stok, Kas, Laporan keuangan, Pajak, Surat, Mata, Peta usaha, Rekrut, Magang.
6. ATURAN IZIN memakai kalimat pendek: "sakit otomatis N hari", "wajib surat dokter", "izin otomatis N hari", "cuti N hari setahun", atau "selalu ditinjau".
7. NEGARA: Indonesia, Malaysia, atau Singapura. ORANG di baris profil = jumlah orang yang bekerja.
8. Bila saya meminta file, berikan isi yang sama sebagai berkas .txt.

Contoh:
${CONTOH_TEKS_NADI}`;
