-- F3-07 Serah terima (docs/research/serah-terima.md, serah-terima-sql.md, docs/design/serah-terima-layar.md; tes
-- supabase/tests/serah_terima.test.sql). Mencatat orang berhenti menyusun paket dalam satu transaksi: topi yang dipakai, kerja
-- berjalan dengan usulan pengganti (rekan aktif bertopi sama dengan kerja terbuka paling sedikit), ilmu dari topi yang hanya dia
-- pakai, akses otomatis (akun Nadi, token tablet buatannya) dan akses manual (dicentang pemilik). Peringatan 30 hari (PP 35/2021
-- Pasal 36 huruf i) tidak memblokir. Akses dicabut SETELAH tanggal efektif lewat di zona usaha (pg_cron tiap jam): anggota dan orang
-- nonaktif, topi berakhir di tanggal efektif, token tablet dicabut, akun staf sintetis dikunci. Tanpa menghapus data (status saja).
-- Rekam Ilmu suara, wawancara keluar, dan usulan hak keuangan menyusul (F3-07C/D/E).

create table public.berhenti (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tanggal_surat date not null,
  tanggal_efektif date not null check (tanggal_efektif >= tanggal_surat),
  alasan text not null check (alasan in ('mundur', 'kontrak_selesai', 'lainnya')),
  peringatan text[] not null default '{}',
  status text not null default 'disiapkan' check (status in ('disiapkan', 'selesai', 'batal')),
  alasan_batal text check (alasan_batal is null or length(alasan_batal) <= 300),
  kunci_klien uuid not null,
  dicabut_at timestamptz,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien)
);
create unique index berhenti_satu_aktif on public.berhenti (orang_id) where status = 'disiapkan';
create index on public.berhenti (perusahaan_id, tanggal_efektif) where status = 'disiapkan';

create table public.serah_butir (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  berhenti_id uuid not null references public.berhenti(id) on delete cascade,
  jenis text not null check (jenis in ('kerja', 'topi', 'ilmu', 'akses_otomatis', 'akses_manual')),
  kerja_id uuid references public.kerja(id) on delete set null,
  topi_id uuid references public.topi(id) on delete set null,
  judul text not null check (length(judul) between 1 and 200),
  pengganti_id uuid references public.orang(id) on delete set null,
  status text not null default 'terbuka' check (status in ('terbuka', 'selesai', 'dilewati')),
  sumber text not null default 'jejak' check (sumber in ('jejak', 'pemilik')),
  dibuat_at timestamptz not null default now(),
  selesai_at timestamptz
);
create index on public.serah_butir (berhenti_id);
create index on public.serah_butir (kerja_id);
create index on public.serah_butir (topi_id);
create index on public.serah_butir (pengganti_id);

alter table public.berhenti enable row level security;
alter table public.serah_butir enable row level security;
create policy berhenti_baca on public.berhenti for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy serah_butir_baca on public.serah_butir for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.berhenti, public.serah_butir to authenticated;
create trigger audit_berhenti after insert or update or delete on public.berhenti for each row execute function app.catat_audit();
create trigger audit_serah_butir after insert or update or delete on public.serah_butir for each row execute function app.catat_audit();

-- Rekan aktif bertopi sama (bukan yang sedang berhenti) dengan kerja terbuka paling sedikit.
create or replace function app.pengganti_untuk(p_pid uuid, p_topi uuid, p_kecuali uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select o.id
    from public.orang o
    join public.pakai_topi p on p.orang_id = o.id and p.topi_id = p_topi and (p.selesai is null or p.selesai >= app.hari_ini(p_pid))
   where o.perusahaan_id = p_pid and o.status = 'aktif' and o.id <> p_kecuali
     and not exists (select 1 from public.berhenti b where b.orang_id = o.id and b.status = 'disiapkan')
   order by (select count(*) from public.kerja k where k.pelaksana_id = o.id and k.status not in ('selesai', 'batal')), o.nama
   limit 1
$$;

create or replace function public.catat_berhenti(p_orang uuid, p_surat date, p_efektif date, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); o public.orang; b public.berhenti; v_hari date; t record; k record;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencatat karyawan berhenti' using errcode = '42501';
  end if;
  select * into b from public.berhenti where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then
    return jsonb_build_object('id', b.id, 'peringatan', to_jsonb(b.peringatan), 'baru', false);
  end if;
  select * into o from public.orang where id = p_orang and perusahaan_id = v_pid and status = 'aktif';
  if not found then
    raise exception 'Orang aktif tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.anggota a where a.perusahaan_id = v_pid and a.peran = 'pemilik' and a.aktif
               and (a.orang_id = o.id or (o.user_id is not null and a.user_id = o.user_id))) then
    raise exception 'Pemilik tidak bisa diberhentikan lewat Nadi' using errcode = '22023';
  end if;
  if p_alasan is null or p_alasan not in ('mundur', 'kontrak_selesai', 'lainnya') then
    raise exception 'Pilih alasan berhenti' using errcode = '22023';
  end if;
  if p_surat is null or p_efektif is null or p_efektif < p_surat then
    raise exception 'Tanggal efektif tidak boleh sebelum tanggal surat' using errcode = '22023';
  end if;
  if exists (select 1 from public.berhenti x where x.orang_id = o.id and x.status = 'disiapkan') then
    raise exception 'Orang ini sudah punya proses berhenti yang berjalan' using errcode = '22023';
  end if;
  v_hari := app.hari_ini(v_pid);
  insert into public.berhenti (perusahaan_id, orang_id, tanggal_surat, tanggal_efektif, alasan, peringatan, kunci_klien, dibuat_oleh)
  values (v_pid, o.id, p_surat, p_efektif, p_alasan,
          case when p_alasan = 'mundur' and p_efektif - p_surat < 30 then array['kurang_30_hari'] else '{}' end, p_kunci, auth.uid())
  returning * into b;

  for t in select p.topi_id, p.porsi, tp.nama from public.pakai_topi p join public.topi tp on tp.id = p.topi_id
            where p.orang_id = o.id and (p.selesai is null or p.selesai >= v_hari) order by tp.nama loop
    insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, topi_id, judul, pengganti_id)
    values (v_pid, b.id, 'topi', t.topi_id, left(t.nama || ' (' || round(t.porsi) || '%)', 200), app.pengganti_untuk(v_pid, t.topi_id, o.id));
    if not exists (select 1 from public.pakai_topi p2 join public.orang o2 on o2.id = p2.orang_id
                    where p2.topi_id = t.topi_id and p2.orang_id <> o.id and o2.status = 'aktif' and (p2.selesai is null or p2.selesai >= v_hari)) then
      insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, topi_id, judul)
      values (v_pid, b.id, 'ilmu', t.topi_id, left('Cara kerja ' || t.nama || ': hanya ' || o.nama || ' yang memakai topi ini', 200));
    end if;
  end loop;
  for k in select kr.id, kr.judul, kr.topi_id from public.kerja kr
            where kr.pelaksana_id = o.id and kr.status not in ('selesai', 'batal') order by kr.dibuat_at loop
    insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, kerja_id, topi_id, judul, pengganti_id)
    values (v_pid, b.id, 'kerja', k.id, k.topi_id, left(k.judul, 200),
            case when k.topi_id is not null then app.pengganti_untuk(v_pid, k.topi_id, o.id) end);
  end loop;
  insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, judul)
  select v_pid, b.id, 'akses_otomatis', 'Akun Nadi (' || a.peran || ')'
    from public.anggota a where a.perusahaan_id = v_pid and a.aktif and (a.orang_id = o.id or (o.user_id is not null and a.user_id = o.user_id))
   limit 1;
  insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, judul)
  select v_pid, b.id, 'akses_otomatis', left('Tautan tablet absen buatannya: ' || coalesce(tk.nama, 'tanpa nama'), 200)
    from app.token_kios tk where o.user_id is not null and tk.perusahaan_id = v_pid and tk.dibuat_oleh = o.user_id and tk.dicabut_at is null;
  insert into public.serah_butir (perusahaan_id, berhenti_id, jenis, judul)
  select v_pid, b.id, 'akses_manual', j from unnest(array['Grup WhatsApp kerja', 'Akun bank atau QRIS usaha', 'Kunci toko atau gudang', 'Seragam dan alat kerja']) j;
  return jsonb_build_object('id', b.id, 'peringatan', to_jsonb(b.peringatan), 'baru', true);
end $$;

create or replace function public.pindahkan_ke_pengganti(p_berhenti uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); b public.berhenti; s record; n int := 0;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang memindah kerja' using errcode = '42501';
  end if;
  select * into b from public.berhenti where id = p_berhenti and perusahaan_id = v_pid and status = 'disiapkan';
  if not found then
    raise exception 'Proses berhenti tidak ditemukan atau sudah selesai' using errcode = 'P0002';
  end if;
  for s in select sb.* from public.serah_butir sb where sb.berhenti_id = b.id and sb.jenis = 'kerja' and sb.status = 'terbuka'
            and sb.pengganti_id is not null and sb.kerja_id is not null loop
    update public.kerja set pelaksana_id = s.pengganti_id where id = s.kerja_id and pelaksana_id = b.orang_id and status not in ('selesai', 'batal');
    update public.serah_butir set status = 'selesai', selesai_at = now() where id = s.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.tandai_butir(p_butir uuid, p_status text, p_pengganti uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s public.serah_butir; b public.berhenti;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengubah paket serah terima' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('terbuka', 'selesai', 'dilewati') then
    raise exception 'Status butir: terbuka, selesai, atau dilewati' using errcode = '22023';
  end if;
  select * into s from public.serah_butir where id = p_butir and perusahaan_id = v_pid;
  select * into b from public.berhenti where id = s.berhenti_id and status = 'disiapkan';
  if s.id is null or b.id is null then
    raise exception 'Butir tidak ditemukan atau paketnya sudah selesai' using errcode = 'P0002';
  end if;
  if p_pengganti is not null and (p_pengganti = b.orang_id or not exists (
       select 1 from public.orang o where o.id = p_pengganti and o.perusahaan_id = v_pid and o.status = 'aktif')) then
    raise exception 'Pengganti harus orang aktif lain di usaha ini' using errcode = '22023';
  end if;
  update public.serah_butir set status = p_status, pengganti_id = coalesce(p_pengganti, pengganti_id),
         selesai_at = case when p_status = 'terbuka' then null else now() end
   where id = s.id;
end $$;

create or replace function public.batal_berhenti(p_berhenti uuid, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membatalkan proses berhenti' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan pembatalan' using errcode = '22023';
  end if;
  update public.berhenti set status = 'batal', alasan_batal = left(btrim(p_alasan), 300)
   where id = p_berhenti and perusahaan_id = v_pid and status = 'disiapkan';
  if not found then
    raise exception 'Proses berhenti tidak ditemukan atau sudah selesai' using errcode = 'P0002';
  end if;
end $$;

-- Pencabut: semua proses yang tanggal efektifnya sudah lewat (hari ini menurut zona tiap usaha, atau p_hari untuk tes).
create or replace function app.cabut_akses_berhenti(p_hari date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare b record; v_user uuid; n int := 0;
begin
  for b in select x.* from public.berhenti x
            where x.status = 'disiapkan' and x.tanggal_efektif < coalesce(p_hari, app.hari_ini(x.perusahaan_id))
            for update loop
    select o.user_id into v_user from public.orang o where o.id = b.orang_id;
    update public.anggota set aktif = false
     where perusahaan_id = b.perusahaan_id and aktif and (orang_id = b.orang_id or (v_user is not null and user_id = v_user));
    update public.orang set status = 'nonaktif' where id = b.orang_id;
    update public.pakai_topi set selesai = greatest(mulai, b.tanggal_efektif)
     where orang_id = b.orang_id and (selesai is null or selesai > b.tanggal_efektif);
    if v_user is not null then
      update app.token_kios set dicabut_at = now() where perusahaan_id = b.perusahaan_id and dibuat_oleh = v_user and dicabut_at is null;
      -- Akun staf sintetis (hanya untuk usaha ini) dikunci; buat_akun_staf membukanya lagi bila orang itu kembali.
      update auth.users set banned_until = timestamptz '2999-12-31 00:00:00+00' where id = v_user and raw_user_meta_data ->> 'staf' = 'true';
    end if;
    update public.serah_butir set status = 'selesai', selesai_at = now() where berhenti_id = b.id and jenis = 'akses_otomatis' and status = 'terbuka';
    update public.berhenti set status = 'selesai', dicabut_at = now() where id = b.id;
    n := n + 1;
  end loop;
  return n;
end $$;

select cron.schedule('nadi-cabut-berhenti', '5 * * * *', $$select app.cabut_akses_berhenti()$$);

revoke all on function app.pengganti_untuk(uuid, uuid, uuid), app.cabut_akses_berhenti(date) from public, anon, authenticated;
revoke all on function public.catat_berhenti(uuid, date, date, text, uuid), public.pindahkan_ke_pengganti(uuid), public.tandai_butir(uuid, text, uuid),
  public.batal_berhenti(uuid, text) from public, anon;
grant execute on function public.catat_berhenti(uuid, date, date, text, uuid), public.pindahkan_ke_pengganti(uuid), public.tandai_butir(uuid, text, uuid),
  public.batal_berhenti(uuid, text) to authenticated;
