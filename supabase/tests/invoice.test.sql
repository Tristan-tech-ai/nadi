-- Tes F4-05 invoice: terbit bernomor INV + kode verifikasi + jurnal piutang/penjualan + pengingat bertahap; idempoten per kunci;
-- validasi baris; umur piutang dan pengingat hari ini; lunas = jurnal bank/kas dan pengingat berhenti; batal = jurnal balik dan
-- nomor batal; halaman publik tanpa HP pelanggan; staf dan usaha lain tidak melihat apa pun; tujuan bayar hanya pemilik.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  v_hari date; r jsonb; r2 jsonb; i1 uuid; i2 uuid; i3 uuid; k1 uuid := gen_random_uuid(); x text; n int; v_kode text; v_nomor text; v_rom text;
  v_baris jsonb := '[{"uraian": "Nasi kotak", "jumlah": 50, "harga": 25000}, {"uraian": "Air mineral", "jumlah": 1.5, "harga": 3333}]';
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada, tulis langsung tidak diberikan', to_regclass('public.invoice') is not null
      and to_regprocedure('public.buat_invoice(text,text,jsonb,date,text,uuid)') is not null
      and not has_table_privilege('authenticated', 'public.invoice', 'insert') and not has_table_privilege('authenticated', 'public.bayar_usaha', 'update'));
    perform pg_temp.cek('hak lewat peran_aktif, bukan klaim JWT', (select bool_and(prosrc ~ 'peran_aktif|wajib_penagih' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
      where oid in ('public.buat_invoice(text,text,jsonb,date,text,uuid)'::regprocedure, 'public.atur_bayar(text,text,text,text)'::regprocedure,
                    'public.tandai_lunas(uuid,text,date)'::regprocedure, 'public.batal_invoice(uuid,text)'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Invoice', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Invoice B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Invoice') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_hari := app.hari_ini(pa);
    v_rom := app.romawi(extract(month from v_hari)::int);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.atur_bayar('00020101021153033605802ID5915WARUNG UJI NADI6008DENPASAR6304ABCD', 'WARUNG UJI NADI', null, 'BCA 1234567890 a.n. Warung Uji');
    perform pg_temp.cek('pemilik mengatur QRIS dan rekening', (select qris_nama = 'WARUNG UJI NADI' and rekening like 'BCA%' from public.bayar_usaha));

    r := public.buat_invoice('Bu Rina', '6281234567890', v_baris, v_hari + 14, 'Pesanan arisan', k1);
    i1 := (r ->> 'id')::uuid;
    v_nomor := r ->> 'nomor';
    perform pg_temp.cek('invoice terbit: total 1.255.000, nomor 001/INV/<romawi>/<tahun>, kode 12 huruf', (r ->> 'total')::bigint = 1255000
      and v_nomor = '001/INV/' || v_rom || '/' || extract(year from v_hari) and (r ->> 'kode') ~ '^[A-HJ-NP-Z2-9]{12}$', r::text);
    v_kode := r ->> 'kode';
    perform pg_temp.cek('jurnal terbit: piutang 1-200 debit dan penjualan 4-100 kredit 1.255.000',
      (select count(*) = 2 and sum(b.debit) filter (where a.kode = '1-200') = 1255000 and sum(b.kredit) filter (where a.kode = '4-100') = 1255000
         from public.jurnal_baris b join public.akun a on a.id = b.akun_id join public.invoice i on i.jurnal_terbit = b.jurnal_id where i.id = i1));
    perform pg_temp.cek('pengingat H-3, H0, H+3, H+14', (select array_agg(tanggal - (v_hari + 14) order by tahap) = array[-3, 0, 3, 14]
      from public.pengingat_invoice where invoice_id = i1));
    r2 := public.buat_invoice('Bu Rina', '6281234567890', v_baris, v_hari + 14, null, k1);
    perform pg_temp.cek('kunci sama: invoice yang sama, satu jurnal', (r2 ->> 'id')::uuid = i1 and (r2 ->> 'sudah')::boolean
      and (select count(*) from public.jurnal where sumber = 'invoice') = 1, r2::text);

    begin perform public.buat_invoice('Pak Budi', null, '[]', v_hari + 7, null, gen_random_uuid()); perform pg_temp.cek('tanpa baris ditolak', false);
    exception when others then perform pg_temp.cek('tanpa baris ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.buat_invoice('Pak Budi', null, '[{"uraian": "Kopi", "jumlah": 0, "harga": 5000}]', v_hari + 7, null, gen_random_uuid()); perform pg_temp.cek('jumlah 0 ditolak', false);
    exception when others then perform pg_temp.cek('jumlah 0 ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.buat_invoice('Pak Budi', null, '[{"uraian": "Kopi", "jumlah": 1, "harga": 0}]', v_hari + 7, null, gen_random_uuid()); perform pg_temp.cek('total Rp0 ditolak', false);
    exception when others then perform pg_temp.cek('total Rp0 ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.buat_invoice('Pak Budi', null, '[{"uraian": "Kopi", "jumlah": 1, "harga": 5000}]', v_hari - 1, null, gen_random_uuid()); perform pg_temp.cek('jatuh tempo lampau ditolak', false);
    exception when others then perform pg_temp.cek('jatuh tempo lampau ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.buat_invoice('Pak Budi', '0812', '[{"uraian": "Kopi", "jumlah": 1, "harga": 5000}]', v_hari + 1, null, gen_random_uuid()); perform pg_temp.cek('HP bukan 62... ditolak', false);
    exception when others then perform pg_temp.cek('HP bukan 62... ditolak', sqlstate = '22023', sqlerrm); end;
    perform pg_temp.cek('galat validasi tidak memakan nomor', (select count(*) from public.nomor_terbit where jenis = 'INV') = 1);

    -- Jatuh tempo hari ini: H-3 sudah lewat saat terbit jadi tidak dijadwalkan; tahap 2 (hari ini) muncul di pengingat.
    r := public.buat_invoice('Pak Budi', null, '[{"uraian": "Kopi susu", "jumlah": 10, "harga": 18000}]', v_hari, null, gen_random_uuid());
    i2 := (r ->> 'id')::uuid;
    perform pg_temp.cek('nomor urut 002', r ->> 'nomor' like '002/INV/%', r::text);
    perform pg_temp.cek('jatuh tempo hari ini: tahap 2-4 saja', (select array_agg(tahap order by tahap) = array[2, 3, 4]::smallint[] from public.pengingat_invoice where invoice_id = i2));
    r := public.buat_invoice('CV Lama', null, '[{"uraian": "Katering", "jumlah": 1, "harga": 2000000}]', v_hari + 30, null, gen_random_uuid());
    i3 := (r ->> 'id')::uuid;
    execute 'reset role';
    -- Mundurkan invoice ketiga 45 hari (data uji): jatuh tempo lewat 40 hari -> kelompok 31-60, pengingat tahap 4 (H+14) yang tiba.
    update public.invoice set tanggal = v_hari - 45, jatuh_tempo = v_hari - 40 where id = i3;
    update public.pengingat_invoice set tanggal = (v_hari - 40) + case tahap when 1 then -3 when 2 then 0 when 3 then 3 else 14 end where invoice_id = i3;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.ringkasan_invoice();
    perform pg_temp.cek('umur piutang: belum 2 invoice 1.435.000, 31-60 satu 2.000.000',
      (r -> 'umur' -> 'belum' ->> 'n')::int = 2 and (r -> 'umur' -> 'belum' ->> 'total')::bigint = 1435000
      and (r -> 'umur' -> '31-60' ->> 'total')::bigint = 2000000 and not (r -> 'umur' ? '1-30'), (r -> 'umur')::text);
    perform pg_temp.cek('pengingat hari ini: Pak Budi tahap 2 dan CV Lama hanya tahap terbaru (4), Bu Rina belum',
      jsonb_array_length(r -> 'pengingat') = 2
      and exists (select 1 from jsonb_array_elements(r -> 'pengingat') p where p ->> 'pelanggan' = 'Pak Budi' and (p ->> 'tahap')::int = 2)
      and exists (select 1 from jsonb_array_elements(r -> 'pengingat') p where p ->> 'pelanggan' = 'CV Lama' and (p ->> 'tahap')::int = 4), (r -> 'pengingat')::text);
    perform public.catat_pengingat((select (p ->> 'id')::uuid from jsonb_array_elements(r -> 'pengingat') p where p ->> 'pelanggan' = 'Pak Budi'));
    perform pg_temp.cek('pengingat dicatat terkirim, hilang dari daftar hari ini', (select status = 'dikirim' and dikirim_at is not null from public.pengingat_invoice where invoice_id = i2 and tahap = 2)
      and jsonb_array_length(public.ringkasan_invoice() -> 'pengingat') = 1);

    begin perform public.tandai_lunas(i2, 'qris', v_hari + 1); perform pg_temp.cek('tanggal bayar masa depan ditolak', false);
    exception when others then perform pg_temp.cek('tanggal bayar masa depan ditolak', sqlstate = '22023', sqlerrm); end;
    perform public.tandai_lunas(i2, 'qris', null);
    perform pg_temp.cek('lunas lewat QRIS: jurnal bank 1-110 debit, piutang 1-200 kredit 180.000; pengingat sisa tidak perlu',
      (select i.status = 'lunas' and i.lunas_cara = 'qris' from public.invoice i where i.id = i2)
      and (select sum(b.debit) filter (where a.kode = '1-110') = 180000 and sum(b.kredit) filter (where a.kode = '1-200') = 180000
             from public.jurnal_baris b join public.akun a on a.id = b.akun_id join public.invoice i on i.jurnal_lunas = b.jurnal_id where i.id = i2)
      and not exists (select 1 from public.pengingat_invoice where invoice_id = i2 and status = 'jadwal'));
    perform pg_temp.cek('lunas dua kali: idempoten', (public.tandai_lunas(i2, 'tunai', null) ->> 'sudah')::boolean
      and (select count(*) from public.jurnal where kunci_idempoten = 'invoice-lunas:' || i2) = 1);
    begin perform public.batal_invoice(i2, 'salah ketik'); perform pg_temp.cek('invoice lunas tidak bisa dibatalkan', false);
    exception when others then perform pg_temp.cek('invoice lunas tidak bisa dibatalkan', sqlstate = '22023', sqlerrm); end;
    perform public.batal_invoice(i3, 'Pesanan dibatalkan pelanggan');
    perform pg_temp.cek('batal: jurnal terbit dibalik, nomor batal, pengingat berhenti',
      (select i.status = 'batal' from public.invoice i where i.id = i3)
      and (select j.dibalik_oleh is not null from public.jurnal j join public.invoice i on i.jurnal_terbit = j.id where i.id = i3)
      and (select n.status = 'batal' from public.nomor_terbit n join public.invoice i on i.nomor_terbit_id = n.id where i.id = i3)
      and not exists (select 1 from public.pengingat_invoice where invoice_id = i3 and status = 'jadwal'));
    perform pg_temp.cek('saldo piutang 1-200 = invoice terbit belum lunas (1.255.000)',
      (select sum(b.debit) - sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where a.kode = '1-200' and b.perusahaan_id = pa) = 1255000);

    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf tidak melihat invoice dan tujuan bayar', (select count(*) from public.invoice) = 0 and (select count(*) from public.bayar_usaha) = 0);
    begin perform public.buat_invoice('X', null, v_baris, v_hari + 1, null, gen_random_uuid()); perform pg_temp.cek('staf tidak membuat invoice', false);
    exception when others then perform pg_temp.cek('staf tidak membuat invoice', sqlstate = '42501', sqlerrm); end;

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat invoice', (select count(*) from public.invoice) = 0 and (select count(*) from public.pengingat_invoice) = 0);
    begin perform public.tandai_lunas(i1, 'tunai', null); perform pg_temp.cek('usaha lain tidak bisa melunasi', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa melunasi', sqlstate = 'P0002', sqlerrm); end;

    execute 'set local role anon';
    r := public.invoice_publik(lower(v_kode));
    perform pg_temp.cek('publik lewat kode: usaha, nomor, total, QRIS; tanpa HP pelanggan', r ->> 'usaha' = 'Warung Uji Invoice' and r ->> 'nomor' = v_nomor
      and (r ->> 'total')::bigint = 1255000 and r ->> 'qris_nama' = 'WARUNG UJI NADI' and not (r ? 'pelanggan_hp') and r::text not like '%6281234567890%', r::text);
    perform pg_temp.cek('kode tak dikenal: null', public.invoice_publik('ABCDEFGHJKLM') is null);
    begin perform public.ringkasan_invoice(); perform pg_temp.cek('anon tidak memanggil ringkasan', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil ringkasan', sqlstate = '42501', sqlerrm); end;
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
