-- Tes M-25: tanggal per jenis tenggat (pajak PMK 81/2024, BPJS PP 44/2015 dan Perpres 82/2018, THR, kontrak, SP, izin usaha),
-- pergeseran libur, pengingat ke Feed sekali per tenggat, peran, isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o1 uuid; n int; hari date;
  iz uuid;
begin
  insert into auth.users (id, email) values (ua, 'kk-a@uji.local'), (ub, 'kk-b@uji.local'), (us, 'kk-s@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Patuh A', 'ritel');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Patuh B', 'ritel');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kasir Kontrak', array['karyawan'], us) returning id into o1;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, us, 'staf', o1);
  insert into public.identitas_pajak (perusahaan_id, npwp, nitku, pkp) values (pa, '0123456789012345', '0123456789012345000000', true);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('setor PPh masa Oktober: 15 Nov hari Minggu, digeser ke Senin 16 Nov',
    (select tanggal from public.kalender_kepatuhan('2026-11-01', '2026-12-31') where ref = 'setor_pph:2026-10-01') = '2026-11-16');
  perform pg_temp.cek('lapor PPh masa Februari: 20 Mar cuti bersama, digeser ke 25 Mar',
    (select tanggal from public.kalender_kepatuhan('2026-03-01', '2026-03-31') where ref = 'lapor_pph:2026-02-01') = '2026-03-25');
  perform pg_temp.cek('PPN masa Januari: 28 Feb Sabtu, digeser ke Senin 2 Mar',
    (select tanggal from public.kalender_kepatuhan('2026-03-01', '2026-03-31') where ref = 'ppn:2026-01-01') = '2026-03-02');
  perform pg_temp.cek('BPJS Ketenagakerjaan masa Oktober 16 Nov (PP 44/2015 Pasal 21)',
    (select tanggal = '2026-11-16' and dasar like 'PP 44/2015 Pasal 21%' from public.kalender_kepatuhan('2026-11-01', '2026-12-31') where ref = 'bpjs_tk:2026-10-01'));
  perform pg_temp.cek('BPJS Kesehatan tanggal 10 setiap bulan (Perpres 82/2018 Pasal 39)',
    (select tanggal = '2026-11-10' and dasar like 'Perpres 82/2018 Pasal 39%' from public.kalender_kepatuhan('2026-11-01', '2026-12-31') where ref = 'bpjs_kes:2026-11-01'));
  perform pg_temp.cek('THR paling lambat H-7 Idulfitri 2026 (21 Mar): 14 Mar',
    (select tanggal from public.kalender_kepatuhan('2026-03-01', '2026-03-31') where jenis = 'thr') = '2026-03-14');

  perform public.ubah_profil_kerja(o1, 'Kasir', null, null, null, 'pkwt', hari + 5, 'perubahan', null, null);
  perform public.beri_sp(o1, hari - 180, 'Terlambat lima kali sebulan', null, 6, false, md5('kk-sp')::uuid);
  iz := public.simpan_izin_usaha(null, 'pirt', 'PIRT Kue Kering', 'P-IRT 1234567890123', hari + 40, 60, true);
  perform public.simpan_izin_usaha(null, 'halal', 'Sertifikat halal', null, hari + 200, 30, true);
  perform pg_temp.cek('kontrak PKWT berakhir muncul', exists (select 1 from public.kalender_kepatuhan(hari, hari + 30) where jenis = 'kontrak' and tanggal = hari + 5));
  perform pg_temp.cek('SP berakhir muncul', exists (select 1 from public.kalender_kepatuhan(hari - 10, hari + 30) where jenis = 'sp'));
  perform pg_temp.cek('izin usaha berlaku sampai muncul', exists (select 1 from public.kalender_kepatuhan(hari, hari + 60) where jenis = 'izin' and judul like 'PIRT Kue Kering (P-IRT%'));
  begin perform public.kalender_kepatuhan(hari, hari + 500); perform pg_temp.cek('rentang terlalu panjang ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('rentang terlalu panjang ditolak', true); end;
  execute 'reset role';

  -- Pengingat ke Feed: 7 hari ke depan (izin sesuai pengingat_hari), sekali per tenggat.
  n := app.pengingat_kepatuhan(hari);
  perform pg_temp.cek('pengingat dibuat untuk kontrak dan izin PIRT (60 hari), bukan halal (30 hari)',
    exists (select 1 from public.usulan where perusahaan_id = pa and aksi = 'info.kepatuhan' and payload ->> 'jenis' = 'kontrak')
    and exists (select 1 from public.usulan where perusahaan_id = pa and aksi = 'info.kepatuhan' and judul like 'PIRT%')
    and not exists (select 1 from public.usulan where perusahaan_id = pa and aksi = 'info.kepatuhan' and judul like 'Sertifikat halal%'), n::text);
  perform pg_temp.cek('kartu pengingat hanya untuk pemilik dan menyebut dasar', (select bool_and(untuk_peran = array['pemilik'] and penjelasan like '%Dasar:%') from public.usulan where perusahaan_id = pa and aksi = 'info.kepatuhan'));
  perform pg_temp.cek('dijalankan lagi: tidak menggandakan', app.pengingat_kepatuhan(hari) = 0);
  perform pg_temp.cek('usaha bukan PKP: tanpa tenggat PPN', not exists (select 1 from app.tenggat_kepatuhan(pb, '2026-11-01', '2026-12-31') where ref like 'ppn:%')
    and exists (select 1 from app.tenggat_kepatuhan(pb, '2026-11-01', '2026-12-31') where ref like 'setor_pph:%'));
  perform pg_temp.cek('usaha tanpa karyawan: tanpa tenggat BPJS', not exists (select 1 from app.tenggat_kepatuhan(pb, '2026-11-01', '2026-12-31') where jenis = 'bpjs'));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.kalender_kepatuhan(hari, hari + 30); perform pg_temp.cek('staf tidak membuka kalender kepatuhan', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuka kalender kepatuhan', true); end;
  perform pg_temp.cek('staf tidak melihat izin usaha', (select count(*) from public.izin_usaha) = 0);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat kontrak dan izin A', not exists (select 1 from public.kalender_kepatuhan(hari, hari + 60) where jenis in ('kontrak', 'izin', 'sp'))
    and (select count(*) from public.izin_usaha) = 0);
  begin perform public.simpan_izin_usaha(iz, 'nib', 'Coba', null, null, 60, true); perform pg_temp.cek('usaha B tidak mengubah izin A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak mengubah izin A', true); end;
  execute 'reset role';
  perform pg_temp.cek('fungsi inti tidak bisa dipanggil klien', not has_function_privilege('authenticated', 'app.tenggat_kepatuhan(uuid, date, date)', 'execute')
    and not has_function_privilege('authenticated', 'app.pengingat_kepatuhan(date)', 'execute'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
