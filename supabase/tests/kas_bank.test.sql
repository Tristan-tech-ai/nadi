-- Tes M-05 kas dan bank (supabase/migrations/20261104059000_kas_bank.sql). Alur dihitung tangan:
-- setoran modal 1.000.000 ke Bank > rekening BCA baru (1-111) > pindah 400.000 Bank ke BCA > mutasi BCA 5 baris:
-- (1) CR 1.240.000 menyebut invoice 1.245.000 (potong biaya transfer 5.000), (2) DB 250.000 ke UD Maju (tagihan 250.000),
-- (3) DB 6.500 BIAYA ADM (aturan ke 6-910), (4) CR 400.000 setoran = jurnal pindah dana yang sudah ada, (5) DB 99.000 diabaikan.
-- Saldo BCA akhir = 400.000 + 1.240.000 - 250.000 - 6.500 = 1.383.500; Bank 1-110 = 600.000 (lunas dan bayar dipindah ke BCA).
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  r jsonb; v_hari date; bank uuid; bca uuid; inv uuid; v_nomor text; tg uuid; jpindah uuid; m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid; u uuid; n bigint;
  saldo text := 'select coalesce(sum(b.debit - b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = $1 and a.kode = $2';
  baris jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ka@uji.local'), (ub, 'kb@uji.local'), (us, 'ks@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Kas', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Kas B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.daftar_rekening();
    perform pg_temp.cek('rekening bawaan Kas 1-100 dan Bank 1-110', jsonb_array_length(r) = 2 and r -> 0 ->> 'akun' = '1-100' and r -> 1 ->> 'akun' = '1-110', r::text);
    bank := (r -> 1 ->> 'id')::uuid;
    r := public.simpan_rekening('BCA usaha', 'bank', '1234');
    bca := (r ->> 'id')::uuid;
    perform pg_temp.cek('rekening baru mendapat akun 1-111', r ->> 'akun' = '1-111', r::text);
    perform public.catat_kas(bank, 'masuk', 1000000, '3-100', v_hari, 'Setoran modal awal', gen_random_uuid());
    r := public.transfer_kas(bank, bca, 400000, v_hari, null, gen_random_uuid());
    jpindah := (r ->> 'id')::uuid;
    execute saldo into n using pa, '1-110';
    perform pg_temp.cek('Bank 600.000 setelah setoran dan pindah dana', n = 600000, n::text);
    execute saldo into n using pa, '1-111';
    perform pg_temp.cek('BCA 400.000 setelah pindah dana', n = 400000, n::text);
    begin
      perform public.transfer_kas(bank, bank, 1, v_hari, null, gen_random_uuid());
      perform pg_temp.cek('pindah ke rekening yang sama ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('pindah ke rekening yang sama ditolak', true);
    end;

    r := public.buat_invoice('Kafe Senja', null, '[{"uraian": "Kopi bubuk 5 kg", "jumlah": 1, "harga": 1245000}]', v_hari + 14, null, gen_random_uuid());
    inv := (r ->> 'id')::uuid; v_nomor := r ->> 'nomor';
    r := public.buat_tagihan_beli('UD Maju', 'MJ-1', v_hari, v_hari + 30, 250000, null, null, gen_random_uuid());
    tg := (r ->> 'id')::uuid;
    perform public.simpan_aturan_rekon(null, 'biaya adm', 'DB', '6-300', true);
    baris := jsonb_build_array(
      jsonb_build_object('tanggal', v_hari, 'keterangan', 'TRSF E-BANKING CR KAFE SENJA ' || v_nomor, 'jumlah', 1240000, 'arah', 'CR'),
      jsonb_build_object('tanggal', v_hari, 'keterangan', 'TRSF E-BANKING DB UD MAJU', 'jumlah', 250000, 'arah', 'DB'),
      jsonb_build_object('tanggal', v_hari, 'keterangan', 'BIAYA ADM', 'jumlah', 6500, 'arah', 'DB'),
      jsonb_build_object('tanggal', v_hari, 'keterangan', 'SETORAN DARI REK BANK', 'jumlah', 400000, 'arah', 'CR'),
      jsonb_build_object('tanggal', v_hari, 'keterangan', 'TARIK TUNAI ATM', 'jumlah', 99000, 'arah', 'DB'),
      jsonb_build_object('tanggal', 'bukan', 'keterangan', 'X', 'jumlah', 1, 'arah', 'CR'));
    r := public.impor_mutasi(bca, baris);
    perform pg_temp.cek('impor 5 baris, 1 rusak dilewati', (r ->> 'masuk')::int = 5 and (r ->> 'dilewati')::int = 1, r::text);
    r := public.impor_mutasi(bca, baris || jsonb_build_array(jsonb_build_object('tanggal', v_hari, 'keterangan', 'BIAYA ADM', 'jumlah', 6500, 'arah', 'DB')));
    perform pg_temp.cek('impor ulang tidak menggandakan, baris kembar kedua tetap masuk', (r ->> 'masuk')::int = 1 and (r ->> 'ganda')::int = 5, r::text);
    select id into m1 from public.mutasi_bank where rekening_id = bca and jumlah = 1240000;
    select id into m2 from public.mutasi_bank where rekening_id = bca and jumlah = 250000;
    select id into m3 from public.mutasi_bank where rekening_id = bca and jumlah = 6500 order by sidik limit 1;
    select id into m4 from public.mutasi_bank where rekening_id = bca and jumlah = 400000;
    select id into m5 from public.mutasi_bank where rekening_id = bca and jumlah = 99000;

    r := public.jurnal_kas_terbuka(bca, v_hari - 7, v_hari);
    perform pg_temp.cek('jurnal pindah dana tampil sebagai kandidat tercatat', exists (select 1 from jsonb_array_elements(r) e where e ->> 'id' = jpindah::text and e ->> 'arah' = 'CR' and (e ->> 'jumlah')::bigint = 400000), r::text);

    perform public.rekonsiliasi(m1, 'invoice', inv::text, 'nomor invoice disebut');
    perform pg_temp.cek('invoice lunas lewat rekonsiliasi', (select status = 'lunas' from public.invoice where id = inv));
    execute saldo into n using pa, '6-910';
    perform pg_temp.cek('potongan transfer 5.000 jadi biaya bank', n = 5000, n::text);
    perform public.rekonsiliasi(m2, 'tagihan_beli', tg::text, 'nama pemasok dan nominal sama');
    perform pg_temp.cek('tagihan pemasok lunas lewat rekonsiliasi', (select status = 'lunas' from public.tagihan_beli where id = tg));
    perform public.rekonsiliasi(m3, 'akun', '6-300', 'aturan BIAYA ADM');
    perform public.rekonsiliasi(m4, 'jurnal', jpindah::text, 'sudah tercatat');
    begin
      perform public.rekonsiliasi(m5, 'jurnal', jpindah::text, 'coba lagi');
      perform pg_temp.cek('jurnal yang sudah dicocokkan ditolak untuk mutasi lain', false);
    exception when sqlstate '22023' or sqlstate '23505' then perform pg_temp.cek('jurnal yang sudah dicocokkan ditolak untuk mutasi lain', true);
    end;
    perform public.rekonsiliasi(m5, 'abaikan', null, 'tarik tunai pribadi, dicatat terpisah');
    execute saldo into n using pa, '1-111';
    perform pg_temp.cek('saldo BCA = 1.383.500 setelah rekonsiliasi', n = 1383500, n::text);
    execute saldo into n using pa, '1-110';
    perform pg_temp.cek('Bank bawaan tetap 600.000 (lunas dan bayar dipindah ke BCA)', n = 600000, n::text);
    r := public.jurnal_kas_terbuka(bca, v_hari - 7, v_hari);
    perform pg_temp.cek('tidak ada jurnal BCA terbuka setelah semua dicocokkan', jsonb_array_length(r) = 0, r::text);
    r := public.daftar_rekening();
    perform pg_temp.cek('daftar rekening: BCA saldo 1.383.500 dan 1 mutasi belum (kembar kedua)', exists (select 1 from jsonb_array_elements(r) e
      where e ->> 'id' = bca::text and (e ->> 'saldo')::bigint = 1383500 and (e ->> 'belum')::int = 1), r::text);

    begin
      perform public.batal_rekonsiliasi(m1, 'salah cocok');
      perform pg_temp.cek('batal rekonsiliasi invoice ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('batal rekonsiliasi invoice ditolak', true);
    end;
    perform public.batal_rekonsiliasi(m3, 'akun salah');
    execute saldo into n using pa, '1-111';
    perform pg_temp.cek('batal rekonsiliasi akun: jurnal dibalik, BCA 1.390.000, mutasi belum', n = 1390000 and (select status = 'belum' from public.mutasi_bank where id = m3), n::text);
    perform public.rekonsiliasi(m3, 'akun', '6-900', 'biaya administrasi');
    perform pg_temp.cek('mutasi yang dibatalkan bisa dicocokkan lagi', (select status = 'cocok' and cocok_id = '6-900' from public.mutasi_bank where id = m3));

    -- E-statement lewat Lempar: usulan uang.mutasi disetujui masuk ke rekening bank pertama (Bank 1-110).
    execute 'reset role';
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, kunci_klien) values (pa, 'lempar', 'uang.mutasi', 'Cocokkan 2 transaksi rekening',
      jsonb_build_object('jenis', 'mutasi', 'bidang', jsonb_build_object('baris', jsonb_build_array(
        jsonb_build_object('tanggal', v_hari, 'keterangan', 'QRIS SETTLEMENT', 'jumlah', 68000, 'arah', 'CR', 'saldo', 1),
        jsonb_build_object('tanggal', v_hari, 'keterangan', 'BIAYA ADM', 'jumlah', 6500, 'arah', 'DB', 'saldo', 1)))), gen_random_uuid()) returning id into u;
    update public.usulan set status = 'diterima', diputuskan_oleh = ua, diputuskan_at = now() where id = u;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('e-statement Lempar disetujui: 2 mutasi masuk ke Bank', (select count(*) = 2 from public.mutasi_bank where rekening_id = bank and usulan_id = u));
    perform pg_temp.cek('neraca tetap seimbang', (public.laporan_keuangan(date_trunc('year', v_hari)::date, v_hari) #>> '{neraca,seimbang}')::boolean);

    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.daftar_rekening();
      perform pg_temp.cek('staf tidak melihat kas dan bank', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak melihat kas dan bank', true);
    end;
    perform pg_temp.cek('staf tidak membaca mutasi', (select count(*) = 0 from public.mutasi_bank));
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak membaca mutasi dan rekening usaha A', (select count(*) = 0 from public.mutasi_bank)
      and (select count(*) = 0 from public.rekening_kas where perusahaan_id = pa));
    begin
      perform public.rekonsiliasi(m5, 'abaikan', null, 'x');
      perform pg_temp.cek('usaha lain tidak bisa merekonsiliasi mutasi usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa merekonsiliasi mutasi usaha A', true);
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
