# Pembagi kerja adil: tampilan (lanjutan F3-01, untuk F3-02)

Ditulis 1 Nov 2026. F3-01 memberi setiap kerja Poin Beban (1 poin = 15 menit wajar). Catatan ini merancang cara angka itu dipakai supaya yang rajin tidak terus ketiban (P11), tanpa membuat staf merasa diawasi.

## Prinsip
- Yang dibandingkan adalah **beban**, bukan kecepatan orang. Poin yang dihitung = poin estimasi kerja, bukan menit aktual seseorang; staf yang lambat tidak "dihukum" dengan poin lebih banyak.
- Beban dinormalisasi dengan jam kerja: poin minggu ini dibagi jadwal jam orang itu (dari shift F3-06 bila ada, bila belum ada dianggap sama rata dan layar mengatakannya).
- Kerja lintas topi dihitung penuh dan ditandai; inilah kerja yang biasanya tak terlihat.

## Layar pemilik (/app/kerja, tab "Beban minggu ini")
- Satu baris per orang, bergaris buku kas: nama, topi, poin minggu ini, jam jadwal, beban per jam, batang tipis (token `tinta-2`, yang paling berat ditandai stabilo `kunyit` beserta teks "paling berat").
- Di atas daftar satu kalimat angka: "Sari memikul 31% kerja minggu ini dengan 20% jam kerja." Tanpa kata sifat. Selama jam kerja belum diatur (semua orang dianggap sama), porsi jam tidak disebut: "Sari memikul 31% kerja minggu ini." (Q-28, docs/research/beban-per-jam.md).
- Saat menambah kerja tanpa pelaksana, usulan pelaksana: orang bertopi cocok dengan beban per jam terendah, dengan alasan tertulis ("Budi: 6 poin minggu ini, paling ringan di antara kasir"). Pemilik bisa memilih orang lain; pilihan itu tidak dipersoalkan.

## Layar staf
- Staf hanya melihat bebannya sendiri dibanding rata-rata timnya, bukan nama rekan: "Minggu ini 18 poin. Rata-rata tim 15."
- Bila beban staf jauh di atas rata-rata (> 1,5 kali), staf melihat jalan bicara: "Bebanmu di atas rata-rata. Pemilik sudah melihat angka yang sama."

## Keadaan
- Belum cukup data (< 5 kerja selesai minggu ini): "Beban belum bisa dibandingkan. Butuh minimal 5 kerja selesai minggu ini."
- Tanpa jadwal: "Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama."

## Kriteria uji untuk F3-02
- Tes SQL: beban per jam dihitung dari poin estimasi, bukan durasi aktual; usulan pelaksana memilih yang paling ringan di topi yang cocok, seri diputus dengan yang paling lama tidak diberi kerja.
- e2e: tiga staf dengan beban berbeda, kerja baru tanpa pelaksana diusulkan ke yang teringan beserta alasannya.
