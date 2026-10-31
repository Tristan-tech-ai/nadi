// Q-16: putuskan_usulan yang diulang (experimental.useOffline mengirim ulang aksi yang jawabannya hilang) mengembalikan
// {status, sudah: true} tanpa mengubah apa pun. Kartu Feed harus menampilkan keputusan yang benar-benar tersimpan, bukan
// keputusan yang baru diklik.

export type HasilUlang = { status: "diterima" | "ditolak"; pesan: string } | { galat: string };

export function hasilUlangPutusan(status: string): HasilUlang {
  if (status === "diterima") return { status: "diterima", pesan: "Sudah disetujui sebelumnya. Tidak ada yang dicatat dua kali." };
  if (status === "ditolak") return { status: "ditolak", pesan: "Sudah ditolak sebelumnya. Tidak ada yang dicatat dua kali." };
  return { galat: "Usulan ini sudah tidak menunggu keputusan. Muat ulang Feed untuk melihat keadaannya." };
}
