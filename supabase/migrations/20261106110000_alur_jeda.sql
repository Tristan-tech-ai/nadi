-- M-20B alur dengan jeda waktu: aksi alur bisa ditunda 1 menit sampai 7 hari ("kirim pengingat 24 jam setelah invoice terbit").
-- Kejadian yang memicu alur berjeda dicatat di flow_tertunda dengan jatuh tempo; pg_cron tiap menit menjalankan yang jatuh tempo
-- bila alurnya masih aktif. Alur yang dimatikan membatalkan semua yang masih menunggu. Jeda 0 = langsung seperti sebelumnya.
alter table public.flow add column jeda_menit integer not null default 0 check (jeda_menit between 0 and 10080);
grant select (jeda_menit) on public.flow to authenticated;

alter table public.flow_run drop constraint flow_run_status_check;
alter table public.flow_run add constraint flow_run_status_check check (status in ('jalan', 'dibatasi', 'gagal', 'tertunda', 'batal'));

create table public.flow_tertunda (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  flow_id uuid not null references public.flow(id) on delete cascade,
  run_id uuid not null references public.flow_run(id) on delete cascade,
  kejadian_id uuid,
  data jsonb not null,
  jatuh_tempo timestamptz not null,
  status text not null default 'menunggu' check (status in ('menunggu', 'jalan', 'batal', 'gagal')),
  catatan text,
  dibuat_at timestamptz not null default now()
);
create index flow_tertunda_tempo on public.flow_tertunda (jatuh_tempo) where status = 'menunggu';
create index flow_tertunda_flow on public.flow_tertunda (flow_id) where status = 'menunggu';
alter table public.flow_tertunda enable row level security;
create policy flow_tertunda_baca on public.flow_tertunda for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.flow_tertunda to authenticated;

-- Aksi satu alur untuk satu kejadian (dipakai langsung maupun dari antrean jeda). Galat aksi menandai jalan gagal tanpa membatalkan kejadian.
create or replace function app.flow_jalankan_aksi(p_flow uuid, p_data jsonb, p_kejadian uuid, p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.flow; a jsonb; i int := 0; v_body jsonb; v_rid bigint; k public.kejadian;
begin
  select * into f from public.flow where id = p_flow;
  select * into k from public.kejadian where id = p_kejadian;
  perform set_config('app.dalam_alur', '1', true);
  begin
    for a in select * from jsonb_array_elements(f.aksi) loop
      i := i + 1;
      if a ->> 'jenis' = 'kartu' then
        insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
        values (f.perusahaan_id, 'alur', 'info.alur', left(app.isi_templat(a ->> 'judul', p_data), 140), left('Dari alur ' || f.nama || '.', 300),
                jsonb_build_object('alur', f.id, 'kejadian', p_kejadian, 'run', p_run), array['pemilik', 'admin'], md5('alur:' || p_run || ':' || i)::uuid);
      elsif a ->> 'jenis' = 'kerja' then
        insert into public.kerja (perusahaan_id, judul, data) values (f.perusahaan_id, left(app.isi_templat(a ->> 'judul', p_data), 300),
          jsonb_build_object('alur', f.id, 'kejadian', p_kejadian));
      elsif a ->> 'jenis' = 'webhook' then
        if (select count(*) from public.flow_webhook w where w.perusahaan_id = f.perusahaan_id and w.at > now() - interval '1 hour') >= 200 then
          raise exception 'Batas 200 webhook per jam tercapai';
        end if;
        v_body := jsonb_build_object('alur', f.nama, 'alur_id', f.id, 'jalan_id', p_run,
          'kejadian', jsonb_build_object('id', p_kejadian, 'jenis', k.jenis, 'terjadi_at', k.terjadi_at, 'nilai', k.nilai, 'data', coalesce(k.data, '{}'::jsonb) - 'oleh'));
        v_rid := net.http_post(url := a ->> 'url', body := v_body,
          headers := jsonb_build_object('Content-Type', 'application/json', 'X-Nadi-Tanda', 'sha256=' || encode(extensions.hmac(p_run::text, f.rahasia, 'sha256'), 'hex')),
          timeout_milliseconds := 5000);
        insert into public.flow_webhook (perusahaan_id, flow_id, run_id, url, request_id) values (f.perusahaan_id, f.id, p_run, a ->> 'url', v_rid);
      end if;
    end loop;
  exception when others then
    update public.flow_run set status = 'gagal', catatan = left(sqlerrm, 300) where id = p_run;
  end;
  perform set_config('app.dalam_alur', '', true);
end $$;

create or replace function app.flow_on_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.flow; v_data jsonb; v_run uuid; n int;
begin
  if coalesce(current_setting('app.dalam_alur', true), '') = '1' then return null; end if;
  if not exists (select 1 from public.flow x where x.perusahaan_id = new.perusahaan_id and x.aktif and x.pemicu = new.jenis) then return null; end if;
  v_data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('jenis', new.jenis, 'nilai', new.nilai);
  for f in select * from public.flow x where x.perusahaan_id = new.perusahaan_id and x.aktif and x.pemicu = new.jenis
              and (x.form_id is null or x.form_id::text = new.data ->> 'formulir') order by x.dibuat_at limit 20 loop
    continue when not app.cocok_syarat(f.syarat, v_data);
    select count(*) into n from public.flow_run r where r.flow_id = f.id and r.status in ('jalan', 'tertunda') and r.at > now() - interval '1 hour';
    if n >= f.batas_jam or (select count(*) from public.flow_run r where r.perusahaan_id = new.perusahaan_id and r.status in ('jalan', 'tertunda') and r.at > now() - interval '1 hour') >= 1000 then
      insert into public.flow_run (perusahaan_id, flow_id, kejadian_id, status, catatan) values (new.perusahaan_id, f.id, new.id, 'dibatasi', 'Batas jalan per jam tercapai');
      continue;
    end if;
    if f.jeda_menit > 0 then
      insert into public.flow_run (perusahaan_id, flow_id, kejadian_id, status, catatan)
      values (new.perusahaan_id, f.id, new.id, 'tertunda', 'Dijalankan ' || f.jeda_menit || ' menit setelah kejadian') returning id into v_run;
      insert into public.flow_tertunda (perusahaan_id, flow_id, run_id, kejadian_id, data, jatuh_tempo)
      values (new.perusahaan_id, f.id, v_run, new.id, v_data, now() + make_interval(mins => f.jeda_menit));
    else
      insert into public.flow_run (perusahaan_id, flow_id, kejadian_id, status) values (new.perusahaan_id, f.id, new.id, 'jalan') returning id into v_run;
      perform app.flow_jalankan_aksi(f.id, v_data, new.id, v_run);
    end if;
  end loop;
  return null;
end $$;

-- Dipanggil pg_cron tiap menit: aksi yang jatuh tempo dijalankan bila alurnya masih aktif, selain itu dibatalkan.
create or replace function app.flow_jalankan_tertunda(p_batas int default 200) returns int
language plpgsql security definer set search_path = '' as $$
declare t public.flow_tertunda; v_aktif boolean; n int := 0;
begin
  for t in select * from public.flow_tertunda where status = 'menunggu' and jatuh_tempo <= now() order by jatuh_tempo limit p_batas for update skip locked loop
    select aktif into v_aktif from public.flow where id = t.flow_id;
    if coalesce(v_aktif, false) then
      update public.flow_tertunda set status = 'jalan' where id = t.id;
      update public.flow_run set status = 'jalan', catatan = null, at = now() where id = t.run_id;
      perform app.flow_jalankan_aksi(t.flow_id, t.data, t.kejadian_id, t.run_id);
      if (select status from public.flow_run where id = t.run_id) = 'gagal' then update public.flow_tertunda set status = 'gagal' where id = t.id; end if;
    else
      update public.flow_tertunda set status = 'batal', catatan = 'Alur dimatikan sebelum jatuh tempo' where id = t.id;
      update public.flow_run set status = 'batal', catatan = 'Alur dimatikan sebelum jatuh tempo' where id = t.run_id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.set_flow_active(p_flow uuid, p_aktif boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  update public.flow set aktif = p_aktif where id = p_flow and perusahaan_id = v_pid;
  if not found then raise exception 'Alur tidak ditemukan' using errcode = 'P0002'; end if;
  if not p_aktif then
    update public.flow_run set status = 'batal', catatan = 'Alur dimatikan sebelum jatuh tempo'
     where id in (select run_id from public.flow_tertunda where flow_id = p_flow and status = 'menunggu');
    update public.flow_tertunda set status = 'batal', catatan = 'Alur dimatikan sebelum jatuh tempo' where flow_id = p_flow and status = 'menunggu';
  end if;
end $$;

-- save_flow: jeda dalam jam (0 sampai 168) dari isian formulir.
create or replace function public.set_flow_delay(p_flow uuid, p_jam numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  if p_jam is null or p_jam < 0 or p_jam > 168 then raise exception 'Jeda 0 sampai 168 jam' using errcode = '22023'; end if;
  update public.flow set jeda_menit = round(p_jam * 60)::int where id = p_flow and perusahaan_id = v_pid;
  if not found then raise exception 'Alur tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

revoke all on function app.flow_jalankan_aksi(uuid, jsonb, uuid, uuid), app.flow_jalankan_tertunda(int) from public, anon, authenticated;
revoke all on function public.set_flow_delay(uuid, numeric) from public, anon;
grant execute on function public.set_flow_delay(uuid, numeric) to authenticated;
select cron.schedule('nadi-alur-tertunda', '* * * * *', 'select app.flow_jalankan_tertunda()');
