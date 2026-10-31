-- F2-04 uji kerja per topi dan IPIP (docs/research/uji-kerja.md). Pelamar tanpa akun mengerjakan dalam 2 jam sejak melamar.
-- Benih soal dibuat database (pelamar tidak memilih soalnya sendiri); soal disusun dan dinilai server Next dari benih yang
-- sama (src/lib/rekrut/uji-kerja.ts), jadi database hanya menyimpan jawaban mentah. IPIP opsional dan tidak dinilai di sini.

create table public.uji_lamaran (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  lamaran_id uuid not null references public.lamaran(id) on delete cascade,
  jenis text not null check (jenis in ('kerja', 'ipip')),
  topi_kode text,
  benih integer,
  jawaban jsonb,
  dibuat_at timestamptz not null default now(),
  selesai_at timestamptz,
  unique (lamaran_id, jenis),
  check (jenis <> 'kerja' or (topi_kode is not null and benih is not null))
);
create index on public.uji_lamaran (perusahaan_id);
alter table public.uji_lamaran enable row level security;
create policy uji_lamaran_baca on public.uji_lamaran for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
grant select on public.uji_lamaran to authenticated;

-- Mulai uji kerja: benih acak sekali per lamaran (memanggil ulang mengembalikan benih yang sama). null bila lowongan tanpa topi.
create or replace function public.uji_mulai(p_lamaran uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare la public.lamaran; v_kode text; u public.uji_lamaran;
begin
  select * into la from public.lamaran where id = p_lamaran and dibuat_at > now() - interval '2 hours';
  if la.id is null then raise exception 'Sesi uji sudah lewat. Lamaranmu tetap tersimpan.' using errcode = 'P0002'; end if;
  select t.kode into v_kode from public.lowongan l join public.topi t on t.id = l.topi_id where l.id = la.lowongan_id;
  if v_kode is null then return null; end if;
  insert into public.uji_lamaran (perusahaan_id, lamaran_id, jenis, topi_kode, benih)
  values (la.perusahaan_id, la.id, 'kerja', v_kode, floor(random() * 2147483647)::integer)
  on conflict (lamaran_id, jenis) do nothing;
  select * into u from public.uji_lamaran where lamaran_id = la.id and jenis = 'kerja';
  return jsonb_build_object('topi', u.topi_kode, 'benih', u.benih, 'selesai', u.selesai_at is not null);
end $$;

-- Kirim jawaban sekali. kerja: larik 1-5 teks pendek. ipip: objek {"1".."50": 1..5}, boleh tidak lengkap (faktor kosong tidak dinilai).
create or replace function public.uji_kirim(p_lamaran uuid, p_jenis text, p_jawaban jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare la public.lamaran; u public.uji_lamaran;
begin
  select * into la from public.lamaran where id = p_lamaran and dibuat_at > now() - interval '2 hours';
  if la.id is null then raise exception 'Sesi uji sudah lewat. Lamaranmu tetap tersimpan.' using errcode = 'P0002'; end if;
  if p_jenis = 'kerja' then
    if jsonb_typeof(p_jawaban) <> 'array' or jsonb_array_length(p_jawaban) not between 1 and 5
       or exists (select 1 from jsonb_array_elements(p_jawaban) e where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 40) then
      raise exception 'Jawaban uji tidak terbaca.' using errcode = '22023';
    end if;
    select * into u from public.uji_lamaran where lamaran_id = la.id and jenis = 'kerja';
    if u.id is null then raise exception 'Uji kerja belum dimulai.' using errcode = 'P0002'; end if;
  elsif p_jenis = 'ipip' then
    if jsonb_typeof(p_jawaban) <> 'object'
       or exists (select 1 from jsonb_each(p_jawaban) e
                   where e.key !~ '^([1-9]|[1-4][0-9]|50)$' or jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[1-5]$') then
      raise exception 'Jawaban tidak terbaca.' using errcode = '22023';
    end if;
    insert into public.uji_lamaran (perusahaan_id, lamaran_id, jenis) values (la.perusahaan_id, la.id, 'ipip')
    on conflict (lamaran_id, jenis) do nothing;
    select * into u from public.uji_lamaran where lamaran_id = la.id and jenis = 'ipip';
  else
    raise exception 'Jenis uji tidak dikenal.' using errcode = '22023';
  end if;
  if u.selesai_at is not null then raise exception 'Bagian ini sudah kamu kirim.' using errcode = '23505'; end if;
  update public.uji_lamaran set jawaban = p_jawaban, selesai_at = now() where id = u.id;
end $$;

revoke all on function public.uji_mulai(uuid), public.uji_kirim(uuid, text, jsonb) from public;
grant execute on function public.uji_mulai(uuid), public.uji_kirim(uuid, text, jsonb) to anon, authenticated;
