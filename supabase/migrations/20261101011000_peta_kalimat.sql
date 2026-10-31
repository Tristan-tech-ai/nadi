-- F3-04B: kalimat kepala dan penjelasan usulan peta salah arah. "Dewi mengerjakan 75% urusan kasir" terbaca sebagai 75% dari
-- semua kerja kasir, padahal angkanya adalah bagian kerja Dewi sendiri (bagian Dewi di topi kasir bisa jauh lebih kecil, mis. 46%).
-- Kalimat kini: "75% kerja Dewi 4 minggu terakhir adalah urusan kasir, walau topinya pelayan." Hanya teks yang berubah; isi lain
-- kedua fungsi sama persis dengan 20261101010000_peta_organisasi.sql.

create or replace function app.peta_isi(p_pid uuid, p_minggu integer) returns jsonb
language sql stable set search_path = '' as $$
  with w as (
    select p.zona_waktu as zona, (now() at time zone p.zona_waktu)::date as hari_ini
      from public.perusahaan p where p.id = p_pid
  ),
  b as (
    select w.zona, w.hari_ini, w.hari_ini - (7 * p_minggu - 1) as mulai_tgl,
           ((w.hari_ini - (7 * p_minggu - 1))::timestamp at time zone w.zona) as mulai,
           ((w.hari_ini + 1)::timestamp at time zone w.zona) as akhir
      from w
  ),
  o as (
    select o.id, o.nama, nullif(o.data ->> 'jabatan', '') as jabatan from public.orang o
     where o.perusahaan_id = p_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']
  ),
  -- Di atas kertas: topi aktif yang dipakai hari ini (zona usaha).
  kt as (
    select pt.orang_id, pt.topi_id, sum(pt.porsi) as porsi
      from public.pakai_topi pt
      join o on o.id = pt.orang_id
      join public.topi t on t.id = pt.topi_id and t.perusahaan_id = p_pid and t.aktif
      cross join b
     where pt.perusahaan_id = p_pid and pt.mulai <= b.hari_ini and (pt.selesai is null or pt.selesai >= b.hari_ini)
     group by pt.orang_id, pt.topi_id
  ),
  -- Sebenarnya: kerja selesai di jendela.
  k as (
    select k.id, k.pelaksana_id, k.topi_id, coalesce(k.poin_beban, 0) as poin, k.lintas_topi
      from public.kerja k join o on o.id = k.pelaksana_id cross join b
     where k.perusahaan_id = p_pid and k.status = 'selesai' and k.selesai_at >= b.mulai and k.selesai_at < b.akhir
  ),
  ko as (
    select o.id, o.nama, o.jabatan, count(k.id)::integer as n, coalesce(sum(k.poin), 0) as poin,
           coalesce(sum(k.poin) filter (where k.topi_id is null), 0) as tanpa_topi_poin
      from o left join k on k.pelaksana_id = o.id
     group by o.id, o.nama, o.jabatan
  ),
  ny as (
    select k.pelaksana_id as orang_id, k.topi_id, count(*)::integer as n, sum(k.poin) as poin,
           (count(*) filter (where k.lintas_topi))::integer as lintas_n, coalesce(sum(k.poin) filter (where k.lintas_topi), 0) as lintas_poin
      from k where k.topi_id is not null
     group by k.pelaksana_id, k.topi_id
  ),
  tp as (
    select t.id, t.nama, coalesce(x.n, 0) as n, coalesce(x.poin, 0) as poin
      from public.topi t
      left join (select ny.topi_id, sum(ny.n)::integer as n, sum(ny.poin) as poin from ny group by ny.topi_id) x on x.topi_id = t.id
     where t.perusahaan_id = p_pid and (x.topi_id is not null or exists (select 1 from kt where kt.topi_id = t.id))
  ),
  kn as (
    select kt.orang_id, array_agg(kt.topi_id order by t.nama, t.id) as ids, array_agg(app.awal_kecil(t.nama) order by t.nama, t.id) as nama
      from kt join public.topi t on t.id = kt.topi_id
     group by kt.orang_id
  ),
  ge as (
    select coalesce(ny.orang_id, kt.orang_id) as orang_id, coalesce(ny.topi_id, kt.topi_id) as topi_id,
           kt.porsi, kt.orang_id is not null as kertas,
           coalesce(ny.n, 0) as n, coalesce(ny.poin, 0) as poin, coalesce(ny.lintas_n, 0) as lintas_n, coalesce(ny.lintas_poin, 0) as lintas_poin
      from ny full join kt on kt.orang_id = ny.orang_id and kt.topi_id = ny.topi_id
  ),
  gp as (
    select ge.*, ko.nama as orang_nama, tp.nama as topi_nama, ko.poin as orang_poin, kn.nama as kertas_nama,
           ge.lintas_n > 0 and not ge.kertas as lintas,
           case when tp.n >= 3 and tp.poin > 0 then round(100 * ge.poin / tp.poin)::integer end as persen_topi,
           case when ko.n >= 3 and ko.poin > 0 then round(100 * ge.poin / ko.poin)::integer end as persen_orang,
           case when ko.n >= 3 and ko.poin > 0 and ge.lintas_poin > 0 and not ge.kertas
                then round(100 * ge.lintas_poin / ko.poin)::integer end as persen_lintas
      from ge join ko on ko.id = ge.orang_id join tp on tp.id = ge.topi_id left join kn on kn.orang_id = ge.orang_id
  ),
  puncak as (
    select gp.* from gp where gp.persen_lintas is not null
     order by gp.persen_lintas desc, gp.lintas_poin desc, gp.orang_nama, gp.topi_nama, gp.orang_id, gp.topi_id
     limit 1
  ),
  saran as (
    select gp.*,
           (select u.id from public.usulan u
             where u.perusahaan_id = p_pid and u.aksi = 'orang.topi' and u.status = 'menunggu'
               and u.payload ->> 'orang_id' = gp.orang_id::text and u.payload ->> 'topi_id' = gp.topi_id::text
             order by u.dibuat_at desc, u.id desc limit 1) as usulan_id
      from gp where gp.persen_lintas >= 30
  ),
  -- Alur serah.
  ks as (
    select k.id, k.pemberi_id, k.pelaksana_id, k.status
      from public.kerja k join o on o.id = k.pelaksana_id cross join b
     where k.perusahaan_id = p_pid and k.status <> 'batal' and k.dibuat_at >= b.mulai and k.dibuat_at < b.akhir
  ),
  pembuat as (
    select distinct on (j.kerja_id) j.kerja_id, a.orang_id, a.peran
      from public.kejadian j cross join b
      join public.anggota a on a.perusahaan_id = p_pid and a.user_id::text = j.data ->> 'oleh'
     where j.perusahaan_id = p_pid and j.jenis = 'kerja.buat' and j.terjadi_at >= b.mulai - interval '1 day' and j.kerja_id is not null
     order by j.kerja_id, j.terjadi_at
  ),
  sh as (
    select coalesce(ks.pemberi_id, pb.orang_id) as pemberi_id,
           case when coalesce(ks.pemberi_id, pb.orang_id) is null then pb.peran end as pemberi_peran,
           ks.pelaksana_id, ks.status
      from ks left join pembuat pb on pb.kerja_id = ks.id
  ),
  sa as (
    select sh.pemberi_id, sh.pemberi_peran, coalesce(po.nama, initcap(sh.pemberi_peran)) as pemberi_nama,
           sh.pelaksana_id, o.nama as pelaksana_nama, count(*)::integer as n, (count(*) filter (where sh.status = 'selesai'))::integer as selesai_n
      from sh join o on o.id = sh.pelaksana_id
      left join public.orang po on po.id = sh.pemberi_id and po.perusahaan_id = p_pid
     where (sh.pemberi_id is not null or sh.pemberi_peran is not null) and sh.pemberi_id is distinct from sh.pelaksana_id
     group by sh.pemberi_id, sh.pemberi_peran, po.nama, sh.pelaksana_id, o.nama
  )
  select jsonb_build_object(
    'mulai', b.mulai_tgl, 'akhir', b.hari_ini, 'zona', b.zona, 'minggu', p_minggu, 'ambang', 3,
    'selesai_n', (select count(*) from k), 'poin', (select coalesce(sum(k.poin), 0) from k),
    'kepala', case
      when not exists (select 1 from k) then
        format('Belum ada kerja selesai %s minggu terakhir. Peta muncul setelah kerja ditandai Selesai di papan.', p_minggu)
      when exists (select 1 from puncak) then
        (select format('%s%% kerja %s %s minggu terakhir adalah urusan %s, walau %s.', x.persen_lintas, x.orang_nama, p_minggu,
                       app.awal_kecil(x.topi_nama), coalesce('topinya ' || app.gabung_teks(x.kertas_nama), 'belum memakai topi apa pun')) from puncak x)
      when exists (select 1 from gp where gp.lintas) then
        format('Ada %s kerja lintas topi %s minggu terakhir, tetapi belum cukup kerja untuk dihitung persennya.',
               (select sum(gp.lintas_n) from gp where gp.lintas), p_minggu)
      else format('Kerja %s minggu terakhir sesuai topi di atas kertas.', p_minggu) end,
    'orang', (select coalesce(jsonb_agg(jsonb_build_object('id', ko.id, 'nama', ko.nama, 'jabatan', ko.jabatan, 'n', ko.n, 'poin', ko.poin,
                'cukup', ko.n >= 3, 'tanpa_topi_poin', ko.tanpa_topi_poin, 'topi_ids', coalesce(to_jsonb(kn.ids), '[]'))
                order by ko.nama, ko.id), '[]')
                from ko left join kn on kn.orang_id = ko.id where ko.n > 0 or kn.orang_id is not null),
    'topi', (select coalesce(jsonb_agg(jsonb_build_object('id', tp.id, 'nama', tp.nama, 'n', tp.n, 'poin', tp.poin, 'cukup', tp.n >= 3)
                order by tp.nama, tp.id), '[]') from tp),
    'garis', (select coalesce(jsonb_agg(jsonb_build_object('orang_id', gp.orang_id, 'topi_id', gp.topi_id, 'kertas', gp.kertas, 'porsi', gp.porsi,
                'n', gp.n, 'poin', gp.poin, 'lintas', gp.lintas, 'lintas_n', gp.lintas_n, 'lintas_poin', gp.lintas_poin,
                'persen_topi', gp.persen_topi, 'persen_orang', gp.persen_orang, 'persen_lintas', gp.persen_lintas)
                order by gp.orang_nama, gp.topi_nama, gp.orang_id, gp.topi_id), '[]') from gp),
    'saran', (select coalesce(jsonb_agg(jsonb_build_object('orang_id', s.orang_id, 'topi_id', s.topi_id, 'orang_nama', s.orang_nama,
                'topi_nama', s.topi_nama, 'persen', s.persen_lintas, 'lintas_poin', s.lintas_poin, 'orang_poin', s.orang_poin,
                'kertas_nama', app.gabung_teks(s.kertas_nama), 'usulan_id', s.usulan_id)
                order by s.persen_lintas desc, s.lintas_poin desc, s.orang_nama, s.topi_nama), '[]') from saran s),
    'serah', (select coalesce(jsonb_agg(jsonb_build_object('pemberi_id', sa.pemberi_id, 'pemberi_peran', sa.pemberi_peran,
                'pemberi_nama', sa.pemberi_nama, 'pelaksana_id', sa.pelaksana_id, 'pelaksana_nama', sa.pelaksana_nama,
                'n', sa.n, 'selesai_n', sa.selesai_n)
                order by sa.n desc, sa.pemberi_nama, sa.pelaksana_nama), '[]') from sa),
    'serah_tanpa_pemberi', (select count(*) from sh where sh.pemberi_id is null and sh.pemberi_peran is null),
    'tanpa_peta_n', (select count(*) from ko where ko.n = 0 and not exists (select 1 from kt where kt.orang_id = ko.id)))
    from b
$$;

create or replace function public.usulkan_pasang_topi(p_orang uuid, p_topi uuid, p_kunci uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s jsonb; u public.usulan;
begin
  if v_pid is null or coalesce(app.peran_aktif(), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang bisa mengusulkan topi.' using errcode = '42501';
  end if;
  if p_kunci is not null then
    select * into u from public.usulan where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if u.id is not null then
      if u.aksi is distinct from 'orang.topi' or u.payload ->> 'orang_id' is distinct from p_orang::text
         or u.payload ->> 'topi_id' is distinct from p_topi::text then
        raise exception 'Kiriman ini bentrok dengan kiriman lain. Muat ulang halaman, lalu coba lagi.' using errcode = '22023';
      end if;
      return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', true);
    end if;
  end if;
  select x into s from jsonb_array_elements(app.peta_isi(v_pid, 4) -> 'saran') x
   where x ->> 'orang_id' = p_orang::text and x ->> 'topi_id' = p_topi::text;
  if s is null then
    raise exception 'Belum ada dasar untuk usulan ini: topinya sudah dipakai, atau kerja lintas topinya di bawah 30%% poin orang itu 4 minggu terakhir.'
      using errcode = '22023';
  end if;
  if s ->> 'usulan_id' is not null then
    return jsonb_build_object('id', s ->> 'usulan_id', 'status', 'menunggu', 'sudah', true);
  end if;
  begin
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
    values (v_pid, 'peta', 'orang.topi', format('Pasang topi %s ke %s', app.awal_kecil(s ->> 'topi_nama'), s ->> 'orang_nama'),
            format('%s%% kerja %s 4 minggu terakhir (%s dari %s poin) adalah urusan %s, walau %s. Setujui untuk memasang topi %s '
                   'ke %s mulai hari ini; topi lain tetap dipakai. Dihitung dari kerja yang ditandai Selesai di papan.',
                   s ->> 'persen', s ->> 'orang_nama', app.teks_angka((s ->> 'lintas_poin')::numeric),
                   app.teks_angka((s ->> 'orang_poin')::numeric), app.awal_kecil(s ->> 'topi_nama'),
                   coalesce('topinya ' || (s ->> 'kertas_nama'), 'belum memakai topi apa pun'), s ->> 'topi_nama', s ->> 'orang_nama'),
            jsonb_build_object('orang_id', p_orang, 'topi_id', p_topi, 'persen', (s ->> 'persen')::integer, 'minggu', 4),
            array['pemilik'], p_kunci)
    returning * into u;
  exception when unique_violation then
    -- Dua kiriman berkunci sama bersamaan: yang kalah mengembalikan usulan milik yang menang.
    select * into u from public.usulan where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if u.aksi is distinct from 'orang.topi' or u.payload ->> 'orang_id' is distinct from p_orang::text
       or u.payload ->> 'topi_id' is distinct from p_topi::text then
      raise exception 'Kiriman ini bentrok dengan kiriman lain. Muat ulang halaman, lalu coba lagi.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', true);
  end;
  return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', false);
end $$;
