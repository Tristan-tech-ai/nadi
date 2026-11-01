-- Tes F6-03: alur nyata dari log kejadian. Kasus sintetis dengan jalur yang diketahui menghasilkan jumlah kasus, selesai,
-- sesuai kertas, sisi + median hari, varian, dan penyimpangan yang persis; kasus yang langkah awalnya di luar jendela tidak
-- dihitung; usaha lain tidak bocor; trigger mencatat terbit/pengingat/lunas/batal invoice dan masuk/tahap lamaran; data lama
-- terisi ulang; hanya pemilik/admin (staf dan anon ditolak); demo publik membawa alur 20 invoice dan 15 lamaran.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; o_s uuid; u_s uuid; r jsonb; x jsonb;
  t timestamptz := now() - interval '1 hour';
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid(); k3 uuid := gen_random_uuid(); k4 uuid := gen_random_uuid();
  k5 uuid := gen_random_uuid(); k6 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid(); r3 uuid := gen_random_uuid(); r4 uuid := gen_random_uuid(); r5 uuid := gen_random_uuid();
  i1 uuid; i2 uuid; lw uuid; la uuid; v_hari date;
  v_baris jsonb := '[{"uraian": "Nasi kotak", "jumlah": 10, "harga": 25000}]';
begin
  begin
    perform pg_temp.cek('isi ulang: setiap invoice 90 hari terakhir punya kejadian terbit', not exists (
      select 1 from public.invoice i where i.dibuat_at > now() - interval '90 days'
         and not exists (select 1 from public.kejadian k where k.perusahaan_id = i.perusahaan_id and k.jenis = 'invoice.terbit' and k.data ->> 'kasus' = i.id::text)));
    perform pg_temp.cek('isi ulang: setiap lamaran 90 hari terakhir punya kejadian masuk', not exists (
      select 1 from public.lamaran l where l.dibuat_at > now() - interval '90 days'
         and not exists (select 1 from public.kejadian k where k.perusahaan_id = l.perusahaan_id and k.jenis = 'rekrut.masuk' and k.data ->> 'kasus' = l.id::text)));

    insert into auth.users (id, email) values (ua, 'alur-a@uji.local'), (ub, 'alur-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Alur', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Alur B', 'toko');
    execute 'reset role';
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

    -- Invoice sintetis: K1 lunas 5 hari, K2 pengingat lalu lunas 13 hari, K3 lunas 30 hari tanpa pengingat (terlambat),
    -- K4 pengingat lalu batal, K5 terbit di luar jendela 90 hari, K6 masih terbuka 3 hari.
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data) values
      (pa, t - interval '30 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k1, 'tempo_hari', 14)),
      (pa, t - interval '25 days', 'invoice.lunas', 'nadi', jsonb_build_object('kasus', k1)),
      (pa, t - interval '30 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k2, 'tempo_hari', 14)),
      (pa, t - interval '19 days', 'invoice.pengingat', 'nadi', jsonb_build_object('kasus', k2, 'tahap', 1)),
      (pa, t - interval '17 days', 'invoice.lunas', 'nadi', jsonb_build_object('kasus', k2)),
      (pa, t - interval '40 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k3, 'tempo_hari', 14)),
      (pa, t - interval '10 days', 'invoice.lunas', 'nadi', jsonb_build_object('kasus', k3)),
      (pa, t - interval '20 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k4, 'tempo_hari', 14)),
      (pa, t - interval '9 days', 'invoice.pengingat', 'nadi', jsonb_build_object('kasus', k4, 'tahap', 1)),
      (pa, t - interval '5 days', 'invoice.batal', 'nadi', jsonb_build_object('kasus', k4)),
      (pa, t - interval '100 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k5, 'tempo_hari', 14)),
      (pa, t - interval '5 days', 'invoice.lunas', 'nadi', jsonb_build_object('kasus', k5)),
      (pa, t - interval '3 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', k6, 'tempo_hari', 14)),
      (pb, t - interval '3 days', 'invoice.terbit', 'nadi', jsonb_build_object('kasus', gen_random_uuid(), 'tempo_hari', 14));
    -- Lamaran sintetis: R1 alur kertas penuh, R2 langsung ditolak, R3 langsung diterima, R4 menggantung sejak 18 hari, R5 baru.
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data) values
      (pa, t - interval '30 days', 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', r1)),
      (pa, t - interval '28 days', 'rekrut.ditinjau', 'nadi', jsonb_build_object('kasus', r1)),
      (pa, t - interval '25 days', 'rekrut.ditawari', 'nadi', jsonb_build_object('kasus', r1)),
      (pa, t - interval '23 days', 'rekrut.diterima', 'nadi', jsonb_build_object('kasus', r1)),
      (pa, t - interval '20 days', 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', r2)),
      (pa, t - interval '19 days', 'rekrut.ditolak', 'nadi', jsonb_build_object('kasus', r2)),
      (pa, t - interval '15 days', 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', r3)),
      (pa, t - interval '14 days', 'rekrut.diterima', 'nadi', jsonb_build_object('kasus', r3)),
      (pa, t - interval '20 days', 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', r4)),
      (pa, t - interval '18 days', 'rekrut.ditinjau', 'nadi', jsonb_build_object('kasus', r4)),
      (pa, t - interval '2 days', 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', r5));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.alur_proses('invoice', 90);
    perform pg_temp.cek('invoice: 5 kasus (K5 di luar jendela), 4 selesai, 2 sesuai kertas', (r ->> 'kasus')::int = 5
      and (r ->> 'selesai')::int = 4 and (r ->> 'sesuai')::int = 2, r::text);
    perform pg_temp.cek('invoice: sisi terbit->lunas 2 kasus, median 17,5 hari', exists (select 1 from jsonb_array_elements(r -> 'sisi') s
      where s ->> 'dari' = 'terbit' and s ->> 'ke' = 'lunas' and (s ->> 'jumlah')::int = 2 and (s ->> 'median_hari')::numeric = 17.5), r -> 'sisi' #>> '{}');
    perform pg_temp.cek('invoice: varian teratas terbit->lunas (2)', r -> 'varian' -> 0 -> 'jalur' = '["terbit", "lunas"]'::jsonb
      and (r -> 'varian' -> 0 ->> 'jumlah')::int = 2, r -> 'varian' #>> '{}');
    perform pg_temp.cek('invoice: langkah terbit 5 kasus, pengingat_1 2 kasus', exists (select 1 from jsonb_array_elements(r -> 'langkah') s
      where s ->> 'langkah' = 'terbit' and (s ->> 'kasus')::int = 5) and exists (select 1 from jsonb_array_elements(r -> 'langkah') s
      where s ->> 'langkah' = 'pengingat_1' and (s ->> 'kasus')::int = 2), r -> 'langkah' #>> '{}');
    perform pg_temp.cek('invoice: penyimpangan lunas terlambat 1/3, terlambat tanpa pengingat 1/1, batal setelah pengingat 1/1',
      (select bool_and(case p ->> 'kode' when 'lunas_terlambat' then p ->> 'jumlah' = '1' and p ->> 'dari' = '3'
                                          when 'terlambat_tanpa_pengingat' then p ->> 'jumlah' = '1' and p ->> 'dari' = '1'
                                          when 'batal_setelah_pengingat' then p ->> 'jumlah' = '1' and p ->> 'dari' = '1' end)
         from jsonb_array_elements(r -> 'penyimpangan') p) and jsonb_array_length(r -> 'penyimpangan') = 3, r -> 'penyimpangan' #>> '{}');
    perform pg_temp.cek('invoice: median siklus selesai (5, 13, 15, 30 hari) = 14', (r ->> 'siklus_hari')::numeric = 14, r ->> 'siklus_hari');

    r := public.alur_proses('rekrut', 90);
    perform pg_temp.cek('rekrut: 5 kasus, 3 selesai, 1 sesuai kertas', (r ->> 'kasus')::int = 5 and (r ->> 'selesai')::int = 3
      and (r ->> 'sesuai')::int = 1, r::text);
    perform pg_temp.cek('rekrut: penyimpangan diterima tanpa tinjau 1/2, ditolak tanpa tinjau 1/1, menggantung 1/2',
      (select bool_and(case p ->> 'kode' when 'diterima_tanpa_tinjau' then p ->> 'jumlah' = '1' and p ->> 'dari' = '2'
                                          when 'ditolak_tanpa_tinjau' then p ->> 'jumlah' = '1' and p ->> 'dari' = '1'
                                          when 'menggantung' then p ->> 'jumlah' = '1' and p ->> 'dari' = '2' end)
         from jsonb_array_elements(r -> 'penyimpangan') p), r -> 'penyimpangan' #>> '{}');
    perform pg_temp.cek('rekrut: sisi masuk->ditinjau 2 kasus median 2 hari', exists (select 1 from jsonb_array_elements(r -> 'sisi') s
      where s ->> 'dari' = 'masuk' and s ->> 'ke' = 'ditinjau' and (s ->> 'jumlah')::int = 2 and (s ->> 'median_hari')::numeric = 2), r -> 'sisi' #>> '{}');
    perform pg_temp.cek('jendela 7 hari: hanya K6 dan R5', (public.alur_proses('invoice', 7) ->> 'kasus')::int = 1
      and (public.alur_proses('rekrut', 7) ->> 'kasus')::int = 1);

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha B hanya melihat kasusnya sendiri (1)', (public.alur_proses('invoice', 90) ->> 'kasus')::int = 1
      and (public.alur_proses('rekrut', 90) ->> 'kasus')::int = 0);

    -- Trigger dari alur sungguhan.
    perform set_config('request.jwt.claims', ka, true);
    perform public.atur_bayar(null, null, null, 'BCA 1234567890 a.n. Warung Uji Alur');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    execute 'set local role authenticated';
    i1 := (public.buat_invoice('Bu Rina', null, v_baris, v_hari + 14, null, gen_random_uuid()) ->> 'id')::uuid;
    i2 := (public.buat_invoice('Pak Danu', null, v_baris, v_hari + 7, null, gen_random_uuid()) ->> 'id')::uuid;
    perform public.catat_pengingat((select id from public.pengingat_invoice where invoice_id = i1 and tahap = 1));
    perform public.tandai_lunas(i1, 'transfer', v_hari);
    perform public.batal_invoice(i2, 'Pesanan dibatalkan pelanggan');
    execute 'reset role';
    perform pg_temp.cek('trigger invoice: terbit (tempo 14), pengingat tahap 1, lunas berurutan',
      (select array_agg(case when jenis = 'invoice.pengingat' then jenis || (data ->> 'tahap') else jenis end order by terjadi_at, id)
         from public.kejadian where perusahaan_id = pa and data ->> 'kasus' = i1::text) = array['invoice.terbit', 'invoice.pengingat1', 'invoice.lunas']
      and (select (data ->> 'tempo_hari')::int from public.kejadian where perusahaan_id = pa and jenis = 'invoice.terbit' and data ->> 'kasus' = i1::text) = 14);
    perform pg_temp.cek('trigger invoice: batal tercatat', exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'invoice.batal' and data ->> 'kasus' = i2::text));
    insert into public.lowongan (perusahaan_id, judul) values (pa, 'Pelayan uji alur') returning id into lw;
    insert into public.lamaran (perusahaan_id, lowongan_id, nama, telepon) values (pa, lw, 'Pelamar Alur', '6281200000000') returning id into la;
    execute 'set local role authenticated';
    perform public.ubah_tahap_lamaran(la, 'ditinjau', null);
    perform public.ubah_tahap_lamaran(la, 'ditinjau', 'pesan saja');
    perform public.ubah_tahap_lamaran(la, 'ditolak', null);
    execute 'reset role';
    perform pg_temp.cek('trigger lamaran: masuk, ditinjau, ditolak (ganti pesan saja tidak dicatat)',
      (select array_agg(jenis order by terjadi_at, id) from public.kejadian where perusahaan_id = pa and data ->> 'kasus' = la::text)
        = array['rekrut.masuk', 'rekrut.ditinjau', 'rekrut.ditolak']);
    execute 'set local role authenticated';
    perform pg_temp.cek('alur invoice ikut bertambah 2 kasus dari trigger', (public.alur_proses('invoice', 90) ->> 'kasus')::int = 7);

    -- Hak.
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Alur') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
    begin perform public.alur_proses('invoice', 90); perform pg_temp.cek('staf ditolak', false);
    exception when others then perform pg_temp.cek('staf ditolak', sqlstate = '42501', sqlerrm); end;
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.alur_proses('gaji', 90); perform pg_temp.cek('jenis tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('jenis tak dikenal ditolak', sqlstate = '22023', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.alur_proses('invoice', 90); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;

    -- Demo publik.
    r := public.demo_lihat('fnb');
    x := r -> 'alur';
    perform pg_temp.cek('demo fnb: alur 20 invoice dan 15 lamaran dari log demo', (x -> 'invoice' ->> 'kasus')::int = 20
      and (x -> 'rekrut' ->> 'kasus')::int = 15, x::text);
    perform pg_temp.cek('demo fnb: ada penyimpangan nyata (lunas terlambat, menggantung, diterima tanpa tinjau)',
      (select bool_and((p ->> 'jumlah')::int > 0) from jsonb_array_elements(x -> 'invoice' -> 'penyimpangan') p where p ->> 'kode' = 'lunas_terlambat')
      and (select bool_and((p ->> 'jumlah')::int > 0) from jsonb_array_elements(x -> 'rekrut' -> 'penyimpangan') p where p ->> 'kode' in ('menggantung', 'diterima_tanpa_tinjau')), x::text);
    perform pg_temp.cek('demo toko juga punya alur', ((public.demo_lihat('toko') -> 'alur' -> 'invoice' ->> 'kasus')::int) = 20);
    execute 'reset role';
    perform pg_temp.cek('isi_alur_demo idempoten', app.isi_alur_demo() = 0);
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
