-- X-12 proyek operasional: proyek (dimensi proyek M-08 yang sudah ada) diberi PIC, status, tipe sekali/berulang/berkelanjutan,
-- klien, tim, dan periode. Template proyek berisi kerja + checklist; membuat proyek dari template membuat semua kerja dan
-- butirnya dalam satu transaksi (gagal satu, batal semua). Proyek berulang membuka periode baru dan kerjanya otomatis lewat
-- pg_cron tanpa menutup proyek induk; kerja periode lama tetap di periodenya. Invoice bisa diterbitkan dari proyek.

create table public.proyek_template (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (char_length(nama) between 3 and 80),
  isi jsonb not null check (jsonb_typeof(isi) = 'array' and jsonb_array_length(isi) between 1 and 50 and pg_column_size(isi) <= 32768),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now()
);

create table public.proyek_info (
  dimension_id uuid primary key references public.dimension(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  pic uuid references public.orang(id),
  status text not null default 'jalan' check (status in ('rencana', 'jalan', 'tunda', 'selesai', 'batal')),
  tipe text not null default 'sekali' check (tipe in ('sekali', 'berulang', 'berkelanjutan')),
  pola text check (pola is null or pola in ('mingguan', 'bulanan')),
  klien uuid references public.customer(id),
  mulai date not null,
  target date,
  template_id uuid references public.proyek_template(id),
  dibuat_at timestamptz not null default now(),
  check (tipe <> 'berulang' or (pola is not null and template_id is not null)),
  check (target is null or target >= mulai)
);

create table public.proyek_tim (
  dimension_id uuid not null references public.dimension(id) on delete cascade,
  perusahaan_id uuid not null,
  orang_id uuid not null references public.orang(id),
  primary key (dimension_id, orang_id)
);

create table public.proyek_periode (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dimension_id uuid not null references public.dimension(id) on delete cascade,
  mulai date not null,
  akhir date not null check (akhir >= mulai),
  label text not null,
  dibuat_at timestamptz not null default now(),
  unique (dimension_id, mulai)
);

alter table public.kerja add column proyek_id uuid references public.dimension(id), add column periode_id uuid references public.proyek_periode(id);
create index kerja_proyek on public.kerja (proyek_id, periode_id) where proyek_id is not null;

create table public.proyek_invoice (
  invoice_id uuid primary key references public.invoice(id) on delete cascade,
  dimension_id uuid not null references public.dimension(id) on delete cascade,
  perusahaan_id uuid not null,
  dibuat_at timestamptz not null default now()
);

-- Proyek tempat orang sesi ini menjadi anggota tim (definer: dipakai RLS tanpa rekursi).
create function app.proyek_saya() returns setof uuid language sql stable security definer set search_path = '' as $$
  select t.dimension_id from public.proyek_tim t where t.perusahaan_id = app.pid() and t.orang_id = app.orang_saya()
$$;
revoke all on function app.proyek_saya() from public, anon;
grant execute on function app.proyek_saya() to authenticated;

alter table public.proyek_template enable row level security;
alter table public.proyek_info enable row level security;
alter table public.proyek_tim enable row level security;
alter table public.proyek_periode enable row level security;
alter table public.proyek_invoice enable row level security;
create policy proyek_template_baca on public.proyek_template for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])));
create policy proyek_info_baca on public.proyek_info for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and dimension_id in (select app.proyek_saya()))));
create policy proyek_tim_baca on public.proyek_tim for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and dimension_id in (select app.proyek_saya()))));
create policy proyek_periode_baca on public.proyek_periode for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and dimension_id in (select app.proyek_saya()))));
create policy proyek_invoice_baca on public.proyek_invoice for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])));
grant select on public.proyek_template, public.proyek_info, public.proyek_tim, public.proyek_periode, public.proyek_invoice to authenticated;

-- Validasi isi template: [{judul 3-300, poin 0-99 opsional, hari 0-365 (dari mulai periode), butir: [teks 1-200] maks 20}].
create function app.cek_isi_template(p_isi jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare e jsonb; b jsonb;
begin
  if jsonb_typeof(p_isi) <> 'array' or jsonb_array_length(p_isi) not between 1 and 50 then raise exception 'Template berisi 1 sampai 50 kerja.' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_isi) loop
    if jsonb_typeof(e) <> 'object' or char_length(btrim(coalesce(e ->> 'judul', ''))) not between 3 and 300 then raise exception 'Setiap kerja di template butuh judul 3 sampai 300 huruf.' using errcode = '22023'; end if;
    if e ? 'hari' and (jsonb_typeof(e -> 'hari') <> 'number' or (e ->> 'hari')::numeric not between 0 and 365) then raise exception 'Hari tenggat 0 sampai 365.' using errcode = '22023'; end if;
    if e ? 'poin' and (jsonb_typeof(e -> 'poin') <> 'number' or (e ->> 'poin')::numeric not between 0 and 99) then raise exception 'Poin 0 sampai 99.' using errcode = '22023'; end if;
    if e ? 'butir' and (jsonb_typeof(e -> 'butir') <> 'array' or jsonb_array_length(e -> 'butir') > 20) then raise exception 'Butir checklist maksimal 20 per kerja.' using errcode = '22023'; end if;
    for b in select * from jsonb_array_elements(coalesce(e -> 'butir', '[]')) loop
      if jsonb_typeof(b) <> 'string' or char_length(btrim(b #>> '{}')) not between 1 and 200 then raise exception 'Butir checklist 1 sampai 200 huruf.' using errcode = '22023'; end if;
    end loop;
  end loop;
end $$;

create function public.simpan_template_proyek(p_id uuid, p_nama text, p_isi jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin.' using errcode = '42501'; end if;
  perform app.cek_isi_template(p_isi);
  if char_length(btrim(coalesce(p_nama, ''))) not between 3 and 80 then raise exception 'Nama template 3 sampai 80 huruf.' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.proyek_template (perusahaan_id, nama, isi) values (v_pid, btrim(p_nama), p_isi) returning id into v_id;
  else
    update public.proyek_template set nama = btrim(p_nama), isi = p_isi where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Template tidak ditemukan.' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Pratinjau: daftar kerja yang akan dibuat, dengan tenggat dari tanggal mulai (tanpa menulis apa pun).
create function public.pratinjau_template(p_template uuid, p_mulai date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when app.anggota_aktif(array['pemilik', 'admin']) then
    (select coalesce(jsonb_agg(jsonb_build_object('judul', btrim(e ->> 'judul'), 'poin', e -> 'poin',
       'tenggat', case when e ? 'hari' then (coalesce(p_mulai, app.hari_ini(app.pid())) + (e ->> 'hari')::int) end,
       'butir', coalesce(e -> 'butir', '[]')) order by o), '[]')
       from public.proyek_template t, jsonb_array_elements(t.isi) with ordinality x(e, o)
      where t.id = p_template and t.perusahaan_id = app.pid())
  end
$$;

-- Batas periode berjalan menurut pola di zona usaha.
create function app.periode_berisi(p_pola text, p_tanggal date) returns table (mulai date, akhir date, label text) language sql immutable set search_path = '' as $$
  select case p_pola when 'mingguan' then date_trunc('week', p_tanggal)::date else date_trunc('month', p_tanggal)::date end,
         case p_pola when 'mingguan' then date_trunc('week', p_tanggal)::date + 6 else (date_trunc('month', p_tanggal) + interval '1 month - 1 day')::date end,
         case p_pola when 'mingguan' then 'Minggu ' || to_char(date_trunc('week', p_tanggal), 'IYYY-IW') else to_char(p_tanggal, 'YYYY-MM') end
$$;

-- Buat kerja + butir dari template untuk satu proyek/periode (dipakai buat_proyek dan cron berulang).
create function app.kerja_dari_template(p_pid uuid, p_proyek uuid, p_periode uuid, p_template uuid, p_mulai date, p_pic uuid, p_oleh uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare e jsonb; v_kerja uuid; n integer := 0; v_zona text := app.zona(p_pid); b jsonb; i integer;
begin
  for e in select x from public.proyek_template t, jsonb_array_elements(t.isi) x where t.id = p_template and t.perusahaan_id = p_pid loop
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, tenggat, poin_beban, proyek_id, periode_id)
    values (p_pid, btrim(e ->> 'judul'), p_pic,
            case when e ? 'hari' then ((p_mulai + (e ->> 'hari')::int)::timestamp + time '17:00') at time zone v_zona end,
            (e ->> 'poin')::numeric, p_proyek, p_periode)
    returning id into v_kerja;
    i := 0;
    for b in select * from jsonb_array_elements(coalesce(e -> 'butir', '[]')) loop
      insert into public.kerja_butir (perusahaan_id, kerja_id, judul, urutan, dibuat_oleh) values (p_pid, v_kerja, btrim(b #>> '{}'), i, p_oleh);
      i := i + 1;
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.buat_proyek(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_dim uuid; v_tipe text := coalesce(p ->> 'tipe', 'sekali'); v_pola text := nullif(p ->> 'pola', '');
  v_mulai date := coalesce(nullif(p ->> 'mulai', '')::date, app.hari_ini(app.pid())); v_template uuid := nullif(p ->> 'template_id', '')::uuid;
  v_pic uuid := nullif(p ->> 'pic', '')::uuid; v_klien uuid := nullif(p ->> 'klien', '')::uuid; v_periode uuid; per record; n integer := 0; o text;
  v_mulai_kerja date := v_mulai;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa membuat proyek.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p ->> 'nama', ''))) not between 3 and 120 then raise exception 'Nama proyek 3 sampai 120 huruf.' using errcode = '22023'; end if;
  if v_tipe not in ('sekali', 'berulang', 'berkelanjutan') then raise exception 'Tipe proyek tidak dikenal.' using errcode = '22023'; end if;
  if v_tipe = 'berulang' and (coalesce(v_pola, '') not in ('mingguan', 'bulanan') or v_template is null) then raise exception 'Proyek berulang butuh pola mingguan atau bulanan dan template.' using errcode = '22023'; end if;
  if v_pic is not null and not exists (select 1 from public.orang where id = v_pic and perusahaan_id = v_pid and status = 'aktif') then raise exception 'PIC tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if v_klien is not null and not exists (select 1 from public.customer where id = v_klien and perusahaan_id = v_pid) then raise exception 'Klien tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if v_template is not null and not exists (select 1 from public.proyek_template where id = v_template and perusahaan_id = v_pid and aktif) then raise exception 'Template tidak ditemukan.' using errcode = 'P0002'; end if;
  insert into public.dimension (perusahaan_id, jenis, nama) values (v_pid, 'proyek', btrim(p ->> 'nama')) returning id into v_dim;
  insert into public.proyek_info (dimension_id, perusahaan_id, pic, tipe, pola, klien, mulai, target, template_id)
  values (v_dim, v_pid, v_pic, v_tipe, case when v_tipe = 'berulang' then v_pola end, v_klien, v_mulai, nullif(p ->> 'target', '')::date, v_template);
  for o in select distinct x from jsonb_array_elements_text(coalesce(p -> 'tim', '[]')) x union select v_pic::text where v_pic is not null loop
    if not exists (select 1 from public.orang where id = o::uuid and perusahaan_id = v_pid and status = 'aktif') then raise exception 'Anggota tim tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
    insert into public.proyek_tim (dimension_id, perusahaan_id, orang_id) values (v_dim, v_pid, o::uuid);
  end loop;
  if v_tipe = 'berulang' then
    select * into per from app.periode_berisi(v_pola, v_mulai);
    insert into public.proyek_periode (perusahaan_id, dimension_id, mulai, akhir, label) values (v_pid, v_dim, per.mulai, per.akhir, per.label) returning id into v_periode;
    v_mulai_kerja := per.mulai;
  end if;
  if v_template is not null then
    n := app.kerja_dari_template(v_pid, v_dim, v_periode, v_template, v_mulai_kerja, v_pic, auth.uid());
  end if;
  return jsonb_build_object('id', v_dim, 'kerja', n, 'periode', v_periode);
end $$;

create function public.atur_status_proyek(p_proyek uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin.' using errcode = '42501'; end if;
  if p_status not in ('rencana', 'jalan', 'tunda', 'selesai', 'batal') then raise exception 'Status proyek tidak dikenal.' using errcode = '22023'; end if;
  update public.proyek_info set status = p_status where dimension_id = p_proyek and perusahaan_id = app.pid();
  if not found then raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', p_proyek, 'status', p_status);
end $$;

-- Cron harian: proyek berulang yang berjalan membuka periode yang memuat hari ini (zona usaha) bila belum ada, lalu kerjanya.
create function app.proyek_berulang_jalankan() returns integer language plpgsql security definer set search_path = '' as $$
declare r record; per record; v_periode uuid; n integer := 0;
begin
  for r in select pi.* from public.proyek_info pi where pi.tipe = 'berulang' and pi.status = 'jalan' and pi.template_id is not null loop
    select * into per from app.periode_berisi(r.pola, app.hari_ini(r.perusahaan_id));
    if r.target is not null and per.mulai > r.target then continue; end if;
    insert into public.proyek_periode (perusahaan_id, dimension_id, mulai, akhir, label) values (r.perusahaan_id, r.dimension_id, per.mulai, per.akhir, per.label)
    on conflict (dimension_id, mulai) do nothing returning id into v_periode;
    if v_periode is not null then
      perform app.kerja_dari_template(r.perusahaan_id, r.dimension_id, v_periode, r.template_id, per.mulai, r.pic, null);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
comment on function app.proyek_berulang_jalankan() is
  'Cron proyek berulang lintas usaha; periode dihitung per usaha dengan app.hari_ini (tidak memakai tanggal UTC).';

create function public.buat_invoice_proyek(p_proyek uuid, p_uraian text, p_nilai bigint, p_jatuh_tempo date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); pi public.proyek_info; v_klien text; v_hp text; r jsonb;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin', 'akuntan']) then raise exception 'Hanya pemilik, admin, atau akuntan.' using errcode = '42501'; end if;
  select * into pi from public.proyek_info where dimension_id = p_proyek and perusahaan_id = v_pid;
  if pi.dimension_id is null then raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002'; end if;
  if pi.klien is null then raise exception 'Isi klien proyek dulu.' using errcode = '22023'; end if;
  select c.nama, c.hp into v_klien, v_hp from public.customer c where c.id = pi.klien;
  r := public.buat_invoice(v_klien, v_hp, jsonb_build_array(jsonb_build_object('uraian', coalesce(nullif(btrim(p_uraian), ''), 'Jasa proyek'), 'jumlah', 1, 'harga', p_nilai)),
                           p_jatuh_tempo, 'Proyek: ' || (select nama from public.dimension where id = p_proyek), md5('proyek-invoice:' || p_proyek || ':' || p_uraian || ':' || p_nilai)::uuid);
  insert into public.proyek_invoice (invoice_id, dimension_id, perusahaan_id) values ((r ->> 'id')::uuid, p_proyek, v_pid) on conflict do nothing;
  return r;
end $$;

revoke all on function public.simpan_template_proyek(uuid, text, jsonb), public.pratinjau_template(uuid, date), public.buat_proyek(jsonb),
  public.atur_status_proyek(uuid, text), public.buat_invoice_proyek(uuid, text, bigint, date) from public, anon;
grant execute on function public.simpan_template_proyek(uuid, text, jsonb), public.pratinjau_template(uuid, date), public.buat_proyek(jsonb),
  public.atur_status_proyek(uuid, text), public.buat_invoice_proyek(uuid, text, bigint, date) to authenticated;
revoke all on function app.cek_isi_template(jsonb), app.periode_berisi(text, date), app.kerja_dari_template(uuid, uuid, uuid, uuid, date, uuid, uuid),
  app.proyek_berulang_jalankan() from public, anon, authenticated;

select cron.schedule('nadi-proyek-berulang', '45 23 * * *', 'select app.proyek_berulang_jalankan()');
