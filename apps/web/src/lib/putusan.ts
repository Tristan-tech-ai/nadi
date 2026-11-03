// Q-16: putuskan_usulan yang diulang (experimental.useOffline mengirim ulang aksi yang jawabannya hilang) mengembalikan
// {status, sudah: true} tanpa mengubah apa pun. Kartu Feed harus menampilkan keputusan yang benar-benar tersimpan, bukan
// keputusan yang baru diklik.

export type HasilUlang = { status: "diterima" | "ditolak"; pesan: string } | { galat: string };
export type TeksUlang = { ulangDiterima: string; ulangDitolak: string; ulangLain: string };

const TEKS_ID: TeksUlang = {
  ulangDiterima: "Sudah disetujui sebelumnya. Tidak ada yang dicatat dua kali.",
  ulangDitolak: "Sudah ditolak sebelumnya. Tidak ada yang dicatat dua kali.",
  ulangLain: "Usulan ini sudah tidak menunggu keputusan. Muat ulang Feed untuk melihat keadaannya.",
};

export function hasilUlangPutusan(status: string, t: TeksUlang = TEKS_ID): HasilUlang {
  if (status === "diterima") return { status: "diterima", pesan: t.ulangDiterima };
  if (status === "ditolak") return { status: "ditolak", pesan: t.ulangDitolak };
  return { galat: t.ulangLain };
}
