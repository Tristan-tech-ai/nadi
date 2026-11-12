-- Tes R-UUPK2 (docs/research/uu-27-2026-cocok.md): aturan pesangon.uu27 sama dengan UU 27/2026 Pasal 232-250 dan
-- apps/web/src/lib/gaji/pesangon.test.ts; pesangon.pp35 hanya untuk PHK sampai 27 Okt 2026; lembur, kompensasi PKWT, dan upah
-- sehari punya baris berlaku 28 Okt 2026 dengan nilai sama dan dasar hukum UU 27/2026 + Pasal 310. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;

do $$
declare a jsonb; g text; x jsonb;
begin
  select nilai into a from public.aturan_bertanggal where kunci = 'pesangon.uu27' and terverifikasi and berlaku_dari = date '2026-10-28';
  perform pg_temp.cek('pesangon.uu27 ada, terverifikasi, berlaku 28 Okt 2026', a is not null);
  perform pg_temp.cek('tabel Pasal 232 ayat (2) dan (3) sama dengan PP 35/2021',
    a -> 'pesangon' = '[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]]'::jsonb
    and a -> 'upmk' = '[[3,2],[6,3],[9,4],[12,5],[15,6],[18,7],[21,8],[24,10]]'::jsonb, coalesce(a::text, 'tidak ada'));
  perform pg_temp.cek('uang pisah paling sedikit 1 bulan (Pasal 233 ayat (2)), mikro kecil kesepakatan (Pasal 250)',
    (a ->> 'uang_pisah_min_bulan')::numeric = 1 and (a ->> 'mikro_kecil_kesepakatan')::boolean);
  perform pg_temp.cek('16 alasan, kode unik', jsonb_array_length(a -> 'alasan') = 16
    and (select count(distinct e ->> 'kode') from jsonb_array_elements(a -> 'alasan') e) = 16);
  for x in select * from jsonb_array_elements('[
      ["tutup_rugi",1,1,false],["tutup_permanen",1,1.5,false],["kahar",1,1,false],["pkpu_pailit",1,1,false],
      ["gabung_tidak_diterima",2,1,false],["pemberi_kerja_melanggar",2,1,false],["pelanggaran",1,1,false],
      ["sakit_panjang",2,2,false],["pensiun",2,1,false],["meninggal",2,1,false],["mundur",0,0,true],["mangkir",0,0,true],
      ["ditahan",0,1,false],["ditahan_rugi",0,0,true]]'::jsonb) loop
    perform pg_temp.cek('pengali ' || (x ->> 0),
      exists (select 1 from jsonb_array_elements(a -> 'alasan') e where e ->> 'kode' = x ->> 0
        and (e ->> 'pesangon')::numeric = (x ->> 1)::numeric and (e ->> 'upmk')::numeric = (x ->> 2)::numeric
        and (e ->> 'pisah')::boolean = (x ->> 3)::boolean and e ->> 'pasal' ~ '^Pasal 2[34][0-9]'));
  end loop;
  perform pg_temp.cek('tidak ada alasan efisiensi (Pasal 231 tidak memuatnya)',
    not exists (select 1 from jsonb_array_elements(a -> 'alasan') e where e ->> 'kode' ~ 'efisiensi'));
  perform pg_temp.cek('pesangon.pp35 ditutup 27 Okt 2026',
    (select berlaku_sampai from public.aturan_bertanggal where kunci = 'pesangon.pp35' and berlaku_dari = date '2021-02-02') = date '2026-10-27');
  perform pg_temp.cek('lembur, kompensasi, upah sehari: baris 28 Okt 2026 bernilai sama dan bersumber UU 27/2026 Pasal 310',
    (select count(*) = 3 and bool_and(n.terverifikasi and n.sumber ~ 'UU 27/2026' and n.sumber ~ 'Pasal 310' and n.nilai = (
        select o.nilai from public.aturan_bertanggal o where o.kunci = n.kunci and o.berlaku_dari < n.berlaku_dari and o.terverifikasi
         order by o.berlaku_dari desc limit 1))
       from public.aturan_bertanggal n
      where n.kunci in ('lembur.pp35', 'kompensasi.pkwt', 'upah.pembagi_harian') and n.berlaku_dari = date '2026-10-28'));
  perform pg_temp.cek('cadangan_pesangon memilih kedua kunci pesangon',
    (select prosrc ~ 'pesangon\.uu27' and prosrc ~ 'berlaku_sampai' from pg_proc where oid = 'public.cadangan_pesangon()'::regprocedure));
  perform pg_temp.cek('anon tetap tidak bisa memanggil cadangan_pesangon', not has_function_privilege('anon', 'public.cadangan_pesangon()', 'execute'));
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'uu27_ketenagakerjaan: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
