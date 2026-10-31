-- Izin dan cuti dengan otopilot (F1-03, docs/research/izin.md). Kebijakan per usaha dan jenis (sakit, izin, cuti) diisi pemilik;
-- tanpa angka bawaan hukum (jatah cuti 12 hari belum terverifikasi dari teks resmi). Pengajuan yang memenuhi semua syarat
-- disetujui otomatis dengan alasan tertulis; yang lain menjadi usulan izin.setujui di Feed, juga dengan alasan.

create table public.kebijakan_izin (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('sakit', 'izin', 'cuti')),
  otomatis boolean not null default false,
  maks_hari_otomatis integer not null default 1 check (maks_hari_otomatis between 0 and 30),
  butuh_bukti boolean not null default false,
  maks_bersamaan integer check (maks_bersamaan between 0 and 1000),
  jatah_tahunan integer check (jatah_tahunan between 0 and 60),
  diubah_at timestamptz not null default now(),
  primary key (perusahaan_id, jenis)
);
alter table public.kebijakan_izin enable row level security;
create policy kebijakan_izin_baca on public.kebijakan_izin for select to authenticated using (perusahaan_id = (select app.pid()));
grant select on public.kebijakan_izin to authenticated;

create table public.pengajuan_izin (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  jenis text not null check (jenis in ('sakit', 'izin', 'cuti')),
  mulai date not null,
  selesai date not null,
  hari integer not null check (hari between 1 and 60),
  alasan text check (char_length(alasan) <= 500),
  bukti_berkas_id uuid references public.berkas(id) on delete set null,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  oleh_otopilot boolean not null default false,
  alasan_putusan text not null,
  usulan_id uuid references public.usulan(id) on delete set null,
  diajukan_oleh uuid not null,
  dibuat_at timestamptz not null default now(),
  diputuskan_at timestamptz,
  check (selesai >= mulai)
);
create index on public.pengajuan_izin (perusahaan_id, mulai, selesai) where status <> 'ditolak';
create index on public.pengajuan_izin (orang_id, dibuat_at desc);
create index on public.pengajuan_izin (bukti_berkas_id);
create index on public.pengajuan_izin (usulan_id);
alter table public.pengajuan_izin enable row level security;

-- Orang (data karyawan) milik pengguna di usaha aktif.
create or replace function app.orang_saya() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.orang_id from public.anggota a where a.perusahaan_id = app.pid() and a.user_id = (select auth.uid()) and a.aktif
$$;
grant execute on function app.orang_saya() to authenticated;

-- Pengelola melihat semua pengajuan usaha; staf hanya pengajuannya sendiri. Tulis hanya lewat fungsi.
create policy pengajuan_izin_baca on public.pengajuan_izin for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.pengelola()) or orang_id = (select app.orang_saya())));
grant select on public.pengajuan_izin to authenticated;

-- Nama bulan singkat Indonesia (VOICE: 31 Okt 2026).
create or replace function app.bulan_singkat(p date) returns text
language sql immutable set search_path = '' as $$
  select (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from p)::int]
$$;

-- Hari cuti disetujui untuk satu orang di satu tahun (dihitung, tidak disimpan ganda).
create or replace function app.cuti_terpakai(p_orang uuid, p_tahun integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(hari), 0)::int from public.pengajuan_izin
   where orang_id = p_orang and jenis = 'cuti' and status = 'disetujui' and extract(year from mulai) = p_tahun
$$;

-- Kejadian izin.<jenis> untuk pengajuan yang disetujui (otopilot atau manusia).
create or replace function app.catat_izin(p public.pengajuan_izin) returns void
language sql security definer set search_path = '' as $$
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, data)
  values (p.perusahaan_id, p.mulai::timestamp at time zone 'Asia/Makassar', 'izin.' || p.jenis, 'pwa', p.orang_id, p.hari,
          jsonb_build_object('pengajuan_id', p.id, 'mulai', p.mulai, 'selesai', p.selesai, 'otopilot', p.oleh_otopilot))
$$;
revoke all on function app.cuti_terpakai(uuid, integer), app.catat_izin(public.pengajuan_izin) from public, anon, authenticated;

-- Pemilik/admin mengatur kebijakan satu jenis izin.
create or replace function public.atur_kebijakan_izin(p_jenis text, p_otomatis boolean, p_maks_hari integer, p_butuh_bukti boolean,
  p_maks_bersamaan integer default null, p_jatah_tahunan integer default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  insert into public.kebijakan_izin (perusahaan_id, jenis, otomatis, maks_hari_otomatis, butuh_bukti, maks_bersamaan, jatah_tahunan)
  values (app.pid(), p_jenis, p_otomatis, p_maks_hari, p_butuh_bukti, p_maks_bersamaan, case when p_jenis = 'cuti' then p_jatah_tahunan end)
  on conflict (perusahaan_id, jenis) do update set otomatis = excluded.otomatis, maks_hari_otomatis = excluded.maks_hari_otomatis,
    butuh_bukti = excluded.butuh_bukti, maks_bersamaan = excluded.maks_bersamaan, jatah_tahunan = excluded.jatah_tahunan, diubah_at = now();
end $$;

-- Staf mengajukan izin. Otopilot menilai kebijakan; semua syarat terpenuhi -> disetujui dengan alasan; selain itu -> Feed.
create or replace function public.ajukan_izin(p_jenis text, p_mulai date, p_selesai date, p_alasan text default null, p_berkas uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); v_nama text; k public.kebijakan_izin; iz public.pengajuan_izin;
  v_hari integer; kendala text[] := '{}'; v_hari_ini date := (now() at time zone 'Asia/Makassar')::date; v_tgl date; v_n integer; v_sisa integer;
  v_usulan uuid; v_label text; v_rentang text;
begin
  if v_pid is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini. Minta pemilik membuatkan akun staf.' using errcode = '42501'; end if;
  if p_jenis is null or p_jenis not in ('sakit', 'izin', 'cuti') then raise exception 'Jenis izin tidak dikenal' using errcode = '22023'; end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai then raise exception 'Tanggal selesai harus sama atau setelah tanggal mulai.' using errcode = '22023'; end if;
  if p_mulai < v_hari_ini - 30 or p_mulai > v_hari_ini + 90 then raise exception 'Tanggal mulai harus dalam 30 hari terakhir sampai 90 hari ke depan.' using errcode = '22023'; end if;
  v_hari := p_selesai - p_mulai + 1;
  if v_hari > 60 then raise exception 'Paling lama 60 hari per pengajuan.' using errcode = '22023'; end if;
  if p_berkas is not null and not exists (select 1 from public.berkas where id = p_berkas and perusahaan_id = v_pid) then
    raise exception 'Berkas bukti tidak ditemukan' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.pengajuan_izin where orang_id = v_orang and status <> 'ditolak' and mulai <= p_selesai and selesai >= p_mulai) then
    raise exception 'Kamu sudah punya pengajuan di tanggal itu. Lihat daftar pengajuanmu.' using errcode = '23505';
  end if;
  select nama into v_nama from public.orang where id = v_orang;
  v_label := p_jenis;
  v_rentang := to_char(p_mulai, 'FMDD') || ' ' || app.bulan_singkat(p_mulai)
    || case when v_hari > 1 then ' sampai ' || to_char(p_selesai, 'FMDD') || ' ' || app.bulan_singkat(p_selesai) else '' end;

  select * into k from public.kebijakan_izin where perusahaan_id = v_pid and jenis = p_jenis;
  if k.jenis is null then
    kendala := kendala || ('belum ada kebijakan ' || v_label || ' untuk disetujui otomatis');
  else
    if not k.otomatis then kendala := kendala || ('kebijakan ' || v_label || ' selalu diputuskan manusia'); end if;
    if v_hari > k.maks_hari_otomatis then kendala := kendala || (v_hari || ' hari, lebih dari batas otomatis ' || k.maks_hari_otomatis || ' hari'); end if;
    if k.butuh_bukti and p_berkas is null then kendala := kendala || 'belum ada bukti (kebijakan meminta bukti)'::text; end if;
    if k.maks_bersamaan is not null then
      select d::date, count(distinct p.orang_id)::int into v_tgl, v_n
        from generate_series(p_mulai, p_selesai, interval '1 day') d
        join public.pengajuan_izin p on p.perusahaan_id = v_pid and p.status = 'disetujui' and p.orang_id <> v_orang and d::date between p.mulai and p.selesai
       group by d order by count(distinct p.orang_id) desc, d limit 1;
      if v_n is not null and v_n >= k.maks_bersamaan then
        kendala := kendala || (v_n || ' orang lain sudah izin pada ' || to_char(v_tgl, 'FMDD') || ' ' || app.bulan_singkat(v_tgl) || ' (batas ' || k.maks_bersamaan || ')');
      end if;
    end if;
    if p_jenis = 'cuti' and k.jatah_tahunan is not null then
      v_sisa := k.jatah_tahunan - app.cuti_terpakai(v_orang, extract(year from p_mulai)::int);
      if v_hari > v_sisa then kendala := kendala || ('saldo cuti tinggal ' || greatest(v_sisa, 0) || ' hari'); end if;
    end if;
  end if;

  if cardinality(kendala) = 0 then
    insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, alasan, bukti_berkas_id, status, oleh_otopilot,
      alasan_putusan, diajukan_oleh, diputuskan_at)
    values (v_pid, v_orang, p_jenis, p_mulai, p_selesai, v_hari, nullif(btrim(p_alasan), ''), p_berkas, 'disetujui', true,
      'Disetujui otomatis: ' || v_label || ' ' || v_hari || ' hari' || case when p_berkas is not null then ' dengan bukti' else '' end
        || ', sesuai kebijakan ' || v_label || '.', (select auth.uid()), now())
    returning * into iz;
    perform app.catat_izin(iz);
  else
    insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, alasan, bukti_berkas_id, alasan_putusan, diajukan_oleh)
    values (v_pid, v_orang, p_jenis, p_mulai, p_selesai, v_hari, nullif(btrim(p_alasan), ''), p_berkas,
      'Menunggu keputusan pemilik atau admin: ' || array_to_string(kendala, '; ') || '.', (select auth.uid()))
    returning * into iz;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, tenggat, berkas_id)
    values (v_pid, 'pwa', 'izin.setujui', 'Setujui ' || v_label || ' ' || v_nama || ' ' || v_hari || ' hari (' || v_rentang || ')',
      'Perlu keputusanmu: ' || array_to_string(kendala, '; ') || '.' || coalesce(' Alasan: ' || nullif(btrim(p_alasan), '') || '.', ''),
      jsonb_build_object('pengajuan_id', iz.id, 'orang_id', v_orang, 'nama', v_nama, 'jenis', p_jenis, 'mulai', p_mulai, 'selesai', p_selesai,
        'hari', v_hari, 'kendala', to_jsonb(kendala)),
      p_mulai::timestamp at time zone 'Asia/Makassar', p_berkas)
    returning id into v_usulan;
    update public.pengajuan_izin set usulan_id = v_usulan where id = iz.id;
  end if;
  return jsonb_build_object('id', iz.id, 'status', iz.status, 'oleh_otopilot', iz.oleh_otopilot, 'alasan_putusan', iz.alasan_putusan, 'hari', v_hari);
end $$;

-- Ringkasan untuk layar staf: saldo cuti tahun ini (bila ada jatah).
create or replace function public.izin_ringkas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_orang uuid := app.orang_saya(); v_tahun integer := extract(year from now() at time zone 'Asia/Makassar')::int; v_jatah integer; v_pakai integer;
begin
  if app.pid() is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  select jatah_tahunan into v_jatah from public.kebijakan_izin where perusahaan_id = app.pid() and jenis = 'cuti';
  v_pakai := case when v_orang is null then 0 else app.cuti_terpakai(v_orang, v_tahun) end;
  return jsonb_build_object('punya_orang', v_orang is not null, 'tahun', v_tahun,
    'cuti', jsonb_build_object('jatah', v_jatah, 'terpakai', v_pakai, 'sisa', case when v_jatah is null then null else greatest(v_jatah - v_pakai, 0) end));
end $$;

revoke all on function public.atur_kebijakan_izin(text, boolean, integer, boolean, integer, integer), public.ajukan_izin(text, date, date, text, uuid),
  public.izin_ringkas() from public, anon;
grant execute on function public.atur_kebijakan_izin(text, boolean, integer, boolean, integer, integer), public.ajukan_izin(text, date, date, text, uuid),
  public.izin_ringkas() to authenticated;

-- putuskan_usulan: versi topi_impor_tanggal + cabang izin.setujui (setuju) dan penolakan pengajuan izin.
create or replace function public.putuskan_usulan(p_usulan uuid, p_setuju boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usulan; iz public.pengajuan_izin; b jsonb; r jsonb; v_pid uuid := app.pid(); v_orang uuid; v_jalur text; n int := 0; lewat int := 0; v_nik text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa memutuskan usulan' using errcode = '42501';
  end if;
  select * into u from public.usulan where id = p_usulan and perusahaan_id = v_pid for update;
  if not found or not (app.prn() = any(u.untuk_peran)) then
    raise exception 'Usulan tidak ditemukan' using errcode = 'P0002';
  end if;
  if u.status <> 'menunggu' then
    return jsonb_build_object('status', u.status, 'dibuat', 0, 'sudah', true);
  end if;
  b := u.payload -> 'bidang';
  select jalur into v_jalur from public.berkas where id = u.berkas_id;
  v_nik := b ->> 'nik';

  if p_setuju then
    case u.aksi
      when 'orang.buat' then
        insert into public.orang (perusahaan_id, nama, data)
        values (v_pid, initcap(lower(b ->> 'nama')), jsonb_strip_nulls(jsonb_build_object(
          'tanggal_lahir', nullif(b ->> 'tanggal_lahir', ''), 'jenis_kelamin', nullif(b ->> 'jenis_kelamin', ''), 'sumber', case u.sumber when 'lempar' then 'ktp' else u.sumber end)))
        returning id into v_orang;
        perform app.pasang_topi_dari_jabatan(v_pid, v_orang, b ->> 'jabatan');
        if coalesce(v_nik, '') <> '' then
          insert into public.orang_rahasia (orang_id, perusahaan_id, nik_hash, nik_akhir)
          values (v_orang, v_pid, encode(extensions.digest(v_nik || v_pid::text, 'sha256'), 'hex'), right(v_nik, 4));
        end if;
        n := 1;
      when 'orang.impor' then
        for r in select * from jsonb_array_elements(coalesce(b -> 'baris', '[]')) loop
          if coalesce(r ->> 'nama', '') = '' then
            lewat := lewat + 1;
            continue;
          end if;
          select id into v_orang from public.orang where perusahaan_id = v_pid and lower(nama) = lower(r ->> 'nama') limit 1;
          if v_orang is not null then
            -- Sudah ada: tidak digandakan, tapi diberi topi dari jabatannya bila belum punya.
            if not exists (select 1 from public.pakai_topi where orang_id = v_orang) then
              perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan');
            end if;
            lewat := lewat + 1;
            continue;
          end if;
          insert into public.orang (perusahaan_id, nama, telepon, data)
          values (v_pid, r ->> 'nama', nullif(r ->> 'telepon', ''), jsonb_strip_nulls(jsonb_build_object(
            'kode', nullif(r ->> 'id', ''), 'jabatan', nullif(r ->> 'jabatan', ''), 'mulai', nullif(r ->> 'mulai', ''), 'sumber', 'excel')))
          returning id into v_orang;
          perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan', (app.tanggal_aman(r ->> 'mulai') at time zone 'Asia/Makassar')::date);
          if coalesce((r ->> 'gaji_pokok')::numeric, 0) > 0 then
            insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (v_orang, v_pid, jsonb_build_object('pokok', (r ->> 'gaji_pokok')::numeric));
          end if;
          n := n + 1;
        end loop;
      when 'rekrut.pelamar' then
        insert into public.orang (perusahaan_id, nama, jenis, status, data)
        values (v_pid, b ->> 'nama', '{kandidat}', 'kandidat_baru', jsonb_build_object(
          'posisi', b ->> 'posisi', 'pengalaman', coalesce(b -> 'pengalaman', '[]'), 'keahlian', coalesce(b -> 'keahlian', '[]'), 'sumber', 'cv'));
        n := 1;
      when 'absen.impor' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, keyakinan, bukti, data)
        select v_pid, coalesce(app.tanggal_aman(x ->> 'tanggal', x ->> 'masuk'), now()), 'absen.harian', u.sumber,
               (select o.id from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(x ->> 'nama') limit 1),
               u.keyakinan, v_jalur, x
          from jsonb_array_elements(coalesce(b -> 'baris', '[]')) x;
        get diagnostics n = row_count;
      when 'uang.mutasi' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, keyakinan, bukti, data)
        select v_pid, coalesce(app.tanggal_aman(x ->> 'tanggal'), now()),
               case when x ->> 'arah' = 'CR' then 'bank.masuk' else 'bank.keluar' end, u.sumber,
               (x ->> 'jumlah')::numeric, u.keyakinan, v_jalur, x
          from jsonb_array_elements(coalesce(b -> 'baris', '[]')) x;
        get diagnostics n = row_count;
      when 'izin.setujui' then
        -- Pengajuan izin yang tidak lolos otopilot: disetujui manusia, dicatat sebagai kejadian izin.<jenis>.
        update public.pengajuan_izin set status = 'disetujui', oleh_otopilot = false, diputuskan_at = now(),
               alasan_putusan = 'Disetujui ' || case app.prn() when 'pemilik' then 'pemilik' else 'admin' end || '.'
         where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu'
        returning * into iz;
        if iz.id is not null then
          perform app.catat_izin(iz);
          n := 1;
        end if;
      when 'izin.sakit' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(b ->> 'mulai'), now()), 'izin.sakit', u.sumber,
                (select o.id from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(b ->> 'nama') limit 1),
                (b ->> 'lama_hari')::numeric, u.keyakinan, v_jalur, b);
        n := 1;
      else
        -- uang.keluar, uang.tagihan, dokumen.*, berkas.tinjau: satu kejadian dengan bukti berkas.
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(coalesce(b ->> 'tanggal', b ->> 'periode' || '-01')), now()), u.aksi, u.sumber,
                u.dampak_rp, u.keyakinan, v_jalur, b);
        n := 1;
    end case;
  end if;

  if not p_setuju and u.aksi = 'izin.setujui' then
    update public.pengajuan_izin set status = 'ditolak', oleh_otopilot = false, diputuskan_at = now(),
           alasan_putusan = 'Belum disetujui. Bicarakan langsung dengan pemilik atau admin, atau ajukan ulang dengan tanggal lain.'
     where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu';
  end if;

  update public.usulan
     set status = case when p_setuju then 'diterima' else 'ditolak' end, diputuskan_oleh = auth.uid(), diputuskan_at = now(),
         payload = case when v_nik is null then payload else jsonb_set(payload, '{bidang,nik}', to_jsonb('****' || right(v_nik, 4))) end
   where id = u.id;
  update public.berkas
     set status = 'selesai', diubah_at = now(),
         hasil = case when v_nik is null or hasil is null then hasil else jsonb_set(hasil, '{bidang,nik}', to_jsonb('****' || right(v_nik, 4))) end
   where id = u.berkas_id;
  return jsonb_build_object('status', case when p_setuju then 'diterima' else 'ditolak' end, 'aksi', u.aksi, 'dibuat', n, 'dilewati', lewat);
end $$;
