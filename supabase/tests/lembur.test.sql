-- Tes lembur (F1-05B): hanya pemilik/admin mencatat, batas jam per hari dan per jenis (PP 35/2021 Pasal 26, 31),
-- 18 jam seminggu untuk hari kerja, catat ulang tanggal yang sama memperbarui, jam 0 = batal tanpa hapus,
-- bulan yang gajinya disetujui terkunci, staf hanya melihat lemburnya sendiri, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid; pa uuid; pb uuid; ka text; kb text; ks text;
  o1 uuid; o2 uuid; ob uuid; l1 uuid; per uuid; n int; j int;
  senin date := date '2026-11-02';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', kb, true);
  insert into public.orang (perusahaan_id, nama) values (pb, 'Orang B') returning id into ob;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o2;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  l1 := public.catat_lembur(o1, senin, 'hari_kerja', 4, 'stok opname');
  perform pg_temp.cek('pemilik mencatat 4 jam hari kerja', (select jam = 4 and catatan = 'stok opname' from public.lembur where id = l1));
  -- Dua pernyataan: subquery di pernyataan yang sama memakai snapshot sebelum fungsi memperbarui baris.
  perform pg_temp.cek('catat ulang tanggal sama memakai baris yang sama', public.catat_lembur(o1, senin, 'hari_kerja', 3) = l1);
  perform pg_temp.cek('catat ulang memperbarui jam', (select jam from public.lembur where id = l1) = 3);
  begin
    perform public.catat_lembur(o1, senin + 1, 'hari_kerja', 5);
    perform pg_temp.cek('hari kerja lebih dari 4 jam ditolak', false);
  exception when others then perform pg_temp.cek('hari kerja lebih dari 4 jam ditolak', sqlerrm like '%paling lama 4 jam%', sqlerrm);
  end;
  -- Q-22: jenis libur mengikuti pola usaha (bawaan 6 hari); batas 12 jam pola 5 diuji setelah pemilik memilih pola 5.
  perform public.atur_pola_kerja('5_hari');
  perform pg_temp.cek('libur pola 5 hari boleh 12 jam', public.catat_lembur(o2, senin + 5, 'libur_pola_5_hari', 12) is not null);
  perform public.atur_pola_kerja('6_hari');
  begin
    perform public.catat_lembur(o2, senin + 6, 'libur_pola_6_hari', 12);
    perform pg_temp.cek('libur pola 6 hari lebih dari 11 jam ditolak', false);
  exception when others then perform pg_temp.cek('libur pola 6 hari lebih dari 11 jam ditolak', sqlerrm like '%paling lama 11 jam%', sqlerrm);
  end;
  begin
    perform public.catat_lembur(o1, senin + 1, 'lembur_suka_suka', 2);
    perform pg_temp.cek('jenis tak dikenal ditolak', false);
  exception when others then perform pg_temp.cek('jenis tak dikenal ditolak', sqlerrm like '%tidak dikenal%', sqlerrm);
  end;

  -- 18 jam seminggu (hari kerja): 3 + 4 + 4 + 4 = 15, lalu 4 lagi = 19 ditolak; Sabtu libur tidak dihitung.
  perform public.catat_lembur(o1, senin + 1, 'hari_kerja', 4);
  perform public.catat_lembur(o1, senin + 2, 'hari_kerja', 4);
  perform public.catat_lembur(o1, senin + 3, 'hari_kerja', 4);
  perform public.catat_lembur(o1, senin + 5, 'libur_pola_6_hari', 7);
  begin
    perform public.catat_lembur(o1, senin + 4, 'hari_kerja', 4);
    perform pg_temp.cek('lebih dari 18 jam seminggu ditolak', false);
  exception when others then perform pg_temp.cek('lebih dari 18 jam seminggu ditolak', sqlerrm like '%jadi 19 jam%', sqlerrm);
  end;
  perform pg_temp.cek('pas 18 jam seminggu boleh', public.catat_lembur(o1, senin + 4, 'hari_kerja', 3) is not null);
  perform pg_temp.cek('minggu berikutnya dihitung dari nol', public.catat_lembur(o1, senin + 7, 'hari_kerja', 4) is not null);
  perform public.catat_lembur(o1, senin + 7, 'hari_kerja', 0);
  perform pg_temp.cek('jam 0 membatalkan tanpa menghapus', (select jam = 0 from public.lembur where orang_id = o1 and tanggal = senin + 7));

  begin
    perform public.catat_lembur(ob, senin, 'hari_kerja', 1);
    perform pg_temp.cek('orang usaha lain ditolak', false);
  exception when others then perform pg_temp.cek('orang usaha lain ditolak', sqlstate = '42501', sqlerrm);
  end;

  -- Staf: melihat lemburnya sendiri saja, tidak bisa mencatat.
  perform set_config('request.jwt.claims', ks, true);
  select count(*), count(*) filter (where orang_id = o1) into n, j from public.lembur;
  perform pg_temp.cek('staf hanya melihat lemburnya sendiri', n > 0 and n = j, n || '/' || j);
  begin
    perform public.catat_lembur(o1, senin + 8, 'hari_kerja', 2);
    perform pg_temp.cek('staf tidak bisa mencatat lembur', false);
  exception when others then perform pg_temp.cek('staf tidak bisa mencatat lembur', sqlstate = '42501', sqlerrm);
  end;
  begin
    insert into public.lembur (perusahaan_id, orang_id, tanggal, jenis, jam) values (pa, o1, senin + 9, 'hari_kerja', 4);
    perform pg_temp.cek('tulis langsung ke tabel ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('tulis langsung ke tabel ditolak', true);
  end;

  -- Usaha lain tidak melihat apa pun.
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.lembur where perusahaan_id = pa;
  perform pg_temp.cek('usaha lain tidak melihat lembur', n = 0, n::text);

  -- Gaji November disetujui: lembur November terkunci, Desember tetap bisa.
  perform set_config('request.jwt.claims', ka, true);
  per := public.mulai_periode_gaji(date '2026-11-01');
  perform public.setujui_periode_gaji(per);
  begin
    perform public.catat_lembur(o2, date '2026-11-20', 'hari_kerja', 2);
    perform pg_temp.cek('bulan yang gajinya disetujui terkunci', false);
  exception when others then perform pg_temp.cek('bulan yang gajinya disetujui terkunci', sqlstate = '55000', sqlerrm);
  end;
  perform pg_temp.cek('bulan berikutnya tetap bisa', public.catat_lembur(o2, date '2026-12-01', 'hari_kerja', 2) is not null);

  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    select count(*) into n from public.lembur;
    perform pg_temp.cek('anon tidak bisa membaca lembur', false, n::text);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca lembur', true);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
