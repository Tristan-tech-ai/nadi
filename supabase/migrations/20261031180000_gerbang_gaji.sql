-- Gerbang Gaji (F1-04, docs/research/gerbang-gaji.md): enam sinyal pegawai siluman sebelum gaji disetujui.
-- Juga indeks FK token_kios.tempat_id (INFO advisor dari migrasi token_kios).

create index if not exists token_kios_tempat_id_idx on app.token_kios (tempat_id);

-- Nomor HP dinormalkan: hanya angka, awalan 0 menjadi 62. Kosong bila terlalu pendek.
create or replace function app.hp_normal(p text) returns text
language sql immutable set search_path = '' as $$
  select case when length(d) < 8 then null when d like '0%' then '62' || substr(d, 2) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.gerbang_gaji(p_tanggal date default null)
returns table (orang_id uuid, nama text, kode text, alasan text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_pid uuid := app.pid(); v_uid uuid := (select auth.uid()); v_tgl date := coalesce(p_tanggal, (now() at time zone 'Asia/Makassar')::date);
  v_pemilik boolean;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  v_pemilik := app.prn() = 'pemilik';
  return query
  with digaji as (
    select o.id, o.nama, o.telepon, o.user_id, o.data, o.dibuat_at, r.nik_hash, r.rekening_hash,
           coalesce((app.tanggal_aman(o.data ->> 'mulai') at time zone 'Asia/Makassar')::date, (o.dibuat_at at time zone 'Asia/Makassar')::date) as mulai
      from public.orang o join public.orang_rahasia r on r.orang_id = o.id
     where o.perusahaan_id = v_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']
       and coalesce((r.gaji ->> 'pokok')::numeric, 0) > 0
  ),
  temuan as (
    -- 1. Tanpa tanda hidup 30 hari (absen atau izin), kecuali yang baru mulai.
    select g.id, g.nama, 'tanpa_tanda_hidup'::text as kode,
           'Belum ada absen atau izin sejak ' || to_char(v_tgl - 30, 'FMDD') || ' ' || app.bulan_singkat(v_tgl - 30)
             || '. Pastikan orang ini masih bekerja sebelum gajinya dibayar.' as alasan
      from digaji g
     where g.mulai <= v_tgl - 30
       and not exists (select 1 from public.kejadian e where e.perusahaan_id = v_pid and e.orang_id = g.id
                         and (e.jenis like 'absen.%' or e.jenis like 'izin.%')
                         and e.terjadi_at >= ((v_tgl - 30)::timestamp at time zone 'Asia/Makassar')
                         and e.terjadi_at < ((v_tgl + 1)::timestamp at time zone 'Asia/Makassar'))
    union all
    -- 2-4. Rekening, HP, atau NIK sama dengan orang aktif lain.
    select g.id, g.nama, 'rekening_ganda',
           'Rekeningnya sama dengan ' || string_agg(h.nama, ', ' order by h.nama) || '. Satu rekening untuk dua gaji perlu dicek dulu.'
      from digaji g join digaji h on h.rekening_hash = g.rekening_hash and h.id <> g.id
     where g.rekening_hash is not null group by g.id, g.nama
    union all
    select g.id, g.nama, 'hp_ganda',
           'Nomor HP-nya sama dengan ' || string_agg(h.nama, ', ' order by h.nama) || '. Pastikan ini dua orang yang berbeda.'
      from digaji g join digaji h on app.hp_normal(h.telepon) = app.hp_normal(g.telepon) and h.id <> g.id
     where app.hp_normal(g.telepon) is not null group by g.id, g.nama
    union all
    select g.id, g.nama, 'nik_ganda',
           'NIK-nya sama dengan ' || string_agg(h.nama, ', ' order by h.nama) || '. Satu NIK hanya untuk satu orang.'
      from digaji g join digaji h on h.nik_hash = g.nik_hash and h.id <> g.id
     where g.nik_hash is not null group by g.id, g.nama
    union all
    -- 5. Kontrak sudah habis tetapi masih aktif.
    select g.id, g.nama, 'kontrak_habis',
           'Kontraknya selesai ' || to_char(k.selesai, 'FMDD') || ' ' || app.bulan_singkat(k.selesai) || ' ' || extract(year from k.selesai)
             || '. Perpanjang kontraknya, atau tandai orang ini sudah keluar.'
      from digaji g cross join lateral (select (app.tanggal_aman(g.data ->> 'kontrak_selesai') at time zone 'Asia/Makassar')::date as selesai) k
     where k.selesai < v_tgl
    union all
    -- 6. Pemisahan tugas: penyetuju bukan pemilik yang juga membuat/mengubah data orang ini, atau menyetujui gajinya sendiri.
    select g.id, g.nama, 'pemisahan_tugas',
           case when g.user_id = v_uid then 'Ini gajimu sendiri. Minta pemilik yang menyetujuinya.'
                else 'Data orang ini (atau rekening dan gajinya) kamu buat atau ubah dalam 35 hari terakhir. Minta pemilik memeriksa sebelum gaji disetujui.' end
      from digaji g
     where not v_pemilik
       and (g.user_id = v_uid
            or exists (select 1 from public.audit_log a where a.perusahaan_id = v_pid and a.baris_id = g.id
                         and a.tabel in ('orang', 'orang_rahasia') and a.user_id = v_uid
                         and a.terjadi_at >= ((v_tgl - 35)::timestamp at time zone 'Asia/Makassar')))
  )
  select t.id, t.nama, t.kode, t.alasan from temuan t order by t.nama, t.kode;
end $$;

revoke all on function public.gerbang_gaji(date) from public, anon;
grant execute on function public.gerbang_gaji(date) to authenticated;
