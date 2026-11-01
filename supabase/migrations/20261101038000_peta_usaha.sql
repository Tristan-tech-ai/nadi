-- F5-02 Peta Usaha langsung (Supabase Realtime Broadcast dari database).
-- Usaha nyata: setiap kejadian mata.meja/mata.antrean disiarkan dengan realtime.send ke topik privat 'peta:<usaha>'; kebijakan
-- realtime.messages hanya mengizinkan pemilik/admin usaha itu (keanggotaan sungguhan lewat app.peran_aktif) menerima topiknya.
-- Demo: denah sintetis per usaha demo (zona_mata) dengan status di app.peta_demo; pg_cron menjalankan simulasi tiap menit yang
-- mengubah dua zona dan menyiarkannya ke topik publik 'peta-demo:<kunci>' tanpa menulis kejadian.
-- Sumber: docs Supabase Broadcast dan Realtime Authorization (loop/LEARN.md). Tes: supabase/tests/peta_usaha.test.sql.

create policy peta_usaha_terima on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast')
         and (select realtime.topic()) = 'peta:' || (select app.pid())::text
         and (select app.peran_aktif()) in ('pemilik', 'admin'));

create or replace function app.siar_peta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object('zona', new.data ->> 'zona', 'status', new.data ->> 'status', 'jumlah', (new.data ->> 'jumlah')::int, 'sejak', new.terjadi_at)),
    'zona', 'peta:' || new.perusahaan_id, true);
  return null;
end $$;

create trigger siar_peta after insert on public.kejadian
  for each row when (new.jenis in ('mata.meja', 'mata.antrean')) execute function app.siar_peta();

-- Status zona demo (diperbarui di tempat, tidak menumpuk).
create table app.peta_demo (
  zona_id uuid primary key references public.zona_mata(id) on delete cascade,
  status text check (status in ('kosong', 'terisi')),
  jumlah int check (jumlah between 0 and 500),
  sejak timestamptz not null default now()
);

do $$
declare p record; z uuid; i int; kol int; bar int;
begin
  for p in select id, pengaturan ->> 'demo' as kunci from public.perusahaan where pengaturan ? 'demo' loop
    if exists (select 1 from public.zona_mata where perusahaan_id = p.id) then continue; end if;
    if p.kunci = 'fnb' then
      for i in 1..6 loop
        kol := (i - 1) % 3; bar := (i - 1) / 3;
        insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
        values (p.id, 'Meja ' || i, 'meja',
                jsonb_build_array(jsonb_build_array(0.06 + kol * 0.22, 0.12 + bar * 0.4), jsonb_build_array(0.24 + kol * 0.22, 0.12 + bar * 0.4),
                                  jsonb_build_array(0.24 + kol * 0.22, 0.42 + bar * 0.4), jsonb_build_array(0.06 + kol * 0.22, 0.42 + bar * 0.4)), i)
        returning id into z;
        insert into app.peta_demo (zona_id, status) values (z, case when i in (1, 4, 5) then 'terisi' else 'kosong' end);
      end loop;
      insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
      values (p.id, 'Antrean kasir', 'antrean', '[[0.74,0.12],[0.94,0.12],[0.94,0.82],[0.74,0.82]]', 7) returning id into z;
      insert into app.peta_demo (zona_id, jumlah) values (z, 2);
    else
      for i in 1..4 loop
        insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
        values (p.id, 'Rak ' || i, 'rak',
                jsonb_build_array(jsonb_build_array(0.06 + (i - 1) * 0.16, 0.12), jsonb_build_array(0.18 + (i - 1) * 0.16, 0.12),
                                  jsonb_build_array(0.18 + (i - 1) * 0.16, 0.82), jsonb_build_array(0.06 + (i - 1) * 0.16, 0.82)), i)
        returning id into z;
        insert into app.peta_demo (zona_id, jumlah) values (z, (i * 3) % 4);
      end loop;
      insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
      values (p.id, 'Antrean kasir', 'antrean', '[[0.74,0.12],[0.94,0.12],[0.94,0.82],[0.74,0.82]]', 5) returning id into z;
      insert into app.peta_demo (zona_id, jumlah) values (z, 3);
    end if;
  end loop;
end $$;

-- Denah demo untuk siapa saja (tanpa akun): zona, status terakhir, dan topik siaran publiknya.
create or replace function public.peta_demo(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p.id is null then null else jsonb_build_object(
    'topik', 'peta-demo:' || p_kunci,
    'zona', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon,
              'status', d.status, 'jumlah', d.jumlah, 'sejak', d.sejak) order by z.urutan)
            from public.zona_mata z join app.peta_demo d on d.zona_id = z.id where z.perusahaan_id = p.id and z.aktif), '[]'::jsonb))
  end
  from (select (select id from public.perusahaan where pengaturan ->> 'demo' = p_kunci and p_kunci in ('fnb', 'toko')) as id) p
$$;

-- Simulasi demo: dua zona acak per usaha demo berubah (meja dibalik, antrean/rak 0..5 orang), lalu disiarkan publik.
create or replace function app.simulasi_peta_demo() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; r record; n int := 0;
begin
  for p in select id, pengaturan ->> 'demo' as kunci from public.perusahaan where pengaturan ? 'demo' loop
    for r in select d.zona_id, z.jenis, d.status, d.jumlah from app.peta_demo d join public.zona_mata z on z.id = d.zona_id
              where z.perusahaan_id = p.id and z.aktif order by random() limit 2 loop
      if r.jenis = 'meja' then
        update app.peta_demo set status = case when r.status = 'terisi' then 'kosong' else 'terisi' end, sejak = now() where zona_id = r.zona_id;
      else
        update app.peta_demo set jumlah = (coalesce(r.jumlah, 0) + 1 + floor(random() * 4)::int) % 6, sejak = now() where zona_id = r.zona_id;
      end if;
      perform realtime.send(
        (select jsonb_strip_nulls(jsonb_build_object('zona', zona_id, 'status', status, 'jumlah', jumlah, 'sejak', sejak)) from app.peta_demo where zona_id = r.zona_id),
        'zona', 'peta-demo:' || p.kunci, false);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

select cron.schedule('nadi-peta-demo', '* * * * *', 'select app.simulasi_peta_demo()');

revoke all on function app.siar_peta(), app.simulasi_peta_demo() from public, anon, authenticated;
revoke all on function public.peta_demo(text) from public;
grant execute on function public.peta_demo(text) to anon, authenticated;
