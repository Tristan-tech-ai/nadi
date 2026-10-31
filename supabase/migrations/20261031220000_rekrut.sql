-- Rekrut (F2-01, docs/research/rekrut.md): lowongan per topi dengan kode publik, lamaran tanpa akun lewat RPC anon berbatas laju,
-- unggah CV ke jalur lamar (Storage INSERT anon hanya untuk berkas lamar berstatus unggah < 10 menit), lalu database memanggil
-- Edge Function baca-berkas lewat pg_net dengan token internal di Vault (pola fungsi push) sehingga CV menjadi usulan rekrut.pelamar.

create table public.lowongan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  topi_id uuid references public.topi(id) on delete set null,
  judul text not null check (char_length(judul) between 3 and 120),
  ringkasan text check (char_length(ringkasan) <= 1000),
  kode text not null unique check (kode ~ '^[A-HJ-NP-Z2-9]{8}$'),
  buka boolean not null default true,
  kuota_harian integer not null default 50 check (kuota_harian between 1 and 500),
  dibuat_at timestamptz not null default now()
);
create index on public.lowongan (perusahaan_id);
create index on public.lowongan (topi_id);

create table public.lamaran (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  lowongan_id uuid not null references public.lowongan(id) on delete cascade,
  nama text not null,
  telepon text,
  berkas_id uuid references public.berkas(id) on delete set null,
  status text not null default 'masuk' check (status in ('masuk', 'diproses', 'usulan', 'gagal')),
  dibuat_at timestamptz not null default now()
);
create index on public.lamaran (lowongan_id, dibuat_at);
create index on public.lamaran (perusahaan_id);
create index on public.lamaran (berkas_id);

alter table public.lowongan enable row level security;
alter table public.lamaran enable row level security;
create policy lowongan_kelola on public.lowongan for all to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()))
  with check (perusahaan_id = (select app.pid()) and (select app.pengelola()));
create policy lamaran_baca on public.lamaran for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select, insert, update on public.lowongan to authenticated;
grant select on public.lamaran to authenticated;

-- Kode 8 huruf tanpa karakter mirip (I, O, 0, 1).
create or replace function app.kode_lowongan() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), '')
    from (select extensions.gen_random_bytes(8) as b) x, generate_series(0, 7) i
$$;
alter table public.lowongan alter column kode set default app.kode_lowongan();

-- Halaman publik: judul, ringkasan, nama usaha. Tanpa data lain.
create or replace function public.lowongan_publik(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('judul', l.judul, 'ringkasan', l.ringkasan, 'usaha', p.nama, 'buka', l.buka)
    from public.lowongan l join public.perusahaan p on p.id = l.perusahaan_id where l.kode = upper(p_kode)
$$;

-- Daftar lamaran + slot unggah CV. Batas: lowongan buka, kuota harian, 3 kali per nomor HP, berkas sama tidak dihitung dua kali.
create or replace function public.lamar_daftar(p_kode text, p_nama text, p_telepon text, p_sha256 text, p_mime text, p_ukuran bigint)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.lowongan; v_hp text := app.hp_normal(p_telepon); v_nama text := btrim(coalesce(p_nama, '')); v_ext text; b public.berkas; v_lamaran uuid;
begin
  select * into l from public.lowongan where kode = upper(coalesce(p_kode, ''));
  if l.id is null or not l.buka then raise exception 'Lowongan ini sudah ditutup atau tautannya salah.' using errcode = 'P0002'; end if;
  if char_length(v_nama) not between 2 and 120 then raise exception 'Tulis nama lengkapmu.' using errcode = '22023'; end if;
  if v_hp is null then raise exception 'Tulis nomor HP yang aktif, misalnya 0812 3456 7890.' using errcode = '22023'; end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then raise exception 'Berkas CV tidak terbaca. Pilih ulang berkasnya.' using errcode = '22023'; end if;
  if p_ukuran is null or p_ukuran <= 0 or p_ukuran > 10485760 then raise exception 'CV paling besar 10 MB.' using errcode = '22023'; end if;
  v_ext := case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
  if v_ext is null then raise exception 'CV harus berupa foto atau PDF.' using errcode = '22023'; end if;
  if (select count(*) from public.lamaran where lowongan_id = l.id and dibuat_at > now() - interval '1 day') >= l.kuota_harian then
    raise exception 'Lowongan ini sedang menerima banyak lamaran. Coba lagi besok.' using errcode = '53400';
  end if;
  if (select count(*) from public.lamaran where lowongan_id = l.id and telepon = v_hp) >= 3 then
    raise exception 'Nomor HP ini sudah melamar di lowongan ini.' using errcode = '23505';
  end if;
  select * into b from public.berkas where perusahaan_id = l.perusahaan_id and sha256 = p_sha256;
  if b.id is null then
    insert into public.berkas (perusahaan_id, jalur, nama_asli, mime, ukuran, sha256, status)
    values (l.perusahaan_id, l.perusahaan_id || '/lamar/' || p_sha256 || '.' || v_ext, 'CV ' || v_nama || '.' || v_ext, p_mime, p_ukuran, p_sha256, 'unggah')
    returning * into b;
  end if;
  insert into public.lamaran (perusahaan_id, lowongan_id, nama, telepon, berkas_id) values (l.perusahaan_id, l.id, v_nama, v_hp, b.id) returning id into v_lamaran;
  return jsonb_build_object('lamaran', v_lamaran, 'berkas', b.id, 'jalur', b.jalur, 'perlu_unggah', b.status = 'unggah');
end $$;

-- Storage: anon hanya boleh mengunggah ke jalur berkas lamar yang baru didaftarkan dan masih berstatus unggah.
create policy berkas_unggah_lamar on storage.objects for insert to anon
  with check (
    bucket_id = 'berkas'
    and (storage.foldername(name))[2] = 'lamar'
    and exists (select 1 from public.berkas b
                 where b.jalur = name and b.status = 'unggah' and b.diunggah_oleh is null and b.dibuat_at > now() - interval '10 minutes'));

-- Setelah unggah: tandai antre dan minta baca-berkas lewat pg_net dengan token internal.
create or replace function public.lamar_selesai(p_lamaran uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare la public.lamaran; b public.berkas; v_token text;
begin
  select * into la from public.lamaran where id = p_lamaran and status = 'masuk' and dibuat_at > now() - interval '30 minutes';
  if la.id is null then raise exception 'Lamaran tidak ditemukan' using errcode = 'P0002'; end if;
  select * into b from public.berkas where id = la.berkas_id;
  if b.status = 'unggah' then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'berkas' and o.name = b.jalur) then
      raise exception 'CV belum terunggah. Coba kirim lagi.' using errcode = '55000';
    end if;
    update public.berkas set status = 'antre', diubah_at = now() where id = b.id;
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
    perform net.http_post(
      url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/baca-berkas',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
      body := jsonb_build_object('berkas_id', b.id, 'sumber', 'lamar'));
  end if;
  update public.lamaran set status = 'diproses' where id = la.id;
  return jsonb_build_object('status', 'diproses');
end $$;

-- Lamaran menjadi 'usulan' saat baca-berkas membuat usulan untuk berkasnya.
create or replace function app.lamaran_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.berkas_id is not null then
    update public.lamaran set status = 'usulan' where berkas_id = new.berkas_id and status in ('masuk', 'diproses');
  end if;
  return new;
end $$;
create trigger lamaran_usulan after insert on public.usulan for each row execute function app.lamaran_dari_usulan();

revoke all on function public.lowongan_publik(text), public.lamar_daftar(text, text, text, text, text, bigint), public.lamar_selesai(uuid) from public;
grant execute on function public.lowongan_publik(text), public.lamar_daftar(text, text, text, text, text, bigint), public.lamar_selesai(uuid) to anon, authenticated;
