-- Tes Q-26 (docs/quality/rencana-uji-q26.md): "hari ini" di database memakai zona usaha (app.hari_ini), bukan current_date (UTC).
-- Bagian 1 memeriksa struktur: tidak ada fungsi public/app memakai current_date atau pola tanggal UTC setara di luar daftar putih
-- berkomentar; bawaan pakai_topi.mulai bukan CURRENT_DATE; pemicu pakai_topi_mulai ada; fungsi pemicu tidak bisa dipanggil
-- public/anon/authenticated. Bagian 2 memakai usaha Asia/Jakarta dan Asia/Jayapura. now() tidak bisa dipalsukan, jadi hasil
-- dibandingkan dengan app.hari_ini(pid); cek yang hanya membedakan kode lama dan baru saat tanggal lokal <> tanggal UTC mencatat
-- kedua tanggal di info. Cek batas (mulai besok lokal, selesai kemarin lokal) memakai app.hari_ini sebagai acuan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Bagian 1: struktur.
select pg_temp.cek('tidak ada fungsi public/app memakai current_date selain daftar putih',
  count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app') and p.prosrc ~* 'current_date'
   and p.oid::regprocedure::text not in ('app.isi_demo()', 'demo_lihat(text)');

select pg_temp.cek('tidak ada fungsi public/app memakai pola tanggal UTC setara (now()::date, localtimestamp, current_timestamp::date, date_trunc hari/minggu/bulan atas now()) selain daftar putih',
  count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app')
   and p.prosrc ~* 'now\(\)\s*::\s*date|localtimestamp|current_timestamp\s*::\s*date|date_trunc\(\s*''(day|week|month)''\s*,\s*now\(\)\s*\)'
   and p.oid::regprocedure::text not in ('app.isi_demo()', 'demo_lihat(text)');

select pg_temp.cek('daftar putih (isi_demo, demo_lihat) diberi komentar bahwa tanggal UTC di situ sengaja (Q-26)',
  count(*) = 2 and bool_and(coalesce(obj_description(p.oid, 'pg_proc'), '') ilike '%sengaja%Q-26%'),
  string_agg(p.proname || ': ' || coalesce(obj_description(p.oid, 'pg_proc'), '-'), ' | '))
  from pg_proc p
 where p.oid in (to_regprocedure('app.isi_demo()'), to_regprocedure('public.demo_lihat(text)'));

select pg_temp.cek('fungsi ' || f || ' memanggil app.hari_ini dan tidak memakai current_date',
  p.oid is not null and p.prosrc ~ 'app\.hari_ini\(' and p.prosrc !~* 'current_date', coalesce(p.oid::regprocedure::text, 'tidak ada'))
  from unnest(array['app.beban_orang(uuid,date)', 'app.hitung_lintas_topi()', 'app.pasang_topi_dari_jabatan(uuid,uuid,text,date)',
                    'public.simpan_rencana_magang(uuid,uuid,uuid,uuid,date,date,jsonb,text,jsonb,text,text,integer,uuid)']) f
  left join pg_proc p on p.oid = to_regprocedure(f);

select pg_temp.cek('hitung_lintas_topi: security definer, search_path kosong, pencarian dibatasi ke usaha baris kerja',
  bool_and(p.prosecdef and p.proconfig = array['search_path=""'] and p.prosrc like '%p.perusahaan_id = new.perusahaan_id%'), count(*)::text)
  from pg_proc p where p.oid = to_regprocedure('app.hitung_lintas_topi()');

select pg_temp.cek('bawaan kolom pakai_topi.mulai bukan CURRENT_DATE (kosong) dan kolom tetap NOT NULL',
  count(*) = 1 and bool_and(c.column_default is null and c.is_nullable = 'NO'), string_agg(coalesce(c.column_default, '-') || ' ' || c.is_nullable, ', '))
  from information_schema.columns c
 where c.table_schema = 'public' and c.table_name = 'pakai_topi' and c.column_name = 'mulai';

select pg_temp.cek('pemicu pakai_topi_mulai ada: BEFORE INSERT per baris, aktif, memanggil app.isi_mulai_pakai_topi()',
  count(*) = 1 and bool_and(t.tgtype & 2 = 2 and t.tgtype & 1 = 1 and t.tgtype & 4 = 4 and t.tgtype & 8 = 0 and t.tgtype & 16 = 0
                            and t.tgenabled = 'O' and t.tgfoid = to_regprocedure('app.isi_mulai_pakai_topi()')),
  string_agg(t.tgname || ' ' || t.tgtype::text || ' ' || t.tgfoid::regprocedure::text, ', '))
  from pg_trigger t where t.tgrelid = 'public.pakai_topi'::regclass and t.tgname = 'pakai_topi_mulai';

select pg_temp.cek('app.isi_mulai_pakai_topi: plpgsql, security definer, search_path kosong, memanggil app.hari_ini(new.perusahaan_id)',
  count(*) = 1 and bool_and(l.lanname = 'plpgsql' and p.prosecdef and p.proconfig = array['search_path=""'] and p.prosrc like '%app.hari_ini(new.perusahaan_id)%'),
  count(*)::text)
  from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = to_regprocedure('app.isi_mulai_pakai_topi()');

select pg_temp.cek('fungsi pemicu (isi_mulai_pakai_topi, hitung_lintas_topi) tidak bisa dipanggil public, anon, atau authenticated',
  count(*) = 2 and bool_and(not has_function_privilege('public', f, 'execute') and not has_function_privilege('anon', f, 'execute')
                            and not has_function_privilege('authenticated', f, 'execute')), count(*)::text)
  from (select to_regprocedure(x) f from unnest(array['app.isi_mulai_pakai_topi()', 'app.hitung_lintas_topi()']) x) s
 where f is not null;

-- Bagian 2: perilaku.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pj uuid; pw uuid; c record; z text; h date; ka text; o uuid; o2 uuid; o3 uuid; om uuid; tp uuid; t2 uuid; t3 uuid;
  m date; n int; k uuid; b record; r jsonb; tm uuid; lt boolean;
begin
  begin
    insert into auth.users (id, email) values (ua, 'wib-q26@uji.local'), (ub, 'wit-q26@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pj := public.buat_perusahaan('Warung Uji WIB Q26', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pw := public.buat_perusahaan('Warung Uji WIT Q26', 'fnb');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pw;
    perform pg_temp.cek('usaha uji: Asia/Jakarta dan Asia/Jayapura',
      app.zona(pj) = 'Asia/Jakarta' and app.zona(pw) = 'Asia/Jayapura');

    for c in select * from (values (pj, ua, 'Asia/Jakarta'), (pw, ub, 'Asia/Jayapura')) v(pid, uid, zona) loop
      z := c.zona;
      h := app.hari_ini(c.pid);
      ka := json_build_object('sub', c.uid, 'role', 'authenticated', 'app_metadata', json_build_object('pid', c.pid, 'prn', 'pemilik'))::text;

      -- Insert langsung dari klien (authenticated), tanpa mulai: pemicu mengisi tanggal lokal.
      begin
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Pemakai Topi ' || z) returning id into o;
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Topi Besok ' || z) returning id into o2;
        insert into public.topi (perusahaan_id, kode, nama) values (c.pid, 'uji_q26', 'Uji Q26') returning id into tp;
        insert into public.topi (perusahaan_id, kode, nama) values (c.pid, 'lain_q26', 'Lain Q26') returning id into t2;
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi) values (c.pid, o, tp, 100) returning mulai into m;
        perform pg_temp.cek('insert klien tanpa mulai ' || z || ': mulai = app.hari_ini(pid)', m = h,
          'mulai=' || coalesce(m::text, '-') || ' hari_ini=' || h || ' utc=' || (now() at time zone 'UTC')::date);
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai) values (c.pid, o2, tp, 100, h + 1) returning mulai into m;
        perform pg_temp.cek('insert dengan mulai ' || z || ': tanggal yang diisi tidak diubah pemicu', m = h + 1, coalesce(m::text, '-'));

        -- Pemicu kerja (dari klien): topi yang mulai hari ini lokal langsung terhitung, yang mulai besok lokal belum.
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Topi Sendiri ' || z, tp, o)
          returning id, lintas_topi into k, lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': topi mulai hari ini lokal terhitung (bukan lintas topi)', lt = false,
          coalesce(lt::text, '-') || ' hari_ini=' || h || ' utc=' || (now() at time zone 'UTC')::date);
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Topi Besok ' || z, tp, o2)
          returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': topi mulai besok lokal belum terhitung (lintas topi)', lt = true, coalesce(lt::text, '-'));
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Topi Lain ' || z, t2, o)
          returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': topi lain tetap lintas topi', lt = true, coalesce(lt::text, '-'));
        update public.kerja set topi_id = t2 where id = k returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': update topi dari klien dihitung ulang', lt = true, coalesce(lt::text, '-'));
        update public.kerja set topi_id = tp where id = k returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': update kembali ke topi sendiri tidak lintas', lt = false, coalesce(lt::text, '-'));
      exception when others then perform pg_temp.cek('blok insert klien ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- Topi yang selesai kemarin lokal tidak terhitung lagi; selesai hari ini lokal masih terhitung.
      begin
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Topi Selesai Kemarin ' || z) returning id into o3;
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai, selesai) values (c.pid, o3, tp, 100, h - 10, h - 1);
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai, selesai) values (c.pid, o3, t2, 100, h - 10, h);
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Topi Selesai ' || z, tp, o3)
          returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': topi selesai kemarin lokal sudah lintas topi', lt = true, coalesce(lt::text, '-'));
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Topi Selesai Hari Ini ' || z, t2, o3)
          returning lintas_topi into lt;
        perform pg_temp.cek('hitung_lintas_topi ' || z || ': topi selesai hari ini lokal masih terhitung', lt = false, coalesce(lt::text, '-'));
      exception when others then perform pg_temp.cek('blok topi selesai ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;

      -- Impor: pasang_topi_dari_jabatan tanpa tanggal mulai, lalu langsung terhitung di pemicu kerja dan beban_orang.
      begin
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Kasir Impor ' || z) returning id into om;
        n := app.pasang_topi_dari_jabatan(c.pid, om, 'Kasir Q26');
        select pt.mulai, pt.topi_id into m, t3 from public.pakai_topi pt where pt.orang_id = om;
        perform pg_temp.cek('pasang_topi_dari_jabatan ' || z || ': tanpa p_mulai, mulai = app.hari_ini(pid)', n = 1 and m = h,
          'n=' || n || ' mulai=' || coalesce(m::text, '-') || ' hari_ini=' || h || ' utc=' || (now() at time zone 'UTC')::date);
        perform app.pasang_topi_dari_jabatan(c.pid, o2, 'Kasir Q26', date '2026-01-15');
        perform pg_temp.cek('pasang_topi_dari_jabatan ' || z || ': p_mulai yang diisi dipakai',
          (select pt.mulai from public.pakai_topi pt where pt.orang_id = o2 and pt.topi_id = t3) = date '2026-01-15');
        insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id) values (c.pid, 'Kerja Kasir Impor ' || z, t3, om)
          returning lintas_topi into lt;
        perform pg_temp.cek('topi impor ' || z || ': langsung terhitung di hitung_lintas_topi', lt = false, coalesce(lt::text, '-'));
        select * into b from app.beban_orang(c.pid, h) x where x.orang_id = om;
        perform pg_temp.cek('topi impor ' || z || ': langsung tampil di beban_orang hari ini lokal', t3 = any (b.topi_id), coalesce(b.topi_id::text, '-'));
        select * into b from app.beban_orang(c.pid, h) x where x.orang_id = o2;
        perform pg_temp.cek('beban_orang ' || z || ': topi mulai besok lokal belum tampil, topi impor bertanggal lama tampil',
          not (tp = any (b.topi_id)) and t3 = any (b.topi_id), coalesce(b.topi_id::text, '-'));
        select * into b from app.beban_orang(c.pid, h) x where x.orang_id = o3;
        perform pg_temp.cek('beban_orang ' || z || ': topi selesai kemarin lokal tidak tampil, selesai hari ini tampil',
          not (tp = any (b.topi_id)) and t2 = any (b.topi_id), coalesce(b.topi_id::text, '-'));
      exception when others then perform pg_temp.cek('blok impor ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;

      -- Penulis tanpa mulai lewat postgres (seperti putuskan_usulan cabang orang.topi): pemicu juga mengisi.
      begin
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi) values (c.pid, om, t2, 50) returning mulai into m;
        perform pg_temp.cek('insert fungsi security definer tanpa mulai ' || z || ': mulai = app.hari_ini(pid)', m = h, coalesce(m::text, '-'));
      exception when others then perform pg_temp.cek('blok insert definer ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;

      -- simpan_rencana_magang: topi mentor mulai hari ini lokal.
      begin
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.simpan_rencana_magang(null, o3, o, null, h, h + 60, '{"transport": 0, "makan": 0, "insentif": 0}'::jsonb,
          'Belajar melayani pelanggan', '[]'::jsonb, null);
        execute 'reset role';
        select id into tm from public.topi where perusahaan_id = c.pid and kode = 'mentor';
        select pt.mulai into m from public.pakai_topi pt where pt.orang_id = o and pt.topi_id = tm;
        perform pg_temp.cek('simpan_rencana_magang ' || z || ': topi mentor mulai = app.hari_ini(pid)', r ->> 'id' is not null and m = h,
          'mulai=' || coalesce(m::text, '-') || ' hari_ini=' || h || ' utc=' || (now() at time zone 'UTC')::date);
        -- Topi mentor yang selesai hari ini lokal masih aktif: rencana kedua tidak menggandakan.
        update public.pakai_topi set mulai = h - 30, selesai = h where orang_id = o and topi_id = tm;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.simpan_rencana_magang(null, o2, o, null, h, h + 60, '{"transport": 0, "makan": 0, "insentif": 0}'::jsonb,
          'Belajar menyiapkan pesanan', '[]'::jsonb, null);
        execute 'reset role';
        select count(*) into n from public.pakai_topi pt where pt.orang_id = o and pt.topi_id = tm;
        perform pg_temp.cek('simpan_rencana_magang ' || z || ': topi mentor selesai hari ini lokal masih aktif, tidak digandakan', n = 1, n::text);
        -- Topi mentor yang selesai kemarin lokal sudah tidak aktif, jadi rencana baru memasang topi mentor lagi mulai hari ini.
        update public.pakai_topi set mulai = h - 30, selesai = h - 1 where orang_id = o and topi_id = tm;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.simpan_rencana_magang(null, om, o, null, h, h + 60, '{"transport": 0, "makan": 0, "insentif": 0}'::jsonb,
          'Belajar menghitung kas', '[]'::jsonb, null);
        execute 'reset role';
        select count(*), max(pt.mulai) into n, m from public.pakai_topi pt where pt.orang_id = o and pt.topi_id = tm;
        perform pg_temp.cek('simpan_rencana_magang ' || z || ': topi mentor selesai kemarin lokal dianggap tidak aktif, dipasang lagi hari ini',
          n = 2 and m = h, n || ' ' || coalesce(m::text, '-'));
      exception when others then perform pg_temp.cek('blok simpan_rencana_magang ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';
    end loop;

    perform pg_temp.cek('catatan jam uji: tanggal lokal dibanding tanggal UTC (cek di atas membedakan kode lama hanya bila berbeda)', true,
      'utc=' || (now() at time zone 'UTC')::date || ' jakarta=' || app.hari_ini(pj) || ' jayapura=' || app.hari_ini(pw));
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
