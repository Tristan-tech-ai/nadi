-- Tes M-06: penyusutan Pasal 11 UU PPh cocok dengan hitungan tangan, jurnal 6-500/1-590, menyusul bulan sekali saja, jual dengan
-- rugi, bangunan tidak boleh saldo menurun, tanah tidak disusutkan, aset dipinjam karyawan, peran, isolasi.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o1 uuid;
  a1 uuid; a2 uuid; r jsonb; g text;
  saldo_akun text := 'select coalesce(sum(b.debit) - sum(b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = $1 and a.kode = $2';
  v bigint; hari date;
begin
  insert into auth.users (id, email) values (ua, 'at-a@uji.local'), (ub, 'at-b@uji.local'), (us, 'at-s@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Aset A', 'ritel');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Aset B', 'ritel');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Sales Laptop', array['karyawan'], us) returning id into o1;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, us, 'staf', o1);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  a1 := public.catat_aset('Laptop kasir', 'k1', 'saldo_menurun', '2026-01-10', 12000000, 'bank');
  a2 := public.catat_aset('Tanah gudang', 'tanah', 'garis_lurus', '2026-02-01', 300000000, 'tanpa_jurnal');
  begin perform public.catat_aset('Ruko', 'bangunan_permanen', 'saldo_menurun', '2026-01-01', 500000000, 'tanpa_jurnal'); perform pg_temp.cek('bangunan saldo menurun ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('bangunan saldo menurun ditolak', g like '%ayat (2)%', g); end;
  execute 'reset role';
  execute saldo_akun into v using pa, '1-500';
  perform pg_temp.cek('perolehan: D 1-500 Rp12.000.000 (tanah tanpa jurnal)', v = 12000000);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  r := public.jalankan_penyusutan('2026-10-31');
  perform pg_temp.cek('10 bulan disusutkan (Jan-Okt 2026)', (r ->> 'bulan')::int = 10, r::text);
  perform pg_temp.cek('saldo menurun 50%: Rp500.000 per bulan di 2026', (select bool_and(nilai = 500000) and count(*) = 10 from public.penyusutan_aset where aset_id = a1));
  perform pg_temp.cek('tanah tidak disusutkan', not exists (select 1 from public.penyusutan_aset where aset_id = a2));
  perform pg_temp.cek('dijalankan lagi: tidak menggandakan', (public.jalankan_penyusutan('2026-10-31') ->> 'bulan')::int = 0);
  execute 'reset role';
  execute saldo_akun into v using pa, '6-500';
  perform pg_temp.cek('jurnal beban penyusutan Rp5.000.000', v = 5000000);
  execute saldo_akun into v using pa, '1-590';
  perform pg_temp.cek('akumulasi penyusutan -Rp5.000.000', v = -5000000);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.pinjamkan_aset(a1, o1, 'Untuk kunjungan toko');
  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf melihat aset yang ia pinjam saja', (select count(*) = 1 and min(nama) = 'Laptop kasir' from public.aset_tetap));
  perform pg_temp.cek('staf melihat riwayat pinjamnya', (select count(*) from public.aset_pinjam) = 1);
  perform pg_temp.cek('staf tidak melihat penyusutan', (select count(*) from public.penyusutan_aset) = 0);
  begin perform public.catat_aset('Coba', 'k1', 'garis_lurus', '2026-01-01', 1000, 'kas'); perform pg_temp.cek('staf tidak mencatat aset', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mencatat aset', true); end;

  -- Jual 5 Nov 2026 Rp6.500.000: nilai buku 7.000.000, rugi 500.000; pinjaman ditutup.
  perform set_config('request.jwt.claims', ka, true);
  r := public.lepas_aset(a1, hari, 6500000, 'kas');
  perform pg_temp.cek('jual: nilai buku Rp7.000.000, rugi Rp500.000', (r ->> 'nilai_buku')::bigint = 7000000 and (r ->> 'laba')::bigint = -500000, r::text);
  perform pg_temp.cek('status dijual, pinjaman selesai', (select status = 'dijual' and dipinjam_orang is null from public.aset_tetap where id = a1)
    and (select selesai is not null from public.aset_pinjam where aset_id = a1));
  begin perform public.lepas_aset(a1, hari, 1, 'kas'); perform pg_temp.cek('jual dua kali ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('jual dua kali ditolak', true); end;
  execute 'reset role';
  execute saldo_akun into v using pa, '1-500';
  perform pg_temp.cek('aset keluar dari 1-500', v = 0);
  execute saldo_akun into v using pa, '1-590';
  perform pg_temp.cek('akumulasi ditutup', v = 0);
  execute saldo_akun into v using pa, '6-990';
  perform pg_temp.cek('rugi pelepasan Rp500.000 di 6-990', v = 500000);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat aset A', (select count(*) from public.aset_tetap) + (select count(*) from public.penyusutan_aset) = 0);
  begin perform public.pinjamkan_aset(a2, null, null); perform pg_temp.cek('usaha B tidak meminjamkan aset A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak meminjamkan aset A', true); end;
  execute 'reset role';
  perform pg_temp.cek('fungsi inti tidak bisa dipanggil klien', not has_function_privilege('authenticated', 'app.susutkan(uuid, date)', 'execute'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
