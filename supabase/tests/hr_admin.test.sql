-- Tes M-11: profil kerja + riwayat + atasan (tanpa lingkaran), surat peringatan berurutan dengan masa berlaku (Penjelasan
-- PP 35/2021 Pasal 52 ayat (1)), pengumuman + tanda baca, daftar periksa; staf hanya melihat datanya sendiri; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  o1 uuid; o2 uuid; o3 uuid; r jsonb; g text; p1 uuid; p2 uuid; hari date;
begin
  insert into auth.users (id, email) values (ua, 'hr1@uji.local'), (ub, 'hr2@uji.local'), (us, 'hr3@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko HR A', 'ritel');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko HR B', 'ritel');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Bu Manajer', array['karyawan'], null) returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kasir Staf', array['karyawan'], us) returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Gudang Lain', array['karyawan']) returning id into o3;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, us, 'staf', o2);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  -- Profil + riwayat + atasan.
  r := public.ubah_profil_kerja(o1, 'Manajer toko', 'M1', 'Operasional', null, 'pkwtt', null, 'perubahan', null, null);
  r := public.ubah_profil_kerja(o2, 'Kasir', 'S1', 'Operasional', o1, 'pkwt', (hari + 365), 'perubahan', hari - 30, null);
  perform pg_temp.cek('profil pertama dicatat sebagai masuk', (select jenis = 'masuk' and berlaku_dari = hari - 30 from public.riwayat_kerja where orang_id = o2));
  r := public.ubah_profil_kerja(o2, 'Kepala kasir', 'S2', 'Operasional', o1, 'pkwt', (hari + 365), 'promosi', hari, 'Kinerja 6 bulan baik');
  perform pg_temp.cek('promosi menambah riwayat, profil berubah', (select count(*) from public.riwayat_kerja where orang_id = o2) = 2
    and (select jabatan = 'Kepala kasir' and level = 'S2' from public.profil_kerja where orang_id = o2));
  r := public.ubah_profil_kerja(o2, 'Kepala kasir', 'S2', 'Operasional', o1, 'pkwt', (hari + 400), 'perubahan', null, null);
  perform pg_temp.cek('ubah tanggal kontrak saja tidak menambah riwayat jabatan', (r ->> 'riwayat')::boolean = false and (select count(*) from public.riwayat_kerja where orang_id = o2) = 2);
  begin perform public.ubah_profil_kerja(o1, 'Manajer toko', 'M1', 'Operasional', o2, 'pkwtt', null, 'perubahan', null, null); perform pg_temp.cek('atasan melingkar ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('atasan melingkar ditolak', g like '%lingkaran%', g); end;
  begin perform public.ubah_profil_kerja(o3, 'Gudang', null, null, null, 'pkwt', null, 'perubahan', null, null); perform pg_temp.cek('PKWT tanpa tanggal akhir ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('PKWT tanpa tanggal akhir ditolak', true); end;

  -- Surat peringatan: SP1, lalu SP2 dalam masa SP1, lalu SP3, lalu ditolak (dasar PHK); kunci sama tidak menggandakan.
  r := public.beri_sp(o3, hari - 200, 'Terlambat 5 kali dalam sebulan (PP Pasal 12)', 'Peraturan Perusahaan Pasal 12', null, false, md5('sp-lama')::uuid);
  perform pg_temp.cek('SP pertama berlaku 6 bulan', (r ->> 'tingkat')::int = 1 and (r ->> 'berlaku_sampai')::date = ((hari - 200) + interval '6 months')::date - 1, r::text);
  r := public.beri_sp(o3, hari - 10, 'Tidak masuk tanpa keterangan 2 hari', null, null, false, md5('sp-baru')::uuid);
  perform pg_temp.cek('SP lama sudah lewat: kembali SP pertama', (r ->> 'tingkat')::int = 1, r::text);
  r := public.beri_sp(o3, hari - 5, 'Mengulang tidak masuk tanpa keterangan', null, null, false, md5('sp-2')::uuid);
  perform pg_temp.cek('pelanggaran dalam masa SP1: SP kedua', (r ->> 'tingkat')::int = 2);
  perform pg_temp.cek('kunci sama tidak menggandakan', (public.beri_sp(o3, hari - 5, 'Mengulang tidak masuk tanpa keterangan', null, null, false, md5('sp-2')::uuid) ->> 'sudah')::boolean);
  r := public.beri_sp(o3, hari, 'Mengulang lagi tidak masuk', null, 3, false, md5('sp-3')::uuid);
  perform pg_temp.cek('SP ketiga dengan masa 3 bulan dari PK', (r ->> 'tingkat')::int = 3 and (r ->> 'berlaku_sampai')::date = (hari + interval '3 months')::date - 1);
  begin perform public.beri_sp(o3, hari, 'Pelanggaran keempat', null, null, false, md5('sp-4')::uuid); perform pg_temp.cek('SP3 berlaku: SP baru ditolak, dasar PHK', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('SP3 berlaku: SP baru ditolak, dasar PHK', g like '%Pasal 36 huruf k%', g); end;
  r := public.beri_sp(o1, hari, 'Pelanggaran berat menurut PKB Pasal 30', 'PKB Pasal 30', null, true, md5('sp-akhir')::uuid);
  perform pg_temp.cek('SP pertama dan terakhir', (r ->> 'tingkat')::int = 1 and (r ->> 'terakhir')::boolean);
  begin perform public.beri_sp(o1, hari, 'Pelanggaran lagi', null, null, false, md5('sp-akhir2')::uuid); perform pg_temp.cek('setelah SP terakhir: ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('setelah SP terakhir: ditolak', g like '%pertama dan terakhir%'); end;
  begin perform public.beri_sp(o2, hari + 1, 'Tanggal masa depan', null, null, false, md5('sp-depan')::uuid); perform pg_temp.cek('SP bertanggal masa depan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('SP bertanggal masa depan ditolak', true); end;
  r := public.beri_sp(o2, hari, 'Selisih kas tanpa laporan', null, null, false, md5('sp-kasir')::uuid);

  -- Pengumuman + daftar periksa.
  p1 := public.buat_pengumuman('Libur toko 17 Agustus', 'Toko tutup sehari. Shift digeser ke tanggal 18.', null, md5('pg-1')::uuid);
  p2 := public.buat_pengumuman('Rapat admin', 'Khusus admin dan pemilik.', array['admin'], md5('pg-2')::uuid);
  perform pg_temp.cek('pengumuman idempoten', public.buat_pengumuman('Libur toko 17 Agustus', 'x', null, md5('pg-1')::uuid) = p1);
  perform pg_temp.cek('daftar periksa onboarding 6 butir', public.mulai_daftar_periksa(o2, 'onboarding') = 6 and public.mulai_daftar_periksa(o2, 'onboarding') = 0);
  perform public.centang_periksa((select id from public.daftar_periksa where orang_id = o2 and urutan = 1), true);
  perform pg_temp.cek('butir dicentang', (select selesai_at is not null from public.daftar_periksa where orang_id = o2 and urutan = 1));

  -- Staf: hanya datanya sendiri; tidak bisa mengubah; tanda baca.
  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf melihat profil sendiri saja', (select count(*) from public.profil_kerja) = 1 and (select orang_id from public.profil_kerja) = o2);
  perform pg_temp.cek('staf melihat riwayat sendiri saja', (select count(*) from public.riwayat_kerja where orang_id <> o2) = 0 and (select count(*) from public.riwayat_kerja) = 2);
  perform pg_temp.cek('staf melihat SP sendiri saja', (select count(*) from public.surat_peringatan) = 1);
  perform pg_temp.cek('staf melihat daftar periksanya', (select count(*) from public.daftar_periksa) = 6);
  perform pg_temp.cek('staf melihat pengumuman untuk semua, bukan khusus admin', (select count(*) from public.pengumuman) = 1 and (select id from public.pengumuman) = p1);
  begin perform public.beri_sp(o3, hari, 'Staf mencoba memberi SP', null, null, false, md5('sp-staf')::uuid); perform pg_temp.cek('staf tidak memberi SP', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak memberi SP', true); end;
  begin perform public.ubah_profil_kerja(o2, 'Direktur', 'M9', null, null, null, null, 'promosi', null, null); perform pg_temp.cek('staf tidak mengubah profil sendiri', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengubah profil sendiri', true); end;
  begin perform public.tandai_pengumuman_dibaca(p2); perform pg_temp.cek('staf tidak menandai pengumuman khusus admin', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('staf tidak menandai pengumuman khusus admin', true); end;
  perform public.tandai_pengumuman_dibaca(p1);
  perform public.tandai_pengumuman_dibaca(p1);
  perform pg_temp.cek('staf menandai dibaca (sekali)', (select count(*) from public.pengumuman_baca) = 1);
  perform pg_temp.cek('staf tidak melihat ringkasan baca', (select count(*) from public.ringkas_pengumuman()) = 0);

  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('pemilik melihat 1 dari 2 anggota sudah membaca', (select sasaran = 2 and dibaca = 1 from public.ringkas_pengumuman() where id = p1));
  perform pg_temp.cek('pengumuman khusus admin: sasaran 0 anggota admin', (select sasaran = 0 from public.ringkas_pengumuman() where id = p2));

  -- Isolasi usaha.
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat apa pun dari A', (select count(*) from public.profil_kerja) + (select count(*) from public.surat_peringatan) + (select count(*) from public.pengumuman) + (select count(*) from public.daftar_periksa) = 0);
  begin perform public.beri_sp(o3, current_date, 'Lintas usaha', null, null, false, md5('sp-lintas')::uuid); perform pg_temp.cek('usaha B tidak memberi SP ke orang A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak memberi SP ke orang A', true); end;
  begin perform public.tandai_pengumuman_dibaca(p1); perform pg_temp.cek('usaha B tidak menandai pengumuman A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak menandai pengumuman A', true); end;
  execute 'reset role';
  perform pg_temp.cek('tabel tanpa hak tulis langsung', not has_table_privilege('authenticated', 'public.surat_peringatan', 'insert') and not has_table_privilege('authenticated', 'public.profil_kerja', 'update'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
