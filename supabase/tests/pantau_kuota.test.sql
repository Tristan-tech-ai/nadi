-- Tes pantau_kuota: ukuran nyata tercatat tanpa peringatan; batas kecil (merah sengaja) memunculkan peringatan sekali per hari;
-- fungsi dan tabel tertutup bagi pengguna. Transaksi dibatalkan lewat RAISE EXCEPTION; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;

do $$
declare r jsonb; n int;
begin
  r := app.ukur_kuota();
  insert into _t values ('ukuran nyata di bawah 80%: tanpa peringatan', not exists (select 1 from app.peringatan_platform), r::text);
  insert into _t values ('baris harian tercatat sekali per tanggal', (select count(*) = 1 from app.kuota_harian where tanggal = (now() at time zone 'Asia/Makassar')::date), null);
  -- batas penyimpanan dipilih di bawah pemakaian nyata; database baru (lokal) tanpa berkas memakai batas 1 byte
  r := app.ukur_kuota(10000000, least(1000000, greatest((r ->> 'storage_byte')::bigint, 1)));
  select count(*) into n from app.peringatan_platform;
  insert into _t values ('batas kecil (merah sengaja): peringatan database (+ penyimpanan bila ada berkas)',
    n = 1 + (case when (r ->> 'storage_byte')::bigint > 0 then 1 else 0 end), (select string_agg(pesan, ' | ') from app.peringatan_platform));
  perform app.ukur_kuota(10000000, 1000000);
  insert into _t values ('peringatan tidak berulang di hari yang sama', (select count(*) from app.peringatan_platform) = n, n::text);
  insert into _t values ('jadwal cron terpasang', exists (select 1 from cron.job where jobname = 'nadi-kuota' and schedule = '15 17 * * *'), null);
  set local role authenticated;
  begin
    perform app.ukur_kuota();
    insert into _t values ('pengguna tidak bisa memanggil ukur_kuota', false, null);
  exception when insufficient_privilege then insert into _t values ('pengguna tidak bisa memanggil ukur_kuota', true, null);
  end;
  begin
    perform count(*) from app.peringatan_platform;
    insert into _t values ('peringatan platform tertutup', false, null);
  exception when insufficient_privilege then insert into _t values ('peringatan platform tertutup', true, null);
  end;
  reset role;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%] | %', total, gagal, (select string_agg(info, ' || ') from _t where nama like 'ukuran%' or nama like 'batas%');
end $$;
