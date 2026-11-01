-- Tes F2-07 lingkaran belajar rekrutmen (docs/research/lingkaran-rekrut.md): pelamar diterima dicatat sebagai karyawan (lamaran
-- tertaut ke orang, tanggal mulai, topi lowongan); lingkaran_rekrut memberi sinyal seleksi dan kinerja hari ke-90 sampai ke-180
-- di zona usaha, tanpa nama; yang belum genap 90 hari hanya dihitung jumlahnya; peran lewat app.peran_aktif; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); uk uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; ks text; kk text; tp uuid; lw uuid; l1 uuid; l2 uuid; l3 uuid; o1 uuid; o2 uuid; r jsonb; b jsonb;
  v_hari date; v_zona text; n int;
begin
  begin
    perform pg_temp.cek('kolom dan fungsi ada', exists (select 1 from information_schema.columns where table_name = 'lamaran' and column_name = 'orang_id')
      and to_regprocedure('public.jadikan_karyawan(uuid,date)') is not null and to_regprocedure('public.lingkaran_rekrut()') is not null);
    perform pg_temp.cek('RPC memeriksa peran lewat peran_aktif',
      (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.jadikan_karyawan(uuid,date)'::regprocedure, 'public.lingkaran_rekrut()'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (us, 's@uji.local'), (uk, 'k@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Lingkaran', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Lingkaran B', 'toko');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pa;
    v_hari := app.hari_ini(pa);
    v_zona := app.zona(pa);
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf'), (pa, uk, 'akuntan');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_lk', 'Kasir LK') returning id into tp;
    insert into public.lowongan (perusahaan_id, topi_id, judul) values (pa, tp, 'Kasir') returning id into lw;
    insert into public.lamaran (perusahaan_id, lowongan_id, nama, telepon, tahap) values (pa, lw, 'Rina Lingkaran', '6281111111', 'diterima') returning id into l1;
    insert into public.lamaran (perusahaan_id, lowongan_id, nama, tahap) values (pa, lw, 'Dodi Baru', 'diterima') returning id into l2;
    insert into public.lamaran (perusahaan_id, lowongan_id, nama, tahap) values (pa, lw, 'Tono Ditinjau', 'ditinjau') returning id into l3;
    insert into public.berkas (perusahaan_id, jalur, diunggah_oleh) values (pa, pa || '/wawancara/' || l1 || '-1.webm', ua) returning id into o2;
    insert into public.jawaban_wawancara (perusahaan_id, lamaran_id, urutan, pertanyaan, berkas_id, durasi_detik, status, nilai)
      values (pa, l1, 1, 'Ceritakan saat melayani tamu yang marah', o2, 30, 'masuk', '{"skor": 70, "cocok": [], "kurang": []}');
    insert into public.uji_lamaran (perusahaan_id, lamaran_id, jenis, topi_kode, benih, jawaban) values (pa, l1, 'kerja', 'kasir', 7, '["10", "20", "30"]');

    -- Catat sebagai karyawan.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.jadikan_karyawan(l1, v_hari - 120);
      perform pg_temp.cek('staf tidak bisa mencatat karyawan', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mencatat karyawan', true);
    end;
    perform set_config('request.jwt.claims', ka, true);
    o1 := public.jadikan_karyawan(l1, v_hari - 120);
    perform pg_temp.cek('karyawan baru dari lamaran: nama, telepon, mulai, sumber, topi lowongan',
      (select o.nama = 'Rina Lingkaran' and o.telepon = '6281111111' and 'karyawan' = any(o.jenis) and o.status = 'aktif'
         and o.data ->> 'mulai' = to_char(v_hari - 120, 'YYYY-MM-DD') and o.data ->> 'lamaran_id' = l1::text from public.orang o where o.id = o1)
      and exists (select 1 from public.pakai_topi p where p.orang_id = o1 and p.topi_id = tp and p.porsi = 100 and p.mulai = v_hari - 120));
    perform pg_temp.cek('mencatat dua kali tidak menggandakan orang', public.jadikan_karyawan(l1, v_hari - 120) = o1
      and (select count(*) from public.orang where perusahaan_id = pa and nama = 'Rina Lingkaran') = 1);
    begin
      perform public.jadikan_karyawan(l3, v_hari);
      perform pg_temp.cek('pelamar yang belum diterima ditolak', false);
    exception when others then perform pg_temp.cek('pelamar yang belum diterima ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    o2 := public.jadikan_karyawan(l2, v_hari - 10);

    -- Kerja: di dalam jendela (hari ke-100, tepat waktu; hari ke-110 terlambat) dan di luar (hari ke-30, hari ke-200 belum terjadi).
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, tenggat, selesai_at) values
      (pa, 'Tutup kas', o1, 'selesai', 4, ((v_hari - 20)::timestamp + interval '12 hours') at time zone v_zona, ((v_hari - 20)::timestamp + interval '10 hours') at time zone v_zona),
      (pa, 'Hitung stok', o1, 'selesai', 2, ((v_hari - 10)::timestamp + interval '9 hours') at time zone v_zona, ((v_hari - 10)::timestamp + interval '15 hours') at time zone v_zona),
      (pa, 'Kerja awal', o1, 'selesai', 9, null, ((v_hari - 90)::timestamp + interval '10 hours') at time zone v_zona),
      (pa, 'Kerja dibatalkan', o1, 'batal', 9, null, null);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.lingkaran_rekrut();
    perform pg_temp.cek('satu orang dihitung, satu belum genap 90 hari', jsonb_array_length(r -> 'baris') = 1 and (r ->> 'belum_genap')::int = 1, r::text);
    b := r -> 'baris' -> 0;
    -- Jendela hari ke-90 sampai hari ini (hari ke-120) = 30 hari; poin 6 (4 + 2) / (30/7) = 1,4.
    perform pg_temp.cek('kinerja hanya dari jendela bulan ke-3 sampai ke-6: poin per minggu', (b ->> 'poin_per_minggu')::numeric = 1.4, b::text);
    perform pg_temp.cek('persen tepat waktu dari kerja bertenggat di jendela (1 dari 2)', (b ->> 'persen_tepat')::numeric = 50, b ->> 'persen_tepat');
    perform pg_temp.cek('sinyal: skor per pertanyaan wawancara dan uji kerja mentah', b -> 'wawancara' -> 0 ->> 'pertanyaan' = 'Ceritakan saat melayani tamu yang marah'
      and (b -> 'wawancara' -> 0 ->> 'skor')::numeric = 70 and b -> 'uji' ->> 'topi_kode' = 'kasir' and (b -> 'uji' ->> 'benih')::int = 7, b::text);
    perform pg_temp.cek('tanpa nama atau telepon di laporan', r::text !~ 'Rina' and r::text !~ '6281111111');

    perform set_config('request.jwt.claims', kk, true);
    begin
      perform public.lingkaran_rekrut();
      perform pg_temp.cek('akuntan tidak membaca laporan rekrut', false);
    exception when insufficient_privilege then perform pg_temp.cek('akuntan tidak membaca laporan rekrut', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.lingkaran_rekrut();
    perform pg_temp.cek('usaha lain: kosong', jsonb_array_length(r -> 'baris') = 0 and (r ->> 'belum_genap')::int = 0, r::text);
    begin
      perform public.jadikan_karyawan(l1, v_hari);
      perform pg_temp.cek('usaha lain tidak bisa mencatat lamaran usaha A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa mencatat lamaran usaha A', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      perform public.lingkaran_rekrut();
      perform pg_temp.cek('anon ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon ditolak', true);
    end;
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
