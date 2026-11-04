-- Tes M-12 waktu lanjutan (supabase/migrations/20261105062000_waktu_lanjutan.sql): geofence absen (tanpa lokasi, di luar radius,
-- di dalam radius), kunci periode absensi (lembur, izin, kejadian absen impor), libur nasional SKB 2026, siaga, lembur diajukan staf.
-- Titik uji: tempat di Denpasar (-8.6705, 115.2126) radius 100 m; HP 1 km di utara (-8.6615) ditolak, HP 30 m (-8.6702) diterima.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; pa uuid; pb uuid; ka text; kb text; ks text;
  tp uuid; o1 uuid; k bytea; t bigint; kode text; r jsonb; v_hari date; v_lalu date; u uuid; sh uuid; pesan text;
  wajah jsonb := '{"lulus": true, "kedip": true, "menoleh": "kiri"}';
begin
  begin
    insert into auth.users (id, email) values (ua, 'wa@uji.local'), (ub, 'wb@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Waktu', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Warung Uji Waktu B', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    tp := public.tempat_absen_utama();
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Waktu') returning id into o1;
    perform public.buat_akun_staf(o1, '123456');
    select user_id into us from public.orang where id = o1;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    perform public.atur_geofence(tp, -8.6705, 115.2126, 100);
    begin
      perform public.atur_geofence(tp, -8.6705, 115.2126, 5);
      perform pg_temp.cek('radius di bawah 20 m ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('radius di bawah 20 m ditolak', true);
    end;
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    v_lalu := (date_trunc('month', v_hari) - interval '1 month')::date + 9;
    select rahasia into k from app.rahasia_tempat where tempat_id = tp;
    t := floor(extract(epoch from clock_timestamp()) / 15)::bigint;
    kode := app.totp(k, t * 15, 15, 6);
    perform pg_temp.cek('jarak haversine 1 km ke utara', round(app.jarak_m(-8.6705, 115.2126, -8.6615, 115.2126)) between 995 and 1005,
      round(app.jarak_m(-8.6705, 115.2126, -8.6615, 115.2126))::text);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.absen_catat(tp, kode, 'absen.masuk', wajah);
      perform pg_temp.cek('tanpa lokasi ditolak dengan pesan izinkan lokasi', false);
    exception when sqlstate '22023' then
      get stacked diagnostics pesan = message_text;
      perform pg_temp.cek('tanpa lokasi ditolak dengan pesan izinkan lokasi', pesan like '%butuh lokasi HP. Izinkan lokasi%', pesan);
    end;
    begin
      perform public.absen_catat(tp, kode, 'absen.masuk', wajah || '{"lokasi": {"lat": -8.6615, "lng": 115.2126, "akurasi": 15}}');
      perform pg_temp.cek('di luar radius ditolak menyebut jarak dan radius', false);
    exception when sqlstate '22023' then
      get stacked diagnostics pesan = message_text;
      perform pg_temp.cek('di luar radius ditolak menyebut jarak dan radius', pesan like 'Kamu sekitar 1001 m dari %. Absen hanya bisa dalam 100 m%', pesan);
    end;
    r := public.absen_catat(tp, kode, 'absen.masuk', wajah || '{"lokasi": {"lat": -8.6702, "lng": 115.2126, "akurasi": 10}}');
    perform pg_temp.cek('di dalam radius tercatat dengan jaraknya', r ->> 'jenis' = 'absen.masuk'
      and exists (select 1 from public.kejadian e where e.perusahaan_id = pa and e.orang_id = o1 and e.jenis = 'absen.masuk' and (e.data ->> 'jarak_m')::int between 30 and 36), r::text);

    -- Lembur diajukan staf: usulan, lalu disetujui pemilik menjadi baris lembur.
    r := public.ajukan_lembur(v_hari, 'hari_kerja', 2, 'Stok opname akhir bulan', gen_random_uuid());
    u := (r ->> 'id')::uuid;
    perform pg_temp.cek('staf mengajukan lembur menjadi usulan, belum tercatat', u is not null);
    begin
      perform public.ajukan_lembur(v_hari, 'hari_kerja', 20, 'Terlalu lama', gen_random_uuid());
      perform pg_temp.cek('lembur 20 jam ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('lembur 20 jam ditolak', true);
    end;
    begin
      perform public.atur_kunci_absensi(v_lalu, true, null);
      perform pg_temp.cek('staf tidak bisa mengunci absensi', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mengunci absensi', true);
    end;
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik melihat usulan lembur, lembur belum ada', exists (select 1 from public.usulan where id = u and aksi = 'lembur.ajukan')
      and not exists (select 1 from public.lembur where orang_id = o1));
    perform public.putuskan_usulan(u, true);
    perform pg_temp.cek('disetujui: lembur 2 jam tercatat dengan catatan staf', exists (select 1 from public.lembur where orang_id = o1 and tanggal = v_hari and jam = 2 and catatan like 'Diajukan staf:%'));

    -- Kunci periode absensi bulan lalu.
    begin
      perform public.atur_kunci_absensi(v_hari, true, null);
      perform pg_temp.cek('bulan berjalan tidak bisa dikunci', false);
    exception when sqlstate '22023' then perform pg_temp.cek('bulan berjalan tidak bisa dikunci', true);
    end;
    perform public.atur_kunci_absensi(v_lalu, true, null);
    begin
      perform public.catat_lembur(o1, v_lalu, 'hari_kerja', 1, 'lembur lama');
      perform pg_temp.cek('lembur di bulan terkunci ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('lembur di bulan terkunci ditolak', true);
    end;
    execute 'reset role';
    begin
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id) values (pa, (v_lalu + 1)::timestamp at time zone 'Asia/Jakarta', 'absen.harian', 'lempar', o1);
      perform pg_temp.cek('absen impor bertanggal bulan terkunci ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('absen impor bertanggal bulan terkunci ditolak', true);
    end;
    begin
      insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, alasan, status) values (pa, o1, 'izin', v_lalu, v_lalu, 1, 'urusan keluarga', 'menunggu');
      perform pg_temp.cek('izin bertanggal bulan terkunci ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('izin bertanggal bulan terkunci ditolak', true);
    when others then perform pg_temp.cek('izin bertanggal bulan terkunci ditolak', false, sqlstate || ' ' || sqlerrm);
    end;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.atur_kunci_absensi(v_lalu, false, '');
      perform pg_temp.cek('membuka kunci butuh alasan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('membuka kunci butuh alasan', true);
    end;
    perform public.atur_kunci_absensi(v_lalu, false, 'Koreksi lembur yang lupa dicatat');
    perform public.catat_lembur(o1, v_lalu, 'hari_kerja', 1, 'lembur lama');
    perform pg_temp.cek('setelah dibuka, lembur bulan lalu bisa dicatat', exists (select 1 from public.lembur where orang_id = o1 and tanggal = v_lalu));

    -- Libur nasional dan siaga.
    perform pg_temp.cek('libur nasional 2026: 17 libur dan 8 cuti bersama', (select count(*) filter (where jenis = 'libur') = 17 and count(*) filter (where jenis = 'cuti_bersama') = 8
      from public.libur_nasional where tanggal between '2026-01-01' and '2026-12-31'));
    perform pg_temp.cek('17 Agustus 2026 libur, 24 Desember cuti bersama', exists (select 1 from public.libur_nasional where tanggal = '2026-08-17' and jenis = 'libur')
      and exists (select 1 from public.libur_nasional where tanggal = '2026-12-24' and jenis = 'cuti_bersama'));
    sh := (public.simpan_shift(o1, v_hari + 1, '20:00', '23:00', 0, null, gen_random_uuid()) ->> 'id')::uuid;
    perform public.tandai_siaga(sh, true);
    perform pg_temp.cek('shift ditandai siaga', (select siaga from public.shift where id = sh));

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat kunci absensi usaha A', not exists (select 1 from public.kunci_absensi where perusahaan_id = pa));
    begin
      perform public.atur_geofence(tp, 0, 0, 100);
      perform pg_temp.cek('usaha lain tidak bisa mengubah geofence usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa mengubah geofence usaha A', true);
    end;
    begin
      perform public.tandai_siaga(sh, false);
      perform pg_temp.cek('usaha lain tidak bisa mengubah shift usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa mengubah shift usaha A', true);
    end;
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
