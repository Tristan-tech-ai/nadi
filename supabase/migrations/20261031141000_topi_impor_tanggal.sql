-- Perbaikan topi_impor: tanggal mulai topi dari Excel diambil di zona WITA. Sebelumnya tengah malam WITA dipotong menjadi
-- tanggal UTC sehingga 2025-03-01 tersimpan 2025-02-28 (tertangkap tes SQL topi_impor).
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
          perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan', (app.tanggal_aman(r ->> 'mulai') at time zone 'Asia/Makassar')::date);
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
