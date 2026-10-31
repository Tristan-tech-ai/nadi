-- F3-01 Papan kerja dan Poin Beban (docs/research/poin-beban.md, layar docs/design/papan-kerja.md).
-- 1 poin = 15 menit kerja wajar, dibulatkan ke 0,25 (paling kecil 0,25, paling besar 99). Tangga estimasi: riwayat usaha
-- (0 token, pg_trgm similarity >= 0,4, >= 3 kerja selesai serupa bertopi sama dalam 180 hari, median durasi nyata), lalu model
-- ringan lewat Edge Function estimasi-kerja (dikali faktor kalibrasi usaha), lalu manual. Durasi nyata = selesai - mulai - jeda
-- tunggu. Estimasi di kerja.data.estimasi {menit, poin, sumber, alasan, faktor, menit_model, dihitung_at}, aktual di data.aktual_menit.

-- Staf membaca kerjanya sendiri; pemilik, admin, akuntan membaca semua kerja usahanya (pola keamanan_q12 S8).
-- Tulisan langsung tetap khusus pemilik/admin (kebijakan kerja_tambah/ubah/hapus dari keamanan_q12); staf menulis lewat ubah_status_kerja.
drop policy kerja_baca on public.kerja;
create policy kerja_baca on public.kerja for select to authenticated
  using (perusahaan_id = (select app.pid())
         and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or pelaksana_id = (select app.orang_saya())));

create index kerja_selesai_idx on public.kerja (perusahaan_id, selesai_at desc) where status = 'selesai';

-- Poin dari menit: kelipatan 0,25 terdekat (menit / 3,75 dibulatkan), dibatasi 0,25..99.
create or replace function app.poin_dari_menit(p_menit numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case when p_menit is null then null else least(99, greatest(0.25, round(p_menit / 3.75) * 0.25))::numeric(6,2) end
$$;

-- Teks lama waktu untuk alasan: "kurang dari 1 menit", "40 menit", "1 jam", "1 jam 5 menit" (sama dengan src/lib/kerja/poin.ts).
create or replace function app.teks_menit(p numeric) returns text
language sql immutable set search_path = '' as $$
  select case when p is null then null
              when p < 1 then 'kurang dari 1 menit'
              when round(p) < 60 then round(p)::integer || ' menit'
              when round(p)::integer % 60 = 0 then (round(p)::integer / 60) || ' jam'
              else (round(p)::integer / 60) || ' jam ' || (round(p)::integer % 60) || ' menit' end
$$;

-- Estimasi riwayat (0 token): kerja selesai di usaha yang sama, topi sama, 180 hari terakhir, punya mulai dan durasi nyata,
-- judul mirip (similarity >= 0,4). Minimal 3 kerja; estimasi = median durasi nyata. null bila riwayat kurang.
create or replace function app.estimasi_riwayat(p_pid uuid, p_topi uuid, p_judul text, p_kecuali uuid default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_n integer; v_median double precision; v_contoh text; v_menit numeric;
begin
  with serupa as (
    select k.judul, (k.data ->> 'aktual_menit')::numeric as aktual, extensions.similarity(k.judul, p_judul) as mirip
      from public.kerja k
     where k.perusahaan_id = p_pid and k.status = 'selesai' and k.topi_id is not distinct from p_topi
       and k.mulai_at is not null and k.selesai_at >= now() - interval '180 days'
       and jsonb_typeof(k.data -> 'aktual_menit') = 'number'
       and (p_kecuali is null or k.id <> p_kecuali)
       and extensions.similarity(k.judul, p_judul) >= 0.4
  )
  select count(*), percentile_cont(0.5) within group (order by aktual), (array_agg(judul order by mirip desc))[1]
    into v_n, v_median, v_contoh from serupa;
  if v_n < 3 then return null; end if;
  v_menit := round(v_median::numeric, 1);
  return jsonb_build_object(
    'menit', v_menit, 'poin', app.poin_dari_menit(v_menit), 'sumber', 'riwayat', 'n', v_n, 'faktor', null, 'menit_model', null,
    'alasan', format('Median %s kerja serupa (%s): %s.', v_n, lower(v_contoh), app.teks_menit(v_menit)),
    'dihitung_at', now());
end $$;

-- Faktor kalibrasi usaha: median(durasi nyata / menit model) dari 30 kerja selesai terakhir yang pernah diperkirakan model
-- (menit_model tetap tersimpan walau poinnya kemudian ditimpa manual), dibatasi 0,5..2. Kurang dari 3 kerja: faktor 1.
create or replace function app.faktor_kalibrasi(p_pid uuid) returns jsonb
language sql stable set search_path = '' as $$
  with akhir as (
    select (k.data ->> 'aktual_menit')::numeric / (k.data -> 'estimasi' ->> 'menit_model')::numeric as rasio
      from public.kerja k
     where k.perusahaan_id = p_pid and k.status = 'selesai' and k.mulai_at is not null
       and jsonb_typeof(k.data -> 'aktual_menit') = 'number'
       and jsonb_typeof(k.data -> 'estimasi' -> 'menit_model') = 'number'
       and (k.data -> 'estimasi' ->> 'menit_model')::numeric > 0
     order by k.selesai_at desc
     limit 30
  )
  select jsonb_build_object('n', count(*), 'faktor',
    case when count(*) < 3 then 1
         else round(least(2, greatest(0.5, percentile_cont(0.5) within group (order by rasio)))::numeric, 2) end)
    from akhir
$$;

-- Tulis estimasi ke kerja: poin_beban, data.estimasi, dan galat relatif bila durasi nyata sudah ada.
create or replace function app.tulis_estimasi(p_kerja uuid, p_est jsonb) returns void
language sql set search_path = '' as $$
  update public.kerja
     set poin_beban = (p_est ->> 'poin')::numeric,
         data = (data - 'galat_relatif') || jsonb_build_object('estimasi', p_est)
                || case when jsonb_typeof(data -> 'aktual_menit') = 'number' and (p_est ->> 'menit')::numeric > 0
                        then jsonb_build_object('galat_relatif',
                               round(((data ->> 'aktual_menit')::numeric - (p_est ->> 'menit')::numeric) / (p_est ->> 'menit')::numeric, 2))
                        else '{}'::jsonb end
   where id = p_kerja
$$;

-- Pemilik/admin menambah kerja. Estimasi riwayat dicoba langsung; perlu_model = true bila riwayat kurang (server memanggil
-- Edge Function estimasi-kerja). Kerja tetap tersimpan walau estimasi kosong.
create or replace function public.buat_kerja(p_judul text, p_topi uuid, p_pelaksana uuid, p_tenggat timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_judul text := btrim(regexp_replace(coalesce(p_judul, ''), '\s+', ' ', 'g')); v_id uuid; v_est jsonb;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa menambah kerja.' using errcode = '42501';
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
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, pemberi_id, tenggat)
  values (v_pid, v_judul, p_topi, p_pelaksana, app.orang_saya(), p_tenggat)
  returning id into v_id;
  v_est := app.estimasi_riwayat(v_pid, p_topi, v_judul, v_id);
  if v_est is not null then perform app.tulis_estimasi(v_id, v_est); end if;
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
  values (v_pid, 'kerja.buat', 'pwa', p_pelaksana, v_id, jsonb_build_object('oleh', auth.uid()));
  return jsonb_build_object('id', v_id, 'estimasi', v_est, 'perlu_model', v_est is null);
end $$;

-- Ubah status: mulai (baru -> jalan), tunggu (jalan -> tunggu), lanjut (tunggu -> jalan), selesai (baru/jalan/tunggu -> selesai),
-- batal (pemilik/admin). Oleh pelaksana sendiri atau pemilik/admin. Jeda tunggu dijumlahkan ke data.jeda_menit dan dikurangkan
-- dari durasi nyata. Setiap perubahan dicatat sebagai kejadian kerja.<aksi>.
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
    if k.status not in ('baru', 'jalan', 'tunggu') then raise exception 'Kerja ini sudah selesai atau dibatalkan.' using errcode = '55000'; end if;
    if k.mulai_at is not null then
      v_aktual := round(greatest(0, extract(epoch from now() - k.mulai_at) / 60 - v_jeda), 2);
    end if;
    v_est := (k.data -> 'estimasi' ->> 'menit')::numeric;
    v_data := (k.data - 'tunggu_at' - 'galat_relatif') || jsonb_build_object('jeda_menit', round(v_jeda, 2))
              || case when v_aktual is null then '{}'::jsonb else jsonb_build_object('aktual_menit', v_aktual) end
              || case when v_aktual is not null and v_est > 0 then jsonb_build_object('galat_relatif', round((v_aktual - v_est) / v_est, 2)) else '{}'::jsonb end;
    update public.kerja set status = 'selesai', selesai_at = now(), data = v_data where id = k.id;
  elsif p_aksi = 'batal' then
    if not v_pengelola then raise exception 'Hanya pemilik atau admin yang bisa membatalkan kerja.' using errcode = '42501'; end if;
    if k.status in ('selesai', 'batal') then raise exception 'Kerja ini sudah selesai atau dibatalkan.' using errcode = '55000'; end if;
    update public.kerja set status = 'batal', data = data - 'tunggu_at' where id = k.id;
  else
    raise exception 'Aksi kerja tidak dikenal.' using errcode = '22023';
  end if;

  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, nilai, data)
  values (v_pid, 'kerja.' || p_aksi, 'pwa', coalesce(k.pelaksana_id, v_saya), k.id, v_aktual, jsonb_build_object('oleh', auth.uid()));

  select * into k from public.kerja where id = k.id;
  return jsonb_build_object('id', k.id, 'status', k.status, 'mulai_at', k.mulai_at, 'selesai_at', k.selesai_at,
    'aktual_menit', k.data -> 'aktual_menit', 'jeda_menit', k.data -> 'jeda_menit', 'estimasi', k.data -> 'estimasi');
end $$;

-- Simpan estimasi model (dari Edge Function, menit mentah dikali faktor kalibrasi; sekali per kerja) atau manual (menimpa,
-- menit_model sebelumnya dipertahankan agar kerja ini tetap ikut kalibrasi). Pemakaian token model dicatat di pemakaian_ai.
create or replace function public.simpan_estimasi_kerja(p_kerja uuid, p_menit numeric, p_sumber text, p_alasan text default null,
  p_pemakaian jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); k public.kerja; v_kal jsonb; v_faktor numeric; v_n integer; v_menit numeric; v_est jsonb;
  v_alasan text := left(nullif(btrim(coalesce(p_alasan, '')), ''), 300);
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa mengubah poin.' using errcode = '42501';
  end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid for update;
  if k.id is null then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if k.status = 'batal' then raise exception 'Kerja ini sudah dibatalkan.' using errcode = '55000'; end if;
  if p_menit is null or p_menit <= 0 or p_menit > 1485 then
    raise exception 'Poin 0,25 sampai 99 (1 poin = 15 menit).' using errcode = '22023';
  end if;

  if p_sumber = 'model' then
    if jsonb_typeof(k.data -> 'estimasi') = 'object' then
      raise exception 'Kerja ini sudah punya perkiraan.' using errcode = '55000';
    end if;
    v_kal := app.faktor_kalibrasi(v_pid);
    v_faktor := (v_kal ->> 'faktor')::numeric;
    v_n := (v_kal ->> 'n')::integer;
    v_menit := round(p_menit * v_faktor, 1);
    v_est := jsonb_build_object(
      'menit', v_menit, 'poin', app.poin_dari_menit(v_menit), 'sumber', 'model', 'faktor', v_faktor, 'n', v_n,
      'menit_model', round(p_menit, 1),
      'alasan', coalesce(v_alasan, 'Perkiraan model ringan.')
                || case when v_n >= 3 then format(' Dikali faktor usaha %s dari %s kerja selesai.', replace(v_faktor::text, '.', ','), v_n)
                        else ' Belum dikali faktor usaha (kurang dari 3 kerja selesai untuk kalibrasi).' end,
      'dihitung_at', now());
    if jsonb_typeof(p_pemakaian) = 'object' then
      insert into public.pemakaian_ai (perusahaan_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis)
      values (v_pid, 'estimasi_kerja', left(coalesce(p_pemakaian ->> 'model', ''), 100),
              greatest(0, coalesce((p_pemakaian ->> 'token_masuk')::integer, 0)), greatest(0, coalesce((p_pemakaian ->> 'token_keluar')::integer, 0)),
              greatest(0, coalesce((p_pemakaian ->> 'token_cache_baca')::integer, 0)), greatest(0, coalesce((p_pemakaian ->> 'token_cache_tulis')::integer, 0)));
    end if;
  elsif p_sumber = 'manual' then
    v_menit := round(p_menit, 1);
    v_est := jsonb_build_object(
      'menit', v_menit, 'poin', app.poin_dari_menit(v_menit), 'sumber', 'manual', 'faktor', null, 'n', null,
      'menit_model', k.data -> 'estimasi' -> 'menit_model',
      'alasan', coalesce(v_alasan, 'Diisi manual oleh pemberi kerja.'), 'dihitung_at', now());
  else
    raise exception 'Sumber perkiraan tidak dikenal.' using errcode = '22023';
  end if;
  perform app.tulis_estimasi(k.id, v_est);
  return v_est;
end $$;

-- Bahan untuk model ringan (pemilik/admin): judul, topi dan tanggung jawabnya, estimasi yang sudah ada, dan sampai 5 kerja
-- selesai terdekat (topi sama dulu, lalu judul paling mirip) beserta durasi nyatanya.
create or replace function public.konteks_estimasi(p_kerja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kerja; v_topi jsonb; v_contoh jsonb;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa meminta perkiraan.' using errcode = '42501';
  end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid;
  if k.id is null then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  select jsonb_build_object('nama', t.nama, 'deskripsi', t.deskripsi, 'tanggung_jawab', t.tanggung_jawab) into v_topi
    from public.topi t where t.id = k.topi_id;
  select coalesce(jsonb_agg(jsonb_build_object('judul', c.judul, 'topi', c.topi, 'menit', c.menit)), '[]'::jsonb) into v_contoh
    from (select x.judul, t.nama as topi, round((x.data ->> 'aktual_menit')::numeric) as menit
            from public.kerja x left join public.topi t on t.id = x.topi_id
           where x.perusahaan_id = v_pid and x.status = 'selesai' and x.mulai_at is not null and x.id <> k.id
             and x.selesai_at >= now() - interval '180 days' and jsonb_typeof(x.data -> 'aktual_menit') = 'number'
           order by (x.topi_id is not distinct from k.topi_id) desc, extensions.similarity(x.judul, k.judul) desc, x.selesai_at desc
           limit 5) c;
  return jsonb_build_object('id', k.id, 'judul', k.judul, 'topi', v_topi, 'estimasi', k.data -> 'estimasi', 'contoh', v_contoh,
    'kalibrasi', app.faktor_kalibrasi(v_pid));
end $$;

-- Papan: kerja terbuka (baru, jalan, tunggu) dan yang selesai hari ini di zona usaha. Security invoker: RLS menentukan isinya
-- (staf hanya kerjanya sendiri, nama pelaksana hanya terbaca bila boleh).
create or replace function public.papan_kerja() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with z as (select coalesce(p.zona_waktu, 'Asia/Makassar') as zona from public.perusahaan p where p.id = (select app.pid())),
  b as (
    select k.*, t.nama as topi_nama, o.nama as pelaksana_nama
      from public.kerja k cross join z
      left join public.topi t on t.id = k.topi_id
      left join public.orang o on o.id = k.pelaksana_id
     where k.perusahaan_id = (select app.pid())
       and (k.status in ('baru', 'jalan', 'tunggu')
            or (k.status = 'selesai' and (k.selesai_at at time zone z.zona)::date = (now() at time zone z.zona)::date))
     order by case k.status when 'jalan' then 0 when 'tunggu' then 1 when 'baru' then 2 else 3 end,
              k.tenggat asc nulls last, k.dibuat_at
     limit 300
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'judul', b.judul, 'status', b.status, 'poin', b.poin_beban, 'tenggat', b.tenggat,
           'mulai_at', b.mulai_at, 'selesai_at', b.selesai_at, 'lintas_topi', b.lintas_topi,
           'estimasi', b.data -> 'estimasi', 'aktual_menit', b.data -> 'aktual_menit', 'jeda_menit', b.data -> 'jeda_menit',
           'topi', case when b.topi_id is null then null else jsonb_build_object('id', b.topi_id, 'nama', b.topi_nama) end,
           'pelaksana', case when b.pelaksana_id is null then null else jsonb_build_object('id', b.pelaksana_id, 'nama', b.pelaksana_nama) end,
           'saya', b.pelaksana_id is not null and b.pelaksana_id = (select app.orang_saya())
         ) order by case b.status when 'jalan' then 0 when 'tunggu' then 1 when 'baru' then 2 else 3 end,
                    b.tenggat asc nulls last, b.dibuat_at), '[]'::jsonb)
    from b
$$;

revoke all on function app.poin_dari_menit(numeric), app.teks_menit(numeric), app.estimasi_riwayat(uuid, uuid, text, uuid),
  app.faktor_kalibrasi(uuid), app.tulis_estimasi(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.buat_kerja(text, uuid, uuid, timestamptz), public.ubah_status_kerja(uuid, text),
  public.simpan_estimasi_kerja(uuid, numeric, text, text, jsonb), public.konteks_estimasi(uuid), public.papan_kerja() from public, anon;
grant execute on function public.buat_kerja(text, uuid, uuid, timestamptz), public.ubah_status_kerja(uuid, text),
  public.simpan_estimasi_kerja(uuid, numeric, text, text, jsonb), public.konteks_estimasi(uuid), public.papan_kerja() to authenticated;
