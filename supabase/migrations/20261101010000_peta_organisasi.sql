-- F3-04 Peta Organisasi Nyata (rancangan docs/design/peta-organisasi.md). Organisasi di atas kertas (pakai_topi yang berlaku hari
-- ini) di samping organisasi sebenarnya (poin kerja selesai per orang per topi dalam p_minggu minggu terakhir), tanpa tabel baru
-- dan tanpa model AI: semua angka dan kalimat kepala dihitung di sini.
-- Jendela = 7 * p_minggu hari kalender di zona usaha (perusahaan.zona_waktu) sampai hari ini, batas tengah malam setempat;
-- bergulir, bukan minggu Senin, supaya "4 minggu terakhir" tidak menyusut jadi 3 minggu lebih sehari pada hari Senin.
-- Yang dihitung: kerja berstatus selesai dengan selesai_at di jendela, oleh orang aktif (karyawan/magang, sama dengan
-- app.kpi_orang); kerja batal, jalan, dan di luar jendela tidak. Kerja orang yang sudah nonaktif tidak ikut, jadi persen per topi
-- adalah bagian di antara orang yang tampil di peta. Lintas topi dibaca dari kerja.lintas_topi (ditandai saat kerja diberikan),
-- bukan dihitung ulang dari pakai_topi hari ini; garis lintas yang topinya kini sudah dipakai tidak lagi diberi tanda lintas.
-- Ambang jujur: topi dengan < 3 kerja selesai di jendela tanpa persen per topi; orang dengan < 3 kerja selesai tanpa persen dari
-- poinnya (dan tidak masuk kalimat kepala atau saran), karena 1 dari 2 kerja sudah 50%.
-- Alur serah: kerja yang dibuat di jendela (bukan batal) dari pemberi ke pelaksana. Pemberi = kerja.pemberi_id; bila kosong
-- (pemilik/admin tanpa data orang, kasus umum), pembuat dibaca dari kejadian kerja.buat (data.oleh) lalu perannya di anggota.
-- Saran pasang topi: garis lintas >= 30% poin orang itu, topinya belum dipakai. Tombol di layar membuat usulan orang.topi untuk
-- pemilik saja (bukan langsung memasang), idempoten dengan kunci dari browser karena experimental.useOffline bisa mengirim ulang
-- aksi (docs/research/idempotensi-aksi.md, pola banding_kpi). Himpunan {pemilik} tidak diantre ke rute model.
-- Pemeriksaan peran lewat app.peran_aktif() (tabel anggota, Q-21), bukan klaim JWT. putuskan_usulan ikut beralih ke
-- app.peran_aktif() untuk "usulan ini untuk peranku", sehingga admin yang dulu pemilik tidak memutuskan usulan khusus pemilik
-- dengan JWT lama.

-- "kasir", "kasir dan pelayan", "kasir, pelayan, dan gudang".
create or replace function app.gabung_teks(p text[]) returns text
language sql immutable set search_path = '' as $$
  select case coalesce(cardinality(p), 0)
    when 0 then null
    when 1 then p[1]
    when 2 then p[1] || ' dan ' || p[2]
    else array_to_string(p[1:cardinality(p) - 1], ', ') || ', dan ' || p[cardinality(p)] end
$$;

-- Nama topi di tengah kalimat: huruf pertama kecil, sisanya apa adanya ("Kasir" -> "kasir", "Admin HR" -> "admin HR").
create or replace function app.awal_kecil(p text) returns text
language sql immutable set search_path = '' as $$
  select lower(left(p, 1)) || substr(p, 2)
$$;

-- "6", "2,5" (angka poin tanpa satuan, sama dengan formatPoin di src/lib/kerja/poin.ts).
create or replace function app.teks_angka(p numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(trim_scale(coalesce(p, 0))::text, '.', ',')
$$;

-- Isi peta satu usaha. Tanpa pemeriksaan hak: hanya dipanggil fungsi security definer di bawah yang sudah memeriksa peran.
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
        (select format('%s mengerjakan %s%% urusan %s walau %s.', x.orang_nama, x.persen_lintas, app.awal_kecil(x.topi_nama),
                       coalesce('topinya ' || app.gabung_teks(x.kertas_nama), 'belum memakai topi apa pun')) from puncak x)
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

-- Pemilik, admin, akuntan (aktif menurut tabel anggota): peta organisasi usahanya.
create or replace function public.peta_organisasi(p_minggu integer default 4) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce(app.peran_aktif(), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang bisa melihat peta organisasi.' using errcode = '42501';
  end if;
  if p_minggu is null or p_minggu not between 1 and 26 then
    raise exception 'Pilih 1 sampai 26 minggu.' using errcode = '22023';
  end if;
  return app.peta_isi(v_pid, p_minggu);
end $$;

-- Pemilik/admin: usulkan memasang topi ke orang yang sudah mengerjakan urusannya (saran peta 4 minggu). Usulan untuk pemilik,
-- tidak langsung memasang. Kunci yang sama atau usulan menunggu untuk pasangan yang sama mengembalikan usulan yang sudah ada.
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
            format('%s mengerjakan %s%% urusan %s 4 minggu terakhir (%s dari %s poin kerjanya) walau %s. Setujui untuk memasang topi %s '
                   'ke %s mulai hari ini; topi lain tetap dipakai. Dihitung dari kerja yang ditandai Selesai di papan.',
                   s ->> 'orang_nama', s ->> 'persen', app.awal_kecil(s ->> 'topi_nama'), app.teks_angka((s ->> 'lintas_poin')::numeric),
                   app.teks_angka((s ->> 'orang_poin')::numeric),
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

-- putuskan_usulan: cabang orang.topi (disetujui = topi dipasang mulai hari ini dengan porsi = persen lintasnya, satu kejadian
-- orang.topi; topi lain tidak dilepas; bila orang/topi sudah tidak aktif atau topinya sudah terpasang, tidak ada yang dibuat) dan
-- app.peran_aktif() menggantikan app.prn(). Selebihnya sama persis dengan versi kpi.
create or replace function public.putuskan_usulan(p_usulan uuid, p_setuju boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usulan; iz public.pengajuan_izin; b jsonb; r jsonb; v_pid uuid := app.pid(); v_orang uuid; v_jalur text; n int := 0; lewat int := 0; v_nik text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa memutuskan usulan' using errcode = '42501';
  end if;
  select * into u from public.usulan where id = p_usulan and perusahaan_id = v_pid for update;
  if not found or not coalesce(app.peran_aktif() = any(u.untuk_peran), false) then
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
      when 'izin.setujui' then
        -- Pengajuan izin yang tidak lolos otopilot: disetujui manusia, dicatat sebagai kejadian izin.<jenis>.
        update public.pengajuan_izin set status = 'disetujui', oleh_otopilot = false, diputuskan_at = now(),
               alasan_putusan = 'Disetujui ' || case app.peran_aktif() when 'pemilik' then 'pemilik' else 'admin' end || '.'
         where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu'
        returning * into iz;
        if iz.id is not null then
          perform app.catat_izin(iz);
          n := 1;
        end if;
      when 'izin.sakit' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(b ->> 'mulai'), now()), 'izin.sakit', u.sumber,
                (select o.id from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(b ->> 'nama') limit 1),
                (b ->> 'lama_hari')::numeric, u.keyakinan, v_jalur, b);
        n := 1;
      when 'kpi.banding' then
        insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
        select v_pid, 'kpi.banding', 'pwa', k.pelaksana_id, k.id, jsonb_build_object('usulan_id', u.id, 'alasan', u.payload ->> 'alasan')
          from public.kerja k where k.perusahaan_id = v_pid and k.id::text = u.payload ->> 'kerja_id';
        get diagnostics n = row_count;
      when 'orang.topi' then
        -- Peta organisasi (F3-04): pasang topi yang sudah dikerjakan lintas topi.
        insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi)
        select v_pid, o.id, t.id, greatest(1, least(100, coalesce((u.payload ->> 'persen')::numeric, 100)))
          from public.orang o join public.topi t on t.perusahaan_id = v_pid and t.aktif and t.id::text = u.payload ->> 'topi_id'
         where o.perusahaan_id = v_pid and o.status = 'aktif' and o.id::text = u.payload ->> 'orang_id'
           and not exists (select 1 from public.pakai_topi pt
                            where pt.perusahaan_id = v_pid and pt.orang_id = o.id and pt.topi_id = t.id
                              and pt.mulai <= current_date and (pt.selesai is null or pt.selesai >= current_date));
        get diagnostics n = row_count;
        if n > 0 then
          insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, data)
          values (v_pid, 'orang.topi', 'pwa', (u.payload ->> 'orang_id')::uuid,
                  jsonb_build_object('usulan_id', u.id, 'topi_id', u.payload ->> 'topi_id', 'persen', u.payload -> 'persen'));
        end if;
      else
        -- uang.keluar, uang.tagihan, dokumen.*, berkas.tinjau: satu kejadian dengan bukti berkas.
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(coalesce(b ->> 'tanggal', b ->> 'periode' || '-01')), now()), u.aksi, u.sumber,
                u.dampak_rp, u.keyakinan, v_jalur, b);
        n := 1;
    end case;
  end if;

  if not p_setuju and u.aksi = 'izin.setujui' then
    update public.pengajuan_izin set status = 'ditolak', oleh_otopilot = false, diputuskan_at = now(),
           alasan_putusan = 'Belum disetujui. Bicarakan langsung dengan pemilik atau admin, atau ajukan ulang dengan tanggal lain.'
     where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu';
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

revoke all on function app.gabung_teks(text[]), app.awal_kecil(text), app.teks_angka(numeric), app.peta_isi(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.peta_organisasi(integer), public.usulkan_pasang_topi(uuid, uuid, uuid) from public, anon;
grant execute on function public.peta_organisasi(integer), public.usulkan_pasang_topi(uuid, uuid, uuid) to authenticated;
