-- Tes M-24 pindah (supabase/migrations/20261105095000_pindah.sql): baris dari korpus fixtures/korpus/pindah (kolom template Jurnal)
-- menjadi usulan; setelah disetujui akun dipetakan ke bagan Nadi (kas tetap 1-1%, piutang/persediaan tidak terhitung kas), saldo
-- awal seimbang, kontak pelanggan masuk dengan HP dinormalkan, produk + stok awal, karyawan lewat orang.impor; berkas sama ditolak;
-- staf dan usaha lain ditolak. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o1 uuid;
  u uuid; r jsonb; lap jsonb; v_hari date; akun jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'pi.a@uji.local'), (ub, 'pi.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Pindah', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Pindah', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Uji') returning id into o1;
    perform public.buat_akun_staf(o1, '560001');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o1;
    akun := '[{"kode_asal": "1-10001", "nama": "Kas Toko", "kategori": 3, "saldo": 2500000}, {"kode_asal": "1-10002", "nama": "Bank BCA Usaha", "kategori": 3, "saldo": 18750000},
      {"kode_asal": "1-10100", "nama": "Piutang Usaha", "kategori": 1, "saldo": 4200000}, {"kode_asal": "1-10200", "nama": "Persediaan Barang Dagang", "kategori": 4, "saldo": 9600000},
      {"kode_asal": "1-10700", "nama": "Peralatan Toko", "kategori": 5, "saldo": 12000000}, {"kode_asal": "1-10751", "nama": "Akumulasi Penyusutan Peralatan", "kategori": 7, "saldo": 3000000},
      {"kode_asal": "2-20100", "nama": "Utang Usaha", "kategori": 8, "saldo": 5100000}, {"kode_asal": "3-30000", "nama": "Modal Pemilik", "kategori": 12, "saldo": 38950000},
      {"kode_asal": "4-40000", "nama": "Pendapatan Penjualan", "kategori": 13}, {"kode_asal": "5-50000", "nama": "Harga Pokok Penjualan", "kategori": 15},
      {"kode_asal": "6-60200", "nama": "Beban Listrik dan Air", "kategori": 16}, {"kode_asal": "8-80100", "nama": "Beban Bunga Bank", "kategori": 17}, {"nama": "Tanpa kategori"}]';

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.propose_migration('akun', 'jurnal-akun.csv', akun); perform pg_temp.cek('staf tidak mengajukan pindah data', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengajukan pindah data', true); end;

    perform set_config('request.jwt.claims', ka, true);
    begin perform public.propose_migration('invoice', 'x.csv', '[{"a": 1}]'); perform pg_temp.cek('format di luar daftar ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('format di luar daftar ditolak', true); end;
    u := public.propose_migration('akun', 'jurnal-akun.csv', akun);
    perform pg_temp.cek('usulan pindah akun untuk pemilik, belum berlaku', (select status = 'menunggu' and aksi = 'pindah.akun' and 'pemilik' = any(untuk_peran) from public.usulan where id = u)
      and not exists (select 1 from public.akun where perusahaan_id = pa and nama = 'Peralatan Toko'));
    begin perform public.propose_migration('akun', 'jurnal-akun.csv', akun); perform pg_temp.cek('berkas sama tidak diajukan dua kali', false);
    exception when sqlstate '23505' then perform pg_temp.cek('berkas sama tidak diajukan dua kali', true); end;

    perform set_config('request.jwt.claims', kb, true);
    begin perform public.putuskan_usulan(u, true); perform pg_temp.cek('usaha lain tidak menyetujui', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak menyetujui', true); end;

    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('akun pertama digabung ke akun bawaan (kas 1-100, bank 1-110, piutang 1-200, persediaan 1-300, utang 2-100, modal 3-100, penjualan 4-100, HPP 5-100, beban lain 6-900)',
      (select string_agg(nama_asal || '=' || akun_kode, ',' order by nama_asal) from public.pindah_akun where digabung)
        = 'Bank BCA Usaha=1-110,Beban Bunga Bank=6-900,Harga Pokok Penjualan=5-100,Kas Toko=1-100,Modal Pemilik=3-100,Pendapatan Penjualan=4-100,Persediaan Barang Dagang=1-300,Piutang Usaha=1-200,Utang Usaha=2-100',
      (select string_agg(nama_asal || '=' || akun_kode, ',' order by nama_asal) from public.pindah_akun));
    perform pg_temp.cek('akun tanpa padanan diberi kode Nadi di bloknya (peralatan 1-510, akumulasi 1-590 kredit, listrik 6-400)',
      (select kode || ':' || saldo_normal from public.akun where nama = 'Peralatan Toko') = '1-510:debit'
      and (select kode || ':' || saldo_normal from public.akun where nama = 'Akumulasi Penyusutan Peralatan') = '1-590:kredit'
      and (select kode from public.akun where nama = 'Beban Listrik dan Air') = '6-400');
    perform pg_temp.cek('baris tanpa kategori dilewati, tercatat', (select (data ->> 'dilewati')::int from public.kejadian where jenis = 'pindah.akun.diterapkan' and data ->> 'usulan_id' = u::text) = 1);
    lap := public.laporan_keuangan(v_hari, v_hari);
    perform pg_temp.cek('saldo awal seimbang: aset 44.050.000 = kewajiban 5.100.000 + modal 38.950.000',
      (lap -> 'neraca' ->> 'aset')::bigint = 44050000 and (lap -> 'neraca' ->> 'kewajiban')::bigint = 5100000 and (lap -> 'neraca' ->> 'modal')::bigint = 38950000
      and (lap -> 'neraca' ->> 'seimbang')::boolean, (lap -> 'neraca')::text);
    perform pg_temp.cek('kas dan bank 21.250.000 (piutang dan persediaan tidak terhitung kas)', (lap -> 'arus_kas' ->> 'kas_akhir')::bigint = 21250000, (lap -> 'arus_kas')::text);

    -- Kontak.
    u := public.propose_migration('kontak', 'jurnal-kontak.csv', '[{"tipe": ["customer"], "nama": "Hotel Segara", "perusahaan": "PT Segara Jaya", "email": "pembelian@segara-uji.test", "hp": "081234567801", "kota": "Badung"},
      {"tipe": ["customer"], "nama": "Warung Bu Ani", "hp": "0812 3456 7802", "kota": "Denpasar"}, {"tipe": ["vendor"], "nama": "CV Sumber Beras"},
      {"tipe": ["customer", "vendor"], "nama": "Koperasi Tani Makmur", "perusahaan": "Koperasi Tani Makmur", "email": "koperasi@tani-uji.test", "hp": "+62 812-3456-7804"},
      {"tipe": ["employee"], "nama": "Budi Santoso"}, {"tipe": ["others"], "nama": "Dinas Pasar"}, {"tipe": ["customer"], "nama": "Email Salah", "email": "bukan-email", "hp": "12"}]');
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('4 pelanggan masuk, HP jadi 62..., email salah dikosongkan; pemasok/karyawan/lainnya dilewati',
      (select count(*) from public.customer where perusahaan_id = pa) = 4
      and (select hp from public.customer where nama = 'Warung Bu Ani') = '6281234567802' and (select hp from public.customer where nama = 'Koperasi Tani Makmur') = '6281234567804'
      and (select jenis from public.customer where nama = 'Hotel Segara') = 'perusahaan' and (select email is null and hp is null from public.customer where nama = 'Email Salah')
      and (select (data ->> 'dilewati')::int from public.kejadian where jenis = 'pindah.kontak.diterapkan' and data ->> 'usulan_id' = u::text) = 3);

    -- Produk + stok awal.
    u := public.propose_migration('produk', 'produk-umum.csv', '[{"kode": "GLP-1", "nama": "Gula Pasir 1 kg", "satuan": "bks", "harga_jual": 18500, "stok": 40},
      {"kode": "BRS-5", "nama": "Beras Premium 5 kg", "satuan": "sak", "harga_jual": 82000, "stok": 12}, {"kode": "KPI-200", "nama": "Kopi Bubuk 200 g", "satuan": "bks", "harga_jual": 27500}]');
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('3 produk dengan harga, stok awal 40 dan 12 lewat opname', (select count(*) from public.produk where perusahaan_id = pa) = 3
      and (select harga_jual from public.produk where kode = 'BRS-5') = 82000
      and (select sum(s.jumlah) from public.stok s join public.produk p on p.id = s.produk_id where p.kode = 'GLP-1') = 40
      and (select coalesce(sum(s.jumlah), 0) from public.stok s join public.produk p on p.id = s.produk_id where p.kode = 'KPI-200') = 0);

    -- Karyawan lewat orang.impor.
    u := public.propose_migration('karyawan', 'karyawan-umum.csv', '[{"id": "K-001", "nama": "Sari Dewi", "jabatan": "Kasir", "telepon": "6281211112201", "mulai": "2024-02-01", "gaji_pokok": 3200000},
      {"id": "K-002", "nama": "Komang Ayu", "jabatan": "Barista", "mulai": "2025-08-15"}]');
    perform pg_temp.cek('karyawan memakai aksi orang.impor', (select aksi from public.usulan where id = u) = 'orang.impor');
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('2 orang masuk dengan tanggal mulai', (select count(*) from public.orang where perusahaan_id = pa and nama in ('Sari Dewi', 'Komang Ayu')) = 2
      and (select data ->> 'mulai' from public.orang where nama = 'Sari Dewi') = '2024-02-01');

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat pemetaan akun maupun usulan pindah', (select count(*) from public.pindah_akun) = 0
      and (select count(*) from public.usulan where sumber = 'pindah') = 0 and (select count(*) from public.customer) = 0);
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
