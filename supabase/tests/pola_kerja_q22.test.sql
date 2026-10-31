-- Tes Q-22 (docs/research/pola-kerja.md, docs/quality/rencana-uji-q22.md): satu sumber pola kerja per usaha.
-- app.pola_kerja(pid) membaca perusahaan.pengaturan->>'pola_kerja' (bawaan '6_hari'); hanya pemilik aktif (app.peran_aktif())
-- mengubahnya lewat atur_pola_kerja, nilai selain '6_hari'/'5_hari' ditolak, perubahan tercatat di audit_log (lama dan baru);
-- staf, admin, akuntan, anon ditolak 42501; pemilik yang dicabut dengan JWT lama ditolak; tulis langsung ke pengaturan ditolak;
-- catat_lembur menolak jenis libur yang tidak cocok dengan pola usaha ('hari_kerja' diterima di kedua pola); lembur lama tidak
-- berubah. Tanggal uji tetap (bukan now()), jadi tidak bergantung hari pertama/terakhir bulan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;
-- Menjalankan satu pernyataan; 'ok' bila berhasil, selain itu "sqlstate: pesan". Galat tidak menghentikan tes (merah terbaca).
create function pg_temp.coba(q text) returns text
language plpgsql as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;
grant execute on function pg_temp.coba(text) to public;
-- aturan_kerja() sebagai jsonb; bila galat, {"galat": "sqlstate: pesan"}.
create function pg_temp.aturan() returns jsonb
language plpgsql as $$
declare v jsonb;
begin
  execute 'select public.aturan_kerja()' into v;
  return v;
exception when others then
  return jsonb_build_object('galat', sqlstate || ': ' || sqlerrm);
end $$;
grant execute on function pg_temp.aturan() to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uk uuid := gen_random_uuid();
  up uuid := gen_random_uuid(); us uuid; pa uuid; pb uuid; ka text; kb text; kd text; kk text; kp text; ks text;
  o1 uuid; o2 uuid; senin date := date '2026-11-02'; n int; h text; lama text; baru text; r jsonb; ids uuid[];
  catat text := 'select public.catat_lembur(%L, %L, %L, %s)';
begin
  insert into auth.users (id, email) values (ua, 'pa@uji.local'), (ub, 'pb@uji.local'), (ud, 'd@uji.local'), (uk, 'k@uji.local'), (up, 'p2@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Pola A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Pola B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o2;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, uk, 'akuntan'), (pa, up, 'pemilik');
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
  kp := json_build_object('sub', up, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;

  -- 1. Bawaan '6_hari' bila pengaturan kosong; fungsi app tidak bisa dipanggil langsung oleh klien.
  h := pg_temp.coba(format('select 1 where app.pola_kerja(%L) = ''6_hari''', pa));
  perform pg_temp.cek('app.pola_kerja bawaan 6_hari bila pengaturan kosong', h = 'ok'
    and (select pengaturan ? 'pola_kerja' from public.perusahaan where id = pa) is false, h);
  perform pg_temp.cek('app.pola_kerja tidak bisa dipanggil authenticated/anon',
    case when to_regprocedure('app.pola_kerja(uuid)') is null then false
         else not has_function_privilege('authenticated', 'app.pola_kerja(uuid)', 'execute')
              and not has_function_privilege('anon', 'app.pola_kerja(uuid)', 'execute') end);

  execute 'set local role authenticated';
  -- 2. Isolasi: pemilik B mengganti polanya sendiri ke 5 hari; usaha A tetap 6 hari.
  perform set_config('request.jwt.claims', kb, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('pemilik B mengganti pola usaha B', h = 'ok', h);
  perform set_config('request.jwt.claims', ka, true);
  r := pg_temp.aturan();
  perform pg_temp.cek('usaha A tetap 6_hari (bawaan) setelah B mengganti polanya',
    r ->> 'pola_kerja' = '6_hari' and (r ->> 'tersimpan')::boolean is false, r::text);

  -- 3. Pola 6: lembur lama dicatat; libur pola 5 ditolak dengan pesan pola usaha; hari kerja diterima.
  h := pg_temp.coba(format(catat, o1, senin + 5, 'libur_pola_6_hari', 7));
  perform pg_temp.cek('pola 6 menerima libur_pola_6_hari', h = 'ok', h);
  h := pg_temp.coba(format(catat, o2, senin + 5, 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', 5));
  perform pg_temp.cek('pola 6 menerima libur_pola_6_hari_jatuh_hari_kerja_terpendek', h = 'ok', h);
  h := pg_temp.coba(format(catat, o1, senin, 'hari_kerja', 2));
  perform pg_temp.cek('pola 6 menerima hari_kerja', h = 'ok', h);
  h := pg_temp.coba(format(catat, o2, senin + 6, 'libur_pola_5_hari', 8));
  perform pg_temp.cek('pola 6 menolak libur_pola_5_hari dengan pesan pola usaha', h like '22023: %6 hari seminggu%', h);
  select count(*) into n from public.lembur where perusahaan_id = pa and tanggal = senin + 6;
  perform pg_temp.cek('lembur yang ditolak tidak tersimpan', n = 0, n::text);
  r := pg_temp.aturan();
  perform pg_temp.cek('aturan_kerja menghitung lembur libur nyata (2 baris)', (r ->> 'lembur_libur')::int = 2, r::text);
  perform set_config('request.jwt.claims', kb, true);
  r := pg_temp.aturan();
  perform pg_temp.cek('usaha B 5_hari dan tidak menghitung lembur usaha A', (r ->> 'lembur_libur')::int = 0 and r ->> 'pola_kerja' = '5_hari', r::text);

  -- 4. Hak: staf, admin, akuntan ditolak 42501 dan pola tidak berubah; admin dan akuntan boleh membaca, staf tidak.
  perform set_config('request.jwt.claims', ks, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('staf ditolak mengubah pola (42501)', h like '42501:%', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('staf tidak membaca aturan kerja (42501)', r ->> 'galat' like '42501:%', r::text);
  perform set_config('request.jwt.claims', kd, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('admin ditolak mengubah pola (42501)', h like '42501:%', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('admin membaca aturan kerja, bisa_ubah false', r ->> 'pola_kerja' = '6_hari' and (r ->> 'bisa_ubah')::boolean is false, r::text);
  perform set_config('request.jwt.claims', kk, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('akuntan ditolak mengubah pola (42501)', h like '42501:%', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('akuntan membaca aturan kerja, bisa_ubah false', r ->> 'pola_kerja' = '6_hari' and (r ->> 'bisa_ubah')::boolean is false, r::text);

  -- 5. Pemilik: nilai salah ditolak 22023; tulis langsung ke pengaturan ditolak (lewat RPC saja agar tercatat di audit).
  perform set_config('request.jwt.claims', ka, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''7_hari'', false)');
  perform pg_temp.cek('nilai 7_hari ditolak (22023)', h like '22023:%', h);
  h := pg_temp.coba('select public.atur_pola_kerja(null, false)');
  perform pg_temp.cek('nilai kosong ditolak (22023)', h like '22023:%', h);
  h := pg_temp.coba(format('update public.perusahaan set pengaturan = pengaturan || ''{"pola_kerja": "5_hari"}'' where id = %L', pa));
  perform pg_temp.cek('pemilik tidak bisa menulis pola_kerja langsung ke pengaturan (42501)', h like '42501:%', h);
  h := pg_temp.coba(format('update public.perusahaan set nama = ''Warung Pola A1'' where id = %L', pa));
  perform pg_temp.cek('kendali: pemilik tetap bisa mengubah nama usaha', h = 'ok', h);
  execute 'reset role';
  perform pg_temp.cek('pola usaha A masih bawaan setelah semua penolakan',
    (select not (pengaturan ? 'pola_kerja') from public.perusahaan where id = pa)
    and (select count(*) from public.audit_log where perusahaan_id = pa and tabel = 'perusahaan') = 0);
  h := pg_temp.coba(format('update public.perusahaan set pengaturan = pengaturan || ''{"pola_kerja": "4_hari"}'' where id = %L', pa));
  perform pg_temp.cek('nilai pola di luar 6_hari/5_hari ditolak oleh constraint', h like '23514:%', h);

  -- Jejak lembur lama sebelum pola diganti.
  select array_agg(id order by id), string_agg(id || ':' || jenis || ':' || jam || ':' || diubah_at, ',' order by id)
    into ids, lama from public.lembur where perusahaan_id = pa;

  -- 6. Pemilik mengganti ke 5 hari; audit menyimpan nilai lama dan baru.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', true)');
  perform pg_temp.cek('pemilik mengganti pola ke 5_hari', h = 'ok', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('aturan_kerja membaca 5_hari, jam diatur sendiri, bisa_ubah pemilik',
    r ->> 'pola_kerja' = '5_hari' and (r ->> 'jam_kerja_diatur_sendiri')::boolean and (r ->> 'bisa_ubah')::boolean and (r ->> 'tersimpan')::boolean, r::text);
  select count(*) into n from public.audit_log
   where perusahaan_id = pa and tabel = 'perusahaan' and baris_id = pa and aksi = 'atur_pola_kerja' and user_id = ua
     and sebelum ->> 'pola_kerja' = '6_hari' and (sebelum ->> 'bawaan')::boolean
     and sesudah ->> 'pola_kerja' = '5_hari' and (sesudah ->> 'jam_kerja_diatur_sendiri')::boolean;
  perform pg_temp.cek('audit mencatat 6_hari (bawaan) ke 5_hari, terbaca pemilik', n = 1, n::text);

  -- 7. Pola 5: libur pola 6 (dua jenis) ditolak dengan pesan pola usaha; libur pola 5 dan hari kerja diterima.
  h := pg_temp.coba(format(catat, o2, senin + 6, 'libur_pola_6_hari', 4));
  perform pg_temp.cek('pola 5 menolak libur_pola_6_hari dengan pesan pola usaha', h like '22023: %5 hari seminggu%', h);
  h := pg_temp.coba(format(catat, o2, senin + 6, 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', 4));
  perform pg_temp.cek('pola 5 menolak libur_pola_6_hari_jatuh_hari_kerja_terpendek', h like '22023: %5 hari seminggu%', h);
  h := pg_temp.coba(format(catat, o2, senin + 6, 'libur_pola_5_hari', 12));
  perform pg_temp.cek('pola 5 menerima libur_pola_5_hari 12 jam', h = 'ok', h);
  h := pg_temp.coba(format(catat, o2, senin + 1, 'hari_kerja', 3));
  perform pg_temp.cek('pola 5 menerima hari_kerja', h = 'ok', h);
  h := pg_temp.coba(format(catat, o1, senin + 6, 'libur_pola_6_hari', 13));
  perform pg_temp.cek('jenis salah ditolak karena pola sebelum batas jam', h like '22023: %5 hari seminggu%', h);

  -- 8. Lembur lama tidak berubah (jenis, jam, waktu ubah), jumlah baris lama sama.
  execute 'reset role';
  select string_agg(id || ':' || jenis || ':' || jam || ':' || diubah_at, ',' order by id) into baru
    from public.lembur where id = any (ids);
  perform pg_temp.cek('lembur lama tidak berubah setelah pola diganti', lama is not null and baru = lama and cardinality(ids) = 3,
    coalesce(cardinality(ids), 0)::text);

  -- 9. Batal lembur lama (jam 0) tetap boleh walau jenisnya pola lama: tidak menambah upah, baris tidak dihapus.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  h := pg_temp.coba(format(catat, o1, senin + 5, 'libur_pola_6_hari', 0));
  perform pg_temp.cek('jam 0 membatalkan lembur lama berjenis pola lama', h = 'ok'
    and (select jam = 0 and jenis = 'libur_pola_6_hari' from public.lembur where orang_id = o1 and tanggal = senin + 5), h);

  -- 10. Pemilik kedua aktif bisa; setelah dicabut, JWT lamanya ditolak.
  perform set_config('request.jwt.claims', kp, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''6_hari'', false)');
  perform pg_temp.cek('kendali: pemilik kedua aktif bisa mengganti pola', h = 'ok', h);
  execute 'reset role';
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = up;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kp, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('pemilik dicabut dengan JWT lama ditolak (42501)', h like '42501:%', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('pemilik dicabut dengan JWT lama tidak membaca aturan kerja (42501)', r ->> 'galat' like '42501:%', r::text);
  execute 'reset role';
  select count(*) into n from public.audit_log where perusahaan_id = pa and aksi = 'atur_pola_kerja';
  perform pg_temp.cek('pola A kembali 6_hari oleh pemilik kedua, 2 baris audit',
    (select pengaturan ->> 'pola_kerja' from public.perusahaan where id = pa) = '6_hari' and n = 2, n::text);

  -- 11. Anon tidak bisa memanggil keduanya.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  h := pg_temp.coba('select public.atur_pola_kerja(''5_hari'', false)');
  perform pg_temp.cek('anon ditolak mengubah pola (42501)', h like '42501:%', h);
  r := pg_temp.aturan();
  perform pg_temp.cek('anon ditolak membaca aturan kerja (42501)', r ->> 'galat' like '42501:%', r::text);
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
