-- Gerbang keputusan cepat v1 (F1-06, docs/research/keputusan.md): setiap keputusan otomatis tercatat dengan alasan dan latensi,
-- bisa dibatalkan (akibatnya dibalik), dan p50/p95 latensi bisa diringkas. Titik pakai: izin.otopilot (pengajuan_izin yang
-- disetujui otopilot) dan usulan.rute (usulan uang besar hanya untuk pemilik). Tingkat model menyusul (F1-06B).

create table public.keputusan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null,
  subjek_id uuid not null,
  tingkat text not null check (tingkat in ('aturan', 'model', 'manusia')),
  pilihan text not null,
  peluang jsonb,
  yakin real check (yakin is null or yakin between 0 and 1),
  alasan text not null,
  latensi_ms real not null check (latensi_ms >= 0),
  model text,
  dibuat_at timestamptz not null default now(),
  dibatalkan_at timestamptz,
  dibatalkan_oleh uuid,
  alasan_batal text
);
create index on public.keputusan (perusahaan_id, dibuat_at desc);
create index on public.keputusan (subjek_id);
alter table public.keputusan enable row level security;
create policy keputusan_baca on public.keputusan for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.keputusan to authenticated;

-- Izin yang disetujui otopilot: dicatat saat baris pengajuan masuk. Latensi = sejak awal transaksi RPC ajukan_izin.
create or replace function app.catat_keputusan_izin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.oleh_otopilot and new.status = 'disetujui' then
    insert into public.keputusan (perusahaan_id, jenis, subjek_id, tingkat, pilihan, yakin, alasan, latensi_ms)
    values (new.perusahaan_id, 'izin.otopilot', new.id, 'aturan', 'setujui', 1, new.alasan_putusan,
            extract(epoch from clock_timestamp() - now()) * 1000);
  end if;
  return new;
end $$;
create trigger keputusan_izin after insert on public.pengajuan_izin for each row execute function app.catat_keputusan_izin();

-- Rute usulan baru: uang dengan dampak >= ambang usaha (bawaan Rp5.000.000) hanya untuk pemilik. Hanya untuk usulan yang
-- memakai peran bawaan; yang tidak tertangkap aturan dicatat sebagai 'manusia' (tetap ke pemilik dan admin).
create or replace function app.rute_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t0 timestamptz := clock_timestamp(); ambang numeric; v_tingkat text; v_pilihan text; v_alasan text;
begin
  if new.untuk_peran is distinct from array['pemilik', 'admin'] then return new; end if;
  select coalesce((p.pengaturan ->> 'ambang_rute_pemilik')::numeric, 5000000) into ambang from public.perusahaan p where p.id = new.perusahaan_id;
  if new.aksi like 'uang.%' and coalesce(new.dampak_rp, 0) >= ambang then
    new.untuk_peran := array['pemilik'];
    v_tingkat := 'aturan'; v_pilihan := 'pemilik';
    v_alasan := 'Uang ' || app.rupiah(new.dampak_rp) || ', di atas batas ' || app.rupiah(ambang) || ': hanya pemilik yang memutuskan.';
  elsif split_part(new.aksi, '.', 1) in ('uang', 'absen', 'izin', 'orang', 'dokumen', 'rekrut') then
    v_tingkat := 'aturan'; v_pilihan := 'pemilik_admin';
    v_alasan := 'Urusan ' || split_part(new.aksi, '.', 1) || ' harian: pemilik atau admin boleh memutuskan.';
  else
    v_tingkat := 'manusia'; v_pilihan := 'pemilik_admin';
    v_alasan := 'Belum ada aturan untuk jenis ini; diserahkan ke pemilik dan admin.';
  end if;
  insert into public.keputusan (perusahaan_id, jenis, subjek_id, tingkat, pilihan, yakin, alasan, latensi_ms)
  values (new.perusahaan_id, 'usulan.rute', new.id, v_tingkat, v_pilihan, case when v_tingkat = 'aturan' then 1 end, v_alasan,
          extract(epoch from clock_timestamp() - t0) * 1000);
  return new;
end $$;
create trigger rute_usulan before insert on public.usulan for each row execute function app.rute_usulan();

-- Rp1.250.000 (VOICE.md) untuk alasan keputusan.
create or replace function app.rupiah(p numeric) returns text
language sql immutable set search_path = '' as $$
  select 'Rp' || replace(to_char(round(coalesce(p, 0)), 'FM999G999G999G999G990'), ',', '.')
$$;

-- Batalkan keputusan otomatis: akibat dibalik, siapa/kapan/mengapa dicatat.
create or replace function public.batalkan_keputusan(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k public.keputusan; iz public.pengajuan_izin; v_usulan uuid;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  if coalesce(btrim(p_alasan), '') = '' then raise exception 'Tulis alasan membatalkan.' using errcode = '22023'; end if;
  select * into k from public.keputusan where id = p_id and perusahaan_id = app.pid() for update;
  if k.id is null then raise exception 'Keputusan tidak ditemukan' using errcode = 'P0002'; end if;
  if k.dibatalkan_at is not null then raise exception 'Keputusan ini sudah dibatalkan.' using errcode = '55000'; end if;
  if k.tingkat = 'manusia' then raise exception 'Tidak ada tindakan otomatis yang bisa dibatalkan di sini.' using errcode = '55000'; end if;

  if k.jenis = 'izin.otopilot' then
    update public.pengajuan_izin set status = 'menunggu', oleh_otopilot = false, diputuskan_at = null,
           alasan_putusan = 'Persetujuan otomatis dibatalkan: ' || btrim(p_alasan) || '. Menunggu keputusan pemilik atau admin.'
     where id = k.subjek_id and status = 'disetujui' returning * into iz;
    if iz.id is null then raise exception 'Pengajuan sudah berubah; batalkan lewat keputusan terbarunya.' using errcode = '55000'; end if;
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, data)
    values (iz.perusahaan_id, iz.mulai::timestamp at time zone 'Asia/Makassar', 'izin.batal', 'pwa', iz.orang_id, -iz.hari,
            jsonb_build_object('pengajuan_id', iz.id, 'keputusan_id', k.id));
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, tenggat)
    values (iz.perusahaan_id, 'pwa', 'izin.setujui',
            'Setujui ' || iz.jenis || ' ' || (select nama from public.orang where id = iz.orang_id) || ' ' || iz.hari || ' hari',
            'Persetujuan otomatis dibatalkan: ' || btrim(p_alasan) || '.',
            jsonb_build_object('pengajuan_id', iz.id, 'orang_id', iz.orang_id, 'jenis', iz.jenis, 'mulai', iz.mulai, 'selesai', iz.selesai, 'hari', iz.hari),
            iz.mulai::timestamp at time zone 'Asia/Makassar')
    returning id into v_usulan;
    update public.pengajuan_izin set usulan_id = v_usulan where id = iz.id;
  elsif k.jenis = 'usulan.rute' then
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = k.subjek_id and status = 'menunggu';
  end if;

  update public.keputusan set dibatalkan_at = now(), dibatalkan_oleh = (select auth.uid()), alasan_batal = btrim(p_alasan) where id = k.id;
  return jsonb_build_object('id', k.id, 'jenis', k.jenis, 'usulan', v_usulan);
end $$;

-- Ringkasan per jenis dan tingkat: jumlah, dibatalkan, p50 dan p95 latensi (ms).
create or replace function public.ringkasan_keputusan(p_hari integer default 30)
returns table (jenis text, tingkat text, jumlah bigint, dibatalkan bigint, p50_ms double precision, p95_ms double precision)
language sql stable security invoker set search_path = '' as $$
  select k.jenis, k.tingkat, count(*), count(*) filter (where k.dibatalkan_at is not null),
         percentile_cont(0.5) within group (order by k.latensi_ms), percentile_cont(0.95) within group (order by k.latensi_ms)
    from public.keputusan k
   where k.perusahaan_id = (select app.pid()) and k.dibuat_at > now() - make_interval(days => greatest(p_hari, 1))
   group by k.jenis, k.tingkat order by k.jenis, k.tingkat
$$;

revoke all on function public.batalkan_keputusan(uuid, text), public.ringkasan_keputusan(integer) from public, anon;
grant execute on function public.batalkan_keputusan(uuid, text), public.ringkasan_keputusan(integer) to authenticated;
