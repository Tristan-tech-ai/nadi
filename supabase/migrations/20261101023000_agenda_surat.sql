-- F4-03 Agenda surat masuk dari Lempar (docs/research/agenda-surat.md). Tes: supabase/tests/agenda_surat.test.sql.
-- Menyetujui usulan dokumen.surat di Feed mendaftarkan surat ke agenda_surat dalam transaksi yang sama, lewat trigger pada
-- usulan (pola F1-06: putuskan_usulan tidak disalin ulang; isinya sudah diubah lewat penggantian teks di migrasi Q-24).
-- Nomor agenda dari Nomor Sakti, templat bawaan per usaha AG '{no:3}/AG/{tahun}' (urut ulang tiap tahun, seperti buku agenda).
-- Pihak dicocokkan ke orang usaha itu dengan pg_trgm: ditaut otomatis hanya bila kemiripan >= 0,6 dan unggul >= 0,15 dari kandidat
-- kedua; selain itu sampai dua kandidat (kemiripan >= 0,3) disimpan untuk dipilih manusia, tidak pernah ditebak diam-diam.
-- Surat bernomor sama (tanpa beda huruf besar dan spasi tepi) tidak didaftar dua kali dan tidak memakai nomor agenda.

-- 1. Inti penerbitan nomor dipisah dari pemeriksaan peran. ambil_nomor (dipanggil klien) memeriksa peran lalu memanggil inti;
--    trigger agenda memanggil inti atas nama penyetuju usulan yang sudah diperiksa putuskan_usulan.
create or replace function app.terbit_nomor(p_pid uuid, p_jenis text, p_ref text, p_oleh uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.templat_nomor; v_tgl date; v_periode text; v_urut integer; v_kode text; v_nomor text; v_id uuid;
begin
  select * into t from public.templat_nomor where perusahaan_id = p_pid and jenis = upper(btrim(p_jenis)) and aktif;
  if not found then
    raise exception 'Penomoran untuk jenis % belum diatur', upper(btrim(p_jenis)) using errcode = 'P0002';
  end if;
  v_tgl := app.hari_ini(p_pid);
  v_periode := app.periode_nomor(t.templat, v_tgl);
  insert into app.penomor (perusahaan_id, jenis, periode, terakhir) values (p_pid, t.jenis, v_periode, 1)
  on conflict (perusahaan_id, jenis, periode) do update set terakhir = app.penomor.terakhir + 1
  returning terakhir into v_urut;
  select coalesce(t.kode_usaha, p.kode) into v_kode from public.perusahaan p where p.id = p_pid;
  v_nomor := app.susun_nomor(t.templat, v_urut, v_kode, t.jenis, v_tgl);
  insert into public.nomor_terbit (perusahaan_id, jenis, periode, urut, nomor, tanggal, dokumen_ref, dibuat_oleh)
  values (p_pid, t.jenis, v_periode, v_urut, v_nomor, v_tgl, nullif(btrim(coalesce(p_ref, '')), ''), p_oleh)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nomor', v_nomor, 'urut', v_urut, 'periode', v_periode, 'tanggal', v_tgl);
end $$;
revoke all on function app.terbit_nomor(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.ambil_nomor(p_jenis text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang mengambil nomor dokumen' using errcode = '42501';
  end if;
  return app.terbit_nomor(v_pid, p_jenis, p_ref, auth.uid());
end $$;

-- 2. Agenda surat.
create table public.agenda_surat (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  arah text not null default 'masuk' check (arah in ('masuk', 'keluar')),
  nomor_agenda text not null,
  nomor_terbit_id uuid references public.nomor_terbit(id) on delete set null,
  nomor_surat text check (nomor_surat is null or length(nomor_surat) <= 120),
  jenis text check (jenis is null or length(jenis) <= 120),
  perihal text check (perihal is null or length(perihal) <= 500),
  tanggal_surat date,
  diterima_at timestamptz not null default now(),
  pihak_teks text check (pihak_teks is null or length(pihak_teks) <= 200),
  pihak_orang_id uuid references public.orang(id) on delete set null,
  pihak_yakin real check (pihak_yakin is null or pihak_yakin between 0 and 1),
  pihak_cara text check (pihak_cara in ('otomatis', 'manual')),
  pihak_kandidat jsonb not null default '[]',
  berkas_id uuid references public.berkas(id) on delete set null,
  usulan_id uuid unique references public.usulan(id) on delete set null,
  status text not null default 'baru' check (status in ('baru', 'ditindaklanjuti', 'selesai')),
  catatan text check (catatan is null or length(catatan) <= 500),
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, nomor_agenda)
);
create unique index agenda_surat_nomor_unik on public.agenda_surat (perusahaan_id, arah, lower(nomor_surat)) where nomor_surat is not null;
create index on public.agenda_surat (perusahaan_id, diterima_at desc);
create index on public.agenda_surat (pihak_orang_id);
create index on public.agenda_surat (berkas_id);
create index on public.agenda_surat (nomor_terbit_id);

alter table public.agenda_surat enable row level security;
create policy agenda_surat_baca on public.agenda_surat for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.agenda_surat to authenticated;
create trigger audit_agenda_surat after insert or update or delete on public.agenda_surat for each row execute function app.catat_audit();

-- 3. Dari usulan dokumen.surat yang disetujui.
create or replace function app.agenda_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b jsonb := coalesce(new.payload -> 'bidang', '{}'::jsonb);
  v_nomor text := nullif(btrim(b ->> 'nomor'), '');
  v_pihak text := nullif(btrim(b ->> 'pihak'), '');
  k jsonb := '[]'::jsonb; v_orang uuid; v_yakin real; r jsonb;
begin
  if v_nomor is not null and exists (
    select 1 from public.agenda_surat a where a.perusahaan_id = new.perusahaan_id and a.arah = 'masuk' and lower(a.nomor_surat) = lower(v_nomor)) then
    return null;
  end if;
  if v_pihak is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nama', c.nama, 'yakin', round(c.s::numeric, 2)) order by c.s desc, c.nama), '[]'::jsonb) into k
      from (select o.id, o.nama, extensions.similarity(lower(o.nama), lower(v_pihak)) as s
              from public.orang o where o.perusahaan_id = new.perusahaan_id
             order by s desc, o.nama limit 2) c
     where c.s >= 0.3;
    if jsonb_array_length(k) >= 1 and (k -> 0 ->> 'yakin')::numeric >= 0.6
       and (jsonb_array_length(k) = 1 or (k -> 0 ->> 'yakin')::numeric - (k -> 1 ->> 'yakin')::numeric >= 0.15) then
      v_orang := (k -> 0 ->> 'id')::uuid;
      v_yakin := (k -> 0 ->> 'yakin')::real;
      k := '[]'::jsonb;
    end if;
  end if;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (new.perusahaan_id, 'AG', 'Agenda surat masuk', '{no:3}/AG/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(new.perusahaan_id, 'AG', 'agenda surat ' || coalesce(v_nomor, new.id::text), coalesce(new.diputuskan_oleh, auth.uid()));
  insert into public.agenda_surat (perusahaan_id, arah, nomor_agenda, nomor_terbit_id, nomor_surat, jenis, perihal, tanggal_surat,
                                   pihak_teks, pihak_orang_id, pihak_yakin, pihak_cara, pihak_kandidat, berkas_id, usulan_id)
  values (new.perusahaan_id, 'masuk', r ->> 'nomor', (r ->> 'id')::uuid, left(v_nomor, 120), left(nullif(btrim(b ->> 'jenis'), ''), 120),
          left(nullif(btrim(new.payload ->> 'ringkasan'), ''), 500), app.tanggal_teks(btrim(b ->> 'tanggal')),
          left(v_pihak, 200), v_orang, v_yakin, case when v_orang is not null then 'otomatis' end, k, new.berkas_id, new.id);
  return null;
end $$;
revoke all on function app.agenda_dari_usulan() from public, anon, authenticated;
create trigger agenda_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'dokumen.surat' and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.agenda_dari_usulan();

-- 4. Tindak lanjut oleh pemilik/admin.
create or replace function public.taut_pihak_surat(p_agenda uuid, p_orang uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menautkan pihak surat' using errcode = '42501';
  end if;
  if p_orang is not null and not exists (select 1 from public.orang o where o.id = p_orang and o.perusahaan_id = v_pid) then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  update public.agenda_surat
     set pihak_orang_id = p_orang, pihak_cara = case when p_orang is null then null else 'manual' end, pihak_yakin = null
   where id = p_agenda and perusahaan_id = v_pid;
  if not found then
    raise exception 'Agenda surat tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.ubah_status_surat(p_agenda uuid, p_status text, p_catatan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengubah status surat' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('baru', 'ditindaklanjuti', 'selesai') then
    raise exception 'Status surat: baru, ditindaklanjuti, atau selesai' using errcode = '22023';
  end if;
  update public.agenda_surat set status = p_status, catatan = left(nullif(btrim(coalesce(p_catatan, '')), ''), 500)
   where id = p_agenda and perusahaan_id = v_pid;
  if not found then
    raise exception 'Agenda surat tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.taut_pihak_surat(uuid, uuid), public.ubah_status_surat(uuid, text, text) from public, anon;
grant execute on function public.taut_pihak_surat(uuid, uuid), public.ubah_status_surat(uuid, text, text) to authenticated;
