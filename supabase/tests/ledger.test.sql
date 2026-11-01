-- Tes F4-04 ledger (docs/research/ledger.md, docs/quality/rencana-uji-f4-04.md): jurnal timpang atau satu baris mustahil, tulis
-- langsung ditolak, posting idempoten per kunci, jurnal tidak bisa diedit atau dihapus, balik_jurnal membuat saldo kembali,
-- bulan terkunci (dihitung di zona usaha) menolak jurnal, kunci/buka hanya pemilik atau akuntan dengan alasan tercatat,
-- RLS lewat app.peran_aktif. Bagian akhir adalah kendali: dengan trigger keseimbangan dimatikan, jurnal timpang lolos, jadi
-- tes keseimbangan memang bergantung pada trigger itu. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uk uuid := gen_random_uuid();
  us uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; kd text; kk text; ks text; r jsonb; r2 jsonb; j1 uuid; jl uuid; jb uuid; n int; x text;
  v_hari date; v_bulan date; v_lalu date;
begin
  begin
    perform pg_temp.cek('tabel ada', to_regclass('public.akun') is not null and to_regclass('public.jurnal') is not null
      and to_regclass('public.jurnal_baris') is not null and to_regclass('public.periode_buku') is not null);
    perform pg_temp.cek('trigger keseimbangan adalah constraint trigger DEFERRABLE INITIALLY DEFERRED',
      (select count(*) = 2 from pg_trigger where tgname in ('jurnal_baris_seimbang', 'jurnal_berbaris') and tgconstraint <> 0 and tgdeferrable and tginitdeferred));
    perform pg_temp.cek('authenticated tidak punya hak tulis langsung',
      not has_table_privilege('authenticated', 'public.jurnal_baris', 'insert') and not has_table_privilege('authenticated', 'public.jurnal', 'insert')
      and not has_table_privilege('authenticated', 'public.jurnal', 'update') and not has_table_privilege('authenticated', 'public.periode_buku', 'insert'));
    perform pg_temp.cek('RPC memeriksa peran lewat peran_aktif',
      (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.posting_jurnal(jsonb,jsonb)'::regprocedure, 'public.balik_jurnal(uuid,text)'::regprocedure,
                      'public.kunci_periode(date)'::regprocedure, 'public.buka_periode(date,text)'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (ud, 'd@uji.local'), (uk, 'k@uji.local'), (us, 's@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Buku', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Buku B', 'toko');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pa;
    v_hari := app.hari_ini(pa);
    v_bulan := date_trunc('month', v_hari)::date;
    v_lalu := (v_bulan - interval '1 month')::date;
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, uk, 'akuntan'), (pa, us, 'staf');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Posting dan idempoten.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.posting_jurnal('{"keterangan":"Setoran modal awal","kunci_idempoten":"uji:modal"}',
      '[{"akun":"1-100","debit":5000000},{"akun":"3-100","kredit":5000000}]');
    j1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('posting seimbang berhasil, bagan bawaan terpasang', (r ->> 'baru')::boolean
      and (select count(*) >= 15 from public.akun where perusahaan_id = pa and bawaan), r::text);
    perform pg_temp.cek('tanggal bawaan = hari ini di zona usaha (Asia/Jayapura)', (select tanggal from public.jurnal where id = j1) = v_hari);
    r2 := public.posting_jurnal('{"keterangan":"Setoran modal awal (kirim ulang)","kunci_idempoten":"uji:modal"}',
      '[{"akun":"1-100","debit":5000000},{"akun":"3-100","kredit":5000000}]');
    perform pg_temp.cek('kunci sama: jurnal yang sama, tidak dobel', (r2 ->> 'id')::uuid = j1 and not (r2 ->> 'baru')::boolean
      and (select count(*) from public.jurnal where perusahaan_id = pa and kunci_idempoten = 'uji:modal') = 1, r2::text);

    -- Keseimbangan.
    begin
      perform public.posting_jurnal('{"keterangan":"Timpang"}', '[{"akun":"1-100","debit":100000},{"akun":"4-100","kredit":90000}]');
      perform pg_temp.cek('(a) jurnal timpang ditolak', false);
    exception when others then perform pg_temp.cek('(a) jurnal timpang ditolak', sqlstate = '23514' and sqlerrm ~ 'tidak seimbang', sqlstate || ' ' || sqlerrm);
    end;
    perform pg_temp.cek('jurnal timpang tidak tertinggal', not exists (select 1 from public.jurnal where perusahaan_id = pa and keterangan = 'Timpang'));
    begin
      perform public.posting_jurnal('{"keterangan":"Sebaris"}', '[{"akun":"1-100","debit":100000}]');
      perform pg_temp.cek('(c) jurnal satu baris ditolak', false);
    exception when others then perform pg_temp.cek('(c) jurnal satu baris ditolak', sqlstate = '23514' and sqlerrm ~ 'dua baris', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.posting_jurnal('{"keterangan":"Dua sisi"}', '[{"akun":"1-100","debit":100,"kredit":100},{"akun":"4-100","kredit":0}]');
      perform pg_temp.cek('baris dengan debit dan kredit sekaligus ditolak', false);
    exception when others then perform pg_temp.cek('baris dengan debit dan kredit sekaligus ditolak', sqlstate in ('23514', '22023'), sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.posting_jurnal('{"keterangan":"Pecahan"}', '[{"akun":"1-100","debit":100.5},{"akun":"4-100","kredit":100.5}]');
      perform pg_temp.cek('nilai pecahan rupiah ditolak', false);
    exception when others then perform pg_temp.cek('nilai pecahan rupiah ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    begin
      perform public.posting_jurnal('{"keterangan":"Akun asing"}', '[{"akun":"9-999","debit":100},{"akun":"4-100","kredit":100}]');
      perform pg_temp.cek('akun tidak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('akun tidak dikenal ditolak', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;
    begin
      insert into public.jurnal_baris (perusahaan_id, jurnal_id, akun_id, debit) values (pa, j1, (select id from public.akun where perusahaan_id = pa and kode = '1-100'), 1);
      perform pg_temp.cek('(b) insert langsung ke jurnal_baris ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('(b) insert langsung ke jurnal_baris ditolak', true);
    end;

    -- Tidak bisa diedit (bahkan oleh pemilik tabel).
    execute 'reset role';
    begin
      update public.jurnal set keterangan = 'Diubah diam-diam' where id = j1;
      perform pg_temp.cek('jurnal tidak bisa diedit', false);
    exception when others then perform pg_temp.cek('jurnal tidak bisa diedit', sqlstate = '42501', sqlstate || ' ' || sqlerrm);
    end;
    begin
      update public.jurnal_baris set debit = 1 where jurnal_id = j1 and debit > 0;
      perform pg_temp.cek('baris jurnal tidak bisa diedit', false);
    exception when others then perform pg_temp.cek('baris jurnal tidak bisa diedit', sqlstate = '42501', sqlstate || ' ' || sqlerrm);
    end;
    -- Hapus: tidak diuji dengan perintah hapus sungguhan (penjaga loop menolak SQL penghapus data); trigger jaga yang sama
    -- dipasang BEFORE UPDATE OR DELETE di kedua tabel dan selain penandaan balik selalu menolak (cabang yang diuji di atas).
    perform pg_temp.cek('trigger jaga menolak hapus di jurnal dan jurnal_baris',
      (select count(*) = 2 from pg_trigger where tgname in ('jaga_jurnal', 'jaga_jurnal_baris') and pg_get_triggerdef(oid) ~ 'BEFORE (UPDATE OR DELETE|DELETE OR UPDATE) ON'));

    -- Periode terkunci.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.posting_jurnal(jsonb_build_object('keterangan', 'Belanja bulan lalu', 'tanggal', v_lalu + 3),
      '[{"akun":"6-900","debit":250000},{"akun":"1-100","kredit":250000}]');
    jl := (r ->> 'id')::uuid;
    begin
      perform public.kunci_periode(v_bulan);
      perform pg_temp.cek('bulan berjalan (zona usaha) tidak bisa dikunci', false);
    exception when others then perform pg_temp.cek('bulan berjalan (zona usaha) tidak bisa dikunci', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.kunci_periode(v_lalu);
      perform pg_temp.cek('admin tidak bisa mengunci bulan', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak bisa mengunci bulan', true);
    end;
    perform set_config('request.jwt.claims', kk, true);
    perform public.kunci_periode(v_lalu + 10);
    perform pg_temp.cek('akuntan mengunci bulan lalu (tanggal mana pun di bulan itu)', exists (select 1 from public.periode_buku where perusahaan_id = pa and bulan = v_lalu and terkunci));
    begin
      perform public.posting_jurnal(jsonb_build_object('keterangan', 'Susulan bulan lalu', 'tanggal', v_lalu + 5),
        '[{"akun":"6-900","debit":1000},{"akun":"1-100","kredit":1000}]');
      perform pg_temp.cek('jurnal di bulan terkunci ditolak', false);
    exception when others then perform pg_temp.cek('jurnal di bulan terkunci ditolak', sqlstate = '55000', sqlstate || ' ' || sqlerrm);
    end;

    -- Jurnal balik: jurnal bulan terkunci dibalik di bulan berjalan; saldo pasangan kembali nol.
    r := public.balik_jurnal(jl, 'Salah catat, belanja itu milik usaha lain');
    jb := (r ->> 'id')::uuid;
    perform pg_temp.cek('jurnal balik bertanggal hari ini, menunjuk jurnal asli', (select tanggal = v_hari and membalik = jl from public.jurnal where id = jb)
      and (select dibalik_oleh = jb and alasan_balik ~ 'Salah catat' from public.jurnal where id = jl));
    select string_agg(a.kode || '=' || s.saldo, ',' order by a.kode) into x
      from (select akun_id, sum(debit - kredit) saldo from public.jurnal_baris where jurnal_id in (jl, jb) group by akun_id) s
      join public.akun a on a.id = s.akun_id;
    perform pg_temp.cek('saldo akun yang tersentuh pasangan jurnal kembali nol', x = '1-100=0,6-900=0', x);
    r2 := public.balik_jurnal(jl, 'Coba balik lagi');
    perform pg_temp.cek('balik dua kali tidak membuat jurnal baru', (r2 ->> 'id')::uuid = jb, r2::text);
    begin
      perform public.balik_jurnal(jb, 'Balik dari balik');
      perform pg_temp.cek('jurnal balik tidak dibalik lagi', false);
    exception when others then perform pg_temp.cek('jurnal balik tidak dibalik lagi', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;

    -- Buka kunci butuh alasan dan tercatat.
    begin
      perform public.buka_periode(v_lalu, ' ');
      perform pg_temp.cek('buka kunci tanpa alasan ditolak', false);
    exception when others then perform pg_temp.cek('buka kunci tanpa alasan ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    perform set_config('request.jwt.claims', ka, true);
    perform public.buka_periode(v_lalu, 'Nota susulan dari pemasok');
    execute 'reset role';
    perform pg_temp.cek('buka kunci tercatat di audit dengan alasan', exists (select 1 from public.audit_log
      where perusahaan_id = pa and tabel = 'periode_buku' and sesudah ->> 'alasan_buka' = 'Nota susulan dari pemasok'));
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.posting_jurnal(jsonb_build_object('keterangan', 'Susulan setelah dibuka', 'tanggal', v_lalu + 5),
      '[{"akun":"6-900","debit":1000},{"akun":"1-100","kredit":1000}]');
    perform pg_temp.cek('setelah dibuka jurnal bulan itu diterima', (r ->> 'baru')::boolean);

    -- RLS.
    perform set_config('request.jwt.claims', kk, true);
    select count(*) into n from public.jurnal;
    perform pg_temp.cek('akuntan membaca jurnal', n = 4, n::text);
    perform set_config('request.jwt.claims', ks, true);
    select count(*) into n from public.jurnal;
    perform pg_temp.cek('staf tidak membaca jurnal', n = 0, n::text);
    begin
      perform public.posting_jurnal('{"keterangan":"Staf"}', '[{"akun":"1-100","debit":1},{"akun":"4-100","kredit":1}]');
      perform pg_temp.cek('staf tidak bisa posting', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa posting', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    select count(*) into n from public.jurnal_baris;
    perform pg_temp.cek('usaha lain tidak membaca baris jurnal', n = 0, n::text);
    begin
      perform public.balik_jurnal(j1, 'Usaha lain mencoba');
      perform pg_temp.cek('usaha lain tidak bisa membalik', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa membalik', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id = uk;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kk, true);
    select count(*) into n from public.jurnal;
    perform pg_temp.cek('akuntan dicabut dengan JWT lama tidak membaca', n = 0, n::text);
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      perform public.posting_jurnal('{"keterangan":"Anon"}', '[]');
      perform pg_temp.cek('anon ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon ditolak', true);
    end;

    -- Kendali: tanpa trigger keseimbangan, jurnal timpang lolos (tes (a) bergantung pada trigger).
    execute 'reset role';
    alter table public.jurnal_baris disable trigger jurnal_baris_seimbang;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      r := public.posting_jurnal('{"keterangan":"Timpang kendali"}', '[{"akun":"1-100","debit":100000},{"akun":"4-100","kredit":90000}]');
      perform pg_temp.cek('kendali: tanpa trigger keseimbangan jurnal timpang lolos', (r ->> 'baru')::boolean);
    exception when others then perform pg_temp.cek('kendali: tanpa trigger keseimbangan jurnal timpang lolos', false, sqlstate || ' ' || sqlerrm);
    end;
    execute 'reset role';
    alter table public.jurnal_baris enable trigger jurnal_baris_seimbang;
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
