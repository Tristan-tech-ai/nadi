-- Tes F4-03 agenda surat masuk (docs/research/agenda-surat.md): menyetujui usulan dokumen.surat di Feed mendaftarkan surat ke
-- agenda dengan nomor dari Nomor Sakti, menautkan pihak ke orang bila namanya jelas cocok (pg_trgm >= 0,6 dan selisih >= 0,15
-- dari kandidat kedua), menyimpan kandidat bila ragu (tidak menebak), tidak mendaftar dua kali surat bernomor sama, tidak
-- memakai nomor agenda untuk duplikat atau usulan yang ditolak; taut pihak manual dan ubah status oleh pemilik/admin lewat
-- app.peran_aktif; staf dan usaha lain tidak melihat. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  pa uuid; pb uuid; o_siti uuid; o_andi1 uuid; o_andi2 uuid; o_b uuid; u1 uuid; u2 uuid; u3 uuid; u4 uuid; u5 uuid;
  ka text; kb text; kd text; ks text; g record; n int; x text; v_tahun text;
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada', to_regclass('public.agenda_surat') is not null
      and to_regprocedure('app.terbit_nomor(uuid,text,text,uuid)') is not null
      and to_regprocedure('public.taut_pihak_surat(uuid,uuid)') is not null and to_regprocedure('public.ubah_status_surat(uuid,text,text)') is not null);
    perform pg_temp.cek('fungsi inti nomor tertutup untuk authenticated',
      not has_function_privilege('authenticated', 'app.terbit_nomor(uuid,text,text,uuid)', 'execute'));
    perform pg_temp.cek('ambil_nomor tetap memeriksa peran lewat peran_aktif',
      (select prosrc ~ 'peran_aktif' and prosrc ~ 'terbit_nomor' from pg_proc where oid = 'public.ambil_nomor(text,text)'::regprocedure));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (ud, 'd@uji.local'), (us, 's@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Surat', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Surat B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Siti Rahmawati') returning id into o_b;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Siti Rahmawati') returning id into o_siti;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Andi Pratama') returning id into o_andi1;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Andi Wijaya') returning id into o_andi2;
    execute 'reset role';
    v_tahun := to_char(app.hari_ini(pa), 'YYYY');
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, us, 'staf');
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
      (pa, 'sistem', 'dokumen.surat', 'Arsipkan SK 1', '{"jenis":"surat","bidang":{"nomor":"012/HRD/SK/X/2026","jenis":"Surat Keputusan Mutasi","tanggal":"2026-10-28","pihak":"Siti Rahmawati"}}', array['pemilik','admin'])
      returning id into u1;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
      (pa, 'sistem', 'dokumen.surat', 'Arsipkan ST', '{"jenis":"surat","bidang":{"nomor":"07/ST/2026","jenis":"Surat Tugas","tanggal":"2026-10-30","pihak":"Andi"}}', array['pemilik','admin'])
      returning id into u2;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
      (pa, 'sistem', 'dokumen.surat', 'Arsipkan SK 1 lagi', '{"jenis":"surat","bidang":{"nomor":" 012/hrd/sk/x/2026 ","jenis":"Surat Keputusan Mutasi","tanggal":"2026-10-28","pihak":"Siti Rahmawati"}}', array['pemilik','admin'])
      returning id into u3;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
      (pa, 'sistem', 'dokumen.surat', 'Arsipkan undangan', '{"jenis":"surat","bidang":{"nomor":"45/UND/XI/2026","jenis":"Undangan rapat","tanggal":"bukan tanggal","pihak":"PT Sinar Jaya Abadi"}}', array['pemilik','admin'])
      returning id into u4;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values
      (pa, 'sistem', 'dokumen.surat', 'Arsipkan ditolak', '{"jenis":"surat","bidang":{"nomor":"99/X/2026","pihak":"Siti Rahmawati"}}', array['pemilik','admin'])
      returning id into u5;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan(u1, true);
    select * into g from public.agenda_surat where usulan_id = u1;
    perform pg_temp.cek('usulan disetujui terdaftar ke agenda bernomor 001/AG/tahun', g.nomor_agenda = '001/AG/' || v_tahun and g.arah = 'masuk'
      and g.nomor_surat = '012/HRD/SK/X/2026' and g.jenis = 'Surat Keputusan Mutasi' and g.tanggal_surat = date '2026-10-28' and g.status = 'baru',
      coalesce(g.nomor_agenda, 'tidak ada'));
    perform pg_temp.cek('pihak yang jelas cocok ditaut otomatis dengan keyakinan', g.pihak_orang_id = o_siti and g.pihak_cara = 'otomatis' and g.pihak_yakin >= 0.99,
      coalesce(g.pihak_cara, '-') || ' ' || coalesce(g.pihak_yakin::text, '-'));
    perform pg_temp.cek('nomor agenda tercatat di nomor_terbit', exists (select 1 from public.nomor_terbit t where t.id = g.nomor_terbit_id and t.jenis = 'AG' and t.nomor = g.nomor_agenda));

    perform public.putuskan_usulan(u2, true);
    select * into g from public.agenda_surat where usulan_id = u2;
    perform pg_temp.cek('pihak ragu tidak ditaut, dua kandidat disimpan', g.pihak_orang_id is null and g.pihak_cara is null
      and jsonb_array_length(g.pihak_kandidat) = 2 and g.pihak_kandidat @> jsonb_build_array(jsonb_build_object('id', o_andi1), jsonb_build_object('id', o_andi2)),
      g.pihak_kandidat::text);
    perform pg_temp.cek('agenda kedua 002', g.nomor_agenda = '002/AG/' || v_tahun, g.nomor_agenda);

    perform public.putuskan_usulan(u3, true);
    select count(*) into n from public.agenda_surat where perusahaan_id = pa and lower(nomor_surat) = '012/hrd/sk/x/2026';
    perform pg_temp.cek('surat bernomor sama tidak didaftar dua kali', n = 1 and not exists (select 1 from public.agenda_surat where usulan_id = u3), n::text);
    perform public.putuskan_usulan(u5, false);
    perform pg_temp.cek('usulan ditolak tidak masuk agenda', not exists (select 1 from public.agenda_surat where usulan_id = u5));
    perform public.putuskan_usulan(u4, true);
    select * into g from public.agenda_surat where usulan_id = u4;
    perform pg_temp.cek('duplikat dan penolakan tidak memakai nomor: berikutnya 003', g.nomor_agenda = '003/AG/' || v_tahun, coalesce(g.nomor_agenda, '-'));
    perform pg_temp.cek('pihak tanpa kandidat: teks disimpan, tidak ditaut, tanggal tidak sah = null',
      g.pihak_teks = 'PT Sinar Jaya Abadi' and g.pihak_orang_id is null and g.pihak_kandidat = '[]'::jsonb and g.tanggal_surat is null, g.pihak_kandidat::text);

    -- Taut pihak manual oleh admin.
    perform set_config('request.jwt.claims', kd, true);
    perform public.taut_pihak_surat((select id from public.agenda_surat where usulan_id = u2), o_andi2);
    select * into g from public.agenda_surat where usulan_id = u2;
    perform pg_temp.cek('admin menautkan pihak manual', g.pihak_orang_id = o_andi2 and g.pihak_cara = 'manual' and g.pihak_yakin is null, coalesce(g.pihak_cara, '-'));
    begin
      perform public.taut_pihak_surat(g.id, o_b);
      perform pg_temp.cek('pihak dari usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('pihak dari usaha lain ditolak', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;
    perform public.ubah_status_surat(g.id, 'ditindaklanjuti', 'Sudah diteruskan ke Andi');
    perform pg_temp.cek('admin mengubah status dan catatan', (select status = 'ditindaklanjuti' and catatan = 'Sudah diteruskan ke Andi' from public.agenda_surat where id = g.id));
    begin
      perform public.ubah_status_surat(g.id, 'hilang', null);
      perform pg_temp.cek('status tidak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('status tidak dikenal ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;

    -- Staf dan usaha lain.
    perform set_config('request.jwt.claims', ks, true);
    select count(*) into n from public.agenda_surat;
    perform pg_temp.cek('staf tidak membaca agenda', n = 0, n::text);
    begin
      perform public.taut_pihak_surat(g.id, null);
      perform pg_temp.cek('staf tidak menautkan pihak', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak menautkan pihak', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    select count(*) into n from public.agenda_surat;
    perform pg_temp.cek('usaha lain tidak membaca agenda', n = 0, n::text);
    begin
      perform public.ubah_status_surat(g.id, 'selesai', null);
      perform pg_temp.cek('usaha lain tidak mengubah agenda', false);
    exception when others then perform pg_temp.cek('usaha lain tidak mengubah agenda', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
    end;

    -- Nomor Sakti tetap jalan untuk pemanggil biasa.
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('agenda usaha A tetap ditindaklanjuti', (select status from public.agenda_surat where id = g.id) = 'ditindaklanjuti');
    perform public.atur_templat_nomor('SK', 'Surat keputusan', '{no:3}/{jenis}/{tahun}');
    perform pg_temp.cek('ambil_nomor tetap memberi nomor', public.ambil_nomor('SK') ->> 'nomor' = '001/SK/' || v_tahun);
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
