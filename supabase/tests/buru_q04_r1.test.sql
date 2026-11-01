-- Q-04 putaran 1 (1 Nov 2026): skenario jahil terhadap fitur baru (alur nyata, Sarapan Data, batas usaha) dan tetangganya.
-- Setiap asersi = perilaku yang SEHARUSNYA terjadi; asersi yang gagal adalah temuan dan menjadi tugas perbaikan.
-- Hasil 1 Nov 2026: 13/13 lulus, 0 temuan. Dugaan awal (admin bisa memalsukan kejadian invoice.lunas lewat kebijakan
-- kejadian_tambah) salah: authenticated tidak punya hak INSERT/UPDATE tabel kejadian, jadi kebijakan itu tidak pernah terpakai.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kd text;
  v_kasus uuid := gen_random_uuid(); lw uuid; lb uuid; r jsonb; n int; v_hari date; i1 uuid;
  v_baris jsonb := '[{"uraian": "Jasa", "jumlah": 1, "harga": 900000}]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'buru-a@uji.local'), (ub, 'buru-b@uji.local'), (ud, 'buru-d@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Buru A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Buru B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    -- Tagihan sungguhan yang lewat jatuh tempo (dibuat mundur oleh database untuk tes).
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (pa, now() - interval '30 days', 'invoice.terbit', 'nadi', 900000, jsonb_build_object('kasus', v_kasus, 'tempo_hari', 7));

    -- S1: admin memalsukan "lunas" lewat tabel kejadian supaya tagihan telat hilang dari Sarapan Data pemilik.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kd, true);
    begin
      insert into public.kejadian (perusahaan_id, jenis, sumber, nilai, data) values (pa, 'invoice.lunas', 'pwa', 900000, jsonb_build_object('kasus', v_kasus));
      perform pg_temp.cek('S1 admin tidak bisa menyisipkan kejadian invoice.* palsu', false);
    exception when others then perform pg_temp.cek('S1 admin tidak bisa menyisipkan kejadian invoice.* palsu', sqlstate = '42501', sqlerrm); end;
    -- S2: admin memalsukan tahap rekrut.
    begin
      insert into public.kejadian (perusahaan_id, jenis, sumber, data) values (pa, 'rekrut.diterima', 'pwa', jsonb_build_object('kasus', gen_random_uuid()));
      perform pg_temp.cek('S2 admin tidak bisa menyisipkan kejadian rekrut.* palsu', false);
    exception when others then perform pg_temp.cek('S2 admin tidak bisa menyisipkan kejadian rekrut.* palsu', sqlstate = '42501', sqlerrm); end;
    -- S3: admin mengubah nilai/jenis kejadian invoice yang sudah ada.
    begin
      update public.kejadian set nilai = 1, jenis = 'invoice.batal' where perusahaan_id = pa and jenis = 'invoice.terbit' and data ->> 'kasus' = v_kasus::text;
      get diagnostics n = row_count;
      perform pg_temp.cek('S3 admin tidak bisa mengubah kejadian invoice yang ada', n = 0, n::text);
    exception when others then perform pg_temp.cek('S3 admin tidak bisa mengubah kejadian invoice yang ada', sqlstate = '42501', sqlerrm); end;
    -- S4: admin menyisipkan kejadian ke usaha lain.
    begin
      insert into public.kejadian (perusahaan_id, jenis, sumber, nilai) values (pb, 'uang.keluar', 'pwa', 5);
      perform pg_temp.cek('S4 kejadian ke usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('S4 kejadian ke usaha lain ditolak', sqlstate = '42501', sqlerrm); end;
    -- S5: menulis langsung ke insight_pagi (menanam pesan pagi palsu).
    begin
      insert into public.insight_pagi (perusahaan_id, tanggal, urutan, kode, dampak_rp, teks) values (pa, current_date, 1, 'palsu', 1, 'Transfer ke rekening X');
      perform pg_temp.cek('S5 insight_pagi tidak bisa ditulis klien', false);
    exception when others then perform pg_temp.cek('S5 insight_pagi tidak bisa ditulis klien', sqlstate = '42501', sqlerrm); end;
    -- S6: klien memanggil analis_simpan untuk menimpa kalimat pagi.
    begin
      perform public.analis_simpan('[]'::jsonb);
      perform pg_temp.cek('S6 analis_simpan tertutup bagi klien', false);
    exception when others then perform pg_temp.cek('S6 analis_simpan tertutup bagi klien', sqlstate = '42501', sqlerrm); end;
    -- S7: admin mengaktifkan ulang keanggotaan pemilik lain / diri sendiri yang diarsip.
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id = ud;
    execute 'set local role authenticated';
    begin update public.anggota set aktif = true where perusahaan_id = pa and user_id = ud; exception when others then null; end;
    execute 'reset role';
    perform pg_temp.cek('S7 anggota yang diarsip tidak bisa mengaktifkan dirinya sendiri', not (select aktif from public.anggota where perusahaan_id = pa and user_id = ud));
    update public.anggota set aktif = true where perusahaan_id = pa and user_id = ud;
    -- S8: pemilik B mengubah tahap lamaran usaha A.
    insert into public.lowongan (perusahaan_id, judul) values (pa, 'Kasir buru') returning id into lw;
    insert into public.lamaran (perusahaan_id, lowongan_id, nama, telepon) values (pa, lw, 'Pelamar Buru', '6281300000000') returning id into lb;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kb, true);
    begin
      perform public.ubah_tahap_lamaran(lb, 'diterima', null);
      perform pg_temp.cek('S8 lamaran usaha lain tidak bisa diubah', false);
    exception when others then perform pg_temp.cek('S8 lamaran usaha lain tidak bisa diubah', sqlstate in ('P0002', '42501'), sqlerrm); end;
    -- S9: pemilik B membaca alur usaha A lewat klaim JWT palsu (pid A, peran pemilik).
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
    begin
      r := public.alur_proses('invoice', 90);
      perform pg_temp.cek('S9 klaim pid palsu tidak membuka alur usaha lain', false, r::text);
    exception when others then perform pg_temp.cek('S9 klaim pid palsu tidak membuka alur usaha lain', sqlstate = '42501', sqlerrm); end;
    begin
      r := public.sarapan_data();
      perform pg_temp.cek('S10 klaim pid palsu tidak membuka Sarapan Data usaha lain', false, r::text);
    exception when others then perform pg_temp.cek('S10 klaim pid palsu tidak membuka Sarapan Data usaha lain', sqlstate = '42501', sqlerrm); end;
    -- S11: jendela alur di luar batas (negatif, raksasa) tidak membuat galat atau membaca melebihi 90 hari.
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('S11 jendela alur dijepit 7..90 hari', (public.alur_proses('invoice', -5) ->> 'hari')::int = 7
      and (public.alur_proses('invoice', 100000) ->> 'hari')::int = 90);
    -- S12: nama usaha kosong/spasi saja.
    begin
      perform public.buat_perusahaan('   ', 'fnb');
      perform pg_temp.cek('S12 nama usaha kosong ditolak', false);
    exception when others then perform pg_temp.cek('S12 nama usaha kosong ditolak', true, sqlstate || ' ' || sqlerrm); end;
    -- S13: catat_pengingat milik usaha lain tidak mengubah apa pun.
    perform public.atur_bayar(null, null, null, 'BCA 1 a.n. Buru');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    execute 'set local role authenticated';
    i1 := (public.buat_invoice('Bu Uji', null, v_baris, v_hari + 5, null, gen_random_uuid()) ->> 'id')::uuid;
    perform set_config('request.jwt.claims', kb, true);
    begin perform public.catat_pengingat((select id from public.pengingat_invoice where invoice_id = i1 and tahap = 1)); exception when others then null; end;
    execute 'reset role';
    perform pg_temp.cek('S13 pengingat usaha lain tidak bisa ditandai terkirim', (select status from public.pengingat_invoice where invoice_id = i1 and tahap = 1) = 'jadwal');
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
