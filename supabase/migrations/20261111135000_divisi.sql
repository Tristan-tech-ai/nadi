-- X-13 divisi: divisi dengan satu kepala (orang) dan anggota (satu orang boleh di beberapa divisi). Kepala divisi otomatis
-- menjadi penyetuju izin anggotanya (setelah atasan langsung, sebelum delegasi) dan bisa menerima atau meminta revisi hasil kerja
-- anggota divisinya. Katalog peran kustom menambah kerja.kelola dan proyek.kelola untuk staf/akuntan. Kepala divisi tetap staf:
-- tidak membaca gaji, rekening, atau slip orang lain (RLS lama tidak diubah).

create or replace function app.permission_catalog() returns text[]
language sql immutable set search_path = '' as $$ select array['stok.lihat', 'stok.ubah', 'kerja.kelola', 'proyek.kelola']::text[] $$;

create table public.divisi (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (char_length(nama) between 2 and 60),
  kepala_id uuid references public.orang(id),
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, nama)
);
create table public.divisi_anggota (
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  perusahaan_id uuid not null,
  orang_id uuid not null references public.orang(id),
  keluar_at timestamptz,
  primary key (divisi_id, orang_id)
);
create index divisi_anggota_orang on public.divisi_anggota (orang_id);
create index divisi_kepala on public.divisi (kepala_id);

-- Divisi tempat orang sesi ini anggota atau kepala (definer: dipakai RLS).
create function app.divisi_saya() returns setof uuid language sql stable security definer set search_path = '' as $$
  select d.id from public.divisi d where d.perusahaan_id = app.pid() and d.kepala_id = app.orang_saya()
  union select da.divisi_id from public.divisi_anggota da where da.perusahaan_id = app.pid() and da.orang_id = app.orang_saya() and da.keluar_at is null
$$;
revoke all on function app.divisi_saya() from public, anon;
grant execute on function app.divisi_saya() to authenticated;

alter table public.divisi enable row level security;
alter table public.divisi_anggota enable row level security;
create policy divisi_baca on public.divisi for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and id in (select app.divisi_saya()))));
create policy divisi_anggota_baca on public.divisi_anggota for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and divisi_id in (select app.divisi_saya()))));
grant select on public.divisi, public.divisi_anggota to authenticated;

create function public.simpan_divisi(p_id uuid, p_nama text, p_kepala uuid, p_anggota uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid; o uuid;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa mengatur divisi.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_nama, ''))) not between 2 and 60 then raise exception 'Nama divisi 2 sampai 60 huruf.' using errcode = '22023'; end if;
  if p_kepala is not null and not exists (select 1 from public.orang where id = p_kepala and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Kepala divisi tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(p_anggota), 0) > 300 then raise exception 'Anggota divisi paling banyak 300 orang.' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.divisi (perusahaan_id, nama, kepala_id) values (v_pid, btrim(p_nama), p_kepala) returning id into v_id;
  else
    update public.divisi set nama = btrim(p_nama), kepala_id = p_kepala where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Divisi tidak ditemukan.' using errcode = 'P0002'; end if;
    -- anggota yang tidak ada di daftar baru ditandai keluar (riwayat tetap ada, tidak dihapus)
    update public.divisi_anggota set keluar_at = now() where divisi_id = v_id and keluar_at is null and not (orang_id = any (coalesce(p_anggota, '{}')));
  end if;
  foreach o in array coalesce(p_anggota, '{}') loop
    if not exists (select 1 from public.orang where id = o and perusahaan_id = v_pid) then raise exception 'Anggota tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
    insert into public.divisi_anggota (divisi_id, perusahaan_id, orang_id) values (v_id, v_pid, o)
    on conflict (divisi_id, orang_id) do update set keluar_at = null;
  end loop;
  return jsonb_build_object('id', v_id, 'anggota', coalesce(cardinality(p_anggota), 0));
end $$;
revoke all on function public.simpan_divisi(uuid, text, uuid, uuid[]) from public, anon;
grant execute on function public.simpan_divisi(uuid, text, uuid, uuid[]) to authenticated;

-- Boleh mengelola kerja ini: pemilik/admin, izin kustom kerja.kelola, atau kepala divisi salah satu pelaksananya. Kepala divisi
-- tidak memutus kerja yang ikut ia kerjakan sendiri (hasil itu tetap ke pemilik/admin).
create function app.boleh_kelola_kerja(p_kerja uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.pid() is not null and app.anggota_aktif() and exists (select 1 from public.kerja k where k.id = p_kerja and k.perusahaan_id = app.pid())
    and (app.izin('kerja.kelola') or (
      exists (select 1 from app.kerja_porsi(app.pid()) kp join public.divisi_anggota da on da.orang_id = kp.orang_id and da.perusahaan_id = app.pid() and da.keluar_at is null
                join public.divisi d on d.id = da.divisi_id
               where kp.kerja_id = p_kerja and d.kepala_id = app.orang_saya())
      and not exists (select 1 from app.kerja_porsi(app.pid()) kp where kp.kerja_id = p_kerja and kp.orang_id = app.orang_saya())))
$$;
revoke all on function app.boleh_kelola_kerja(uuid) from public, anon;
grant execute on function app.boleh_kelola_kerja(uuid) to authenticated;

-- Kerja yang boleh dilihat karena mengelola: semua kerja usaha untuk izin kerja.kelola, kerja anggota divisi untuk kepala divisi
-- (definer: dipakai RLS tanpa rekursi).
create function app.kerja_kelola_saya() returns setof uuid language sql stable security definer set search_path = '' as $$
  select k.id from public.kerja k where k.perusahaan_id = app.pid() and app.izin('kerja.kelola')
  union
  select kp.kerja_id from app.kerja_porsi(app.pid()) kp join public.divisi_anggota da on da.orang_id = kp.orang_id and da.perusahaan_id = app.pid() and da.keluar_at is null
    join public.divisi d on d.id = da.divisi_id where d.kepala_id = app.orang_saya()
$$;
revoke all on function app.kerja_kelola_saya() from public, anon;
grant execute on function app.kerja_kelola_saya() to authenticated;
alter policy kerja_baca on public.kerja using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan']))
  or pelaksana_id = (select app.orang_saya()) or ((select app.anggota_aktif()) and (id in (select app.kerja_saya()) or id in (select app.kerja_kelola_saya())))));
alter policy kerja_pelaksana_baca on public.kerja_pelaksana using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan']))
  or ((select app.anggota_aktif()) and (kerja_id in (select app.kerja_saya()) or kerja_id in (select app.kerja_kelola_saya())))));
alter policy kerja_butir_baca on public.kerja_butir using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan']))
  or ((select app.anggota_aktif()) and (kerja_id in (select app.kerja_saya()) or kerja_id in (select app.kerja_kelola_saya())))));
alter policy kerja_hasil_baca on public.kerja_hasil using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan']))
  or ((select app.anggota_aktif()) and (kerja_id in (select app.kerja_saya()) or kerja_id in (select app.kerja_kelola_saya())))));

-- Review untuk kepala divisi atau pemegang izin kerja.kelola (Feed hanya untuk pemilik/admin).
create function public.daftar_review_kelola() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('usulan', u.id, 'kerja', k.id, 'judul', k.judul, 'oleh', app.nama_rekan(coalesce(h.oleh, k.pelaksana_id)), 'tautan', h.tautan, 'catatan', h.catatan)
           order by u.dibuat_at), '[]')
    from public.usulan u join public.kerja k on k.id::text = u.payload ->> 'kerja_id' and k.perusahaan_id = u.perusahaan_id
    join public.kerja_hasil h on h.id::text = u.payload ->> 'hasil_id' and h.perusahaan_id = u.perusahaan_id
   where u.perusahaan_id = app.pid() and u.aksi = 'kerja.review' and u.status = 'menunggu' and k.status = 'review' and app.boleh_kelola_kerja(k.id)
$$;

create function public.terima_hasil_kerja(p_usulan uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.usulan;
begin
  select * into u from public.usulan where id = p_usulan and perusahaan_id = app.pid() and aksi = 'kerja.review' for update;
  if u.id is null or not (app.anggota_aktif(array['pemilik', 'admin']) or app.boleh_kelola_kerja((u.payload ->> 'kerja_id')::uuid)) then
    raise exception 'Usulan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if u.status <> 'menunggu' then return jsonb_build_object('status', u.status, 'sudah', true); end if;
  update public.usulan set status = 'diterima', diputuskan_oleh = auth.uid(), diputuskan_at = now() where id = u.id;
  update public.kerja set status = 'selesai', selesai_at = now(), diubah_at = now() where id = (u.payload ->> 'kerja_id')::uuid and status = 'review';
  update public.kerja_hasil set status = 'diterima', diputus_oleh = auth.uid(), diputus_at = now()
   where id = (u.payload ->> 'hasil_id')::uuid and perusahaan_id = u.perusahaan_id;
  insert into public.kejadian (perusahaan_id, jenis, sumber, kerja_id, data) values (app.pid(), 'kerja.diterima', 'pwa', (u.payload ->> 'kerja_id')::uuid, jsonb_build_object('oleh', auth.uid()));
  return jsonb_build_object('status', 'diterima');
end $$;
revoke all on function public.daftar_review_kelola(), public.terima_hasil_kerja(uuid) from public, anon;
grant execute on function public.daftar_review_kelola(), public.terima_hasil_kerja(uuid) to authenticated;

-- Potongan fungsi lama.
do $$
declare r record; f text; v_def text;
begin
  create temp table _ganti (urut serial, fungsi text, lama text, baru text) on commit drop;
  insert into _ganti (fungsi, lama, baru) select * from (values
    ('app.penyetuju_atasan(uuid,uuid,date)', 'select a.atasan_id as orang_id, null::uuid as atas_nama, 1 as urut from a, absen where not absen.ya',
       'select a.atasan_id as orang_id, null::uuid as atas_nama, 1 as urut from a, absen where not absen.ya
    union all
    select d.kepala_id, null::uuid, 2 from public.divisi_anggota da join public.divisi d on d.id = da.divisi_id
     where da.orang_id = p_pemohon and da.perusahaan_id = p_pid and da.keluar_at is null and d.kepala_id is not null
       and not exists (select 1 from public.pengajuan_izin i where i.orang_id = d.kepala_id and i.status = ''disetujui''
                        and p_tanggal between i.mulai and i.selesai)'),
    ('app.penyetuju_atasan(uuid,uuid,date)', 'select d.ke_orang, d.dari_orang, 2 from a join public.delegasi_persetujuan d',
       'select d.ke_orang, d.dari_orang, 3 from a join public.delegasi_persetujuan d'),
    ('public.minta_revisi_kerja(uuid,text)', 'if v_pid is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then raise exception ''Hanya pemilik atau admin yang bisa meminta revisi.'' using errcode = ''42501''; end if;',
       'if v_pid is null or not app.anggota_aktif() then raise exception ''Masuk ke usahamu dulu.'' using errcode = ''42501''; end if;'),
    ('public.minta_revisi_kerja(uuid,text)', 'if u.id is null then raise exception ''Usulan tidak ditemukan.'' using errcode = ''P0002''; end if;',
       'if u.id is null then raise exception ''Usulan tidak ditemukan.'' using errcode = ''P0002''; end if;
  if not (app.anggota_aktif(array[''pemilik'', ''admin'']) or app.boleh_kelola_kerja((u.payload ->> ''kerja_id'')::uuid)) then
    raise exception ''Hanya pemilik, admin, atau kepala divisi yang bisa meminta revisi.'' using errcode = ''42501'';
  end if;'),
    ('public.buat_kerja(text,uuid,uuid,timestamp with time zone,uuid)', 'if v_pid is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then',
       'if v_pid is null or not (app.anggota_aktif(array[''pemilik'', ''admin'']) or (app.anggota_aktif() and app.izin(''kerja.kelola''))) then'),
    ('public.atur_pelaksana_kerja(uuid,jsonb)', 'if v_pid is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then',
       'if v_pid is null or not (app.anggota_aktif(array[''pemilik'', ''admin'']) or (app.anggota_aktif() and app.izin(''kerja.kelola''))) then'),
    ('public.buat_proyek(jsonb)', 'if v_pid is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then',
       'if v_pid is null or not (app.anggota_aktif(array[''pemilik'', ''admin'']) or (app.anggota_aktif() and app.izin(''proyek.kelola''))) then'),
    ('public.atur_status_proyek(uuid,text)', 'if app.pid() is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then',
       'if app.pid() is null or not (app.anggota_aktif(array[''pemilik'', ''admin'']) or (app.anggota_aktif() and app.izin(''proyek.kelola''))) then'),
    ('public.simpan_template_proyek(uuid,text,jsonb)', 'if v_pid is null or not app.anggota_aktif(array[''pemilik'', ''admin'']) then',
       'if v_pid is null or not (app.anggota_aktif(array[''pemilik'', ''admin'']) or (app.anggota_aktif() and app.izin(''proyek.kelola''))) then')
  ) t(fungsi, lama, baru);
  for f in select distinct g.fungsi from _ganti g loop
    v_def := pg_get_functiondef(f::regprocedure);
    for r in select * from _ganti g where g.fungsi = f order by g.urut loop
      if (length(v_def) - length(replace(v_def, r.lama, ''))) / length(r.lama) <> 1 then
        raise exception 'divisi: potongan tidak ditemukan tepat satu kali di %: %', r.fungsi, left(r.lama, 80);
      end if;
      v_def := replace(v_def, r.lama, r.baru);
    end loop;
    execute v_def;
  end loop;
end $$;
