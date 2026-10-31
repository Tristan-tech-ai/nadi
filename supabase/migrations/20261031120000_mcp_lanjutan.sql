-- MCP lanjutan (F0-09B): ringkasan pemakaian AI juga untuk asisten AI pemilik/admin, dan kejadian dari usulan yang disetujui
-- mencatat sumber usulan aslinya (lempar, mcp, ...), bukan selalu 'lempar'.

-- Inti ringkasan per usaha. Hanya dipanggil fungsi yang sudah memastikan pemanggil adalah pengelola usaha itu.
create or replace function app.ringkasan_ai_usaha(p_pid uuid, p_hari integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_hasil jsonb;
begin
  with b as (
    select jenis_terdeteksi as j, coalesce(hasil ->> 'sumber', 'model') as s, token_ai as t, dibuat_at
      from public.berkas
     where perusahaan_id = p_pid and status in ('usulan', 'selesai')
  ),
  rata as (select j, avg(t) filter (where s = 'model' and t > 0) as r from b group by j),
  umum as (select avg(t) filter (where s = 'model' and t > 0) as r from b),
  jendela as (select * from b where dibuat_at > now() - make_interval(days => p_hari)),
  p as (
    select coalesce(sum(token_masuk + token_keluar) filter (where tugas = 'baca_berkas'), 0) as baca,
           coalesce(sum(token_masuk + token_keluar) filter (where tugas = 'tulis_aturan'), 0) as tulis,
           coalesce(sum(token_cache_baca), 0) as cache
      from public.pemakaian_ai
     where perusahaan_id = p_pid and dibuat_at > now() - make_interval(days => p_hari)
  )
  select jsonb_build_object(
    'hari', p_hari,
    'berkas_model', (select count(*) from jendela where s = 'model'),
    'berkas_aturan', (select count(*) from jendela where s = 'aturan'),
    'token_baca', (select baca from p),
    'token_tulis_aturan', (select tulis from p),
    'token_cache', (select cache from p),
    'token_hemat', coalesce((select round(sum(coalesce(r.r, (select r from umum), 0)))
                               from jendela w left join rata r on r.j = w.j where w.s = 'aturan'), 0),
    'aturan_aktif', (select count(*) from public.ekstraktor where perusahaan_id = p_pid and aktif)
  ) into v_hasil;
  return v_hasil;
end $$;
revoke all on function app.ringkasan_ai_usaha(uuid, integer) from public, anon, authenticated;

-- Dari aplikasi: pengelola usaha aktif (klaim JWT). SECURITY DEFINER agar bisa memanggil inti di atas.
create or replace function public.ringkasan_ai(p_hari integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then return null; end if;
  return app.ringkasan_ai_usaha(app.pid(), least(greatest(coalesce(p_hari, 30), 1), 365));
end $$;

-- Dari asisten AI (MCP): token, resource, keanggotaan aktif, dan peran pengelola diperiksa.
create function public.mcp_ringkasan_ai(p_token text, p_resource text, p_hari integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from app.mcp_konteks(p_token, p_resource);
  if k.peran not in ('pemilik', 'admin') then raise exception 'Ringkasan AI hanya untuk pemilik dan admin' using errcode = 'P0403'; end if;
  return app.ringkasan_ai_usaha(k.perusahaan_id, least(greatest(coalesce(p_hari, 30), 1), 365));
end $$;
revoke all on function public.mcp_ringkasan_ai(text, text, integer) from public;
grant execute on function public.mcp_ringkasan_ai(text, text, integer) to anon, authenticated;
comment on function public.mcp_ringkasan_ai(text, text, integer) is 'SECURITY DEFINER dan anon DISENGAJA: dipanggil server MCP dengan token buram; diperiksa di app.mcp_konteks.';

create or replace function public.putuskan_usulan(p_usulan uuid, p_setuju boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usulan; b jsonb; r jsonb; v_pid uuid := app.pid(); v_orang uuid; v_jalur text; n int := 0; lewat int := 0; v_nik text;
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
        if coalesce(v_nik, '') <> '' then
          insert into public.orang_rahasia (orang_id, perusahaan_id, nik_hash, nik_akhir)
          values (v_orang, v_pid, encode(extensions.digest(v_nik || v_pid::text, 'sha256'), 'hex'), right(v_nik, 4));
        end if;
        n := 1;
      when 'orang.impor' then
        for r in select * from jsonb_array_elements(coalesce(b -> 'baris', '[]')) loop
          if coalesce(r ->> 'nama', '') = '' or exists (select 1 from public.orang where perusahaan_id = v_pid and lower(nama) = lower(r ->> 'nama')) then
            lewat := lewat + 1;
            continue;
          end if;
          insert into public.orang (perusahaan_id, nama, telepon, data)
          values (v_pid, r ->> 'nama', nullif(r ->> 'telepon', ''), jsonb_strip_nulls(jsonb_build_object(
            'kode', nullif(r ->> 'id', ''), 'jabatan', nullif(r ->> 'jabatan', ''), 'mulai', nullif(r ->> 'mulai', ''), 'sumber', 'excel')))
          returning id into v_orang;
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
