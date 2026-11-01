-- Tes F5-03: Sarapan Data. Usaha A punya tiga hal berdampak rupiah (belanja naik Rp1.300.000, tagihan lewat tempo Rp1.000.000,
-- pengingat tagihan Rp250.000) -> tepat 3 insight urut dampak, teks memuat rupiah persis; usaha B angkanya kecil dan usaha C
-- berambang tinggi -> tidak ada insight (tidak ada pesan bila tidak penting); susun ulang idempoten; layar hanya pemilik/admin;
-- Analis Malam (peran layanan) hanya mengisi teks_model sekali; pemberitahuan pagi hanya untuk usaha yang punya insight;
-- demo publik membawa 1 sampai 3 insight berdampak.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; pc uuid; ka text; kb text;
  o_s uuid; u_s uuid; r jsonb; v_hari date; w int; x jsonb; v_id uuid; n int;
  v_baris jsonb := '[{"uraian": "Nasi kotak", "jumlah": 10, "harga": 25000}]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'sarapan-a@uji.local'), (ub, 'sarapan-b@uji.local'), (uc, 'sarapan-c@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Sarapan', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Sarapan B', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    pc := public.buat_perusahaan('Toko Uji Sarapan C', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    -- Pengingat tagihan: invoice Rp250.000 jatuh tempo 3 hari lagi, pengingat H-3 jatuh hari ini.
    perform set_config('request.jwt.claims', ka, true);
    perform public.atur_bayar(null, null, null, 'BCA 1234567890 a.n. Warung Uji Sarapan');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    execute 'set local role authenticated';
    perform public.buat_invoice('Bu Rina', null, v_baris, v_hari + 3, null, gen_random_uuid());
    execute 'reset role';
    update public.perusahaan set pengaturan = pengaturan || '{"ambang_insight": 2000000}' where id = pc;

    -- Tagihan: satu terbuka lewat tempo 6 hari (Rp1.000.000), satu terbuka belum tempo, satu lewat tempo tapi sudah lunas.
    x := jsonb_build_object('a', gen_random_uuid(), 'b', gen_random_uuid(), 'c', gen_random_uuid());
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data) values
      (pa, now() - interval '20 days', 'invoice.terbit', 'nadi', 1000000, jsonb_build_object('kasus', x ->> 'a', 'tempo_hari', 14)),
      (pa, now() - interval '5 days', 'invoice.terbit', 'nadi', 3000000, jsonb_build_object('kasus', x ->> 'b', 'tempo_hari', 14)),
      (pa, now() - interval '30 days', 'invoice.terbit', 'nadi', 5000000, jsonb_build_object('kasus', x ->> 'c', 'tempo_hari', 14)),
      (pa, now() - interval '2 days', 'invoice.lunas', 'nadi', 5000000, jsonb_build_object('kasus', x ->> 'c'));
    -- Belanja: 4 minggu sebelumnya Rp1.000.000/minggu (A, C) atau Rp50.000 (B); minggu ini Rp2.300.000 (A, C) atau Rp100.000 (B).
    for w in 1..4 loop
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data) values
        (pa, now() - (w * 7 + 3) * interval '1 day', 'uang.keluar', 'nadi', 1000000, '{"pemasok": "Pasar Lama"}'),
        (pc, now() - (w * 7 + 3) * interval '1 day', 'uang.keluar', 'nadi', 1000000, '{"pemasok": "Pasar Lama"}'),
        (pb, now() - (w * 7 + 3) * interval '1 day', 'uang.keluar', 'nadi', 50000, '{"pemasok": "Pasar Lama"}');
    end loop;
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data) values
      (pa, now() - interval '2 days', 'uang.keluar', 'nadi', 2000000, '{"pemasok": "UD Maju"}'),
      (pa, now() - interval '1 days', 'uang.keluar', 'nadi', 300000, '{"pemasok": "Pasar Lama"}'),
      (pc, now() - interval '2 days', 'uang.keluar', 'nadi', 2300000, '{"pemasok": "UD Maju"}'),
      (pb, now() - interval '2 days', 'uang.keluar', 'nadi', 100000, '{"pemasok": "UD Maju"}');

    perform app.susun_insight();
    perform pg_temp.cek('A: tepat 3 insight urut dampak (belanja, tagihan, pengingat)',
      (select array_agg(kode order by urutan) from public.insight_pagi where perusahaan_id = pa and tanggal = v_hari)
        = array['belanja_naik', 'tagihan_lewat_tempo', 'pengingat_tagihan'],
      (select string_agg(kode || ':' || dampak_rp, ', ' order by urutan) from public.insight_pagi where perusahaan_id = pa));
    perform pg_temp.cek('A: dampak persis 1.300.000 / 1.000.000 / 250.000',
      (select array_agg(dampak_rp order by urutan) from public.insight_pagi where perusahaan_id = pa and tanggal = v_hari) = array[1300000, 1000000, 250000]::bigint[]);
    perform pg_temp.cek('A: teks menyebut rupiah dan pemasok terbesar',
      (select teks from public.insight_pagi where perusahaan_id = pa and kode = 'belanja_naik') like '%Rp2.300.000%naik Rp1.300.000%Rp1.000.000%UD Maju: Rp2.000.000.'
      and (select teks from public.insight_pagi where perusahaan_id = pa and kode = 'tagihan_lewat_tempo') = 'Tagih 1 invoice yang lewat jatuh tempo, totalnya Rp1.000.000. Yang paling lama sudah telat 6 hari.',
      (select string_agg(teks, ' | ') from public.insight_pagi where perusahaan_id = pa));
    perform pg_temp.cek('B (angka kecil) dan C (ambang Rp2.000.000) tanpa insight',
      not exists (select 1 from public.insight_pagi where perusahaan_id in (pb, pc)));
    perform app.susun_insight();
    perform pg_temp.cek('susun ulang di hari yang sama tidak menggandakan', (select count(*) from public.insight_pagi where perusahaan_id = pa) = 3);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.sarapan_data();
    perform pg_temp.cek('pemilik A: sarapan_data 3 insight, teks aturan', jsonb_array_length(r -> 'insight') = 3
      and not (r -> 'insight' -> 0 ->> 'dari_model')::boolean and (r ->> 'tanggal')::date = v_hari, r::text);
    perform pg_temp.cek('RLS insight_pagi: pemilik A hanya melihat miliknya', (select count(*) from public.insight_pagi) = 3);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('pemilik B: kosong', jsonb_array_length(public.sarapan_data() -> 'insight') = 0
      and (select count(*) from public.insight_pagi) = 0);
    begin perform public.analis_bahan(); perform pg_temp.cek('pengguna biasa tidak bisa membaca bahan Analis Malam', false);
    exception when others then perform pg_temp.cek('pengguna biasa tidak bisa membaca bahan Analis Malam', sqlstate = '42501', sqlerrm); end;

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Sarapan') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
    begin perform public.sarapan_data(); perform pg_temp.cek('staf ditolak', false);
    exception when others then perform pg_temp.cek('staf ditolak', sqlstate = '42501', sqlerrm); end;
    perform pg_temp.cek('staf tidak membaca insight lewat tabel', (select count(*) from public.insight_pagi) = 0);
    execute 'set local role anon';
    begin perform public.sarapan_data(); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;

    -- Analis Malam (peran layanan).
    execute 'set local role service_role';
    perform pg_temp.cek('bahan Analis Malam memuat insight A tanpa teks_model', (select count(*) from jsonb_array_elements(public.analis_bahan()) b
      where (b ->> 'perusahaan_id')::uuid = pa) = 3);
    select id into v_id from public.insight_pagi where perusahaan_id = pa and urutan = 2;
    n := public.analis_simpan(jsonb_build_array(jsonb_build_object('id', v_id, 'teks', 'Satu invoice Rp1.000.000 sudah telat 6 hari; tagih hari ini.')));
    perform pg_temp.cek('analis_simpan mengisi teks_model sekali', n = 1
      and public.analis_simpan(jsonb_build_array(jsonb_build_object('id', v_id, 'teks', 'timpa'))) = 0);
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.sarapan_data();
    perform pg_temp.cek('layar memakai teks_model bila ada', r -> 'insight' -> 1 ->> 'teks' = 'Satu invoice Rp1.000.000 sudah telat 6 hari; tagih hari ini.'
      and (r -> 'insight' -> 1 ->> 'dari_model')::boolean, r::text);
    execute 'reset role';

    -- Pemberitahuan pagi.
    perform app.kirim_sarapan();
    perform pg_temp.cek('pemberitahuan: A tertandai terkirim, demo tidak', not exists (select 1 from public.insight_pagi where perusahaan_id = pa and dikirim_at is null)
      and not exists (select 1 from public.insight_pagi i join public.perusahaan p on p.id = i.perusahaan_id where p.pengaturan ? 'demo' and i.dikirim_at is not null));
    perform pg_temp.cek('pemberitahuan: A diantrekan ke Edge Function push dengan aksi sarapan', exists (
      select 1 from net.http_request_queue q where convert_from(q.body, 'utf8')::jsonb ->> 'aksi' = 'sarapan'
         and convert_from(q.body, 'utf8')::jsonb ->> 'perusahaan_id' = pa::text));
    perform pg_temp.cek('pemberitahuan: tidak ada untuk B', not exists (
      select 1 from net.http_request_queue q where convert_from(q.body, 'utf8')::jsonb ->> 'perusahaan_id' = pb::text));

    -- Demo publik.
    execute 'set local role anon';
    r := public.demo_lihat('fnb') -> 'sarapan';
    perform pg_temp.cek('demo fnb: 1 sampai 3 insight, semua >= Rp250.000', jsonb_array_length(r -> 'insight') between 1 and 3
      and (select bool_and((i ->> 'dampak_rp')::bigint >= 250000) from jsonb_array_elements(r -> 'insight') i), r::text);
    r := public.demo_lihat('toko') -> 'sarapan';
    perform pg_temp.cek('demo toko: ada insight belanja naik', exists (select 1 from jsonb_array_elements(r -> 'insight') i where i ->> 'kode' = 'belanja_naik'), r::text);
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
