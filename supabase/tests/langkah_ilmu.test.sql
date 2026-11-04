-- Tes langkah ilmu (F3-07C langkah 3): konteks hanya pemilik/admin dan butuh transkrip, token tercatat walau langkah ditolak
-- validasi (p_langkah null), langkah model tersimpan bersumber model, batas 3 panggilan per butir per 24 jam. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; ks text; o_sari uuid; u_sari uuid; t_esp uuid; bh uuid; ilmu uuid; r jsonb; n int;
  pakai jsonb := '{"model": "uji", "token_masuk": 120, "token_keluar": 40}';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Langkah A', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Langkah') returning id into o_sari;
  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'espresso_langkah', 'Barista Langkah') returning id into t_esp;
  insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_esp);
  perform public.buat_akun_staf(o_sari, '123456');
  select user_id into u_sari from public.orang where id = o_sari;
  ks := json_build_object('sub', u_sari, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  r := public.catat_berhenti(o_sari, current_date, current_date + 30, 'mundur', gen_random_uuid());
  execute 'reset role';
  select id into bh from public.berhenti where orang_id = o_sari;
  select id into ilmu from public.serah_butir where berhenti_id = bh and jenis = 'ilmu' limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);

  begin perform public.konteks_ilmu(ilmu); perform pg_temp.cek('tanpa transkrip ditolak', false);
  exception when sqlstate '55000' then perform pg_temp.cek('tanpa transkrip ditolak', true); end;
  perform public.simpan_ilmu(ilmu, 'Nyalakan mesin lalu tunggu lampu hijau.', null, 'pemilik');
  r := public.konteks_ilmu(ilmu);
  perform pg_temp.cek('konteks berisi transkrip', r ->> 'transkrip' like 'Nyalakan%', r::text);
  perform public.simpan_langkah_model(ilmu, null, pakai);
  perform pg_temp.cek('token tercatat walau langkah ditolak', (select count(*) = 1 from public.pemakaian_ai where perusahaan_id = pa and tugas = 'langkah_ilmu'));
  perform pg_temp.cek('langkah tetap kosong', (select langkah is null from public.serah_butir where id = ilmu));
  perform public.simpan_langkah_model(ilmu, '["Nyalakan mesin.", "Tunggu lampu hijau."]', pakai);
  perform pg_temp.cek('langkah model tersimpan', (select jsonb_array_length(langkah) = 2 and langkah_sumber = 'model' and transkrip like 'Nyalakan%' from public.serah_butir where id = ilmu));
  perform public.simpan_langkah_model(ilmu, null, pakai);
  begin perform public.konteks_ilmu(ilmu); perform pg_temp.cek('panggilan keempat dalam 24 jam ditolak', false);
  exception when sqlstate '54000' then perform pg_temp.cek('panggilan keempat dalam 24 jam ditolak', true); end;

  perform set_config('request.jwt.claims', ks, true);
  begin perform public.konteks_ilmu(ilmu); perform pg_temp.cek('staf tidak meminta konteks', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak meminta konteks', true); end;
  begin perform public.simpan_langkah_model(ilmu, '["x"]', pakai); perform pg_temp.cek('staf tidak menyimpan langkah model', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak menyimpan langkah model', true); end;
  execute 'reset role';
  perform pg_temp.cek('anon tidak bisa meminta konteks', not has_function_privilege('anon', 'public.konteks_ilmu(uuid)', 'execute'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'langkah_ilmu: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
