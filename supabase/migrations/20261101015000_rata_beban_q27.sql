-- Q-27 (docs/design/rata-rata-beban.md, docs/quality/rencana-uji-q27.md): rata-rata beban tim di layar staf tidak menyesatkan.
-- Sebelumnya rata-rata dihitung dari semua orang aktif di app.beban_orang, termasuk yang tidak diberi kerja apa pun minggu itu,
-- sehingga di tim yang jarang memakai papan kerja rata-rata dibulatkan 0 dan satu kerja kecil sudah "di atas rata-rata".
-- 1. Kelompok pembanding = orang yang memakai papan kerja minggu itu: poin > 0, antre > 0, atau selesai_n > 0.
-- 2. rata_rata (1 desimal) hanya tampil bila kelompok minimal 3 orang; n dan n_kelompok = ukuran kelompok itu.
-- 3. di_atas = kelompok >= 3, poin > 1,5 x rata-rata, DAN selisih minimal 4 poin (1 jam). Perbandingan memakai rata-rata
--    sebelum dibulatkan.
-- 4. Poin saya tetap dibaca dari semua baris, jadi orang tanpa kerja melihat 0 poin (bukan null).
-- Diubah dari definisi hidup (pg_get_functiondef); tanda tangan, security definer, search_path kosong, dan hak execute tetap.

create or replace function public.beban_saya(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); v_mulai date; v_poin numeric; v_rata numeric; v_n integer;
begin
  if v_pid is null or not app.anggota_aktif() then
    raise exception 'Masuk ke usahamu dulu.' using errcode = '42501';
  end if;
  v_mulai := app.awal_minggu(v_pid, p_mulai);
  select max(b.poin) filter (where b.orang_id = v_saya),
         avg(b.poin) filter (where b.poin > 0 or b.antre > 0 or b.selesai_n > 0),
         (count(*) filter (where b.poin > 0 or b.antre > 0 or b.selesai_n > 0))::integer
    into v_poin, v_rata, v_n
    from app.beban_orang(v_pid, v_mulai) b;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'poin', v_poin, 'n', v_n, 'n_kelompok', v_n,
    'rata_rata', case when v_n >= 3 then round(v_rata, 1) end,
    'di_atas', v_n >= 3 and v_poin is not null and v_rata > 0 and v_poin > 1.5 * v_rata and v_poin - v_rata >= 4);
end $$;

comment on function public.beban_saya(date) is
  'Q-27: beban staf minggu ini dan rata-rata kelompok yang memakai papan kerja (poin, antre, atau selesai > 0); rata-rata tampil bila kelompok >= 3; di_atas butuh > 1,5x rata-rata dan selisih >= 4 poin.';

revoke all on function public.beban_saya(date) from public, anon;
grant execute on function public.beban_saya(date) to authenticated;
