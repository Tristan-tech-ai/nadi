-- Tes U-04 draf AI (supabase/migrations/20261105098000_ai_draft.sql): draf 20 baris tersimpan dengan centang yang benar (nama
-- yang sudah ada dan gaji tidak tercentang), ubah sel/hapus/tambah tersimpan, AI tidak bisa mencentang maupun menerapkan,
-- terapkan membuat orang dan menyalakan modul, batal dalam jendela mengembalikan, usaha lain/staf ditolak. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid;
  dr uuid; b jsonb; r jsonb; baris jsonb := '[]'::jsonb; i int; id_sari text; id_dup text; id_gaji text; id_hapus text; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'dr.a@uji.local'), (ub, 'dr.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Draf', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Draf', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Lama') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '530201');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;

    -- 20 baris: 15 orang (satu bernama sama dengan orang yang ada), 1 topi, 1 izin, 1 fitur, 1 usaha, 1 gaji.
    for i in 1..14 loop
      baris := baris || jsonb_build_array(jsonb_build_object('bagian', 'orang', 'nilai', jsonb_build_object('nama', 'Karyawan ' || chr(64 + i), 'jabatan', 'kasir'), 'alasan', 'dari berkas karyawan.xlsx baris ' || i, 'keyakinan', 92));
    end loop;
    baris := baris || jsonb_build_array(jsonb_build_object('bagian', 'orang', 'nilai', jsonb_build_object('nama', 'Budi Lama', 'jabatan', 'gudang')),
      jsonb_build_object('bagian', 'topi', 'nilai', jsonb_build_object('nama', 'Barista')),
      jsonb_build_object('bagian', 'izin', 'nilai', jsonb_build_object('jenis', 'sakit', 'otomatis', true, 'maks_hari', 2, 'butuh_bukti', true)),
      jsonb_build_object('bagian', 'fitur', 'nilai', jsonb_build_object('modul', 'produksi', 'nyala', true)),
      jsonb_build_object('bagian', 'usaha', 'nilai', jsonb_build_object('skala', '6-15', 'kota', 'Denpasar', 'negara', 'ID')),
      jsonb_build_object('bagian', 'gaji', 'nilai', jsonb_build_object('nama', 'Karyawan A', 'pokok', 3500000)));
    perform pg_temp.cek('20 baris disiapkan', jsonb_array_length(baris) = 20);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    dr := public.save_ai_draft(baris);
    select d.baris into b from public.ai_draft d where d.id = dr;
    perform pg_temp.cek('draf tersimpan 20 baris', jsonb_array_length(b) = 20);
    select x ->> 'id' into id_dup from jsonb_array_elements(b) x where x #>> '{nilai,nama}' = 'Budi Lama';
    select x ->> 'id' into id_gaji from jsonb_array_elements(b) x where x ->> 'bagian' = 'gaji';
    select x ->> 'id' into id_sari from jsonb_array_elements(b) x where x #>> '{nilai,nama}' = 'Karyawan B';
    select x ->> 'id' into id_hapus from jsonb_array_elements(b) x where x #>> '{nilai,nama}' = 'Karyawan N';
    perform pg_temp.cek('nama yang sudah ada ragu dan tidak tercentang',
      (select x ->> 'ragu' is not null and not (x ->> 'centang')::boolean from jsonb_array_elements(b) x where x ->> 'id' = id_dup));
    perform pg_temp.cek('gaji tidak pernah tercentang otomatis', (select not (x ->> 'centang')::boolean and (x ->> 'peka')::boolean from jsonb_array_elements(b) x where x ->> 'id' = id_gaji));
    perform pg_temp.cek('18 baris tercentang', (select count(*) from jsonb_array_elements(b) x where (x ->> 'centang')::boolean) = 18);
    begin
      perform public.save_ai_draft('[{"bagian": "orang", "nilai": {"nama": "Sari", "nik": "3171234567890001"}}]'::jsonb);
      perform pg_temp.cek('NIK ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('NIK ditolak', true); end;
    -- Draf baru di atas gagal, draf dr tetap terbuka.
    perform pg_temp.cek('draf tetap terbuka', (select status from public.ai_draft where id = dr) = 'draf');

    -- Ubah satu sel, hapus satu baris, tambah satu baris; centang baris ragu ditolak.
    b := public.edit_ai_draft(dr, jsonb_build_array(
      jsonb_build_object('op', 'ubah', 'id', id_sari, 'nilai', jsonb_build_object('jabatan', 'barista')),
      jsonb_build_object('op', 'hapus', 'id', id_hapus),
      jsonb_build_object('op', 'tambah', 'baris', jsonb_build_object('bagian', 'orang', 'nilai', jsonb_build_object('nama', 'Wayan Baru', 'jabatan', 'kurir')))));
    perform pg_temp.cek('sel tersimpan', (select x #>> '{nilai,jabatan}' from jsonb_array_elements(b) x where x ->> 'id' = id_sari) = 'barista');
    perform pg_temp.cek('baris terhapus', not exists (select 1 from jsonb_array_elements(b) x where x ->> 'id' = id_hapus));
    perform pg_temp.cek('baris tambahan tercentang', exists (select 1 from jsonb_array_elements(b) x where x #>> '{nilai,nama}' = 'Wayan Baru' and (x ->> 'centang')::boolean));
    begin
      perform public.edit_ai_draft(dr, jsonb_build_array(jsonb_build_object('op', 'centang', 'id', id_dup, 'centang', true)));
      perform pg_temp.cek('baris ragu tidak bisa dicentang', false);
    exception when sqlstate '22023' then perform pg_temp.cek('baris ragu tidak bisa dicentang', true); end;
    -- Pemilik mencentang gaji secara sadar.
    perform public.edit_ai_draft(dr, jsonb_build_array(jsonb_build_object('op', 'centang', 'id', id_gaji, 'centang', true)));
    execute 'reset role';

    -- AI (jalur MCP) tidak boleh mencentang.
    begin
      perform app.ai_draft_edit(pa, dr, jsonb_build_array(jsonb_build_object('op', 'centang', 'id', id_dup, 'centang', false)), true);
      perform pg_temp.cek('AI tidak bisa mencentang', false);
    exception when sqlstate '42501' then perform pg_temp.cek('AI tidak bisa mencentang', true); end;
    perform pg_temp.cek('tidak ada fungsi MCP untuk menerapkan',
      not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'mcp%' and p.proname like '%apply%'));

    -- Usaha lain dan staf.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat draf', not exists (select 1 from public.ai_draft where id = dr));
    begin
      perform public.apply_ai_draft(dr);
      perform pg_temp.cek('usaha lain tidak bisa menerapkan', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menerapkan', true); end;
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf tidak melihat draf', not exists (select 1 from public.ai_draft where id = dr));
    begin
      perform public.apply_ai_draft(dr);
      perform pg_temp.cek('staf tidak bisa menerapkan', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa menerapkan', true); end;

    -- Terapkan.
    perform set_config('request.jwt.claims', ka, true);
    r := public.apply_ai_draft(dr);
    perform pg_temp.cek('19 baris diterapkan', (r ->> 'diterapkan')::int = 19, r::text);
    execute 'reset role';
    select count(*) into n from public.orang where perusahaan_id = pa and status = 'aktif' and data ->> 'sumber' = 'draf_ai';
    perform pg_temp.cek('14 orang baru (13 + Wayan)', n = 14, n::text);
    perform pg_temp.cek('Budi Lama tidak digandakan', (select count(*) from public.orang where perusahaan_id = pa and nama = 'Budi Lama') = 1);
    perform pg_temp.cek('modul produksi menyala', (select pengaturan #>> '{fitur,produksi}' from public.perusahaan where id = pa) = 'true');
    perform pg_temp.cek('gaji pokok tersimpan', (select (g.gaji ->> 'pokok')::bigint from public.orang_rahasia g join public.orang o on o.id = g.orang_id where o.perusahaan_id = pa and o.nama = 'Karyawan A') = 3500000);
    perform pg_temp.cek('kota usaha diubah', (select kota from public.perusahaan where id = pa) = 'Denpasar');
    perform pg_temp.cek('topi barista dipasang', exists (select 1 from public.pakai_topi p join public.topi t on t.id = p.topi_id join public.orang o on o.id = p.orang_id where o.nama = 'Karyawan B' and t.kode = 'barista'));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.apply_ai_draft(dr);
      perform pg_temp.cek('tidak bisa diterapkan dua kali', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tidak bisa diterapkan dua kali', true); end;
    -- Batal.
    perform public.undo_ai_draft(dr);
    execute 'reset role';
    perform pg_temp.cek('orang dari draf nonaktif setelah batal', not exists (select 1 from public.orang where perusahaan_id = pa and status = 'aktif' and data ->> 'sumber' = 'draf_ai'));
    perform pg_temp.cek('modul kembali seperti semula', (select pengaturan -> 'fitur' from public.perusahaan where id = pa) is null);
    perform pg_temp.cek('kota usaha kembali', (select kota from public.perusahaan where id = pa) is distinct from 'Denpasar');
    perform pg_temp.cek('status dibatalkan', (select status from public.ai_draft where id = dr) = 'dibatalkan');

    -- Jendela batal lewat.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    dr := public.save_ai_draft('[{"bagian": "topi", "nilai": {"nama": "Kurir"}}]'::jsonb);
    perform public.apply_ai_draft(dr);
    execute 'reset role';
    update public.ai_draft set batal_sampai = now() - interval '1 minute' where id = dr;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.undo_ai_draft(dr);
      perform pg_temp.cek('batal ditolak setelah 10 menit', false);
    exception when sqlstate '22023' then perform pg_temp.cek('batal ditolak setelah 10 menit', true); end;
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
