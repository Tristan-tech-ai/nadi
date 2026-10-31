-- F3-01 lanjutan (tinjauan docs/quality/review-f3-01.md): experimental.useOffline bisa mengirim ulang Server Action yang
-- jawabannya hilang saat sinyal putus. Transisi kerja dibuat idempoten: aksi yang keadaan tujuannya sudah tercapai (Mulai pada
-- kerja jalan, Tunggu pada tunggu, Lanjut pada jalan, Selesai pada selesai, Batal pada batal) tidak mengubah apa pun, tidak
-- mencatat kejadian baru, dan mengembalikan keadaan yang sama ('sudah': true). buat_kerja menerima kunci idempoten dari klien
-- (uuid dibuat browser, unik per usaha): kunci yang sama mengembalikan kerja yang sudah ada, bukan baris kembar.

alter table public.kerja add column kunci_klien uuid;
create unique index kerja_kunci_klien_unik on public.kerja (perusahaan_id, kunci_klien) where kunci_klien is not null;

create or replace function app.kerja_hasil(k public.kerja, p_sudah boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', k.id, 'status', k.status, 'mulai_at', k.mulai_at, 'selesai_at', k.selesai_at,
    'aktual_menit', k.data -> 'aktual_menit', 'jeda_menit', k.data -> 'jeda_menit', 'estimasi', k.data -> 'estimasi', 'sudah', p_sudah)
$$;
revoke all on function app.kerja_hasil(public.kerja, boolean) from public, anon, authenticated;

drop function public.buat_kerja(text, uuid, uuid, timestamptz);
create function public.buat_kerja(p_judul text, p_topi uuid, p_pelaksana uuid, p_tenggat timestamptz, p_kunci uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_judul text := btrim(regexp_replace(coalesce(p_judul, ''), '\s+', ' ', 'g')); v_id uuid; v_est jsonb;
  k public.kerja;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa menambah kerja.' using errcode = '42501';
  end if;
  if p_kunci is not null then
    select * into k from public.kerja where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if k.id is not null then
      return jsonb_build_object('id', k.id, 'estimasi', k.data -> 'estimasi',
        'perlu_model', jsonb_typeof(k.data -> 'estimasi') is distinct from 'object', 'sudah', true);
    end if;
  end if;
  if char_length(v_judul) not between 3 and 300 then
    raise exception 'Tulis judul kerja 3 sampai 300 huruf, misalnya Cek stok beras.' using errcode = '22023';
  end if;
  if p_topi is not null and not exists (select 1 from public.topi where id = p_topi and perusahaan_id = v_pid and aktif) then
    raise exception 'Topi tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_pelaksana is not null and not exists (select 1 from public.orang where id = p_pelaksana and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Pelaksana tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_tenggat is not null and p_tenggat < now() - interval '1 day' then
    raise exception 'Tenggat sudah lewat lebih dari sehari. Pilih waktu yang akan datang.' using errcode = '22023';
  end if;
  begin
    insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, pemberi_id, tenggat, kunci_klien)
    values (v_pid, v_judul, p_topi, p_pelaksana, app.orang_saya(), p_tenggat, p_kunci)
    returning id into v_id;
  exception when unique_violation then
    -- Dua kiriman berkunci sama bersamaan: yang kalah mengembalikan kerja yang sudah dibuat yang menang.
    select * into k from public.kerja where perusahaan_id = v_pid and kunci_klien = p_kunci;
    return jsonb_build_object('id', k.id, 'estimasi', k.data -> 'estimasi',
      'perlu_model', jsonb_typeof(k.data -> 'estimasi') is distinct from 'object', 'sudah', true);
  end;
  v_est := app.estimasi_riwayat(v_pid, p_topi, v_judul, v_id);
  if v_est is not null then perform app.tulis_estimasi(v_id, v_est); end if;
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
  values (v_pid, 'kerja.buat', 'pwa', p_pelaksana, v_id, jsonb_build_object('oleh', auth.uid()));
  return jsonb_build_object('id', v_id, 'estimasi', v_est, 'perlu_model', v_est is null, 'sudah', false);
end $$;

create or replace function public.ubah_status_kerja(p_kerja uuid, p_aksi text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_pengelola boolean := app.anggota_aktif(array['pemilik', 'admin']); v_saya uuid := app.orang_saya();
  k public.kerja; v_jeda numeric; v_aktual numeric; v_est numeric; v_data jsonb;
begin
  if v_pid is null or not app.anggota_aktif() then raise exception 'Masuk ke usahamu dulu.' using errcode = '42501'; end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid for update;
  if k.id is null or not (v_pengelola or (v_saya is not null and k.pelaksana_id = v_saya)) then
    raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_aksi is null or p_aksi not in ('mulai', 'tunggu', 'lanjut', 'selesai', 'batal') then
    raise exception 'Aksi kerja tidak dikenal.' using errcode = '22023';
  end if;
  if p_aksi = 'batal' and not v_pengelola then
    raise exception 'Hanya pemilik atau admin yang bisa membatalkan kerja.' using errcode = '42501';
  end if;
  -- Idempoten: kiriman ulang aksi yang tujuannya sudah tercapai tidak mengubah keadaan, kejadian, atau durasi.
  if (p_aksi = 'mulai' and k.status = 'jalan') or (p_aksi = 'tunggu' and k.status = 'tunggu') or (p_aksi = 'lanjut' and k.status = 'jalan')
     or (p_aksi = 'selesai' and k.status = 'selesai') or (p_aksi = 'batal' and k.status = 'batal') then
    return app.kerja_hasil(k, true);
  end if;

  v_jeda := coalesce((k.data ->> 'jeda_menit')::numeric, 0);
  if k.status = 'tunggu' and p_aksi in ('lanjut', 'selesai') and k.data ? 'tunggu_at' then
    v_jeda := v_jeda + greatest(0, extract(epoch from now() - (k.data ->> 'tunggu_at')::timestamptz) / 60);
  end if;

  if p_aksi = 'mulai' then
    if k.status <> 'baru' then raise exception 'Kerja ini sudah dimulai.' using errcode = '55000'; end if;
    update public.kerja set status = 'jalan', mulai_at = now(), pelaksana_id = coalesce(pelaksana_id, v_saya) where id = k.id;
  elsif p_aksi = 'tunggu' then
    if k.status <> 'jalan' then raise exception 'Hanya kerja yang sedang jalan yang bisa ditunda.' using errcode = '55000'; end if;
    update public.kerja set status = 'tunggu', data = data || jsonb_build_object('tunggu_at', now()) where id = k.id;
  elsif p_aksi = 'lanjut' then
    if k.status <> 'tunggu' then raise exception 'Kerja ini tidak sedang ditunda.' using errcode = '55000'; end if;
    update public.kerja set status = 'jalan', data = (data - 'tunggu_at') || jsonb_build_object('jeda_menit', round(v_jeda, 2)) where id = k.id;
  elsif p_aksi = 'selesai' then
    if k.status not in ('baru', 'jalan', 'tunggu') then raise exception 'Kerja ini sudah dibatalkan.' using errcode = '55000'; end if;
    if k.mulai_at is not null then
      v_aktual := round(greatest(0, extract(epoch from now() - k.mulai_at) / 60 - v_jeda), 2);
    end if;
    v_est := (k.data -> 'estimasi' ->> 'menit')::numeric;
    v_data := (k.data - 'tunggu_at' - 'galat_relatif') || jsonb_build_object('jeda_menit', round(v_jeda, 2))
              || case when v_aktual is null then '{}'::jsonb else jsonb_build_object('aktual_menit', v_aktual) end
              || case when v_aktual is not null and v_est > 0 then jsonb_build_object('galat_relatif', round((v_aktual - v_est) / v_est, 2)) else '{}'::jsonb end;
    update public.kerja set status = 'selesai', selesai_at = now(), data = v_data where id = k.id;
  else
    if k.status = 'selesai' then raise exception 'Kerja ini sudah selesai.' using errcode = '55000'; end if;
    update public.kerja set status = 'batal', data = data - 'tunggu_at' where id = k.id;
  end if;

  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, nilai, data)
  values (v_pid, 'kerja.' || p_aksi, 'pwa', coalesce(k.pelaksana_id, v_saya), k.id, v_aktual, jsonb_build_object('oleh', auth.uid()));

  select * into k from public.kerja where id = k.id;
  return app.kerja_hasil(k, false);
end $$;

revoke all on function public.buat_kerja(text, uuid, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.buat_kerja(text, uuid, uuid, timestamptz, uuid) to authenticated;
