# Rancangan SQL serah terima (F3-07)

Ditulis 1 Nov 2026 dari skema yang ada: public.anggota (fondasi: peran, orang_id, aktif boolean), public.orang (status, data.kontrak_selesai), kebijakan_izin.jatah_tahunan + pengajuan_izin (F1-03), kerja (F3-01), app.beban_orang/usulan_pelaksana (F3-02), langganan_push, token kios (F1-02), gerbang_gaji (F1-04), audit_log. Aturan: docs/research/serah-terima.md; layar: docs/design/serah-terima-layar.md.

## Tabel
**public.berhenti** (satu baris per kejadian berhenti; orang yang pernah berhenti lalu kembali punya baris baru)
- id, perusahaan_id, orang_id, tanggal_surat date, tanggal_efektif date, alasan 'mundur'|'kontrak_selesai'|'lainnya', surat_berkas_id null (Lempar), uang_pisah bigint null (isian pemilik, tanpa bawaan), status 'disiapkan'|'selesai'|'batal', dicabut_at timestamptz null, kunci_klien uuid unik per usaha, dibuat_oleh, dibuat_at.
- unique (orang_id) where status = 'disiapkan' (satu proses aktif per orang).
- peringatan text[] dihitung RPC: 'kurang_30_hari' bila tanggal_efektif - tanggal_surat < 30 (PP 35/2021 Pasal 36 huruf i, terverifikasi), tidak memblokir.

**public.serah_butir** (isi paket)
- id, perusahaan_id, berhenti_id (fk cascade), jenis 'kerja'|'topi'|'ilmu'|'akses_otomatis'|'akses_manual', kerja_id null, topi_id null, judul text, pengganti_id null (orang), status 'terbuka'|'selesai'|'dilewati', berkas_id null (klip Rekam Ilmu), langkah jsonb null (SOP dari transkrip), sumber 'jejak'|'pemilik', dibuat_at, selesai_at.
- RLS: pemilik/admin semua; orang yang berhenti hanya butir 'ilmu' miliknya (untuk merekam); staf lain tidak melihat.

## RPC
- **catat_berhenti(p_orang, p_surat date, p_efektif date, p_alasan, p_berkas, p_kunci) -> jsonb** pemilik/admin. Membuat baris berhenti + menyusun paket dalam satu transaksi:
  - butir 'topi' dari pakai_topi orang itu; butir 'kerja' dari kerja status baru/jalan/tunggu, pengganti = public.usulan_pelaksana(topi kerja) (F3-02) dengan orang yang berhenti dikecualikan (perlu parameter p_kecuali di usulan_pelaksana, atau app-level fungsi pembantu);
  - butir 'ilmu' dari jejak: topi yang hanya dipakai orang itu; judul kerja berulang (>= 3 kerja selesai 90 hari, similarity >= 0,4, hanya dia pelaksananya);
  - butir 'akses_otomatis': anggota (bila orang punya akun), langganan_push miliknya, token kios buatannya; 'akses_manual' bawaan: grup WA kerja, akun bank/QRIS, kunci toko, seragam.
  - Idempoten lewat p_kunci.
- **pindahkan_ke_pengganti(p_berhenti, p_butir uuid[] default null)**: memindah pelaksana kerja ke pengganti (pola ubah kerja yang ada; kejadian kerja.pindah tercatat).
- **app.cabut_akses_berhenti(p_hari date) -> int** (security definer, bukan untuk authenticated): untuk setiap berhenti 'disiapkan' dengan tanggal_efektif < p_hari (zona usaha; dicabut setelah hari efektif selesai, sesuai layar "23.59"): anggota.aktif = false, orang.status = 'nonaktif', langganan_push dimatikan, token kios buatannya dicabut, akun staf sintetis dikunci (banned_until, pola pin_staf_gagal Q-13), berhenti.status = 'selesai', dicabut_at = now(). pg_cron tiap jam memanggilnya dengan current_date per zona (cron 'nadi-cabut-berhenti'), karena usaha beda zona mencapai tengah malam di jam berbeda.
- **hak_berhenti(p_berhenti) -> jsonb**: gaji sampai tanggal efektif (prorata dari orang_rahasia.gaji lewat susunSlip di aplikasi, bukan SQL), sisa cuti = jatah_tahunan - cuti disetujui tahun berjalan (bila jatah diisi; bila kosong, tampil "jatah cuti belum diatur" bukan 0), upah harian = (pokok + tunjangan tetap) / 25 (pola 6 hari) atau / 21 (pola 5 hari), rumus PP 36/2021 Pasal 17 (terverifikasi 1 Nov 2026, docs/research/upah-harian.md); karena aturan penggantian cuti tidak menyebut pembagi, angka ini saran yang bisa diubah pemilik.
- **ajukan_hak_berhenti(p_berhenti)**: membuat usulan uang untuk_peran {pemilik} (CHECK Q-17), payload komponen + sumber pasal; tidak membayar otomatis.

## Hubungan ke fitur lain
- **Gerbang gaji (F1-04)**: orang dengan berhenti 'selesai' dan tanggal_efektif < awal bulan gaji tidak lagi digaji; gerbang menahan slip bila orang nonaktif tetapi masih punya slip draf (kode baru 'sudah_berhenti'). gerbang_gaji juga memakai zona 'Asia/Makassar' tetap untuk kontrak_habis: perbaiki ke perusahaan.zona_waktu sekalian.
- **Hantu karyawan (P03)**: akun yang masih aktif setelah tanggal efektif adalah pintu masuk karyawan fiktif; cabut otomatis menutupnya.
- **Rekam Ilmu**: unggahan memakai jalur berkas yang sudah ada (bucket berkas, folder serah/{berhenti_id}), transkrip whisper di perangkat penerima (F2-03), langkah SOP oleh model ringan lewat Edge Function dengan aturan "keluaran model = masukan tak tepercaya": langkah disimpan sebagai saran, klip asli selalu ada.

## Risiko yang harus diuji (bukan diasumsikan)
- **Klaim JWT masih berlaku setelah dicabut**: perusahaan aktif dan peran ada di app_metadata JWT (pid, prn). Kebijakan yang memakai app.anggota_aktif() membaca tabel anggota (langsung tertutup), tetapi kebijakan yang hanya membandingkan perusahaan_id = app.pid() akan tetap terbuka sampai token kedaluwarsa. Tes SQL wajib: setelah cabut_akses_berhenti, JWT lama staf itu tidak bisa membaca orang, kerja, kejadian, usulan, slip. Bila ada yang masih terbuka, perbaiki kebijakannya (tambah app.anggota_aktif()) sebelum F3-07 dinyatakan selesai.
- Akun staf sintetis: banned_until mencegah login baru; sesi yang sudah ada tetap hidup sampai refresh token dipakai. Ukur dan tulis jujur di layar ("akses berhenti paling lambat 1 jam setelah 23.59") bila memang begitu.

## Tes SQL wajib (supabase/tests/serah_terima.test.sql)
Paket berisi semua topi dan kerja berjalan; butir ilmu muncul untuk topi tunggal; pengganti bukan orang yang berhenti; peringatan kurang_30_hari tidak memblokir; cabut dengan p_hari = tanggal efektif tidak mencabut, p_hari = efektif + 1 mencabut; setelah cabut, JWT lama ditolak di semua tabel inti; staf lain tidak melihat paket; isolasi tenant; kunci klien idempoten; ajukan_hak membuat usulan untuk pemilik; tidak ada DELETE data (status saja).
