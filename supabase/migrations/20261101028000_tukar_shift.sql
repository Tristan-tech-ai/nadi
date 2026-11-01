-- F3-06B Tukar shift antarstaf (docs/design/tukar-shift.md). Staf menawarkan shift-nya yang belum mulai ke rekan bertopi sama
-- (atau semua karyawan bila shift tanpa topi); rekan mengambil setelah cek batas PP 35/2021 yang sama dengan simpan_shift
-- (simulasi pindah di sub-transaksi lalu app.lembur_minggu, kemudian dibatalkan); peringatan (lembur, lewat 40 jam, kurang libur)
-- harus dikonfirmasi pengambil, dan karena ia sendiri yang mengambil, persetujuan lembur tercatat sekaligus (Pasal 78). Tukar
-- menjadi usulan shift.tukar di Feed; disetujui pemilik/admin = shift berpindah dalam transaksi putuskan_usulan (trigger, pola
-- agenda surat) dengan cek batas diulang; ditolak = shift tetap. v1 hanya "lepas" (tanpa balas tukar) ke semua rekan yang
-- memenuhi syarat. Tes: supabase/tests/tukar_shift.test.sql.

alter table public.persetujuan_lembur drop constraint persetujuan_lembur_status_check;
alter table public.persetujuan_lembur add constraint persetujuan_lembur_status_check check (status in ('menunggu', 'setuju', 'tidak', 'batal'));

create table public.tawaran_shift (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  shift_id uuid not null references public.shift(id) on delete cascade,
  dari_orang uuid not null references public.orang(id) on delete cascade,
  diambil_oleh uuid references public.orang(id) on delete set null,
  status text not null default 'terbuka' check (status in ('terbuka', 'diambil', 'disetujui', 'ditolak', 'batal')),
  lembur_menit integer not null default 0 check (lembur_menit >= 0),
  peringatan text[] not null default '{}',
  usulan_id uuid unique references public.usulan(id) on delete set null,
  kunci_klien uuid not null,
  dibuat_at timestamptz not null default now(),
  diambil_at timestamptz,
  diputus_at timestamptz,
  unique (perusahaan_id, kunci_klien),
  check (status not in ('diambil', 'disetujui') or diambil_oleh is not null)
);
create unique index tawaran_shift_aktif on public.tawaran_shift (shift_id) where status in ('terbuka', 'diambil');
create index on public.tawaran_shift (shift_id);
create index on public.tawaran_shift (perusahaan_id, status);
create index on public.tawaran_shift (dari_orang);
create index on public.tawaran_shift (diambil_oleh);

alter table public.tawaran_shift enable row level security;
create policy tawaran_shift_baca on public.tawaran_shift for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan')
         or dari_orang = (select app.orang_saya()) or diambil_oleh = (select app.orang_saya())));
grant select on public.tawaran_shift to authenticated;
create trigger audit_tawaran_shift after insert or update or delete on public.tawaran_shift for each row execute function app.catat_audit();

-- Akibat memindah shift ke orang lain, dihitung dengan memindahkannya sungguhan lalu dibatalkan (sub-transaksi), sehingga
-- aturannya persis app.lembur_minggu dan exclusion constraint shift_tanpa_tumpang.
create or replace function app.cek_pindah_shift(p_pid uuid, p_shift uuid, p_orang uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.shift; l record; r jsonb; v_hari int := 0; v_minggu int := 0; v_total int := 0; v_kerja int := 0; v_p text[] := '{}';
begin
  select * into s from public.shift where id = p_shift and perusahaan_id = p_pid;
  begin
    update public.shift set orang_id = p_orang where id = p_shift;
    for l in select * from app.lembur_minggu(p_pid, p_orang, s.tanggal) loop
      if l.hari = s.tanggal then v_hari := l.lembur_hari; end if;
      v_minggu := l.lembur_minggu; v_total := l.total_minggu; v_kerja := l.hari_kerja;
    end loop;
    if v_hari > 0 then v_p := array_append(v_p, 'lembur'); end if;
    if v_total > 2400 then v_p := array_append(v_p, 'lewat_40_minggu'); end if;
    if v_kerja > (case app.pola_kerja(p_pid) when '5_hari' then 5 else 6 end) then v_p := array_append(v_p, 'kurang_libur'); end if;
    raise exception using errcode = 'NDS01', message = jsonb_build_object('tumpang', false, 'lembur_hari', v_hari, 'lembur_minggu', v_minggu,
      'total_minggu', v_total, 'menit_shift', app.menit_shift(s.mulai, s.selesai, s.istirahat_menit), 'peringatan', to_jsonb(v_p))::text;
  exception
    when sqlstate 'NDS01' then r := sqlerrm::jsonb;
    when exclusion_violation then r := jsonb_build_object('tumpang', true);
  end;
  return r;
end $$;

-- Batas keras: sama dengan simpan_shift.
create or replace function app.tolak_batas_pindah(c jsonb) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if (c ->> 'tumpang')::boolean then
    raise exception 'Belum bisa diambil: bertabrakan dengan shiftmu yang lain.' using errcode = '23P01';
  end if;
  if (c ->> 'lembur_hari')::int > 240 then
    raise exception 'Belum bisa diambil: kamu jadi lembur % jam hari itu, paling lama 4 jam sehari (PP 35/2021 Pasal 26).',
      replace(trim_scale(round((c ->> 'lembur_hari')::int / 60.0, 1))::text, '.', ',') using errcode = '54000';
  end if;
  if (c ->> 'lembur_minggu')::int > 1080 then
    raise exception 'Belum bisa diambil: lemburmu jadi % jam minggu itu, paling lama 18 jam seminggu (PP 35/2021 Pasal 26).',
      replace(trim_scale(round((c ->> 'lembur_minggu')::int / 60.0, 1))::text, '.', ',') using errcode = '54000';
  end if;
end $$;

-- Rekan yang boleh mengambil: karyawan/magang aktif selain penawar, memakai topi shift itu (bila shift bertopi).
create or replace function app.boleh_ambil_shift(p_pid uuid, s public.shift, p_orang uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_orang is not null and p_orang <> s.orang_id
     and exists (select 1 from public.orang o where o.id = p_orang and o.perusahaan_id = p_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang'])
     and (s.topi_id is null or exists (select 1 from public.pakai_topi pt where pt.perusahaan_id = p_pid and pt.orang_id = p_orang and pt.topi_id = s.topi_id
                                         and pt.mulai <= app.hari_ini(p_pid) and (pt.selesai is null or pt.selesai >= app.hari_ini(p_pid))))
$$;

create or replace function app.tanggal_pendek(d date) returns text
language sql immutable set search_path = '' as $$
  select extract(day from d)::int || ' ' || (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])[extract(month from d)::int]
$$;

create or replace function public.tawarkan_shift(p_shift uuid, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); s public.shift; t public.tawaran_shift;
begin
  if v_pid is null or v_saya is null then
    raise exception 'Akunmu belum tertaut ke orang di usaha ini' using errcode = '42501';
  end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into t from public.tawaran_shift where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', t.id, 'sudah', true); end if;
  select * into s from public.shift where id = p_shift and perusahaan_id = v_pid and orang_id = v_saya and status = 'aktif' for update;
  if not found then raise exception 'Shift ini bukan milikmu' using errcode = 'P0002'; end if;
  if s.mulai_at <= now() then raise exception 'Shift yang sudah mulai tidak bisa ditawarkan.' using errcode = '22023'; end if;
  select * into t from public.tawaran_shift where shift_id = s.id and status in ('terbuka', 'diambil');
  if found then return jsonb_build_object('id', t.id, 'sudah', true); end if;
  insert into public.tawaran_shift (perusahaan_id, shift_id, dari_orang, kunci_klien) values (v_pid, s.id, v_saya, p_kunci) returning * into t;
  return jsonb_build_object('id', t.id, 'sudah', false);
end $$;

create or replace function public.batal_tawaran(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); t public.tawaran_shift;
begin
  select * into t from public.tawaran_shift where id = p_id and perusahaan_id = v_pid and dari_orang = (select app.orang_saya()) for update;
  if not found then raise exception 'Tawaran tidak ditemukan' using errcode = 'P0002'; end if;
  if t.status = 'diambil' then raise exception 'Sudah diambil rekan; tunggu keputusan pemilik.' using errcode = '22023'; end if;
  update public.tawaran_shift set status = 'batal', diputus_at = now() where id = t.id and status = 'terbuka';
end $$;

-- Ambil tawaran. Tanpa konfirmasi dan ada peringatan: hanya mengembalikan peringatannya (belum diambil).
create or replace function public.ambil_tawaran(p_id uuid, p_konfirmasi boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); t public.tawaran_shift; s public.shift; c jsonb; v_u uuid;
  v_dari text; v_ke text; v_jam text; v_lembur text;
begin
  if v_pid is null or v_saya is null then
    raise exception 'Akunmu belum tertaut ke orang di usaha ini' using errcode = '42501';
  end if;
  select * into t from public.tawaran_shift where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Tawaran tidak ditemukan' using errcode = 'P0002'; end if;
  if t.status in ('diambil', 'disetujui') then
    raise exception 'Sudah diambil %.', (select nama from public.orang where id = t.diambil_oleh) using errcode = '55000';
  end if;
  if t.status <> 'terbuka' then raise exception 'Tawaran ini sudah tidak berlaku.' using errcode = '55000'; end if;
  select * into s from public.shift where id = t.shift_id for update;
  if s.status <> 'aktif' or s.mulai_at <= now() then
    raise exception 'Shift ini sudah mulai atau dibatalkan; tawarannya tidak berlaku lagi.' using errcode = '55000';
  end if;
  if t.dari_orang = v_saya then raise exception 'Ini shiftmu sendiri.' using errcode = '22023'; end if;
  if not app.boleh_ambil_shift(v_pid, s, v_saya) then raise exception 'Tawaran ini bukan untukmu' using errcode = 'P0002'; end if;
  c := app.cek_pindah_shift(v_pid, s.id, v_saya);
  perform app.tolak_batas_pindah(c);
  if jsonb_array_length(c -> 'peringatan') > 0 and not coalesce(p_konfirmasi, false) then
    return jsonb_build_object('status', 'perlu_konfirmasi', 'peringatan', c -> 'peringatan', 'lembur_menit', least((c ->> 'lembur_hari')::int, (c ->> 'menit_shift')::int),
                              'total_minggu', c -> 'total_minggu');
  end if;
  select nama into v_dari from public.orang where id = t.dari_orang;
  select nama into v_ke from public.orang where id = v_saya;
  v_jam := replace(trim_scale(round((c ->> 'total_minggu')::int / 60.0, 1))::text, '.', ',');
  v_lembur := case when (c ->> 'lembur_hari')::int > 0
    then format(' %s jadi lembur %s jam hari itu dan sudah menyetujuinya saat mengambil.', v_ke,
                replace(trim_scale(round(least((c ->> 'lembur_hari')::int, (c ->> 'menit_shift')::int) / 60.0, 1))::text, '.', ','))
    else '' end;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, tenggat)
  values (v_pid, 'pwa', 'shift.tukar',
          format('%s menukar shift %s %s-%s ke %s. %s jadi %s jam minggu ini.', v_dari, app.tanggal_pendek(s.tanggal), to_char(s.mulai, 'HH24.MI'),
                 to_char(s.selesai, 'HH24.MI'), v_ke, v_ke, v_jam),
          'Setujui untuk memindah shift ini ke ' || v_ke || '. Tolak bila shift tetap milik ' || v_dari || '.' || v_lembur,
          jsonb_build_object('tawaran_id', t.id, 'shift_id', s.id, 'dari', t.dari_orang, 'ke', v_saya, 'bidang', jsonb_build_object('tanggal', s.tanggal)),
          s.mulai_at)
  returning id into v_u;
  update public.tawaran_shift set status = 'diambil', diambil_oleh = v_saya, diambil_at = now(), usulan_id = v_u,
         lembur_menit = least((c ->> 'lembur_hari')::int, (c ->> 'menit_shift')::int),
         peringatan = array(select jsonb_array_elements_text(c -> 'peringatan'))
   where id = t.id;
  return jsonb_build_object('status', 'diambil', 'usulan_id', v_u);
end $$;

-- Disetujui di Feed: shift berpindah (cek batas diulang karena jadwal bisa berubah sejak diambil). Ditolak: shift tetap.
create or replace function app.tukar_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.tawaran_shift; s public.shift; c jsonb; v_lembur int;
begin
  select * into t from public.tawaran_shift where usulan_id = new.id for update;
  if not found or t.status <> 'diambil' then return null; end if;
  if new.status = 'ditolak' then
    update public.tawaran_shift set status = 'ditolak', diputus_at = now() where id = t.id;
    return null;
  end if;
  select * into s from public.shift where id = t.shift_id for update;
  if s.status <> 'aktif' or s.mulai_at <= now() then
    raise exception 'Shift ini sudah mulai atau dibatalkan, jadi tukarnya tidak bisa dijalankan. Tolak usulan ini.' using errcode = '55000';
  end if;
  c := app.cek_pindah_shift(t.perusahaan_id, s.id, t.diambil_oleh);
  perform app.tolak_batas_pindah(c);
  update public.shift set orang_id = t.diambil_oleh where id = s.id;
  v_lembur := least((c ->> 'lembur_hari')::int, (c ->> 'menit_shift')::int);
  if v_lembur > 0 then
    insert into public.persetujuan_lembur (perusahaan_id, shift_id, orang_id, menit_lembur, status, dijawab_at)
    values (t.perusahaan_id, s.id, t.diambil_oleh, v_lembur, 'setuju', now())
    on conflict (shift_id) do update set orang_id = excluded.orang_id, menit_lembur = excluded.menit_lembur, status = 'setuju', dijawab_at = now();
  else
    update public.persetujuan_lembur set status = 'batal', dijawab_at = now() where shift_id = s.id;
  end if;
  update public.tawaran_shift set status = 'disetujui', diputus_at = now() where id = t.id;
  return null;
end $$;
create trigger tukar_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'shift.tukar' and new.status in ('diterima', 'ditolak') and old.status = 'menunggu')
  execute function app.tukar_dari_usulan();

-- Untuk layar staf: tawaran yang bisa kuambil, dan tawaranku sendiri yang masih berjalan.
create or replace function public.tawaran_saya() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid := app.orang_saya();
begin
  if v_pid is null or v_saya is null then
    raise exception 'Akunmu belum tertaut ke orang di usaha ini' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'untuk', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'tanggal', s.tanggal, 'mulai', to_char(s.mulai, 'HH24:MI'), 'selesai', to_char(s.selesai, 'HH24:MI'),
                         'dari', o.nama, 'topi', tp.nama) order by s.mulai_at)
                         from public.tawaran_shift t join public.shift s on s.id = t.shift_id join public.orang o on o.id = t.dari_orang
                         left join public.topi tp on tp.id = s.topi_id
                        where t.perusahaan_id = v_pid and t.status = 'terbuka' and s.status = 'aktif' and s.mulai_at > now()
                          and app.boleh_ambil_shift(v_pid, s, v_saya)), '[]'::jsonb),
    'milik', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'shift_id', t.shift_id, 'status', t.status, 'tanggal', s.tanggal,
                         'mulai', to_char(s.mulai, 'HH24:MI'), 'selesai', to_char(s.selesai, 'HH24:MI'), 'diambil', o.nama) order by s.mulai_at)
                         from public.tawaran_shift t join public.shift s on s.id = t.shift_id left join public.orang o on o.id = t.diambil_oleh
                        where t.perusahaan_id = v_pid and (t.dari_orang = v_saya or t.diambil_oleh = v_saya) and t.status in ('terbuka', 'diambil')
                          and s.mulai_at > now()), '[]'::jsonb));
end $$;

-- jadwal_saya kini membawa id shift dan status tawarannya supaya staf bisa menawarkan.
create or replace function public.jadwal_saya(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); v_mulai date;
begin
  if v_pid is null or v_orang is null then
    raise exception 'Akunmu belum tertaut ke orang di usaha ini' using errcode = '42501';
  end if;
  v_mulai := date_trunc('week', coalesce(p_mulai, app.hari_ini(v_pid)))::date;
  return jsonb_build_object('mulai', v_mulai,
    'shift', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tanggal', s.tanggal, 'mulai', to_char(s.mulai, 'HH24:MI'), 'selesai', to_char(s.selesai, 'HH24:MI'),
               'istirahat', s.istirahat_menit, 'bisa_ditawarkan', s.mulai_at > now(),
               'tawaran', (select t.status from public.tawaran_shift t where t.shift_id = s.id and t.status in ('terbuka', 'diambil'))) order by s.tanggal, s.mulai)
             from public.shift s where s.orang_id = v_orang and s.status = 'aktif' and s.tanggal >= v_mulai and s.tanggal < v_mulai + 14), '[]'::jsonb),
    'lembur', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'tanggal', s.tanggal, 'menit', p.menit_lembur) order by s.tanggal)
             from public.persetujuan_lembur p join public.shift s on s.id = p.shift_id
            where p.orang_id = v_orang and p.status = 'menunggu' and s.status = 'aktif'), '[]'::jsonb));
end $$;

revoke all on function app.cek_pindah_shift(uuid, uuid, uuid), app.tolak_batas_pindah(jsonb), app.boleh_ambil_shift(uuid, public.shift, uuid),
  app.tanggal_pendek(date), app.tukar_dari_usulan() from public, anon, authenticated;
revoke all on function public.tawarkan_shift(uuid, uuid), public.batal_tawaran(uuid), public.ambil_tawaran(uuid, boolean), public.tawaran_saya()
  from public, anon;
grant execute on function public.tawarkan_shift(uuid, uuid), public.batal_tawaran(uuid), public.ambil_tawaran(uuid, boolean), public.tawaran_saya()
  to authenticated;
