-- Tes W-06 paket terbuka: paket baru terpasang; usul_topi_baru menyimpan cerita, membuat satu usulan onboarding.topi untuk
-- pemilik, melewati topi yang sudah ada, idempoten; bentuk topi diperiksa; disetujui = topi terpasang (asal_paket null),
-- ditolak = tidak; staf dan usaha lain ditolak.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; o_s uuid; u_s uuid; n int; v uuid; v2 uuid;
  topi jsonb := '[{"kode": "pembuat_kue", "nama": "Pembuat kue", "tanggung_jawab": ["Memanggang sesuai pesanan"]},
                  {"kode": "admin_online", "nama": "Admin pesanan online", "tanggung_jawab": ["Membalas chat pembeli"]},
                  {"kode": "pengemas", "nama": "Pengemas", "tanggung_jawab": []}]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'paket-a@uji.local'), (ub, 'paket-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Kue Uji Paket', 'produksi');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Usaha Uji Paket B', 'pendidikan');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

    perform set_config('request.jwt.claims', ka, true);
    n := public.pasang_paket('produksi');
    perform pg_temp.cek('paket produksi memasang 4 topi', n = 4, n::text);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('paket pendidikan memasang 2 topi', public.pasang_paket('pendidikan') = 2);
    perform pg_temp.cek('paket pertanian ada', (select count(*) from public.paket_industri where kode in ('produksi', 'pertanian', 'pendidikan')) = 3);

    perform set_config('request.jwt.claims', ka, true);
    v := public.usul_topi_baru('Jualan kue kering online lewat Instagram, dibantu dua orang', 'produksi', 0.85, topi);
    perform pg_temp.cek('usulan topi dibuat', v is not null);
    execute 'reset role';
    perform pg_temp.cek('usulan untuk pemilik, topi yang sudah ada (pengemas) dilewati', (select untuk_peran = array['pemilik'] and aksi = 'onboarding.topi' and status = 'menunggu'
      and jsonb_array_length(payload -> 'bidang' -> 'topi') = 2 and judul = 'Tambah topi: Pembuat kue, Admin pesanan online' from public.usulan where id = v));
    perform pg_temp.cek('cerita disimpan di pengaturan', (select pengaturan -> 'cerita_usaha' ->> 'paket' = 'produksi' from public.perusahaan where id = pa));
    execute 'set local role authenticated';
    v2 := public.usul_topi_baru('Jualan kue kering online lewat Instagram, dibantu dua orang', 'produksi', 0.85, topi);
    perform pg_temp.cek('usulan sama tidak digandakan', v2 is null and (select count(*) from public.usulan where aksi = 'onboarding.topi') = 1);
    begin perform public.usul_topi_baru('Cerita cukup panjang di sini', 'produksi', 0.5, '[{"kode": "Bukan Kode!", "nama": "X"}]');
      perform pg_temp.cek('kode topi tidak sah ditolak', false);
    exception when others then perform pg_temp.cek('kode topi tidak sah ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.usul_topi_baru('pendek', 'produksi', 0.5, '[]');
      perform pg_temp.cek('cerita terlalu pendek ditolak', false);
    exception when others then perform pg_temp.cek('cerita terlalu pendek ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.usul_topi_baru('Cerita cukup panjang di sini', 'produksi', 1.5, '[]');
      perform pg_temp.cek('keyakinan di luar 0..1 ditolak', false);
    exception when others then perform pg_temp.cek('keyakinan di luar 0..1 ditolak', sqlstate = '22023', sqlerrm); end;

    -- Disetujui: topi terpasang.
    perform public.putuskan_usulan(v, true);
    perform pg_temp.cek('disetujui: 2 topi baru buatan usaha', (select count(*) from public.topi where kode in ('pembuat_kue', 'admin_online') and asal_paket is null) = 2
      and (select count(*) from public.topi) = 6);

    -- Ditolak: tidak terpasang.
    v := public.usul_topi_baru('Kami juga mengantar pesanan sendiri ke pembeli', 'produksi', 0.6, '[{"kode": "kurir", "nama": "Kurir", "tanggung_jawab": ["Mengantar pesanan"]}]');
    perform public.putuskan_usulan(v, false);
    perform pg_temp.cek('ditolak: topi tidak terpasang', not exists (select 1 from public.topi where kode = 'kurir'));

    -- Isolasi dan peran.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha B tidak melihat topi dan usulan A', not exists (select 1 from public.topi where kode = 'pembuat_kue')
      and not exists (select 1 from public.usulan where aksi = 'onboarding.topi'));
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Paket') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
    begin perform public.usul_topi_baru('Staf mencoba menambah topi sendiri', 'produksi', 0.5, topi);
      perform pg_temp.cek('staf ditolak', false);
    exception when others then perform pg_temp.cek('staf ditolak', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.usul_topi_baru('Anon mencoba menambah topi', 'produksi', 0.5, topi);
      perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
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
