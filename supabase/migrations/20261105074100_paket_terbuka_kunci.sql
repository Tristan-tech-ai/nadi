-- W-06 lanjutan: usulan.kunci_klien bertipe uuid, jadi kunci usulan topi = md5(...)::uuid (temuan tes SQL paket_terbuka).
create or replace function public.usul_topi_baru(p_cerita text, p_paket text, p_yakin numeric, p_topi jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_baru jsonb; v_id uuid; v_nama text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang menyiapkan paket usaha.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_cerita, ''))) not between 10 and 1000 then
    raise exception 'Ceritakan usahamu 10 sampai 1.000 huruf.' using errcode = '22023';
  end if;
  if p_yakin is null or p_yakin not between 0 and 1 then
    raise exception 'Keyakinan 0 sampai 1.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_topi) <> 'array' or jsonb_array_length(p_topi) > 8 or exists (select 1 from jsonb_array_elements(p_topi) t where not app.topi_usulan_sah(t)) then
    raise exception 'Topi usulan paling banyak 8 dengan kode, nama, dan tanggung jawab yang sah.' using errcode = '22023';
  end if;
  update public.perusahaan set pengaturan = jsonb_set(pengaturan, '{cerita_usaha}',
    jsonb_build_object('teks', btrim(p_cerita), 'paket', p_paket, 'yakin', p_yakin, 'at', now())) where id = v_pid;
  select coalesce(jsonb_agg(t), '[]') into v_baru from jsonb_array_elements(p_topi) t
   where not exists (select 1 from public.topi x where x.perusahaan_id = v_pid and x.kode = t ->> 'kode');
  if jsonb_array_length(v_baru) = 0 then return null; end if;
  select string_agg(t ->> 'nama', ', ') into v_nama from jsonb_array_elements(v_baru) t;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, kunci_klien, untuk_peran)
  values (v_pid, 'pwa', 'onboarding.topi', left('Tambah topi: ' || v_nama, 140),
    left('Dibaca dari ceritamu tanpa AI (aturan kata kunci, yakin ' || round(p_yakin * 100) || '%). Setujui bila memang ada orang yang mengerjakan ini; ubah atau tambah topi nanti di Orang.', 1000),
    jsonb_build_object('jenis', 'onboarding', 'bidang', jsonb_build_object('topi', v_baru, 'paket', p_paket)),
    md5('topi-' || v_pid::text || v_baru::text)::uuid, array['pemilik'])
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;
