-- Tes gerbang_gaji: data bersih korpus (30 karyawan dari fixtures/korpus/excel_karyawan/karyawan-30.json, absen 30 hari terakhir,
-- NIK dan rekening unik, ditambah karyawan baru tanpa absen dan karyawan yang sedang izin sakit) wajib 0 temuan; enam pegawai
-- siluman masing-masing tertangkap dengan kode yang benar; isolasi usaha; staf ditolak. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uadm uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kadm text; ks text;
  u1 uuid; r jsonb; n int; x text; o uuid; nyata uuid; s uuid; us uuid;
  h date := (now() at time zone 'Asia/Makassar')::date;
  baris constant jsonb := '[{"id": "K-101", "nama": "Nyoman Saputra", "jabatan": "Kasir", "telepon": "0812-0000-1000", "mulai": "2025-08-27", "gaji_pokok": 4800000}, {"id": "K-102", "nama": "Nyoman Hidayat", "jabatan": "Gudang", "telepon": "0812-0000-1001", "mulai": "2024-06-02", "gaji_pokok": 4300000}, {"id": "K-103", "nama": "Novi Kurniawan", "jabatan": "Pelayan", "telepon": "0812-0000-1002", "mulai": "2025-09-24", "gaji_pokok": 4450000}, {"id": "K-104", "nama": "Putu Astuti", "jabatan": "Kasir", "telepon": "0812-0000-1003", "mulai": "2026-01-03", "gaji_pokok": 3150000}, {"id": "K-105", "nama": "Indah Utami", "jabatan": "Gudang", "telepon": "0812-0000-1004", "mulai": "2022-09-18", "gaji_pokok": 5250000}, {"id": "K-106", "nama": "Siti Wijaya", "jabatan": "Koki", "telepon": "0812-0000-1005", "mulai": "2020-01-16", "gaji_pokok": 4650000}, {"id": "K-107", "nama": "Rudi Rahmawati", "jabatan": "Gudang", "telepon": "0812-0000-1006", "mulai": "2022-08-14", "gaji_pokok": 6300000}, {"id": "K-108", "nama": "Komang Saputra", "jabatan": "Kasir", "telepon": "0812-0000-1007", "mulai": "2024-03-12", "gaji_pokok": 4300000}, {"id": "K-109", "nama": "Hendra Pratama", "jabatan": "Gudang", "telepon": "0812-0000-1008", "mulai": "2023-12-04", "gaji_pokok": 3750000}, {"id": "K-110", "nama": "Wayan Kurniawan", "jabatan": "Pelayan", "telepon": "0812-0000-1009", "mulai": "2022-08-14", "gaji_pokok": 4950000}, {"id": "K-111", "nama": "Lestari Astuti", "jabatan": "Admin", "telepon": "0812-0000-1010", "mulai": "2023-10-21", "gaji_pokok": 5250000}, {"id": "K-112", "nama": "Andi Wijaya", "jabatan": "Admin", "telepon": "0812-0000-1011", "mulai": "2023-01-10", "gaji_pokok": 5800000}, {"id": "K-113", "nama": "Sari Astuti", "jabatan": "Koki", "telepon": "0812-0000-1012", "mulai": "2020-10-14", "gaji_pokok": 5100000}, {"id": "K-114", "nama": "Agus Wijaya", "jabatan": "Koki", "telepon": "0812-0000-1013", "mulai": "2023-01-20", "gaji_pokok": 5400000}, {"id": "K-115", "nama": "Andi Santoso", "jabatan": "Barista", "telepon": "0812-0000-1014", "mulai": "2023-12-10", "gaji_pokok": 4250000}, {"id": "K-116", "nama": "Wayan Utami", "jabatan": "Koki", "telepon": "0812-0000-1015", "mulai": "2025-03-21", "gaji_pokok": 3300000}, {"id": "K-117", "nama": "Rina Lestari", "jabatan": "Gudang", "telepon": "0812-0000-1016", "mulai": "2026-02-28", "gaji_pokok": 6400000}, {"id": "K-118", "nama": "Lestari Permana", "jabatan": "Koki", "telepon": "0812-0000-1017", "mulai": "2026-08-04", "gaji_pokok": 4150000}, {"id": "K-119", "nama": "Andi Utami", "jabatan": "Admin", "telepon": "0812-0000-1018", "mulai": "2022-10-08", "gaji_pokok": 6250000}, {"id": "K-120", "nama": "Siti Gunawan", "jabatan": "Barista", "telepon": "0812-0000-1019", "mulai": "2024-10-11", "gaji_pokok": 3850000}, {"id": "K-121", "nama": "Nyoman Utami", "jabatan": "Pelayan", "telepon": "0812-0000-1020", "mulai": "2021-05-20", "gaji_pokok": 4750000}, {"id": "K-122", "nama": "Andi Sudarma", "jabatan": "Admin", "telepon": "0812-0000-1021", "mulai": "2023-09-13", "gaji_pokok": 2950000}, {"id": "K-123", "nama": "Sari Lestari", "jabatan": "Koki", "telepon": "0812-0000-1022", "mulai": "2022-02-25", "gaji_pokok": 5900000}, {"id": "K-124", "nama": "Nyoman Wijaya", "jabatan": "Pelayan", "telepon": "0812-0000-1023", "mulai": "2019-12-08", "gaji_pokok": 5900000}, {"id": "K-125", "nama": "Dimas Permana", "jabatan": "Gudang", "telepon": "0812-0000-1024", "mulai": "2021-12-21", "gaji_pokok": 3450000}, {"id": "K-126", "nama": "Budi Santoso", "jabatan": "Barista", "telepon": "0812-0000-1025", "mulai": "2022-05-05", "gaji_pokok": 5350000}, {"id": "K-127", "nama": "Wayan Gunawan", "jabatan": "Kasir", "telepon": "0812-0000-1026", "mulai": "2022-09-02", "gaji_pokok": 4300000}, {"id": "K-128", "nama": "Made Permana", "jabatan": "Pelayan", "telepon": "0812-0000-1027", "mulai": "2019-12-27", "gaji_pokok": 3150000}, {"id": "K-129", "nama": "Indah Rahmawati", "jabatan": "Pelayan", "telepon": "0812-0000-1028", "mulai": "2024-05-18", "gaji_pokok": 3250000}, {"id": "K-130", "nama": "Bayu Gunawan", "jabatan": "Pelayan", "telepon": "0812-0000-1029", "mulai": "2020-12-02", "gaji_pokok": 6200000}]';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (uadm, 'adm@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Bersih', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Siluman', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kadm := json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'admin'))::text;
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uadm, 'admin'), (pb, uadm, 'admin');

  -- ===== Data bersih (usaha A) =====
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload)
  values (pa, 'lempar', 'orang.impor', 'Tambah 30 orang', jsonb_build_object('jenis', 'excel_karyawan', 'bidang', jsonb_build_object('baris', baris))) returning id into u1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r := public.putuskan_usulan(u1, true);
  perform pg_temp.cek('korpus: 30 karyawan diimpor dengan gaji', (r ->> 'dibuat')::int = 30, r::text);
  -- NIK dan rekening unik per orang (hash sintetis), absen 3 hari lalu untuk semua.
  update public.orang_rahasia set nik_hash = md5('nik' || orang_id), nik_akhir = '0001', rekening_hash = md5('rek' || orang_id), rekening_akhir = '1234' where perusahaan_id = pa;
  execute 'reset role';
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id)
  select pa, ((h - 3)::timestamp + time '08:00') at time zone 'Asia/Makassar', 'absen.masuk', 'pwa', id from public.orang where perusahaan_id = pa;
  -- Karyawan baru (mulai 5 hari lalu, belum absen) dan karyawan yang 20 hari terakhir hanya izin sakit.
  insert into public.orang (perusahaan_id, nama, telepon, data) values (pa, 'Baru Masuk', '0813-1111-2222', jsonb_build_object('mulai', (h - 5)::text)) returning id into o;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji, nik_hash, rekening_hash) values (o, pa, '{"pokok": 3000000}', md5('nik-baru'), md5('rek-baru'));
  update public.orang set telepon = '0813-9999-0000' where perusahaan_id = pa and nama = (baris -> 0 ->> 'nama');
  insert into public.orang (perusahaan_id, nama, data) values (pa, 'Sakit Panjang', '{"mulai": "2023-02-01"}') returning id into o;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o, pa, '{"pokok": 3500000}');
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai) values (pa, ((h - 20)::timestamp) at time zone 'Asia/Makassar', 'izin.sakit', 'pwa', o, 21);
  -- Karyawan tetap dengan kontrak masih berlaku, dan kandidat/pemasok tanpa absen (bukan penerima gaji).
  update public.orang set data = data || jsonb_build_object('kontrak_selesai', (h + 60)::text) where perusahaan_id = pa and nama = (baris -> 1 ->> 'nama');
  insert into public.orang (perusahaan_id, nama, jenis, status) values (pa, 'Calon Kasir', '{kandidat}', 'kandidat_baru'), (pa, 'Pemasok Beras', '{pemasok}', 'aktif');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*), string_agg(nama || ':' || kode, ', ') into n, x from public.gerbang_gaji();
  perform pg_temp.cek('data bersih: 0 temuan untuk pemilik', n = 0, x);
  perform set_config('request.jwt.claims', json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text, true);
  select count(*), string_agg(nama || ':' || kode, ', ') into n, x from public.gerbang_gaji();
  perform pg_temp.cek('data bersih: 0 temuan untuk admin yang tidak mengubah apa pun', n = 0, x);
  select count(*) into n from public.gerbang_gaji(h + 40);
  perform pg_temp.cek('gerbang mendeteksi bila 40 hari tanpa absen (bukti sinyal hidup)', n = 32, n::text);

  -- ===== Siluman (usaha B) =====
  perform set_config('request.jwt.claims', kb, true);
  -- Karyawan nyata pembanding.
  insert into public.orang (perusahaan_id, nama, telepon, data) values (pb, 'Ani Nyata', '0812-3456-7890', '{"mulai": "2024-01-10"}') returning id into nyata;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji, nik_hash, rekening) values (nyata, pb, '{"pokok": 4000000}', md5('nik-ani'), '1234567890');
  -- S1: tanpa tanda hidup.
  insert into public.orang (perusahaan_id, nama, data) values (pb, 'S1 Hantu', '{"mulai": "2025-01-05"}') returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (s, pb, '{"pokok": 3800000}');
  -- S2: rekening sama dengan Ani (sejak M-10B rekening_hash diisi trigger dari nomor rekening, jadi tes memakai nomor).
  insert into public.orang (perusahaan_id, nama, data) values (pb, 'S2 Rekening', '{"mulai": "2025-01-05"}') returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji, rekening) values (s, pb, '{"pokok": 3800000}', '1234567890');
  -- S3: HP sama dengan Ani (format berbeda).
  insert into public.orang (perusahaan_id, nama, telepon, data) values (pb, 'S3 Telepon', '+62 812 3456 7890', '{"mulai": "2025-01-05"}') returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (s, pb, '{"pokok": 3800000}');
  -- S4: NIK sama dengan Ani.
  insert into public.orang (perusahaan_id, nama, data) values (pb, 'S4 NIK', '{"mulai": "2025-01-05"}') returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji, nik_hash) values (s, pb, '{"pokok": 3800000}', md5('nik-ani'));
  -- S5: kontrak habis.
  insert into public.orang (perusahaan_id, nama, data) values (pb, 'S5 Kontrak', jsonb_build_object('mulai', '2025-01-05', 'kontrak_selesai', (h - 10)::text)) returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (s, pb, '{"pokok": 3800000}');
  -- S6: dibuat dan diberi gaji oleh admin yang juga akan menyetujui gaji.
  perform set_config('request.jwt.claims', kadm, true);
  insert into public.orang (perusahaan_id, nama, data) values (pb, 'S6 Titipan Admin', '{"mulai": "2024-06-01"}') returning id into s;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (s, pb, '{"pokok": 5500000}');
  execute 'reset role';
  -- Semua kecuali S1 punya absen.
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id)
  select pb, ((h - 2)::timestamp + time '08:00') at time zone 'Asia/Makassar', 'absen.masuk', 'pwa', id from public.orang where perusahaan_id = pb and nama <> 'S1 Hantu';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kadm, true);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S1 Hantu';
  perform pg_temp.cek('S1 tanpa absen 30 hari tertangkap', x = 'tanpa_tanda_hidup', x);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S2 Rekening';
  perform pg_temp.cek('S2 rekening ganda tertangkap', x = 'rekening_ganda', x);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S3 Telepon';
  perform pg_temp.cek('S3 HP ganda (format berbeda) tertangkap', x = 'hp_ganda', x);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S4 NIK';
  perform pg_temp.cek('S4 NIK ganda tertangkap', x = 'nik_ganda', x);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S5 Kontrak';
  perform pg_temp.cek('S5 kontrak habis tertangkap', x = 'kontrak_habis', x);
  select string_agg(kode, ',' order by kode) into x from public.gerbang_gaji() where nama = 'S6 Titipan Admin';
  perform pg_temp.cek('S6 pemisahan tugas tertangkap untuk admin penyetuju', x = 'pemisahan_tugas', x);
  select alasan into x from public.gerbang_gaji() where nama = 'S2 Rekening';
  perform pg_temp.cek('alasan menyebut nama pasangan tanpa menuduh', x = 'Rekeningnya sama dengan Ani Nyata. Satu rekening untuk dua gaji perlu dicek dulu.', x);
  select alasan into x from public.gerbang_gaji() where nama = 'S1 Hantu';
  perform pg_temp.cek('alasan tanda hidup menyebut tanggal', x like 'Belum ada absen atau izin sejak % %. Pastikan orang ini masih bekerja%', x);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('pemilik sebagai penyetuju: S6 tidak ditandai pemisahan tugas', not exists (select 1 from public.gerbang_gaji() where kode = 'pemisahan_tugas'));
  select count(distinct nama) into n from public.gerbang_gaji() where nama like 'S%';
  perform pg_temp.cek('pemilik tetap melihat lima siluman lain', n = 5, n::text);
  perform pg_temp.cek('usaha lain tidak bocor ke gerbang', not exists (select 1 from public.gerbang_gaji() g join public.orang o on o.id = g.orang_id where o.perusahaan_id <> pb));

  -- Staf ditolak.
  execute 'reset role';
  insert into public.orang (perusahaan_id, nama) values (pb, 'Staf Biasa') returning id into o;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  perform public.buat_akun_staf(o, '112233');
  select user_id into us from public.orang where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'staf'))::text, true);
  begin
    perform count(*) from public.gerbang_gaji();
    perform pg_temp.cek('staf tidak bisa menjalankan gerbang gaji', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menjalankan gerbang gaji', true);
  end;
  execute 'reset role';
  perform pg_temp.cek('hp_normal menyamakan 0812 dan +62 812', app.hp_normal('0812-3456-7890') = app.hp_normal('+62 812 3456 7890') and app.hp_normal('12') is null);
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
