-- Tingkat model gerbang keputusan (F1-06B, docs/research/keputusan-model.md). Usulan yang tidak tertangkap aturan rute (keputusan
-- tingkat 'manusia') diantrekan sekali ke Edge Function putuskan lewat pg_net dengan token Vault (pola push). Model ringan hanya
-- memilih penerima (pemilik | admin | keduanya) dari judul, aksi, dan penjelasan; tidak pernah menyetujui atau menolak usulan.
-- yakin >= 0,85: untuk_peran diubah dan keputusan tingkat model tercatat; 0,5..0,85: tetap keduanya, tercatat "keduanya (ragu)";
-- < 0,5: tidak berubah. Kegagalan tercatat di app.rute_model tanpa mengubah rute. Batas harian per usaha dari konfigurasi.

-- Satu baris per usulan (kunci primer = idempoten): antre -> proses -> selesai | gagal | dilewati.
create table app.rute_model (
  usulan_id uuid primary key references public.usulan(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  status text not null check (status in ('antre', 'proses', 'selesai', 'gagal', 'dilewati')),
  dikirim boolean not null default false,   -- pg_net dipanggil (dihitung untuk batas harian)
  dibuat_at timestamptz not null default clock_timestamp(),
  mulai_at timestamptz,
  selesai_at timestamptz,
  pilihan text,
  yakin real,
  keputusan_id uuid references public.keputusan(id) on delete set null,
  galat text
);
create index on app.rute_model (perusahaan_id, dibuat_at desc);
create index on app.rute_model (keputusan_id);
revoke all on app.rute_model from public, anon, authenticated;

insert into public.konfigurasi (kunci, nilai, catatan)
values ('batas_keputusan_model', '{"harian": 50, "uji_harian": 40}',
        'Batas panggilan model rute usulan per usaha per hari (WITA); uji_harian untuk eval oleh pengelola (F1-06B)')
on conflict (kunci) do nothing;

create or replace function app.batas_rute_model(p_bidang text, p_bawaan integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select (nilai ->> p_bidang)::integer from public.konfigurasi where kunci = 'batas_keputusan_model'), p_bawaan)
$$;
revoke all on function app.batas_rute_model(text, integer) from public, anon, authenticated;

-- Setelah usulan masuk: bila rute_usulan mencatatnya 'manusia' (tanpa aturan), antrekan ke model. Kegagalan di sini tidak pernah
-- membatalkan usulan; galatnya dicatat.
create or replace function app.antre_rute_model() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_batas integer; v_n integer; v_hari timestamptz;
begin
  if new.status <> 'menunggu' or new.untuk_peran is distinct from array['pemilik', 'admin']
     or not exists (select 1 from public.keputusan k where k.subjek_id = new.id and k.jenis = 'usulan.rute' and k.tingkat = 'manusia') then
    return null;
  end if;
  if coalesce((select (p.pengaturan ->> 'keputusan_model')::boolean from public.perusahaan p where p.id = new.perusahaan_id), true) is false then
    return null;
  end if;
  begin
    v_batas := app.batas_rute_model('harian', 50);
    v_hari := date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar';
    select count(*) into v_n from app.rute_model r where r.perusahaan_id = new.perusahaan_id and r.dikirim and r.dibuat_at >= v_hari;
    if v_n >= v_batas then
      insert into app.rute_model (usulan_id, perusahaan_id, status, galat, selesai_at)
      values (new.id, new.perusahaan_id, 'dilewati', 'Batas harian ' || v_batas || ' panggilan model tercapai', clock_timestamp());
      return null;
    end if;
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
    if v_token is null then
      insert into app.rute_model (usulan_id, perusahaan_id, status, galat, selesai_at)
      values (new.id, new.perusahaan_id, 'gagal', 'Token panggilan internal belum ada di Vault', clock_timestamp());
      return null;
    end if;
    insert into app.rute_model (usulan_id, perusahaan_id, status, dikirim) values (new.id, new.perusahaan_id, 'antre', true);
    perform net.http_post(
      url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/putuskan',
      body := jsonb_build_object('usulan_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
      timeout_milliseconds := 30000);
  exception when others then
    insert into app.rute_model (usulan_id, perusahaan_id, status, galat, selesai_at)
    values (new.id, new.perusahaan_id, 'gagal', left('Antre gagal: ' || sqlerrm, 500), clock_timestamp())
    on conflict (usulan_id) do nothing;
  end;
  return null;
end $$;
create trigger rute_usulan_model after insert on public.usulan for each row execute function app.antre_rute_model();

-- Edge Function (peran layanan): klaim antrean sekali dan ambil hanya judul, aksi, penjelasan. Pemanggilan ulang tidak lanjut.
create or replace function public.rute_model_ambil(p_usulan uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r app.rute_model; u public.usulan; v_model text;
begin
  update app.rute_model set status = 'proses', mulai_at = clock_timestamp() where usulan_id = p_usulan and status = 'antre' returning * into r;
  if r.usulan_id is null then
    return jsonb_build_object('lanjut', false, 'status', coalesce((select status from app.rute_model where usulan_id = p_usulan), 'tidak_ada'));
  end if;
  select * into u from public.usulan where id = p_usulan;
  if u.status <> 'menunggu' or u.untuk_peran is distinct from array['pemilik', 'admin'] then
    update app.rute_model set status = 'dilewati', galat = 'Sudah diputuskan atau dirute manusia sebelum model', selesai_at = clock_timestamp()
     where usulan_id = p_usulan;
    return jsonb_build_object('lanjut', false, 'status', 'dilewati');
  end if;
  select nilai ->> 'ringan' into v_model from public.konfigurasi where kunci = 'model_ai';
  return jsonb_build_object('lanjut', true, 'perusahaan_id', u.perusahaan_id, 'judul', left(u.judul, 200), 'aksi', u.aksi,
                            'penjelasan', left(coalesce(u.penjelasan, ''), 1000), 'model', v_model);
end $$;

create or replace function app.catat_pakai_rute(p_pid uuid, p_tugas text, p_pemakaian jsonb) returns uuid
language sql security definer set search_path = '' as $$
  insert into public.pemakaian_ai (perusahaan_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis)
  values (p_pid, p_tugas, left(coalesce(p_pemakaian ->> 'model', ''), 100),
          greatest(0, coalesce((p_pemakaian ->> 'token_masuk')::integer, 0)), greatest(0, coalesce((p_pemakaian ->> 'token_keluar')::integer, 0)),
          greatest(0, coalesce((p_pemakaian ->> 'token_cache_baca')::integer, 0)), greatest(0, coalesce((p_pemakaian ->> 'token_cache_tulis')::integer, 0)))
  returning id
$$;
revoke all on function app.catat_pakai_rute(uuid, text, jsonb) from public, anon, authenticated;

-- Edge Function (peran layanan): terapkan jawaban model sekali. Ambang di sini adalah sumber kebenaran (inti.ts menirunya untuk eval).
create or replace function public.rute_model_simpan(p_usulan uuid, p_pilihan text, p_peluang jsonb, p_yakin real, p_alasan text,
  p_latensi_ms real, p_model text, p_pemakaian jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r app.rute_model; u public.usulan; v_tindakan text; v_pilihan text; v_k uuid; v_alasan text;
begin
  select * into r from app.rute_model where usulan_id = p_usulan and status = 'proses' for update;
  if r.usulan_id is null then return jsonb_build_object('status', 'sudah'); end if;
  if jsonb_typeof(p_pemakaian) = 'object' then perform app.catat_pakai_rute(r.perusahaan_id, 'rute_usulan', p_pemakaian); end if;

  if p_pilihan is null or p_pilihan not in ('pemilik', 'admin', 'keduanya') or p_yakin is null or p_yakin < 0 or p_yakin > 1
     or p_latensi_ms is null or p_latensi_ms < 0 then
    update app.rute_model set status = 'gagal', galat = left('Jawaban model tidak sah: ' || coalesce(p_pilihan, 'null') || ' ' || coalesce(p_yakin::text, 'null'), 500),
           selesai_at = clock_timestamp() where usulan_id = p_usulan;
    return jsonb_build_object('status', 'gagal');
  end if;

  select * into u from public.usulan where id = p_usulan for update;
  if u.id is null or u.status <> 'menunggu' or u.untuk_peran is distinct from array['pemilik', 'admin'] then
    update app.rute_model set status = 'dilewati', pilihan = p_pilihan, yakin = p_yakin, selesai_at = clock_timestamp(),
           galat = 'Sudah diputuskan atau dirute manusia sebelum model selesai' where usulan_id = p_usulan;
    return jsonb_build_object('status', 'dilewati');
  end if;

  v_tindakan := case when p_yakin >= 0.85 then 'ubah' when p_yakin >= 0.5 then 'ragu' else 'tetap' end;
  if v_tindakan <> 'tetap' then
    v_pilihan := case when v_tindakan = 'ragu' then 'keduanya (ragu)' else p_pilihan end;
    if v_pilihan = 'pemilik' then
      update public.usulan set untuk_peran = array['pemilik'] where id = p_usulan;
    elsif v_pilihan = 'admin' then
      update public.usulan set untuk_peran = array['admin'] where id = p_usulan;
    end if;
    v_alasan := 'Usulan "' || left(u.judul, 80) || '": '
                || coalesce(nullif(left(btrim(replace(replace(coalesce(p_alasan, ''), chr(8212), ','), chr(8211), ',')), 300), ''), 'Tanpa alasan dari model.');
    insert into public.keputusan (perusahaan_id, jenis, subjek_id, tingkat, pilihan, peluang, yakin, alasan, latensi_ms, model)
    values (u.perusahaan_id, 'usulan.rute', u.id, 'model', v_pilihan, p_peluang, p_yakin, v_alasan, p_latensi_ms, left(p_model, 100))
    returning id into v_k;
  end if;
  update app.rute_model set status = 'selesai', pilihan = p_pilihan, yakin = p_yakin, keputusan_id = v_k, selesai_at = clock_timestamp()
   where usulan_id = p_usulan;
  return jsonb_build_object('status', 'selesai', 'tindakan', v_tindakan, 'keputusan_id', v_k);
end $$;

-- Edge Function (peran layanan): model gagal dipanggil atau jawabannya tidak terbaca. Rute tidak berubah.
create or replace function public.rute_model_gagal(p_usulan uuid, p_galat text, p_pemakaian jsonb default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r app.rute_model;
begin
  update app.rute_model set status = 'gagal', galat = left(coalesce(p_galat, 'Gagal tanpa keterangan'), 500), selesai_at = clock_timestamp()
   where usulan_id = p_usulan and status = 'proses' returning * into r;
  if r.usulan_id is null then return false; end if;
  if jsonb_typeof(p_pemakaian) = 'object' then perform app.catat_pakai_rute(r.perusahaan_id, 'rute_usulan', p_pemakaian); end if;
  return true;
end $$;

revoke all on function public.rute_model_ambil(uuid), public.rute_model_simpan(uuid, text, jsonb, real, text, real, text, jsonb),
  public.rute_model_gagal(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.rute_model_ambil(uuid), public.rute_model_simpan(uuid, text, jsonb, real, text, real, text, jsonb),
  public.rute_model_gagal(uuid, text, jsonb) to service_role;

-- Uji model oleh pengelola (eval, scripts/eval-keputusan.ts): tanpa usulan dan tanpa mengubah apa pun; dibatasi per hari dan
-- tokennya dicatat. Baris pemakaian dibuat saat mulai (dihitung untuk batas), tokennya diisi sekali setelah model menjawab.
create or replace function public.rute_model_uji_mulai() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_batas integer := app.batas_rute_model('uji_harian', 40); v_n integer; v_id uuid; v_model text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Khusus pemilik atau admin' using errcode = '42501';
  end if;
  select count(*) into v_n from public.pemakaian_ai
   where perusahaan_id = v_pid and tugas = 'rute_usulan_uji'
     and dibuat_at >= date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar';
  if v_n >= v_batas then
    raise exception 'Batas uji harian % panggilan tercapai. Coba lagi besok.', v_batas using errcode = '54000';
  end if;
  select nilai ->> 'ringan' into v_model from public.konfigurasi where kunci = 'model_ai';
  if v_model is null then raise exception 'Model ringan belum diatur di konfigurasi' using errcode = '55000'; end if;
  v_id := app.catat_pakai_rute(v_pid, 'rute_usulan_uji', jsonb_build_object('model', v_model));
  return jsonb_build_object('id', v_id, 'model', v_model);
end $$;

create or replace function public.rute_model_uji_catat(p_id uuid, p_pemakaian jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Khusus pemilik atau admin' using errcode = '42501';
  end if;
  update public.pemakaian_ai
     set token_masuk = greatest(0, coalesce((p_pemakaian ->> 'token_masuk')::integer, 0)),
         token_keluar = greatest(0, coalesce((p_pemakaian ->> 'token_keluar')::integer, 0)),
         token_cache_baca = greatest(0, coalesce((p_pemakaian ->> 'token_cache_baca')::integer, 0)),
         token_cache_tulis = greatest(0, coalesce((p_pemakaian ->> 'token_cache_tulis')::integer, 0))
   where id = p_id and perusahaan_id = app.pid() and tugas = 'rute_usulan_uji' and token_masuk = 0 and token_keluar = 0;
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.rute_model_uji_mulai(), public.rute_model_uji_catat(uuid, jsonb) from public, anon;
grant execute on function public.rute_model_uji_mulai(), public.rute_model_uji_catat(uuid, jsonb) to authenticated;

-- Pembatalan: rute dari model kembali ke pemilik dan admin. Pilihan "pemilik" hanya dibuka pemilik; pilihan "admin" boleh dibuka
-- pemilik atau admin; "keduanya" dan "keduanya (ragu)" tidak mengubah apa pun sehingga tidak ada yang dibatalkan.
create or replace function public.batalkan_keputusan(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k public.keputusan; iz public.pengajuan_izin; v_usulan uuid;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  if coalesce(btrim(p_alasan), '') = '' then raise exception 'Tulis alasan membatalkan.' using errcode = '22023'; end if;
  select * into k from public.keputusan where id = p_id and perusahaan_id = app.pid() for update;
  if k.id is null then raise exception 'Keputusan tidak ditemukan' using errcode = 'P0002'; end if;
  if k.dibatalkan_at is not null then raise exception 'Keputusan ini sudah dibatalkan.' using errcode = '55000'; end if;
  if k.tingkat = 'manusia' then raise exception 'Tidak ada tindakan otomatis yang bisa dibatalkan di sini.' using errcode = '55000'; end if;

  if k.jenis = 'izin.otopilot' then
    update public.pengajuan_izin set status = 'menunggu', oleh_otopilot = false, diputuskan_at = null,
           alasan_putusan = 'Persetujuan otomatis dibatalkan: ' || btrim(p_alasan) || '. Menunggu keputusan pemilik atau admin.'
     where id = k.subjek_id and status = 'disetujui' returning * into iz;
    if iz.id is null then raise exception 'Pengajuan sudah berubah; batalkan lewat keputusan terbarunya.' using errcode = '55000'; end if;
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, data)
    values (iz.perusahaan_id, iz.mulai::timestamp at time zone 'Asia/Makassar', 'izin.batal', 'pwa', iz.orang_id, -iz.hari,
            jsonb_build_object('pengajuan_id', iz.id, 'keputusan_id', k.id));
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, tenggat)
    values (iz.perusahaan_id, 'pwa', 'izin.setujui',
            'Setujui ' || iz.jenis || ' ' || (select nama from public.orang where id = iz.orang_id) || ' ' || iz.hari || ' hari',
            'Persetujuan otomatis dibatalkan: ' || btrim(p_alasan) || '.',
            jsonb_build_object('pengajuan_id', iz.id, 'orang_id', iz.orang_id, 'jenis', iz.jenis, 'mulai', iz.mulai, 'selesai', iz.selesai, 'hari', iz.hari),
            iz.mulai::timestamp at time zone 'Asia/Makassar')
    returning id into v_usulan;
    update public.pengajuan_izin set usulan_id = v_usulan where id = iz.id;
  elsif k.jenis = 'usulan.rute' and k.tingkat = 'model' then
    if k.pilihan not in ('pemilik', 'admin') then
      raise exception 'Nadi tidak mengubah rute usulan ini, jadi tidak ada yang perlu dibatalkan.' using errcode = '55000';
    end if;
    if k.pilihan = 'pemilik' and not app.anggota_aktif(array['pemilik']) then
      raise exception 'Hanya pemilik yang bisa membuka usulan ini untuk admin' using errcode = '42501';
    end if;
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = k.subjek_id and status = 'menunggu';
  elsif k.jenis = 'usulan.rute' then
    if not app.anggota_aktif(array['pemilik']) then
      raise exception 'Hanya pemilik yang bisa membuka usulan uang besar untuk admin' using errcode = '42501';
    end if;
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = k.subjek_id and status = 'menunggu';
  end if;

  update public.keputusan set dibatalkan_at = now(), dibatalkan_oleh = (select auth.uid()), alasan_batal = btrim(p_alasan) where id = k.id;
  return jsonb_build_object('id', k.id, 'jenis', k.jenis, 'usulan', v_usulan);
end $$;
