-- F2-06 Jalur Magang, topi mentor, buku jam rekrutmen, Dana Rekrutmen (docs/research/magang.md).
-- Rencana magang tertulis per peserta; peringatan lunak dari Permenaker 6/2020 (belum terverifikasi ke PDF resmi, tidak memblokir).
-- Satu buku jam untuk dua jenis: sesi mentor (per rencana) dan menit penilai (per lamaran). Tarif per jam diisi pemilik di
-- pengaturan usaha dan disalin ke setiap baris saat dicatat; gaji orang tidak dibaca agar data rahasia tidak masuk laporan.

alter table public.lowongan add column biaya_iklan bigint not null default 0 check (biaya_iklan >= 0);

-- Uang saku per bulan: {transport, makan, insentif}, masing-masing bilangan bulat >= 0 (Permenaker 6/2020 Pasal 13 ayat (2)).
create or replace function app.uang_saku_sah(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1 from jsonb_each(p) e
     where e.key not in ('transport', 'makan', 'insentif') or jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[0-9]{1,10}$')
$$;

create table public.rencana_magang (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  mentor_id uuid references public.orang(id) on delete set null,
  topi_id uuid references public.topi(id) on delete set null,
  mulai date not null,
  selesai date not null,
  uang_saku jsonb not null default '{"transport": 0, "makan": 0, "insentif": 0}'::jsonb check (app.uang_saku_sah(uang_saku)),
  tujuan text not null check (char_length(tujuan) between 3 and 500),
  minggu jsonb not null default '[]'::jsonb check (jsonb_typeof(minggu) = 'array' and jsonb_array_length(minggu) <= 52),
  uji_akhir text check (char_length(uji_akhir) <= 500),
  status text not null default 'rencana' check (status in ('rencana', 'jalan', 'selesai', 'batal')),
  nilai_akhir integer check (nilai_akhir between 0 and 100),
  dibuat_at timestamptz not null default now(),
  check (selesai >= mulai),
  check (mentor_id is distinct from orang_id)
);
create index on public.rencana_magang (perusahaan_id, status);
create index on public.rencana_magang (orang_id);
create index on public.rencana_magang (mentor_id);
create index on public.rencana_magang (topi_id);
alter table public.rencana_magang enable row level security;
create policy rencana_magang_baca on public.rencana_magang for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin']))
         or orang_id = (select app.orang_saya()) or mentor_id = (select app.orang_saya())));
grant select on public.rencana_magang to authenticated;

create table public.jam_rekrut (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('mentor', 'penilai')),
  orang_id uuid references public.orang(id) on delete set null,
  rencana_id uuid references public.rencana_magang(id) on delete cascade,
  lamaran_id uuid references public.lamaran(id) on delete cascade,
  tanggal date not null,
  menit integer not null check (menit between 1 and 600),
  tarif_per_jam bigint check (tarif_per_jam >= 0),
  catatan text check (char_length(catatan) <= 300),
  dicatat_oleh uuid references auth.users(id) on delete set null,
  dibuat_at timestamptz not null default now(),
  check ((jenis = 'mentor' and rencana_id is not null and lamaran_id is null)
      or (jenis = 'penilai' and lamaran_id is not null and rencana_id is null))
);
create index on public.jam_rekrut (perusahaan_id, tanggal);
create index on public.jam_rekrut (rencana_id);
create index on public.jam_rekrut (lamaran_id);
create index on public.jam_rekrut (orang_id);
create index on public.jam_rekrut (dicatat_oleh);
alter table public.jam_rekrut enable row level security;
create policy jam_rekrut_baca on public.jam_rekrut for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin']))
         or (jenis = 'mentor' and orang_id = (select app.orang_saya()))));
grant select on public.jam_rekrut to authenticated;

-- Peringatan lunak satu rencana (tanpa pemeriksaan hak; dipanggil dari fungsi publik di bawah).
create or replace function app.peringatan_rencana(p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  r public.rencana_magang; v_mulai_mentor date; v_bulan integer; v_peserta integer; v_aktif integer;
  hasil jsonb := '[]'::jsonb;
  c_url constant text := 'https://pasal.id/peraturan/permen/permenaker-no-6-tahun-2020';
begin
  select * into r from public.rencana_magang where id = p_id;
  if r.id is null then return hasil; end if;
  if r.selesai >= (r.mulai + interval '1 year')::date then
    v_bulan := (extract(year from age(r.selesai + 1, r.mulai)) * 12 + extract(month from age(r.selesai + 1, r.mulai)))::integer;
    hasil := hasil || jsonb_build_object('kode', 'durasi',
      'pesan', format('Rencana ini %s bulan, lebih lama dari batas pemagangan 1 tahun.', v_bulan),
      'sumber', 'Permenaker 6/2020 Pasal 5 ayat (5)', 'url', c_url, 'status', 'belum terverifikasi');
  end if;
  if coalesce((r.uang_saku ->> 'transport')::bigint, 0) + coalesce((r.uang_saku ->> 'makan')::bigint, 0)
     + coalesce((r.uang_saku ->> 'insentif')::bigint, 0) = 0 then
    hasil := hasil || jsonb_build_object('kode', 'uang_saku',
      'pesan', 'Uang saku belum diisi. Perjanjian pemagangan memuat besaran uang saku: transport, makan, dan insentif.',
      'sumber', 'Permenaker 6/2020 Pasal 10 dan Pasal 13 ayat (2)', 'url', c_url, 'status', 'belum terverifikasi');
  end if;
  if r.mentor_id is not null then
    select coalesce((app.tanggal_aman(o.data ->> 'mulai') at time zone 'Asia/Makassar')::date, (o.dibuat_at at time zone 'Asia/Makassar')::date)
      into v_mulai_mentor from public.orang o where o.id = r.mentor_id;
    if v_mulai_mentor > (r.mulai - interval '6 months')::date then
      hasil := hasil || jsonb_build_object('kode', 'mentor_baru',
        'pesan', 'Mentor bekerja kurang dari 6 bulan saat magang dimulai. Pembimbing pemagangan sebaiknya pekerja paling singkat 6 bulan.',
        'sumber', 'Permenaker 6/2020 Pasal 7 huruf a', 'url', c_url, 'status', 'belum terverifikasi');
    end if;
  end if;
  select count(distinct m.orang_id) into v_peserta
    from public.rencana_magang m join public.orang o on o.id = m.orang_id
   where m.perusahaan_id = r.perusahaan_id and m.status in ('rencana', 'jalan') and o.status = 'aktif';
  select count(*) into v_aktif from public.orang o
   where o.perusahaan_id = r.perusahaan_id and o.status = 'aktif' and o.jenis && array['karyawan', 'magang'];
  if v_peserta > 0 and v_peserta * 5 > v_aktif then
    hasil := hasil || jsonb_build_object('kode', 'kuota',
      'pesan', format('Peserta magang aktif %s dari %s orang aktif (%s%%), lebih dari 20%%.', v_peserta, v_aktif,
                      round(100.0 * v_peserta / greatest(v_aktif, 1))),
      'sumber', 'Permenaker 6/2020 Pasal 2', 'url', c_url, 'status', 'belum terverifikasi');
  end if;
  return hasil;
end $$;
revoke all on function app.peringatan_rencana(uuid) from public, anon, authenticated;

-- Pemilik/admin membuat atau mengubah rencana magang. Mentor otomatis memakai topi mentor (porsi kecil), peserta memakai topi
-- tujuannya selama magang (kerja di luar topi itu tertanda lintas topi oleh trigger kerja_lintas_topi) dan berjenis magang.
create or replace function public.simpan_rencana_magang(
  p_id uuid, p_orang uuid, p_mentor uuid, p_topi uuid, p_mulai date, p_selesai date, p_uang_saku jsonb, p_tujuan text,
  p_minggu jsonb, p_uji_akhir text, p_status text default 'rencana', p_nilai_akhir integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_id uuid; v_topi_mentor uuid; v_saku jsonb := coalesce(p_uang_saku, '{}'::jsonb);
  v_minggu jsonb := coalesce(p_minggu, '[]'::jsonb); v_tujuan text := btrim(coalesce(p_tujuan, ''));
  v_uji text := nullif(btrim(coalesce(p_uji_akhir, '')), ''); v_status text := coalesce(p_status, 'rencana');
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa menulis rencana magang.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then
    raise exception 'Peserta tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mentor is null or not exists (select 1 from public.orang where id = p_mentor and perusahaan_id = v_pid) then
    raise exception 'Mentor tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mentor = p_orang then raise exception 'Mentor dan peserta harus orang yang berbeda.' using errcode = '22023'; end if;
  if p_topi is not null and not exists (select 1 from public.topi where id = p_topi and perusahaan_id = v_pid) then
    raise exception 'Topi tujuan tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai then
    raise exception 'Isi tanggal mulai dan selesai; tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = '22023';
  end if;
  if char_length(v_tujuan) not between 3 and 500 then
    raise exception 'Tulis tujuan magang 3 sampai 500 huruf.' using errcode = '22023';
  end if;
  if char_length(v_uji) > 500 then raise exception 'Uji akhir paling panjang 500 huruf.' using errcode = '22023'; end if;
  if v_status not in ('rencana', 'jalan', 'selesai', 'batal') then raise exception 'Status rencana tidak dikenal.' using errcode = '22023'; end if;
  if p_nilai_akhir is not null and p_nilai_akhir not between 0 and 100 then
    raise exception 'Nilai akhir 0 sampai 100.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_saku) <> 'object' or exists (
       select 1 from jsonb_each(v_saku) e
        where e.key not in ('transport', 'makan', 'insentif')
           or (jsonb_typeof(e.value) <> 'null' and (jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[0-9]{1,10}$'))) then
    raise exception 'Uang saku diisi rupiah bulat (transport, makan, insentif), boleh kosong.' using errcode = '22023';
  end if;
  v_saku := jsonb_build_object('transport', coalesce((v_saku ->> 'transport')::bigint, 0), 'makan', coalesce((v_saku ->> 'makan')::bigint, 0),
                               'insentif', coalesce((v_saku ->> 'insentif')::bigint, 0));
  if jsonb_typeof(v_minggu) <> 'array' or jsonb_array_length(v_minggu) > 52 then
    raise exception 'Rencana mingguan paling banyak 52 baris.' using errcode = '22023';
  end if;
  if exists (
       select 1 from jsonb_array_elements(v_minggu) e
        where coalesce(jsonb_typeof(e), '') <> 'object'
           or coalesce(jsonb_typeof(e -> 'minggu'), '') <> 'number' or coalesce(e ->> 'minggu', '') !~ '^[1-9][0-9]{0,2}$'
           or coalesce(jsonb_typeof(e -> 'keahlian'), '') <> 'string' or char_length(btrim(e ->> 'keahlian')) not between 1 and 120
           or coalesce(jsonb_typeof(e -> 'target'), 'null') not in ('string', 'null') or char_length(coalesce(e ->> 'target', '')) > 300) then
    raise exception 'Setiap baris mingguan butuh nomor minggu dan keahlian (paling panjang 120 huruf); target paling panjang 300 huruf.'
      using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('minggu', (e ->> 'minggu')::integer, 'keahlian', btrim(e ->> 'keahlian'),
                                               'target', nullif(btrim(coalesce(e ->> 'target', '')), '')) order by i), '[]'::jsonb)
    into v_minggu from jsonb_array_elements(v_minggu) with ordinality as x(e, i);

  if p_id is null then
    insert into public.rencana_magang (perusahaan_id, orang_id, mentor_id, topi_id, mulai, selesai, uang_saku, tujuan, minggu, uji_akhir, status, nilai_akhir)
    values (v_pid, p_orang, p_mentor, p_topi, p_mulai, p_selesai, v_saku, v_tujuan, v_minggu, v_uji, v_status, p_nilai_akhir)
    returning id into v_id;
  else
    update public.rencana_magang
       set orang_id = p_orang, mentor_id = p_mentor, topi_id = p_topi, mulai = p_mulai, selesai = p_selesai, uang_saku = v_saku,
           tujuan = v_tujuan, minggu = v_minggu, uji_akhir = v_uji, status = v_status, nilai_akhir = p_nilai_akhir
     where id = p_id and perusahaan_id = v_pid
    returning id into v_id;
    if v_id is null then raise exception 'Rencana magang tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  end if;

  insert into public.topi (perusahaan_id, kode, nama, deskripsi, tanggung_jawab)
  values (v_pid, 'mentor', 'Mentor', 'Membimbing peserta magang sesuai rencana tertulis. Dibuat otomatis oleh Jalur Magang.',
          '[{"tugas": "Membimbing peserta magang sesuai rencana mingguan", "raci": "R"}, {"tugas": "Menilai uji akhir magang", "raci": "R"}]'::jsonb)
  on conflict (perusahaan_id, kode) do update set aktif = true
  returning id into v_topi_mentor;
  if not exists (select 1 from public.pakai_topi where orang_id = p_mentor and topi_id = v_topi_mentor and (selesai is null or selesai >= current_date)) then
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai) values (v_pid, p_mentor, v_topi_mentor, 10, current_date);
  end if;
  if p_topi is not null and v_status in ('rencana', 'jalan')
     and not exists (select 1 from public.pakai_topi where orang_id = p_orang and topi_id = p_topi and (selesai is null or selesai >= current_date)) then
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai, selesai) values (v_pid, p_orang, p_topi, 100, p_mulai, p_selesai);
  end if;
  update public.orang set jenis = jenis || array['magang'] where id = p_orang and not ('magang' = any (jenis));
  return jsonb_build_object('id', v_id, 'peringatan', app.peringatan_rencana(v_id));
end $$;

-- Catat waktu rekrutmen. mentor: sesi bimbingan satu rencana, oleh pemilik/admin atau mentor rencana itu sendiri.
-- penilai: menit menilai satu lamaran, oleh pemilik/admin. Tarif per jam usaha disalin ke baris (null bila belum diisi).
create or replace function public.catat_jam_rekrut(p_jenis text, p_rencana uuid, p_lamaran uuid, p_tanggal date, p_menit integer, p_catatan text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_pengelola boolean := app.anggota_aktif(array['pemilik', 'admin']); v_saya uuid := app.orang_saya();
  r public.rencana_magang; v_orang uuid; v_tarif bigint; v_catatan text := nullif(btrim(coalesce(p_catatan, '')), ''); v_id uuid;
begin
  if v_pid is null or not app.anggota_aktif() then raise exception 'Masuk ke usahamu dulu.' using errcode = '42501'; end if;
  if p_menit is null or p_menit not between 1 and 600 then
    raise exception 'Isi lama waktu 1 sampai 600 menit.' using errcode = '22023';
  end if;
  if char_length(v_catatan) > 300 then raise exception 'Catatan paling panjang 300 huruf.' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Makassar')::date then
    raise exception 'Tanggal sesi tidak boleh di masa depan.' using errcode = '22023';
  end if;
  if p_jenis = 'mentor' then
    select * into r from public.rencana_magang where id = p_rencana and perusahaan_id = v_pid;
    if r.id is null then raise exception 'Rencana magang tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
    if not v_pengelola and (v_saya is null or r.mentor_id is distinct from v_saya) then
      raise exception 'Hanya mentor rencana ini, pemilik, atau admin yang bisa mencatat sesi bimbingan.' using errcode = '42501';
    end if;
    if r.status = 'batal' then raise exception 'Rencana ini sudah dibatalkan.' using errcode = '22023'; end if;
    v_orang := r.mentor_id;
  elsif p_jenis = 'penilai' then
    if not v_pengelola then raise exception 'Hanya pemilik atau admin yang mencatat waktu menilai pelamar.' using errcode = '42501'; end if;
    if not exists (select 1 from public.lamaran where id = p_lamaran and perusahaan_id = v_pid) then
      raise exception 'Lamaran tidak ditemukan di usahamu.' using errcode = 'P0002';
    end if;
    v_orang := v_saya;
  else
    raise exception 'Jenis waktu tidak dikenal.' using errcode = '22023';
  end if;
  select nullif(p.pengaturan ->> 'tarif_jam_rekrut', '')::bigint into v_tarif from public.perusahaan p where p.id = v_pid;
  insert into public.jam_rekrut (perusahaan_id, jenis, orang_id, rencana_id, lamaran_id, tanggal, menit, tarif_per_jam, catatan, dicatat_oleh)
  values (v_pid, p_jenis, v_orang, case when p_jenis = 'mentor' then p_rencana end, case when p_jenis = 'penilai' then p_lamaran end,
          p_tanggal, p_menit, v_tarif, v_catatan, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'tarif_per_jam', v_tarif);
end $$;

-- Pemilik mengatur tarif per jam waktu rekrutmen dan anggaran bulanan Dana Rekrutmen. null menghapus isian.
create or replace function public.atur_dana_rekrut(p_tarif_jam bigint, p_anggaran_bulanan bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v jsonb;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik']) then
    raise exception 'Hanya pemilik yang mengatur Dana Rekrutmen.' using errcode = '42501';
  end if;
  if p_tarif_jam is not null and p_tarif_jam not between 0 and 10000000 then
    raise exception 'Tarif per jam 0 sampai Rp10.000.000.' using errcode = '22023';
  end if;
  if p_anggaran_bulanan is not null and p_anggaran_bulanan not between 0 and 100000000000 then
    raise exception 'Anggaran bulanan terlalu besar.' using errcode = '22023';
  end if;
  update public.perusahaan
     set pengaturan = (pengaturan - 'tarif_jam_rekrut' - 'anggaran_rekrut_bulanan')
                      || jsonb_strip_nulls(jsonb_build_object('tarif_jam_rekrut', p_tarif_jam, 'anggaran_rekrut_bulanan', p_anggaran_bulanan))
   where id = v_pid
  returning jsonb_build_object('tarif_jam', pengaturan -> 'tarif_jam_rekrut', 'anggaran_bulanan', pengaturan -> 'anggaran_rekrut_bulanan') into v;
  return v;
end $$;

-- Laporan Dana Rekrutmen satu bulan: jam mentor + penilai bulan itu dibanding anggaran, dan biaya per rekrutmen untuk rencana
-- magang yang berjalan di bulan itu (atau punya sesi bulan itu) dan lamaran yang diterima bulan itu. Biaya per rekrutmen =
-- (menit x tarif yang disalin) / 60 untuk semua jam rencana/lamaran itu + bagian biaya iklan lowongan (dibagi rata ke yang diterima).
create or replace function public.laporan_rekrut(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_awal date; v_akhir date; v_zona text; v_tarif bigint; v_anggaran bigint;
  v_baris jsonb; v_menit_mentor integer; v_menit_penilai integer; v_terpakai bigint; v_tanpa_tarif integer;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Khusus pemilik atau admin.' using errcode = '42501';
  end if;
  if p_bulan is null then raise exception 'Pilih bulan laporan.' using errcode = '22023'; end if;
  v_awal := date_trunc('month', p_bulan)::date;
  v_akhir := (v_awal + interval '1 month')::date;
  select coalesce(p.zona_waktu, 'Asia/Makassar'), nullif(p.pengaturan ->> 'tarif_jam_rekrut', '')::bigint,
         nullif(p.pengaturan ->> 'anggaran_rekrut_bulanan', '')::bigint
    into v_zona, v_tarif, v_anggaran from public.perusahaan p where p.id = v_pid;

  select coalesce(sum(j.menit) filter (where j.jenis = 'mentor'), 0), coalesce(sum(j.menit) filter (where j.jenis = 'penilai'), 0),
         coalesce(round(sum(j.menit::numeric * j.tarif_per_jam) / 60), 0)::bigint, coalesce(sum(j.menit) filter (where j.tarif_per_jam is null), 0)
    into v_menit_mentor, v_menit_penilai, v_terpakai, v_tanpa_tarif
    from public.jam_rekrut j where j.perusahaan_id = v_pid and j.tanggal >= v_awal and j.tanggal < v_akhir;

  with magang as (
    select r.id, o.nama, r.status, r.dibuat_at,
           coalesce(sum(j.menit), 0)::integer as menit_mentor,
           coalesce(round(sum(j.menit::numeric * j.tarif_per_jam) / 60), 0)::bigint as biaya_jam,
           coalesce(sum(j.menit) filter (where j.tarif_per_jam is null), 0)::integer as tanpa_tarif
      from public.rencana_magang r
      join public.orang o on o.id = r.orang_id
      left join public.jam_rekrut j on j.rencana_id = r.id
     where r.perusahaan_id = v_pid and r.status <> 'batal'
       and ((r.mulai < v_akhir and r.selesai >= v_awal)
            or exists (select 1 from public.jam_rekrut x where x.rencana_id = r.id and x.tanggal >= v_awal and x.tanggal < v_akhir))
     group by r.id, o.nama, r.status, r.dibuat_at
  ), diterima as (
    select la.id, la.nama, la.tahap_at,
           coalesce(sum(j.menit), 0)::integer as menit_penilai,
           coalesce(round(sum(j.menit::numeric * j.tarif_per_jam) / 60), 0)::bigint as biaya_jam,
           coalesce(sum(j.menit) filter (where j.tarif_per_jam is null), 0)::integer as tanpa_tarif,
           coalesce(round(l.biaya_iklan::numeric / nullif((select count(*) from public.lamaran x where x.lowongan_id = la.lowongan_id and x.tahap = 'diterima'), 0)), 0)::bigint as iklan
      from public.lamaran la
      join public.lowongan l on l.id = la.lowongan_id
      left join public.jam_rekrut j on j.lamaran_id = la.id
     where la.perusahaan_id = v_pid and la.tahap = 'diterima'
       and (la.tahap_at at time zone v_zona)::date >= v_awal and (la.tahap_at at time zone v_zona)::date < v_akhir
     group by la.id, la.nama, la.tahap_at, l.biaya_iklan, la.lowongan_id
  ), semua as (
    select 'magang' as jenis, id, nama, status, dibuat_at as urut, menit_mentor, 0 as menit_penilai, biaya_jam, 0::bigint as iklan, tanpa_tarif from magang
    union all
    select 'diterima', id, nama, 'diterima', tahap_at, 0, menit_penilai, biaya_jam, iklan, tanpa_tarif from diterima
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'jenis', jenis, 'id', id, 'nama', nama, 'status', status,
           'menit_mentor', menit_mentor, 'menit_penilai', menit_penilai,
           'jam_mentor', round(menit_mentor / 60.0, 2), 'jam_penilai', round(menit_penilai / 60.0, 2),
           'biaya_jam', biaya_jam, 'biaya_iklan_bagian', iklan, 'biaya_total', biaya_jam + iklan, 'menit_tanpa_tarif', tanpa_tarif)
         order by urut desc), '[]'::jsonb)
    into v_baris from semua;

  return jsonb_build_object(
    'bulan', v_awal, 'tarif_jam', v_tarif, 'anggaran', v_anggaran, 'terpakai', v_terpakai,
    'sisa', case when v_anggaran is null then null else v_anggaran - v_terpakai end,
    'menit_mentor', v_menit_mentor, 'menit_penilai', v_menit_penilai, 'menit_tanpa_tarif', v_tanpa_tarif,
    'baris', v_baris, 'total_biaya', (select coalesce(sum((b ->> 'biaya_total')::bigint), 0) from jsonb_array_elements(v_baris) b));
end $$;

-- Peringatan lunak satu rencana untuk pengelola, mentor, atau peserta rencana itu.
create or replace function public.peringatan_magang(p_rencana uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.rencana_magang; v_saya uuid := app.orang_saya();
begin
  select * into r from public.rencana_magang where id = p_rencana and perusahaan_id = app.pid();
  if r.id is null or not (app.anggota_aktif(array['pemilik', 'admin']) or (v_saya is not null and v_saya in (r.orang_id, r.mentor_id))) then
    raise exception 'Rencana magang tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  return app.peringatan_rencana(r.id);
end $$;

-- Rencana yang boleh dilihat pemanggil (pengelola: semua; staf: rencana tempat dia mentor atau peserta), dengan nama, total
-- menit bimbingan, sesi terakhir, dan peringatan. Staf tidak bisa membaca baris orang lain, jadi nama disertakan di sini.
create or replace function public.daftar_rencana_magang() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_pengelola boolean := app.anggota_aktif(array['pemilik', 'admin']); v_saya uuid := app.orang_saya(); v jsonb;
begin
  if v_pid is null or not app.anggota_aktif() then raise exception 'Masuk ke usahamu dulu.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'status', r.status, 'mulai', r.mulai, 'selesai', r.selesai, 'uang_saku', r.uang_saku, 'tujuan', r.tujuan,
           'minggu', r.minggu, 'uji_akhir', r.uji_akhir, 'nilai_akhir', r.nilai_akhir, 'dibuat_at', r.dibuat_at,
           'peserta', jsonb_build_object('id', p.id, 'nama', p.nama), 'mentor', jsonb_build_object('id', m.id, 'nama', m.nama),
           'topi', case when t.id is null then null else jsonb_build_object('id', t.id, 'nama', t.nama) end,
           'saya_mentor', v_saya is not null and r.mentor_id = v_saya,
           'menit_mentor', (select coalesce(sum(j.menit), 0) from public.jam_rekrut j where j.rencana_id = r.id),
           'sesi', (select coalesce(jsonb_agg(jsonb_build_object('tanggal', s.tanggal, 'menit', s.menit, 'catatan', s.catatan) order by s.tanggal desc, s.dibuat_at desc), '[]'::jsonb)
                      from (select j.tanggal, j.menit, j.catatan, j.dibuat_at from public.jam_rekrut j where j.rencana_id = r.id
                             order by j.tanggal desc, j.dibuat_at desc limit 5) s),
           'peringatan', app.peringatan_rencana(r.id))
         order by r.dibuat_at desc), '[]'::jsonb)
    into v
    from public.rencana_magang r
    join public.orang p on p.id = r.orang_id
    left join public.orang m on m.id = r.mentor_id
    left join public.topi t on t.id = r.topi_id
   where r.perusahaan_id = v_pid and (v_pengelola or (v_saya is not null and v_saya in (r.orang_id, r.mentor_id)));
  return v;
end $$;

revoke all on function public.simpan_rencana_magang(uuid, uuid, uuid, uuid, date, date, jsonb, text, jsonb, text, text, integer),
  public.catat_jam_rekrut(text, uuid, uuid, date, integer, text), public.atur_dana_rekrut(bigint, bigint), public.laporan_rekrut(date),
  public.peringatan_magang(uuid), public.daftar_rencana_magang() from public, anon;
grant execute on function public.simpan_rencana_magang(uuid, uuid, uuid, uuid, date, date, jsonb, text, jsonb, text, text, integer),
  public.catat_jam_rekrut(text, uuid, uuid, date, integer, text), public.atur_dana_rekrut(bigint, bigint), public.laporan_rekrut(date),
  public.peringatan_magang(uuid), public.daftar_rencana_magang() to authenticated;
