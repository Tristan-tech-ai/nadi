-- Tes B-EKSIM3 jurnal PIB: usulan uang.impor yang disetujui memposting jurnal seimbang (persediaan, PPN masukan impor, PPh 22
-- impor dibayar di muka / utang pemasok valas, bank); angka sama dengan contoh jurnalPib di apps/web/src/lib/pabean.test.ts;
-- tanggal = tanggal pendaftaran PIB (masa depan -> hari ini); ditolak atau tanpa nilai = tanpa jurnal; sekali saja. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; u1 uuid; u2 uuid; u3 uuid; u4 uuid; j public.jurnal; x jsonb; n int; v_hari date;
  b jsonb := '{"nomor_daftar": "314159", "tanggal_daftar": "2026-11-04", "pemasok": "Harbour Supply Pty Ltd", "valuta": "USD", "ndpbm": 16287.5,
    "nilai_cif": 10850, "nilai_pabean_rp": 176719375, "bm": 8835969, "cukai": 0, "ppn": 20411088, "ppnbm": 0, "pph": 4638884, "total": 33885941}';
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Kopi Impor Uji', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  execute 'reset role';
  v_hari := app.hari_ini(pa);
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, dampak_rp, untuk_peran) values
    (pa, 'lempar', 'uang.impor', 'Catat impor PIB 314159', jsonb_build_object('jenis', 'pib', 'bidang', b), 210605316, '{pemilik}') returning id into u1;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, dampak_rp, untuk_peran) values
    (pa, 'lempar', 'uang.impor', 'PIB ditolak', jsonb_build_object('jenis', 'pib', 'bidang', b), 210605316, '{pemilik}') returning id into u2;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, dampak_rp, untuk_peran) values
    (pa, 'lempar', 'uang.impor', 'PIB tanpa nilai', jsonb_build_object('jenis', 'pib', 'bidang', '{"nomor_daftar": "1"}'::jsonb), null, '{pemilik}') returning id into u3;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, dampak_rp, untuk_peran) values
    (pa, 'lempar', 'uang.impor', 'PIB tanggal depan', jsonb_build_object('jenis', 'pib', 'bidang',
      b || jsonb_build_object('tanggal_daftar', (v_hari + 40)::text, 'nilai_pabean_rp', 0)), 1, '{pemilik}') returning id into u4;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan(u1, true);
  perform public.putuskan_usulan(u2, false);
  perform public.putuskan_usulan(u3, true);
  perform public.putuskan_usulan(u4, true);
  perform public.putuskan_usulan(u1, true);
  execute 'reset role';

  select * into j from public.jurnal where perusahaan_id = pa and sumber = 'pib' and sumber_id = u1::text;
  perform pg_temp.cek('jurnal PIB diposting saat disetujui', j.id is not null and j.kunci_idempoten = 'pib:' || u1);
  perform pg_temp.cek('tanggal = tanggal pendaftaran PIB', j.tanggal = least(date '2026-11-04', v_hari), j.tanggal::text);
  perform pg_temp.cek('keterangan menyebut nomor PIB dan pemasok', j.keterangan = 'Impor PIB 314159 Harbour Supply Pty Ltd', j.keterangan);
  select jsonb_object_agg(a.kode, b2.debit - b2.kredit) into x from public.jurnal_baris b2 join public.akun a on a.id = b2.akun_id where b2.jurnal_id = j.id;
  perform pg_temp.cek('baris jurnal sesuai jurnalPib', x = jsonb_build_object('1-300', 176719375 + 8835969, '1-410', 20411088, '1-420', 4638884,
    '2-110', -176719375, '1-110', -33885941), x::text);
  perform pg_temp.cek('akun baru terpasang', (select count(*) from public.akun where perusahaan_id = pa and kode in ('1-410', '1-420', '2-110')) = 3);
  select count(*) into n from public.jurnal where perusahaan_id = pa and sumber = 'pib' and sumber_id = u1::text;
  perform pg_temp.cek('sekali saja walau disetujui ulang', n = 1, n::text);
  perform pg_temp.cek('ditolak tanpa jurnal', not exists (select 1 from public.jurnal where sumber_id = u2::text));
  perform pg_temp.cek('tanpa nilai tanpa jurnal, usulan tetap diterima', not exists (select 1 from public.jurnal where sumber_id = u3::text)
    and (select status from public.usulan where id = u3) = 'diterima');
  select * into j from public.jurnal where perusahaan_id = pa and sumber_id = u4::text;
  perform pg_temp.cek('tanggal masa depan jadi hari ini; CIF dari nilai CIF x NDPBM', j.tanggal = v_hari
    and (select b2.kredit from public.jurnal_baris b2 join public.akun a on a.id = b2.akun_id where b2.jurnal_id = j.id and a.kode = '2-110') = 176719375,
    coalesce(j.tanggal::text, 'tidak ada'));
  perform pg_temp.cek('usulan uang.impor juga tercatat sebagai kejadian', exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'uang.impor'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'jurnal_pib: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
