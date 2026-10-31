-- Tes Kolam Bonus Beban (F3-05, docs/design/kolam-bonus-beban.md, docs/quality/rencana-uji-f3-05.md): pembagian menurut poin
-- kerja selesai di bulan itu (zona usaha), sisa terbesar sehingga jumlah bagian = kolam persis (seri diputus urut id orang);
-- ambang 5 kerja berpoin; kerja batal dan di luar bulan tidak dihitung; kerja yang dibanding ditandai, tetap dihitung; hanya
-- pemilik (app.peran_aktif) yang menyimpan, menyetujui, membatalkan; admin melihat pratinjau saja; JWT lama setelah dicabut
-- ditolak; staf hanya bagiannya lewat kolam_saya; isolasi tenant; idempoten; komponen slip insentif_beban di slip draf; slip
-- yang periodenya sudah disetujui tidak berubah. Bulan uji September 2026 tetap (tanpa now()), jadi lulus di hari mana pun.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Struktur: fungsi dan kebijakan kolam tidak memakai klaim JWT (Q-23) atau WITA tetap (Q-24).
select pg_temp.cek('fungsi kolam tidak memakai app.prn()/app.pengelola()/Asia/Makassar',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'app') and p.proname like '%kolam%'
                 and p.prosrc ~ '(app\.prn\(\)|app\.pengelola\(\)|Asia/Makassar)'));
select pg_temp.cek('kebijakan kolam memakai app.peran_aktif(), bukan klaim',
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('kolam_bonus', 'kolam_bagian')
      and qual like '%peran_aktif%' and qual !~ '(app\.prn\(\)|app\.pengelola\(\))') = 2);
select pg_temp.cek('RLS aktif di kolam_bonus dan kolam_bagian',
  (select count(*) = 2 and bool_and(relrowsecurity) from pg_class where oid in (to_regclass('public.kolam_bonus'), to_regclass('public.kolam_bagian'))));

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  up uuid := gen_random_uuid(); us uuid;
  pa uuid; pb uuid; ka text; kb text; kd text; kc text; kp text; ks text;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_tono uuid; o_b uuid; k_budi uuid; per uuid; per_b uuid;
  bln date := date '2026-09-01'; jkt text := 'Asia/Jakarta';
  kunci uuid := gen_random_uuid(); k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
  v_rp bigint; id1 uuid; id_d1 uuid; id_d2 uuid; r jsonb; e jsonb; n int; x text; v_slip jsonb; v_slip2 jsonb; v_min uuid;
begin
  begin
    insert into auth.users (id, email) values
      (ua, 'a@uji.local'), (ub, 'b@uji.local'), (ud, 'd@uji.local'), (uc, 'c@uji.local'), (up, 'p@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Kolam A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Kolam B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kc := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kp := json_build_object('sub', up, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Rahasia Kolam B') returning id into o_b;
    perform set_config('request.jwt.claims', ka, true);
    -- Urutan sisip menentukan urut id (uuid7): Sari < Budi < Dewi < Tono.
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Kolam') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Kolam') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Kolam') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Kolam') returning id into o_tono;
    perform public.buat_akun_staf(o_sari, '135790');
    select user_id into us from public.orang where id = o_sari;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin'), (pa, uc, 'admin'), (pa, up, 'pemilik');
    -- Batch pertama: 4 kerja berpoin (Sari 1 + 1, Budi 1,5 + 1,5). Batas bulan zona usaha: 31 Agu 23.59 dan 1 Okt 00.00 tidak.
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Buka kas', o_sari, 'selesai', 1, timestamp '2026-09-02 08:00' at time zone jkt),
      (pa, 'Tutup kas akhir bulan', o_sari, 'selesai', 1, timestamp '2026-09-30 23:59' at time zone jkt),
      (pa, 'Cek stok gula', o_budi, 'selesai', 1.5, timestamp '2026-09-10 09:00' at time zone jkt),
      (pa, 'Kas Agustus', o_sari, 'selesai', 4, timestamp '2026-08-31 23:59' at time zone jkt),
      (pa, 'Kas Oktober', o_sari, 'selesai', 4, timestamp '2026-10-01 00:00' at time zone jkt),
      (pa, 'Stok opname batal', o_sari, 'batal', 10, null),
      (pa, 'Lap meja jalan', o_dewi, 'jalan', 5, null);
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Rekap pemasok', o_budi, 'selesai', 1.5, timestamp '2026-09-12 09:00' at time zone jkt) returning id into k_budi;
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, selesai_at) values
      (pb, 'Kerja B', o_b, 'selesai', 9, timestamp '2026-09-05 10:00' at time zone jkt);
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran)
    values (pa, 'staf', 'kpi.banding', 'Tinjau hitungan kerja Budi Kolam: Rekap pemasok', jsonb_build_object('kerja_id', k_budi, 'alasan', 'Uji'), array['pemilik']);
    insert into public.periode_gaji (perusahaan_id, bulan) values (pa, bln) returning id into per;
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen, bruto, potongan, neto) values
      (pa, per, o_sari, '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":3000000,"sumber":"orang_rahasia"},{"kode":"pph21","label":"PPh 21","jenis":"potongan","nilai":0,"sumber":"aturan:pph21.ter"}]', 3000000, 0, 3000000),
      (pa, per, o_tono, '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":2500000,"sumber":"orang_rahasia"}]', 2500000, 0, 2500000);
    execute 'set local role authenticated';

    -- Ambang: 4 kerja berpoin belum cukup.
    perform set_config('request.jwt.claims', ka, true);
    r := public.hitung_kolam(bln, 1000000, '[]');
    perform pg_temp.cek('ambang: 4 kerja berpoin belum cukup, pesan jelas, tanpa bagian', not (r ->> 'cukup')::boolean
      and (r ->> 'kerja_n')::int = 4 and jsonb_array_length(r -> 'bagian') = 0
      and r ->> 'pesan' like 'Belum cukup kerja tercatat untuk membagi kolam dengan adil%', r::text);
    begin
      perform public.simpan_kolam(bln, 1000000, '[]', gen_random_uuid());
      perform pg_temp.cek('ambang: simpan ditolak di bawah 5 kerja', false);
    exception when others then perform pg_temp.cek('ambang: simpan ditolak di bawah 5 kerja', sqlstate = '22023' and sqlerrm like 'Belum cukup%', sqlerrm);
    end;

    -- Batch kedua: Sari 1 (total 3 poin, 3 kerja), Dewi 3 (1 kerja), Tono tanpa poin. Semua 3 poin: 6 kerja berpoin, 9 poin.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, selesai_at) values
      (pa, 'Setor bank', o_sari, 'selesai', 1, timestamp '2026-09-15 11:00' at time zone jkt),
      (pa, 'Inventaris dapur', o_dewi, 'selesai', 3, timestamp '2026-09-20 14:00' at time zone jkt),
      (pa, 'Bersih gudang', o_tono, 'selesai', null, timestamp '2026-09-21 14:00' at time zone jkt),
      (pa, 'Stok Oktober 1', o_dewi, 'selesai', 2, timestamp '2026-10-05 10:00' at time zone jkt),
      (pa, 'Stok Oktober 2', o_dewi, 'selesai', 2, timestamp '2026-10-06 10:00' at time zone jkt),
      (pa, 'Stok Oktober 3', o_dewi, 'selesai', 2, timestamp '2026-10-07 10:00' at time zone jkt),
      (pa, 'Stok Oktober 4', o_dewi, 'selesai', 2, timestamp '2026-10-08 10:00' at time zone jkt);
    execute 'set local role authenticated';

    r := public.hitung_kolam(bln, 1000000, '[]');
    select o into v_min from unnest(array[o_sari, o_budi, o_dewi]) o order by o limit 1;
    perform pg_temp.cek('pratinjau: 6 kerja berpoin, 9 poin, tiga bagian, urut nama', (r ->> 'cukup')::boolean and (r ->> 'kerja_n')::int = 6
      and (r ->> 'total_poin')::numeric = 9 and jsonb_array_length(r -> 'bagian') = 3
      and r #>> '{bagian,0,nama}' = 'Budi Kolam' and r #>> '{bagian,2,nama}' = 'Sari Kolam' and r ->> 'zona' = jkt, r::text);
    perform pg_temp.cek('sisa terbesar: jumlah bagian = Rp1.000.000 persis',
      (select sum((b ->> 'rupiah')::bigint) from jsonb_array_elements(r -> 'bagian') b) = 1000000, r ->> 'bagian');
    perform pg_temp.cek('seri diputus urut id: id terkecil 333.334, dua lainnya 333.333',
      (select bool_and((b ->> 'rupiah')::bigint = case when (b ->> 'orang_id')::uuid = v_min then 333334 else 333333 end)
         from jsonb_array_elements(r -> 'bagian') b), r ->> 'bagian');
    v_rp := case when v_min = o_sari then 333334 else 333333 end;
    select b into e from jsonb_array_elements(r -> 'bagian') b where (b ->> 'orang_id')::uuid = o_sari;
    perform pg_temp.cek('Sari: 3 poin dari 3 kerja, 33,3%, alasan dari kerja nyata, batas bulan zona usaha',
      (e ->> 'poin')::numeric = 3 and (e ->> 'kerja_n')::int = 3 and (e ->> 'persen')::numeric = 33.3
      and e ->> 'alasan' = 'Sari Kolam: 3 poin dari 3 kerja, 33,3% kolam' and jsonb_array_length(e -> 'kerja_ids') = 3
      and exists (select 1 from jsonb_array_elements_text(e -> 'kerja_ids') i join public.kerja k on k.id = i::uuid where k.judul = 'Tutup kas akhir bulan')
      and not exists (select 1 from jsonb_array_elements_text(e -> 'kerja_ids') i join public.kerja k on k.id = i::uuid where k.judul in ('Kas Agustus', 'Kas Oktober', 'Stok opname batal')), e::text);
    select b into e from jsonb_array_elements(r -> 'bagian') b where (b ->> 'orang_id')::uuid = o_budi;
    perform pg_temp.cek('kerja yang dibanding ditandai, tetap dihitung', (e ->> 'poin')::numeric = 3
      and e -> 'dibanding_ids' = jsonb_build_array(k_budi) and e ->> 'alasan' like '%1 kerja sedang dibanding%', e::text);
    perform pg_temp.cek('kerja tanpa poin dicatat terpisah, tidak ikut dibagi', r -> 'tanpa_poin' = jsonb_build_array(jsonb_build_object('nama', 'Tono Kolam', 'kerja_n', 1))
      and not exists (select 1 from jsonb_array_elements(r -> 'bagian') b where (b ->> 'orang_id')::uuid = o_tono), r ->> 'tanpa_poin');
    perform pg_temp.cek('tidak ada yang lebih dari 50%: tanpa peringatan', r -> 'peringatan' = '[]'::jsonb, r ->> 'peringatan');
    perform pg_temp.cek('isolasi: pratinjau A tanpa data B', r::text not like '%Rahasia%' and r::text not like '%Kerja B%', r::text);

    -- Dikecualikan dengan alasan tertulis.
    r := public.hitung_kolam(bln, 1000000, jsonb_build_array(jsonb_build_object('orang_id', o_dewi, 'alasan', 'Cuti panjang sejak pertengahan bulan')));
    perform pg_temp.cek('Dewi dikecualikan: dua bagian Rp500.000, alasan tampil', jsonb_array_length(r -> 'bagian') = 2
      and (select bool_and((b ->> 'rupiah')::bigint = 500000) from jsonb_array_elements(r -> 'bagian') b)
      and r #>> '{dikecualikan,0,alasan}' = 'Cuti panjang sejak pertengahan bulan' and r #>> '{dikecualikan,0,nama}' = 'Dewi Kolam', r::text);
    begin
      perform public.hitung_kolam(bln, 1000000, jsonb_build_array(jsonb_build_object('orang_id', o_dewi, 'alasan', '')));
      perform pg_temp.cek('kecualikan tanpa alasan ditolak', false);
    exception when others then perform pg_temp.cek('kecualikan tanpa alasan ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.hitung_kolam(bln, 1000000, jsonb_build_array(jsonb_build_object('orang_id', o_b, 'alasan', 'Orang usaha lain')));
      perform pg_temp.cek('kecualikan orang usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('kecualikan orang usaha lain ditolak', sqlstate = '22023', sqlerrm);
    end;
    begin
      perform public.hitung_kolam(bln, 0, '[]');
      perform pg_temp.cek('kolam Rp0 ditolak', false);
    exception when others then perform pg_temp.cek('kolam Rp0 ditolak', sqlstate = '22023', sqlerrm);
    end;
    -- Oktober: Sari 4 poin (1 kerja), Dewi 8 poin (4 kerja). Dewi 66,7%: peringatan beban, hanya untuk Dewi.
    r := public.hitung_kolam(date '2026-10-01', 1200000, '[]');
    perform pg_temp.cek('satu orang di atas 50%: peringatan beban', (r ->> 'cukup')::boolean
      and r -> 'peringatan' = jsonb_build_array('Dewi Kolam memikul separuh kerja bulan ini; pertimbangkan beban di Pembagi kerja adil.')
      and (select sum((b ->> 'rupiah')::bigint) from jsonb_array_elements(r -> 'bagian') b) = 1200000, r::text);
    r := public.hitung_kolam(date '2026-10-14', 1200000, '[]');
    perform pg_temp.cek('tanggal di tengah bulan dibulatkan ke awal bulan', (r ->> 'bulan')::date = date '2026-10-01' and r ->> 'nama_bulan' = 'Oktober 2026', r::text);

    -- Hak: staf, admin, dicabut.
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.hitung_kolam(bln, 1000000, '[]');
      perform pg_temp.cek('staf tidak melihat pratinjau kolam', false);
    exception when others then perform pg_temp.cek('staf tidak melihat pratinjau kolam', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.simpan_kolam(bln, 1000000, '[]', gen_random_uuid());
      perform pg_temp.cek('staf tidak menyimpan kolam', false);
    exception when others then perform pg_temp.cek('staf tidak menyimpan kolam', sqlstate = '42501', sqlerrm);
    end;
    perform pg_temp.cek('staf: belum ada bagian sebelum disetujui', public.kolam_saya(null) is null);
    perform set_config('request.jwt.claims', kd, true);
    r := public.hitung_kolam(bln, 1000000, '[]');
    perform pg_temp.cek('admin melihat pratinjau', (r ->> 'cukup')::boolean and jsonb_array_length(r -> 'bagian') = 3, r::text);
    begin
      perform public.simpan_kolam(bln, 1000000, '[]', gen_random_uuid());
      perform pg_temp.cek('admin tidak menyimpan kolam', false);
    exception when others then perform pg_temp.cek('admin tidak menyimpan kolam', sqlstate = '42501', sqlerrm);
    end;

    -- Pemilik menyimpan draf, idempoten dengan kunci.
    perform set_config('request.jwt.claims', ka, true);
    r := public.simpan_kolam(bln, 1000000, '[]', kunci);
    id1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('pemilik menyimpan draf', id1 is not null and r ->> 'status' = 'draf' and not (r ->> 'sudah')::boolean, r::text);
    r := public.simpan_kolam(bln, 1000000, '[]', kunci);
    perform pg_temp.cek('simpan ulang dengan kunci sama: draf yang sama', (r ->> 'id')::uuid = id1 and (r ->> 'sudah')::boolean, r::text);
    select count(*) into n from public.kolam_bonus where perusahaan_id = pa;
    perform pg_temp.cek('tepat satu kolam tersimpan', n = 1, n::text);
    select count(*), sum(rupiah) into n, x from public.kolam_bagian where kolam_id = id1;
    perform pg_temp.cek('draf: tiga bagian, jumlah Rp1.000.000', n = 3 and x::bigint = 1000000, n || ' ' || x);

    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.setujui_kolam(id1);
      perform pg_temp.cek('admin tidak bisa menyetujui', false);
    exception when others then perform pg_temp.cek('admin tidak bisa menyetujui', sqlstate = '42501', sqlerrm);
    end;
    select count(*) into n from public.kolam_bagian where kolam_id = id1;
    perform pg_temp.cek('admin membaca bagian (pratinjau tersimpan)', n = 3, n::text);

    -- Pemilik kedua dan admin dicabut: JWT lama ditolak.
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pa and user_id in (up, uc);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', kp, true);
    begin
      perform public.setujui_kolam(id1);
      perform pg_temp.cek('pemilik dicabut (JWT lama) tidak bisa menyetujui', false);
    exception when others then perform pg_temp.cek('pemilik dicabut (JWT lama) tidak bisa menyetujui', sqlstate = '42501', sqlerrm);
    end;
    select count(*) into n from public.kolam_bonus;
    perform pg_temp.cek('pemilik dicabut (JWT lama) tidak membaca kolam', n = 0, n::text);
    perform set_config('request.jwt.claims', kc, true);
    begin
      perform public.hitung_kolam(bln, 1000000, '[]');
      perform pg_temp.cek('admin dicabut (JWT lama) tidak melihat pratinjau', false);
    exception when others then perform pg_temp.cek('admin dicabut (JWT lama) tidak melihat pratinjau', sqlstate = '42501', sqlerrm);
    end;
    select count(*) into n from public.kolam_bagian;
    perform pg_temp.cek('admin dicabut (JWT lama) tidak membaca bagian', n = 0, n::text);

    -- Tenant B tidak melihat dan tidak menyetujui kolam A.
    perform set_config('request.jwt.claims', kb, true);
    select count(*) into n from public.kolam_bonus;
    perform pg_temp.cek('isolasi: B tidak membaca kolam A', n = 0, n::text);
    select count(*) into n from public.kolam_bagian;
    perform pg_temp.cek('isolasi: B tidak membaca bagian A', n = 0, n::text);
    begin
      perform public.setujui_kolam(id1);
      perform pg_temp.cek('isolasi: B tidak menyetujui kolam A', false);
    exception when others then perform pg_temp.cek('isolasi: B tidak menyetujui kolam A', sqlstate = 'P0002', sqlerrm);
    end;
    r := public.hitung_kolam(bln, 500000, '[]');
    perform pg_temp.cek('isolasi: pratinjau B hanya kerja B (1 kerja, belum cukup)', not (r ->> 'cukup')::boolean and (r ->> 'kerja_n')::int = 1
      and r::text not like '%Kolam%Sari%' and r::text not like '%Sari%', r::text);

    -- Pemilik menyetujui: komponen slip insentif_beban di slip draf, PP 36/2021 Pasal 8 dan 10.
    perform set_config('request.jwt.claims', ka, true);
    r := public.setujui_kolam(id1);
    perform pg_temp.cek('pemilik menyetujui', r ->> 'status' = 'disetujui' and not (r ->> 'sudah')::boolean and (r ->> 'slip')::int = 1, r::text);
    select s.komponen into v_slip from public.slip_gaji s where s.periode_id = per and s.orang_id = o_sari;
    select k into e from jsonb_array_elements(v_slip) k where k ->> 'kode' = 'insentif_beban';
    perform pg_temp.cek('slip draf Sari memuat insentif_beban sebesar bagiannya (pendapatan, label, sumber)',
      e = jsonb_build_object('kode', 'insentif_beban', 'label', 'Insentif beban kerja', 'jenis', 'pendapatan', 'nilai', v_rp, 'sumber', 'PP 36/2021 Pasal 8 dan 10'), v_slip::text);
    select to_jsonb(s) into e from public.slip_gaji s where s.periode_id = per and s.orang_id = o_sari;
    perform pg_temp.cek('slip Sari: bruto dan neto naik sebesar bagiannya, peringatan hitung ulang PPh 21',
      (e ->> 'bruto')::bigint = 3000000 + v_rp and (e ->> 'neto')::bigint = 3000000 + v_rp
      and e -> 'peringatan' ? 'Insentif beban kerja berubah setelah slip disusun; PPh 21 belum dihitung ulang. Siapkan ulang gaji bulan ini.', e::text);
    select komponen into v_slip from public.slip_gaji where periode_id = per and orang_id = o_tono;
    perform pg_temp.cek('slip Tono (tanpa bagian) tidak berubah', jsonb_array_length(v_slip) = 1, v_slip::text);
    r := public.setujui_kolam(id1);
    perform pg_temp.cek('setujui ulang: sudah, tanpa komponen ganda', (r ->> 'sudah')::boolean
      and (select count(*) from public.slip_gaji s, jsonb_array_elements(s.komponen) k where s.orang_id = o_sari and k ->> 'kode' = 'insentif_beban') = 1, r::text);
    begin
      perform public.simpan_kolam(bln, 2000000, '[]', gen_random_uuid());
      perform pg_temp.cek('kolam kedua untuk bulan yang sudah disetujui ditolak', false);
    exception when others then perform pg_temp.cek('kolam kedua untuk bulan yang sudah disetujui ditolak', sqlstate = '55000', sqlerrm);
    end;

    -- Staf hanya bagiannya.
    perform set_config('request.jwt.claims', ks, true);
    r := public.kolam_saya(null);
    perform pg_temp.cek('staf: bagiannya sendiri, 3 poin dari 3 kerja, September 2026', (r ->> 'rupiah')::bigint = v_rp
      and (r ->> 'poin')::numeric = 3 and (r ->> 'kerja_n')::int = 3 and (r ->> 'bulan')::date = bln and r ->> 'nama_bulan' = 'September 2026', r::text);
    perform pg_temp.cek('staf: tanpa jumlah kolam, nama, atau angka rekan', r::text not like '%1000000%' and r::text not like '%Budi%'
      and r::text not like '%Dewi%' and not r ? 'persen' and not r ? 'jumlah' and not r ? 'kerja_ids', r::text);
    r := public.kolam_saya(date '2026-08-01');
    perform pg_temp.cek('staf: bulan tanpa kolam = null', r is null, r::text);
    select count(*) into n from public.kolam_bagian;
    perform pg_temp.cek('staf tidak membaca tabel bagian', n = 0, n::text);
    select count(*) into n from public.kolam_bonus;
    perform pg_temp.cek('staf tidak membaca tabel kolam', n = 0, n::text);
    begin
      perform public.batal_kolam(id1, 'Coba batalkan');
      perform pg_temp.cek('staf tidak membatalkan', false);
    exception when others then perform pg_temp.cek('staf tidak membatalkan', sqlstate = '42501', sqlerrm);
    end;

    -- Pemilik membatalkan selama gaji bulan itu belum disetujui: komponen dicabut dari slip draf.
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.batal_kolam(id1, '');
      perform pg_temp.cek('batal tanpa alasan ditolak', false);
    exception when others then perform pg_temp.cek('batal tanpa alasan ditolak', sqlstate = '22023', sqlerrm);
    end;
    r := public.batal_kolam(id1, 'Jumlah kolam salah ketik');
    select komponen into v_slip from public.slip_gaji where periode_id = per and orang_id = o_sari;
    perform pg_temp.cek('batal: status batal, insentif dicabut dari slip draf, bruto kembali',
      r ->> 'status' = 'batal' and not exists (select 1 from jsonb_array_elements(v_slip) k where k ->> 'kode' = 'insentif_beban')
      and (select bruto from public.slip_gaji where periode_id = per and orang_id = o_sari) = 3000000
      and (select alasan_batal from public.kolam_bonus where id = id1) = 'Jumlah kolam salah ketik', r::text || v_slip::text);
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('batal: staf tidak lagi melihat bagian', public.kolam_saya(null) is null);
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.setujui_kolam(id1);
      perform pg_temp.cek('kolam batal tidak bisa disetujui lagi', false);
    exception when others then perform pg_temp.cek('kolam batal tidak bisa disetujui lagi', sqlstate = '55000', sqlerrm);
    end;

    -- Dua draf baru, satu disetujui. Lalu gaji September disetujui: slip terkunci, kolam tidak mengubahnya.
    id_d1 := (public.simpan_kolam(bln, 900000, '[]', k1) ->> 'id')::uuid;
    id_d2 := (public.simpan_kolam(bln, 600000, '[]', k2) ->> 'id')::uuid;
    r := public.setujui_kolam(id_d1);
    perform pg_temp.cek('draf baru disetujui: Rp300.000 per orang', r ->> 'status' = 'disetujui'
      and (select sum(rupiah) from public.kolam_bagian where kolam_id = id_d1) = 900000
      and (select k ->> 'nilai' from public.slip_gaji s, jsonb_array_elements(s.komponen) k where s.periode_id = per and s.orang_id = o_sari and k ->> 'kode' = 'insentif_beban') = '300000', r::text);
    execute 'reset role';
    update public.periode_gaji set status = 'disetujui', disetujui_at = now() where id = per;
    select jsonb_agg(to_jsonb(s) order by s.id) into v_slip from public.slip_gaji s where s.periode_id = per;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.setujui_kolam(id_d2);
      perform pg_temp.cek('slip disetujui: draf lain tidak bisa disetujui', false);
    exception when others then perform pg_temp.cek('slip disetujui: draf lain tidak bisa disetujui', sqlstate = '55000' and sqlerrm like 'Gaji September 2026 sudah disetujui%', sqlerrm);
    end;
    begin
      perform public.batal_kolam(id_d1, 'Ingin mengganti jumlah');
      perform pg_temp.cek('slip disetujui: pembagian tidak bisa dibatalkan', false);
    exception when others then perform pg_temp.cek('slip disetujui: pembagian tidak bisa dibatalkan', sqlstate = '55000', sqlerrm);
    end;
    begin
      perform public.simpan_kolam(bln, 700000, '[]', gen_random_uuid());
      perform pg_temp.cek('slip disetujui: kolam baru untuk bulan itu ditolak', false);
    exception when others then perform pg_temp.cek('slip disetujui: kolam baru untuk bulan itu ditolak', sqlstate = '55000', sqlerrm);
    end;
    r := public.hitung_kolam(bln, 700000, '[]');
    perform pg_temp.cek('pratinjau memberi tahu slip terkunci dan kolam yang sudah disetujui', (r ->> 'slip_terkunci')::boolean
      and (r #>> '{disetujui,id}')::uuid = id_d1 and (r #>> '{disetujui,jumlah}')::bigint = 900000, r::text);
    execute 'reset role';
    select jsonb_agg(to_jsonb(s) order by s.id) into v_slip2 from public.slip_gaji s where s.periode_id = per;
    perform pg_temp.cek('slip yang sudah disetujui tidak berubah', v_slip2 = v_slip);
    perform pg_temp.cek('kolam tercatat di audit_log', (select count(*) from public.audit_log where perusahaan_id = pa and tabel = 'kolam_bonus') >= 4);
    execute 'set local role authenticated';

    execute 'set local role anon';
    begin
      perform public.hitung_kolam(bln, 1000000, '[]');
      perform pg_temp.cek('anon tidak memanggil hitung_kolam', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil hitung_kolam', sqlstate = '42501', sqlerrm);
    end;
    begin
      perform public.kolam_saya(null);
      perform pg_temp.cek('anon tidak memanggil kolam_saya', false);
    exception when others then perform pg_temp.cek('anon tidak memanggil kolam_saya', sqlstate = '42501', sqlerrm);
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
