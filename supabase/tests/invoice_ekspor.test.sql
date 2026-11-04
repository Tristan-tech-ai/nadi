-- Tes B-EKSIM1 invoice ekspor: terbit bernomor EXP, total USD = jumlah x harga per baris dibulatkan sen, total rupiah = total USD x
-- kurs, kurs + sumber + tanggal tersimpan, packing list (berat, koli) dijumlah, jurnal 1-210 / 4-110 dalam rupiah dengan keterangan
-- USD; idempoten per kunci; validasi (Incoterms, kurs, HS, berat, koli); batal = jurnal balik + nomor batal; staf dan usaha lain
-- tidak melihat atau membuat. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  v_hari date; r jsonb; r2 jsonb; i1 uuid; k1 uuid := gen_random_uuid(); n int; x jsonb; v_rom text; inv public.invoice_ekspor;
  v_isi jsonb;
begin
  perform pg_temp.cek('tabel dan fungsi ada, tulis langsung tidak diberikan', to_regclass('public.invoice_ekspor') is not null
    and to_regprocedure('public.buat_invoice_ekspor(jsonb,uuid)') is not null
    and not has_table_privilege('authenticated', 'public.invoice_ekspor', 'insert')
    and not has_table_privilege('anon', 'public.invoice_ekspor', 'select'));

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Kopi Ekspor Uji', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Ekspor Uji B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Ekspor') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  v_hari := app.hari_ini(pa);
  v_rom := app.romawi(extract(month from v_hari)::int);
  v_isi := jsonb_build_object('alamat_penjual', 'Jl. Raya Kintamani 12, Bangli, Bali', 'pembeli', 'Harbour Roasters Pty Ltd',
    'alamat_pembeli', '18 Wharf Street, Fremantle WA 6160', 'negara', 'Australia', 'incoterm', 'FOB', 'tempat_incoterm', 'Benoa',
    'pelabuhan_muat', 'Benoa', 'pelabuhan_tujuan', 'Fremantle', 'kurs', 16287.5, 'kurs_sumber', 'KMK kurs pajak minggu ini (uji)',
    'kurs_tanggal', v_hari, 'jatuh_tempo', v_hari + 30, 'catatan', 'Payment by T/T',
    'baris', jsonb_build_array(
      jsonb_build_object('uraian', 'Arabica green beans grade 1', 'hs', '0901.11.10', 'jumlah', 1200, 'satuan', 'kg', 'harga_usd', 7.35,
                         'berat_bersih_kg', 1200, 'berat_kotor_kg', 1224.5, 'koli', 20),
      jsonb_build_object('uraian', 'Roasted beans sample', 'jumlah', 3, 'satuan', 'bag', 'harga_usd', 0.333,
                         'berat_bersih_kg', 3, 'berat_kotor_kg', 3.2, 'koli', 1)));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  -- harga 0.333 USD ditolak (lebih dari 2 angka di belakang koma)
  begin perform public.buat_invoice_ekspor(v_isi, gen_random_uuid()); perform pg_temp.cek('harga 3 desimal ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('harga 3 desimal ditolak', true); end;
  v_isi := jsonb_set(v_isi, '{baris,1,harga_usd}', '0.35');
  r := public.buat_invoice_ekspor(v_isi, k1);
  i1 := (r ->> 'id')::uuid;
  perform pg_temp.cek('nomor EXP', r ->> 'nomor' = '001/EXP/' || v_rom || '/' || extract(year from v_hari), r ->> 'nomor');
  -- 1200 x 7.35 = 8820.00; 3 x 0.35 = 1.05; total 8821.05; x 16287.5 = 143672851.875 -> 143672852
  perform pg_temp.cek('total USD', (r ->> 'total_usd')::numeric = 8821.05, r ->> 'total_usd');
  perform pg_temp.cek('total rupiah = USD x kurs dibulatkan', (r ->> 'total_rupiah')::bigint = 143672852, r ->> 'total_rupiah');
  r2 := public.buat_invoice_ekspor(v_isi, k1);
  perform pg_temp.cek('idempoten per kunci', (r2 ->> 'sudah')::boolean and r2 ->> 'id' = i1::text);
  select * into inv from public.invoice_ekspor where id = i1;
  perform pg_temp.cek('kurs dan sumber tersimpan', inv.kurs = 16287.5 and inv.kurs_sumber like 'KMK%' and inv.kurs_tanggal = v_hari and inv.mata_uang = 'USD');
  perform pg_temp.cek('packing list dijumlah', inv.berat_bersih_kg = 1203 and inv.berat_kotor_kg = 1227.7 and inv.koli = 21,
    inv.berat_bersih_kg || '/' || inv.berat_kotor_kg || '/' || inv.koli);
  perform pg_temp.cek('HS isian tersimpan apa adanya', inv.baris -> 0 ->> 'hs' = '0901.11.10' and inv.baris -> 1 ->> 'hs' is null);
  execute 'reset role';
  select jsonb_agg(jsonb_build_object('akun', a.kode, 'd', b.debit, 'k', b.kredit, 'ket', b.keterangan) order by a.kode) into x
    from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.jurnal_id = inv.jurnal_terbit;
  perform pg_temp.cek('jurnal piutang valas 1-210 / penjualan ekspor 4-110', x -> 0 ->> 'akun' = '1-210' and (x -> 0 ->> 'd')::bigint = 143672852
    and x -> 1 ->> 'akun' = '4-110' and (x -> 1 ->> 'k')::bigint = 143672852, x::text);
  perform pg_temp.cek('keterangan jurnal menyebut USD dan kurs', x -> 0 ->> 'ket' like 'USD 8821.05 x Rp16287.5 (KMK%', x -> 0 ->> 'ket');
  perform pg_temp.cek('akun bawaan lain tetap terpasang', (select count(*) from public.akun where perusahaan_id = pa) >= 19);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.buat_invoice_ekspor(jsonb_set(v_isi, '{incoterm}', '"DAT"'), gen_random_uuid()); perform pg_temp.cek('Incoterms lama DAT ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('Incoterms lama DAT ditolak', true); end;
  begin perform public.buat_invoice_ekspor(jsonb_set(v_isi, '{kurs}', '16.2875'), gen_random_uuid()); perform pg_temp.cek('kurs tidak masuk akal ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('kurs tidak masuk akal ditolak', true); end;
  begin perform public.buat_invoice_ekspor(v_isi - 'kurs_sumber', gen_random_uuid()); perform pg_temp.cek('tanpa sumber kurs ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('tanpa sumber kurs ditolak', true); end;
  begin perform public.buat_invoice_ekspor(jsonb_set(v_isi, '{kurs_tanggal}', to_jsonb(v_hari + 1)), gen_random_uuid()); perform pg_temp.cek('kurs masa depan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('kurs masa depan ditolak', true); end;
  begin perform public.buat_invoice_ekspor(jsonb_set(v_isi, '{baris,0,hs}', '"09A1"'), gen_random_uuid()); perform pg_temp.cek('HS salah bentuk ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('HS salah bentuk ditolak', true); end;
  begin perform public.buat_invoice_ekspor(jsonb_set(v_isi, '{baris,0,berat_kotor_kg}', '1000'), gen_random_uuid()); perform pg_temp.cek('berat kotor < bersih ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('berat kotor < bersih ditolak', true); end;
  begin perform public.buat_invoice_ekspor(jsonb_set(jsonb_set(v_isi, '{baris,0,koli}', '0'), '{baris,1,koli}', '0'), gen_random_uuid()); perform pg_temp.cek('tanpa koli ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('tanpa koli ditolak', true); end;

  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf tidak melihat', not exists (select 1 from public.invoice_ekspor));
  begin perform public.buat_invoice_ekspor(v_isi, gen_random_uuid()); perform pg_temp.cek('staf tidak membuat', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat', true); end;
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak melihat', not exists (select 1 from public.invoice_ekspor));
  begin perform public.batal_invoice_ekspor(i1, 'coba usaha lain'); perform pg_temp.cek('usaha lain tidak membatalkan', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak membatalkan', true); end;

  perform set_config('request.jwt.claims', ka, true);
  r := public.batal_invoice_ekspor(i1, 'Pembeli menunda pengapalan');
  perform pg_temp.cek('batal', not (r ->> 'sudah')::boolean and (select status = 'batal' from public.invoice_ekspor where id = i1));
  execute 'reset role';
  select count(*) into n from public.jurnal where perusahaan_id = pa and membalik = inv.jurnal_terbit;
  perform pg_temp.cek('batal membalik jurnal', n = 1);
  perform pg_temp.cek('nomor batal', (select status = 'batal' from public.nomor_terbit where id = inv.nomor_terbit_id));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'invoice_ekspor: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
