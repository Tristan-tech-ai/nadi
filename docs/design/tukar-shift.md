# Tukar shift antarstaf (F3-06, bagian tukar)

Ditulis 1 Nov 2026. Pasangan docs/research/shift-f3-06-sql.md (tabel shift, app.cek_shift) dan docs/design/jadwal-shift.md. Masalah nyata di F&B: staf menukar shift lewat obrolan grup lalu pemilik baru tahu saat absen tidak cocok jadwal.

## Alur
1. **Tawarkan** (staf A, HP): di "Jadwalmu minggu ini", ketuk shift lalu "Tawarkan ke rekan". Pilih: siapa saja yang memakai topi sama, atau satu orang tertentu. Opsi "tukar dengan shift saya yang lain" (balas tukar) atau "lepas saja" (A tidak mengambil pengganti).
2. **Ambil** (staf B): melihat daftar "Shift yang ditawarkan" berisi HANYA shift yang ditawarkan ke dia atau ke topinya: hari, jam, topi, nama penawar. Tidak melihat jadwal lain milik A atau rekan lain. Ketuk "Saya ambil". Sebelum tercatat, server menjalankan app.cek_shift untuk B dengan shift itu: tumpang tindih atau lembur di atas 4 jam/hari, 18 jam/minggu ditolak dengan alasan; peringatan (istirahat, hari libur kurang, lewat jam normal) ditampilkan dan B harus mengonfirmasi lagi. Bila menyebabkan jam di atas normal, persetujuan lembur B tercatat sekaligus (Pasal 78 ayat (1) huruf a), karena B sendiri yang mengambil.
3. **Setujui** (pemilik/admin): tukar menjadi usulan di Feed (untuk_peran memuat pemilik, sesuai CHECK Q-17) dengan kalimat "Sari menukar shift Sabtu 14.00-21.00 ke Budi. Budi jadi 38 jam minggu ini." Pemilik setujui atau tolak. Usaha boleh menyalakan "tukar otomatis bila tanpa peringatan" di Aturan; keputusan otomatis tercatat di public.keputusan dan bisa dibatalkan (pola F1-06).
4. **Berlaku**: setelah disetujui, shift dipindah dalam satu transaksi (pelaksana shift diganti, baris lama tercatat di audit_log lewat trigger audit_shift). Keduanya mendapat pemberitahuan.

## Aturan
- Tawaran kedaluwarsa saat shift mulai, atau dibatalkan A sebelum diambil.
- Shift yang sudah dimulai tidak bisa ditawarkan.
- Satu shift hanya punya satu tawaran aktif (unik per shift_id dengan status terbuka).
- Idempoten: setiap aksi (tawarkan, ambil, setujui) membawa kunci klien (experimental.useOffline mengirim ulang aksi; docs/research/idempotensi-aksi.md); ambil dua kali oleh dua orang: yang pertama menang (update ... where status = 'terbuka' returning), yang kedua melihat "Sudah diambil Dewi".
- Model AI tidak terlibat: semua keputusan tukar dari aturan dan manusia.

## Data
public.tawaran_shift: id, perusahaan_id, shift_id, dari_orang, untuk_orang (null = semua pemakai topi), untuk_topi, balas_shift_id (null = lepas saja), diambil_oleh, status terbuka|diambil|disetujui|ditolak|batal|kedaluwarsa, kunci_klien unik per usaha, dibuat_at, diambil_at, diputus_at. RLS: staf membaca tawaran miliknya dan tawaran yang ditujukan ke dirinya atau topinya; pemilik/admin semua. Tulis hanya lewat RPC tawarkan_shift, ambil_tawaran, batal_tawaran; persetujuan lewat putuskan_usulan cabang tukar.

## Layar dan kata (VOICE)
- Staf, kartu tawaran: "Sabtu, 8 Nov, 14.00-21.00 (kasir). Ditawarkan Sari." Tombol utama "Saya ambil".
- Ditolak cek batas: "Belum bisa diambil: kamu jadi lembur 5 jam hari Sabtu, paling lama 4 jam sehari."
- Menunggu pemilik: "Menunggu persetujuan pemilik." Ditolak pemilik: "Pemilik belum menyetujui tukar ini. Shift tetap milik Sari." Tidak menyalahkan siapa pun.
- Kosong: "Belum ada shift yang ditawarkan ke kamu."

## Tes wajib
Tes SQL: staf C (bukan tujuan) tidak bisa membaca tawaran A ke B; ambil yang melanggar batas lembur ditolak 54000; dua pengambil, satu menang; tawaran untuk shift yang sudah mulai ditolak; usulan tukar memuat pemilik; setelah disetujui shift berpindah dan audit_log memuat baris lama; isolasi tenant. e2e: A tawarkan, B ambil, pemilik setujui di Feed, jadwal B bertambah dan A berkurang.
