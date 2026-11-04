-- F3-07C langkah 3: Edge Function langkah-ilmu (JWT pemanggil) meminta konteks butir lalu menyimpan saran langkah model.
-- Hak di database: pemilik/admin usaha itu; transkrip wajib ada; paling banyak 3 panggilan model per butir per 24 jam; token
-- tercatat di pemakaian_ai (tugas langkah_ilmu, berkas = klip butir) walau langkahnya kemudian diedit pemilik.

create or replace function public.konteks_ilmu(p_butir uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); sb public.serah_butir; n int;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun langkah kerja.' using errcode = '42501';
  end if;
  select * into sb from public.serah_butir where id = p_butir and perusahaan_id = v_pid and jenis = 'ilmu';
  if sb.id is null then raise exception 'Butir ilmu tidak ditemukan.' using errcode = 'P0002'; end if;
  if coalesce(trim(sb.transkrip), '') = '' then raise exception 'Buat transkrip rekamannya dulu.' using errcode = '55000'; end if;
  select count(*) into n from public.pemakaian_ai
   where perusahaan_id = v_pid and tugas = 'langkah_ilmu' and berkas_id is not distinct from sb.berkas_id and dibuat_at > now() - interval '24 hours';
  if n >= 3 then raise exception 'Langkah butir ini sudah disusun 3 kali hari ini. Edit langkahnya langsung, atau coba lagi besok.' using errcode = '54000'; end if;
  return jsonb_build_object('id', sb.id, 'judul', sb.judul, 'transkrip', sb.transkrip);
end $$;
revoke all on function public.konteks_ilmu(uuid) from public, anon;
grant execute on function public.konteks_ilmu(uuid) to authenticated;

create or replace function public.simpan_langkah_model(p_butir uuid, p_langkah jsonb, p_pemakaian jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); sb public.serah_butir;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun langkah kerja.' using errcode = '42501';
  end if;
  select * into sb from public.serah_butir where id = p_butir and perusahaan_id = v_pid and jenis = 'ilmu';
  if sb.id is null then raise exception 'Butir ilmu tidak ditemukan.' using errcode = 'P0002'; end if;
  -- Token dicatat dulu: panggilan model sudah terjadi, apa pun hasil validasi langkahnya.
  insert into public.pemakaian_ai (perusahaan_id, berkas_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis)
  values (v_pid, sb.berkas_id, 'langkah_ilmu', coalesce(p_pemakaian ->> 'model', 'tidak diketahui'),
          coalesce((p_pemakaian ->> 'token_masuk')::int, 0), coalesce((p_pemakaian ->> 'token_keluar')::int, 0),
          coalesce((p_pemakaian ->> 'token_cache_baca')::int, 0), coalesce((p_pemakaian ->> 'token_cache_tulis')::int, 0));
  if p_langkah is not null then
    perform public.simpan_ilmu(p_butir, null, p_langkah, 'model');
  end if;
end $$;
revoke all on function public.simpan_langkah_model(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.simpan_langkah_model(uuid, jsonb, jsonb) to authenticated;
