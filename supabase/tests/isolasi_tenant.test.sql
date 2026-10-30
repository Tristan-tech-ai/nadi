-- Tes isolasi tenant dan hak akses Graf Usaha. Dijalankan lewat execute_sql; seluruh transaksi dibatalkan di akhir dengan
-- RAISE EXCEPTION yang memuat hasil, jadi tidak ada data yang tertinggal. Lulus bila pesan akhirnya memuat "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pb uuid; o1 uuid; o2 uuid; tk uuid; tp uuid; n int; u1 uuid; u2 uuid;
  klaim_a text; klaim_b text; klaim_s text;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (us, 's@uji.local');

  -- Pemilik A membuat perusahaan A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  pa := public.buat_perusahaan('Warung Uji A', 'fnb', 'perorangan');
  execute 'reset role';
  perform pg_temp.cek('buat_perusahaan menulis klaim pid ke app_metadata', (select raw_app_meta_data ->> 'pid' from auth.users where id = ua) = pa::text);
  perform pg_temp.cek('pembuat menjadi pemilik', (select peran from public.anggota where perusahaan_id = pa and user_id = ua) = 'pemilik');

  klaim_a := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', klaim_a, true);
  execute 'set local role authenticated';
  perform pg_temp.cek('A melihat satu perusahaan', (select count(*) from public.perusahaan) = 1);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o2;
  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir', 'Kasir') returning id into tk;
  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'gudang', 'Gudang') returning id into tp;
  insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi) values (pa, o1, tk, 70);
  insert into public.tempat (perusahaan_id, jalur, nama, jenis) values (pa, 'outlet1', 'Outlet 1', 'lokasi');
  insert into public.tempat (perusahaan_id, jalur, nama, jenis) values (pa, 'outlet1.meja4', 'Meja 4', 'meja');
  perform pg_temp.cek('ltree: turunan outlet1 ada 2', (select count(*) from public.tempat where jalur operator(extensions.<@) 'outlet1') = 2);
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (pa, 'Tutup kas', tk, o1);
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (pa, 'Hitung stok', tp, o1);
  perform pg_temp.cek('kerja sesuai topi: lintas_topi false', (select lintas_topi from public.kerja where judul = 'Tutup kas') = false);
  perform pg_temp.cek('kerja di luar topi: lintas_topi true', (select lintas_topi from public.kerja where judul = 'Hitung stok') = true);
  insert into public.orang_rahasia (orang_id, perusahaan_id, nik_akhir) values (o1, pa, '1234');
  perform pg_temp.cek('pemilik membaca data rahasia', (select count(*) from public.orang_rahasia) = 1);
  perform pg_temp.cek('pemilik melihat audit orang', (select count(*) from public.audit_log where tabel = 'orang') = 2);
  perform pg_temp.cek('audit rahasia tanpa nilai', (select bool_and(sesudah is null) from public.audit_log where tabel = 'orang_rahasia'));
  begin
    insert into public.kejadian (perusahaan_id, jenis, sumber) values (pa, 'absen.masuk', 'pwa');
    perform pg_temp.cek('klien tidak menulis kejadian langsung', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('klien tidak menulis kejadian langsung', true, sqlerrm); end;
  begin
    insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber) values ('x', '1', current_date, 'x');
    perform pg_temp.cek('bank publik tidak bisa ditulis klien', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('bank publik tidak bisa ditulis klien', true, sqlerrm); end;
  execute 'reset role';

  -- Kejadian kemarin ditulis sisi server, lalu diringkas
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, nilai, terjadi_at)
  select pa, 'absen.masuk', 'pwa', o1, 1, (current_date - 1)::timestamptz + interval '3 hours' from generate_series(1, 3);
  n := app.ringkas_hari(current_date - 1);
  n := app.ringkas_hari(current_date - 1);

  -- Pemilik B membuat perusahaan B
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  pb := public.buat_perusahaan('Toko Uji B', 'toko', 'cv');
  klaim_b := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', klaim_b, true);
  perform pg_temp.cek('B hanya melihat perusahaan B', (select count(*) from public.perusahaan) = 1 and (select id from public.perusahaan) = pb);
  perform pg_temp.cek('B tidak melihat orang A', (select count(*) from public.orang where perusahaan_id = pa) = 0);
  perform pg_temp.cek('B tidak melihat topi A', (select count(*) from public.topi) = 0);
  perform pg_temp.cek('B tidak melihat kerja A', (select count(*) from public.kerja) = 0);
  perform pg_temp.cek('B tidak melihat tempat A', (select count(*) from public.tempat) = 0);
  perform pg_temp.cek('B tidak melihat kejadian A', (select count(*) from public.kejadian) = 0);
  perform pg_temp.cek('B tidak melihat ringkasan A', (select count(*) from public.ringkasan_harian) = 0);
  perform pg_temp.cek('B tidak melihat rahasia A', (select count(*) from public.orang_rahasia) = 0);
  perform pg_temp.cek('B tidak melihat audit A', (select count(*) from public.audit_log where perusahaan_id = pa) = 0);
  perform pg_temp.cek('B tidak melihat anggota A', (select count(*) from public.anggota where perusahaan_id = pa) = 0);
  begin
    insert into public.orang (perusahaan_id, nama) values (pa, 'Penyusup');
    perform pg_temp.cek('B tidak bisa menulis ke A', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('B tidak bisa menulis ke A', true, sqlerrm); end;
  update public.orang set nama = 'Diubah B' where id = o1;
  get diagnostics n = row_count;
  perform pg_temp.cek('B tidak bisa mengubah orang A', n = 0);
  begin
    perform public.pindah_perusahaan(pa);
    perform pg_temp.cek('B tidak bisa pindah ke perusahaan A', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('B tidak bisa pindah ke perusahaan A', true, sqlerrm); end;
  -- Klaim palsu: pid A tanpa keanggotaan tetap tidak bisa dibuat lewat app_metadata karena hanya fungsi server yang menulisnya.
  perform pg_temp.cek('klaim tanpa pid tidak melihat apa pun', (select count(*) from public.orang) = 0);
  execute 'reset role';

  -- Staf S di perusahaan A
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
  klaim_s := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', klaim_s, true);
  execute 'set local role authenticated';
  perform pg_temp.cek('staf melihat orang di perusahaannya', (select count(*) from public.orang) = 2);
  perform pg_temp.cek('staf tidak melihat data rahasia', (select count(*) from public.orang_rahasia) = 0);
  perform pg_temp.cek('staf tidak melihat audit', (select count(*) from public.audit_log) = 0);
  begin
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tambahan staf');
    perform pg_temp.cek('staf tidak bisa menambah orang', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('staf tidak bisa menambah orang', true, sqlerrm); end;
  insert into public.berkas (perusahaan_id, jalur, diunggah_oleh) values (pa, pa || '/lempar/s.jpg', us);
  perform pg_temp.cek('staf hanya melihat berkas miliknya', (select count(*) from public.berkas) = 1);
  begin
    insert into public.berkas (perusahaan_id, jalur, diunggah_oleh) values (pa, pa || '/lempar/x.jpg', ua);
    perform pg_temp.cek('staf tidak bisa mengunggah atas nama orang lain', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('staf tidak bisa mengunggah atas nama orang lain', true, sqlerrm); end;
  begin
    perform count(*) from public.kejadian_p20261001;
    perform pg_temp.cek('partisi anak tertutup dari API', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('partisi anak tertutup dari API', true, sqlerrm); end;
  execute 'reset role';

  -- Pemilik A: ringkasan dan keanggotaan
  perform set_config('request.jwt.claims', klaim_a, true);
  execute 'set local role authenticated';
  perform pg_temp.cek('ringkasan harian: 3 absen kemarin, idempoten', (select jumlah from public.ringkasan_harian where orang_id = o1) = 3
                      and (select count(*) from public.ringkasan_harian) = 1);
  perform pg_temp.cek('A melihat berkas staf (pengelola)', (select count(*) from public.berkas) = 1);
  execute 'reset role';
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('pid', pa, 'prn', 'staf') where id = us;
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = us;
  perform pg_temp.cek('keanggotaan dicabut menghapus klaim', (select raw_app_meta_data ? 'pid' from auth.users where id = us) = false);

  execute 'set local role anon';
  begin
    perform count(*) from public.orang;
    perform pg_temp.cek('anon tidak membaca orang', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('anon tidak membaca orang', true, sqlerrm); end;
  perform pg_temp.cek('anon membaca paket industri', (select count(*) from public.paket_industri) >= 0);
  execute 'reset role';

  u1 := app.uuid7(); perform pg_sleep(0.002); u2 := app.uuid7();
  perform pg_temp.cek('uuid7 berurutan waktu dan versi 7', u2::text > u1::text and substring(u1::text, 15, 1) = '7');
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '')
    into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
