-- X-11 kirim hasil + review + baseline tenggat. Pelaksana mengirim hasil (tautan https dan/atau catatan), kerja masuk status
-- review dan muncul sebagai kartu Feed untuk pemilik/admin: diterima -> selesai; minta revisi wajib beralasan -> kembali jalan.
-- Tenggat pertama menjadi baseline (tenggat_awal) yang terkunci; tenggat hanya bisa digeser lewat pengajuan yang disetujui di
-- Feed. KPI menghitung tepat waktu terhadap tenggat yang disetujui (seperti sebelumnya) dan terhadap baseline.

alter table public.kerja add column tenggat_awal timestamptz;
update public.kerja set tenggat_awal = tenggat where tenggat is not null and tenggat_awal is null;

create function app.jaga_tenggat_kerja() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.tenggat_awal is not null and new.tenggat_awal is distinct from old.tenggat_awal then
    raise exception 'Tenggat awal tidak bisa diubah.' using errcode = '42501';
  end if;
  if new.tenggat_awal is null and new.tenggat is not null then new.tenggat_awal := new.tenggat; end if;
  if tg_op = 'UPDATE' and old.tenggat_awal is not null and new.tenggat is distinct from old.tenggat
     and coalesce(current_setting('app.geser_tenggat', true), '') <> '1' then
    raise exception 'Tenggat digeser lewat pengajuan yang disetujui pemilik atau admin.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger jaga_tenggat_kerja before insert or update of tenggat, tenggat_awal on public.kerja
  for each row execute function app.jaga_tenggat_kerja();

create table public.kerja_hasil (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kerja_id uuid not null references public.kerja(id) on delete cascade,
  oleh uuid references public.orang(id),
  tautan text check (tautan is null or (length(tautan) <= 2000 and tautan ~ '^https://[^[:space:]<>"''`]{3,}$')),
  catatan text check (catatan is null or char_length(catatan) <= 2000),
  status text not null default 'menunggu' check (status in ('menunggu', 'diterima', 'revisi')),
  alasan text check (alasan is null or char_length(alasan) <= 500),
  diputus_oleh uuid,
  diputus_at timestamptz,
  usulan_id uuid,
  dibuat_at timestamptz not null default now(),
  check (tautan is not null or catatan is not null)
);
create index kerja_hasil_kerja on public.kerja_hasil (kerja_id, dibuat_at desc);
alter table public.kerja_hasil enable row level security;
create policy kerja_hasil_baca on public.kerja_hasil for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and kerja_id in (select app.kerja_saya()))));
grant select on public.kerja_hasil to authenticated;

create function public.kirim_hasil_kerja(p_kerja uuid, p_tautan text, p_catatan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kerja; v_tautan text := nullif(btrim(coalesce(p_tautan, '')), ''); v_catatan text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_hasil uuid; v_usulan uuid; v_nama text;
begin
  if not app.boleh_kerja(p_kerja) then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid for update;
  if k.status not in ('jalan', 'tunggu') then raise exception 'Hasil dikirim saat kerja sedang jalan.' using errcode = '55000'; end if;
  if v_tautan is null and v_catatan is null then raise exception 'Isi tautan hasil atau catatan.' using errcode = '22023'; end if;
  if v_tautan is not null and (length(v_tautan) > 2000 or v_tautan !~ '^https://[^[:space:]<>"''`]{3,}$') then
    raise exception 'Tautan hasil harus diawali https://.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_catatan, '')) > 2000 then raise exception 'Catatan maksimal 2.000 huruf.' using errcode = '22023'; end if;
  v_nama := coalesce(app.nama_rekan(app.orang_saya()), 'Pelaksana');
  insert into public.kerja_hasil (perusahaan_id, kerja_id, oleh, tautan, catatan) values (v_pid, k.id, app.orang_saya(), v_tautan, v_catatan) returning id into v_hasil;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
  values (v_pid, 'staf', 'kerja.review', format('Tinjau hasil kerja: %s', left(k.judul, 100)),
          format('%s mengirim hasil. Terima bila sudah sesuai, atau minta revisi dengan alasannya.', v_nama),
          jsonb_build_object('kerja_id', k.id, 'hasil_id', v_hasil, 'tautan', v_tautan, 'catatan', v_catatan), array['pemilik', 'admin'],
          md5('kerja.review:' || v_hasil)::uuid)
  returning id into v_usulan;
  update public.kerja_hasil set usulan_id = v_usulan where id = v_hasil;
  update public.kerja set status = 'review', diubah_at = now() where id = k.id;
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
  values (v_pid, 'kerja.review', 'pwa', app.orang_saya(), k.id, jsonb_build_object('oleh', auth.uid(), 'hasil_id', v_hasil));
  return jsonb_build_object('id', k.id, 'hasil', v_hasil, 'usulan', v_usulan, 'status', 'review');
end $$;

-- Minta revisi dari kartu Feed: wajib beralasan; kerja kembali jalan, usulan tercatat ditolak.
create function public.minta_revisi_kerja(p_usulan uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); u public.usulan; v_alasan text := btrim(coalesce(p_alasan, ''));
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa meminta revisi.' using errcode = '42501'; end if;
  select * into u from public.usulan where id = p_usulan and perusahaan_id = v_pid and aksi = 'kerja.review' for update;
  if u.id is null then raise exception 'Usulan tidak ditemukan.' using errcode = 'P0002'; end if;
  if u.status <> 'menunggu' then return jsonb_build_object('status', u.status, 'sudah', true); end if;
  if char_length(v_alasan) not between 5 and 500 then raise exception 'Tulis alasan revisi 5 sampai 500 huruf.' using errcode = '22023'; end if;
  update public.usulan set status = 'ditolak' where id = u.id;
  update public.kerja_hasil set status = 'revisi', alasan = v_alasan, diputus_oleh = auth.uid(), diputus_at = now()
   where id = (u.payload ->> 'hasil_id')::uuid and perusahaan_id = v_pid;
  update public.kerja set status = 'jalan', diubah_at = now() where id = (u.payload ->> 'kerja_id')::uuid and perusahaan_id = v_pid and status = 'review';
  insert into public.kejadian (perusahaan_id, jenis, sumber, kerja_id, data)
  values (v_pid, 'kerja.revisi', 'pwa', (u.payload ->> 'kerja_id')::uuid, jsonb_build_object('oleh', auth.uid(), 'alasan', v_alasan));
  return jsonb_build_object('status', 'ditolak', 'revisi', true);
end $$;

-- Pengajuan geser tenggat (pelaksana atau pengelola) menjadi kartu Feed; baseline tetap.
create function public.ajukan_geser_tenggat(p_kerja uuid, p_tenggat timestamptz, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kerja; v_alasan text := btrim(coalesce(p_alasan, '')); v_usulan uuid;
begin
  if not app.boleh_kerja(p_kerja) then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid;
  if k.tenggat is null then raise exception 'Kerja ini belum punya tenggat.' using errcode = '22023'; end if;
  if k.status in ('selesai', 'batal') then raise exception 'Kerja ini sudah selesai atau batal.' using errcode = '55000'; end if;
  if p_tenggat is null or p_tenggat <= now() then raise exception 'Pilih tenggat baru yang akan datang.' using errcode = '22023'; end if;
  if char_length(v_alasan) not between 5 and 500 then raise exception 'Tulis alasan 5 sampai 500 huruf.' using errcode = '22023'; end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
  values (v_pid, 'staf', 'kerja.tenggat', format('Geser tenggat: %s', left(k.judul, 100)), format('Alasan: "%s". Tenggat awal tetap tercatat.', v_alasan),
          jsonb_build_object('kerja_id', k.id, 'lama', k.tenggat, 'baru', p_tenggat, 'awal', k.tenggat_awal, 'alasan', v_alasan), array['pemilik', 'admin'],
          md5('kerja.tenggat:' || k.id || ':' || p_tenggat)::uuid)
  on conflict do nothing returning id into v_usulan;
  return jsonb_build_object('id', k.id, 'usulan', v_usulan);
end $$;

revoke all on function public.kirim_hasil_kerja(uuid, text, text), public.minta_revisi_kerja(uuid, text), public.ajukan_geser_tenggat(uuid, timestamptz, text) from public, anon;
grant execute on function public.kirim_hasil_kerja(uuid, text, text), public.minta_revisi_kerja(uuid, text), public.ajukan_geser_tenggat(uuid, timestamptz, text) to authenticated;
revoke all on function app.jaga_tenggat_kerja() from public, anon, authenticated;

-- Potongan fungsi lama (diganti tepat sekali per potongan, satu fungsi dibuat ulang sekali).
do $$
declare r record; f text; v_def text;
begin
  create temp table _ganti (urut serial, fungsi text, lama text, baru text) on commit drop;
  insert into _ganti (fungsi, lama, baru) select * from (values
    ('public.putuskan_usulan(uuid,boolean)', '      when ''kpi.banding'' then',
       '      when ''kerja.review'' then
        update public.kerja set status = ''selesai'', selesai_at = now(), diubah_at = now()
         where perusahaan_id = v_pid and id::text = u.payload ->> ''kerja_id'' and status = ''review'';
        get diagnostics n = row_count;
        update public.kerja_hasil set status = ''diterima'', diputus_oleh = auth.uid(), diputus_at = now()
         where perusahaan_id = v_pid and id::text = u.payload ->> ''hasil_id'';
      when ''kerja.tenggat'' then
        perform set_config(''app.geser_tenggat'', ''1'', true);
        update public.kerja set tenggat = (u.payload ->> ''baru'')::timestamptz, diubah_at = now()
         where perusahaan_id = v_pid and id::text = u.payload ->> ''kerja_id'' and status not in (''selesai'', ''batal'');
        get diagnostics n = row_count;
        perform set_config(''app.geser_tenggat'', ''0'', true);
      when ''kpi.banding'' then'),
    ('app.kpi_orang(uuid,date)', 'k.tenggat, k.selesai_at, k.lintas_topi,', 'k.tenggat, k.tenggat_awal, k.selesai_at, k.lintas_topi,'),
    ('app.kpi_orang(uuid,date)', 'end as lewat_menit,', 'end as lewat_menit,
           k.tenggat_awal is not null and k.selesai_at > k.tenggat_awal as lewat_awal,'),
    ('app.kpi_orang(uuid,date)', '(count(k.id) filter (where k.ini and k.tenggat is not null and k.lewat_menit is null))::integer as tepat,',
       '(count(k.id) filter (where k.ini and k.tenggat is not null and k.lewat_menit is null))::integer as tepat,
           (count(k.id) filter (where k.ini and k.tenggat_awal is not null))::integer as bertenggat_awal,
           (count(k.id) filter (where k.ini and k.tenggat_awal is not null and not k.lewat_awal))::integer as tepat_awal,'),
    ('app.kpi_orang(uuid,date)', '''lintas'', jsonb_build_object(',
       '''tepat_awal'', jsonb_build_object(''nilai'', g.tepat_awal, ''dari'', g.bertenggat_awal),
      ''lintas'', jsonb_build_object('),
    ('public.papan_kerja()', 'k.status in (''baru'', ''jalan'', ''tunggu'')', 'k.status in (''baru'', ''jalan'', ''tunggu'', ''review'')'),
    ('public.papan_kerja()', '''id'', b.id, ''judul'', b.judul, ''status'', b.status,',
       '''id'', b.id, ''judul'', b.judul, ''status'', b.status, ''tenggat_awal'', b.tenggat_awal,
           ''hasil'', (select jsonb_build_object(''status'', h.status, ''tautan'', h.tautan, ''catatan'', h.catatan, ''alasan'', h.alasan)
                     from public.kerja_hasil h where h.kerja_id = b.id order by h.dibuat_at desc limit 1),')
  ) t(fungsi, lama, baru);
  for f in select distinct g.fungsi from _ganti g loop
    v_def := pg_get_functiondef(f::regprocedure);
    for r in select * from _ganti g where g.fungsi = f order by g.urut loop
      if (length(v_def) - length(replace(v_def, r.lama, ''))) / length(r.lama) <> 1 then
        raise exception 'kerja_review: potongan tidak ditemukan tepat satu kali di %: %', r.fungsi, left(r.lama, 80);
      end if;
      v_def := replace(v_def, r.lama, r.baru);
    end loop;
    execute v_def;
  end loop;
end $$;
