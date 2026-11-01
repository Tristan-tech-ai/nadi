-- Tes F3-06 x F3-02: jam beban dari jadwal shift (app.jam_jadwal). Selama usaha belum punya shift aktif minggu itu, semua orang
-- dianggap 40 jam (jam_sama_rata). Begitu ada shift, jam tiap orang = menit kerja shiftnya / 60 (istirahat tidak dihitung, shift
-- batal tidak dihitung, minggu lain tidak dihitung); orang tanpa shift minggu itu berjam 0, beban per jamnya null (bukan pembagian
-- nol) dan tidak diusulkan sebagai pelaksana.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; v_zona text; v_senin date; v_mulai timestamptz;
  o_sari uuid; o_budi uuid; o_tono uuid; t_kasir uuid; r jsonb; e jsonb; i int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Beban Jadwal', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Jadwal') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Jadwal') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Jadwal') returning id into o_tono;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_jadwal_uji', 'Kasir Jadwal') returning id into t_kasir;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_kasir), (pa, o_budi, t_kasir), (pa, o_tono, t_kasir);

    execute 'reset role';
    select p.zona_waktu into v_zona from public.perusahaan p where p.id = pa;
    v_senin := app.awal_minggu(pa, null);
    v_mulai := v_senin::timestamp at time zone v_zona;
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, mulai_at, selesai_at, dibuat_at) values
      (pa, 'Tutup kas', t_kasir, o_sari, 'selesai', 6, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai + interval '2 minutes'),
      (pa, 'Buka kas', t_kasir, o_budi, 'selesai', 6, v_mulai + interval '1 hour', v_mulai + interval '2 hours', v_mulai + interval '1 minute');

    -- Sebelum ada jadwal: sama rata 40 jam; Tono (0 poin) diusulkan.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.beban_minggu();
    perform pg_temp.cek('tanpa shift: jam_sama_rata, semua 40 jam', (r ->> 'jam_sama_rata')::boolean
      and (select bool_and((x ->> 'jam')::numeric = 40) from jsonb_array_elements(r -> 'orang') x), r::text);
    perform pg_temp.cek('tanpa shift: usulan kasir = Tono (0 poin)', (public.usulan_pelaksana(t_kasir, 1) ->> 'orang_id')::uuid = o_tono);

    -- Jadwal minggu ini: Sari 3 x 07.00-15.00 tanpa istirahat (24 jam), Budi 5 x 07.00-16.00 istirahat 60 (40 jam), Tono tanpa shift.
    -- Ditambah shift Sari yang dibatalkan dan shift Sari minggu depan: keduanya tidak dihitung.
    execute 'reset role';
    for i in 0..2 loop
      insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
      values (pa, o_sari, v_senin + i, '07:00', '15:00', 0, (v_senin + i + time '07:00') at time zone v_zona, (v_senin + i + time '15:00') at time zone v_zona, gen_random_uuid());
    end loop;
    for i in 0..4 loop
      insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
      values (pa, o_budi, v_senin + i, '07:00', '16:00', 60, (v_senin + i + time '07:00') at time zone v_zona, (v_senin + i + time '16:00') at time zone v_zona, gen_random_uuid());
    end loop;
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien, status)
    values (pa, o_sari, v_senin + 3, '07:00', '15:00', 0, (v_senin + 3 + time '07:00') at time zone v_zona, (v_senin + 3 + time '15:00') at time zone v_zona, gen_random_uuid(), 'batal');
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
    values (pa, o_sari, v_senin + 7, '07:00', '15:00', 0, (v_senin + 7 + time '07:00') at time zone v_zona, (v_senin + 7 + time '15:00') at time zone v_zona, gen_random_uuid());

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.beban_minggu();
    perform pg_temp.cek('dengan shift: jam_sama_rata false', not (r ->> 'jam_sama_rata')::boolean, r::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Sari Jadwal';
    perform pg_temp.cek('Sari 24 jam (batal dan minggu depan tidak dihitung), 6 poin = 0,25 per jam',
      (e ->> 'jam')::numeric = 24 and (e ->> 'beban_per_jam')::numeric = 0.25, e::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Budi Jadwal';
    perform pg_temp.cek('Budi 40 jam (istirahat tidak dihitung), 0,15 per jam', (e ->> 'jam')::numeric = 40 and (e ->> 'beban_per_jam')::numeric = 0.15, e::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Tono Jadwal';
    perform pg_temp.cek('Tono tanpa shift: 0 jam, beban per jam null (bukan galat bagi nol)', (e ->> 'jam')::numeric = 0 and e -> 'beban_per_jam' = 'null'::jsonb, e::text);
    perform pg_temp.cek('urut: Sari (0,25) lalu Budi (0,15), Tono terakhir',
      r -> 'orang' -> 0 ->> 'nama' = 'Sari Jadwal' and r -> 'orang' -> 1 ->> 'nama' = 'Budi Jadwal' and r -> 'orang' -> 2 ->> 'nama' = 'Tono Jadwal', (r -> 'orang')::text);
    r := public.usulan_pelaksana(t_kasir, 1);
    perform pg_temp.cek('usulan memakai jam jadwal: Budi (7/40) bukan Sari (7/24); Tono tanpa shift tidak diusulkan',
      (r ->> 'orang_id')::uuid = o_budi and (r ->> 'kandidat')::int = 2 and (r ->> 'jam')::numeric = 40, r::text);
    perform pg_temp.cek('minggu depan: hanya Sari yang berjadwal (8 jam)', (select (x ->> 'jam')::numeric from jsonb_array_elements(public.beban_minggu(v_senin + 7) -> 'orang') x where x ->> 'nama' = 'Sari Jadwal') = 8);
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
