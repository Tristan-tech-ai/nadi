-- Pemantau kuota paket Free (Q-03): ukuran database (batas 500 MB, lewat batas = hanya-baca) dan storage (1 GB), diukur harian.
-- Pada 80% atau lebih, peringatan dicatat sekali per hari per jenis dan muncul di log Postgres. Egress (10 GB) tidak terbaca
-- dari SQL; dipantau dari halaman pemakaian. Sumber batas: supabase.com/docs/guides/platform/database-size,
-- .../platform/manage-your-usage/storage-size, .../storage/serving/bandwidth (diakses 31 Okt 2026).

insert into public.konfigurasi (kunci, nilai, catatan) values
  ('kuota_free', '{"db_byte": 524288000, "storage_byte": 1073741824, "ambang": 0.8}',
   'Batas paket Free: database 500 MB, storage 1 GB; peringatan pada 80%. docs Supabase database-size dan storage-size, 31 Okt 2026')
on conflict (kunci) do update set nilai = excluded.nilai, catatan = excluded.catatan, diubah_at = now();

create table app.kuota_harian (
  tanggal date primary key,
  db_byte bigint not null,
  storage_byte bigint not null,
  dicatat_at timestamptz not null default now()
);

create table app.peringatan_platform (
  id uuid primary key default app.uuid7(),
  tanggal date not null,
  jenis text not null,
  pesan text not null,
  dibuat_at timestamptz not null default now(),
  unique (tanggal, jenis)
);
revoke all on app.kuota_harian, app.peringatan_platform from public, anon, authenticated;

-- Ukur sekarang. Batas bisa diganti lewat parameter (untuk uji); bawaan dari konfigurasi kuota_free.
create or replace function app.ukur_kuota(p_batas_db bigint default null, p_batas_storage bigint default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k jsonb := (select nilai from public.konfigurasi where kunci = 'kuota_free');
  v_db bigint := (select sum(pg_database_size(datname))::bigint from pg_catalog.pg_database);
  v_st bigint := (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects);
  b_db bigint := coalesce(p_batas_db, (k ->> 'db_byte')::bigint, 524288000);
  b_st bigint := coalesce(p_batas_storage, (k ->> 'storage_byte')::bigint, 1073741824);
  ambang numeric := coalesce((k ->> 'ambang')::numeric, 0.8);
  v_tgl date := (now() at time zone 'Asia/Makassar')::date;
  hasil jsonb;
begin
  insert into app.kuota_harian (tanggal, db_byte, storage_byte) values (v_tgl, v_db, v_st)
  on conflict (tanggal) do update set db_byte = excluded.db_byte, storage_byte = excluded.storage_byte, dicatat_at = now();
  if v_db >= b_db * ambang then
    insert into app.peringatan_platform (tanggal, jenis, pesan)
    values (v_tgl, 'kuota.db', format('Database %s MB dari %s MB (%s%%). Di atas batas, proyek menjadi hanya-baca.',
            round(v_db / 1048576.0), round(b_db / 1048576.0), round(100.0 * v_db / b_db)))
    on conflict (tanggal, jenis) do nothing;
    raise warning 'nadi kuota database % dari % byte', v_db, b_db;
  end if;
  if v_st >= b_st * ambang then
    insert into app.peringatan_platform (tanggal, jenis, pesan)
    values (v_tgl, 'kuota.storage', format('Storage %s MB dari %s MB (%s%%).', round(v_st / 1048576.0), round(b_st / 1048576.0), round(100.0 * v_st / b_st)))
    on conflict (tanggal, jenis) do nothing;
    raise warning 'nadi kuota storage % dari % byte', v_st, b_st;
  end if;
  hasil := jsonb_build_object('db_byte', v_db, 'storage_byte', v_st, 'db_persen', round(100.0 * v_db / b_db, 1), 'storage_persen', round(100.0 * v_st / b_st, 1));
  return hasil;
end $$;
revoke all on function app.ukur_kuota(bigint, bigint) from public, anon, authenticated;

select cron.schedule('nadi-kuota', '15 17 * * *', $$select app.ukur_kuota()$$);
select app.ukur_kuota();
