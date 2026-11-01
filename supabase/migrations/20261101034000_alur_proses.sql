-- F6-03 Process mining: alur nyata vs alur kertas untuk invoice dan rekrut, disusun dari log kejadian (public.kejadian).
-- Setiap langkah dicatat trigger sebagai kejadian berkasus (data.kasus = id invoice/lamaran):
--   invoice.terbit, invoice.pengingat (data.tahap 1..4), invoice.lunas, invoice.batal;
--   rekrut.masuk, rekrut.ditinjau, rekrut.ditawari, rekrut.diterima, rekrut.ditolak.
-- Data lama diisi ulang dari kolom tabel (data.isi_ulang). app.alur_proses menyusun graf directly-follows (langkah, sisi + median
-- hari), varian jalur, dan penyimpangan dari alur kertas. Usaha demo mendapat log sintetis (sumber 'demo') yang ikut digeser
-- app.segarkan_demo karena hidup di tabel kejadian. Rancangan: docs/research/process-mining.md. Tes: supabase/tests/alur_proses.test.sql.

create or replace function app.kejadian_invoice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_waktu timestamptz;
begin
  if tg_op = 'INSERT' then
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (new.perusahaan_id, new.dibuat_at, 'invoice.terbit', 'nadi', new.total,
            jsonb_build_object('kasus', new.id, 'nomor', new.nomor, 'tempo_hari', new.jatuh_tempo - new.tanggal));
  elsif new.status is distinct from old.status and new.status in ('lunas', 'batal') then
    v_waktu := case when new.status = 'lunas' and new.lunas_tanggal < app.hari_ini(new.perusahaan_id)
                    then greatest(new.dibuat_at, (new.lunas_tanggal + time '12:00') at time zone app.zona(new.perusahaan_id))
                    else now() end;
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (new.perusahaan_id, v_waktu, 'invoice.' || new.status, 'nadi', new.total,
            jsonb_strip_nulls(jsonb_build_object('kasus', new.id, 'nomor', new.nomor, 'cara', new.lunas_cara, 'tanggal', new.lunas_tanggal)));
  end if;
  return null;
end $$;

create or replace function app.kejadian_pengingat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'dikirim' and old.status is distinct from 'dikirim' then
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data)
    values (new.perusahaan_id, coalesce(new.dikirim_at, now()), 'invoice.pengingat', 'nadi',
            jsonb_build_object('kasus', new.invoice_id, 'tahap', new.tahap));
  end if;
  return null;
end $$;

create or replace function app.kejadian_lamaran() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data)
    values (new.perusahaan_id, new.dibuat_at, 'rekrut.masuk', 'nadi', jsonb_build_object('kasus', new.id, 'lowongan', new.lowongan_id));
  elsif new.tahap is distinct from old.tahap then
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data)
    values (new.perusahaan_id, coalesce(new.tahap_at, now()), 'rekrut.' || new.tahap, 'nadi',
            jsonb_build_object('kasus', new.id, 'lowongan', new.lowongan_id));
  end if;
  return null;
end $$;

create trigger kejadian_invoice after insert or update of status on public.invoice
  for each row execute function app.kejadian_invoice();
create trigger kejadian_pengingat after update of status on public.pengingat_invoice
  for each row execute function app.kejadian_pengingat();
create trigger kejadian_lamaran after insert or update of tahap on public.lamaran
  for each row execute function app.kejadian_lamaran();

-- Isi ulang data lama (90 hari, sama dengan umur kejadian mentah) dari kolom tabel.
insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
select i.perusahaan_id, i.dibuat_at, 'invoice.terbit', 'nadi', i.total,
       jsonb_build_object('kasus', i.id, 'nomor', i.nomor, 'tempo_hari', i.jatuh_tempo - i.tanggal, 'isi_ulang', true)
  from public.invoice i where i.dibuat_at > now() - interval '90 days'
union all
select p.perusahaan_id, p.dikirim_at, 'invoice.pengingat', 'nadi', null,
       jsonb_build_object('kasus', p.invoice_id, 'tahap', p.tahap, 'isi_ulang', true)
  from public.pengingat_invoice p join public.invoice i on i.id = p.invoice_id
 where p.status = 'dikirim' and p.dikirim_at is not null and i.dibuat_at > now() - interval '90 days'
union all
select i.perusahaan_id,
       case when i.status = 'lunas' then greatest(i.dibuat_at, (i.lunas_tanggal + time '12:00') at time zone app.zona(i.perusahaan_id)) else i.batal_at end,
       'invoice.' || i.status, 'nadi', i.total,
       jsonb_strip_nulls(jsonb_build_object('kasus', i.id, 'nomor', i.nomor, 'cara', i.lunas_cara, 'tanggal', i.lunas_tanggal, 'isi_ulang', true))
  from public.invoice i
 where i.dibuat_at > now() - interval '90 days'
   and ((i.status = 'lunas' and i.lunas_tanggal is not null) or (i.status = 'batal' and i.batal_at is not null))
union all
select l.perusahaan_id, l.dibuat_at, 'rekrut.masuk', 'nadi', null,
       jsonb_build_object('kasus', l.id, 'lowongan', l.lowongan_id, 'isi_ulang', true)
  from public.lamaran l where l.dibuat_at > now() - interval '90 days'
union all
select l.perusahaan_id, greatest(l.dibuat_at, coalesce(l.tahap_at, l.dibuat_at)), 'rekrut.' || l.tahap, 'nadi', null,
       jsonb_build_object('kasus', l.id, 'lowongan', l.lowongan_id, 'isi_ulang', true)
  from public.lamaran l where l.dibuat_at > now() - interval '90 days' and l.tahap <> 'masuk';

-- Penyusun alur. Kasus dihitung hanya bila langkah awalnya (terbit/masuk) ada di jendela, supaya jejak tidak terpotong di depan.
create or replace function app.alur_proses(p_pid uuid, p_jenis text, p_hari int default 90) returns jsonb
language sql stable security definer set search_path = '' as $$
  with cfg as (
    select app.zona(p_pid) as zona, app.hari_ini(p_pid) as hari,
           case p_jenis when 'invoice' then array['invoice.terbit', 'invoice.pengingat', 'invoice.lunas', 'invoice.batal']
                        when 'rekrut' then array['rekrut.masuk', 'rekrut.ditinjau', 'rekrut.ditawari', 'rekrut.diterima', 'rekrut.ditolak'] end as jenis,
           case p_jenis when 'invoice' then array['lunas', 'batal'] else array['diterima', 'ditolak'] end as akhir),
  ev as (
    select k.id, k.data ->> 'kasus' as kasus, k.terjadi_at as waktu,
           case when k.jenis = 'invoice.pengingat' then 'pengingat_' || (k.data ->> 'tahap') else split_part(k.jenis, '.', 2) end as langkah,
           case when k.jenis in ('invoice.terbit', 'rekrut.masuk') then 0 when split_part(k.jenis, '.', 2) = any((select akhir from cfg)::text[]) then 2 else 1 end as peringkat,
           (k.data ->> 'tempo_hari')::int as tempo_hari
      from public.kejadian k
     where k.perusahaan_id = p_pid and k.jenis = any((select jenis from cfg)::text[]) and k.data ? 'kasus'
       and k.terjadi_at >= now() - make_interval(days => least(greatest(coalesce(p_hari, 90), 7), 90)) and k.terjadi_at <= now()),
  awal as (select kasus from ev where peringkat = 0 group by kasus),
  urut as (
    select e.*, row_number() over w as n, lead(e.langkah) over w as ke, lead(e.waktu) over w as ke_waktu
      from ev e join awal a using (kasus)
    window w as (partition by e.kasus order by e.waktu, e.peringkat, e.id)),
  jejak as (
    select kasus, array_agg(langkah order by n) as jalur,
           (min(waktu) filter (where peringkat = 0) at time zone (select zona from cfg))::date as mulai,
           (max(waktu) filter (where langkah = 'lunas') at time zone (select zona from cfg))::date as tgl_lunas,
           min(waktu) filter (where peringkat = 0) as mulai_at, max(waktu) as akhir_at,
           max(tempo_hari) as tempo
      from urut group by kasus),
  kasus as (
    select j.*, j.jalur[cardinality(j.jalur)] = any((select akhir from cfg)::text[]) as selesai,
           exists (select 1 from unnest(j.jalur) s where s like 'pengingat%') as ada_pengingat,
           j.mulai + j.tempo as jatuh_tempo
      from jejak j)
  select jsonb_build_object(
    'jenis', p_jenis,
    'hari', least(greatest(coalesce(p_hari, 90), 7), 90),
    'kasus', (select count(*) from kasus),
    'selesai', (select count(*) from kasus where selesai),
    'siklus_hari', (select round(percentile_cont(0.5) within group (order by extract(epoch from akhir_at - mulai_at) / 86400)::numeric, 1) from kasus where selesai),
    'kertas', case p_jenis when 'invoice' then '["terbit", "lunas"]'::jsonb else '["masuk", "ditinjau", "ditawari", "diterima"]'::jsonb end,
    'sesuai', (select count(*) from kasus where selesai and case p_jenis
                 when 'invoice' then jalur[cardinality(jalur)] = 'lunas' and (tempo is null or tgl_lunas <= jatuh_tempo)
                 else jalur in (array['masuk', 'ditinjau', 'ditawari', 'diterima'], array['masuk', 'ditinjau', 'ditolak'], array['masuk', 'ditinjau', 'ditawari', 'ditolak']) end),
    'langkah', coalesce((select jsonb_agg(jsonb_build_object('langkah', langkah, 'kasus', n) order by urutan, langkah)
                from (select langkah, count(distinct kasus) as n, min(peringkat) as urutan from urut group by langkah) s), '[]'::jsonb),
    'sisi', coalesce((select jsonb_agg(jsonb_build_object('dari', dari, 'ke', ke, 'jumlah', jumlah, 'median_hari', median_hari) order by jumlah desc, dari, ke)
                from (select langkah as dari, ke, count(*) as jumlah,
                             round(percentile_cont(0.5) within group (order by extract(epoch from ke_waktu - waktu) / 86400)::numeric, 1) as median_hari
                        from urut where ke is not null group by langkah, ke) s), '[]'::jsonb),
    'varian', coalesce((select jsonb_agg(jsonb_build_object('jalur', to_jsonb(jalur), 'jumlah', jumlah, 'selesai', selesai) order by jumlah desc, jalur)
                from (select jalur, count(*) as jumlah, bool_or(selesai) as selesai from kasus group by jalur order by count(*) desc, jalur limit 5) v), '[]'::jsonb),
    'penyimpangan', case p_jenis
      when 'invoice' then jsonb_build_array(
        jsonb_build_object('kode', 'lunas_terlambat', 'jumlah', (select count(*) from kasus where tgl_lunas > jatuh_tempo),
                           'dari', (select count(*) from kasus where tgl_lunas is not null and tempo is not null)),
        jsonb_build_object('kode', 'terlambat_tanpa_pengingat',
                           'jumlah', (select count(*) from kasus where not ada_pengingat and coalesce(tgl_lunas, (select hari from cfg)) > jatuh_tempo
                                        and not 'batal' = any(jalur)),
                           'dari', (select count(*) from kasus where coalesce(tgl_lunas, (select hari from cfg)) > jatuh_tempo and not 'batal' = any(jalur))),
        jsonb_build_object('kode', 'batal_setelah_pengingat', 'jumlah', (select count(*) from kasus where 'batal' = any(jalur) and ada_pengingat),
                           'dari', (select count(*) from kasus where 'batal' = any(jalur))))
      else jsonb_build_array(
        jsonb_build_object('kode', 'diterima_tanpa_tinjau', 'jumlah', (select count(*) from kasus where 'diterima' = any(jalur)
                             and not ('ditinjau' = any(jalur) or 'ditawari' = any(jalur))),
                           'dari', (select count(*) from kasus where 'diterima' = any(jalur))),
        jsonb_build_object('kode', 'ditolak_tanpa_tinjau', 'jumlah', (select count(*) from kasus where 'ditolak' = any(jalur) and not 'ditinjau' = any(jalur)),
                           'dari', (select count(*) from kasus where 'ditolak' = any(jalur))),
        jsonb_build_object('kode', 'menggantung', 'jumlah', (select count(*) from kasus where not selesai and akhir_at < now() - interval '14 days'),
                           'dari', (select count(*) from kasus where not selesai)))
      end)
$$;

create or replace function public.alur_proses(p_jenis text, p_hari int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat alur kerja' using errcode = '42501';
  end if;
  if p_jenis is null or p_jenis not in ('invoice', 'rekrut') then
    raise exception 'Jenis alur tidak dikenal.' using errcode = '22023';
  end if;
  return app.alur_proses(v_pid, p_jenis, p_hari);
end $$;

-- Log sintetis untuk dua usaha demo: 20 invoice dan 15 lamaran dengan pola yang sengaja beragam (sesuai kertas, terlambat,
-- tanpa pengingat, batal, langsung ditolak, menggantung, diterima tanpa ditinjau). Hanya langkah yang waktunya sudah lewat.
create or replace function app.isi_alur_demo() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; i int; v_t0 timestamptz; v_kasus uuid; v_n int := 0; v_langkah text[]; v_hari numeric[]; k int;
begin
  for p in select id from public.perusahaan where pengaturan ? 'demo' loop
    if exists (select 1 from public.kejadian where perusahaan_id = p.id and sumber = 'demo' and jenis in ('invoice.terbit', 'rekrut.masuk')) then continue; end if;
    for i in 1..20 loop
      v_t0 := date_trunc('day', now()) - interval '62 days' + i * interval '2 days 14 hours' + interval '2 hours';
      v_kasus := gen_random_uuid();
      case i % 5
        when 0, 1 then v_langkah := array['lunas']; v_hari := array[3 + i % 7];
        when 2 then v_langkah := array['pengingat_1', 'lunas']; v_hari := array[11, 13.2];
        when 3 then v_langkah := array['pengingat_1', 'pengingat_2', 'pengingat_3', 'lunas']; v_hari := array[11, 14, 17, 20.3];
        else if i in (4, 14) then v_langkah := array['lunas']; v_hari := array[25];
             else v_langkah := array['pengingat_1', 'pengingat_2', 'batal']; v_hari := array[11, 14, 20]; end if;
      end case;
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
      values (p.id, v_t0, 'invoice.terbit', 'demo', 250000 + (i * 137000) % 2000000,
              jsonb_build_object('kasus', v_kasus, 'nomor', lpad(i::text, 3, '0') || '/INV/CONTOH', 'tempo_hari', 14));
      v_n := v_n + 1;
      for k in 1..cardinality(v_langkah) loop
        exit when v_t0 + v_hari[k] * interval '1 day' > now();
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
        values (p.id, v_t0 + v_hari[k] * interval '1 day',
                case when v_langkah[k] like 'pengingat%' then 'invoice.pengingat' else 'invoice.' || v_langkah[k] end, 'demo',
                case when v_langkah[k] like 'pengingat%' then null else 250000 + (i * 137000) % 2000000 end,
                case when v_langkah[k] like 'pengingat%' then jsonb_build_object('kasus', v_kasus, 'tahap', split_part(v_langkah[k], '_', 2)::int)
                     else jsonb_build_object('kasus', v_kasus) end);
        v_n := v_n + 1;
      end loop;
    end loop;
    for i in 1..15 loop
      v_t0 := date_trunc('day', now()) - interval '50 days' + i * interval '3 days' + interval '3 hours';
      v_kasus := gen_random_uuid();
      case i % 5
        when 0 then v_langkah := array['ditinjau', 'ditawari', 'diterima']; v_hari := array[2, 5, 7];
        when 1 then v_langkah := array['ditinjau', 'ditolak']; v_hari := array[3, 4];
        when 2 then v_langkah := array['ditolak']; v_hari := array[1];
        when 3 then v_langkah := array['ditinjau']; v_hari := array[2];
        else v_langkah := array['diterima']; v_hari := array[1];
      end case;
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data)
      values (p.id, v_t0, 'rekrut.masuk', 'demo', jsonb_build_object('kasus', v_kasus));
      v_n := v_n + 1;
      for k in 1..cardinality(v_langkah) loop
        exit when v_t0 + v_hari[k] * interval '1 day' > now();
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, data)
        values (p.id, v_t0 + v_hari[k] * interval '1 day', 'rekrut.' || v_langkah[k], 'demo', jsonb_build_object('kasus', v_kasus));
        v_n := v_n + 1;
      end loop;
    end loop;
  end loop;
  return v_n;
end $$;

select app.isi_alur_demo();

-- Demo publik ikut menampilkan alur nyata (definisi lama + kunci 'alur').
create or replace function public.demo_lihat(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.perusahaan where pengaturan ->> 'demo' = p_kunci and p_kunci in ('fnb', 'toko'))
  select case when not exists (select 1 from p) then null else jsonb_build_object(
    'usaha', (select jsonb_build_object('nama', nama, 'industri', industri, 'zona_waktu', zona_waktu) from p),
    'usulan', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'judul', u.judul, 'penjelasan', u.penjelasan, 'sumber', u.sumber,
                'keyakinan', u.keyakinan, 'dampak_rp', u.dampak_rp, 'tenggat', u.tenggat, 'dibuat_at', u.dibuat_at)
                order by u.tenggat nulls last, u.dampak_rp desc nulls last, u.dibuat_at desc)
              from public.usulan u where u.perusahaan_id = (select id from p) and u.status = 'menunggu'), '[]'::jsonb),
    'orang', coalesce((select jsonb_agg(jsonb_build_object('nama', o.nama, 'id_staf', o.id_staf, 'jabatan', o.data ->> 'jabatan') order by o.id_staf)
              from public.orang o where o.perusahaan_id = (select id from p)), '[]'::jsonb),
    'belanja_7_hari', (select coalesce(sum(k.nilai), 0) from public.kejadian k
              where k.perusahaan_id = (select id from p) and k.jenis = 'uang.keluar' and k.terjadi_at > now() - interval '7 days'),
    'absen_kemarin', (select count(*) from public.kejadian k
              where k.perusahaan_id = (select id from p) and k.jenis = 'absen.harian'
                and k.terjadi_at >= date_trunc('day', now()) - interval '1 day' and k.terjadi_at < date_trunc('day', now())),
    'alur', jsonb_build_object('invoice', app.alur_proses((select id from p), 'invoice', 90),
                               'rekrut', app.alur_proses((select id from p), 'rekrut', 90)))
  end
$$;

revoke all on function app.kejadian_invoice(), app.kejadian_pengingat(), app.kejadian_lamaran(), app.isi_alur_demo() from public, anon, authenticated;
revoke all on function app.alur_proses(uuid, text, int) from public, anon, authenticated;
revoke all on function public.alur_proses(text, int) from public, anon;
grant execute on function public.alur_proses(text, int) to authenticated;
