-- F4-08 Ruang Akuntan dan ekspor BPMP (docs/research/coretax-bpmp.md). Identitas pemotong (NPWP 16 digit, ID TKU 22 digit)
-- di perusahaan.pengaturan -> 'identitas_pajak'; data_bpmp mengembalikan slip disetujui dan tidak ditahan satu bulan beserta
-- status PTKP dan posisi untuk disusun jadi template BPMP v.3 di server Next (apps/web/src/lib/pajak/bpmp.ts); NIK tidak ikut
-- karena Nadi hanya menyimpan hash dan 4 digit akhir. ruang_akuntan mendaftar semua usaha tempat pengguna menjadi anggota aktif
-- beserta ringkasan pekerjaan akuntan. Tes: supabase/tests/ruang_akuntan.test.sql.

create or replace function public.atur_identitas_pajak(p_npwp text, p_id_tku text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_npwp text := regexp_replace(coalesce(p_npwp, ''), '\D', '', 'g'); v_tku text := regexp_replace(coalesce(p_id_tku, ''), '\D', '', 'g');
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'akuntan') then
    raise exception 'Hanya pemilik atau akuntan yang mengatur identitas pajak' using errcode = '42501';
  end if;
  if v_npwp !~ '^\d{16}$' then raise exception 'NPWP pemotong 16 angka.' using errcode = '22023'; end if;
  if v_tku = '' then v_tku := v_npwp || '000000'; end if;
  if v_tku !~ '^\d{22}$' or left(v_tku, 16) <> v_npwp then
    raise exception 'ID TKU 22 angka dan diawali NPWP pemotong.' using errcode = '22023';
  end if;
  update public.perusahaan set pengaturan = jsonb_set(coalesce(pengaturan, '{}'::jsonb), '{identitas_pajak}', jsonb_build_object('npwp', v_npwp, 'id_tku', v_tku))
   where id = v_pid;
end $$;

create or replace function public.data_bpmp(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_bulan date := date_trunc('month', p_bulan)::date; pg public.periode_gaji;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang mengekspor bukti potong' using errcode = '42501';
  end if;
  select * into pg from public.periode_gaji where perusahaan_id = v_pid and bulan = v_bulan;
  return jsonb_build_object(
    'bulan', v_bulan,
    'status', pg.status,
    'identitas', (select p.pengaturan -> 'identitas_pajak' from public.perusahaan p where p.id = v_pid),
    'baris', case when pg.status = 'disetujui' then coalesce((
      select jsonb_agg(jsonb_build_object('orang_id', o.id, 'nama', o.nama, 'id_staf', o.id_staf, 'ptkp', r.gaji ->> 'ptkp', 'nik_akhir', r.nik_akhir,
               'posisi', coalesce((select t.nama from public.pakai_topi pt join public.topi t on t.id = pt.topi_id
                                    where pt.orang_id = o.id and pt.mulai <= (v_bulan + interval '1 month - 1 day')::date
                                      and (pt.selesai is null or pt.selesai >= v_bulan) order by pt.porsi desc nulls last, t.nama limit 1),
                                  nullif(o.data ->> 'jabatan', ''), 'Pegawai'),
               'komponen', s.komponen) order by o.nama)
        from public.slip_gaji s join public.orang o on o.id = s.orang_id left join public.orang_rahasia r on r.orang_id = o.id
       where s.periode_id = pg.id and not s.ditahan), '[]'::jsonb) else '[]'::jsonb end,
    'bulan_disetujui', coalesce((select jsonb_agg(x.bulan order by x.bulan desc) from public.periode_gaji x
                                  where x.perusahaan_id = v_pid and x.status = 'disetujui'), '[]'::jsonb));
end $$;

-- Semua usaha tempat pengguna anggota aktif, dengan ringkasan untuk akuntan. Tidak bergantung pada usaha aktif di JWT.
create or replace function public.ruang_akuntan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nama', p.nama, 'peran', a.peran, 'aktif_sekarang', p.id = app.pid(),
           'npwp_ada', (p.pengaturan -> 'identitas_pajak' ->> 'npwp') is not null,
           'gaji_terakhir', (select max(g.bulan) from public.periode_gaji g where g.perusahaan_id = p.id and g.status = 'disetujui'),
           'gaji_draf', (select count(*) from public.periode_gaji g where g.perusahaan_id = p.id and g.status = 'draf'),
           'invoice_terbuka', (select count(*) from public.invoice i where i.perusahaan_id = p.id and i.status = 'terbit'),
           'piutang', (select coalesce(sum(i.total), 0) from public.invoice i where i.perusahaan_id = p.id and i.status = 'terbit'))
         order by (a.peran = 'akuntan') desc, p.nama), '[]'::jsonb)
    from public.anggota a join public.perusahaan p on p.id = a.perusahaan_id
   where a.user_id = auth.uid() and a.aktif and a.peran in ('pemilik', 'admin', 'akuntan')
$$;

revoke all on function public.atur_identitas_pajak(text, text), public.data_bpmp(date), public.ruang_akuntan() from public, anon;
grant execute on function public.atur_identitas_pajak(text, text), public.data_bpmp(date), public.ruang_akuntan() to authenticated;
