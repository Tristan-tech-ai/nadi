-- Tes F4-08: identitas pemotong tervalidasi (pemilik atau akuntan); data_bpmp hanya slip disetujui dan tidak ditahan, dengan
-- status PTKP, posisi dari topi, tanpa NIK; periode draf tidak menghasilkan baris; ruang_akuntan mendaftar usaha tempat pengguna
-- anggota aktif (akuntan lebih dulu), tanpa usaha orang lain dan tanpa keanggotaan nonaktif; staf dan anon ditolak.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; pc uuid;
  ka text; kb_akuntan text; kb text; ks text; o1 uuid; o2 uuid; o_s uuid; t1 uuid; per uuid; per_draf uuid; r jsonb; e jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (uc, 'c@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Klien A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Kantor Akuntan B', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    pc := public.buat_perusahaan('Toko Lain C', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kb_akuntan := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Ani Gaji') returning id into o1;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Beni Gaji') returning id into o2;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Klien') returning id into o_s;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_akuntan_uji', 'Kasir') returning id into t1;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, mulai) values (pa, o1, t1, date '2026-01-01');
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_s;
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pa, ub, 'akuntan', true);
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pc, ub, 'admin', false);
    insert into public.orang_rahasia (orang_id, perusahaan_id, nik_hash, nik_akhir, gaji) values (o1, pa, 'hash-ani', '1234', '{"ptkp": "K/1", "pokok": 6000000}');
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, date '2026-09-01', 'disetujui') returning id into per;
    insert into public.periode_gaji (perusahaan_id, bulan, status) values (pa, date '2026-10-01', 'draf') returning id into per_draf;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen) values
      (pa, per, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 6000000, "sumber": "orang_rahasia"}, {"kode": "pph21", "label": "PPh 21", "jenis": "potongan", "nilai": 30000, "sumber": "aturan:pph21.ter"}]');
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen, ditahan, alasan_tahan) values
      (pa, per, o2, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 5000000, "sumber": "orang_rahasia"}]', true, 'Belum ada tanda hidup');

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin perform public.atur_identitas_pajak('12.345', null); perform pg_temp.cek('NPWP bukan 16 angka ditolak', false);
    exception when others then perform pg_temp.cek('NPWP bukan 16 angka ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_identitas_pajak('3172022407981234', '9999999999999999000000'); perform pg_temp.cek('ID TKU harus diawali NPWP', false);
    exception when others then perform pg_temp.cek('ID TKU harus diawali NPWP', sqlstate = '22023', sqlerrm); end;
    perform public.atur_identitas_pajak('31.720.224.0798-1234', null);
    perform pg_temp.cek('identitas: tanda baca dibuang, ID TKU bawaan NPWP + 000000',
      (select pengaturan -> 'identitas_pajak' = '{"npwp": "3172022407981234", "id_tku": "3172022407981234000000"}'::jsonb from public.perusahaan where id = pa));

    perform set_config('request.jwt.claims', kb_akuntan, true);
    perform public.atur_identitas_pajak('3172022407981234', '3172022407981234000001');
    r := public.data_bpmp(date '2026-09-15');
    perform pg_temp.cek('akuntan klien: data BPMP satu slip (yang ditahan tidak ikut), identitas terbaru', r ->> 'status' = 'disetujui'
      and jsonb_array_length(r -> 'baris') = 1 and r -> 'identitas' ->> 'id_tku' = '3172022407981234000001', left(r::text, 400));
    e := r -> 'baris' -> 0;
    perform pg_temp.cek('baris: nama, PTKP, posisi dari topi, komponen, tanpa hash NIK', e ->> 'nama' = 'Ani Gaji' and e ->> 'ptkp' = 'K/1' and e ->> 'posisi' = 'Kasir'
      and jsonb_array_length(e -> 'komponen') = 2 and e ->> 'nik_akhir' = '1234' and r::text not like '%hash-ani%', e::text);
    perform pg_temp.cek('bulan disetujui terdaftar, periode draf tanpa baris', r -> 'bulan_disetujui' = '["2026-09-01"]'::jsonb
      and jsonb_array_length(public.data_bpmp(date '2026-10-01') -> 'baris') = 0 and public.data_bpmp(date '2026-10-01') ->> 'status' = 'draf');
    r := public.ruang_akuntan();
    perform pg_temp.cek('ruang akuntan B: klien A (akuntan) lebih dulu, lalu usahanya sendiri; usaha C nonaktif tidak ikut',
      jsonb_array_length(r) = 2 and r -> 0 ->> 'nama' = 'Warung Klien A' and r -> 0 ->> 'peran' = 'akuntan' and (r -> 0 ->> 'aktif_sekarang')::boolean
      and (r -> 0 ->> 'npwp_ada')::boolean and r -> 0 ->> 'gaji_terakhir' = '2026-09-01' and (r -> 0 ->> 'gaji_draf')::int = 1
      and r -> 1 ->> 'nama' = 'Kantor Akuntan B', r::text);
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('ruang akuntan A: hanya usahanya', jsonb_array_length(public.ruang_akuntan()) = 1);

    perform set_config('request.jwt.claims', ks, true);
    begin perform public.data_bpmp(date '2026-09-01'); perform pg_temp.cek('staf tidak mengekspor bukti potong', false);
    exception when others then perform pg_temp.cek('staf tidak mengekspor bukti potong', sqlstate = '42501', sqlerrm); end;
    begin perform public.atur_identitas_pajak('3172022407981234', null); perform pg_temp.cek('staf tidak mengatur identitas', false);
    exception when others then perform pg_temp.cek('staf tidak mengatur identitas', sqlstate = '42501', sqlerrm); end;
    perform pg_temp.cek('staf: ruang akuntan kosong', public.ruang_akuntan() = '[]'::jsonb);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('B di usahanya sendiri: data BPMP tanpa baris dan tanpa data A', public.data_bpmp(date '2026-09-01')::text not like '%Ani%');
    execute 'set local role anon';
    begin perform public.ruang_akuntan(); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
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
