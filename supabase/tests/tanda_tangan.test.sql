-- Tes M-17 dokumen dan tanda tangan (supabase/migrations/20261105080000_tanda_tangan.sql): sidik dibekukan saat dikirim, isi tidak
-- bisa diubah, isi yang diubah diam-diam atau salinan berbeda = verifikasi gagal, jejak bukti berantai (diubah = rantai putus),
-- penanda tangan berurutan dengan token sekali pakai, nama + persetujuan, kedaluwarsa, tolak, wajib meterai UU 10/2020, templat
-- massal, pengingat, peran, isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid; v_hari date;
  d1 uuid; d2 uuid; d3 uuid; r jsonb; t1 text; t2 text; kode text; sid text; v_isi text := 'Perjanjian kerja sama penjualan kopi antara Toko Uji dan CV Maju. Harga Rp45.000 per kg.';
  tp uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'tt.a@uji.local'), (ub, 'tt.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Tanda', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Tanda', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Tanda') returning id into o_s;
    perform public.buat_akun_staf(o_s, '676767');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    v_hari := app.hari_ini(pa);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    d1 := public.save_sign_document('Perjanjian kerja sama kopi', v_isi, 'perjanjian', 12000000, true, v_hari + 20, 30, 14,
            '[{"nama": "Rina Wulandari", "kontak": "0812-1111-2222"}, {"nama": "Bagus Pratama"}]');
    perform pg_temp.cek('draf belum punya sidik', (select sidik is null and status = 'draf' from public.sign_document where id = d1));
    r := public.send_sign_document(d1);
    t1 := r -> 'penanda' -> 0 ->> 'token';
    t2 := r -> 'penanda' -> 1 ->> 'token';
    kode := r ->> 'kode';
    sid := r ->> 'sidik';
    perform pg_temp.cek('kirim: sidik sha256 isi, 2 token, penanda 1 aktif', sid = encode(extensions.digest(convert_to(v_isi, 'UTF8'), 'sha256'), 'hex')
      and t1 ~ '^[0-9a-f]{48}$' and t2 ~ '^[0-9a-f]{48}$' and (select status from public.sign_signer where document_id = d1 and urutan = 1) = 'aktif', r::text);
    begin perform token_hash from public.sign_signer limit 1; perform pg_temp.cek('kolom token_hash tidak terbaca aplikasi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('kolom token_hash tidak terbaca aplikasi', true); end;
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.save_sign_document('Coba staf', 'Isi dokumen percobaan staf', 'lain', null, false, null, 30, 14, '[{"nama": "X Y"}]'); perform pg_temp.cek('staf tidak membuat dokumen', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat dokumen', true); end;
    perform pg_temp.cek('staf tidak melihat dokumen', (select count(*) from public.sign_document) = 0);
    execute 'reset role';

    -- Isi beku setelah dikirim.
    begin update public.sign_document set isi = isi || ' Diskon 50%.' where id = d1; perform pg_temp.cek('isi dokumen terkirim tidak bisa diubah', false);
    exception when sqlstate '42501' then perform pg_temp.cek('isi dokumen terkirim tidak bisa diubah', true); end;

    -- Penanda tangan (tanpa akun).
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "UjiBrowser/1.0"}', true);
    r := public.sign_view(t2);
    perform pg_temp.cek('penanda 2 bisa melihat tetapi belum giliran', not (r ->> 'giliran')::boolean and r ->> 'saya' = 'Bagus Pratama' and (r ->> 'butuh_meterai')::boolean, r::text);
    begin perform public.sign_document(t2, 'Bagus Pratama', true); perform pg_temp.cek('penanda 2 tidak bisa mendahului', false);
    exception when sqlstate '22023' then perform pg_temp.cek('penanda 2 tidak bisa mendahului', true); end;
    r := public.sign_view(t1);
    perform pg_temp.cek('penanda 1 giliran', (r ->> 'giliran')::boolean and r ->> 'sidik' = sid, r::text);
    begin perform public.sign_document(t1, 'Rina', true); perform pg_temp.cek('nama berbeda ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('nama berbeda ditolak', true); end;
    begin perform public.sign_document(t1, 'Rina Wulandari', false); perform pg_temp.cek('tanpa centang setuju ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tanpa centang setuju ditolak', true); end;
    r := public.sign_document(t1, '  rina   wulandari ', true);
    perform pg_temp.cek('penanda 1 menandatangani (nama tanpa beda huruf/spasi), dokumen belum selesai', not (r ->> 'selesai')::boolean, r::text);
    begin perform public.sign_document(t1, 'Rina Wulandari', true); perform pg_temp.cek('token sekali pakai', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('token sekali pakai', true); end;
    r := public.sign_document(t2, 'Bagus Pratama', true);
    perform pg_temp.cek('penanda 2 menandatangani, dokumen selesai', (r ->> 'selesai')::boolean, r::text);
    r := public.verify_sign(kode);
    perform pg_temp.cek('verifikasi: selesai, tidak tersertifikasi, isi utuh, rantai utuh, cap, wajib meterai',
      r ->> 'status' = 'selesai' and r ->> 'jenis_tanda_tangan' = 'tidak_tersertifikasi' and (r ->> 'isi_utuh')::boolean and (r ->> 'rantai_utuh')::boolean
      and (r ->> 'cap')::boolean and (r ->> 'butuh_meterai')::boolean and r -> 'penanda' -> 1 ->> 'waktu' is not null, r::text);
    perform pg_temp.cek('jejak: dibuat, dikirim, dibuka, ditandatangani 2x, selesai', (select array_agg(e ->> 'jenis') from jsonb_array_elements(r -> 'jejak') e)
      @> array['dibuat', 'dikirim', 'dibuka', 'ditandatangani', 'selesai'] and (select count(*) from jsonb_array_elements(r -> 'jejak') e where e ->> 'jenis' = 'ditandatangani') = 2, r::text);
    perform pg_temp.cek('salinan sama: cocok; salinan diubah satu huruf: tidak cocok',
      (public.verify_sign(kode, sid) ->> 'salinan_cocok')::boolean
      and not (public.verify_sign(kode, encode(extensions.digest(convert_to(replace(v_isi, '45.000', '40.000'), 'UTF8'), 'sha256'), 'hex')) ->> 'salinan_cocok')::boolean);
    execute 'reset role';
    perform pg_temp.cek('jejak menyimpan IP pertama dan perangkat', exists (select 1 from public.sign_event where document_id = d1 and jenis = 'ditandatangani' and ip = '203.0.113.7' and perangkat = 'UjiBrowser/1.0'));

    -- Pemalsuan: isi diubah lewat jalur di luar aplikasi (trigger dimatikan) dan jejak diubah langsung.
    alter table public.sign_document disable trigger jaga_sign_document;
    update public.sign_document set isi = replace(isi, '45.000', '40.000') where id = d1;
    alter table public.sign_document enable trigger jaga_sign_document;
    perform pg_temp.cek('isi diubah diam-diam: verifikasi isi_utuh gagal', not (public.verify_sign(kode) ->> 'isi_utuh')::boolean);
    update public.sign_event set ip = '198.51.100.1' where document_id = d1 and jenis = 'dibuka';
    perform pg_temp.cek('jejak diubah: rantai putus', not (public.verify_sign(kode) ->> 'rantai_utuh')::boolean);

    -- Meterai menurut UU 10/2020.
    perform pg_temp.cek('kuitansi Rp5.000.000 tidak wajib meterai, Rp5.000.001 wajib, pernyataan wajib',
      not app.sign_butuh_meterai('kuitansi', 5000000) and app.sign_butuh_meterai('kuitansi', 5000001) and app.sign_butuh_meterai('pernyataan', null)
      and not app.sign_butuh_meterai('lain', 99000000));

    -- Kedaluwarsa, tolak, batal.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    d2 := public.save_sign_document('Surat pernyataan', 'Saya menyatakan menerima barang dalam keadaan baik.', 'pernyataan', null, false, null, 30, 1, '[{"nama": "Dedi Kurnia"}]');
    t1 := public.send_sign_document(d2) -> 'penanda' -> 0 ->> 'token';
    d3 := public.save_sign_document('Kuitansi uang muka', 'Telah diterima uang muka sebesar Rp6.000.000 untuk pesanan seragam.', 'kuitansi', 6000000, false, null, 30, 14, '[{"nama": "Sari Dewi"}]');
    t2 := public.send_sign_document(d3) -> 'penanda' -> 0 ->> 'token';
    execute 'reset role';
    update public.sign_document set kedaluwarsa_at = now() - interval '1 hour' where id = d2;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    begin perform public.sign_document(t1, 'Dedi Kurnia', true); perform pg_temp.cek('tautan kedaluwarsa ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('tautan kedaluwarsa ditolak', true); end;
    perform public.decline_sign(t2, 'Nominal salah, seharusnya Rp5.000.000');
    begin perform public.sign_view(t2); perform pg_temp.cek('setelah ditolak tautan tidak berlaku', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('setelah ditolak tautan tidak berlaku', true); end;
    begin perform count(*) from public.sign_document; perform pg_temp.cek('anon tidak membaca tabel dokumen', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak membaca tabel dokumen', true); end;
    execute 'reset role';
    perform pg_temp.cek('dokumen ditolak tercatat dengan alasan', (select status = 'ditolak' from public.sign_document where id = d3)
      and (select alasan like 'Nominal salah%' from public.sign_signer where document_id = d3));

    -- Templat massal, pengingat, isolasi.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    tp := public.save_sign_template('Pernyataan kerahasiaan {nama}', 'Saya, {nama}, menyatakan menjaga kerahasiaan data pelanggan Toko Uji.', 'pernyataan');
    r := public.send_from_template(tp, '[{"nama": "Andi Saputra"}, {"nama": "Budi Santoso", "kontak": "0813-0000-1111"}]', false, null);
    perform pg_temp.cek('kirim massal: 2 dokumen dengan nama diganti, masing-masing bertoken', jsonb_array_length(r) = 2
      and (select count(*) from public.sign_document where judul = 'Pernyataan kerahasiaan Budi Santoso' and isi like 'Saya, Budi Santoso,%' and status = 'dikirim') = 1
      and r -> 0 ->> 'token' ~ '^[0-9a-f]{48}$', r::text);
    execute 'reset role';
    update public.sign_document set dikirim_at = now() - interval '3 days' where judul = 'Pernyataan kerahasiaan Andi Saputra';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.sign_reminders();
    perform pg_temp.cek('pengingat: Andi tertunda 3 hari; kontrak selesai berakhir 20 hari lagi',
      exists (select 1 from jsonb_array_elements(r -> 'tertunda') e where e ->> 'nama' = 'Andi Saputra')
      and exists (select 1 from jsonb_array_elements(r -> 'berakhir') e where e ->> 'judul' = 'Perjanjian kerja sama kopi' and (e ->> 'sisa_hari')::int = 20), r::text);
    perform public.cancel_sign_document((select id from public.sign_document where judul = 'Pernyataan kerahasiaan Budi Santoso'));
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat dokumen, penanda, jejak', (select count(*) from public.sign_document) = 0
      and (select count(*) from public.sign_signer) = 0 and (select count(*) from public.sign_event) = 0);
    begin perform public.send_sign_document(d1); perform pg_temp.cek('usaha lain tidak mengirim dokumen A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengirim dokumen A', true); end;
    execute 'reset role';
    perform pg_temp.cek('fungsi app tidak untuk anon/authenticated', not has_function_privilege('anon', 'app.sign_catat(uuid,uuid,uuid,text,text)', 'execute')
      and not has_function_privilege('authenticated', 'app.sign_kirim(uuid,uuid)', 'execute')
      and not has_function_privilege('anon', 'public.send_sign_document(uuid)', 'execute'));
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
