-- Tes M-03 siklus penjualan (supabase/migrations/20261104057000_siklus_jual.sql). Alur dihitung tangan:
-- penawaran 60.000 (4 gula @2.500 + jasa pasang 50.000) > pesanan + uang muka 20.000 > surat jalan > invoice 100% (stok 10 jadi 6,
-- HPP 4.000, uang muka dipakai 20.000) > retur 1 gula (2.500, HPP balik 1.000) > lunas dipotong PPh 23 750 (bank 36.750).
-- Akhir: piutang 1-200 = 0, uang muka 2-400 = 0, persediaan 1-300 = nilai stok 7.000. Termin 40% + 60% untuk pesanan 1.000.000.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  x uuid; r jsonb; pnw uuid; so uuid; sj uuid; inv uuid; so2 uuid; t1 uuid; t2 uuid; v_hari date;
  saldo_akun text := 'select coalesce(sum(b.debit - b.kredit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = $1 and a.kode = $2';
  n bigint;
begin
  begin
    insert into auth.users (id, email) values (ua, 'ja@uji.local'), (ub, 'jb@uji.local'), (us, 'js@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Jual', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Jual B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    x := public.simpan_produk('{"kode":"GULA","nama":"Gula 1 kg","harga_jual":2500}');
    perform public.stok_masuk(x, null, 10, 10000, v_hari, '2-100', null, null, gen_random_uuid());
    perform public.atur_bayar('00020101021153033605802ID5915TOKO UJI NADI6008DENPASAR6304ABCD', 'TOKO UJI NADI', null, null);

    r := public.buat_dokumen_jual('penawaran', null, 'Bu Rina', null, jsonb_build_array(jsonb_build_object('uraian', 'Gula 1 kg', 'jumlah', 4, 'harga', 2500, 'produk', x),
      jsonb_build_object('uraian', 'Jasa pasang', 'jumlah', 1, 'harga', 50000)), v_hari + 14, null, gen_random_uuid());
    pnw := (r ->> 'id')::uuid;
    perform pg_temp.cek('penawaran 60.000 bernomor PNW tanpa jurnal', (r ->> 'total')::bigint = 60000 and r ->> 'nomor' like '001/PNW/%'
      and not exists (select 1 from public.jurnal where perusahaan_id = pa and sumber_id = pnw::text), r::text);
    begin
      perform public.buat_dokumen_jual('surat_jalan', pnw, null, null, null, null, null, gen_random_uuid());
      perform pg_temp.cek('surat jalan dari penawaran ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('surat jalan dari penawaran ditolak', true);
    end;
    r := public.buat_dokumen_jual('pesanan', pnw, null, null, null, null, null, gen_random_uuid());
    so := (r ->> 'id')::uuid;
    perform pg_temp.cek('pesanan menyalin penawaran, penawaran berstatus diterima', (r ->> 'total')::bigint = 60000
      and (select status = 'diterima' from public.dokumen_jual where id = pnw) and (select pelanggan = 'Bu Rina' from public.dokumen_jual where id = so));
    perform public.terima_uang_muka(so, 20000, 'transfer', gen_random_uuid());
    perform pg_temp.cek('uang muka 20.000: bank naik, 2-400 kredit 20.000', (select uang_muka = 20000 from public.dokumen_jual where id = so));
    begin
      perform public.terima_uang_muka(so, 50000, 'transfer', gen_random_uuid());
      perform pg_temp.cek('uang muka melebihi total ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('uang muka melebihi total ditolak', true);
    end;
    r := public.buat_dokumen_jual('surat_jalan', so, null, null, null, null, null, gen_random_uuid());
    sj := (r ->> 'id')::uuid;
    perform pg_temp.cek('surat jalan tidak menggerakkan stok', (select jumlah = 10 from public.stok where produk_id = x));
    r := public.invoice_dari_dokumen(sj, 100, v_hari + 14, gen_random_uuid());
    inv := (r ->> 'id')::uuid;
    perform pg_temp.cek('invoice dari surat jalan: total 60.000, uang muka dipakai 20.000, sisa 40.000, stok 6',
      (r ->> 'uang_muka_dipakai')::bigint = 20000 and (r ->> 'sisa')::bigint = 40000 and (select jumlah = 6 and nilai = 6000 from public.stok where produk_id = x)
      and (select dokumen_id = sj and potong_piutang = 20000 from public.invoice where id = inv), r::text);
    perform pg_temp.cek('pesanan dan surat jalan selesai', (select bool_and(status = 'selesai') from public.dokumen_jual where id in (so, sj)));
    begin
      perform public.invoice_dari_dokumen(so, 10, v_hari + 14, gen_random_uuid());
      perform pg_temp.cek('pesanan yang sudah ditagih penuh ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('pesanan yang sudah ditagih penuh ditolak', true);
    end;

    r := public.retur_jual(inv, '[{"indeks": 1, "jumlah": 1}]', 'Satu bungkus sobek', gen_random_uuid());
    perform pg_temp.cek('retur 1 gula: nota kredit 2.500, HPP balik 1.000, stok 7 bernilai 7.000', (r ->> 'nilai')::bigint = 2500 and (r ->> 'hpp')::bigint = 1000
      and r ->> 'nomor' like '001/NK/%' and (select jumlah = 7 and nilai = 7000 from public.stok where produk_id = x), r::text);
    begin
      perform public.retur_jual(inv, '[{"indeks": 1, "jumlah": 4}]', 'Terlalu banyak', gen_random_uuid());
      perform pg_temp.cek('retur melebihi sisa baris ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('retur melebihi sisa baris ditolak', true, sqlerrm);
    end;
    r := public.lunas_dipotong(inv, 'transfer', v_hari, 750, 'pph23');
    perform pg_temp.cek('lunas dipotong PPh 23: diterima 36.750', (r ->> 'diterima')::bigint = 36750 and (select status = 'lunas' and pph_dipotong = 750 and pph_jenis = 'pph23' from public.invoice where id = inv), r::text);
    execute saldo_akun into n using pa, '1-200';
    perform pg_temp.cek('piutang 1-200 kembali 0', n = 0, n::text);
    execute saldo_akun into n using pa, '2-400';
    perform pg_temp.cek('uang muka 2-400 kembali 0', n = 0, n::text);
    execute saldo_akun into n using pa, '1-430';
    perform pg_temp.cek('PPh dipotong 1-430 = 750', n = 750, n::text);
    execute saldo_akun into n using pa, '4-200';
    perform pg_temp.cek('retur penjualan 4-200 = 2.500', n = 2500, n::text);
    execute saldo_akun into n using pa, '1-300';
    perform pg_temp.cek('persediaan 1-300 = nilai stok 7.000', n = 7000 and (select sum(nilai) from public.stok where perusahaan_id = pa) = 7000, n::text);

    -- Termin 40% + 60% untuk pesanan jasa 1.000.000.
    r := public.buat_dokumen_jual('pesanan', null, 'PT Maju', null, '[{"uraian": "Renovasi dapur", "jumlah": 1, "harga": 1000000}]', null, null, gen_random_uuid());
    so2 := (r ->> 'id')::uuid;
    r := public.invoice_dari_dokumen(so2, 40, v_hari + 30, gen_random_uuid());
    t1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('termin 40% = 400.000 dengan satu baris termin', (select total = 400000 and baris -> 0 ->> 'uraian' like 'Termin 40% dari %' from public.invoice where id = t1)
      and (select persen_ditagih = 40 and status = 'terbit' from public.dokumen_jual where id = so2));
    r := public.invoice_dari_dokumen(so2, 60, v_hari + 30, gen_random_uuid());
    t2 := (r ->> 'id')::uuid;
    perform pg_temp.cek('termin 60% = 600.000, pesanan selesai', (select total = 600000 from public.invoice where id = t2) and (select status = 'selesai' from public.dokumen_jual where id = so2));
    perform public.tandai_lunas(t1, 'tunai', null);
    perform pg_temp.cek('tandai_lunas tetap jalan: kas 400.000', (select sum(b.debit) = 400000 from public.jurnal_baris b join public.akun a on a.id = b.akun_id
      join public.invoice i on i.jurnal_lunas = b.jurnal_id where i.id = t1 and a.kode = '1-100'));
    r := public.saldo_pelanggan();
    perform pg_temp.cek('saldo pelanggan: PT Maju terbuka 1 sisa 600.000, Bu Rina terbuka 0', exists (select 1 from jsonb_array_elements(r) e where e ->> 'pelanggan' = 'PT Maju'
      and (e ->> 'terbuka')::int = 1 and (e ->> 'sisa')::bigint = 600000) and exists (select 1 from jsonb_array_elements(r) e where e ->> 'pelanggan' = 'Bu Rina' and (e ->> 'terbuka')::int = 0), r::text);
    perform pg_temp.cek('neraca tetap seimbang', (public.laporan_keuangan(date_trunc('year', v_hari)::date, v_hari) #>> '{neraca,seimbang}')::boolean);

    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.buat_dokumen_jual('penawaran', null, 'X', null, '[{"uraian": "A", "jumlah": 1, "harga": 1}]', null, null, gen_random_uuid());
      perform pg_temp.cek('staf tidak membuat penawaran', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak membuat penawaran', true);
    end;
    perform pg_temp.cek('staf tidak melihat dokumen jual', (select count(*) = 0 from public.dokumen_jual));
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat dokumen jual', (select count(*) = 0 from public.dokumen_jual) and (select count(*) = 0 from public.retur_jual));
    begin
      perform public.invoice_dari_dokumen(so, 100, v_hari + 1, gen_random_uuid());
      perform pg_temp.cek('usaha lain tidak bisa menagih pesanan usaha A', false);
    exception when sqlstate '22023' then perform pg_temp.cek('usaha lain tidak bisa menagih pesanan usaha A', true);
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
