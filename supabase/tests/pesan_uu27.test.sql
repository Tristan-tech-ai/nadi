-- Tes R-UUPK3: tidak ada lagi fungsi database yang mengutip PP 35/2021 atau UU 13/2003; pesan batas lembur dan surat peringatan
-- menyebut pasal UU 27/2026. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
do $$
declare g text;
begin
  perform pg_temp.cek('tidak ada fungsi yang mengutip PP 35/2021 atau UU 13/2003',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'app') and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'PP 35/2021|UU 13/2003'),
    (select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'PP 35/2021|UU 13/2003'));
  perform pg_temp.cek('batas lembur shift dan tukar shift menyebut UU 27/2026 Pasal 116',
    (select bool_and(prosrc ~ 'UU 27/2026 Pasal 116') from pg_proc
      where oid in ('public.simpan_shift(uuid,date,time without time zone,time without time zone,integer,uuid,uuid)'::regprocedure,
                    'app.tolak_batas_pindah(jsonb)'::regprocedure, 'public.catat_lembur(uuid,date,text,integer,text)'::regprocedure)));
  perform pg_temp.cek('surat peringatan menyebut UU 27/2026 Pasal 231 huruf k',
    (select bool_and(prosrc ~ 'UU 27/2026 Pasal 231 huruf k') from pg_proc
      where oid in ('public.beri_sp(uuid,date,text,text,integer,boolean,uuid)'::regprocedure, 'public.terbitkan_sp(uuid)'::regprocedure,
                    'app.tenggat_kepatuhan(uuid,date,date)'::regprocedure)));
  perform pg_temp.cek('hak berhenti menyebut UU 27/2026 Pasal 232 dan 242',
    (select prosrc ~ 'UU 27/2026 Pasal 232 ayat \(4\)' and prosrc ~ 'UU 27/2026 Pasal 242' from pg_proc where oid = 'public.ajukan_hak_berhenti(uuid,jsonb)'::regprocedure));
  perform pg_temp.cek('fungsi tetap tidak bisa dipanggil anon',
    not has_function_privilege('anon', 'public.simpan_shift(uuid,date,time without time zone,time without time zone,integer,uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.beri_sp(uuid,date,text,text,integer,boolean,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.ajukan_hak_berhenti(uuid,jsonb)', 'execute'));
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'pesan_uu27: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
