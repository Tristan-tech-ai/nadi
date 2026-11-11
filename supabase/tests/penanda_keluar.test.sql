-- Tes Q-44: anggota tim kerja dan anggota divisi yang keluar tidak dihapus, barisnya diberi lepas_at / keluar_at. Kode yang
-- membaca tabel itu tanpa menyaring penanda akan diam-diam menghitung orang yang sudah keluar. Tes ini gagal bila ada fungsi
-- di public/app atau kebijakan RLS yang menyebut kerja_pelaksana tanpa lepas_at atau divisi_anggota tanpa keluar_at.
-- Pemindai dibuktikan bisa merah dengan fungsi contoh yang lupa menyaring (dibuat dan dibuang di transaksi ini).
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;

create function pg_temp.lupa() returns table (nama text) language sql stable as $$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app') and p.prokind = 'f'
     and ((pg_get_functiondef(p.oid) ~ 'kerja_pelaksana' and pg_get_functiondef(p.oid) !~ 'lepas_at')
       or (pg_get_functiondef(p.oid) ~ 'divisi_anggota' and pg_get_functiondef(p.oid) !~ 'keluar_at'))
  union all
  select 'kebijakan ' || tablename || '.' || policyname from pg_policies
   where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'kerja_pelaksana' and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'lepas_at'
      or (coalesce(qual, '') || coalesce(with_check, '')) ~ 'divisi_anggota' and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'keluar_at'
$$;

-- Bukti pemindai bisa merah.
create function app.uji_lupa_penanda() returns bigint language sql stable set search_path = '' as $$
  select count(*) from public.kerja_pelaksana
$$;
select pg_temp.cek('pemindai menangkap fungsi yang lupa menyaring lepas_at', exists (select 1 from pg_temp.lupa() where nama = 'app.uji_lupa_penanda'));
drop function app.uji_lupa_penanda();

-- Keadaan sebenarnya.
select pg_temp.cek('tidak ada fungsi atau kebijakan yang lupa menyaring penanda keluar', count(*) = 0, string_agg(nama, ', ')) from pg_temp.lupa();
select pg_temp.cek('kolom penanda ada', (select count(*) from information_schema.columns where table_schema = 'public'
  and (table_name, column_name) in (('kerja_pelaksana', 'lepas_at'), ('divisi_anggota', 'keluar_at'))) = 2);
select pg_temp.cek('PIC tidak bisa bertanda lepas', exists (select 1 from pg_constraint where conrelid = 'public.kerja_pelaksana'::regclass
  and contype = 'c' and pg_get_constraintdef(oid) ~ 'lepas_at'));
select pg_temp.cek('indeks baris aktif ada', (select count(*) from pg_indexes where schemaname = 'public'
  and indexname in ('kerja_pelaksana_aktif', 'divisi_anggota_aktif') and indexdef ~ '(lepas_at|keluar_at) IS NULL') = 2);

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
