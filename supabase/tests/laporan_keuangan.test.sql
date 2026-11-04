-- Tes M-01 laporan keuangan (supabase/migrations/20261104054000_laporan_keuangan.sql). Korpus transaksi tahun lalu
-- dihitung tangan (angka di komentar), lalu dicocokkan dengan neraca, laba rugi, arus kas, buku besar, umur piutang,
-- saldo awal, tutup buku, kunci periode, peran, dan isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uk uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; kd text; kk text; ks text; r jsonb; n int; x text; v_hari date; L int; d0 date;
  v_baris jsonb := '[{"uraian": "Nasi kotak", "jumlah": 10, "harga": 50000}]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'la@uji.local'), (ub, 'lb@uji.local'), (ud, 'ld@uji.local'), (uk, 'lk@uji.local'), (us, 'ls@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Laporan', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Laporan B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, uk, 'akuntan'), (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    L := extract(year from v_hari)::int - 1;
    d0 := make_date(L, 2, 1);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- Saldo awal 1 Jan: kas 2.000.000 D, peralatan 3.000.000 D, utang pemasok 1.000.000 K, penyeimbang 4.000.000 K.
    r := public.atur_saldo_awal(make_date(L, 1, 1), '[{"akun":"1-100","debit":2000000},{"akun":"1-500","debit":3000000},{"akun":"2-100","kredit":1000000}]');
    perform pg_temp.cek('saldo awal: penyeimbang 4.000.000 ke 3-900', (r ->> 'penyeimbang')::bigint = 4000000 and (r ->> 'baru')::boolean, r::text);
    begin
      perform public.atur_saldo_awal(make_date(L, 1, 1), '[{"akun":"1-100","debit":1}]');
      perform pg_temp.cek('saldo awal kedua ditolak', false);
    exception when unique_violation then perform pg_temp.cek('saldo awal kedua ditolak', true);
    end;
    begin
      perform public.atur_saldo_awal(make_date(L, 1, 1), '[{"akun":"4-100","kredit":1}]');
      perform pg_temp.cek('saldo awal akun pendapatan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('saldo awal akun pendapatan ditolak', true);
    when unique_violation then perform pg_temp.cek('saldo awal akun pendapatan ditolak', true, 'ditolak lebih dulu karena saldo awal ada');
    end;
    execute 'reset role';
    insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal) values (pa, '2-500', 'Pinjaman bank', 'kewajiban', 'kredit');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 2, 10), 'keterangan', 'Jual tunai'), '[{"akun":"1-100","debit":1500000},{"akun":"4-100","kredit":1500000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 2, 15), 'keterangan', 'Jual kredit'), '[{"akun":"1-200","debit":800000},{"akun":"4-100","kredit":800000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 3, 1), 'keterangan', 'Sewa'), '[{"akun":"6-200","debit":500000},{"akun":"1-100","kredit":500000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 3, 5), 'keterangan', 'Beli peralatan'), '[{"akun":"1-500","debit":1200000},{"akun":"1-100","kredit":1200000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 3, 10), 'keterangan', 'Ambil pribadi'), '[{"akun":"3-200","debit":100000},{"akun":"1-100","kredit":100000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 4, 1), 'keterangan', 'Pinjaman bank'), '[{"akun":"1-100","debit":2000000},{"akun":"2-500","kredit":2000000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 4, 5), 'keterangan', 'Pelunasan piutang'), '[{"akun":"1-110","debit":800000},{"akun":"1-200","kredit":800000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 5, 10), 'keterangan', 'Gaji Mei'), '[{"akun":"6-100","debit":700000},{"akun":"2-200","kredit":700000}]');

    -- Rentang 1 Feb sampai 31 Des: pendapatan 2.300.000, beban 1.200.000, laba 1.100.000.
    -- Kas: awal 2.000.000, akhir 4.500.000; operasi 1.800.000, investasi -1.200.000, pendanaan 1.900.000.
    -- Neraca 31 Des: aset 8.700.000 = kewajiban 3.700.000 + modal 3.900.000 + laba 1.100.000.
    r := public.laporan_keuangan(d0, make_date(L, 12, 31));
    perform pg_temp.cek('laba rugi: 2.300.000 - 1.200.000 = 1.100.000', (r #>> '{laba_rugi,pendapatan}')::bigint = 2300000
      and (r #>> '{laba_rugi,beban}')::bigint = 1200000 and (r #>> '{laba_rugi,laba}')::bigint = 1100000, r ->> 'laba_rugi');
    perform pg_temp.cek('neraca: aset 8.700.000, kewajiban 3.700.000, modal 3.900.000, seimbang', (r #>> '{neraca,aset}')::bigint = 8700000
      and (r #>> '{neraca,kewajiban}')::bigint = 3700000 and (r #>> '{neraca,modal}')::bigint = 3900000
      and (r #>> '{neraca,laba_belum_ditutup}')::bigint = 1100000 and (r #>> '{neraca,seimbang}')::boolean, r ->> 'neraca');
    perform pg_temp.cek('arus kas: 2.000.000 + 1.800.000 - 1.200.000 + 1.900.000 = 4.500.000', (r #>> '{arus_kas,kas_awal}')::bigint = 2000000
      and (r #>> '{arus_kas,operasi}')::bigint = 1800000 and (r #>> '{arus_kas,investasi}')::bigint = -1200000
      and (r #>> '{arus_kas,pendanaan}')::bigint = 1900000 and (r #>> '{arus_kas,kas_akhir}')::bigint = 4500000
      and (r #>> '{arus_kas,cocok}')::boolean, r ->> 'arus_kas');
    perform pg_temp.cek('prive tampil negatif di modal neraca', exists (select 1 from jsonb_array_elements(r #> '{neraca,baris}') e
      where e ->> 'kode' = '3-200' and (e ->> 'saldo')::bigint = -100000));
    perform pg_temp.cek('neraca saldo: total debit = total kredit', (select sum((e ->> 'debit')::bigint) = sum((e ->> 'kredit')::bigint)
      from jsonb_array_elements(r -> 'neraca_saldo') e));
    -- Buku besar kas 1-100: awal 2.000.000, lima mutasi, akhir 3.700.000.
    r := public.buku_besar('1-100', d0, make_date(L, 12, 31));
    perform pg_temp.cek('buku besar kas: awal 2.000.000, 5 baris, akhir 3.700.000', (r ->> 'awal')::bigint = 2000000
      and jsonb_array_length(r -> 'baris') = 5 and (r ->> 'akhir')::bigint = 3700000
      and (r -> 'baris' -> 4 ->> 'saldo')::bigint = 3700000, r::text);

    -- Admin boleh membaca, tidak boleh menutup buku; staf ditolak; usaha lain kosong.
    perform set_config('request.jwt.claims', kd, true);
    perform pg_temp.cek('admin membaca laporan', (public.laporan_keuangan(d0, make_date(L, 12, 31)) #>> '{laba_rugi,laba}')::bigint = 1100000);
    begin
      perform public.tutup_buku(L);
      perform pg_temp.cek('admin tidak boleh menutup buku', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak boleh menutup buku', true);
    end;
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.ringkasan_uang();
      perform pg_temp.cek('staf ditolak membaca laporan', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf ditolak membaca laporan', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.laporan_keuangan(d0, make_date(L, 12, 31));
    perform pg_temp.cek('usaha lain tidak melihat angka usaha A', (r #>> '{neraca,aset}')::bigint = 0 and jsonb_array_length(r -> 'neraca_saldo') = 0, r::text);

    -- Tutup buku tahun lalu oleh akuntan: laba 1.100.000 ke 3-300, 12 bulan terkunci, idempoten.
    perform set_config('request.jwt.claims', kk, true);
    begin
      perform public.tutup_buku(L + 1);
      perform pg_temp.cek('tutup buku tahun berjalan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tutup buku tahun berjalan ditolak', true);
    end;
    r := public.tutup_buku(L);
    perform pg_temp.cek('tutup buku: laba 1.100.000, jurnal baru', (r ->> 'laba')::bigint = 1100000 and (r ->> 'baru')::boolean, r::text);
    perform pg_temp.cek('tutup buku kedua tidak menggandakan', not (public.tutup_buku(L) ->> 'baru')::boolean
      and (select count(*) = 1 from public.jurnal where perusahaan_id = pa and sumber = 'tutup_buku'));
    r := public.laporan_keuangan(d0, make_date(L, 12, 31));
    perform pg_temp.cek('setelah tutup buku: laba rugi tetap 1.100.000, laba ditahan 1.100.000, seimbang',
      (r #>> '{laba_rugi,laba}')::bigint = 1100000 and (r #>> '{neraca,laba_belum_ditutup}')::bigint = 0
      and (r #>> '{neraca,modal}')::bigint = 5000000 and (r #>> '{neraca,seimbang}')::boolean and (r #>> '{arus_kas,cocok}')::boolean, r::text);
    perform pg_temp.cek('12 bulan tahun itu terkunci', (select count(*) = 12 from public.periode_buku where perusahaan_id = pa and terkunci
      and extract(year from bulan) = L));
    begin
      perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(L, 6, 1), 'keterangan', 'Telat'), '[{"akun":"6-900","debit":1},{"akun":"1-100","kredit":1}]');
      perform pg_temp.cek('jurnal di tahun yang ditutup ditolak', false);
    exception when sqlstate '55000' then perform pg_temp.cek('jurnal di tahun yang ditutup ditolak', true);
    end;

    -- Umur piutang dan ringkasan uang bulan berjalan dari invoice sungguhan.
    perform set_config('request.jwt.claims', ka, true);
    perform public.atur_bayar('00020101021153033605802ID5915WARUNG UJI NADI6008DENPASAR6304ABCD', 'WARUNG UJI NADI', null, null);
    perform public.buat_invoice('Bu Rina', null, v_baris, v_hari + 14, null, gen_random_uuid());
    perform public.buat_invoice('Pak Made', null, v_baris, v_hari + 40, null, gen_random_uuid());
    perform public.buat_invoice('Bu Sari', null, v_baris, v_hari + 60, null, gen_random_uuid());
    r := public.umur_piutang(v_hari + 45);
    perform pg_temp.cek('umur piutang per +45 hari: 31-60 = 500.000, 1-30 = 500.000, belum jatuh tempo = 500.000',
      (r #>> '{kelompok,h31_60}')::bigint = 500000 and (r #>> '{kelompok,h1_30}')::bigint = 500000
      and (r #>> '{kelompok,belum}')::bigint = 500000 and (r #>> '{kelompok,total}')::bigint = 1500000, r ->> 'kelompok');
    r := public.ringkasan_uang();
    perform pg_temp.cek('ringkasan uang: kas 4.500.000, piutang 1.500.000, pendapatan bulan ini 1.500.000',
      (r ->> 'kas_bank')::bigint = 4500000 and (r ->> 'piutang')::bigint = 1500000 and (r ->> 'pendapatan')::bigint = 1500000
      and (r ->> 'laba')::bigint = 1500000, r::text);
    execute 'reset role';
    perform pg_temp.cek('fungsi app tidak bisa dipanggil authenticated', not has_function_privilege('authenticated', 'app.saldo_akun(uuid,date,date,boolean)', 'execute'));
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
