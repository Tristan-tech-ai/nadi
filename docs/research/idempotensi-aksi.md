# Kunci idempoten untuk Server Action yang membuat baris

Ditulis 1 Nov 2026. Latar: experimental.useOffline (F3-01) mengulang Server Action yang sedang berjalan saat koneksi putus (docs/quality/review-f3-01.md). Aksi yang membuat baris baru bisa menghasilkan baris kembar.

## Sumber
- PostgreSQL INSERT (https://www.postgresql.org/docs/current/sql-insert.html, dibaca 1 Nov 2026): "DO NOTHING simply avoids inserting a row as its alternative action." dan "Only rows that were successfully inserted or updated will be returned." Jadi `INSERT ... ON CONFLICT DO NOTHING RETURNING id` mengembalikan NOL baris saat kunci sudah ada; fungsi harus membaca baris lama secara terpisah.
- Next.js useOffline (apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/useOffline.md): aksi "already in flight when the connection dropped" dijalankan sekali lagi setelah koneksi kembali.

## Pola
1. **Kunci dibuat di klien, sekali per niat.** Saat formulir dirender (atau saat lembar "Tambah kerja" dibuka), komponen klien membuat `crypto.randomUUID()` dan menaruhnya di input tersembunyi `kunci`. Pengiriman ulang otomatis membawa FormData yang sama, jadi kuncinya sama. Setelah berhasil, formulir baru mendapat kunci baru.
2. **Kolom unik per usaha.** `kunci uuid` + `unique (perusahaan_id, kunci)`. Kunci boleh null untuk baris lama dan jalur yang bukan dari formulir (impor, MCP).
3. **RPC:**
   ```sql
   insert into public.kerja (perusahaan_id, kunci, ...) values (..., p_kunci, ...)
   on conflict (perusahaan_id, kunci) do nothing
   returning id into v_id;
   if v_id is null then
     select id into v_id from public.kerja where perusahaan_id = v_pid and kunci = p_kunci;
   end if;
   return v_id;
   ```
   Hasilnya sama untuk panggilan pertama dan ulangan; pemanggil tidak bisa membedakan, dan memang tidak perlu.
4. **Transisi status** (Mulai, Selesai, Setujui) tidak butuh kunci: buat idempoten dengan memeriksa keadaan sekarang. Transisi ke keadaan yang sudah berlaku = kembalikan baris apa adanya tanpa kejadian baru dan tanpa galat.
5. **Jangan** memakai kunci dari jam atau isi formulir (judul sama dua kali di hari yang sama bisa sah).

## Aksi yang perlu pola ini (untuk tugas Q-16)
buatLowongan (lowongan), simpan_rencana_magang (rencana_magang, bila membuat baris baru), buat kerja (F3-01, sedang dikerjakan agen dengan migrasi papan_kerja_idempoten). Aksi yang sudah aman: putuskan_usulan (menolak bila bukan menunggu; sebaiknya mengembalikan hasil lama alih-alih galat), catat_lembur (unik orang+tanggal), simpan_slip, simpan_transkrip.

## Uji
Tes SQL: panggil RPC dua kali dengan kunci sama, jumlah baris tetap 1 dan id sama; kunci berbeda menghasilkan 2 baris; kunci sama di usaha lain tidak bentrok (isolasi tenant).
