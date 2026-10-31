-- Topi dari impor karyawan (F1-01): jabatan di Excel/KTP/asisten AI menjadi topi (peran kerja) dengan porsi.
-- "Kasir, gudang" menjadi dua topi masing-masing 50%. Jabatan dicocokkan ke topi usaha (sinonim, kode, nama); yang tidak
-- dikenal menjadi topi baru buatan usaha itu. Kerja lintas topi sudah ditandai trigger kerja_lintas_topi (graf_usaha).

create or replace function app.slug(p text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '_' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '_', 'g'))
$$;

-- Topi untuk satu jabatan (boleh berisi beberapa peran: "Kasir, gudang", "Pelayan / antar pesanan").
create or replace function app.topi_dari_jabatan(p_pid uuid, p_jabatan text) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  sinonim constant jsonb := '{"juru_masak": "koki", "chef": "koki", "cook": "koki", "masak": "koki", "tukang_masak": "koki",
    "waiter": "pelayan", "waitress": "pelayan", "pramusaji": "pelayan", "server": "pelayan", "cashier": "kasir",
    "stok": "gudang", "admin_stok": "gudang", "belanja": "gudang", "gudang_dan_belanja": "gudang", "staf_gudang": "gudang",
    "antar": "kurir", "antar_pesanan": "kurir", "sopir": "kurir", "sopir_antar": "kurir", "driver": "kurir", "kurir": "kurir",
    "sales_kanvas": "sales", "salesman": "sales", "spg": "pramuniaga", "penjaga_toko": "pramuniaga"}';
  bagian text; s text; v_id uuid; hasil uuid[] := '{}';
begin
  for bagian in select btrim(x) from regexp_split_to_table(coalesce(p_jabatan, ''), '\s*(,|/|&|\+|\s+dan\s+)\s*') x where btrim(x) <> '' loop
    s := app.slug(bagian);
    if s = '' or char_length(s) > 60 then continue; end if;
    s := coalesce(sinonim ->> s, s);
    select id into v_id from public.topi t where t.perusahaan_id = p_pid and t.aktif
      order by (t.kode = s) desc, (app.slug(t.nama) = s) desc, (app.slug(t.nama) like s || '%') desc limit 1;
    if v_id is not null and not exists (select 1 from public.topi t where t.id = v_id and (t.kode = s or app.slug(t.nama) = s or app.slug(t.nama) like s || '%')) then
      v_id := null;
    end if;
    if v_id is null then
      insert into public.topi (perusahaan_id, kode, nama, deskripsi) values (p_pid, s, initcap(bagian), 'Dibuat dari jabatan saat impor karyawan')
      on conflict (perusahaan_id, kode) do update set aktif = true
      returning id into v_id;
    end if;
    if not (v_id = any (hasil)) then hasil := hasil || v_id; end if;
  end loop;
  return hasil;
end $$;

-- Pasang topi ke satu orang dengan porsi dibagi rata (sisa pembulatan ke topi pertama). Mengembalikan jumlah topi.
create or replace function app.pasang_topi_dari_jabatan(p_pid uuid, p_orang uuid, p_jabatan text, p_mulai date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare ids uuid[] := app.topi_dari_jabatan(p_pid, p_jabatan); n int; i int; porsi numeric;
begin
  n := coalesce(cardinality(ids), 0);
  if n = 0 then return 0; end if;
  porsi := floor(10000.0 / n) / 100;
  for i in 1..n loop
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai)
    values (p_pid, p_orang, ids[i], case when i = 1 then 100 - porsi * (n - 1) else porsi end, coalesce(p_mulai, current_date));
  end loop;
  return n;
end $$;
revoke all on function app.topi_dari_jabatan(uuid, text), app.pasang_topi_dari_jabatan(uuid, uuid, text, date) from public, anon, authenticated;

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
          perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan', app.tanggal_aman(r ->> 'mulai')::date);
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
