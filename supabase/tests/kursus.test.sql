-- Tes M-13B kursus (supabase/migrations/20261105090000_kursus.sql): kursus dari langkah Rekam ilmu, kuis dinilai server (kolom kunci
-- tidak bisa dibaca klien), lulus >= ambang memberi satu sertifikat bernomor SERT, maksimal 5 percobaan sehari, progres per orang hanya
-- untuk diri, atasan langsung, dan pemilik/admin, verifikasi sertifikat publik, isolasi tenant. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  o_budi uuid; o_sari uuid; o_fani uuid; o_lama uuid; k_budi text; k_sari text; k_fani text;
  bh uuid; butir uuid; c uuid; c2 uuid; q1 uuid; q2 uuid; q3 uuid; q4 uuid; r jsonb; r2 jsonb; v_hari date; n int; kode text;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ks.a@uji.local'), (ub, 'ks.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Kursus', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Kursus', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Fani') returning id into o_fani;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Pak Lama') returning id into o_lama;
    perform public.buat_akun_staf(o_budi, '520001'); perform public.buat_akun_staf(o_sari, '520002'); perform public.buat_akun_staf(o_fani, '520003');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    insert into public.profil_kerja (orang_id, perusahaan_id, atasan_id) values (o_budi, pa, o_sari);
    -- Rekam ilmu dari orang yang berhenti: langkah kerja tersimpan pada butir ilmu.
    insert into public.berhenti (perusahaan_id, orang_id, tanggal_surat, tanggal_efektif, alasan, kunci_klien)
    values (pa, o_lama, v_hari, v_hari + 30, 'mundur', gen_random_uuid()) returning id into bh;
    insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, judul, langkah, langkah_sumber)
    values (pa, bh, 'ilmu', 'Cara tutup kasir', '["Hitung uang laci per pecahan", "Cocokkan dengan rekap kasir", "Catat selisih di buku"]', 'pemilik') returning id into butir;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_budi from public.orang where id = o_budi;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_sari from public.orang where id = o_sari;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_fani from public.orang where id = o_fani;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', k_sari, true);
    begin perform public.save_course('{"judul": "Kursus palsu"}'); perform pg_temp.cek('staf tidak membuat kursus', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat kursus', true); end;

    perform set_config('request.jwt.claims', ka, true);
    c := public.save_course(jsonb_build_object('butir', butir, 'ringkasan', 'Wajib untuk kasir baru', 'ambang', 75));
    perform pg_temp.cek('kursus dari Rekam ilmu: judul dan materi = langkah butir', (select judul from public.course where id = c) = 'Cara tutup kasir'
      and (select jsonb_array_length(materi) from public.course where id = c) = 3 and (select sumber_butir_id from public.course where id = c) = butir);
    begin perform public.save_course('{"judul": "Materi rusak", "materi": [1, 2]}'); perform pg_temp.cek('materi bukan teks ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('materi bukan teks ditolak', true); end;
    perform set_config('request.jwt.claims', k_budi, true);
    begin perform public.submit_quiz(c, '{}'); perform pg_temp.cek('kursus tanpa soal tidak bisa dikerjakan', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kursus tanpa soal tidak bisa dikerjakan', true); end;
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.save_course_question(c, 'Apa yang dihitung dulu?', array['Uang laci', ' '], 1); perform pg_temp.cek('kunci menunjuk pilihan kosong ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kunci menunjuk pilihan kosong ditolak', true); end;
    q1 := public.save_course_question(c, 'Apa yang dihitung dulu?', array['Uang laci per pecahan', 'Stok gudang', 'Jam kerja'], 0);
    q2 := public.save_course_question(c, 'Dicocokkan dengan apa?', array['Rekap kasir', 'Daftar gaji'], 0);
    q3 := public.save_course_question(c, 'Selisih dicatat di mana?', array['Tidak dicatat', 'Buku selisih'], 1);
    q4 := public.save_course_question(c, 'Kapan kasir ditutup?', array['Setelah toko tutup', 'Saat buka'], 0);

    -- Kunci jawaban tidak terbaca klien.
    perform set_config('request.jwt.claims', k_budi, true);
    perform pg_temp.cek('staf membaca soal dan pilihan', (select count(*) from (select id, pertanyaan, pilihan from public.course_question where course_id = c) x) = 4);
    begin perform (select max(kunci) from public.course_question); perform pg_temp.cek('kolom kunci tidak bisa dibaca klien', false);
    exception when sqlstate '42501' then perform pg_temp.cek('kolom kunci tidak bisa dibaca klien', true); end;
    begin perform (select count(*) from public.course_question q where q.kunci = 0); perform pg_temp.cek('kunci tidak bisa ditebak lewat filter', false);
    exception when sqlstate '42501' then perform pg_temp.cek('kunci tidak bisa ditebak lewat filter', true); end;

    -- Dinilai server: 2 dari 4 benar = 50 < 75.
    r := public.submit_quiz(c, jsonb_build_object(q1, 0, q2, 1, q3, 1, q4, 1));
    perform pg_temp.cek('2/4 benar: skor 50, tidak lulus, tanpa sertifikat', (r ->> 'skor')::int = 50 and not (r ->> 'lulus')::boolean and r -> 'sertifikat' = 'null'::jsonb, r::text);
    r := public.submit_quiz(c, jsonb_build_object(q1, '0', q2, 'x', q3, 9));
    perform pg_temp.cek('jawaban tak sah dan soal kosong dihitung salah: skor 25', (r ->> 'skor')::int = 25, r::text);
    r := public.submit_quiz(c, jsonb_build_object(q1, 0, q2, 0, q3, 1, q4, 0));
    perform pg_temp.cek('4/4 benar: lulus, sertifikat bernomor SERT', (r ->> 'skor')::int = 100 and (r ->> 'lulus')::boolean and r ->> 'nomor' like '001/SERT/%'
      and length(r ->> 'sertifikat') = 12, r::text);
    kode := r ->> 'sertifikat';
    r2 := public.submit_quiz(c, jsonb_build_object(q1, 0, q2, 0, q3, 1, q4, 1));
    perform pg_temp.cek('lulus lagi tidak menerbitkan sertifikat kedua', r2 ->> 'sertifikat' = kode and (select count(*) from public.certificate) = 1, r2::text);
    perform public.submit_quiz(c, '{}');
    begin perform public.submit_quiz(c, '{}'); perform pg_temp.cek('percobaan ke-6 hari ini ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('percobaan ke-6 hari ini ditolak', true); end;
    perform pg_temp.cek('Budi melihat 5 percobaan dan sertifikatnya', (select count(*) from public.course_attempt) = 5 and (select count(*) from public.certificate) = 1);
    perform pg_temp.cek('progres Budi: hanya dirinya, terbaik 100', jsonb_array_length(public.course_progress(c)) = 1 and (public.course_progress(c) -> 0 ->> 'terbaik')::int = 100);

    -- Sertifikat publik.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    r := public.verify_certificate(lower(kode));
    perform pg_temp.cek('anon memverifikasi sertifikat lewat kode (huruf kecil juga)', r ->> 'nama' = 'Budi' and r ->> 'kursus' = 'Cara tutup kasir' and (r ->> 'skor')::int = 100, r::text);
    perform pg_temp.cek('kode salah: kosong', public.verify_certificate('000000000000') is null);
    begin perform (select count(*) from public.certificate); perform pg_temp.cek('anon tidak membaca tabel sertifikat', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak membaca tabel sertifikat', true); end;
    execute 'set local role authenticated';

    -- Progres: atasan langsung melihat bawahannya, staf lain tidak.
    perform set_config('request.jwt.claims', k_fani, true);
    perform public.submit_quiz(c, jsonb_build_object(q1, 0));
    perform pg_temp.cek('staf lain hanya melihat progresnya sendiri', jsonb_array_length(public.course_progress(c)) = 1 and public.course_progress(c) -> 0 ->> 'nama' = 'Fani'
      and (select count(*) from public.course_attempt) = 1 and (select count(*) from public.certificate) = 0);
    perform set_config('request.jwt.claims', k_sari, true);
    perform pg_temp.cek('atasan melihat progres bawahannya (Budi), bukan Fani', (select string_agg(e ->> 'nama', ',') from jsonb_array_elements(public.course_progress(c)) e) = 'Budi'
      and (select count(*) from public.certificate) = 1);
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('pemilik melihat semua progres', jsonb_array_length(public.course_progress(c)) = 2);

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat kursus, soal, percobaan, sertifikat', (select count(*) from public.course) = 0
      and (select count(*) from (select id from public.course_question) x) = 0 and (select count(*) from public.course_attempt) = 0
      and (select count(*) from public.certificate) = 0 and jsonb_array_length(public.course_progress(c)) = 0);
    begin perform public.submit_quiz(c, '{}'); perform pg_temp.cek('usaha lain tidak mengerjakan kuis', false);
    exception when sqlstate 'P0002' or sqlstate '42501' then perform pg_temp.cek('usaha lain tidak mengerjakan kuis', true); end;
    begin perform public.save_course_question(c, 'Soal asing', array['a', 'b'], 0); perform pg_temp.cek('usaha lain tidak menambah soal', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak menambah soal', true); end;
    begin perform public.save_course(jsonb_build_object('butir', butir)); perform pg_temp.cek('usaha lain tidak memakai butir ilmu asing', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai butir ilmu asing', true); end;
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
