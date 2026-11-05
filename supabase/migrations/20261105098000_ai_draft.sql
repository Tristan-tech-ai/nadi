-- U-04 draf AI onboarding (docs/design/REKONSTRUKSI-APP.md 7b): AI milik pengguna (Teks Nadi yang ditempel atau MCP) menulis
-- SATU draf berisi baris per bagian (usaha, fitur, izin, topi, orang, gaji), bukan usulan per baris. Pemilik/admin meninjau di
-- Nadi: setiap sel bisa diubah, baris dihapus/ditambah, lalu Terapkan sekali dengan jendela batal 10 menit. AI pengguna boleh
-- membaca dan merevisi draf lewat MCP tetapi tidak bisa menerapkan. Baris ragu (nama sudah ada, isian wajib kosong, keyakinan
-- < 70) tidak tercentang; baris gaji tidak pernah tercentang otomatis. Keluaran model = masukan tak tepercaya: setiap baris
-- dirapikan dan diperiksa ulang di sini (tanpa NIK/nomor panjang, rekening tidak diterima, gaji hanya angka wajar).

create table public.ai_draft (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  sumber text not null check (sumber in ('tempel', 'mcp')),
  status text not null default 'draf' check (status in ('draf', 'diterapkan', 'dibatalkan', 'ditutup')),
  baris jsonb not null default '[]'::jsonb check (jsonb_typeof(baris) = 'array' and octet_length(baris::text) < 200000),
  dari jsonb not null default '{}'::jsonb,
  hasil jsonb,
  dibuat_oleh uuid default auth.uid(),
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  diterapkan_at timestamptz,
  batal_sampai timestamptz
);
create index on public.ai_draft (perusahaan_id, dibuat_at desc);
alter table public.ai_draft enable row level security;
grant select on public.ai_draft to authenticated;
create policy ai_draft_baca_pengelola on public.ai_draft for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()));

-- Satu baris dirapikan: bentuk nilai per bagian, lalu ragu/peka/centang dihitung ulang dari data usaha.
create or replace function app.ai_draft_row(p_pid uuid, r jsonb, p_centang boolean default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare bg text := r ->> 'bagian'; v jsonb := coalesce(r -> 'nilai', '{}'::jsonb); n jsonb; ragu text; peka boolean := false; yakin int;
begin
  if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 2000 then raise exception 'Baris: nilai wajib objek kecil' using errcode = '22023'; end if;
  if v::text ~ '\d{12,}' or v::text ~* '"(nik|rekening|norek|nomor_rekening)"' then
    raise exception 'Baris: NIK, rekening, atau nomor panjang tidak diterima dari AI' using errcode = '22023';
  end if;
  yakin := case when coalesce(r ->> 'keyakinan', '') ~ '^\d{1,3}$' then least((r ->> 'keyakinan')::int, 100) end;
  if bg = 'usaha' then
    n := jsonb_strip_nulls(jsonb_build_object('skala', v ->> 'skala', 'cabang', case when coalesce(v ->> 'cabang', '') ~ '^\d{1,3}$' then (v ->> 'cabang')::int end,
           'kota', left(nullif(btrim(v ->> 'kota'), ''), 80), 'negara', coalesce(nullif(v ->> 'negara', ''), 'ID')));
    if n ->> 'skala' is not null and n ->> 'skala' not in ('1', '2-5', '6-15', '16-50', '50+') then ragu := 'Skala tidak dikenal'; end if;
    if not exists (select 1 from public.negara g where g.kode = n ->> 'negara') then ragu := 'Negara belum ada di daftar Nadi'; end if;
  elsif bg = 'fitur' then
    n := jsonb_build_object('modul', v ->> 'modul', 'nyala', coalesce((v ->> 'nyala')::boolean, true));
    if not (coalesce(v ->> 'modul', '') = any (app.feature_modules())) then raise exception 'Baris: modul fitur tidak dikenal' using errcode = '22023'; end if;
  elsif bg = 'izin' then
    if coalesce(v ->> 'jenis', '') not in ('sakit', 'izin', 'cuti') then raise exception 'Baris: jenis izin sakit, izin, atau cuti' using errcode = '22023'; end if;
    n := jsonb_build_object('jenis', v ->> 'jenis', 'otomatis', coalesce((v ->> 'otomatis')::boolean, false),
           'maks_hari', case when coalesce(v ->> 'maks_hari', '') ~ '^\d{1,2}$' then least((v ->> 'maks_hari')::int, 30) else 0 end,
           'butuh_bukti', coalesce((v ->> 'butuh_bukti')::boolean, false),
           'jatah_tahunan', case when coalesce(v ->> 'jatah_tahunan', '') ~ '^\d{1,2}$' then least((v ->> 'jatah_tahunan')::int, 60) end);
  elsif bg = 'topi' then
    n := jsonb_build_object('nama', left(btrim(coalesce(v ->> 'nama', '')), 60));
    if char_length(n ->> 'nama') < 2 then ragu := 'Nama topi kosong'; end if;
  elsif bg = 'orang' then
    n := jsonb_build_object('nama', left(regexp_replace(btrim(coalesce(v ->> 'nama', '')), '\s+', ' ', 'g'), 80),
           'jabatan', left(btrim(coalesce(v ->> 'jabatan', '')), 200), 'mulai', coalesce(v ->> 'mulai', ''));
    if (n ->> 'nama') !~ '^[[:alpha:]][[:alpha:] .''-]{1,79}$' then ragu := 'Nama harus huruf';
    elsif (n ->> 'mulai') <> '' and (n ->> 'mulai') !~ '^\d{4}-\d{2}-\d{2}$' then ragu := 'Tanggal mulai harus YYYY-MM-DD';
    elsif exists (select 1 from public.orang o where o.perusahaan_id = p_pid and lower(o.nama) = lower(n ->> 'nama') and o.status = 'aktif') then
      ragu := 'Nama ini sudah ada di Nadi';
    end if;
  elsif bg = 'gaji' then
    peka := true;
    n := jsonb_build_object('nama', left(btrim(coalesce(v ->> 'nama', '')), 80),
           'pokok', case when coalesce(v ->> 'pokok', '') ~ '^\d{1,9}$' then (v ->> 'pokok')::bigint end);
    if (n ->> 'pokok') is null or (n ->> 'pokok')::bigint not between 100000 and 500000000 then ragu := 'Gaji pokok di luar Rp100.000 sampai Rp500.000.000'; end if;
  else
    raise exception 'Baris: bagian tidak dikenal' using errcode = '22023';
  end if;
  if ragu is null and yakin is not null and yakin < 70 then ragu := 'Keyakinan AI ' || yakin || '%'; end if;
  return jsonb_build_object(
    'id', coalesce(nullif(left(r ->> 'id', 16), ''), substr(md5(random()::text), 1, 8)),
    'bagian', bg, 'nilai', n, 'ragu', ragu, 'peka', peka, 'keyakinan', yakin,
    'alasan', left(nullif(btrim(r ->> 'alasan'), ''), 300),
    -- Gaji tidak pernah tercentang otomatis; baris ragu tidak tercentang; pilihan pemilik dipertahankan bila ada.
    'centang', case when p_centang is not null then p_centang and not (ragu is not null) else not peka and ragu is null end);
end $$;

create or replace function app.ai_draft_rows(p_pid uuid, p_baris jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e jsonb; hasil jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) not between 1 and 200 then
    raise exception 'Kirim 1 sampai 200 baris draf' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop hasil := hasil || jsonb_build_array(app.ai_draft_row(p_pid, e)); end loop;
  return hasil;
end $$;

create or replace function app.ai_draft_new(p_pid uuid, p_baris jsonb, p_sumber text, p_dari jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.ai_draft d where d.perusahaan_id = p_pid and d.dibuat_at > now() - interval '1 day') >= 30 then
    raise exception 'Batas 30 draf AI per hari tercapai' using errcode = 'P0429';
  end if;
  -- Draf lama yang belum diterapkan ditutup supaya hanya satu draf yang terbuka.
  update public.ai_draft set status = 'ditutup', diubah_at = now() where perusahaan_id = p_pid and status = 'draf';
  insert into public.ai_draft (perusahaan_id, sumber, baris, dari) values (p_pid, p_sumber, app.ai_draft_rows(p_pid, p_baris), p_dari) returning id into v_id;
  return v_id;
end $$;

-- p_ops: [{op: ubah, id, nilai}, {op: hapus, id}, {op: tambah, baris}, {op: centang, id, centang}]. AI (MCP) tidak boleh 'centang'.
create or replace function app.ai_draft_edit(p_pid uuid, p_draf uuid, p_ops jsonb, p_dari_ai boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d record; o jsonb; arr jsonb; i int; x jsonb; hasil jsonb;
begin
  select * into d from public.ai_draft where id = p_draf and perusahaan_id = p_pid for update;
  if d.id is null then raise exception 'Draf tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'draf' then raise exception 'Draf sudah tidak bisa diubah' using errcode = '22023'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) not between 1 and 200 then raise exception 'Kirim 1 sampai 200 perubahan' using errcode = '22023'; end if;
  arr := d.baris;
  for o in select * from jsonb_array_elements(p_ops) loop
    i := (select (t.ord - 1)::int from jsonb_array_elements(arr) with ordinality t(v, ord) where t.v ->> 'id' = o ->> 'id' limit 1);
    case o ->> 'op'
      when 'tambah' then
        if jsonb_array_length(arr) >= 200 then raise exception 'Draf maksimal 200 baris' using errcode = '22023'; end if;
        arr := arr || jsonb_build_array(app.ai_draft_row(p_pid, (o -> 'baris') - 'id'));
      when 'hapus' then
        if i is null then raise exception 'Baris tidak ditemukan' using errcode = 'P0002'; end if;
        arr := arr - i;
      when 'ubah' then
        if i is null then raise exception 'Baris tidak ditemukan' using errcode = 'P0002'; end if;
        x := arr -> i;
        arr := jsonb_set(arr, array[i::text], app.ai_draft_row(p_pid,
          jsonb_build_object('id', x ->> 'id', 'bagian', x ->> 'bagian', 'nilai', (x -> 'nilai') || coalesce(o -> 'nilai', '{}'::jsonb),
            'alasan', coalesce(o ->> 'alasan', x ->> 'alasan'), 'keyakinan', case when p_dari_ai then coalesce(o ->> 'keyakinan', x ->> 'keyakinan') end),
          case when p_dari_ai or (x ->> 'peka')::boolean then null else true end));
      when 'centang' then
        if p_dari_ai then raise exception 'AI tidak bisa mencentang; pemilik yang memutuskan' using errcode = '42501'; end if;
        if i is null then raise exception 'Baris tidak ditemukan' using errcode = 'P0002'; end if;
        x := arr -> i;
        if coalesce((o ->> 'centang')::boolean, false) and x ->> 'ragu' is not null then raise exception 'Perbaiki baris yang perlu dicek dulu' using errcode = '22023'; end if;
        arr := jsonb_set(arr, array[i::text, 'centang'], to_jsonb(coalesce((o ->> 'centang')::boolean, false)));
      else raise exception 'Perubahan tidak dikenal' using errcode = '22023';
    end case;
  end loop;
  update public.ai_draft set baris = arr, diubah_at = now() where id = p_draf returning baris into hasil;
  return hasil;
end $$;

create or replace function public.save_ai_draft(p_baris jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  return app.ai_draft_new(v_pid, p_baris, 'tempel', jsonb_build_object('jalur', 'tempel', 'oleh', auth.uid()));
end $$;

create or replace function public.edit_ai_draft(p_draf uuid, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return app.ai_draft_edit(app.wajib_pengelola(), p_draf, p_ops, false);
end $$;

create or replace function public.apply_ai_draft(p_draf uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); d record; r jsonb; v jsonb; n int := 0; v_orang uuid; v_ids uuid[]; lama record;
  h jsonb := jsonb_build_object('orang', '[]'::jsonb, 'topi', '[]'::jsonb, 'izin', '[]'::jsonb, 'gaji', '[]'::jsonb);
  urut constant text[] := array['usaha', 'fitur', 'izin', 'topi', 'orang', 'gaji'];
  bg text;
begin
  select * into d from public.ai_draft where id = p_draf and perusahaan_id = v_pid for update;
  if d.id is null then raise exception 'Draf tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'draf' then raise exception 'Draf ini sudah diterapkan atau ditutup' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(d.baris) b where (b ->> 'centang')::boolean and b ->> 'ragu' is not null) then
    raise exception 'Ada baris tercentang yang masih perlu dicek' using errcode = '22023';
  end if;
  select pengaturan -> 'fitur' as fitur, skala, cabang, kota, negara, zona_waktu into lama from public.perusahaan where id = v_pid;
  h := h || jsonb_build_object('fitur_lama', coalesce(lama.fitur, 'null'::jsonb));
  foreach bg in array urut loop
    for r in select b from jsonb_array_elements(d.baris) b where b ->> 'bagian' = bg and (b ->> 'centang')::boolean loop
      v := r -> 'nilai';
      if bg = 'usaha' then
        h := h || jsonb_build_object('usaha_lama', jsonb_build_object('skala', lama.skala, 'cabang', lama.cabang, 'kota', lama.kota, 'negara', lama.negara, 'zona', lama.zona_waktu));
        perform public.atur_konteks_usaha(coalesce(v ->> 'skala', lama.skala), coalesce((v ->> 'cabang')::int, lama.cabang), coalesce(v ->> 'kota', lama.kota), coalesce(v ->> 'negara', lama.negara), null);
      elsif bg = 'fitur' then
        perform public.set_feature_module(v ->> 'modul', (v ->> 'nyala')::boolean);
      elsif bg = 'izin' then
        h := jsonb_set(h, '{izin}', (h -> 'izin') || jsonb_build_array(coalesce((select to_jsonb(k) from public.kebijakan_izin k where k.perusahaan_id = v_pid and k.jenis = v ->> 'jenis'),
               jsonb_build_object('jenis', v ->> 'jenis', 'baru', true))));
        perform public.atur_kebijakan_izin(v ->> 'jenis', (v ->> 'otomatis')::boolean, (v ->> 'maks_hari')::int, (v ->> 'butuh_bukti')::boolean,
          (select k.maks_bersamaan from public.kebijakan_izin k where k.perusahaan_id = v_pid and k.jenis = v ->> 'jenis'), (v ->> 'jatah_tahunan')::int);
      elsif bg = 'topi' then
        v_ids := app.topi_dari_jabatan(v_pid, v ->> 'nama');
        h := jsonb_set(h, '{topi}', (h -> 'topi') || to_jsonb(v_ids));
      elsif bg = 'orang' then
        insert into public.orang (perusahaan_id, nama, data)
        values (v_pid, v ->> 'nama', jsonb_strip_nulls(jsonb_build_object('jabatan', nullif(v ->> 'jabatan', ''), 'mulai', nullif(v ->> 'mulai', ''), 'sumber', 'draf_ai')))
        returning id into v_orang;
        perform app.pasang_topi_dari_jabatan(v_pid, v_orang, v ->> 'jabatan', app.tanggal_aman(v ->> 'mulai')::date);
        h := jsonb_set(h, '{orang}', (h -> 'orang') || to_jsonb(v_orang));
      elsif bg = 'gaji' then
        select o.id into v_orang from public.orang o where o.perusahaan_id = v_pid and o.status = 'aktif' and lower(o.nama) = lower(v ->> 'nama') order by o.dibuat_at desc limit 1;
        if v_orang is null then raise exception 'Gaji untuk % belum punya orang di Nadi', v ->> 'nama' using errcode = '22023'; end if;
        h := jsonb_set(h, '{gaji}', (h -> 'gaji') || jsonb_build_array(jsonb_build_object('orang_id', v_orang,
               'lama', (select g.gaji from public.orang_rahasia g where g.orang_id = v_orang))));
        insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (v_orang, v_pid, jsonb_build_object('pokok', (v ->> 'pokok')::bigint))
        on conflict (orang_id) do update set gaji = public.orang_rahasia.gaji || jsonb_build_object('pokok', (v ->> 'pokok')::bigint), diubah_at = now();
      end if;
      n := n + 1;
    end loop;
  end loop;
  if n = 0 then raise exception 'Tidak ada baris yang dicentang' using errcode = '22023'; end if;
  update public.ai_draft set status = 'diterapkan', hasil = h, diterapkan_at = now(), batal_sampai = now() + interval '10 minutes', diubah_at = now() where id = p_draf;
  return jsonb_build_object('diterapkan', n, 'batal_sampai', now() + interval '10 minutes');
end $$;

-- Batal dalam 10 menit: orang yang dibuat draf dinonaktifkan (tidak dihapus), topi baru yang tidak dipakai orang aktif lain
-- dinonaktifkan, fitur, izin, profil usaha, dan gaji dikembalikan ke nilai sebelum diterapkan.
create or replace function public.undo_ai_draft(p_draf uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); d record; h jsonb; z jsonb; u jsonb;
begin
  select * into d from public.ai_draft where id = p_draf and perusahaan_id = v_pid for update;
  if d.id is null then raise exception 'Draf tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'diterapkan' or d.batal_sampai < now() then raise exception 'Jendela batal sudah lewat' using errcode = '22023'; end if;
  h := d.hasil;
  update public.orang set status = 'nonaktif', diubah_at = now()
   where perusahaan_id = v_pid and id in (select (x #>> '{}')::uuid from jsonb_array_elements(h -> 'orang') x);
  update public.topi t set aktif = false
   where t.perusahaan_id = v_pid and t.id in (select (x #>> '{}')::uuid from jsonb_array_elements(h -> 'topi') x)
     and t.deskripsi = 'Dibuat dari jabatan saat impor karyawan'
     and not exists (select 1 from public.pakai_topi p join public.orang o on o.id = p.orang_id where p.topi_id = t.id and o.status = 'aktif');
  update public.perusahaan set pengaturan = case when h -> 'fitur_lama' = 'null'::jsonb then pengaturan - 'fitur' else jsonb_set(pengaturan, '{fitur}', h -> 'fitur_lama') end
   where id = v_pid and h ? 'fitur_lama';
  for z in select * from jsonb_array_elements(h -> 'izin') loop
    if (z ->> 'baru')::boolean then
      perform public.atur_kebijakan_izin(z ->> 'jenis', false, 1, false, null, null);
    else
      perform public.atur_kebijakan_izin(z ->> 'jenis', (z ->> 'otomatis')::boolean, (z ->> 'maks_hari_otomatis')::int, (z ->> 'butuh_bukti')::boolean,
        (z ->> 'maks_bersamaan')::int, (z ->> 'jatah_tahunan')::int);
    end if;
  end loop;
  if h ? 'usaha_lama' then
    u := h -> 'usaha_lama';
    perform public.atur_konteks_usaha(u ->> 'skala', (u ->> 'cabang')::int, u ->> 'kota', u ->> 'negara', u ->> 'zona');
  end if;
  for z in select * from jsonb_array_elements(h -> 'gaji') loop
    update public.orang_rahasia set gaji = coalesce(z -> 'lama', '{}'::jsonb), diubah_at = now() where orang_id = (z ->> 'orang_id')::uuid and perusahaan_id = v_pid;
  end loop;
  update public.ai_draft set status = 'dibatalkan', diubah_at = now() where id = p_draf;
  return jsonb_build_object('dibatalkan', true);
end $$;

-- MCP: AI pengguna menulis, membaca, dan merevisi draf terbuka. Tidak ada alat untuk menerapkan.
create or replace function public.mcp_save_ai_draft(p_token text, p_resource text, p_baris jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; v_id uuid;
begin
  select * into k from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  v_id := app.ai_draft_new(k.perusahaan_id, p_baris, 'mcp', jsonb_build_object('jalur', 'mcp', 'klien', k.nama_klien, 'oleh', k.user_id));
  return jsonb_build_object('draf', v_id, 'baris', (select jsonb_array_length(baris) from public.ai_draft where id = v_id),
    'catatan', 'Draf tampil di Nadi untuk ditinjau pemilik. AI tidak bisa menerapkannya.');
end $$;

create or replace function public.mcp_read_ai_draft(p_token text, p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; d record;
begin
  select * into k from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  select * into d from public.ai_draft where perusahaan_id = k.perusahaan_id and status = 'draf' order by dibuat_at desc limit 1;
  if d.id is null then return jsonb_build_object('draf', null); end if;
  return jsonb_build_object('draf', d.id, 'status', d.status, 'baris', d.baris);
end $$;

create or replace function public.mcp_edit_ai_draft(p_token text, p_resource text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; v_id uuid;
begin
  select * into k from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  select id into v_id from public.ai_draft where perusahaan_id = k.perusahaan_id and status = 'draf' order by dibuat_at desc limit 1;
  if v_id is null then raise exception 'Belum ada draf terbuka' using errcode = 'P0002'; end if;
  return jsonb_build_object('draf', v_id, 'baris', app.ai_draft_edit(k.perusahaan_id, v_id, p_ops, true));
end $$;

revoke all on function app.ai_draft_row(uuid, jsonb, boolean), app.ai_draft_rows(uuid, jsonb), app.ai_draft_new(uuid, jsonb, text, jsonb),
  app.ai_draft_edit(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.save_ai_draft(jsonb), public.edit_ai_draft(uuid, jsonb), public.apply_ai_draft(uuid), public.undo_ai_draft(uuid),
  public.mcp_save_ai_draft(text, text, jsonb), public.mcp_read_ai_draft(text, text), public.mcp_edit_ai_draft(text, text, jsonb) from public, anon;
grant execute on function public.save_ai_draft(jsonb), public.edit_ai_draft(uuid, jsonb), public.apply_ai_draft(uuid), public.undo_ai_draft(uuid) to authenticated;
grant execute on function public.mcp_save_ai_draft(text, text, jsonb), public.mcp_read_ai_draft(text, text), public.mcp_edit_ai_draft(text, text, jsonb) to anon, authenticated;
