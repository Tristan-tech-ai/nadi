-- F3-02 Pembagi kerja adil (docs/research/bagi-adil-algoritma.md, layar docs/design/bagi-adil.md).
-- Beban orang seminggu = poin estimasi (kerja.poin_beban, bukan durasi aktual) dari kerja selesai di minggu itu + kerja yang sedang
-- berjalan (jalan/tunggu). Antre = poin kerja yang sudah ditugaskan tetapi belum dimulai; tidak tampil sebagai beban, tetapi ikut
-- menentukan usulan pelaksana supaya usulan beruntun tidak menumpuk ke orang yang sama (setara dengan bagiAdil di
-- apps/web/src/lib/kerja/adil.ts yang menambah poin setiap kali menugaskan). Jam jadwal sementara 40 untuk semua orang karena
-- jadwal shift (F3-06) belum ada; layar mengatakannya. Minggu = 7 hari mulai p_mulai di zona usaha (bawaan: Senin minggu ini).
-- Usulan dihitung di SQL (satu RPC, satu sumber kebenaran untuk tes SQL dan layar); aturan pilihnya sama dengan
-- usulkanPelaksana di adil.ts: min (poin + antre + t) / jam, seri: paling lama tidak diberi kerja (belum pernah = paling lama),
-- lalu id. Kandidat wajib memakai topi kerja itu.

create or replace function app.awal_minggu(p_pid uuid, p_mulai date) returns date
language sql stable set search_path = '' as $$
  select coalesce(p_mulai, date_trunc('week', now() at time zone coalesce(p.zona_waktu, 'Asia/Makassar'))::date)
    from public.perusahaan p where p.id = p_pid
$$;

-- "6 poin", "2,5 poin" (sama dengan formatPoin di src/lib/kerja/poin.ts).
create or replace function app.teks_poin(p numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(trim_scale(coalesce(p, 0))::text, '.', ',') || ' poin'
$$;

-- Beban per orang aktif (karyawan/magang) di satu usaha untuk minggu yang dimulai p_mulai. Tanpa pemeriksaan hak: hanya dipanggil
-- fungsi security definer di bawah yang sudah memeriksa peran.
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
             where pt.perusahaan_id = p_pid and pt.mulai <= current_date and (pt.selesai is null or pt.selesai >= current_date)) x
     group by x.orang_id
  ),
  k as (
    select k.pelaksana_id, coalesce(k.poin_beban, 0) as poin, k.lintas_topi, k.dibuat_at, k.status,
           (k.status = 'selesai' and k.selesai_at >= w.mulai and k.selesai_at < w.akhir) as selesai_minggu,
           (k.status in ('jalan', 'tunggu') and coalesce(k.mulai_at, k.dibuat_at) < w.akhir) as berjalan
      from public.kerja k cross join w
     where k.perusahaan_id = p_pid and k.pelaksana_id is not null and k.status <> 'batal'
  )
  select o.id, o.nama, coalesce(t.ids, '{}'), coalesce(t.nama, '{}'),
         coalesce(sum(k.poin) filter (where k.selesai_minggu or k.berjalan), 0),
         coalesce(sum(k.poin) filter (where k.status = 'baru' and k.dibuat_at < (select akhir from w)), 0),
         40::numeric,
         coalesce(sum(k.poin) filter (where (k.selesai_minggu or k.berjalan) and k.lintas_topi), 0),
         (count(*) filter (where (k.selesai_minggu or k.berjalan) and k.lintas_topi))::integer,
         (count(*) filter (where k.selesai_minggu))::integer,
         max(k.dibuat_at)
    from o left join t on t.orang_id = o.id left join k on k.pelaksana_id = o.id
   group by o.id, o.nama, t.ids, t.nama
$$;

-- Pemilik/admin: beban semua orang aktif minggu ini, urut beban per jam terbesar. selesai_n = kerja selesai di usaha minggu ini
-- (layar membandingkan beban hanya bila >= 5).
create or replace function public.beban_minggu(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_mulai date; v_selesai integer; v_orang jsonb;
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.orang_id, 'nama', b.nama, 'topi', to_jsonb(b.topi_nama), 'poin', b.poin, 'antre', b.antre, 'jam', b.jam,
           'beban_per_jam', round(b.poin / b.jam, 4), 'lintas_poin', b.lintas_poin, 'lintas_n', b.lintas_n, 'selesai_n', b.selesai_n,
           'terakhir_diberi', b.terakhir_diberi)
         order by b.poin / b.jam desc, b.nama, b.orang_id), '[]'::jsonb)
    into v_orang
    from app.beban_orang(v_pid, v_mulai) b;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'jam_sama_rata', true, 'jam_bawaan', 40,
    'selesai_n', v_selesai, 'orang', v_orang);
end $$;

-- Staf (dan siapa pun yang punya data orang di usaha): bebannya sendiri dan rata-rata tim, tanpa nama atau angka rekan.
-- Rata-rata disembunyikan bila tim kurang dari 3 orang, karena dengan 2 orang rata-rata membuka beban rekan.
create or replace function public.beban_saya(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); v_mulai date; v_poin numeric; v_rata numeric; v_n integer;
begin
  if v_pid is null or not app.anggota_aktif() then
    raise exception 'Masuk ke usahamu dulu.' using errcode = '42501';
  end if;
  v_mulai := app.awal_minggu(v_pid, p_mulai);
  select max(b.poin) filter (where b.orang_id = v_saya), avg(b.poin), count(*)::integer into v_poin, v_rata, v_n
    from app.beban_orang(v_pid, v_mulai) b;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'poin', v_poin, 'n', v_n,
    'rata_rata', case when v_n >= 3 then round(v_rata, 1) end,
    'di_atas', v_n >= 3 and v_poin is not null and v_rata > 0 and v_poin > 1.5 * v_rata);
end $$;

-- Pemilik/admin: usulan pelaksana untuk kerja baru bertopi p_topi seberat p_poin (bawaan 1 poin, karena poin kerja baru baru
-- diperkirakan setelah disimpan; dengan jam yang sama untuk semua orang, besar poin tidak mengubah pilihan). null bila tidak ada
-- orang aktif yang memakai topi itu. Pemilik bebas memilih orang lain.
create or replace function public.usulan_pelaksana(p_topi uuid, p_poin numeric default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_topi text; v_t numeric := coalesce(p_poin, 1); v_n integer; v_mulai date;
  v_pilih jsonb; v_kedua jsonb; v_seri boolean; v_alasan text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa meminta usulan pelaksana.' using errcode = '42501';
  end if;
  if p_topi is null then
    raise exception 'Pilih topi dulu supaya Nadi bisa mengusulkan pelaksana.' using errcode = '22023';
  end if;
  select nama into v_topi from public.topi where id = p_topi and perusahaan_id = v_pid and aktif;
  if v_topi is null then raise exception 'Topi tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if v_t <= 0 or v_t > 99 then raise exception 'Poin 0,25 sampai 99.' using errcode = '22023'; end if;
  v_mulai := app.awal_minggu(v_pid, null);

  with c as (
    select row_number() over (order by (b.poin + b.antre + v_t) / b.jam, b.terakhir_diberi asc nulls first, b.orang_id) as urut,
           count(*) over () as n, b.orang_id, b.nama, b.poin, b.antre, b.jam, (b.poin + b.antre + v_t) / b.jam as sesudah
      from app.beban_orang(v_pid, v_mulai) b
     where p_topi = any(b.topi_id) and b.jam > 0
  )
  select (select to_jsonb(c) from c where urut = 1), (select to_jsonb(c) from c where urut = 2) into v_pilih, v_kedua;
  if v_pilih is null then return null; end if;
  v_n := (v_pilih ->> 'n')::integer;
  v_seri := v_kedua is not null and (v_kedua ->> 'sesudah')::numeric = (v_pilih ->> 'sesudah')::numeric;
  v_alasan := case
    when v_n = 1 then format('%s: satu-satunya yang memakai topi %s, %s minggu ini.', v_pilih ->> 'nama', lower(v_topi),
                             app.teks_poin((v_pilih ->> 'poin')::numeric))
    else format('%s: %s minggu ini%s, paling ringan di antara %s%s.', v_pilih ->> 'nama', app.teks_poin((v_pilih ->> 'poin')::numeric),
                case when (v_pilih ->> 'antre')::numeric > 0 then ' dan ' || app.teks_poin((v_pilih ->> 'antre')::numeric) || ' antre' else '' end,
                lower(v_topi), case when v_seri then '; sama ringan dengan ' || (v_kedua ->> 'nama') else '' end)
  end;
  return jsonb_build_object('orang_id', v_pilih -> 'orang_id', 'nama', v_pilih -> 'nama', 'poin', v_pilih -> 'poin',
    'antre', v_pilih -> 'antre', 'jam', v_pilih -> 'jam', 'kandidat', v_n, 'seri', v_seri, 'topi', v_topi, 'alasan', v_alasan);
end $$;

revoke all on function app.awal_minggu(uuid, date), app.teks_poin(numeric), app.beban_orang(uuid, date) from public, anon, authenticated;
revoke all on function public.beban_minggu(date), public.beban_saya(date), public.usulan_pelaksana(uuid, numeric) from public, anon;
grant execute on function public.beban_minggu(date), public.beban_saya(date), public.usulan_pelaksana(uuid, numeric) to authenticated;
