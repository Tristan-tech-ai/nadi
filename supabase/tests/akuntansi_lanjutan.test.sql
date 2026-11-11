-- Tes M-08 akuntansi lanjutan (supabase/migrations/20261105076000_akuntansi_lanjutan.sql): anggaran vs realisasi, dimensi + aturan tag,
-- jurnal berulang (idempoten, bulan terkunci), kurs pajak resmi + kurs usaha, revaluasi dan pelunasan valas (angka dihitung tangan),
-- konsolidasi dengan eliminasi antarusaha, peran, dan isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pa2 uuid; pb uuid; ka text; ka2 text; kb text; kd text; ks text; r jsonb; n int; v_hari date; v_bln date;
  cab_a uuid; cab_b uuid; cab_x uuid; j1 uuid; j2 uuid; rj uuid; inv uuid; lr_a jsonb; lr_a2 jsonb; v_isi jsonb; x text;
begin
  begin
    insert into auth.users (id, email) values (ua, 'm8a@uji.local'), (ub, 'm8b@uji.local'), (ud, 'm8d@uji.local'), (us, 'm8s@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Induk Uji M08', 'toko');
    pa2 := public.buat_perusahaan('Anak Uji M08', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji M08', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    v_bln := date_trunc('month', v_hari)::date;
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    ka2 := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa2, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    perform pg_temp.cek('cron jurnal berulang terjadwal', exists (select 1 from cron.job where jobname = 'nadi-jurnal-berulang'));

    -- ---------- 1. Anggaran ----------
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Jual tunai harian'), '[{"akun":"1-100","debit":1200000},{"akun":"4-100","kredit":1200000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Sewa kios'), '[{"akun":"6-200","debit":500000},{"akun":"1-100","kredit":500000}]');
    n := public.set_budget('6-200', v_hari, 600000);
    perform pg_temp.cek('anggaran sewa 1 bulan', n = 1, n::text);
    n := public.set_budget('4-100', v_hari, 1000000, (v_bln + interval '2 months')::date);
    perform pg_temp.cek('anggaran penjualan 3 bulan', n = 3, n::text);
    n := public.set_budget('4-100', v_hari, 1000000);
    perform pg_temp.cek('anggaran diulang = diperbarui, bukan ganda', (select count(*) from public.budget where perusahaan_id = pa) = 4);
    begin perform public.set_budget('1-100', v_hari, 1); perform pg_temp.cek('anggaran akun kas ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('anggaran akun kas ditolak', true); end;
    begin perform public.set_budget('6-200', v_hari, 1, (v_bln + interval '30 months')::date); perform pg_temp.cek('anggaran > 24 bulan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('anggaran > 24 bulan ditolak', true); end;
    r := public.budget_report(v_bln, v_hari);
    perform pg_temp.cek('laporan anggaran: pendapatan 1.000.000 vs 1.200.000, beban 600.000 vs 500.000, laba 400.000 vs 700.000',
      (r #>> '{pendapatan,anggaran}')::bigint = 1000000 and (r #>> '{pendapatan,realisasi}')::bigint = 1200000
      and (r #>> '{beban,anggaran}')::bigint = 600000 and (r #>> '{beban,realisasi}')::bigint = 500000
      and (r #>> '{laba,anggaran}')::bigint = 400000 and (r #>> '{laba,realisasi}')::bigint = 700000, r::text);
    perform pg_temp.cek('baris sewa: selisih -100.000, 83%', exists (select 1 from jsonb_array_elements(r -> 'baris') e
      where e ->> 'kode' = '6-200' and (e ->> 'selisih')::bigint = -100000 and (e ->> 'persen')::int = 83), r::text);
    perform set_config('request.jwt.claims', kd, true);
    r := public.budget_report(v_bln, v_hari);
    perform pg_temp.cek('admin boleh membaca laporan anggaran', (r #>> '{beban,anggaran}')::bigint = 600000);
    begin perform public.set_budget('6-200', v_hari, 1); perform pg_temp.cek('admin tidak boleh mengubah anggaran', false);
    exception when sqlstate '42501' then perform pg_temp.cek('admin tidak boleh mengubah anggaran', true); end;
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.budget_report(v_bln, v_hari); perform pg_temp.cek('staf tidak boleh membaca anggaran', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak boleh membaca anggaran', true); end;
    perform pg_temp.cek('staf tidak melihat baris anggaran', (select count(*) from public.budget) = 0);

    -- ---------- 2. Dimensi ----------
    perform set_config('request.jwt.claims', ka, true);
    cab_a := public.save_dimension('cabang', 'Cabang Kuta');
    cab_b := public.save_dimension('cabang', 'Cabang Ubud');
    perform pg_temp.cek('simpan dimensi idempoten per nama', public.save_dimension('cabang', 'Cabang Kuta') = cab_a);
    perform public.save_tag_rule(cab_a, 'Kuta');
    j1 := (public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Jual tunai cabang Kuta'), '[{"akun":"1-100","debit":300000},{"akun":"4-100","kredit":300000}]') ->> 'id')::uuid;
    perform pg_temp.cek('aturan tag menandai jurnal baru', exists (select 1 from public.journal_tag where jurnal_id = j1 and dimension_id = cab_a and sumber = 'aturan'));
    j2 := (public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Sewa toko barat'), '[{"akun":"6-200","debit":200000},{"akun":"1-100","kredit":200000}]') ->> 'id')::uuid;
    perform public.tag_journal(j2, cab_b);
    perform public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Beli bahan Ubud'), '[{"akun":"6-900","debit":100000},{"akun":"1-100","kredit":100000}]');
    perform public.save_tag_rule(cab_b, 'ubud');
    n := public.apply_tag_rules(v_bln, v_hari);
    perform pg_temp.cek('aturan diterapkan ke 1 jurnal lama yang belum bertag', n = 1, n::text);
    r := public.dimension_report('cabang', v_bln, v_hari);
    perform pg_temp.cek('laba rugi cabang: Kuta +300.000, Ubud -300.000, tanpa tag 1.200.000 - 500.000',
      exists (select 1 from jsonb_array_elements(r -> 'baris') e where e ->> 'nama' = 'Cabang Kuta' and (e ->> 'pendapatan')::bigint = 300000 and (e ->> 'laba')::bigint = 300000)
      and exists (select 1 from jsonb_array_elements(r -> 'baris') e where e ->> 'nama' = 'Cabang Ubud' and (e ->> 'beban')::bigint = 300000 and (e ->> 'laba')::bigint = -300000)
      and exists (select 1 from jsonb_array_elements(r -> 'baris') e where e ->> 'dimensi' is null and (e ->> 'pendapatan')::bigint = 1200000 and (e ->> 'beban')::bigint = 500000), r::text);
    r := public.budget_report(v_bln, v_hari, cab_a);
    perform pg_temp.cek('laporan anggaran per cabang Kuta: realisasi pendapatan 300.000', (r #>> '{pendapatan,realisasi}')::bigint = 300000, r::text);
    perform set_config('request.jwt.claims', kb, true);
    cab_x := public.save_dimension('proyek', 'Proyek Lain');
    begin perform public.tag_journal(j1, cab_x); perform pg_temp.cek('usaha lain tidak bisa menandai jurnal usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menandai jurnal usaha A', true); end;
    perform pg_temp.cek('usaha lain tidak melihat dimensi dan tag usaha A',
      (select count(*) from public.dimension where perusahaan_id = pa) = 0 and (select count(*) from public.journal_tag where perusahaan_id = pa) = 0);

    -- ---------- 3. Jurnal berulang ----------
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.save_recurring_journal('Tidak seimbang', 'bulan', v_hari, null, '[{"akun":"6-200","debit":100},{"akun":"1-100","kredit":90}]');
      perform pg_temp.cek('jurnal berulang tidak seimbang ditolak', false);
    exception when sqlstate '23514' then perform pg_temp.cek('jurnal berulang tidak seimbang ditolak', true); end;
    rj := public.save_recurring_journal('Sewa gudang bulanan', 'bulan', v_hari - 70, null, '[{"akun":"6-200","debit":100000},{"akun":"1-110","kredit":100000}]', cab_b);
    perform public.save_recurring_journal('Kebersihan mingguan', 'minggu', v_hari - 14, v_hari - 1, '[{"akun":"6-900","debit":50000},{"akun":"1-100","kredit":50000}]');
    perform public.kunci_periode(date_trunc('month', v_hari - 200)::date);
    perform public.save_recurring_journal('Langganan lama', 'bulan', date_trunc('month', v_hari - 200)::date, null, '[{"akun":"6-300","debit":10000},{"akun":"1-100","kredit":10000}]');
    n := public.run_recurring_journals();
    -- bulanan: v-70, v-70+1 bln, v-70+2 bln (3 jurnal); mingguan: v-14, v-7 (2 jurnal); yang bulannya terkunci: 0.
    perform pg_temp.cek('jalankan berulang: 5 jurnal baru', n = 5, n::text);
    perform pg_temp.cek('jalankan ulang tidak menggandakan', public.run_recurring_journals() = 0);
    perform pg_temp.cek('bulanan: kali 3, berikutnya setelah hari ini, ditandai Ubud',
      (select kali = 3 and berikutnya > v_hari from public.recurring_journal where id = rj)
      and (select count(*) from public.jurnal j join public.journal_tag t on t.jurnal_id = j.id and t.dimension_id = cab_b and t.sumber = 'berulang'
           where j.perusahaan_id = pa and j.sumber = 'berulang' and j.sumber_id = rj::text) = 3);
    perform pg_temp.cek('mingguan berhenti setelah tanggal selesai', (select not aktif and kali = 2 from public.recurring_journal where nama = 'Kebersihan mingguan' and perusahaan_id = pa));
    perform pg_temp.cek('bulan terkunci: galat dicatat, jadwal lain tetap jalan',
      (select galat like '%dikunci%' and kali = 0 from public.recurring_journal where nama = 'Langganan lama' and perusahaan_id = pa));
    perform set_config('request.jwt.claims', kd, true);
    begin perform public.run_recurring_journals(); perform pg_temp.cek('admin tidak menjalankan jurnal berulang', false);
    exception when sqlstate '42501' then perform pg_temp.cek('admin tidak menjalankan jurnal berulang', true); end;

    -- ---------- 4. Kurs ----------
    perform set_config('request.jwt.claims', ka, true);
    r := public.fx_rate_on('usd', '2026-11-05');
    perform pg_temp.cek('kurs pajak resmi USD 5 Nov 2026 = 18.141 (KMK 53/MK/EF.2/2026)', (r ->> 'kurs')::numeric = 18141 and (r ->> 'resmi')::boolean, r::text);
    r := public.fx_rate_on('JPY', '2026-11-05');
    perform pg_temp.cek('JPY per 100 yen', (r ->> 'per')::int = 100 and (r ->> 'kurs')::numeric = 11502.49, r::text);
    perform pg_temp.cek('kurs di luar masa berlaku kosong', public.fx_rate_on('USD', '2026-11-11') is null);
    perform public.save_fx_rate('usd', '2026-11-05', 18200, 'Kurs bank uji');
    r := public.fx_rate_on('USD', '2026-11-05');
    perform pg_temp.cek('kurs usaha menang dari kurs resmi yang lebih lama', (r ->> 'kurs')::numeric = 18200 and not (r ->> 'resmi')::boolean, r::text);
    begin perform public.save_fx_rate('USD', v_hari + 1, 18000, 'besok'); perform pg_temp.cek('kurs masa depan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kurs masa depan ditolak', true); end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.fx_rate_on('USD', '2026-11-05');
    perform pg_temp.cek('usaha lain memakai kurs resmi, bukan kurs usaha A', (r ->> 'kurs')::numeric = 18141, r::text);

    -- ---------- 5. Revaluasi dan pelunasan valas ----------
    perform set_config('request.jwt.claims', ka, true);
    v_isi := jsonb_build_object('alamat_penjual', 'Jl. Raya Kintamani 12, Bangli, Bali', 'pembeli', 'Harbour Roasters Pty Ltd',
      'alamat_pembeli', '18 Wharf Street, Fremantle WA 6160', 'negara', 'Australia', 'incoterm', 'FOB', 'tempat_incoterm', 'Benoa',
      'kurs', 16287.5, 'kurs_sumber', 'KMK kurs pajak (uji)', 'kurs_tanggal', v_hari, 'jatuh_tempo', v_hari + 30,
      'baris', jsonb_build_array(jsonb_build_object('uraian', 'Arabica green beans grade 1', 'hs', '0901.11.10', 'jumlah', 1000, 'satuan', 'kg',
        'harga_usd', 7.35, 'berat_bersih_kg', 1000, 'berat_kotor_kg', 1020, 'koli', 20)));
    inv := (public.buat_invoice_ekspor(v_isi, gen_random_uuid()) ->> 'id')::uuid;
    perform pg_temp.cek('invoice ekspor: 7.350 USD x 16.287,5 = Rp119.713.125, nilai buku sama',
      (select total_rupiah = 119713125 and nilai_buku = 119713125 from public.invoice_ekspor where id = inv));
    r := public.revalue_fx(v_hari, 16500, 'Kurs akhir bulan (uji)');
    -- 7.350 x 16.500 = 121.275.000; selisih +1.561.875 (laba selisih kurs belum terealisasi).
    perform pg_temp.cek('revaluasi: 1 invoice, selisih +1.561.875', (r ->> 'invoice')::int = 1 and (r ->> 'selisih')::bigint = 1561875, r::text);
    perform pg_temp.cek('revaluasi ulang tanggal sama tidak dibukukan lagi', (public.revalue_fx(v_hari, 16600, 'ulang') ->> 'invoice')::int = 0);
    perform pg_temp.cek('nilai buku jadi 121.275.000', (select nilai_buku = 121275000 and kurs_buku = 16500 from public.invoice_ekspor where id = inv));
    begin perform public.batal_invoice_ekspor(inv, 'salah pembeli'); perform pg_temp.cek('batal invoice yang sudah direvaluasi ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('batal invoice yang sudah direvaluasi ditolak', true); end;
    r := public.settle_export_invoice(inv, v_hari, 16400, 'Kurs beli bank (uji)', '1-110');
    -- Diterima 7.350 x 16.400 = 120.540.000; piutang ditutup 121.275.000; rugi selisih kurs 735.000.
    perform pg_temp.cek('pelunasan: diterima 120.540.000, rugi kurs 735.000', (r ->> 'diterima')::bigint = 120540000 and (r ->> 'selisih_kurs')::bigint = -735000, r::text);
    perform pg_temp.cek('pelunasan kedua idempoten', (public.settle_export_invoice(inv, v_hari, 17000, 'ulang') ->> 'sudah')::boolean);
    r := public.laporan_keuangan(v_bln, v_hari);
    perform pg_temp.cek('piutang valas 1-210 nol setelah lunas; selisih kurs bersih +826.875 = 120.540.000 - 119.713.125',
      not exists (select 1 from jsonb_array_elements(r #> '{neraca,baris}') e where e ->> 'kode' = '1-210')
      and (select coalesce(sum(case when e ->> 'kode' = '4-920' then (e ->> 'nilai')::bigint when e ->> 'kode' = '6-920' then -(e ->> 'nilai')::bigint end), 0)
           from jsonb_array_elements(r #> '{laba_rugi,baris}') e) = 826875
      and (r #>> '{neraca,seimbang}')::boolean, r::text);
    perform pg_temp.cek('revaluasi melewati invoice yang sudah lunas', (public.revalue_fx(v_hari - 0, 16000, 'lain') ->> 'invoice')::int = 0);

    -- ---------- 6. Konsolidasi ----------
    perform set_config('request.jwt.claims', ka2, true);
    perform public.posting_jurnal(jsonb_build_object('tanggal', v_hari, 'keterangan', 'Jual tunai anak'), '[{"akun":"1-100","debit":700000},{"akun":"4-100","kredit":700000}]');
    perform set_config('request.jwt.claims', ka, true);
    r := public.owned_companies();
    perform pg_temp.cek('pemilik melihat dua usahanya', jsonb_array_length(r) = 2, r::text);
    r := public.post_intercompany(pa2, v_hari, 'jual', 2000000, 'Jasa kelola toko', gen_random_uuid());
    -- RLS: dari usaha induk hanya baris milik usaha induk yang terlihat; pasangannya ada di usaha anak.
    perform pg_temp.cek('transaksi antarusaha jual: jurnal di dua usaha', (r ->> 'baru')::boolean
      and (select count(*) from public.intercompany_journal where pasangan = (r ->> 'pasangan')::uuid) = 1
      and (r ->> 'jurnal_mitra') is not null, r::text);
    x := gen_random_uuid()::text;
    perform public.post_intercompany(pa2, v_hari, 'pinjam', 1000000, 'Pinjaman modal', x::uuid);
    perform pg_temp.cek('antarusaha idempoten per kunci', not (public.post_intercompany(pa2, v_hari, 'pinjam', 1000000, 'Pinjaman modal', x::uuid) ->> 'baru')::boolean);
    lr_a := public.laporan_keuangan(v_bln, v_hari);
    perform set_config('request.jwt.claims', ka2, true);
    lr_a2 := public.laporan_keuangan(v_bln, v_hari);
    perform pg_temp.cek('usaha anak mencatat beban 2.000.000 dan utang antarusaha 3.000.000',
      (lr_a2 #>> '{laba_rugi,beban}')::bigint = 2000000
      and exists (select 1 from jsonb_array_elements(lr_a2 #> '{neraca,baris}') e where e ->> 'kode' = '2-250' and (e ->> 'saldo')::bigint = 3000000), lr_a2::text);
    r := public.consolidated_report(array[pa, pa2], v_bln, v_hari);
    perform pg_temp.cek('konsolidasi: pendapatan dan beban tanpa jual antarusaha 2.000.000',
      (r #>> '{laba_rugi,pendapatan}')::bigint = (lr_a #>> '{laba_rugi,pendapatan}')::bigint + (lr_a2 #>> '{laba_rugi,pendapatan}')::bigint - 2000000
      and (r #>> '{laba_rugi,beban}')::bigint = (lr_a #>> '{laba_rugi,beban}')::bigint + (lr_a2 #>> '{laba_rugi,beban}')::bigint - 2000000, r::text);
    perform pg_temp.cek('konsolidasi: piutang dan utang antarusaha tereliminasi, neraca seimbang',
      not exists (select 1 from jsonb_array_elements(r #> '{neraca,baris}') e where e ->> 'kode' in ('1-250', '2-250'))
      and (r #>> '{neraca,seimbang}')::boolean and (r #>> '{eliminasi,nilai}')::bigint = 6000000, r::text);
    perform pg_temp.cek('konsolidasi: aset = jumlah aset dua usaha dikurangi piutang antarusaha 3.000.000',
      (r #>> '{neraca,aset}')::bigint = (lr_a #>> '{neraca,aset}')::bigint + (lr_a2 #>> '{neraca,aset}')::bigint - 3000000, r::text);
    begin perform public.consolidated_report(array[pa2], v_bln, v_hari); perform pg_temp.cek('konsolidasi satu usaha ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('konsolidasi satu usaha ditolak', true); end;
    begin perform public.consolidated_report(array[pa, pb], v_bln, v_hari); perform pg_temp.cek('konsolidasi usaha orang lain ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('konsolidasi usaha orang lain ditolak', true); end;
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.post_intercompany(pb, v_hari, 'jual', 1000, 'Coba', gen_random_uuid()); perform pg_temp.cek('antarusaha ke usaha orang lain ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('antarusaha ke usaha orang lain ditolak', true); end;
    perform set_config('request.jwt.claims', kd, true);
    begin perform public.post_intercompany(pa2, v_hari, 'jual', 1000, 'Coba', gen_random_uuid()); perform pg_temp.cek('admin tidak membuat transaksi antarusaha', false);
    exception when sqlstate '42501' then perform pg_temp.cek('admin tidak membuat transaksi antarusaha', true); end;
    perform set_config('request.jwt.claims', kb, true);
    begin perform public.consolidated_report(array[pa, pa2], v_bln, v_hari); perform pg_temp.cek('orang lain tidak bisa konsolidasi usaha A', false);
    exception when sqlstate '42501' then perform pg_temp.cek('orang lain tidak bisa konsolidasi usaha A', true); end;
    perform pg_temp.cek('orang lain tidak melihat jadwal berulang dan jurnal antarusaha A',
      (select count(*) from public.recurring_journal) = 0 and (select count(*) from public.intercompany_journal) = 0);
    -- ensure_chart (migrasi 20261105076100_bagan_siap): bagan bawaan terpasang sekali, staf ditolak.
    -- dipanggil di pernyataan sendiri: subquery dalam pernyataan yang sama memakai snapshot sebelum bagan dipasang
    n := public.ensure_chart();
    perform pg_temp.cek('ensure_chart: bagan ada setelah dipanggil, panggilan kedua 0',
      n >= 0 and (select count(*) from public.akun where perusahaan_id = pb) >= 17 and public.ensure_chart() = 0);
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.ensure_chart(); perform pg_temp.cek('ensure_chart staf ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('ensure_chart staf ditolak', true); end;
    execute 'reset role';
    perform pg_temp.cek('fungsi app tidak bisa dipanggil authenticated',
      not has_function_privilege('authenticated', 'app.run_recurring(uuid,date)', 'execute')
      and not has_function_privilege('authenticated', 'app.ensure_account(uuid,text,text,text,text)', 'execute'));
    perform pg_temp.cek('anon tidak bisa memanggil RPC baru', not has_function_privilege('anon', 'public.consolidated_report(uuid[],date,date)', 'execute')
      and not has_function_privilege('anon', 'public.set_budget(text,date,bigint,date)', 'execute'));
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
