-- Q-32 Batas usaha per akun: 20 usaha yang keanggotaan pembuatnya masih aktif (usaha yang diarsipkan dengan menonaktifkan
-- keanggotaan tidak menghabiskan batas, tanpa menghapus data), dengan plafon 50 usaha pernah dibuat per akun agar arsip
-- tidak menjadi jalan membuat usaha tanpa batas. Tes: supabase/tests/batas_usaha.test.sql.
create or replace function public.buat_perusahaan(p_nama text, p_industri text default null, p_bentuk text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Belum masuk' using errcode = '42501'; end if;
  if (select count(*) from public.perusahaan p where p.dibuat_oleh = auth.uid()
        and exists (select 1 from public.anggota a where a.perusahaan_id = p.id and a.user_id = auth.uid() and a.aktif)) >= 20 then
    raise exception 'Batas 20 perusahaan per akun' using errcode = '54000';
  end if;
  if (select count(*) from public.perusahaan where dibuat_oleh = auth.uid()) >= 50 then
    raise exception 'Batas 50 perusahaan pernah dibuat per akun' using errcode = '54000';
  end if;
  insert into public.perusahaan (nama, industri, bentuk_usaha, dibuat_oleh)
  values (trim(p_nama), p_industri, p_bentuk, auth.uid()) returning id into v_id;
  insert into public.anggota (perusahaan_id, user_id, peran) values (v_id, auth.uid(), 'pemilik');
  perform app.tulis_klaim(auth.uid(), v_id, 'pemilik');
  return v_id;
end $$;
