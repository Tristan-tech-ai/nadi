-- Tes M-11B: rantai persetujuan atasan langsung > pemilik dengan delegasi saat atasan izin; survei anonim (tanpa akun, ringkasan
-- ditahan < 3 jawaban) dan tidak anonim; bidang kustom (tipe, staf hanya yang boleh dilihat); SP dan dokumen bebas menjadi surat
-- keluar bernomor ber-QR; staf hanya data sendiri; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  u4 uuid := gen_random_uuid(); u5 uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; k1 text; k2 text; k3 text; k4 text; o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; hari date;
  r jsonb; g text; us uuid; lk uuid; sv uuid; sv2 uuid; bk1 uuid; bk2 uuid; sp uuid; tp uuid; sk uuid;
begin
  insert into auth.users (id, email) values (ua, 'hb-a@uji.local'), (ub, 'hb-b@uji.local'), (u1, 'hb-1@uji.local'), (u2, 'hb-2@uji.local'),
    (u3, 'hb-3@uji.local'), (u4, 'hb-4@uji.local'), (u5, 'hb-5@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Rantai A', 'ritel');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Rantai B', 'ritel');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kasir Pemohon', array['karyawan'], u1) returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kepala Toko', array['karyawan'], u2) returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Wakil Kepala', array['karyawan'], u3) returning id into o3;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Gudang Pemohon', array['karyawan'], u4) returning id into o4;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kepala Gudang Cuti', array['karyawan'], u5) returning id into o5;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, u1, 'staf', o1), (pa, u2, 'staf', o2), (pa, u3, 'staf', o3), (pa, u4, 'staf', o4), (pa, u5, 'staf', o5);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  k1 := json_build_object('sub', u1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k2 := json_build_object('sub', u2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k3 := json_build_object('sub', u3, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k4 := json_build_object('sub', u4, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.ubah_profil_kerja(o1, 'Kasir', 'S1', 'Toko', o2, 'pkwtt', null, 'perubahan', null, null);
  perform public.ubah_profil_kerja(o4, 'Gudang', 'S1', 'Gudang', o5, 'pkwtt', null, 'perubahan', null, null);

  -- Rantai: izin staf beratasan menunggu atasan dulu, tidak tampil di Feed pemilik.
  perform set_config('request.jwt.claims', k1, true);
  r := public.ajukan_izin('izin', hari + 3, hari + 3, 'Urusan keluarga', null);
  execute 'reset role';
  select id into us from public.usulan where perusahaan_id = pa and (payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid;
  perform pg_temp.cek('izin staf beratasan: usulan menunggu atasan', (select status = 'menunggu_atasan' from public.usulan where id = us), r::text);
  perform pg_temp.cek('langkah untuk atasan langsung', (select penyetuju_orang = o2 and penyetuju_user = u2 and status = 'menunggu' from public.langkah_persetujuan where usulan_id = us));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('Feed pemilik belum melihatnya', not exists (select 1 from public.usulan where id = us and status = 'menunggu'));
  begin perform public.putuskan_usulan(us, true); perform pg_temp.cek('pemilik tidak bisa memutus sebelum atasan', (select status from public.usulan where id = us) = 'menunggu_atasan');
  exception when others then perform pg_temp.cek('pemilik tidak bisa memutus sebelum atasan', true); end;
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('pemohon tidak punya langkah untuk diputus', (select count(*) from public.langkah_saya()) = 0);
  select id into lk from public.langkah_persetujuan where usulan_id = us;
  begin perform public.putuskan_langkah(lk, true, null); perform pg_temp.cek('pemohon tidak bisa menyetujui sendiri', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('pemohon tidak bisa menyetujui sendiri', true); end;
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('atasan melihat 1 langkah', (select count(*) from public.langkah_saya()) = 1 and (select pemohon from public.langkah_saya()) = 'Kasir Pemohon');
  perform pg_temp.cek('atasan tidak bisa membaca usulan langsung', (select count(*) from public.usulan where id = us) = 0);
  r := public.putuskan_langkah(lk, true, null);
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('setelah atasan setuju: masuk Feed pemilik dengan catatan', (select status = 'menunggu' and penjelasan like '%Disetujui atasan Kepala Toko%' from public.usulan where id = us));
  r := public.putuskan_usulan(us, true);
  perform pg_temp.cek('pemilik menyetujui: izin disetujui', (select p.status = 'disetujui' from public.pengajuan_izin p join public.usulan u on (u.payload ->> 'pengajuan_id')::uuid = p.id where u.id = us));

  -- Atasan menolak: wajib alasan; izin ditolak tanpa sampai ke pemilik.
  perform set_config('request.jwt.claims', k1, true);
  r := public.ajukan_izin('izin', hari + 5, hari + 5, null, null);
  perform set_config('request.jwt.claims', k2, true);
  lk := (select id from public.langkah_saya());
  begin perform public.putuskan_langkah(lk, false, ''); perform pg_temp.cek('menolak tanpa alasan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('menolak tanpa alasan ditolak', true); end;
  perform public.putuskan_langkah(lk, false, 'Hari itu stok opname');
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('pemohon melihat izinnya ditolak atasan dengan alasan', (select status = 'ditolak' and alasan_putusan like 'Belum disetujui atasan langsung: Hari itu stok opname%' from public.pengajuan_izin where id = (r ->> 'id')::uuid));
  perform pg_temp.cek('pemohon melihat langkahnya sendiri', (select count(*) from public.langkah_persetujuan) = 2);

  -- Delegasi: atasan sedang izin, delegasinya yang menyetujui atas nama atasan.
  execute 'reset role';
  insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, status, alasan_putusan, diajukan_oleh) values (pa, o2, 'cuti', hari, hari + 2, 3, 'disetujui', 'Uji', u2);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k2, true);
  perform public.atur_delegasi(o2, o3, hari, hari + 2);
  perform set_config('request.jwt.claims', k3, true);
  begin perform public.atur_delegasi(o2, o3, hari, hari + 2); perform pg_temp.cek('staf lain tidak bisa mengatur delegasi orang lain', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf lain tidak bisa mengatur delegasi orang lain', true); end;
  perform set_config('request.jwt.claims', k1, true);
  r := public.ajukan_izin('izin', hari + 7, hari + 7, null, null);
  perform set_config('request.jwt.claims', k3, true);
  perform pg_temp.cek('delegasi menerima langkah atas nama atasan', (select count(*) = 1 and min(atas_nama) = 'Kepala Toko' from public.langkah_saya()));
  perform set_config('request.jwt.claims', k2, true);
  perform pg_temp.cek('atasan yang cuti tidak menerima langkah', (select count(*) from public.langkah_saya()) = 0);
  -- Atasan cuti tanpa delegasi: langsung ke pemilik.
  execute 'reset role';
  insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, status, alasan_putusan, diajukan_oleh) values (pa, o5, 'cuti', hari, hari, 1, 'disetujui', 'Uji', u5);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k4, true);
  r := public.ajukan_izin('izin', hari + 4, hari + 4, null, null);
  execute 'reset role';
  perform pg_temp.cek('atasan cuti tanpa delegasi: langsung ke Feed pemilik', (select status = 'menunggu' from public.usulan where (payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid)
    and not exists (select 1 from public.langkah_persetujuan l join public.usulan u on u.id = l.usulan_id where (u.payload ->> 'pengajuan_id')::uuid = (r ->> 'id')::uuid));

  -- Survei anonim.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.buat_survei('Survei rusak', '[{"teks": "Pilih satu", "jenis": "pilihan", "pilihan": ["A"]}]', true, null, null, md5('sv-rusak')::uuid); perform pg_temp.cek('pilihan tunggal ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('pilihan tunggal ditolak', true); end;
  sv := public.buat_survei('Kepuasan kerja November', '[{"teks": "Seberapa nyaman shift kamu?", "jenis": "skala"}, {"teks": "Shift favorit", "jenis": "pilihan", "pilihan": ["Pagi", "Sore"]}, {"teks": "Saran untuk toko", "jenis": "teks"}]', true, null, null, md5('sv-1')::uuid);
  perform set_config('request.jwt.claims', k1, true);
  begin perform public.isi_survei(sv, '{"q1": 7}'); perform pg_temp.cek('skala di luar 1-5 ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('skala di luar 1-5 ditolak', true); end;
  perform public.isi_survei(sv, '{"q1": 4, "q2": "Pagi", "q3": "Kipas di gudang"}');
  begin perform public.isi_survei(sv, '{"q1": 5}'); perform pg_temp.cek('mengisi dua kali ditolak', false);
  exception when sqlstate '23505' then perform pg_temp.cek('mengisi dua kali ditolak', true); end;
  perform pg_temp.cek('staf melihat bahwa ia sudah mengisi', (select count(*) from public.survei_isi) = 1);
  perform set_config('request.jwt.claims', k2, true);
  perform public.isi_survei(sv, '{"q1": 2, "q2": "Sore"}');
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('anonim, 2 jawaban: hasil ditahan', (public.hasil_survei(sv) ->> 'ditahan')::boolean and (public.hasil_survei(sv) ->> 'jumlah')::int = 2);
  perform set_config('request.jwt.claims', k3, true);
  perform public.isi_survei(sv, '{"q1": 3, "q2": "Pagi"}');
  perform set_config('request.jwt.claims', ka, true);
  r := public.hasil_survei(sv);
  perform pg_temp.cek('3 jawaban: rata skala 3,00 dan hitungan pilihan', not (r ->> 'ditahan')::boolean and (r -> 'pertanyaan' -> 0 ->> 'rata')::numeric = 3
    and (r -> 'pertanyaan' -> 1 -> 'hitung' ->> 'Pagi')::int = 2, r::text);
  perform pg_temp.cek('pemilik tidak bisa membaca jawaban anonim per baris', (select count(*) from public.survei_jawaban where survei_id = sv) = 0);
  execute 'reset role';
  perform pg_temp.cek('jawaban anonim tersimpan tanpa akun', (select count(*) = 3 and count(user_id) = 0 from public.survei_jawaban where survei_id = sv));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  sv2 := public.buat_survei('Ukuran seragam baru', '[{"teks": "Ukuran kaos", "jenis": "pilihan", "pilihan": ["S", "M", "L"]}]', false, array['staf'], null, md5('sv-2')::uuid);
  perform set_config('request.jwt.claims', k1, true);
  perform public.isi_survei(sv2, '{"q1": "M"}');
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('survei tidak anonim: pemilik melihat jawaban per orang', (select count(*) = 1 and min(user_id::text) = u1::text from public.survei_jawaban where survei_id = sv2));

  -- Bidang kustom.
  bk1 := public.simpan_bidang_kustom(null, 'Ukuran seragam', 'pilihan', array['S', 'M', 'L'], true, true);
  bk2 := public.simpan_bidang_kustom(null, 'Catatan kesehatan', 'teks', null, false, true);
  begin perform public.isi_nilai_kustom(o1, bk1, 'XL'); perform pg_temp.cek('nilai di luar pilihan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('nilai di luar pilihan ditolak', true); end;
  perform public.isi_nilai_kustom(o1, bk1, 'M');
  perform public.isi_nilai_kustom(o1, bk2, 'Alergi debu');
  perform public.isi_nilai_kustom(o2, bk1, 'L');
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('staf melihat bidang yang boleh dilihat, miliknya saja', (select count(*) = 1 and min(nilai) = 'M' from public.nilai_kustom));
  begin perform public.isi_nilai_kustom(o1, bk1, 'S'); perform pg_temp.cek('staf tidak mengisi bidang kustom', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mengisi bidang kustom', true); end;

  -- SP dan dokumen bebas menjadi surat keluar bernomor ber-QR.
  perform set_config('request.jwt.claims', ka, true);
  sp := (public.beri_sp(o1, hari, 'Selisih kas Rp50.000 tanpa laporan', 'Peraturan Perusahaan Pasal 8', null, false, md5('sp-b')::uuid) ->> 'id')::uuid;
  r := public.terbitkan_sp(sp);
  perform pg_temp.cek('SP terbit bernomor SP dengan kode verifikasi', r ->> 'nomor' like '%/SP/%' and length(r ->> 'kode') = 12, r::text);
  perform pg_temp.cek('terbitkan dua kali: surat yang sama', (public.terbitkan_sp(sp) ->> 'nomor') = r ->> 'nomor');
  perform pg_temp.cek('isi SP menyebut masa berlaku dan dasar', (select isi ->> 2 like 'Surat peringatan ini berlaku sejak%' and isi ->> 1 like '%Peraturan Perusahaan Pasal 8%' from public.surat_keluar where id = (r ->> 'id')::uuid));
  perform pg_temp.cek('verifikasi QR publik', (public.verifikasi_surat(r ->> 'kode') ->> 'judul') = 'Surat Peringatan Pertama');
  begin perform public.simpan_templat_dokumen('Kontrak salah', 'Kontrak {nama}', 'Gaji {gaji} per bulan'); perform pg_temp.cek('penanda tidak dikenal ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('penanda tidak dikenal ditolak', g like '%gaji%', g); end;
  tp := public.simpan_templat_dokumen('Penawaran kerja', 'Penawaran kerja {nama}', E'{usaha} menawarkan posisi {jabatan} ({level}) kepada {nama}.\n\nTanggal {tanggal}.');
  sk := public.buat_dokumen(tp, o1);
  perform pg_temp.cek('dokumen dari templat: penanda terisi, 2 paragraf, draf', (select status = 'draf' and jenis = 'dokumen' and judul = 'Penawaran kerja Kasir Pemohon'
    and isi ->> 0 = 'Toko Rantai A menawarkan posisi Kasir (S1) kepada Kasir Pemohon.' and jsonb_array_length(isi) = 2 from public.surat_keluar where id = sk));
  perform pg_temp.cek('dokumen terbit bernomor DOK', (public.terbitkan_surat(sk) ->> 'nomor') like '%/DOK/%');
  perform set_config('request.jwt.claims', k1, true);
  begin perform public.terbitkan_sp(sp); perform pg_temp.cek('staf tidak menerbitkan SP', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak menerbitkan SP', true); end;

  -- Isolasi usaha.
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat survei, bidang, langkah, delegasi, templat A',
    (select count(*) from public.survei) + (select count(*) from public.bidang_kustom) + (select count(*) from public.langkah_persetujuan)
    + (select count(*) from public.delegasi_persetujuan) + (select count(*) from public.templat_dokumen) = 0);
  begin perform public.isi_survei(sv, '{"q1": 1}'); perform pg_temp.cek('usaha B tidak mengisi survei A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak mengisi survei A', true); end;
  begin perform public.terbitkan_sp(sp); perform pg_temp.cek('usaha B tidak menerbitkan SP A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak menerbitkan SP A', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
