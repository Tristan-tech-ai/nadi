-- F3-07D (docs/design/serah-terima-layar.md "Wawancara keluar"): tautan sekali pakai untuk orang yang berhenti, 3 pertanyaan
-- tetap, jawaban hanya dibaca pemilik. Token nmw_ hanya disimpan sebagai sha256 (app.hash_token); pembukaan dan pengiriman lewat
-- RPC anon yang memeriksa token di dalam; satu jawaban per paket berhenti.

create table if not exists public.wawancara_keluar (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  berhenti_id uuid not null unique references public.berhenti(id) on delete cascade,
  token_hash text not null unique,
  jawaban jsonb check (jawaban is null or jsonb_typeof(jawaban) = 'object'),
  dijawab_at timestamptz,
  dibuat_oleh uuid references auth.users(id) on delete set null,
  dibuat_at timestamptz not null default now()
);
create index if not exists wawancara_keluar_perusahaan on public.wawancara_keluar (perusahaan_id);
alter table public.wawancara_keluar enable row level security;
revoke all on public.wawancara_keluar from public, anon, authenticated;
grant select on public.wawancara_keluar to authenticated;
-- Jawaban hanya dibaca pemilik (bukan admin, bukan staf), memakai keanggotaan aktif sungguhan.
create policy wawancara_keluar_baca on public.wawancara_keluar for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) = 'pemilik');

-- Pemilik membuat (atau mengganti, selama belum dijawab) tautan untuk satu paket berhenti yang masih disiapkan.
create or replace function public.buat_tautan_keluar(p_berhenti uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_token text := app.token_baru('nmw_'); w public.wawancara_keluar;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang membuat tautan wawancara keluar.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.berhenti where id = p_berhenti and perusahaan_id = v_pid and status = 'disiapkan') then
    raise exception 'Paket berhenti tidak ditemukan.' using errcode = 'P0002';
  end if;
  select * into w from public.wawancara_keluar where berhenti_id = p_berhenti;
  if w.dijawab_at is not null then raise exception 'Wawancara keluar ini sudah dijawab.' using errcode = '23505'; end if;
  insert into public.wawancara_keluar (perusahaan_id, berhenti_id, token_hash, dibuat_oleh)
  values (v_pid, p_berhenti, app.hash_token(v_token), (select auth.uid()))
  on conflict (berhenti_id) do update set token_hash = excluded.token_hash, dibuat_oleh = excluded.dibuat_oleh, dibuat_at = now();
  return v_token;
end $$;
revoke all on function public.buat_tautan_keluar(uuid) from public, anon;
grant execute on function public.buat_tautan_keluar(uuid) to authenticated;

-- Tanpa akun: nama usaha dan nama orang saja (tanpa isi paket), dan apakah sudah dijawab.
create or replace function public.buka_wawancara_keluar(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('usaha', pr.nama, 'nama', o.nama, 'sudah', w.dijawab_at is not null)
    into r
    from public.wawancara_keluar w join public.berhenti b on b.id = w.berhenti_id
    join public.orang o on o.id = b.orang_id join public.perusahaan pr on pr.id = w.perusahaan_id
   where w.token_hash = app.hash_token(coalesce(p_token, '')) and b.status <> 'batal';
  if r is null then raise exception 'Tautan ini tidak berlaku.' using errcode = 'P0002'; end if;
  return r;
end $$;
revoke all on function public.buka_wawancara_keluar(text) from public;
grant execute on function public.buka_wawancara_keluar(text) to anon, authenticated;

-- Sekali kirim: tiga jawaban teks, masing-masing paling panjang 1.000 huruf, minimal satu terisi.
create or replace function public.kirim_wawancara_keluar(p_token text, p_membantu text, p_berat text, p_ubah text) returns void
language plpgsql security definer set search_path = '' as $$
declare w public.wawancara_keluar; j jsonb;
begin
  select wk.* into w from public.wawancara_keluar wk join public.berhenti b on b.id = wk.berhenti_id
   where wk.token_hash = app.hash_token(coalesce(p_token, '')) and b.status <> 'batal' for update of wk;
  if w.id is null then raise exception 'Tautan ini tidak berlaku.' using errcode = 'P0002'; end if;
  if w.dijawab_at is not null then raise exception 'Jawabanmu sudah terkirim. Terima kasih.' using errcode = '23505'; end if;
  j := jsonb_build_object('membantu', nullif(trim(coalesce(p_membantu, '')), ''), 'berat', nullif(trim(coalesce(p_berat, '')), ''),
                          'ubah', nullif(trim(coalesce(p_ubah, '')), ''));
  if exists (select 1 from jsonb_each_text(j) e where length(e.value) > 1000) then
    raise exception 'Setiap jawaban paling panjang 1.000 huruf.' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_each(j) e where e.value <> 'null'::jsonb) = 0 then
    raise exception 'Isi minimal satu jawaban.' using errcode = '22023';
  end if;
  update public.wawancara_keluar set jawaban = j, dijawab_at = now() where id = w.id;
end $$;
revoke all on function public.kirim_wawancara_keluar(text, text, text, text) from public;
grant execute on function public.kirim_wawancara_keluar(text, text, text, text) to anon, authenticated;
