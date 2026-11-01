-- F3-06 x F3-02: jam beban dari jadwal shift (docs/design/bagi-adil.md: "jam jadwal dari shift F3-06 bila ada"). Selama usaha belum
-- punya shift aktif di minggu itu, semua orang tetap dianggap 40 jam (jam_sama_rata, layar mengatakannya). Begitu ada satu shift,
-- jam tiap orang = menit kerja shift aktifnya minggu itu / 60 (app.jam_jadwal: istirahat tidak dihitung, batal tidak dihitung);
-- orang tanpa shift minggu itu berjam 0: beban per jamnya null (bukan galat bagi nol) dan usulan_pelaksana sudah melewatinya
-- (syarat b.jam > 0). Tes: supabase/tests/beban_jadwal.test.sql.

create or replace function app.beban_orang(p_pid uuid, p_mulai date)
returns table (orang_id uuid, nama text, topi_id uuid[], topi_nama text[], poin numeric, antre numeric, jam numeric,
               lintas_poin numeric, lintas_n integer, selesai_n integer, terakhir_diberi timestamptz)
language sql stable set search_path = '' as $$
  with w as (
    select (p_mulai::timestamp at time zone coalesce(p.zona_waktu, 'Asia/Makassar')) as mulai,
           ((p_mulai + 7)::timestamp at time zone coalesce(p.zona_waktu, 'Asia/Makassar')) as akhir
      from public.perusahaan p where p.id = p_pid
  ),
  o as (
    select o.id, o.nama from public.orang o
     where o.perusahaan_id = p_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']
  ),
  t as (
    select x.orang_id, array_agg(x.topi_id order by x.nama, x.topi_id) as ids, array_agg(x.nama order by x.nama, x.topi_id) as nama
      from (select distinct pt.orang_id, tp.id as topi_id, tp.nama
              from public.pakai_topi pt join public.topi tp on tp.id = pt.topi_id and tp.aktif
             where pt.perusahaan_id = p_pid and pt.mulai <= app.hari_ini(p_pid) and (pt.selesai is null or pt.selesai >= app.hari_ini(p_pid))) x
     group by x.orang_id
  ),
  k as (
    select k.pelaksana_id, coalesce(k.poin_beban, 0) as poin, k.lintas_topi, k.dibuat_at, k.status,
           (k.status = 'selesai' and k.selesai_at >= w.mulai and k.selesai_at < w.akhir) as selesai_minggu,
           (k.status in ('jalan', 'tunggu') and coalesce(k.mulai_at, k.dibuat_at) < w.akhir) as berjalan
      from public.kerja k cross join w
     where k.perusahaan_id = p_pid and k.pelaksana_id is not null and k.status <> 'batal'
  ),
  j as (select jj.orang_id, jj.menit from app.jam_jadwal(p_pid, p_mulai) jj),
  ada as (select exists (select 1 from j) as ada)
  select o.id, o.nama, coalesce(t.ids, '{}'), coalesce(t.nama, '{}'),
         coalesce(sum(k.poin) filter (where k.selesai_minggu or k.berjalan), 0),
         coalesce(sum(k.poin) filter (where k.status = 'baru' and k.dibuat_at < (select akhir from w)), 0),
         case when (select ada from ada) then round(coalesce(max(j.menit), 0) / 60.0, 2) else 40::numeric end,
         coalesce(sum(k.poin) filter (where (k.selesai_minggu or k.berjalan) and k.lintas_topi), 0),
         (count(*) filter (where (k.selesai_minggu or k.berjalan) and k.lintas_topi))::integer,
         (count(*) filter (where k.selesai_minggu))::integer,
         max(k.dibuat_at)
    from o left join t on t.orang_id = o.id left join k on k.pelaksana_id = o.id left join j on j.orang_id = o.id
   group by o.id, o.nama, t.ids, t.nama
$$;

create or replace function public.beban_minggu(p_mulai date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_mulai date; v_selesai integer; v_orang jsonb; v_jadwal boolean;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa melihat beban semua orang.' using errcode = '42501';
  end if;
  v_mulai := app.awal_minggu(v_pid, p_mulai);
  select count(*) into v_selesai
    from public.kerja k cross join public.perusahaan p
   where p.id = v_pid and k.perusahaan_id = v_pid and k.status = 'selesai'
     and k.selesai_at >= (v_mulai::timestamp at time zone coalesce(p.zona_waktu, 'Asia/Makassar'))
     and k.selesai_at < ((v_mulai + 7)::timestamp at time zone coalesce(p.zona_waktu, 'Asia/Makassar'));
  v_jadwal := exists (select 1 from app.jam_jadwal(v_pid, v_mulai));
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.orang_id, 'nama', b.nama, 'topi', to_jsonb(b.topi_nama), 'poin', b.poin, 'antre', b.antre, 'jam', b.jam,
           'beban_per_jam', case when b.jam > 0 then round(b.poin / b.jam, 4) end, 'lintas_poin', b.lintas_poin, 'lintas_n', b.lintas_n,
           'selesai_n', b.selesai_n, 'terakhir_diberi', b.terakhir_diberi)
         order by case when b.jam > 0 then b.poin / b.jam end desc nulls last, b.nama, b.orang_id), '[]'::jsonb)
    into v_orang
    from app.beban_orang(v_pid, v_mulai) b;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'jam_sama_rata', not v_jadwal, 'jam_bawaan', 40,
    'selesai_n', v_selesai, 'orang', v_orang);
end $$;
