-- Tes M-04 siklus pembelian (supabase/migrations/20261104058000_siklus_beli.sql). Alur dihitung tangan:
-- PR > PO UD Sumber Rejeki 10 gula @1.200 + ongkos 20.000 (32.000) > penerimaan: stok 10 bernilai 12.000, 1-300 / 2-150 12.000
-- > tagihan 33.000 (three-way: 2-150 12.000 + 6-900 20.000 + selisih 1.000) > bayar sebagian 10.000 > retur 2 gula @1.200 (2.400)
-- > bayar sisa 20.600 > lunas. Hutang 2-100 = sisa tagihan terbuka di setiap langkah, akhirnya 0; 2-150 = 0; stok 8 bernilai 9.600.
-- Nota Lempar dari pemasok yang sama menyebut PO; nota disetujui menjadi tagihan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  x uuid; r jsonb; pr uuid; po uuid; grn uuid; tg uuid; u uuid; v_hari date; n bigint;
  saldo_akun text := 'select coalesce(sum(b.kredit - b.debit), 0) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = $1 and a.kode = $2';
begin
  begin
    insert into auth.users (id, email) values (ua, 'ba@uji.local'), (ub, 'bb@uji.local'), (us, 'bs@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Beli', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Beli B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, us, 'staf');
    v_hari := app.hari_ini(pa);
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    x := public.simpan_produk('{"kode":"GULA","nama":"Gula 1 kg","harga_jual":2500}');
    r := public.buat_dokumen_beli('permintaan', null, 'UD Sumber Rejeki', jsonb_build_array(jsonb_build_object('uraian', 'Gula 1 kg', 'jumlah', 10, 'harga', 1200, 'produk', x),
      jsonb_build_object('uraian', 'Ongkos kirim', 'jumlah', 1, 'harga', 20000)), null, gen_random_uuid());
    pr := (r ->> 'id')::uuid;
    perform pg_temp.cek('permintaan 32.000 bernomor PR tanpa jurnal', (r ->> 'total')::bigint = 32000 and r ->> 'nomor' like '001/PR/%'
      and not exists (select 1 from public.jurnal where perusahaan_id = pa), r::text);
    begin
      perform public.buat_dokumen_beli('penerimaan', pr, null, null, null, gen_random_uuid());
      perform pg_temp.cek('penerimaan dari permintaan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('penerimaan dari permintaan ditolak', true);
    end;
    r := public.buat_dokumen_beli('pesanan_beli', pr, null, null, null, gen_random_uuid());
    po := (r ->> 'id')::uuid;
    perform pg_temp.cek('PO menyalin permintaan, permintaan selesai', (select status = 'selesai' from public.dokumen_beli where id = pr) and r ->> 'nomor' like '001/PO/%');

    -- Nota Lempar dari pemasok yang sama: penjelasan menyebut PO dan selisihnya.
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, kunci_klien)
    values (pa, 'lempar', 'uang.keluar', 'Catat belanja', 'Dari nota.', jsonb_build_object('jenis', 'nota', 'bidang',
      jsonb_build_object('pemasok', 'UD Sumber Rejeki', 'nomor', 'NT-1', 'tanggal', v_hari::text, 'total', 33000)), gen_random_uuid()) returning id into u;
    perform pg_temp.cek('usulan nota menyebut PO dan selisih Rp1.000', (select penjelasan like '%Cocok dengan 001/PO/%selisih Rp1.000%' from public.usulan where id = u),
      (select penjelasan from public.usulan where id = u));

    r := public.buat_dokumen_beli('penerimaan', po, null, null, null, gen_random_uuid());
    grn := (r ->> 'id')::uuid;
    perform pg_temp.cek('penerimaan: stok 10 bernilai 12.000, 2-150 kredit 12.000', (r ->> 'nilai_stok')::bigint = 12000
      and (select jumlah = 10 and nilai = 12000 from public.stok where produk_id = x), r::text);
    execute saldo_akun into n using pa, '2-150';
    perform pg_temp.cek('2-150 barang diterima belum ditagih = 12.000', n = 12000, n::text);
    r := public.buat_tagihan_beli(null, 'INV-UD-77', v_hari, v_hari + 30, 33000, grn, null, gen_random_uuid());
    tg := (r ->> 'id')::uuid;
    perform pg_temp.cek('tagihan three-way: selisih 1.000 dari PO 32.000', (r ->> 'selisih')::bigint = 1000, r::text);
    execute saldo_akun into n using pa, '2-150';
    perform pg_temp.cek('2-150 kembali 0 setelah ditagih', n = 0, n::text);
    execute saldo_akun into n using pa, '2-100';
    perform pg_temp.cek('hutang 2-100 = 33.000', n = 33000, n::text);
    begin
      perform public.buat_tagihan_beli(null, 'X', v_hari, v_hari, 1000, grn, null, gen_random_uuid());
      perform pg_temp.cek('penerimaan yang sudah ditagih ditolak', false);
    exception when unique_violation then perform pg_temp.cek('penerimaan yang sudah ditagih ditolak', true);
    end;
    r := public.bayar_tagihan_beli(tg, 10000, 'transfer', v_hari, gen_random_uuid());
    perform pg_temp.cek('bayar sebagian 10.000: sisa 23.000, masih terbuka', (r ->> 'sisa')::bigint = 23000 and (select status = 'terbuka' from public.tagihan_beli where id = tg));
    begin
      perform public.bayar_tagihan_beli(tg, 50000, 'transfer', v_hari, gen_random_uuid());
      perform pg_temp.cek('bayar melebihi sisa ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('bayar melebihi sisa ditolak', true);
    end;
    r := public.retur_beli(tg, x, 2, 1200, 'Dua bungkus sobek', gen_random_uuid());
    perform pg_temp.cek('retur 2 gula: nota debit 2.400, stok 8 bernilai 9.600', (r ->> 'nilai')::bigint = 2400 and r ->> 'nomor' like '001/ND/%'
      and (select jumlah = 8 and nilai = 9600 from public.stok where produk_id = x), r::text);
    execute saldo_akun into n using pa, '2-100';
    perform pg_temp.cek('hutang 2-100 = sisa 20.600', n = 20600 and (select total - terbayar - dikurangi = 20600 from public.tagihan_beli where id = tg), n::text);
    perform public.bayar_tagihan_beli(tg, 20600, 'tunai', v_hari, gen_random_uuid());
    perform pg_temp.cek('bayar sisa: tagihan lunas', (select status = 'lunas' from public.tagihan_beli where id = tg));
    execute saldo_akun into n using pa, '2-100';
    perform pg_temp.cek('hutang 2-100 kembali 0', n = 0, n::text);

    -- Nota disetujui menjadi tagihan (hutang) tanpa PO.
    execute 'reset role';
    update public.usulan set status = 'diterima', diputuskan_oleh = ua, diputuskan_at = now() where id = u;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('nota disetujui jadi tagihan 33.000 akun 6-900', (select total = 33000 and akun_beban = '6-900' and status = 'terbuka' from public.tagihan_beli where usulan_id = u));
    execute saldo_akun into n using pa, '2-100';
    perform pg_temp.cek('hutang 2-100 = tagihan nota 33.000 = saldo pemasok', n = 33000 and exists (select 1 from jsonb_array_elements(public.saldo_pemasok()) e
      where e ->> 'pemasok' = 'UD Sumber Rejeki' and (e ->> 'sisa')::bigint = 33000), n::text);
    perform pg_temp.cek('neraca tetap seimbang', (public.laporan_keuangan(date_trunc('year', v_hari)::date, v_hari) #>> '{neraca,seimbang}')::boolean);

    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.buat_dokumen_beli('permintaan', null, 'X', '[{"uraian": "A", "jumlah": 1, "harga": 1}]', null, gen_random_uuid());
      perform pg_temp.cek('staf tidak membuat permintaan', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak membuat permintaan', true);
    end;
    perform pg_temp.cek('staf tidak melihat tagihan pemasok', (select count(*) = 0 from public.tagihan_beli));
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat pembelian', (select count(*) = 0 from public.dokumen_beli) and (select count(*) = 0 from public.tagihan_beli));
    begin
      perform public.bayar_tagihan_beli(tg, 1, 'tunai', v_hari, gen_random_uuid());
      perform pg_temp.cek('usaha lain tidak bisa membayar tagihan usaha A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa membayar tagihan usaha A', true);
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
