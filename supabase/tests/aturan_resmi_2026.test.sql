-- Tes R-ATURAN26: batas upah JP 2026 dari surat BPJS Ketenagakerjaan B/1226/022026, UMP Bali dan UMK Badung 2026 dari Keputusan
-- Gubernur Bali, semuanya terverifikasi dengan sumber resmi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;

do $$
declare g text;
begin
  perform pg_temp.cek('JP Maret 2026: batas Rp11.086.300, 2% dan 1%, terverifikasi, sumber B/1226/022026',
    exists (select 1 from public.aturan_bertanggal where kunci = 'bpjs.jp' and berlaku_dari = date '2026-03-01' and terverifikasi
      and (nilai ->> 'batas_upah')::bigint = 11086300 and (nilai ->> 'pemberi_kerja')::numeric = 0.02 and (nilai ->> 'pekerja')::numeric = 0.01
      and sumber ~ 'B/1226/022026'));
  perform pg_temp.cek('JP Januari-Februari 2026: batas 2025 Rp10.547.400 sampai 28 Feb',
    exists (select 1 from public.aturan_bertanggal where kunci = 'bpjs.jp' and berlaku_dari = date '2026-01-01' and terverifikasi
      and (nilai ->> 'batas_upah')::bigint = 10547400 and berlaku_sampai = date '2026-02-28'));
  perform pg_temp.cek('tidak ada lagi baris JP terverifikasi tanpa batas upah',
    not exists (select 1 from public.aturan_bertanggal where kunci = 'bpjs.jp' and terverifikasi and nilai -> 'batas_upah' = 'null'::jsonb));
  perform pg_temp.cek('UMP Bali 2026 Rp3.207.459 dari Kepgub 1011/03-M/HK/2025',
    exists (select 1 from public.aturan_bertanggal where kunci = 'ump.bali' and berlaku_dari = date '2026-01-01' and terverifikasi
      and (nilai ->> 'rupiah')::numeric = 3207459 and sumber ~ '1011/03-M/HK/2025' and sumber ~ 'baliprov\.go\.id'));
  perform pg_temp.cek('UMK Badung 2026 Rp3.791.002,57 dari Kepgub 1021/03-M/HK/2025',
    exists (select 1 from public.aturan_bertanggal where kunci = 'umk.badung' and berlaku_dari = date '2026-01-01' and terverifikasi
      and (nilai ->> 'rupiah')::numeric = 3791002.57 and sumber ~ '1021/03-M/HK/2025' and sumber ~ 'baliprov\.go\.id'));
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'aturan_resmi_2026: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
