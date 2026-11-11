-- Tes X-12 (supabase/migrations/20261111134000_proyek_operasional.sql): template, pratinjau, buat proyek dari template dalam
-- satu transaksi, proyek berulang dan periodenya, isolasi staf dan usaha lain, invoice dari proyek. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ksari text; kdewi text;
  sari uuid; dewi uuid; orang_b uuid; klien uuid; tpl uuid; p1 uuid; p2 uuid; r jsonb; n int;
  isi jsonb := '[{"judul":"Brief klien","hari":0,"poin":1,"butir":["Kumpulkan logo","Konfirmasi warna"]},{"judul":"Desain materi","hari":3,"poin":4,"butir":["Draf 1"]},{"judul":"Laporan bulanan","hari":6}]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'pro-a@uji.local'), (ub, 'pro-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Agensi Proyek Uji', 'kantor');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Usaha Lain Proyek', 'kantor');
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pb, 'Orang B', array['karyawan']) returning id into orang_b;
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Sari Proyek', array['karyawan']) returning id into sari;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Dewi Proyek', array['karyawan']) returning id into dewi;
    perform public.buat_akun_staf(sari, '123456');
    perform public.buat_akun_staf(dewi, '123456');
    ksari := json_build_object('sub', (select user_id from public.orang where id = sari), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kdewi := json_build_object('sub', (select user_id from public.orang where id = dewi), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    execute 'reset role';
    insert into public.customer (perusahaan_id, nama, hp) values (pa, 'Hotel Bali Uji', '6281234567890') returning id into klien;
    execute 'set local role authenticated';

    begin perform public.simpan_template_proyek(null, 'Rusak', '[{"judul":"x"}]'); perform pg_temp.cek('template berjudul pendek ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('template berjudul pendek ditolak', true); end;
    r := public.simpan_template_proyek(null, 'Kampanye bulanan', isi);
    tpl := (r ->> 'id')::uuid;
    r := public.pratinjau_template(tpl, date '2026-12-01');
    perform pg_temp.cek('pratinjau 3 kerja dengan tenggat dari mulai, tanpa menulis', jsonb_array_length(r) = 3 and r -> 1 ->> 'tenggat' = '2026-12-04'
      and (select count(*) from public.kerja where perusahaan_id = pa) = 0, r::text);

    -- Gagal satu (PIC usaha lain) -> tidak ada yang tersimpan.
    begin perform public.buat_proyek(jsonb_build_object('nama', 'Gagal', 'tipe', 'sekali', 'pic', orang_b, 'template_id', tpl));
      perform pg_temp.cek('PIC usaha lain ditolak', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('PIC usaha lain ditolak', true); end;
    perform pg_temp.cek('proyek gagal tidak meninggalkan dimensi atau kerja', (select count(*) from public.dimension where perusahaan_id = pa and nama = 'Gagal') = 0);

    r := public.buat_proyek(jsonb_build_object('nama', 'Katalog Hotel', 'tipe', 'sekali', 'pic', sari, 'klien', klien, 'template_id', tpl, 'mulai', '2026-12-01', 'target', '2026-12-31'));
    p1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('proyek sekali dari template: 3 kerja + 3 butir, PIC pelaksana, tim berisi PIC', (r ->> 'kerja')::int = 3
      and (select count(*) from public.kerja where proyek_id = p1 and pelaksana_id = sari) = 3
      and (select count(*) from public.kerja_butir b join public.kerja k on k.id = b.kerja_id where k.proyek_id = p1) = 3
      and exists (select 1 from public.proyek_tim where dimension_id = p1 and orang_id = sari), r::text);

    r := public.buat_proyek(jsonb_build_object('nama', 'Konten Bulanan', 'tipe', 'berulang', 'pola', 'bulanan', 'pic', sari, 'tim', jsonb_build_array(dewi), 'template_id', tpl, 'mulai', '2026-10-15'));
    p2 := (r ->> 'id')::uuid;
    perform pg_temp.cek('proyek berulang membuat periode bulan mulai dan kerjanya', (select count(*) from public.proyek_periode where dimension_id = p2) = 1
      and (select min(mulai) from public.proyek_periode where dimension_id = p2) = date '2026-10-01' and (select count(*) from public.kerja where proyek_id = p2) = 3, r::text);
    begin perform public.buat_proyek(jsonb_build_object('nama', 'Tanpa pola', 'tipe', 'berulang', 'template_id', tpl));
      perform pg_temp.cek('berulang tanpa pola ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('berulang tanpa pola ditolak', true); end;
    execute 'reset role';

    -- Cron: periode bulan ini dibuat sekali; dijalankan lagi tidak menggandakan; periode lama tetap.
    n := app.proyek_berulang_jalankan();
    perform app.proyek_berulang_jalankan();
    perform pg_temp.cek('cron membuka periode berjalan sekali, periode lama tetap', (select count(*) from public.proyek_periode where dimension_id = p2) = 2
      and (select count(*) from public.kerja where proyek_id = p2) = 6
      and (select count(*) from public.kerja k join public.proyek_periode pp on pp.id = k.periode_id where pp.dimension_id = p2 and pp.mulai = date '2026-10-01') = 3, n::text);
    update public.proyek_info set status = 'tunda' where dimension_id = p2;
    perform pg_temp.cek('proyek ditunda tidak membuka periode', app.proyek_berulang_jalankan() = 0);
    execute 'set local role authenticated';

    -- Staf: Dewi anggota tim p2 melihat p2 tetapi tidak p1; usaha lain tidak melihat apa pun.
    perform set_config('request.jwt.claims', kdewi, true);
    perform pg_temp.cek('staf melihat proyek timnya saja', (select count(*) from public.proyek_info where dimension_id = p2) = 1 and (select count(*) from public.proyek_info where dimension_id = p1) = 0);
    begin perform public.buat_proyek(jsonb_build_object('nama', 'Staf coba', 'tipe', 'sekali')); perform pg_temp.cek('staf tidak bisa membuat proyek', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa membuat proyek', true); end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat proyek, template, periode', (select count(*) from public.proyek_info) = 0 and (select count(*) from public.proyek_template) = 0
      and (select count(*) from public.proyek_periode) = 0);
    begin perform public.pratinjau_template(tpl, null); perform pg_temp.cek('usaha lain: pratinjau kosong', public.pratinjau_template(tpl, null) = '[]'::jsonb);
    exception when others then perform pg_temp.cek('usaha lain: pratinjau kosong', false, sqlerrm); end;

    -- Invoice dari proyek.
    perform set_config('request.jwt.claims', ka, true);
    r := public.buat_invoice_proyek(p1, 'Desain katalog hotel', 12500000, date '2026-12-31');
    perform pg_temp.cek('invoice dari proyek tercatat dan memakai nama klien', exists (select 1 from public.proyek_invoice pi join public.invoice i on i.id = pi.invoice_id
      where pi.dimension_id = p1 and i.pelanggan = 'Hotel Bali Uji' and i.total = 12500000), r::text);
    begin perform public.buat_invoice_proyek(p2, 'x', 1000, null); perform pg_temp.cek('proyek tanpa klien tidak bisa ditagih', false);
    exception when sqlstate '22023' then perform pg_temp.cek('proyek tanpa klien tidak bisa ditagih', true); end;
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
