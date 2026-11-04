-- M-12 waktu lanjutan (docs/research/mekari/rencana.md M-12; TA-17, TA-19..TA-24):
-- (1) geofence absen: tempat.lat/lng/radius_m (kolom lama) kini ditegakkan di absen_catat; lokasi HP dikirim bersama bukti perangkat;
-- (2) kunci periode absensi per bulan (pemilik), menolak absen, izin, dan lembur bertanggal di bulan terkunci;
-- (3) libur nasional dan cuti bersama 2026 dari SKB Menteri Agama 1497/2025, Menteri Ketenagakerjaan 2/2025, Menteri PANRB 5/2025
--     (19 Sep 2025; daftar dari setneg.go.id, dibaca 5 Nov 2026);
-- (4) shift siaga (on-call); (5) lembur diajukan staf sendiri menjadi usulan, dicatat lewat catat_lembur saat disetujui.

create or replace function app.jarak_m(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision) returns double precision
language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(p_lat2 - p_lat1) / 2), 2) + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)))
$$;

create or replace function public.atur_geofence(p_tempat uuid, p_lat double precision, p_lng double precision, p_radius integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang mengatur lokasi absen' using errcode = '42501'; end if;
  if p_radius is not null and (p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_radius not between 20 and 2000) then
    raise exception 'Isi titik lokasi yang sah dan radius 20 sampai 2.000 meter' using errcode = '22023';
  end if;
  update public.tempat set lat = case when p_radius is null then lat else p_lat end, lng = case when p_radius is null then lng else p_lng end, radius_m = p_radius
   where id = p_tempat and perusahaan_id = app.pid();
  if not found then raise exception 'Tempat tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- ---------- kunci periode absensi ----------
create table public.kunci_absensi (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  aktif boolean not null default true,
  alasan text check (alasan is null or length(alasan) <= 300),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  primary key (perusahaan_id, bulan)
);
alter table public.kunci_absensi enable row level security;
create policy kunci_absensi_baca on public.kunci_absensi for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.kunci_absensi to authenticated;
create trigger audit_kunci_absensi after insert or update on public.kunci_absensi for each row execute function app.catat_audit();

create or replace function app.absensi_terkunci(p_pid uuid, p_tanggal date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kunci_absensi k where k.perusahaan_id = p_pid and k.aktif and k.bulan = date_trunc('month', p_tanggal)::date)
$$;

create or replace function public.atur_kunci_absensi(p_bulan date, p_kunci boolean, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_bulan date := date_trunc('month', p_bulan)::date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then raise exception 'Hanya pemilik yang mengunci absensi' using errcode = '42501'; end if;
  if v_bulan >= date_trunc('month', app.hari_ini(v_pid))::date then raise exception 'Hanya bulan yang sudah lewat yang bisa dikunci' using errcode = '22023'; end if;
  if not p_kunci and length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan membuka kunci' using errcode = '22023'; end if;
  insert into public.kunci_absensi (perusahaan_id, bulan, aktif, alasan, diubah_oleh) values (v_pid, v_bulan, p_kunci, nullif(btrim(coalesce(p_alasan, '')), ''), auth.uid())
  on conflict (perusahaan_id, bulan) do update set aktif = excluded.aktif, alasan = excluded.alasan, diubah_oleh = excluded.diubah_oleh, diubah_at = now();
end $$;

create or replace function app.tolak_absensi_terkunci() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tgl date;
begin
  -- Trigger kejadian dikloning ke tiap partisi bulanan, jadi nama tabelnya kejadian_pYYYYMMDD.
  -- Kolom tanggal berbeda per tabel; tiap cabang terpisah agar kolom tabel lain tidak pernah dibaca.
  if tg_table_name like 'kejadian%' then v_tgl := (new.terjadi_at at time zone app.zona(new.perusahaan_id))::date;
  elsif tg_table_name = 'lembur' then v_tgl := new.tanggal;
  else v_tgl := new.mulai;
  end if;
  if app.absensi_terkunci(new.perusahaan_id, v_tgl) then
    raise exception 'Absensi bulan % sudah dikunci pemilik. Minta pemilik membuka kunci bila perlu mengubahnya.', to_char(v_tgl, 'MM/YYYY') using errcode = '22023';
  end if;
  return new;
end $$;
create trigger tolak_absensi_terkunci before insert on public.kejadian for each row
  when (new.jenis like 'absen.%' or new.jenis like 'izin.%') execute function app.tolak_absensi_terkunci();
create trigger tolak_absensi_terkunci before insert or update on public.lembur for each row execute function app.tolak_absensi_terkunci();
create trigger tolak_absensi_terkunci before insert on public.pengajuan_izin for each row execute function app.tolak_absensi_terkunci();

-- ---------- absen dengan geofence ----------
create or replace function public.absen_catat(p_tempat uuid, p_kode text, p_jenis text, p_wajah jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_pid uuid := app.pid(); v_orang uuid; k bytea; u double precision := extract(epoch from clock_timestamp());
  t bigint := floor(u / 15)::bigint; v_langkah bigint; v_saat timestamptz := now(); v_salah int; v_salah2 int;
  tp public.tempat; v_lat double precision; v_lng double precision; v_akurasi double precision; v_jarak double precision;
begin
  if v_pid is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  if p_jenis not in ('absen.masuk', 'absen.pulang') then raise exception 'Jenis absen tidak dikenal' using errcode = '22023'; end if;
  select a.orang_id into v_orang from public.anggota a where a.perusahaan_id = v_pid and a.user_id = (select auth.uid()) and a.aktif;
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini. Minta pemilik membuatkan akun staf.' using errcode = '42501'; end if;
  if coalesce(p_wajah ->> 'lulus', 'false') <> 'true' then raise exception 'Cek wajah belum lolos. Coba lagi di tempat yang terang.' using errcode = '22023'; end if;
  select r.rahasia into k from app.rahasia_tempat r join public.tempat t2 on t2.id = r.tempat_id
   where r.tempat_id = p_tempat and r.perusahaan_id = v_pid and t2.aktif;
  if k is null then raise exception 'Kode QR ini bukan untuk usahamu.' using errcode = 'P0002'; end if;
  -- M-12: geofence. Tempat bertitik dan berradius hanya menerima absen dari HP yang berada di dalam radius (ditambah akurasi GPS, maks 100 m).
  select * into tp from public.tempat where id = p_tempat;
  if tp.lat is not null and tp.lng is not null and coalesce(tp.radius_m, 0) > 0 then
    begin
      v_lat := (p_wajah #>> '{lokasi,lat}')::double precision;
      v_lng := (p_wajah #>> '{lokasi,lng}')::double precision;
      v_akurasi := least(greatest(coalesce((p_wajah #>> '{lokasi,akurasi}')::double precision, 0), 0), 100);
    exception when others then v_lat := null;
    end;
    if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception 'Absen di % butuh lokasi HP. Izinkan lokasi untuk Nadi, lalu pindai ulang kodenya.', tp.nama using errcode = '22023';
    end if;
    v_jarak := app.jarak_m(tp.lat, tp.lng, v_lat, v_lng);
    if v_jarak - v_akurasi > tp.radius_m then
      raise exception 'Kamu sekitar % m dari %. Absen hanya bisa dalam % m dari tempat itu. Datang ke lokasi dulu, atau minta pemilik mencatat izin.',
        round(v_jarak)::bigint, tp.nama, tp.radius_m using errcode = '22023';
    end if;
  end if;
  -- Q-13: paling banyak 5 kode salah per orang per menit (kode 6 angka berlaku 15-30 detik).
  select count(*) filter (where saat > clock_timestamp() - interval '1 minute'), count(*) into v_salah, v_salah2
    from app.percobaan where jenis = 'absen.kode' and kunci = v_orang::text and saat > clock_timestamp() - interval '2 minutes';
  if v_salah >= 5 then raise exception 'Terlalu banyak kode salah. Tunggu satu menit, lalu pindai ulang kode di layar.' using errcode = '54000'; end if;
  if p_kode = app.totp(k, t * 15, 15, 6) then v_langkah := t;
  elsif p_kode = app.totp(k, (t - 1) * 15, 15, 6) then v_langkah := t - 1;
  else
    -- Dicatat lalu dikembalikan sebagai galat (bukan exception) agar catatan percobaan tidak ikut dibatalkan.
    insert into app.percobaan (jenis, kunci) values ('absen.kode', v_orang::text);
    return jsonb_build_object('galat', 'Kode QR sudah kedaluwarsa. Pindai ulang kode di layar.');
  end if;
  if exists (select 1 from public.kejadian e where e.perusahaan_id = v_pid and e.orang_id = v_orang and e.jenis = p_jenis
               and e.terjadi_at > v_saat - interval '2 minutes' and (e.data ->> 'langkah')::bigint = v_langkah) then
    raise exception 'Kode ini sudah kamu pakai. Tunggu kode berikutnya bila perlu absen lagi.' using errcode = 'P0001';
  end if;
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, tempat_id, data)
  values (v_pid, v_saat, p_jenis, 'pwa', v_orang, p_tempat, jsonb_build_object('langkah', v_langkah,
    'salah_sebelum', v_salah2,
    'wajah', jsonb_build_object('lulus', true, 'kedip', coalesce((p_wajah ->> 'kedip')::boolean, false), 'menoleh', coalesce(p_wajah ->> 'menoleh', ''))) ||
    case when v_jarak is not null then jsonb_build_object('jarak_m', round(v_jarak)::bigint) else '{}' end);
  return jsonb_build_object('jenis', p_jenis, 'saat', v_saat);
end $function$;

-- ---------- libur nasional ----------
create table public.libur_nasional (
  negara text not null default 'ID',
  tanggal date not null,
  jenis text not null check (jenis in ('libur', 'cuti_bersama')),
  nama text not null check (length(btrim(nama)) between 2 and 120),
  sumber text not null,
  primary key (negara, tanggal, jenis)
);
alter table public.libur_nasional enable row level security;
create policy libur_nasional_baca on public.libur_nasional for select to anon, authenticated using (true);
grant select on public.libur_nasional to anon, authenticated;
insert into public.libur_nasional (tanggal, jenis, nama, sumber)
select x.t::date, x.j, x.n, 'SKB Menteri Agama 1497/2025, Menteri Ketenagakerjaan 2/2025, Menteri PANRB 5/2025 (19 Sep 2025), setneg.go.id' from (values
  ('2026-01-01', 'libur', 'Tahun Baru 2026 Masehi'), ('2026-01-16', 'libur', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2026-02-16', 'cuti_bersama', 'Cuti bersama Tahun Baru Imlek 2577 Kongzili'), ('2026-02-17', 'libur', 'Tahun Baru Imlek 2577 Kongzili'),
  ('2026-03-18', 'cuti_bersama', 'Cuti bersama Hari Suci Nyepi'), ('2026-03-19', 'libur', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  ('2026-03-20', 'cuti_bersama', 'Cuti bersama Idulfitri 1447 H'), ('2026-03-21', 'libur', 'Idulfitri 1447 H'), ('2026-03-22', 'libur', 'Idulfitri 1447 H'),
  ('2026-03-23', 'cuti_bersama', 'Cuti bersama Idulfitri 1447 H'), ('2026-03-24', 'cuti_bersama', 'Cuti bersama Idulfitri 1447 H'),
  ('2026-04-03', 'libur', 'Wafat Yesus Kristus'), ('2026-04-05', 'libur', 'Kebangkitan Yesus Kristus (Paskah)'),
  ('2026-05-01', 'libur', 'Hari Buruh Internasional'), ('2026-05-14', 'libur', 'Kenaikan Yesus Kristus'), ('2026-05-15', 'cuti_bersama', 'Cuti bersama Kenaikan Yesus Kristus'),
  ('2026-05-27', 'libur', 'Iduladha 1447 H'), ('2026-05-28', 'cuti_bersama', 'Cuti bersama Iduladha 1447 H'), ('2026-05-31', 'libur', 'Hari Raya Waisak 2570 BE'),
  ('2026-06-01', 'libur', 'Hari Lahir Pancasila'), ('2026-06-16', 'libur', '1 Muharam Tahun Baru Islam 1448 H'),
  ('2026-08-17', 'libur', 'Proklamasi Kemerdekaan Republik Indonesia'), ('2026-08-25', 'libur', 'Maulid Nabi Muhammad SAW'),
  ('2026-12-24', 'cuti_bersama', 'Cuti bersama Kelahiran Yesus Kristus'), ('2026-12-25', 'libur', 'Kelahiran Yesus Kristus')
) x(t, j, n);

-- ---------- siaga (on-call) ----------
alter table public.shift add column siaga boolean not null default false;
create or replace function public.tandai_siaga(p_shift uuid, p_siaga boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang mengatur jadwal' using errcode = '42501'; end if;
  update public.shift set siaga = coalesce(p_siaga, false) where id = p_shift and perusahaan_id = app.pid() and status <> 'batal';
  if not found then raise exception 'Shift tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- ---------- lembur diajukan staf ----------
create or replace function public.ajukan_lembur(p_tanggal date, p_jenis text, p_jam integer, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid; v_nama text; v_id uuid;
begin
  if v_pid is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  select a.orang_id into v_orang from public.anggota a where a.perusahaan_id = v_pid and a.user_id = (select auth.uid()) and a.aktif;
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini' using errcode = '42501'; end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if p_jenis not in ('hari_kerja', 'libur_pola_6_hari', 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', 'libur_pola_5_hari') then raise exception 'Pilih jenis hari lembur' using errcode = '22023'; end if;
  if p_jam is null or p_jam not between 1 and 12 then raise exception 'Jam lembur 1 sampai 12' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) or p_tanggal < app.hari_ini(v_pid) - 31 then raise exception 'Tanggal lembur paling lama 31 hari lalu dan tidak di masa depan' using errcode = '22023'; end if;
  if app.absensi_terkunci(v_pid, p_tanggal) then raise exception 'Absensi bulan itu sudah dikunci pemilik' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan lembur, misalnya stok opname akhir bulan' using errcode = '22023'; end if;
  select nama into v_nama from public.orang where id = v_orang;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, kunci_klien)
  values (v_pid, 'pwa', 'lembur.ajukan', left('Setujui lembur ' || v_nama || ' ' || p_jam || ' jam (' || to_char(p_tanggal, 'DD/MM') || ')', 140),
    left('Diajukan sendiri: ' || btrim(p_alasan), 1000),
    jsonb_build_object('jenis', 'lembur', 'bidang', jsonb_build_object('orang_id', v_orang, 'nama', v_nama, 'tanggal', p_tanggal, 'jenis_hari', p_jenis, 'jam', p_jam, 'alasan', left(btrim(p_alasan), 300))),
    p_kunci)
  on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'sudah', v_id is null);
end $$;

create or replace function app.lembur_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb := new.payload -> 'bidang';
begin
  perform public.catat_lembur((b ->> 'orang_id')::uuid, (b ->> 'tanggal')::date, b ->> 'jenis_hari', (b ->> 'jam')::int, left('Diajukan staf: ' || coalesce(b ->> 'alasan', ''), 300));
  return new;
end $$;
create trigger lembur_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'lembur.ajukan' and new.status = 'diterima' and old.status is distinct from 'diterima') execute function app.lembur_dari_usulan();

revoke all on function app.jarak_m(double precision, double precision, double precision, double precision), app.absensi_terkunci(uuid, date),
  app.tolak_absensi_terkunci(), app.lembur_dari_usulan() from public, anon, authenticated;
revoke all on function public.atur_geofence(uuid, double precision, double precision, integer), public.atur_kunci_absensi(date, boolean, text),
  public.tandai_siaga(uuid, boolean), public.ajukan_lembur(date, text, integer, text, uuid) from public, anon;
grant execute on function public.atur_geofence(uuid, double precision, double precision, integer), public.atur_kunci_absensi(date, boolean, text),
  public.tandai_siaga(uuid, boolean), public.ajukan_lembur(date, text, integer, text, uuid) to authenticated;
