-- Tes X-11 (supabase/migrations/20261111133000_kerja_review.sql): kirim hasil -> review -> kartu Feed; terima -> selesai;
-- minta revisi wajib beralasan -> kembali jalan; tenggat awal terkunci, geser lewat pengajuan yang disetujui; KPI tepat terhadap
-- baseline dan tenggat disetujui; isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ksari text; kdewi text;
  sari uuid; dewi uuid; k1 uuid; u1 uuid; u2 uuid; r jsonb; v_senin date; t0 timestamptz := now() + interval '2 days';
begin
  begin
    insert into auth.users (id, email) values (ua, 'rev-a@uji.local'), (ub, 'rev-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Agensi Review Uji', 'kantor');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Usaha Lain Review', 'kantor');
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Sari Review', array['karyawan']) returning id into sari;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Dewi Review', array['karyawan']) returning id into dewi;
    perform public.buat_akun_staf(sari, '123456');
    perform public.buat_akun_staf(dewi, '123456');
    ksari := json_build_object('sub', (select user_id from public.orang where id = sari), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kdewi := json_build_object('sub', (select user_id from public.orang where id = dewi), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    r := public.buat_kerja('Desain brosur', null, sari, t0, null);
    k1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('tenggat pertama menjadi baseline', (select tenggat_awal = t0 from public.kerja where id = k1));
    execute 'reset role';
    begin update public.kerja set tenggat = t0 + interval '5 days' where id = k1; perform pg_temp.cek('tenggat tidak bisa digeser langsung', false);
    exception when sqlstate '42501' then perform pg_temp.cek('tenggat tidak bisa digeser langsung', true); end;
    execute 'set local role authenticated';

    -- Pelaksana mengirim hasil.
    perform set_config('request.jwt.claims', ksari, true);
    begin perform public.kirim_hasil_kerja(k1, 'https://drive.example.org/brosur', null); perform pg_temp.cek('hasil sebelum mulai ditolak', false);
    exception when sqlstate '55000' then perform pg_temp.cek('hasil sebelum mulai ditolak', true); end;
    perform public.ubah_status_kerja(k1, 'mulai');
    begin perform public.kirim_hasil_kerja(k1, 'javascript:alert(1)', null); perform pg_temp.cek('tautan bukan https ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tautan bukan https ditolak', true); end;
    begin perform public.kirim_hasil_kerja(k1, null, '  '); perform pg_temp.cek('hasil kosong ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('hasil kosong ditolak', true); end;
    r := public.kirim_hasil_kerja(k1, 'https://drive.example.org/brosur-v1', 'Versi pertama');
    u1 := (r ->> 'usulan')::uuid;
    perform pg_temp.cek('kerja masuk review', (select status from public.kerja where id = k1) = 'review', r::text);
    perform pg_temp.cek('staf tidak melihat kartu Feed', (select count(*) from public.usulan where id = u1) = 0);
    begin perform public.ubah_status_kerja(k1, 'selesai'); perform pg_temp.cek('pelaksana tidak bisa menyelesaikan sendiri saat review', false);
    exception when sqlstate '55000' then perform pg_temp.cek('pelaksana tidak bisa menyelesaikan sendiri saat review', true); end;
    begin perform public.minta_revisi_kerja(u1, 'Warna kurang kontras'); perform pg_temp.cek('staf tidak bisa meminta revisi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa meminta revisi', true); end;
    perform set_config('request.jwt.claims', kdewi, true);
    begin perform public.kirim_hasil_kerja(k1, 'https://x.example.org', null); perform pg_temp.cek('bukan pelaksana tidak bisa mengirim hasil', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('bukan pelaksana tidak bisa mengirim hasil', true); end;

    -- Pemilik minta revisi beralasan, lalu menerima kiriman kedua lewat Feed.
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('kartu Feed review menunggu untuk pemilik', exists (select 1 from public.usulan where id = u1 and aksi = 'kerja.review' and status = 'menunggu'));
    begin perform public.minta_revisi_kerja(u1, 'x'); perform pg_temp.cek('revisi tanpa alasan cukup ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('revisi tanpa alasan cukup ditolak', true); end;
    perform public.minta_revisi_kerja(u1, 'Warna logo kurang kontras di cetak');
    perform pg_temp.cek('revisi: kerja kembali jalan, hasil revisi beralasan, usulan ditolak',
      (select status from public.kerja where id = k1) = 'jalan' and (select status = 'ditolak' from public.usulan where id = u1)
      and exists (select 1 from public.kerja_hasil where kerja_id = k1 and status = 'revisi' and alasan like 'Warna logo%'));
    perform set_config('request.jwt.claims', ksari, true);
    r := public.kirim_hasil_kerja(k1, 'https://drive.example.org/brosur-v2', 'Kontras diperbaiki');
    u2 := (r ->> 'usulan')::uuid;
    -- Pengajuan geser tenggat oleh pelaksana, disetujui pemilik: tenggat baru, baseline tetap.
    r := public.ajukan_geser_tenggat(k1, t0 + interval '3 days', 'Klien minta tambah halaman');
    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan((r ->> 'usulan')::uuid, true);
    perform pg_temp.cek('geser tenggat disetujui: tenggat baru, baseline tetap', (select tenggat = t0 + interval '3 days' and tenggat_awal = t0 from public.kerja where id = k1));
    perform public.putuskan_usulan(u2, true);
    perform pg_temp.cek('hasil diterima lewat Feed: kerja selesai', (select status = 'selesai' and selesai_at is not null from public.kerja where id = k1)
      and exists (select 1 from public.kerja_hasil where kerja_id = k1 and status = 'diterima'));
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat hasil kerja', (select count(*) from public.kerja_hasil) = 0);
    begin perform public.minta_revisi_kerja(u2, 'Susupan dari usaha lain'); perform pg_temp.cek('usaha lain tidak bisa memutus', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa memutus', true); end;
    execute 'reset role';

    -- KPI: selesai sesudah baseline tetapi sebelum tenggat yang disetujui -> tepat (disetujui) tetapi tidak tepat baseline.
    update public.kerja set selesai_at = t0 + interval '1 day' where id = k1;
    v_senin := date_trunc('week', ((t0 + interval '1 day') at time zone 'Asia/Makassar')::date)::date;
    r := (select kpi from app.kpi_orang(pa, v_senin) where orang_id = sari);
    perform pg_temp.cek('KPI: tepat terhadap tenggat disetujui 1/1, terhadap baseline 0/1',
      (r -> 'tepat' ->> 'nilai')::int = 1 and (r -> 'tepat' ->> 'dari')::int = 1 and (r -> 'tepat_awal' ->> 'nilai')::int = 0 and (r -> 'tepat_awal' ->> 'dari')::int = 1, r::text);
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES % | gagal=[%]', (select count(*) from _t where ok), coalesce(g, '');
end $$;
