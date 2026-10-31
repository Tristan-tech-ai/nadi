-- F1-06B, tinjauan keamanan: model hanya boleh mempersempit rute ke pemilik. Kebijakan usulan_baca memakai untuk_peran, sehingga
-- rute {admin} menyembunyikan usulan dari pemilik; teks yang dinilai model bisa berasal dari luar (catatan asisten MCP, isi berkas
-- pemasok), jadi pilihan "admin" hanya dicatat sebagai saran ("admin (saran)") dan untuk_peran tetap {pemilik, admin}.
-- Pembatalan rute model hanya untuk pilihan "pemilik" dan hanya oleh pemilik.

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
    v_pilihan := case when v_tindakan = 'ragu' then 'keduanya (ragu)' when p_pilihan = 'admin' then 'admin (saran)' else p_pilihan end;
    if v_pilihan = 'pemilik' then
      update public.usulan set untuk_peran = array['pemilik'] where id = p_usulan;
    end if;
    v_alasan := 'Usulan "' || left(u.judul, 80) || '": '
                || coalesce(nullif(left(btrim(replace(replace(coalesce(p_alasan, ''), chr(8212), ','), chr(8211), ',')), 300), ''), 'Tanpa alasan dari model.');
    insert into public.keputusan (perusahaan_id, jenis, subjek_id, tingkat, pilihan, peluang, yakin, alasan, latensi_ms, model)
    values (u.perusahaan_id, 'usulan.rute', u.id, 'model', v_pilihan, p_peluang, p_yakin, v_alasan, p_latensi_ms, left(p_model, 100))
    returning id into v_k;
  end if;
  update app.rute_model set status = 'selesai', pilihan = p_pilihan, yakin = p_yakin, keputusan_id = v_k, selesai_at = clock_timestamp()
   where usulan_id = p_usulan;
  return jsonb_build_object('status', 'selesai', 'tindakan', v_tindakan, 'keputusan_id', v_k, 'pilihan', v_pilihan);
end $$;

revoke all on function public.rute_model_simpan(uuid, text, jsonb, real, text, real, text, jsonb) from public, anon, authenticated;
grant execute on function public.rute_model_simpan(uuid, text, jsonb, real, text, real, text, jsonb) to service_role;

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
  elsif k.jenis = 'usulan.rute' then
    if k.tingkat = 'model' and k.pilihan <> 'pemilik' then
      raise exception 'Nadi tidak mengubah rute usulan ini, jadi tidak ada yang perlu dibatalkan.' using errcode = '55000';
    end if;
    if not app.anggota_aktif(array['pemilik']) then
      raise exception '%', case when k.tingkat = 'model' then 'Hanya pemilik yang bisa membuka usulan ini untuk admin'
                                else 'Hanya pemilik yang bisa membuka usulan uang besar untuk admin' end using errcode = '42501';
    end if;
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = k.subjek_id and status = 'menunggu';
  end if;

  update public.keputusan set dibatalkan_at = now(), dibatalkan_oleh = (select auth.uid()), alasan_batal = btrim(p_alasan) where id = k.id;
  return jsonb_build_object('id', k.id, 'jenis', k.jenis, 'usulan', v_usulan);
end $$;
