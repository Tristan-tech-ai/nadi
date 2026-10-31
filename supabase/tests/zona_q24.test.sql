-- Tes Q-24 (docs/quality/zona-fungsi.md): batas hari dan minggu memakai perusahaan.zona_waktu lewat app.zona(pid), bukan WITA tetap.
-- Bagian 1 memeriksa struktur: tidak ada fungsi public/app yang menyebut zona WITA di luar cadangan coalesce(zona_waktu, ...) kecuali
-- daftar putih yang diberi komentar "sengaja"; putuskan_usulan tidak memakai current_date (tanggal UTC server); fungsi pembantu baru
-- tidak bisa dipanggil anon/authenticated; data lama izin sudah dikoreksi. Bagian 2 memakai data untuk usaha Asia/Jakarta dan
-- Asia/Jayapura. Pemeriksaan yang memakai now() hanya membedakan kode lama dan baru pada jam tertentu (dicatat di nama cek);
-- yang memakai tanggal tetap selalu membedakan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Bagian 1: struktur.
select pg_temp.cek('tidak ada fungsi public/app memakai Asia/Makassar di luar coalesce(zona_waktu, ...) selain daftar putih',
  count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app')
   and regexp_replace(p.prosrc, 'coalesce\(\s*(\w+\.)?zona_waktu\s*,\s*''Asia/Makassar''\s*\)', '', 'gi') like '%Asia/Makassar%'
   and p.oid::regprocedure::text not in ('app.isi_demo()', 'app.ukur_kuota(bigint,bigint)');

select pg_temp.cek('daftar putih (isi_demo, ukur_kuota) diberi komentar bahwa WITA di situ sengaja',
  count(*) = 2 and bool_and(coalesce(obj_description(p.oid, 'pg_proc'), '') ilike '%sengaja%'), string_agg(p.proname || ': ' || coalesce(obj_description(p.oid, 'pg_proc'), '-'), ' | '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'app' and p.proname in ('isi_demo', 'ukur_kuota');

select pg_temp.cek('tidak ada fungsi public/app memakai jam +08 tetap selain definisi app.tanggal_aman (usang)',
  count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app') and p.prosrc like '%+08%' and p.oid <> 'app.tanggal_aman(text,text)'::regprocedure;

select pg_temp.cek('tidak ada fungsi public/app yang memanggil app.tanggal_aman (WITA tersembunyi)',
  count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app') and p.prosrc like '%tanggal_aman%' and p.oid <> 'app.tanggal_aman(text,text)'::regprocedure;

select pg_temp.cek('putuskan_usulan tidak memakai current_date (tanggal UTC server)',
  count(*) = 1 and bool_and(p.prosrc !~* 'current_date'), count(*)::text)
  from pg_proc p where p.oid = to_regprocedure('public.putuskan_usulan(uuid,boolean)');

select pg_temp.cek('app.zona(uuid) dan app.hari_ini(uuid) ada: sql, stable, search_path kosong',
  count(*) = 2 and bool_and(p.provolatile = 's' and l.lanname = 'sql' and p.proconfig = array['search_path=""']), string_agg(p.oid::regprocedure::text || ' ' || p.provolatile::text || ' ' || coalesce(p.proconfig::text, '-'), ', '))
  from pg_proc p join pg_language l on l.oid = p.prolang
 where p.oid in (to_regprocedure('app.zona(uuid)'), to_regprocedure('app.hari_ini(uuid)'));

select pg_temp.cek('fungsi pembantu baru tidak bisa dipanggil langsung oleh public, anon, atau authenticated (hanya lewat fungsi security definer)',
  count(*) = 4 and bool_and(not has_function_privilege('public', f, 'execute') and not has_function_privilege('anon', f, 'execute')
                            and not has_function_privilege('authenticated', f, 'execute')), count(*)::text)
  from (select to_regprocedure(x) f from unnest(array['app.zona(uuid)', 'app.hari_ini(uuid)', 'app.tanggal_teks(text)', 'app.waktu_lokal(text,text,text)']) x) s
 where f is not null;

select pg_temp.cek('data lama: tidak ada kejadian izin yang masih di 00.00 WITA untuk usaha di zona lain',
  count(*) = 0, count(*)::text)
  from public.kejadian e join public.perusahaan pr on pr.id = e.perusahaan_id
  join public.pengajuan_izin pi on pi.id = (e.data ->> 'pengajuan_id')::uuid and pi.perusahaan_id = e.perusahaan_id
 where e.jenis like 'izin.%' and pr.zona_waktu <> 'Asia/Makassar'
   and e.terjadi_at = (pi.mulai::timestamp at time zone 'Asia/Makassar');

select pg_temp.cek('data lama: tidak ada kejadian dari usulan diterima yang masih di jam +08 untuk usaha di zona lain',
  count(*) = 0, count(*)::text)
  from public.kejadian e
 where app.zona(e.perusahaan_id) <> 'Asia/Makassar' and e.data is not null and not (e.data ? 'pengajuan_id')
   and e.terjadi_at = case when e.jenis = 'absen.harian' then app.tanggal_aman(e.data ->> 'tanggal', e.data ->> 'masuk')
                           when e.jenis in ('bank.masuk', 'bank.keluar') then app.tanggal_aman(e.data ->> 'tanggal')
                           when e.jenis = 'izin.sakit' then app.tanggal_aman(e.data ->> 'mulai')
                           else app.tanggal_aman(coalesce(e.data ->> 'tanggal', e.data ->> 'periode' || '-01')) end
   and exists (select 1 from public.usulan u where u.perusahaan_id = e.perusahaan_id and u.status = 'diterima' and u.sumber = e.sumber
                 and (u.payload -> 'bidang' = e.data or coalesce(u.payload -> 'bidang' -> 'baris', '[]') @> jsonb_build_array(e.data)));

select pg_temp.cek('data lama: cadangan koreksi tersimpan di audit_log untuk setiap kejadian yang dikoreksi',
  count(*) > 0 and bool_and(a.sebelum ? 'terjadi_at' and a.baris_id = (a.sebelum ->> 'id')::uuid), count(*)::text)
  from public.audit_log a where a.tabel = 'kejadian' and a.aksi = 'koreksi_zona_q24';

-- Bagian 2: perilaku.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pj uuid; pw uuid; c record; z text; h date; ka text; ks text; o uuid; o2 uuid; us uuid; iz public.pengajuan_izin;
  r jsonb; x text; n int; t timestamptz; kid uuid; usl uuid; tp uuid; g uuid; gb uuid; gc uuid; gd uuid; ge uuid; gf uuid;
  k1 uuid; k2 uuid; ot1 uuid; ot2 uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'wib-q24@uji.local'), (ub, 'wit-q24@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pj := public.buat_perusahaan('Warung Uji WIB Q24', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pw := public.buat_perusahaan('Warung Uji WIT Q24', 'fnb');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pw;
    perform pg_temp.cek('usaha uji: bawaan Asia/Jakarta, kedua Asia/Jayapura',
      (select zona_waktu from public.perusahaan where id = pj) = 'Asia/Jakarta' and (select zona_waktu from public.perusahaan where id = pw) = 'Asia/Jayapura');

    -- Fungsi pembantu, dipanggil sebagai pemilik fungsi (postgres), seperti di dalam fungsi security definer.
    begin
      perform pg_temp.cek('app.zona mengikuti zona usaha dan cadangan Asia/Jakarta',
        app.zona(pj) = 'Asia/Jakarta' and app.zona(pw) = 'Asia/Jayapura' and app.zona(null) = 'Asia/Jakarta' and app.zona(gen_random_uuid()) = 'Asia/Jakarta');
      perform pg_temp.cek('app.hari_ini = tanggal sekarang di zona usaha',
        app.hari_ini(pj) = (now() at time zone 'Asia/Jakarta')::date and app.hari_ini(pw) = (now() at time zone 'Asia/Jayapura')::date);
      perform pg_temp.cek('app.tanggal_teks sama persis dengan pasangan lama tanggal_aman +08 dibaca di WITA',
        (select bool_and(app.tanggal_teks(v) is not distinct from (app.tanggal_aman(v) at time zone 'Asia/Makassar')::date)
           from unnest(array['2026-11-01', '2026-12-31', '2027-01-01', '2026-02-30', '2026-13-01', 'abc', '01-11-2026', '', null]) v)
        and app.tanggal_teks('2026-11-01') = date '2026-11-01');
    exception when others then perform pg_temp.cek('fungsi pembantu berjalan saat dipanggil pemilik fungsi (konteks security definer)', false, sqlstate || ' ' || sqlerrm);
    end;

    for c in select * from (values (pj, ua, 'Asia/Jakarta'), (pw, ub, 'Asia/Jayapura')) v(pid, uid, zona) loop
      z := c.zona;
      h := (now() at time zone z)::date;
      ka := json_build_object('sub', c.uid, 'role', 'authenticated', 'app_metadata', json_build_object('pid', c.pid, 'prn', 'pemilik'))::text;
      execute 'set local role authenticated';
      perform set_config('request.jwt.claims', ka, true);
      perform public.atur_kebijakan_izin('sakit', true, 2, false, null, null);
      insert into public.orang (perusahaan_id, nama) values (c.pid, 'Staf Izin ' || z) returning id into o;
      insert into public.orang (perusahaan_id, nama) values (c.pid, 'Orang Izin Langsung ' || z) returning id into o2;
      perform public.buat_akun_staf(o, '246810');
      select user_id into us from public.orang where id = o;
      ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', c.pid, 'prn', 'staf'))::text;

      -- catat_izin langsung dengan tanggal tetap: selalu membedakan kode lama dan baru.
      execute 'reset role';
      begin
        insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, status, oleh_otopilot, alasan_putusan, diajukan_oleh)
        values (c.pid, o2, 'sakit', date '2026-11-01', date '2026-11-01', 1, 'disetujui', false, 'uji zona', c.uid) returning * into iz;
        perform app.catat_izin(iz);
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and data ->> 'pengajuan_id' = iz.id::text;
        perform pg_temp.cek('catat_izin ' || z || ': izin 1 Nov tercatat 1 Nov 00.00 lokal',
          t = (timestamp '2026-11-01 00:00' at time zone z) and (t at time zone z) = timestamp '2026-11-01 00:00', t::text);
      exception when others then perform pg_temp.cek('catat_izin ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;

      -- ajukan_izin lewat otopilot dan lewat Feed.
      execute 'set local role authenticated';
      perform set_config('request.jwt.claims', ks, true);
      begin
        r := public.ajukan_izin('sakit', h + 1, h + 1, 'Demam');
        execute 'reset role';
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and data ->> 'pengajuan_id' = r ->> 'id';
        perform pg_temp.cek('ajukan_izin ' || z || ': otopilot mencatat izin besok di 00.00 lokal',
          r ->> 'status' = 'disetujui' and t = ((h + 1)::timestamp at time zone z), r::text || ' ' || coalesce(t::text, '-'));

        -- batalkan_keputusan: izin.batal dan usulan baru jatuh di hari lokal yang sama.
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        select id into kid from public.keputusan where jenis = 'izin.otopilot' and subjek_id = (r ->> 'id')::uuid;
        r := public.batalkan_keputusan(kid, 'Uji zona Q24');
        execute 'reset role';
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and jenis = 'izin.batal' and data ->> 'keputusan_id' = kid::text;
        perform pg_temp.cek('batalkan_keputusan ' || z || ': izin.batal di 00.00 lokal hari izin',
          t = ((h + 1)::timestamp at time zone z), coalesce(t::text, '-'));
        select tenggat into t from public.usulan where id = (r ->> 'usulan')::uuid;
        perform pg_temp.cek('batalkan_keputusan ' || z || ': tenggat usulan ulang 00.00 lokal hari izin',
          t = ((h + 1)::timestamp at time zone z), coalesce(t::text, '-'));

        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ks, true);
        r := public.ajukan_izin('izin', h + 3, h + 3, 'Urusan keluarga');
        execute 'reset role';
        select tenggat into t from public.usulan where (payload ->> 'pengajuan_id') = r ->> 'id';
        perform pg_temp.cek('ajukan_izin ' || z || ': izin ke Feed bertenggat 00.00 lokal hari izin',
          r ->> 'status' = 'menunggu' and t = ((h + 3)::timestamp at time zone z), r::text || ' ' || coalesce(t::text, '-'));

        -- Batas 30 hari ke belakang memakai tanggal lokal (membedakan hanya pada jam tanggal WITA berbeda dari tanggal lokal).
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ks, true);
        r := public.ajukan_izin('izin', h - 30, h - 30, 'Lupa lapor');
        perform pg_temp.cek('ajukan_izin ' || z || ': mulai tepat 30 hari lalu (lokal) diterima', r ->> 'status' = 'menunggu', r::text);
        begin
          perform public.ajukan_izin('izin', h - 31, h - 31, 'Terlalu lama');
          perform pg_temp.cek('ajukan_izin ' || z || ': mulai 31 hari lalu (lokal) ditolak', false);
        exception when others then perform pg_temp.cek('ajukan_izin ' || z || ': mulai 31 hari lalu (lokal) ditolak', sqlstate = '22023', sqlerrm);
        end;

        -- izin_ringkas: tahun berjalan di zona usaha (membedakan hanya di jam pergantian tahun).
        r := public.izin_ringkas();
        perform pg_temp.cek('izin_ringkas ' || z || ': tahun = tahun lokal', (r ->> 'tahun')::int = extract(year from now() at time zone z)::int, r::text);
      exception when others then perform pg_temp.cek('blok izin ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- gerbang_gaji: jendela 30 hari memakai tengah malam lokal (tanggal acuan tetap h, selalu membedakan untuk salah satu zona).
      begin
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Akhir Hari ' || z, '{"mulai": "2020-01-01"}') returning id into g;
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Lewat Tengah Malam ' || z, '{"mulai": "2020-01-01"}') returning id into gb;
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Awal Jendela ' || z, '{"mulai": "2020-01-01"}') returning id into gc;
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Sebelum Jendela ' || z, '{"mulai": "2020-01-01"}') returning id into gd;
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Kontrak Hari Ini ' || z, jsonb_build_object('mulai', '2020-01-01', 'kontrak_selesai', h::text)) returning id into ge;
        insert into public.orang (perusahaan_id, nama, data) values (c.pid, 'Kontrak Kemarin ' || z, jsonb_build_object('mulai', '2020-01-01', 'kontrak_selesai', (h - 1)::text)) returning id into gf;
        insert into public.orang_rahasia (orang_id, perusahaan_id, gaji)
        select y, c.pid, '{"pokok": 3000000}' from unnest(array[g, gb, gc, gd, ge, gf]) y;
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id) values
          (c.pid, (h::timestamp + time '23:30') at time zone z, 'absen.masuk', 'pwa', g),
          (c.pid, ((h + 1)::timestamp + time '00:30') at time zone z, 'absen.masuk', 'pwa', gb),
          (c.pid, ((h - 30)::timestamp + time '00:30') at time zone z, 'absen.masuk', 'pwa', gc),
          (c.pid, ((h - 31)::timestamp + time '23:30') at time zone z, 'absen.masuk', 'pwa', gd),
          (c.pid, (h::timestamp + time '08:00') at time zone z, 'absen.masuk', 'pwa', ge),
          (c.pid, (h::timestamp + time '08:00') at time zone z, 'absen.masuk', 'pwa', gf);
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        select string_agg(orang_id::text, ',') into x from public.gerbang_gaji(h) where kode = 'tanpa_tanda_hidup';
        x := coalesce(x, '');
        perform pg_temp.cek('gerbang_gaji ' || z || ': absen 23.30 lokal di hari acuan masih di dalam jendela', position(g::text in x) = 0, x);
        perform pg_temp.cek('gerbang_gaji ' || z || ': absen 00.30 lokal sesudah hari acuan di luar jendela', position(gb::text in x) > 0, x);
        perform pg_temp.cek('gerbang_gaji ' || z || ': absen 00.30 lokal 30 hari lalu masih di dalam jendela', position(gc::text in x) = 0, x);
        perform pg_temp.cek('gerbang_gaji ' || z || ': absen 23.30 lokal 31 hari lalu di luar jendela', position(gd::text in x) > 0, x);
        select string_agg(orang_id::text, ',') into x from public.gerbang_gaji() where kode = 'kontrak_habis';
        x := coalesce(x, '');
        perform pg_temp.cek('gerbang_gaji ' || z || ': kontrak selesai hari ini (lokal) belum habis, kemarin sudah habis (membedakan di jam tanggal WITA berbeda)',
          position(ge::text in x) = 0 and position(gf::text in x) > 0, x);
      exception when others then perform pg_temp.cek('blok gerbang_gaji ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- papan_kerja (regresi kelompok A): kerja selesai sesudah 00.00 lokal tampil, sebelum 00.00 lokal tidak.
      begin
        insert into public.kerja (perusahaan_id, judul, status, mulai_at, selesai_at) values
          (c.pid, 'Selesai pagi ini ' || z, 'selesai', (h::timestamp at time zone z) - interval '20 minutes', (h::timestamp at time zone z) + interval '1 minute')
          returning id into k1;
        insert into public.kerja (perusahaan_id, judul, status, mulai_at, selesai_at) values
          (c.pid, 'Selesai kemarin malam ' || z, 'selesai', (h::timestamp at time zone z) - interval '30 minutes', (h::timestamp at time zone z) - interval '1 minute')
          returning id into k2;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.papan_kerja();
        perform pg_temp.cek('papan_kerja ' || z || ': selesai 00.01 lokal tampil, 23.59 kemarin tidak',
          exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k1)
          and not exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k2), r::text);
      exception when others then perform pg_temp.cek('blok papan_kerja ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- putuskan_usulan orang.topi: topi aktif dinilai dengan tanggal lokal, bukan current_date UTC
      -- (membedakan saat tanggal UTC berbeda dari tanggal lokal, misalnya 00.00 sampai 07.00 WIB).
      begin
        insert into public.topi (perusahaan_id, kode, nama) values (c.pid, 'kasir_q24', 'Kasir Q24') returning id into tp;
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Topi Selesai Kemarin ' || z) returning id into ot1;
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Topi Mulai Hari Ini ' || z) returning id into ot2;
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai, selesai) values
          (c.pid, ot1, tp, 100, h - 10, h - 1), (c.pid, ot2, tp, 100, h, null);
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
          (c.pid, 'peta', 'orang.topi', 'Pasang topi kasir Q24 1', jsonb_build_object('orang_id', ot1, 'topi_id', tp, 'persen', 50), array['pemilik'])
          returning id into usl;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.putuskan_usulan(usl, true);
        perform pg_temp.cek('putuskan_usulan ' || z || ': topi yang selesai kemarin (lokal) boleh dipasang lagi hari ini',
          (r ->> 'dibuat')::int = 1, r::text || ' current_date=' || current_date || ' lokal=' || h);
        execute 'reset role';
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
          (c.pid, 'peta', 'orang.topi', 'Pasang topi kasir Q24 2', jsonb_build_object('orang_id', ot2, 'topi_id', tp, 'persen', 50), array['pemilik'])
          returning id into usl;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        r := public.putuskan_usulan(usl, true);
        perform pg_temp.cek('putuskan_usulan ' || z || ': topi yang mulai hari ini (lokal) dianggap sudah terpasang, tidak digandakan',
          (r ->> 'dibuat')::int = 0, r::text || ' current_date=' || current_date || ' lokal=' || h);
      exception when others then perform pg_temp.cek('blok putuskan_usulan ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- putuskan_usulan dari nota, surat sakit, dan impor absen: tanggal/jam di teks dibaca di zona usaha (tanggal tetap, selalu membedakan).
      begin
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
          (c.pid, 'lempar', 'uang.keluar', 'Nota Q24', jsonb_build_object('bidang', jsonb_build_object('pemasok', 'Toko Q24', 'tanggal', '2026-11-01', 'total', 50000)), array['pemilik'])
          returning id into usl;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        perform public.putuskan_usulan(usl, true);
        execute 'reset role';
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and jenis = 'uang.keluar' and data ->> 'pemasok' = 'Toko Q24';
        perform pg_temp.cek('putuskan_usulan ' || z || ': nota bertanggal 1 Nov tercatat 1 Nov 00.00 lokal',
          t = (timestamp '2026-11-01 00:00' at time zone z), coalesce(t::text, '-'));
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
          (c.pid, 'lempar', 'izin.sakit', 'Surat sakit Q24', jsonb_build_object('bidang', jsonb_build_object('nama', 'Sakit Q24', 'mulai', '2026-11-01', 'lama_hari', 2)), array['pemilik'])
          returning id into usl;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        perform public.putuskan_usulan(usl, true);
        execute 'reset role';
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and jenis = 'izin.sakit' and data ->> 'nama' = 'Sakit Q24';
        perform pg_temp.cek('putuskan_usulan ' || z || ': surat sakit mulai 1 Nov tercatat 1 Nov 00.00 lokal',
          t = (timestamp '2026-11-01 00:00' at time zone z), coalesce(t::text, '-'));
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
          (c.pid, 'lempar', 'absen.impor', 'Absen Q24', jsonb_build_object('bidang', jsonb_build_object('baris',
            jsonb_build_array(jsonb_build_object('nama', 'Absen Q24', 'tanggal', '2026-11-01', 'masuk', '07.45')))), array['pemilik'])
          returning id into usl;
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', ka, true);
        perform public.putuskan_usulan(usl, true);
        execute 'reset role';
        select terjadi_at into t from public.kejadian where perusahaan_id = c.pid and jenis = 'absen.harian' and data ->> 'nama' = 'Absen Q24';
        perform pg_temp.cek('putuskan_usulan ' || z || ': absen impor 1 Nov masuk 07.45 tercatat 07.45 lokal',
          t = (timestamp '2026-11-01 07:45' at time zone z), coalesce(t::text, '-'));
      exception when others then perform pg_temp.cek('blok putuskan_usulan nota/sakit/absen ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
      execute 'reset role';

      -- catat_jam_rekrut: larangan tanggal masa depan memakai hari ini zona usaha (membedakan saat tanggal WITA berbeda dari
      -- tanggal lokal). Jenis sengaja tidak dikenal: pemeriksaan tanggal berjalan lebih dulu, jadi pesannya menunjukkan cabang mana.
      execute 'set local role authenticated';
      perform set_config('request.jwt.claims', ka, true);
      begin
        perform public.catat_jam_rekrut('uji_zona', null, null, h, 30, null);
        perform pg_temp.cek('catat_jam_rekrut ' || z || ': tanggal hari ini (lokal) bukan masa depan', false, 'tidak ada galat');
      exception when others then
        perform pg_temp.cek('catat_jam_rekrut ' || z || ': tanggal hari ini (lokal) bukan masa depan', sqlerrm = 'Jenis waktu tidak dikenal.', sqlerrm);
      end;
      begin
        perform public.catat_jam_rekrut('uji_zona', null, null, h + 1, 30, null);
        perform pg_temp.cek('catat_jam_rekrut ' || z || ': tanggal besok (lokal) ditolak sebagai masa depan', false, 'tidak ada galat');
      exception when others then
        perform pg_temp.cek('catat_jam_rekrut ' || z || ': tanggal besok (lokal) ditolak sebagai masa depan', sqlerrm = 'Tanggal sesi tidak boleh di masa depan.', sqlerrm);
      end;
      execute 'reset role';

      -- peringatan_rencana: mulai kerja mentor tanpa data.mulai diambil dari dibuat_at di zona usaha (tanggal tetap, selalu membedakan
      -- untuk salah satu arah). Rencana mulai 1 Des 2026, batas 6 bulan = 1 Jun 2026.
      begin
        insert into public.orang (perusahaan_id, nama, dibuat_at) values
          (c.pid, 'Mentor Batas ' || z, (timestamp '2026-06-01 23:30') at time zone z) returning id into g;
        insert into public.orang (perusahaan_id, nama, dibuat_at) values
          (c.pid, 'Mentor Lewat Batas ' || z, (timestamp '2026-06-02 00:30') at time zone z) returning id into gb;
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Peserta Magang 1 ' || z) returning id into gc;
        insert into public.orang (perusahaan_id, nama) values (c.pid, 'Peserta Magang 2 ' || z) returning id into gd;
        insert into public.rencana_magang (perusahaan_id, orang_id, mentor_id, mulai, selesai, tujuan)
          values (c.pid, gc, g, date '2026-12-01', date '2027-02-28', 'Uji zona mentor') returning id into k1;
        insert into public.rencana_magang (perusahaan_id, orang_id, mentor_id, mulai, selesai, tujuan)
          values (c.pid, gd, gb, date '2026-12-01', date '2027-02-28', 'Uji zona mentor') returning id into k2;
        perform pg_temp.cek('peringatan_rencana ' || z || ': mentor dibuat 1 Jun 23.30 lokal tepat 6 bulan, tanpa peringatan mentor baru',
          not exists (select 1 from jsonb_array_elements(app.peringatan_rencana(k1)) e where e ->> 'kode' = 'mentor_baru'), app.peringatan_rencana(k1)::text);
        perform pg_temp.cek('peringatan_rencana ' || z || ': mentor dibuat 2 Jun 00.30 lokal kurang dari 6 bulan, diberi peringatan',
          exists (select 1 from jsonb_array_elements(app.peringatan_rencana(k2)) e where e ->> 'kode' = 'mentor_baru'), app.peringatan_rencana(k2)::text);
      exception when others then perform pg_temp.cek('blok peringatan_rencana ' || z || ' berjalan', false, sqlstate || ' ' || sqlerrm);
      end;
    end loop;
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
