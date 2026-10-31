-- Tes topi_impor: jabatan Excel menjadi topi berporsi, sinonim dikenali, topi baru dibuat, impor ulang tidak menggandakan,
-- kerja lintas topi tertanda otomatis. Transaksi dibatalkan di akhir lewat RAISE EXCEPTION; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; u1 uuid; u2 uuid; r jsonb; n int; x text;
  v_dewi uuid; v_made uuid; k1 uuid; k2 uuid;
  baris constant jsonb := '[
    {"id": "K-01", "nama": "Dewi Anggraini", "jabatan": "Kasir, gudang", "telepon": "", "mulai": "2025-03-01", "gaji_pokok": 3500000},
    {"id": "K-02", "nama": "Made Wirawan", "jabatan": "Juru masak", "telepon": "", "mulai": "2024-07-15", "gaji_pokok": 4200000},
    {"id": "K-03", "nama": "Kadek Sumiati", "jabatan": "Pelayan / antar pesanan", "telepon": "", "mulai": "", "gaji_pokok": 0},
    {"id": "K-04", "nama": "Rina Kartika", "jabatan": "Admin", "telepon": "", "mulai": "2026-01-02", "gaji_pokok": 3800000},
    {"id": "K-05", "nama": "Bagus Pratama", "jabatan": "Barista", "telepon": "", "mulai": "2026-09-01", "gaji_pokok": 3300000},
    {"id": "K-06", "nama": "Sinta Maharani", "jabatan": "", "telepon": "", "mulai": "", "gaji_pokok": 0}
  ]';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  perform public.pasang_paket('toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  perform public.pasang_paket('fnb');
  execute 'reset role';

  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values
    (pa, 'lempar', 'orang.impor', 'Tambah 6 orang', jsonb_build_object('jenis', 'excel_karyawan', 'bidang', jsonb_build_object('baris', baris))) returning id into u1;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values
    (pa, 'lempar', 'orang.impor', 'Tambah 6 orang lagi', jsonb_build_object('jenis', 'excel_karyawan', 'bidang', jsonb_build_object('baris', baris))) returning id into u2;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r := public.putuskan_usulan(u1, true);
  perform pg_temp.cek('impor 6 orang', (r ->> 'dibuat')::int = 6, r::text);
  select count(*) into n from public.orang o where o.perusahaan_id = pa and exists (select 1 from public.pakai_topi p where p.orang_id = o.id);
  perform pg_temp.cek('5 orang berjabatan mendapat topi, yang tanpa jabatan tidak', n = 5, n::text);
  select id into v_dewi from public.orang where perusahaan_id = pa and nama = 'Dewi Anggraini';
  select string_agg(t.kode || ':' || p.porsi, ',' order by t.kode) into x from public.pakai_topi p join public.topi t on t.id = p.topi_id where p.orang_id = v_dewi;
  perform pg_temp.cek('Kasir, gudang menjadi dua topi paket 50/50', x = 'gudang:50.00,kasir:50.00', x);
  perform pg_temp.cek('mulai topi dari tanggal mulai di Excel', (select min(mulai) from public.pakai_topi where orang_id = v_dewi) = '2025-03-01');
  select id into v_made from public.orang where perusahaan_id = pa and nama = 'Made Wirawan';
  select string_agg(t.kode || ':' || coalesce(t.asal_paket, '-'), ',') into x from public.pakai_topi p join public.topi t on t.id = p.topi_id where p.orang_id = v_made;
  perform pg_temp.cek('Juru masak dikenali sebagai topi koki dari paket', x = 'koki:fnb', x);
  select string_agg(t.kode, ',' order by t.kode) into x from public.pakai_topi p join public.topi t on t.id = p.topi_id join public.orang o on o.id = p.orang_id where o.nama = 'Kadek Sumiati';
  perform pg_temp.cek('Pelayan / antar pesanan: pelayan dari paket + kurir baru', x = 'kurir,pelayan', x);
  perform pg_temp.cek('Admin menjadi topi baru buatan usaha', exists (select 1 from public.topi where perusahaan_id = pa and kode = 'admin' and asal_paket is null));
  perform pg_temp.cek('porsi setiap orang berjumlah 100', not exists (select 1 from public.pakai_topi where perusahaan_id = pa group by orang_id having sum(porsi) <> 100));
  perform pg_temp.cek('topi usaha lain tidak dipakai', not exists (select 1 from public.pakai_topi p join public.topi t on t.id = p.topi_id where p.perusahaan_id = pa and t.perusahaan_id <> pa));

  r := public.putuskan_usulan(u2, true);
  select count(*) into n from public.pakai_topi where perusahaan_id = pa;
  perform pg_temp.cek('impor ulang: semua dilewati, topi tidak berlipat', (r ->> 'dibuat')::int = 0 and (r ->> 'dilewati')::int = 6 and n = 7, r::text || ' topi=' || n);

  -- Kerja lintas topi: Dewi (kasir+gudang) mengerjakan tugas koki = lintas; Made (koki) = tidak.
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id)
    values (pa, 'Siapkan bumbu dasar', (select id from public.topi where perusahaan_id = pa and kode = 'koki'), v_dewi) returning id into k1;
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id)
    values (pa, 'Siapkan bumbu dasar', (select id from public.topi where perusahaan_id = pa and kode = 'koki'), v_made) returning id into k2;
  perform pg_temp.cek('kerja di luar topi pelaksana tertanda lintas topi', (select lintas_topi from public.kerja where id = k1));
  perform pg_temp.cek('kerja sesuai topi pelaksana tidak lintas', not (select lintas_topi from public.kerja where id = k2));
  update public.kerja set pelaksana_id = v_made where id = k1;
  perform pg_temp.cek('ganti pelaksana menghitung ulang tanda lintas', not (select lintas_topi from public.kerja where id = k1));
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
