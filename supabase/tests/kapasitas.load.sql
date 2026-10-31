-- Q-02 uji muat (docs/quality/kapasitas.md): 50 usaha sintetis x 15 orang, absen masuk+pulang 30 hari, 2 izin per orang,
-- 1 usulan per usaha per hari, slip gaji satu bulan. Semua di satu transaksi yang dibatalkan oleh RAISE di akhir, jadi data
-- nyata tidak berubah. Hasil (JSON di pesan galat): selisih ukuran per tabel (heap + indeks + TOAST, semua partisi), byte per
-- baris, dan waktu kueri Feed serta laporan absen untuk satu usaha di tengah muatan.
do $$
declare
  t0 timestamptz := clock_timestamp(); sebelum jsonb; sesudah jsonb; hasil jsonb := '{}'::jsonb; rencana text; x text;
  pid uuid; oid_ uuid; per uuid; satu uuid; d int; i int; p int;
  tabel text[] := array['perusahaan', 'orang', 'kejadian', 'usulan', 'slip_gaji', 'audit_log', 'ringkasan_harian'];
  baris jsonb := '{}'::jsonb;
begin
  -- ukuran semua partisi (kejadian/audit_log dipartisi pg_partman) termasuk indeks dan TOAST; tabel biasa tidak punya pohon partisi
  select jsonb_object_agg(t, coalesce((select sum(pg_total_relation_size(r.relid)) from pg_partition_tree(('public.' || t)::regclass) r), pg_total_relation_size(('public.' || t)::regclass))) into sebelum from unnest(tabel) t;
  select jsonb_object_agg(t, 0) into baris from unnest(tabel) t;

  for p in 1..50 loop
    insert into public.perusahaan (nama, industri, pengaturan) values ('Uji Muat ' || p, case when p % 2 = 0 then 'fnb' else 'toko' end, '{}') returning id into pid;
    if p = 25 then satu := pid; end if;
    insert into public.periode_gaji (perusahaan_id, bulan) values (pid, date '2026-10-01') returning id into per;
    for i in 1..15 loop
      insert into public.orang (perusahaan_id, nama, telepon, id_staf, data)
      values (pid, 'Karyawan ' || p || '-' || i, '+62812' || lpad((p * 100 + i)::text, 7, '0'), 'S' || lpad(i::text, 3, '0'),
              jsonb_build_object('jabatan', case i % 4 when 0 then 'Kasir' when 1 then 'Pelayan' when 2 then 'Koki' else 'Gudang' end, 'mulai', '2025-01-06'))
      returning id into oid_;
      for d in 1..30 loop
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, data)
        values (pid, date_trunc('day', now()) - (d || ' days')::interval + interval '1 hour', 'absen.masuk', 'pwa', oid_,
                '{"wajah": {"lulus": true, "kedip": true, "menoleh": "kiri"}, "salah_sebelum": 0}'),
               (pid, date_trunc('day', now()) - (d || ' days')::interval + interval '9 hours', 'absen.pulang', 'pwa', oid_,
                '{"wajah": {"lulus": true, "kedip": true, "menoleh": "kanan"}, "salah_sebelum": 0}');
      end loop;
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, data)
      select pid, now() - (k * 9 || ' days')::interval, 'izin.sakit', 'pwa', oid_, '{"hari": 1, "alasan": "Demam, sudah ke puskesmas", "otomatis": true}'
        from generate_series(1, 2) k;
      insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen)
      values (pid, per, oid_, '[{"kode":"pokok","label":"Gaji pokok","jenis":"pendapatan","nilai":3500000,"sumber":"orang"},
        {"kode":"tunjangan","label":"Tunjangan tetap","jenis":"pendapatan","nilai":500000,"sumber":"orang"},
        {"kode":"bpjs_kes_pk","label":"BPJS Kesehatan (usaha)","jenis":"pemberi_kerja","nilai":160000,"sumber":"bpjs.kesehatan"},
        {"kode":"bpjs_kes","label":"BPJS Kesehatan (karyawan)","jenis":"potongan","nilai":40000,"sumber":"bpjs.kesehatan"},
        {"kode":"jht","label":"JHT (karyawan)","jenis":"potongan","nilai":80000,"sumber":"bpjs.tk"},
        {"kode":"pph21","label":"PPh 21","jenis":"potongan","nilai":0,"sumber":"pph21.ter"}]');
    end loop;
    for d in 1..30 loop
      insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, keyakinan, dampak_rp, status, dibuat_at)
      values (pid, 'lempar', 'uang.keluar', 'Catat belanja pasar Rp' || (100000 + d * 1000), 'Dibaca dari nota, 6 baris barang',
              jsonb_build_object('jenis', 'nota', 'bidang', jsonb_build_object('total', 100000 + d * 1000, 'tanggal', current_date - d, 'baris',
                jsonb_build_array(jsonb_build_object('nama', 'Beras 5 kg', 'qty', 1, 'harga', 72000), jsonb_build_object('nama', 'Telur 1 kg', 'qty', 1, 'harga', 28000)))),
              0.92, 100000 + d * 1000, case when d > 3 then 'diterima' else 'menunggu' end, now() - (d || ' days')::interval);
    end loop;
  end loop;

  select jsonb_object_agg(t, coalesce((select sum(pg_total_relation_size(r.relid)) from pg_partition_tree(('public.' || t)::regclass) r), pg_total_relation_size(('public.' || t)::regclass))) into sesudah from unnest(tabel) t;
  baris := jsonb_build_object('perusahaan', 50, 'orang', 750, 'kejadian', 750 * 62, 'usulan', 1500, 'slip_gaji', 750,
    'audit_log', (select count(*) from public.audit_log where terjadi_at >= now()), 'ringkasan_harian', 0);
  foreach x in array tabel loop
    hasil := hasil || jsonb_build_object(x, jsonb_build_object('byte', (sesudah ->> x)::bigint - (sebelum ->> x)::bigint, 'baris', baris -> x,
      'byte_per_baris', case when (baris ->> x)::int > 0 then round(((sesudah ->> x)::bigint - (sebelum ->> x)::bigint)::numeric / (baris ->> x)::int) end));
  end loop;

  -- Waktu kueri di tengah muatan (paket rencana dengan ANALYZE, satu usaha dari 50).
  analyze public.kejadian; analyze public.usulan; analyze public.orang;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'app_metadata', json_build_object('pid', satu, 'prn', 'pemilik'))::text, true);
  execute 'explain (analyze, format text) select id, judul from public.usulan where perusahaan_id = $1 and status = ''menunggu''
    order by tenggat nulls last, dampak_rp desc nulls last, dibuat_at desc limit 20' into rencana using satu;
  hasil := hasil || jsonb_build_object('feed_rencana_baris1', rencana);
  for rencana in execute 'explain (analyze, format text) select orang_id, count(*) from public.kejadian where perusahaan_id = $1 and jenis like ''absen.%''
    and terjadi_at >= now() - interval ''30 days'' group by orang_id' using satu loop
    if rencana like '%Execution Time%' then hasil := hasil || jsonb_build_object('absen30_waktu', rencana); end if;
  end loop;
  for rencana in execute 'explain (analyze, format text) select id, judul from public.usulan where perusahaan_id = $1 and status = ''menunggu''
    order by tenggat nulls last, dampak_rp desc nulls last, dibuat_at desc limit 20' using satu loop
    if rencana like '%Execution Time%' then hasil := hasil || jsonb_build_object('feed_waktu', rencana); end if;
  end loop;
  hasil := hasil || jsonb_build_object('durasi_isi_detik', round(extract(epoch from clock_timestamp() - t0)::numeric, 1));
  raise exception 'HASIL_MUAT %', hasil::text;
end $$;
