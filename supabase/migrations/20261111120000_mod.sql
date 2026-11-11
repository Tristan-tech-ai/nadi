-- X-04 Nadi Mod: fitur tambahan berupa manifest (data, bukan kode). Spesifikasi docs/design/MOD.md, riset docs/research/mod.md.
-- Pengaman ditegakkan database, tidak bergantung pada pengawas TypeScript (pengawas.ts tetap memeriksa struktur lengkap):
--   * tabel bersama dengan perusahaan_id + RLS (select app.pid()); mod tidak pernah membuat tabel atau menjalankan SQL;
--   * akses per peran dihitung ulang dan dibatasi di sini (staf/akuntan paling tinggi tulis; pemilik/admin kelola);
--   * setiap catatan divalidasi terhadap manifest aktif: kunci asing ditolak, tipe, wajib, pilihan, https saja untuk tautan,
--     rujukan hanya ke orang/pelanggan/produk/proyek/catatan milik usaha yang sama;
--   * AI (MCP) hanya bisa menulis draf; menerapkan, mematikan, rollback hanya pemilik/admin lewat sesi aplikasi;
--   * batas: 40 mod per usaha, 64 KB manifest, 32 KB per catatan, 20.000 catatan per koleksi, 60 draf dan 2.000 tulis per jam.

create table public.mod (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null check (kode ~ '^[a-z][a-z0-9-]{2,39}$'),
  nama text not null check (length(nama) between 1 and 60),
  sumber text not null default 'sendiri' check (sumber in ('resmi', 'ai', 'sendiri', 'impor')),
  status text not null default 'draf' check (status in ('draf', 'aktif', 'mati')),
  manifest jsonb check (manifest is null or pg_column_size(manifest) <= 65536),
  versi_aktif int,
  draf jsonb check (draf is null or pg_column_size(draf) <= 65536),
  draf_alasan text[] not null default '{}',
  draf_oleh uuid,
  draf_at timestamptz,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, kode),
  unique (perusahaan_id, id)
);
create table public.mod_versi (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  mod_id uuid not null,
  versi int not null,
  manifest jsonb not null,
  diterapkan_oleh uuid,
  diterapkan_at timestamptz not null default now(),
  unique (mod_id, versi),
  foreign key (perusahaan_id, mod_id) references public.mod (perusahaan_id, id) on delete cascade
);
create table public.mod_record (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  mod_id uuid not null,
  koleksi text not null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 32768),
  status text,
  selesai_at timestamptz,
  ditugaskan uuid[] not null default '{}',
  dibuat_oleh uuid not null,
  arsip boolean not null default false,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  foreign key (perusahaan_id, mod_id) references public.mod (perusahaan_id, id) on delete cascade
);
create index mod_record_cari on public.mod_record (perusahaan_id, mod_id, koleksi, dibuat_at desc);
create index mod_record_ditugaskan on public.mod_record using gin (ditugaskan);
create table public.mod_log (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  mod_id uuid not null,
  record_id uuid,
  oleh uuid,
  lewat text not null default 'aplikasi' check (lewat in ('aplikasi', 'mcp')),
  jenis text not null check (jenis in ('draf', 'terapkan', 'matikan', 'nyalakan', 'rollback', 'buat', 'ubah', 'status', 'arsip')),
  dari text,
  ke text,
  at timestamptz not null default now(),
  foreign key (perusahaan_id, mod_id) references public.mod (perusahaan_id, id) on delete cascade
);
create index mod_log_usaha_waktu on public.mod_log (perusahaan_id, at desc);
create index mod_log_record on public.mod_log (record_id, at desc);
create index mod_versi_mod on public.mod_versi (perusahaan_id, mod_id);

-- ---------- pemeriksa inti (cadangan pengawas.ts di database) ----------
create function app.mod_teks_aman(t text, maks int) returns boolean language sql immutable set search_path = '' as $$
  select t is not null and length(btrim(t)) between 1 and maks and t !~ '[<>{}\[\]`$\\|^~[:cntrl:]]'
     and t !~* '(javascript|vbscript|data)\s*:|on[a-z]+\s*=|--|/\*|drop\s+table|delete\s+from|insert\s+into'
$$;

create function app.mod_cek_inti(m jsonb) returns text[] language plpgsql immutable set search_path = '' as $$
declare a text[] := '{}'; k jsonb; b jsonb; kode_k text[] := '{}';
begin
  if m is null or jsonb_typeof(m) <> 'object' then return array['manifest harus objek']; end if;
  if pg_column_size(m) > 65536 then a := a || 'manifest lebih dari 64 KB'::text; end if;
  if m->'skema' is distinct from '1'::jsonb then a := a || 'skema harus 1'::text; end if;
  if coalesce(m->>'kode', '') !~ '^[a-z][a-z0-9-]{2,39}$' then a := a || 'kode mod tidak sah'::text; end if;
  if not app.mod_teks_aman(m->>'nama', 60) then a := a || 'nama tidak sah'::text; end if;
  if jsonb_typeof(m->'koleksi') <> 'array' or jsonb_array_length(m->'koleksi') not between 1 and 10 then return a || 'koleksi harus 1 sampai 10'::text; end if;
  for k in select * from jsonb_array_elements(m->'koleksi') loop
    if coalesce(k->>'kode', '') !~ '^[a-z][a-z0-9_]{1,29}$' or k->>'kode' = any(kode_k) then a := a || ('kode koleksi tidak sah: ' || left(coalesce(k->>'kode', ''), 30)); end if;
    kode_k := kode_k || coalesce(k->>'kode', '');
    if jsonb_typeof(k->'bidang') <> 'array' or jsonb_array_length(k->'bidang') not between 1 and 40 then a := a || 'bidang harus 1 sampai 40'::text; continue; end if;
    for b in select * from jsonb_array_elements(k->'bidang') loop
      if coalesce(b->>'kode', '') !~ '^[a-z][a-z0-9_]{1,29}$' or b->>'kode' in ('id', 'status', 'perusahaan_id', 'mod_id', 'constructor', 'prototype') then a := a || ('kode bidang tidak sah: ' || left(coalesce(b->>'kode', ''), 30)); end if;
      if coalesce(b->>'tipe', '') not in ('teks', 'teks_panjang', 'angka', 'rupiah', 'tanggal', 'tanggal_jam', 'pilihan', 'pilihan_banyak', 'centang', 'tautan', 'telepon',
                                           'berkas', 'orang', 'pelanggan', 'produk', 'proyek', 'rujukan', 'rumus') then a := a || ('tipe bidang tidak dikenal: ' || left(coalesce(b->>'tipe', ''), 20)); end if;
      if not app.mod_teks_aman(b->>'label', 60) then a := a || ('label bidang tidak sah: ' || left(coalesce(b->>'kode', ''), 30)); end if;
    end loop;
    if jsonb_typeof(k->'akses') <> 'object' or exists (select 1 from jsonb_each_text(k->'akses') e
        where e.key not in ('pemilik', 'admin', 'akuntan', 'staf') or e.value not in ('tidak', 'lihat', 'milik_sendiri', 'tulis', 'kelola')) then a := a || 'akses tidak sah'::text; end if;
    if k ? 'status' and (jsonb_typeof(k->'status'->'daftar') <> 'array' or jsonb_array_length(k->'status'->'daftar') not between 1 and 12) then a := a || 'status harus 1 sampai 12'::text; end if;
  end loop;
  return a;
end $$;

-- Akses efektif peran untuk satu koleksi: pemilik/admin selalu kelola; staf/akuntan paling tinggi tulis; nilai asing = tidak.
create function app.mod_akses(p_manifest jsonb, p_koleksi text, p_peran text) returns text language sql immutable set search_path = '' as $$
  select case when p_peran in ('pemilik', 'admin') then 'kelola'
              when p_peran not in ('akuntan', 'staf') then 'tidak'
              else coalesce((select case when lv in ('lihat', 'milik_sendiri', 'tulis') then lv when lv = 'kelola' then 'tulis' else 'tidak' end
                               from (select k->'akses'->>p_peran as lv from jsonb_array_elements(p_manifest->'koleksi') k where k->>'kode' = p_koleksi limit 1) x), 'tidak') end
$$;

-- Koleksi aktif yang boleh dibaca sesi ini (dievaluasi sekali per kueri lewat (select ...)).
create function app.mod_koleksi_terbaca() returns table (mod_id uuid, koleksi text) language sql stable security definer set search_path = '' as $$
  select m.id, k->>'kode' from public.mod m cross join lateral jsonb_array_elements(m.manifest->'koleksi') k
   where m.perusahaan_id = app.pid() and m.status = 'aktif' and app.mod_akses(m.manifest, k->>'kode', app.peran_aktif()) <> 'tidak'
$$;
revoke all on function app.mod_koleksi_terbaca() from public, anon;
grant execute on function app.mod_koleksi_terbaca() to authenticated;

-- Validasi isi catatan terhadap manifest aktif. Kembalian: daftar alasan.
create function app.mod_cek_catatan(p_pid uuid, p_mod uuid, p_manifest jsonb, p_koleksi text, p_data jsonb) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare a text[] := '{}'; k jsonb; b jsonb; v jsonb; kunci text; tipe text; u text; t text;
begin
  select x into k from jsonb_array_elements(p_manifest->'koleksi') x where x->>'kode' = p_koleksi limit 1;
  if k is null then return array['koleksi tidak ada di mod ini']; end if;
  if jsonb_typeof(p_data) <> 'object' then return array['data harus objek']; end if;
  for kunci in select jsonb_object_keys(p_data) loop
    if not exists (select 1 from jsonb_array_elements(k->'bidang') y where y->>'kode' = kunci and y->>'tipe' <> 'rumus') then
      a := a || ('bidang tidak dikenal: ' || left(kunci, 30));
    end if;
  end loop;
  for b in select * from jsonb_array_elements(k->'bidang') loop
    tipe := b->>'tipe'; v := p_data->(b->>'kode');
    if tipe = 'rumus' then continue; end if;
    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb then
      if (b->>'wajib')::boolean is true then a := a || (coalesce(b->>'label', b->>'kode') || ' wajib diisi'); end if;
      continue;
    end if;
    if tipe in ('teks', 'teks_panjang') then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > (case when tipe = 'teks' then 500 else 5000 end) then a := a || (b->>'kode' || ': teks terlalu panjang atau bukan teks'); end if;
    elsif tipe in ('angka', 'rupiah') then
      if jsonb_typeof(v) <> 'number' then a := a || (b->>'kode' || ': harus angka');
      elsif (b ? 'min' and (v #>> '{}')::numeric < (b->>'min')::numeric) or (b ? 'max' and (v #>> '{}')::numeric > (b->>'max')::numeric) then a := a || (b->>'kode' || ': di luar batas'); end if;
    elsif tipe = 'tanggal' then
      begin
        if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' or (v #>> '{}')::date::text <> (v #>> '{}') then a := a || (b->>'kode' || ': tanggal tidak sah'); end if;
      exception when others then a := a || (b->>'kode' || ': tanggal tidak sah');
      end;
    elsif tipe = 'tanggal_jam' then
      begin
        if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' or (v #>> '{}')::timestamptz is null then a := a || (b->>'kode' || ': tanggal-jam tidak sah'); end if;
      exception when others then a := a || (b->>'kode' || ': tanggal-jam tidak sah');
      end;
    elsif tipe = 'pilihan' then
      if jsonb_typeof(v) <> 'string' or not exists (select 1 from jsonb_array_elements(b->'pilihan') p where p->>'kode' = v #>> '{}') then a := a || (b->>'kode' || ': pilihan tidak dikenal'); end if;
    elsif tipe = 'pilihan_banyak' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 50 or exists (select 1 from jsonb_array_elements(v) e
          where jsonb_typeof(e) <> 'string' or not exists (select 1 from jsonb_array_elements(b->'pilihan') p where p->>'kode' = e #>> '{}')) then a := a || (b->>'kode' || ': pilihan tidak dikenal'); end if;
    elsif tipe = 'centang' then
      if jsonb_typeof(v) <> 'boolean' then a := a || (b->>'kode' || ': harus benar/salah'); end if;
    elsif tipe = 'tautan' then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 2000 or (v #>> '{}') !~ '^https://[^[:space:]<>"''`]{3,}$' then a := a || (b->>'kode' || ': tautan harus https'); end if;
    elsif tipe = 'telepon' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\+?[0-9 ()-]{6,20}$' then a := a || (b->>'kode' || ': nomor telepon tidak sah'); end if;
    elsif tipe = 'berkas' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') not like p_pid::text || '/%' or (v #>> '{}') like '%..%' or length(v #>> '{}') > 500 then a := a || (b->>'kode' || ': berkas harus di penyimpanan usaha ini'); end if;
    elsif tipe in ('orang', 'pelanggan', 'produk', 'proyek', 'rujukan') then
      for u in select case when jsonb_typeof(v) = 'array' then e #>> '{}' else v #>> '{}' end
                 from jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else jsonb_build_array(v) end) e loop
        if (jsonb_typeof(v) = 'array' and not (tipe = 'orang' and (b->>'banyak')::boolean is true)) or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 50)
           or u !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or not (case tipe
             when 'orang' then exists (select 1 from public.orang o where o.id = u::uuid and o.perusahaan_id = p_pid)
             when 'pelanggan' then exists (select 1 from public.customer c where c.id = u::uuid and c.perusahaan_id = p_pid)
             when 'produk' then exists (select 1 from public.produk p where p.id = u::uuid and p.perusahaan_id = p_pid)
             when 'proyek' then exists (select 1 from public.dimension d where d.id = u::uuid and d.perusahaan_id = p_pid and d.jenis = 'proyek')
             else exists (select 1 from public.mod_record r where r.id = u::uuid and r.perusahaan_id = p_pid and r.mod_id = p_mod and r.koleksi = b->>'koleksi')
           end) then
          a := a || (b->>'kode' || ': rujukan tidak ditemukan di usaha ini');
          exit;
        end if;
      end loop;
    end if;
  end loop;
  return a;
end $$;
revoke all on function app.mod_cek_catatan(uuid, uuid, jsonb, text, jsonb) from public, anon, authenticated;

create function app.mod_ditugaskan(p_manifest jsonb, p_koleksi text, p_data jsonb) returns uuid[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct x::uuid), '{}') from (
    select case when jsonb_typeof(p_data->(b->>'kode')) = 'array' then e #>> '{}' else p_data->>(b->>'kode') end as x
      from jsonb_array_elements(p_manifest->'koleksi') k, jsonb_array_elements(k->'bidang') b,
           jsonb_array_elements(case when jsonb_typeof(p_data->(b->>'kode')) = 'array' then p_data->(b->>'kode') else jsonb_build_array(p_data->(b->>'kode')) end) e
     where k->>'kode' = p_koleksi and b->>'tipe' = 'orang' and (b->>'penugasan')::boolean is true) y
   where x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ---------- inti tulis (dipakai sesi aplikasi dan MCP) ----------
create function app.mod_draf_inti(p_pid uuid, p_uid uuid, p_manifest jsonb, p_sumber text, p_alasan text[], p_lewat text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_kode text := p_manifest->>'kode'; m public.mod; inti text[];
begin
  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' or pg_column_size(p_manifest) > 65536 then raise exception 'Manifest harus objek JSON maksimal 64 KB.' using errcode = '22023'; end if;
  if coalesce(v_kode, '') !~ '^[a-z][a-z0-9-]{2,39}$' then raise exception 'Kode mod harus huruf kecil, angka, atau tanda hubung.' using errcode = '22023'; end if;
  if p_sumber not in ('resmi', 'ai', 'sendiri', 'impor') then raise exception 'Sumber mod tidak dikenal.' using errcode = '22023'; end if;
  if (select count(*) from public.mod_log l where l.perusahaan_id = p_pid and l.jenis = 'draf' and l.at > now() - interval '1 hour') >= 60 then
    raise exception 'Terlalu banyak draf dalam satu jam. Coba lagi nanti.' using errcode = 'P0429';
  end if;
  inti := app.mod_cek_inti(p_manifest);
  select * into m from public.mod where perusahaan_id = p_pid and kode = v_kode for update;
  if m.id is null then
    if (select count(*) from public.mod where perusahaan_id = p_pid) >= 40 then raise exception 'Satu usaha maksimal 40 mod.' using errcode = 'P0429'; end if;
    insert into public.mod (perusahaan_id, kode, nama, sumber, status, draf, draf_alasan, draf_oleh, draf_at)
    values (p_pid, v_kode, left(coalesce(nullif(btrim(p_manifest->>'nama'), ''), v_kode), 60), p_sumber, 'draf', p_manifest,
            coalesce(p_alasan, '{}') || inti, p_uid, now())
    returning * into m;
  else
    update public.mod set draf = p_manifest, draf_alasan = coalesce(p_alasan, '{}') || inti, draf_oleh = p_uid, draf_at = now(), diubah_at = now(),
                          sumber = case when status = 'draf' then p_sumber else sumber end
     where id = m.id returning * into m;
  end if;
  insert into public.mod_log (perusahaan_id, mod_id, oleh, lewat, jenis) values (p_pid, m.id, p_uid, p_lewat, 'draf');
  return jsonb_build_object('id', m.id, 'kode', m.kode, 'status', m.status, 'alasan', to_jsonb(m.draf_alasan), 'lolos', cardinality(m.draf_alasan) = 0);
end $$;
revoke all on function app.mod_draf_inti(uuid, uuid, jsonb, text, text[], text) from public, anon, authenticated;

create function app.mod_catatan_inti(p_pid uuid, p_uid uuid, p_peran text, p_mod uuid, p_koleksi text, p_data jsonb, p_id uuid, p_lewat text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.mod; lv text; err text[]; r public.mod_record; v_orang uuid; v_awal text;
begin
  select * into m from public.mod where id = p_mod and perusahaan_id = p_pid and status = 'aktif';
  if m.id is null then raise exception 'Fitur tidak ditemukan atau tidak aktif.' using errcode = 'P0002'; end if;
  lv := app.mod_akses(m.manifest, p_koleksi, p_peran);
  if lv in ('tidak', 'lihat') then raise exception 'Kamu tidak boleh menulis di sini.' using errcode = '42501'; end if;
  if (select count(*) from public.mod_log l where l.perusahaan_id = p_pid and l.at > now() - interval '1 hour' and l.jenis in ('buat', 'ubah', 'status', 'arsip')) >= 2000 then
    raise exception 'Terlalu banyak perubahan dalam satu jam. Coba lagi nanti.' using errcode = 'P0429';
  end if;
  if p_data is null or pg_column_size(p_data) > 32768 then raise exception 'Isi catatan maksimal 32 KB.' using errcode = '22023'; end if;
  err := app.mod_cek_catatan(p_pid, p_mod, m.manifest, p_koleksi, p_data);
  if cardinality(err) > 0 then raise exception '%', array_to_string(err, '; ') using errcode = '22023'; end if;
  select o.id into v_orang from public.orang o where o.perusahaan_id = p_pid and o.user_id = p_uid and o.status = 'aktif' limit 1;
  if p_id is null then
    if (select count(*) from public.mod_record x where x.perusahaan_id = p_pid and x.mod_id = p_mod and x.koleksi = p_koleksi) >= 20000 then
      raise exception 'Koleksi ini sudah 20.000 catatan.' using errcode = 'P0429';
    end if;
    select k->'status'->>'awal' into v_awal from jsonb_array_elements(m.manifest->'koleksi') k where k->>'kode' = p_koleksi;
    insert into public.mod_record (perusahaan_id, mod_id, koleksi, data, status, ditugaskan, dibuat_oleh)
    values (p_pid, p_mod, p_koleksi, p_data, v_awal, app.mod_ditugaskan(m.manifest, p_koleksi, p_data), p_uid) returning * into r;
    insert into public.mod_log (perusahaan_id, mod_id, record_id, oleh, lewat, jenis, ke) values (p_pid, p_mod, r.id, p_uid, p_lewat, 'buat', r.status);
  else
    select * into r from public.mod_record x where x.id = p_id and x.perusahaan_id = p_pid and x.mod_id = p_mod and x.koleksi = p_koleksi and not x.arsip for update;
    if r.id is null then raise exception 'Catatan tidak ditemukan.' using errcode = 'P0002'; end if;
    if lv = 'milik_sendiri' and not (r.dibuat_oleh = p_uid or v_orang = any (r.ditugaskan)) then
      raise exception 'Kamu hanya boleh mengubah catatanmu sendiri.' using errcode = '42501';
    end if;
    update public.mod_record set data = p_data, ditugaskan = app.mod_ditugaskan(m.manifest, p_koleksi, p_data), diubah_at = now() where id = r.id returning * into r;
    insert into public.mod_log (perusahaan_id, mod_id, record_id, oleh, lewat, jenis) values (p_pid, p_mod, r.id, p_uid, p_lewat, 'ubah');
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'data', r.data);
end $$;
revoke all on function app.mod_catatan_inti(uuid, uuid, text, uuid, text, jsonb, uuid, text) from public, anon, authenticated;

-- ---------- RPC sesi aplikasi ----------
create function public.mod_draf_simpan(p_manifest jsonb, p_sumber text default 'sendiri', p_alasan text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa menyusun fitur.' using errcode = '42501'; end if;
  return app.mod_draf_inti(app.pid(), auth.uid(), p_manifest, p_sumber, p_alasan, 'aplikasi');
end $$;

create function public.mod_terapkan(p_mod uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.mod; v int; inti text[];
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa menerapkan fitur.' using errcode = '42501'; end if;
  select * into m from public.mod where id = p_mod and perusahaan_id = app.pid() for update;
  if m.id is null or m.draf is null then raise exception 'Tidak ada draf untuk diterapkan.' using errcode = 'P0002'; end if;
  inti := app.mod_cek_inti(m.draf);
  if cardinality(m.draf_alasan) > 0 or cardinality(inti) > 0 then
    raise exception 'Draf belum lolos pemeriksaan: %', array_to_string(m.draf_alasan || inti, '; ') using errcode = '22023';
  end if;
  v := coalesce((select max(versi) from public.mod_versi where mod_id = m.id), 0) + 1;
  insert into public.mod_versi (perusahaan_id, mod_id, versi, manifest, diterapkan_oleh) values (m.perusahaan_id, m.id, v, m.draf, auth.uid());
  update public.mod set manifest = draf, nama = left(draf->>'nama', 60), status = 'aktif', versi_aktif = v, draf = null, draf_alasan = '{}', diubah_at = now()
   where id = m.id;
  insert into public.mod_log (perusahaan_id, mod_id, oleh, jenis, ke) values (m.perusahaan_id, m.id, auth.uid(), 'terapkan', v::text);
  return jsonb_build_object('id', m.id, 'versi', v, 'status', 'aktif');
end $$;

create function public.mod_atur(p_mod uuid, p_aksi text, p_versi int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.mod; mv public.mod_versi;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa mengatur fitur.' using errcode = '42501'; end if;
  select * into m from public.mod where id = p_mod and perusahaan_id = app.pid() for update;
  if m.id is null then raise exception 'Fitur tidak ditemukan.' using errcode = 'P0002'; end if;
  if p_aksi = 'matikan' then
    update public.mod set status = 'mati', diubah_at = now() where id = m.id;
  elsif p_aksi = 'nyalakan' then
    if m.manifest is null then raise exception 'Fitur ini belum pernah diterapkan.' using errcode = '22023'; end if;
    update public.mod set status = 'aktif', diubah_at = now() where id = m.id;
  elsif p_aksi = 'rollback' then
    select * into mv from public.mod_versi where mod_id = m.id and versi = p_versi;
    if mv.id is null then raise exception 'Versi tidak ditemukan.' using errcode = 'P0002'; end if;
    update public.mod set manifest = mv.manifest, versi_aktif = mv.versi, status = 'aktif', diubah_at = now() where id = m.id;
  else
    raise exception 'Aksi harus matikan, nyalakan, atau rollback.' using errcode = '22023';
  end if;
  insert into public.mod_log (perusahaan_id, mod_id, oleh, jenis, ke) values (m.perusahaan_id, m.id, auth.uid(), p_aksi, coalesce(p_versi::text, p_aksi));
  return jsonb_build_object('id', m.id, 'aksi', p_aksi);
end $$;

create function public.mod_catatan_simpan(p_mod uuid, p_koleksi text, p_data jsonb, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or app.peran_aktif() is null then raise exception 'Masuk dulu.' using errcode = '42501'; end if;
  return app.mod_catatan_inti(app.pid(), auth.uid(), app.peran_aktif(), p_mod, p_koleksi, p_data, p_id, 'aplikasi');
end $$;

create function public.mod_catatan_status(p_id uuid, p_ke text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.mod_record; m public.mod; k jsonb; t jsonb; v_peran text := app.peran_aktif(); v_orang uuid := app.orang_saya(); boleh boolean := false; w text; akhir boolean;
begin
  if app.pid() is null or v_peran is null then raise exception 'Masuk dulu.' using errcode = '42501'; end if;
  select * into r from public.mod_record where id = p_id and perusahaan_id = app.pid() and not arsip for update;
  if r.id is null then raise exception 'Catatan tidak ditemukan.' using errcode = 'P0002'; end if;
  select * into m from public.mod where id = r.mod_id and status = 'aktif';
  if m.id is null then raise exception 'Fitur tidak aktif.' using errcode = 'P0002'; end if;
  if app.mod_akses(m.manifest, r.koleksi, v_peran) in ('tidak', 'lihat') then raise exception 'Kamu tidak boleh mengubah status di sini.' using errcode = '42501'; end if;
  select x into k from jsonb_array_elements(m.manifest->'koleksi') x where x->>'kode' = r.koleksi;
  for t in select * from jsonb_array_elements(coalesce(k->'status'->'transisi', '[]')) loop
    if t->>'ke' = p_ke and (t->'dari' = '"*"'::jsonb or (t->'dari') ? coalesce(r.status, '')) then
      if v_peran = 'pemilik' or (t->'peran') ? v_peran or ((t->'peran') ? 'pembuat' and r.dibuat_oleh = auth.uid())
         or ((t->'peran') ? 'ditugaskan' and v_orang = any (r.ditugaskan)) then
        boleh := true;
        for w in select jsonb_array_elements_text(coalesce(t->'wajib_isi', '[]')) loop
          if r.data->w is null or r.data->w in ('null'::jsonb, '""'::jsonb, '[]'::jsonb) then
            raise exception 'Isi % dulu sebelum pindah status.', w using errcode = '22023';
          end if;
        end loop;
        exit;
      end if;
    end if;
  end loop;
  if not boleh then raise exception 'Perpindahan status ini tidak diizinkan untukmu.' using errcode = '42501'; end if;
  select coalesce((s->>'akhir')::boolean, false) into akhir from jsonb_array_elements(k->'status'->'daftar') s where s->>'kode' = p_ke;
  update public.mod_record set status = p_ke, selesai_at = case when akhir then now() end, diubah_at = now() where id = r.id;
  insert into public.mod_log (perusahaan_id, mod_id, record_id, oleh, jenis, dari, ke) values (r.perusahaan_id, r.mod_id, r.id, auth.uid(), 'status', r.status, p_ke);
  return jsonb_build_object('id', r.id, 'status', p_ke);
end $$;

create function public.mod_catatan_arsip(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.mod_record; m public.mod;
begin
  select * into r from public.mod_record where id = p_id and perusahaan_id = app.pid() for update;
  if r.id is null then raise exception 'Catatan tidak ditemukan.' using errcode = 'P0002'; end if;
  select * into m from public.mod where id = r.mod_id;
  if app.mod_akses(m.manifest, r.koleksi, app.peran_aktif()) <> 'kelola' then raise exception 'Hanya pengelola yang bisa mengarsipkan.' using errcode = '42501'; end if;
  update public.mod_record set arsip = true, diubah_at = now() where id = r.id;
  insert into public.mod_log (perusahaan_id, mod_id, record_id, oleh, jenis) values (r.perusahaan_id, r.mod_id, r.id, auth.uid(), 'arsip');
  return jsonb_build_object('id', r.id, 'arsip', true);
end $$;

-- ---------- RPC MCP (token buram, hanya draf dan data; tidak ada terapkan/matikan) ----------
create function public.mcp_mod_daftar(p_token text, p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from app.mcp_konteks(p_token, p_resource, 'nadi.baca');
  return coalesce((select jsonb_agg(jsonb_build_object('kode', m.kode, 'nama', m.nama, 'status', m.status, 'versi_aktif', m.versi_aktif,
           'ada_draf', m.draf is not null, 'alasan_draf', to_jsonb(m.draf_alasan)) order by m.kode)
    from public.mod m where m.perusahaan_id = c.perusahaan_id), '[]');
end $$;

create function public.mcp_mod_draf_tulis(p_token text, p_resource text, p_manifest jsonb, p_alasan text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  if c.peran not in ('pemilik', 'admin') then raise exception 'Hanya token milik pemilik atau admin yang bisa menyusun fitur.' using errcode = 'P0403'; end if;
  return app.mod_draf_inti(c.perusahaan_id, c.user_id, p_manifest, 'ai', p_alasan, 'mcp');
end $$;

create function public.mcp_mod_draf_baca(p_token text, p_resource text, p_kode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; m public.mod;
begin
  select * into c from app.mcp_konteks(p_token, p_resource, 'nadi.baca');
  if c.peran not in ('pemilik', 'admin') then raise exception 'Hanya pemilik atau admin.' using errcode = 'P0403'; end if;
  select * into m from public.mod where perusahaan_id = c.perusahaan_id and kode = p_kode;
  if m.id is null then raise exception 'Mod tidak ditemukan.' using errcode = 'P0002'; end if;
  return jsonb_build_object('kode', m.kode, 'status', m.status, 'draf', m.draf, 'alasan_draf', to_jsonb(m.draf_alasan), 'manifest_aktif', m.manifest, 'versi_aktif', m.versi_aktif);
end $$;

create function public.mcp_mod_data_baca(p_token text, p_resource text, p_kode text, p_koleksi text, p_batas int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; m public.mod;
begin
  select * into c from app.mcp_konteks(p_token, p_resource, 'nadi.baca');
  select * into m from public.mod where perusahaan_id = c.perusahaan_id and kode = p_kode and status = 'aktif';
  if m.id is null then raise exception 'Fitur tidak ditemukan atau tidak aktif.' using errcode = 'P0002'; end if;
  if app.mod_akses(m.manifest, p_koleksi, c.peran) = 'tidak' then raise exception 'Tidak boleh membaca koleksi ini.' using errcode = 'P0403'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'data', r.data, 'dibuat_at', r.dibuat_at) order by r.dibuat_at desc)
    from (select * from public.mod_record r where r.perusahaan_id = c.perusahaan_id and r.mod_id = m.id and r.koleksi = p_koleksi and not r.arsip
           order by r.dibuat_at desc limit least(greatest(coalesce(p_batas, 50), 1), 200)) r), '[]');
end $$;

create function public.mcp_mod_data_tulis(p_token text, p_resource text, p_kode text, p_koleksi text, p_data jsonb, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; v_mod uuid;
begin
  select * into c from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  select id into v_mod from public.mod where perusahaan_id = c.perusahaan_id and kode = p_kode and status = 'aktif';
  if v_mod is null then raise exception 'Fitur tidak ditemukan atau tidak aktif.' using errcode = 'P0002'; end if;
  return app.mod_catatan_inti(c.perusahaan_id, c.user_id, c.peran, v_mod, p_koleksi, p_data, p_id, 'mcp');
end $$;

-- ---------- RLS dan hak ----------
alter table public.mod enable row level security;
alter table public.mod_versi enable row level security;
alter table public.mod_record enable row level security;
alter table public.mod_log enable row level security;
create policy mod_baca on public.mod for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
create policy mod_versi_baca on public.mod_versi for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
create policy mod_record_baca on public.mod_record for select to authenticated using (
  perusahaan_id = (select app.pid()) and (select app.anggota_aktif())
  and (mod_id, koleksi) in (select t.mod_id, t.koleksi from app.mod_koleksi_terbaca() t));
create policy mod_log_baca on public.mod_log for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
-- kolom draf tidak terbaca langsung (staf tidak melihat draf); pemilik/admin membacanya lewat halaman Tambah fitur (RPC mod_draf_baca)
grant select (id, perusahaan_id, kode, nama, sumber, status, manifest, versi_aktif, dibuat_at, diubah_at) on public.mod to authenticated;
grant select on public.mod_versi, public.mod_record, public.mod_log to authenticated;

-- Draf yang menunggu keputusan pemilik/admin (halaman Tambah fitur): kolom draf tidak diberi grant ke authenticated, jadi
-- daftar dibaca lewat fungsi ini. Hanya ringkasan; isi draf lengkap lewat mod_draf_baca.
create function public.mod_draf_daftar() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kode', m.kode, 'nama', coalesce(m.draf->>'nama', m.nama), 'sumber', m.sumber,
      'status', m.status, 'versi_aktif', m.versi_aktif, 'draf_at', m.draf_at, 'alasan', to_jsonb(m.draf_alasan || app.mod_cek_inti(m.draf)))
      order by m.draf_at desc)
    from public.mod m where m.perusahaan_id = app.pid() and m.draf is not null), '[]'::jsonb);
end $$;
revoke all on function public.mod_draf_daftar() from public, anon;
grant execute on function public.mod_draf_daftar() to authenticated;

create function public.mod_draf_baca(p_mod uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.mod;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin.' using errcode = '42501'; end if;
  select * into m from public.mod where id = p_mod and perusahaan_id = app.pid();
  if m.id is null then raise exception 'Fitur tidak ditemukan.' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', m.id, 'kode', m.kode, 'draf', m.draf, 'alasan', to_jsonb(m.draf_alasan), 'draf_at', m.draf_at, 'sumber', m.sumber);
end $$;

revoke all on function public.mod_draf_simpan(jsonb, text, text[]), public.mod_terapkan(uuid), public.mod_atur(uuid, text, int), public.mod_catatan_simpan(uuid, text, jsonb, uuid),
  public.mod_catatan_status(uuid, text), public.mod_catatan_arsip(uuid), public.mod_draf_baca(uuid) from public, anon;
grant execute on function public.mod_draf_simpan(jsonb, text, text[]), public.mod_terapkan(uuid), public.mod_atur(uuid, text, int), public.mod_catatan_simpan(uuid, text, jsonb, uuid),
  public.mod_catatan_status(uuid, text), public.mod_catatan_arsip(uuid), public.mod_draf_baca(uuid) to authenticated;
revoke all on function public.mcp_mod_daftar(text, text), public.mcp_mod_draf_tulis(text, text, jsonb, text[]), public.mcp_mod_draf_baca(text, text, text),
  public.mcp_mod_data_baca(text, text, text, text, int), public.mcp_mod_data_tulis(text, text, text, text, jsonb, uuid) from public;
grant execute on function public.mcp_mod_daftar(text, text), public.mcp_mod_draf_tulis(text, text, jsonb, text[]), public.mcp_mod_draf_baca(text, text, text),
  public.mcp_mod_data_baca(text, text, text, text, int), public.mcp_mod_data_tulis(text, text, text, text, jsonb, uuid) to anon, authenticated;
comment on function public.mcp_mod_draf_tulis(text, text, jsonb, text[]) is 'SECURITY DEFINER dan anon DISENGAJA (pola mcp_buat_usulan): token buram diperiksa app.mcp_konteks (hash, resource, cakupan nadi.usul, anggota aktif, 120/menit); hanya menulis draf, tidak pernah menerapkan.';
