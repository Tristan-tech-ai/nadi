-- I-04 percontohan penamaan internal bahasa Inggris: modul Mata (istilah teknis "vision", docs/design/GLOSARIUM.md).
-- Fungsi bernama Inggris menjadi implementasi; nama lama tetap ada sebagai pembungkus SQL tipis (security invoker) dengan
-- tanda tangan dan nama parameter yang sama, sehingga klien lama (agen edge yang sudah terpasang, versi web sebelumnya) tetap jalan.
-- Pesan galat untuk pengguna tetap bahasa Indonesia. Tabel (zona_mata, agen_mata) belum diganti nama: tahap berikutnya.

create function public.save_vision_zones(p_zones jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.wajib_mata(); z jsonb; i int := 0; v_id uuid; v_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) > 40 then
    raise exception 'Daftar zona paling banyak 40.' using errcode = '22023';
  end if;
  for z in select * from jsonb_array_elements(p_zones) loop
    i := i + 1;
    if char_length(btrim(coalesce(z ->> 'nama', ''))) not between 1 and 60 then
      raise exception 'Nama zona wajib diisi, paling panjang 60 huruf.' using errcode = '22023';
    end if;
    if coalesce(z ->> 'jenis', '') not in ('meja', 'antrean', 'rak') then
      raise exception 'Jenis zona harus meja, antrean, atau rak.' using errcode = '22023';
    end if;
    if not app.poligon_sah(z -> 'poligon') then
      raise exception 'Zona harus berupa 3 sampai 20 titik di dalam gambar.' using errcode = '22023';
    end if;
    v_id := nullif(z ->> 'id', '')::uuid;
    if v_id is not null then
      update public.zona_mata set nama = btrim(z ->> 'nama'), jenis = z ->> 'jenis', poligon = z -> 'poligon', urutan = i, aktif = true, diubah_at = now()
       where id = v_id and perusahaan_id = v_pid;
      if not found then raise exception 'Zona tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
    else
      insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
      values (v_pid, btrim(z ->> 'nama'), z ->> 'jenis', z -> 'poligon', i) returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;
  update public.zona_mata set aktif = false, diubah_at = now() where perusahaan_id = v_pid and aktif and not (id = any(v_ids));
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nama', nama, 'jenis', jenis, 'poligon', poligon) order by urutan)
                     from public.zona_mata where perusahaan_id = v_pid and aktif), '[]'::jsonb);
end $function$;

create function public.record_vision_state(p_items jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.wajib_mata(); b jsonb; zm public.zona_mata; v_jenis text; v_akhir public.kejadian; v_waktu timestamptz; n int := 0;
  v_status text; v_jumlah int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Paling banyak 50 butir sekali catat.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_items) loop
    select * into zm from public.zona_mata where id = nullif(b ->> 'zona', '')::uuid and perusahaan_id = v_pid and aktif;
    if zm.id is null then raise exception 'Zona tidak ditemukan atau sudah tidak dipakai.' using errcode = 'P0002'; end if;
    v_jenis := case zm.jenis when 'meja' then 'mata.meja' else 'mata.antrean' end;
    v_status := null; v_jumlah := null;
    if zm.jenis = 'meja' then
      v_status := b ->> 'status';
      if v_status is null or v_status not in ('kosong', 'terisi') then raise exception 'Status meja harus kosong atau terisi.' using errcode = '22023'; end if;
    else
      v_jumlah := (b ->> 'jumlah')::int;
      if v_jumlah is null or v_jumlah not between 0 and 500 then raise exception 'Jumlah antrean 0 sampai 500.' using errcode = '22023'; end if;
    end if;
    select * into v_akhir from public.kejadian where perusahaan_id = v_pid and jenis = v_jenis and data ->> 'zona' = zm.id::text
     order by terjadi_at desc, id desc limit 1;
    if v_akhir.id is not null and ((zm.jenis = 'meja' and v_akhir.data ->> 'status' = v_status) or (zm.jenis <> 'meja' and v_akhir.nilai = v_jumlah)) then
      continue;
    end if;
    v_waktu := least(now(), greatest(now() - interval '10 minutes', coalesce((b ->> 'terjadi_at')::timestamptz, now())));
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (v_pid, v_waktu, v_jenis, 'mata', v_jumlah, jsonb_strip_nulls(jsonb_build_object('zona', zm.id, 'nama', zm.nama, 'status', v_status, 'jumlah', v_jumlah)));
    n := n + 1;
  end loop;
  return n;
end $function$;

create function public.vision_state()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.wajib_mata();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon,
            'status', k.data ->> 'status', 'jumlah', (k.data ->> 'jumlah')::int, 'sejak', k.terjadi_at) order by z.urutan)
    from public.zona_mata z
    left join lateral (select data, terjadi_at from public.kejadian
                        where perusahaan_id = v_pid and jenis in ('mata.meja', 'mata.antrean') and data ->> 'zona' = z.id::text
                        order by terjadi_at desc, id desc limit 1) k on true
   where z.perusahaan_id = v_pid and z.aktif), '[]'::jsonb);
end $function$;

create function public.create_vision_agent_token(p_name text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.pid(); v_token text := app.token_baru('nma_');
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membuat token agen Mata.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'Beri nama agen, 2 sampai 60 huruf.' using errcode = '22023'; end if;
  insert into public.agen_mata (perusahaan_id, nama, token_hash, dibuat_oleh) values (v_pid, btrim(p_name), app.hash_token(v_token), auth.uid());
  return v_token;
end $function$;

create function public.revoke_vision_agent_token(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencabut token agen Mata.' using errcode = '42501';
  end if;
  update public.agen_mata set dicabut_at = now() where id = p_id and perusahaan_id = v_pid and dicabut_at is null;
  if not found then raise exception 'Token agen tidak ditemukan atau sudah dicabut.' using errcode = 'P0002'; end if;
end $function$;

create function public.vision_agent_zones(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.usaha_agen_mata(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon) order by z.urutan)
    from public.zona_mata z where z.perusahaan_id = v_pid and z.aktif), '[]'::jsonb);
end $function$;

create function public.vision_agent_record(p_token text, p_items jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.usaha_agen_mata(p_token); b jsonb; zm public.zona_mata; v_jenis text; v_akhir public.kejadian; v_waktu timestamptz;
  n int := 0; v_status text; v_jumlah int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Paling banyak 50 butir sekali catat.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_items) loop
    select * into zm from public.zona_mata where id = nullif(b ->> 'zona', '')::uuid and perusahaan_id = v_pid and aktif;
    if zm.id is null then raise exception 'Zona tidak ditemukan atau sudah tidak dipakai.' using errcode = 'P0002'; end if;
    v_jenis := case zm.jenis when 'meja' then 'mata.meja' else 'mata.antrean' end;
    v_status := null; v_jumlah := null;
    if zm.jenis = 'meja' then
      v_status := b ->> 'status';
      if v_status is null or v_status not in ('kosong', 'terisi') then raise exception 'Status meja harus kosong atau terisi.' using errcode = '22023'; end if;
    else
      v_jumlah := (b ->> 'jumlah')::int;
      if v_jumlah is null or v_jumlah not between 0 and 500 then raise exception 'Jumlah antrean 0 sampai 500.' using errcode = '22023'; end if;
    end if;
    select * into v_akhir from public.kejadian where perusahaan_id = v_pid and jenis = v_jenis and data ->> 'zona' = zm.id::text
     order by terjadi_at desc, id desc limit 1;
    if v_akhir.id is not null and ((zm.jenis = 'meja' and v_akhir.data ->> 'status' = v_status) or (zm.jenis <> 'meja' and v_akhir.nilai = v_jumlah)) then
      continue;
    end if;
    v_waktu := least(now(), greatest(now() - interval '10 minutes', coalesce((b ->> 'terjadi_at')::timestamptz, now())));
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (v_pid, v_waktu, v_jenis, 'mata_agen', v_jumlah, jsonb_strip_nulls(jsonb_build_object('zona', zm.id, 'nama', zm.nama, 'status', v_status, 'jumlah', v_jumlah)));
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.save_vision_zones(jsonb), public.record_vision_state(jsonb), public.vision_state(),
  public.create_vision_agent_token(text), public.revoke_vision_agent_token(uuid),
  public.vision_agent_zones(text), public.vision_agent_record(text, jsonb) from public, anon, authenticated;
grant execute on function public.save_vision_zones(jsonb), public.record_vision_state(jsonb), public.vision_state(),
  public.create_vision_agent_token(text), public.revoke_vision_agent_token(uuid) to authenticated, service_role;
grant execute on function public.vision_agent_zones(text), public.vision_agent_record(text, jsonb) to anon, authenticated, service_role;

-- Nama lama: pembungkus tipis. Hak eksekusi lama tetap (create or replace mempertahankan ACL).
create or replace function public.simpan_zona_mata(p_zona jsonb) returns jsonb
 language sql security invoker set search_path to '' as $$ select public.save_vision_zones(p_zona) $$;
create or replace function public.catat_mata(p_butir jsonb) returns integer
 language sql security invoker set search_path to '' as $$ select public.record_vision_state(p_butir) $$;
create or replace function public.mata_keadaan() returns jsonb
 language sql stable security invoker set search_path to '' as $$ select public.vision_state() $$;
create or replace function public.buat_token_agen_mata(p_nama text) returns text
 language sql security invoker set search_path to '' as $$ select public.create_vision_agent_token(p_nama) $$;
create or replace function public.cabut_token_agen_mata(p_id uuid) returns void
 language sql security invoker set search_path to '' as $$ select public.revoke_vision_agent_token(p_id) $$;
create or replace function public.agen_mata_zona(p_token text) returns jsonb
 language sql security invoker set search_path to '' as $$ select public.vision_agent_zones(p_token) $$;
create or replace function public.agen_mata_catat(p_token text, p_butir jsonb) returns integer
 language sql security invoker set search_path to '' as $$ select public.vision_agent_record(p_token, p_butir) $$;

comment on function public.simpan_zona_mata(jsonb) is 'Alias kompatibel untuk public.save_vision_zones (I-04).';
comment on function public.catat_mata(jsonb) is 'Alias kompatibel untuk public.record_vision_state (I-04).';
comment on function public.mata_keadaan() is 'Alias kompatibel untuk public.vision_state (I-04).';
comment on function public.buat_token_agen_mata(text) is 'Alias kompatibel untuk public.create_vision_agent_token (I-04).';
comment on function public.cabut_token_agen_mata(uuid) is 'Alias kompatibel untuk public.revoke_vision_agent_token (I-04).';
comment on function public.agen_mata_zona(text) is 'Alias kompatibel untuk public.vision_agent_zones (I-04).';
comment on function public.agen_mata_catat(text, jsonb) is 'Alias kompatibel untuk public.vision_agent_record (I-04).';
