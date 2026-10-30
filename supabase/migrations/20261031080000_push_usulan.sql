-- Push otomatis saat usulan baru menunggu: pg_cron tiap menit mengumpulkan usulan yang belum diberitahukan per usaha,
-- paling sering satu kiriman per usaha per 5 menit, lalu pg_net memanggil Edge Function push dengan token acak dari Vault.
create extension if not exists pg_net;

alter table public.usulan add column diberitahu_at timestamptz;
create index usulan_belum_diberitahu on public.usulan (perusahaan_id) where status = 'menunggu' and diberitahu_at is null;

create table app.push_terakhir (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  dikirim_at timestamptz not null
);
revoke all on app.push_terakhir from public, anon, authenticated;

-- Token panggilan database -> Edge Function: dibuat acak di sini, tidak pernah ditulis di repo atau dicetak.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'nadi_push_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'nadi_push_token', 'Token panggilan pg_net ke Edge Function push');
  end if;
end $$;

create or replace function public.push_token_cocok(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'nadi_push_token' and decrypted_secret = p_token);
$$;

-- Langganan pemilik/admin aktif suatu usaha (untuk dikirimi Edge Function atas nama database).
create or replace function public.target_push(p_perusahaan uuid, p_peran text[])
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.endpoint, l.p256dh, l.auth
    from public.langganan_push l
    join public.anggota a on a.perusahaan_id = l.perusahaan_id and a.user_id = l.user_id and a.aktif
   where l.perusahaan_id = p_perusahaan and a.peran = any(p_peran);
$$;
revoke all on function public.push_token_cocok(text), public.target_push(uuid, text[]) from public, anon, authenticated;
grant execute on function public.push_token_cocok(text), public.target_push(uuid, text[]) to service_role;

create or replace function app.kirim_push_usulan() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; k integer := 0; v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
  for r in
    select u.perusahaan_id, count(*) as n, (array_agg(u.judul order by u.dibuat_at desc))[1] as judul, array_agg(u.id) as ids
      from public.usulan u
      left join app.push_terakhir t on t.perusahaan_id = u.perusahaan_id
     where u.status = 'menunggu' and u.diberitahu_at is null and u.dibuat_at > now() - interval '1 day'
       and (t.dikirim_at is null or t.dikirim_at < now() - interval '5 minutes')
     group by u.perusahaan_id
  loop
    perform net.http_post(
      url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/push',
      body := jsonb_build_object('aksi', 'usulan', 'perusahaan_id', r.perusahaan_id, 'jumlah', r.n, 'judul', r.judul),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
      timeout_milliseconds := 10000);
    update public.usulan set diberitahu_at = now() where id = any(r.ids);
    insert into app.push_terakhir (perusahaan_id, dikirim_at) values (r.perusahaan_id, now())
    on conflict (perusahaan_id) do update set dikirim_at = excluded.dikirim_at;
    k := k + 1;
  end loop;
  return k;
end $$;
revoke all on function app.kirim_push_usulan() from public, anon, authenticated;

select cron.schedule('nadi-push-usulan', '* * * * *', 'select app.kirim_push_usulan()');
