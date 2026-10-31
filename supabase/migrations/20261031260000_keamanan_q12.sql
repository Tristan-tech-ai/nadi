-- Q-12 (docs/quality/keamanan-f0.md S3, S4b, S5, S8).
-- S3: tulis lewat RLS butuh keanggotaan aktif sungguhan (app.anggota_aktif), bukan klaim JWT yang bisa basi sampai 1 jam.
-- S4b: admin tidak bisa melewati aturan khusus pemilik. S5: penanda demo hanya ditulis Nadi. S8: staf membaca orang/kejadian miliknya saja.

-- S3: kebijakan tulis tabel graf usaha (berkas sudah tanpa hak tulis klien sejak keamanan_q01_berkas).
do $$
declare t text;
begin
  foreach t in array array['orang','topi','pakai_topi','tempat','aset','kerja','kejadian','usulan','pengetahuan'] loop
    execute format('drop policy %I on public.%I', t || '_tambah', t);
    execute format('drop policy %I on public.%I', t || '_ubah', t);
    execute format('drop policy %I on public.%I', t || '_hapus', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array[''pemilik'', ''admin''])))', t || '_tambah', t);
    execute format('create policy %I on public.%I for update to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array[''pemilik'', ''admin'']))) with check (perusahaan_id = (select app.pid()))', t || '_ubah', t);
    execute format('create policy %I on public.%I for delete to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array[''pemilik'', ''admin''])))', t || '_hapus', t);
  end loop;
end $$;

drop policy orang_rahasia_kelola on public.orang_rahasia;
create policy orang_rahasia_kelola on public.orang_rahasia for all to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])))
  with check (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy lowongan_kelola on public.lowongan;
create policy lowongan_kelola on public.lowongan for all to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])))
  with check (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy lamaran_baca on public.lamaran;
create policy lamaran_baca on public.lamaran for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy perusahaan_ubah on public.perusahaan;
create policy perusahaan_ubah on public.perusahaan for update to authenticated
  using (id = (select app.pid()) and (select app.anggota_aktif(array['pemilik'])))
  with check (id = (select app.pid()));

-- S8: staf membaca orang dan kejadian miliknya saja; pemilik, admin, akuntan membaca semua.
drop policy orang_baca on public.orang;
create policy orang_baca on public.orang for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or id = (select app.orang_saya())));
drop policy kejadian_baca on public.kejadian;
create policy kejadian_baca on public.kejadian for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or orang_id = (select app.orang_saya())));

-- S4b: usulan hanya diubah fungsi server (putuskan_usulan, batalkan_keputusan, pemberitahuan). Usulan yang ditulis klien selalu mulai
-- dari peran bawaan dan status menunggu, sehingga trigger rute_usulan tetap berlaku (nama trigger diawali a_ agar jalan lebih dulu).
revoke update, delete on public.usulan from authenticated;
create or replace function app.jaga_usulan_klien() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.untuk_peran := array['pemilik', 'admin'];
    new.status := 'menunggu';
  end if;
  return new;
end $$;
create trigger a_usulan_jaga_klien before insert on public.usulan
  for each row execute function app.jaga_usulan_klien();

-- S4b: membuka rute usulan uang besar untuk admin hanya oleh pemilik.
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
    if not app.anggota_aktif(array['pemilik']) then
      raise exception 'Hanya pemilik yang bisa membuka usulan uang besar untuk admin' using errcode = '42501';
    end if;
    update public.usulan set untuk_peran = array['pemilik', 'admin'] where id = k.subjek_id and status = 'menunggu';
  end if;

  update public.keputusan set dibatalkan_at = now(), dibatalkan_oleh = (select auth.uid()), alasan_batal = btrim(p_alasan) where id = k.id;
  return jsonb_build_object('id', k.id, 'jenis', k.jenis, 'usulan', v_usulan);
end $$;

-- S4b: slip yang dilepas pemilik ditahan lagi bila komponennya berubah (pelepasan berlaku untuk angka yang dilihat pemilik).
create or replace function public.simpan_slip(p_periode uuid, p_orang uuid, p_komponen jsonb, p_peringatan text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); per public.periode_gaji; b bigint; pt bigint; tahan text; s public.slip_gaji;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  select * into per from public.periode_gaji where id = p_periode and perusahaan_id = v_pid;
  if per.id is null then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if per.status <> 'draf' then raise exception 'Periode ini sudah disetujui dan terkunci. Buat koreksi di periode berikutnya.' using errcode = '55000'; end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_komponen) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_komponen) k
        where coalesce(k ->> 'jenis', '') not in ('pendapatan', 'potongan', 'pemberi_kerja')
           or coalesce(k ->> 'kode', '') = '' or coalesce(k ->> 'label', '') = ''
           or jsonb_typeof(k -> 'nilai') <> 'number' or (k ->> 'nilai')::numeric < 0 or (k ->> 'nilai')::numeric <> trunc((k ->> 'nilai')::numeric)) then
    raise exception 'Komponen gaji tidak sah: setiap baris butuh kode, label, jenis, dan nilai rupiah bulat tidak negatif.' using errcode = '22023';
  end if;
  select coalesce(sum((k ->> 'nilai')::bigint) filter (where k ->> 'jenis' = 'pendapatan'), 0),
         coalesce(sum((k ->> 'nilai')::bigint) filter (where k ->> 'jenis' = 'potongan'), 0)
    into b, pt from jsonb_array_elements(p_komponen) k;
  select string_agg(g.alasan, ' ' order by g.kode) into tahan
    from public.gerbang_gaji((per.bulan + interval '1 month - 1 day')::date) g where g.orang_id = p_orang;
  insert into public.slip_gaji as s0 (perusahaan_id, periode_id, orang_id, komponen, bruto, potongan, neto, peringatan, ditahan, alasan_tahan)
  values (v_pid, p_periode, p_orang, p_komponen, b, pt, b - pt, coalesce(p_peringatan, '{}'), tahan is not null, tahan)
  on conflict (periode_id, orang_id) do update set komponen = excluded.komponen, bruto = excluded.bruto, potongan = excluded.potongan,
    neto = excluded.neto, peringatan = excluded.peringatan,
    ditahan = case when s0.dilepas_oleh is not null and s0.komponen = excluded.komponen then false else excluded.ditahan end,
    alasan_tahan = case when s0.dilepas_oleh is not null and s0.komponen = excluded.komponen then s0.alasan_tahan else excluded.alasan_tahan end,
    dilepas_oleh = case when s0.komponen = excluded.komponen then s0.dilepas_oleh end,
    diubah_at = now()
  returning * into s;
  return jsonb_build_object('id', s.id, 'bruto', s.bruto, 'potongan', s.potongan, 'neto', s.neto, 'ditahan', s.ditahan, 'alasan_tahan', s.alasan_tahan);
end $$;

-- S5: penanda demo (pengaturan.demo, demo_jangkar) hanya ditulis fungsi server; pengguna tidak bisa menandai usahanya sebagai demo.
create or replace function app.jaga_demo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (new.pengaturan -> 'demo' is distinct from old.pengaturan -> 'demo'
     or new.pengaturan -> 'demo_jangkar' is distinct from old.pengaturan -> 'demo_jangkar') then
    raise exception 'Penanda usaha demo hanya diatur Nadi' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger perusahaan_jaga_demo before update of pengaturan on public.perusahaan
  for each row execute function app.jaga_demo();
