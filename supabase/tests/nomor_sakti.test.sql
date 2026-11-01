-- Tes F4-01 Nomor Sakti (docs/quality/rencana-uji-f4-01.md): templat, urut tanpa ganda/loncat, transaksi batal tanpa lubang,
-- nomor batal tetap tercatat dan tidak dipakai ulang, periode di zona usaha, tanpa sequence, hak lewat peran aktif, isolasi usaha.
-- Lulus bila "gagal=[]". Uji konkuren 200 permintaan paralel ada di apps/web/scripts/uji-nomor-konkuren.ts.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; us uuid; o1 uuid;
  r jsonb; r2 jsonb; n int; x text; v_tgl date;
begin
  -- Struktur.
  perform pg_temp.cek('tabel dan fungsi ada', to_regclass('public.templat_nomor') is not null and to_regclass('public.nomor_terbit') is not null
    and to_regclass('app.penomor') is not null and to_regprocedure('public.ambil_nomor(text,text)') is not null);
  perform pg_temp.cek('tanpa sequence untuk nomor dokumen', not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where c.relkind = 'S' and c.relname ilike '%nomor%'));
  perform pg_temp.cek('fungsi pembantu tertutup untuk anon/authenticated',
    not has_function_privilege('authenticated', 'app.susun_nomor(text,integer,text,text,date)', 'execute')
    and not has_function_privilege('anon', 'public.ambil_nomor(text,text)', 'execute')
    and not has_table_privilege('authenticated', 'app.penomor', 'select'));
  perform pg_temp.cek('ambil_nomor memeriksa peran lewat peran_aktif, bukan klaim',
    (select prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)' from pg_proc where oid = 'public.ambil_nomor(text,text)'::regprocedure));

  -- Penyusun templat.
  perform pg_temp.cek('susun 012/WRG/SK/XI/2026', app.susun_nomor('{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}', 12, 'WRG', 'SK', date '2026-11-01') = '012/WRG/SK/XI/2026');
  perform pg_temp.cek('susun INV-26-01-7', app.susun_nomor('{jenis}-{tahun2}-{bulan}-{no}', 7, 'X', 'INV', date '2026-01-31') = 'INV-26-01-7');
  perform pg_temp.cek('susun 1234 lebih panjang dari lebar tetap utuh', app.susun_nomor('{no:3}', 1234, null, 'SK', date '2026-11-01') = '1234');
  perform pg_temp.cek('periode bulanan/tahunan/selamanya',
    app.periode_nomor('{no}/{bulan_romawi}/{tahun}', date '2026-11-30') = '2026-11'
    and app.periode_nomor('{no}/{tahun2}', date '2026-11-30') = '2026'
    and app.periode_nomor('{jenis}-{no:4}', date '2026-11-30') = 'selamanya');

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

  perform set_config('request.jwt.claims', ka, true);
  perform public.atur_templat_nomor('sk', 'Surat keputusan', '{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}', 'wrg');
  begin
    perform public.atur_templat_nomor('XX', 'Salah', '{no}/{hari}');
    perform pg_temp.cek('token tidak dikenal ditolak', false);
  exception when others then perform pg_temp.cek('token tidak dikenal ditolak', sqlstate = '22023', sqlerrm);
  end;

  -- Urut tanpa loncat.
  r := public.ambil_nomor('SK', 'surat uji 1');
  -- app.hari_ini sengaja tertutup untuk authenticated: tanggal pembanding dihitung di luar peran itu.
  execute 'reset role';
  v_tgl := app.hari_ini(pa);
  x := '001/WRG/SK/' || app.romawi(extract(month from v_tgl)::int) || '/' || to_char(v_tgl, 'YYYY');
  execute 'set local role authenticated';
  perform pg_temp.cek('nomor pertama 001 dengan bulan romawi dan tahun zona usaha', r ->> 'nomor' = x, r::text || ' harap ' || x);
  r := public.ambil_nomor('SK');
  perform pg_temp.cek('nomor kedua urut 2', (r ->> 'urut')::int = 2, r::text);

  -- Transaksi batal tidak meninggalkan lubang.
  begin
    perform public.ambil_nomor('SK', 'akan dibatalkan');
    raise exception 'batal_uji';
  exception when others then null;
  end;
  r := public.ambil_nomor('SK');
  perform pg_temp.cek('setelah transaksi batal nomor berikutnya tetap 3 (tanpa lubang)', (r ->> 'urut')::int = 3, r::text);

  -- Nomor batal tercatat, tidak dipakai ulang.
  r2 := public.batal_nomor((r ->> 'id')::uuid, 'Salah ketik tujuan surat');
  perform pg_temp.cek('nomor batal tercatat dengan alasan', (select status = 'batal' and alasan_batal = 'Salah ketik tujuan surat' from public.nomor_terbit where id = (r ->> 'id')::uuid));
  r := public.ambil_nomor('SK');
  perform pg_temp.cek('nomor batal tidak dipakai ulang: berikutnya 4', (r ->> 'urut')::int = 4, r::text);
  select count(*), string_agg(urut::text, ',' order by urut) into n, x from public.nomor_terbit where perusahaan_id = pa and jenis = 'SK';
  perform pg_temp.cek('daftar nomor utuh 1..4 tanpa celah', n = 4 and x = '1,2,3,4', x);
  begin
    perform public.batal_nomor((r ->> 'id')::uuid, ' ');
    perform pg_temp.cek('batal tanpa alasan ditolak', false);
  exception when others then perform pg_temp.cek('batal tanpa alasan ditolak', sqlstate = '22023', sqlerrm);
  end;

  -- Periode di zona usaha (Asia/Jayapura).
  execute 'reset role';
  update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pa;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.atur_templat_nomor('INV', 'Invoice', 'INV/{tahun}/{bulan}/{no:4}');
  r := public.ambil_nomor('INV');
  execute 'reset role';
  v_tgl := app.hari_ini(pa);
  execute 'set local role authenticated';
  perform pg_temp.cek('periode bulanan dari hari ini zona usaha (Asia/Jayapura)',
    r ->> 'periode' = to_char(v_tgl, 'YYYY-MM') and (r ->> 'tanggal')::date = v_tgl, r::text);

  -- Jenis yang belum diatur.
  begin
    perform public.ambil_nomor('ST');
    perform pg_temp.cek('jenis belum diatur ditolak', false);
  exception when others then perform pg_temp.cek('jenis belum diatur ditolak', sqlstate = 'P0002', sqlerrm);
  end;

  -- Isolasi usaha.
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.nomor_terbit;
  perform pg_temp.cek('usaha lain tidak melihat nomor', n = 0, n::text);
  begin
    perform public.ambil_nomor('SK');
    perform pg_temp.cek('usaha lain tidak bisa memakai templat usaha A', false);
  exception when others then perform pg_temp.cek('usaha lain tidak bisa memakai templat usaha A', sqlstate = 'P0002', sqlerrm);
  end;

  -- Staf ditolak.
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform public.ambil_nomor('SK');
    perform pg_temp.cek('staf tidak bisa mengambil nomor', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mengambil nomor', true);
  end;
  select count(*) into n from public.nomor_terbit;
  perform pg_temp.cek('staf tidak membaca daftar nomor', n = 0, n::text);

  -- Anon.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.ambil_nomor('SK');
    perform pg_temp.cek('anon ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon ditolak', true);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
