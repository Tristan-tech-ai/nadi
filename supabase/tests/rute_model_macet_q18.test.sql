-- Tes Q-18: baris app.rute_model yang macet di status 'proses' lebih dari 10 menit (Edge Function putuskan mati di tengah jalan)
-- ditandai gagal oleh app.rute_model_kedaluwarsa(); baris yang masih baru tetap 'proses'; rute usulan tidak berubah; cron terdaftar.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;

do $$
declare ua uuid := gen_random_uuid(); pa uuid; u1 uuid; u2 uuid; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    execute 'reset role';
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'aturan', 'catatan', 'Uji Q-18 lama', '{}') returning id into u1;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'aturan', 'catatan', 'Uji Q-18 baru', '{}') returning id into u2;
    -- Trigger antre mungkin sudah menyisipkan baris; tulis ulang keadaan uji secara eksplisit.
    insert into app.rute_model (usulan_id, perusahaan_id, status, dikirim, mulai_at) values (u1, pa, 'proses', true, clock_timestamp() - interval '11 minutes')
      on conflict (usulan_id) do update set status = 'proses', mulai_at = excluded.mulai_at, galat = null, selesai_at = null;
    insert into app.rute_model (usulan_id, perusahaan_id, status, dikirim, mulai_at) values (u2, pa, 'proses', true, clock_timestamp() - interval '5 minutes')
      on conflict (usulan_id) do update set status = 'proses', mulai_at = excluded.mulai_at, galat = null, selesai_at = null;

    n := app.rute_model_kedaluwarsa();
    perform pg_temp.cek('mengembalikan jumlah baris yang ditandai', n >= 1, n::text);
    perform pg_temp.cek('baris 11 menit menjadi gagal', (select status = 'gagal' and galat like 'Edge Function tidak menjawab%' and selesai_at is not null from app.rute_model where usulan_id = u1));
    perform pg_temp.cek('baris 5 menit tetap proses', (select status = 'proses' from app.rute_model where usulan_id = u2));
    perform pg_temp.cek('rute usulan tidak berubah', (select untuk_peran = array['pemilik', 'admin'] from public.usulan where id = u1));
    n := app.rute_model_kedaluwarsa();
    perform pg_temp.cek('panggilan kedua tidak menyentuh baris yang sudah gagal', (select count(*) = 1 from app.rute_model where usulan_id = u1 and status = 'gagal'));
    perform pg_temp.cek('cron nadi-rute-macet terdaftar tiap 5 menit', exists (select 1 from cron.job where jobname = 'nadi-rute-macet' and schedule = '*/5 * * * *'));
    perform pg_temp.cek('authenticated tidak bisa memanggil', not has_function_privilege('authenticated', 'app.rute_model_kedaluwarsa()', 'execute'));
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
