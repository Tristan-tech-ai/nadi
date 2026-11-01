-- F5-03 Analis Malam + Sarapan Data. Tiap malam app.susun_insight() menghitung kandidat insight berdampak rupiah per usaha
-- dengan aturan pasti (tanpa model): tagihan lewat jatuh tempo, belanja minggu ini naik, pengingat tagihan yang jatuh tempo
-- sebentar lagi. Hanya yang dampaknya >= ambang (pengaturan.ambang_insight, bawaan Rp250.000) dan paling banyak 3 per hari;
-- tidak ada yang penting = tidak ada baris dan tidak ada pemberitahuan. Teks aturan selalu ada; Analis Malam (Edge Function
-- analis-malam lewat Message Batches API) hanya boleh memperhalus kalimat dan disimpan sebagai teks_model bila semua angka
-- rupiahnya sama persis dengan teks aturan. Pagi hari app.kirim_sarapan() mengirim Web Push ke pemilik/admin.
-- Tes: supabase/tests/sarapan_data.test.sql.

create table public.insight_pagi (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tanggal date not null,
  urutan smallint not null check (urutan between 1 and 3),
  kode text not null,
  dampak_rp bigint not null check (dampak_rp > 0),
  fakta jsonb not null default '{}'::jsonb,
  teks text not null check (char_length(teks) between 1 and 300),
  teks_model text check (teks_model is null or char_length(teks_model) between 1 and 300),
  dikirim_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, tanggal, urutan)
);
alter table public.insight_pagi enable row level security;
create policy insight_pagi_baca on public.insight_pagi for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.insight_pagi to authenticated;

create table app.analis_batch (
  batch_id text primary key,
  dibuat_at timestamptz not null default now(),
  jumlah int not null default 0,
  status text not null default 'jalan' check (status in ('jalan', 'selesai', 'gagal')),
  selesai_at timestamptz,
  catatan text
);

-- Kandidat insight satu usaha (belum disaring ambang). Fakta hanya angka dan nama pemasok, tanpa nama orang.
create or replace function app.kandidat_insight(p_pid uuid) returns table(kode text, dampak_rp bigint, fakta jsonb, teks text)
language sql stable security definer set search_path = '' as $$
  with cfg as (select app.zona(p_pid) as zona, app.hari_ini(p_pid) as hari),
  inv as (
    select k.data ->> 'kasus' as kasus,
           max(k.nilai) filter (where k.jenis = 'invoice.terbit') as nilai,
           max((k.data ->> 'tempo_hari')::int) filter (where k.jenis = 'invoice.terbit') as tempo,
           (min(k.terjadi_at) filter (where k.jenis = 'invoice.terbit') at time zone (select zona from cfg))::date as terbit,
           bool_or(k.jenis in ('invoice.lunas', 'invoice.batal')) as tutup
      from public.kejadian k
     where k.perusahaan_id = p_pid and k.jenis in ('invoice.terbit', 'invoice.lunas', 'invoice.batal')
       and k.terjadi_at > now() - interval '90 days' and k.data ? 'kasus'
     group by k.data ->> 'kasus'),
  telat as (
    select count(*) as n, sum(nilai)::bigint as total, max((select hari from cfg) - (terbit + tempo)) as hari_telat
      from inv where not tutup and nilai > 0 and tempo is not null and terbit is not null and terbit + tempo < (select hari from cfg)),
  belanja as (
    select coalesce(sum(nilai) filter (where terjadi_at > now() - interval '7 days'), 0)::bigint as s7,
           coalesce(sum(nilai) filter (where terjadi_at <= now() - interval '7 days' and terjadi_at > now() - interval '35 days'), 0)::bigint / 4 as rata
      from public.kejadian where perusahaan_id = p_pid and jenis = 'uang.keluar' and terjadi_at > now() - interval '35 days'),
  pemasok as (
    select data ->> 'pemasok' as nama, sum(nilai)::bigint as total from public.kejadian
     where perusahaan_id = p_pid and jenis = 'uang.keluar' and terjadi_at > now() - interval '7 days' and coalesce(data ->> 'pemasok', '') <> ''
     group by 1 order by 2 desc, 1 limit 1),
  segera as (
    select count(distinct i.id) as n, sum(distinct_total)::bigint as total from (
      select i.id, i.total as distinct_total from public.pengingat_invoice p join public.invoice i on i.id = p.invoice_id
       where p.perusahaan_id = p_pid and p.status = 'jadwal' and p.tanggal <= (select hari from cfg)
         and i.status = 'terbit' and i.jatuh_tempo >= (select hari from cfg)
       group by i.id, i.total) i)
  select 'tagihan_lewat_tempo', t.total, jsonb_build_object('jumlah', t.n, 'total', t.total, 'hari_telat', t.hari_telat),
         'Tagih ' || t.n || ' invoice yang lewat jatuh tempo, totalnya ' || app.rupiah(t.total) || '. Yang paling lama sudah telat '
           || t.hari_telat || ' hari.'
    from telat t where t.n > 0
  union all
  select 'belanja_naik', b.s7 - b.rata, jsonb_build_object('minggu_ini', b.s7, 'rata_mingguan', b.rata, 'selisih', b.s7 - b.rata,
           'pemasok', p.nama, 'pemasok_total', p.total),
         'Belanja 7 hari terakhir ' || app.rupiah(b.s7) || ', naik ' || app.rupiah(b.s7 - b.rata) || ' dari rata-rata mingguan bulan lalu ('
           || app.rupiah(b.rata) || ').' || coalesce(' Nota terbesar dari ' || p.nama || ': ' || app.rupiah(p.total) || '.', '')
    from belanja b left join pemasok p on true
   where b.rata > 0 and b.s7 * 10 >= b.rata * 12
  union all
  select 'pengingat_tagihan', s.total, jsonb_build_object('jumlah', s.n, 'total', s.total),
         'Kirim ' || s.n || ' pengingat tagihan yang jatuh tempo dalam 3 hari, totalnya ' || app.rupiah(s.total) || '.'
    from segera s where s.n > 0
$$;

-- Susun insight hari ini untuk setiap usaha yang dipakai (punya anggota aktif) dan usaha demo. Idempoten per tanggal.
create or replace function app.susun_insight() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; v_n int := 0; v_ambang bigint; v_hari date; k int;
begin
  for p in select pr.id, pr.pengaturan from public.perusahaan pr
            where pr.pengaturan ? 'demo' or exists (select 1 from public.anggota a where a.perusahaan_id = pr.id and a.aktif) loop
    v_hari := app.hari_ini(p.id);
    if exists (select 1 from public.insight_pagi where perusahaan_id = p.id and tanggal = v_hari) then continue; end if;
    v_ambang := coalesce(nullif(p.pengaturan ->> 'ambang_insight', '')::bigint, 250000);
    insert into public.insight_pagi (perusahaan_id, tanggal, urutan, kode, dampak_rp, fakta, teks)
    select p.id, v_hari, row_number() over (order by c.dampak_rp desc, c.kode), c.kode, c.dampak_rp, c.fakta, c.teks
      from app.kandidat_insight(p.id) c where c.dampak_rp >= v_ambang
     order by c.dampak_rp desc, c.kode limit 3;
    get diagnostics k = row_count;
    v_n := v_n + k;
  end loop;
  return v_n;
end $$;

-- Sarapan Data untuk layar pemilik/admin: insight hari ini (atau kemarin bila malam ini belum disusun).
create or replace function public.sarapan_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_tgl date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat Sarapan Data' using errcode = '42501';
  end if;
  select max(tanggal) into v_tgl from public.insight_pagi where perusahaan_id = v_pid and tanggal >= app.hari_ini(v_pid) - 1;
  return jsonb_build_object('tanggal', v_tgl, 'insight', coalesce((select jsonb_agg(jsonb_build_object(
      'kode', i.kode, 'dampak_rp', i.dampak_rp, 'teks', coalesce(i.teks_model, i.teks), 'dari_model', i.teks_model is not null) order by i.urutan)
    from public.insight_pagi i where i.perusahaan_id = v_pid and i.tanggal = v_tgl), '[]'::jsonb));
end $$;

-- Bahan dan simpanan Analis Malam (hanya Edge Function dengan peran layanan).
create or replace function public.analis_bahan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'perusahaan_id', perusahaan_id, 'kode', kode, 'fakta', fakta, 'teks', teks)
           order by perusahaan_id, urutan), '[]'::jsonb)
    from public.insight_pagi where teks_model is null and tanggal >= current_date - 1
$$;

create or replace function public.analis_simpan(p_hasil jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare k int;
begin
  update public.insight_pagi i set teks_model = h.teks
    from jsonb_to_recordset(coalesce(p_hasil, '[]'::jsonb)) as h(id uuid, teks text)
   where i.id = h.id and i.teks_model is null and char_length(coalesce(h.teks, '')) between 1 and 300;
  get diagnostics k = row_count;
  return k;
end $$;

create or replace function public.analis_batch_catat(p_batch text, p_jumlah int, p_status text default 'jalan', p_catatan text default null) returns void
language sql security definer set search_path = '' as $$
  insert into app.analis_batch (batch_id, jumlah, status, catatan, selesai_at)
  values (p_batch, coalesce(p_jumlah, 0), p_status, p_catatan, case when p_status <> 'jalan' then now() end)
  on conflict (batch_id) do update set status = excluded.status, catatan = coalesce(excluded.catatan, app.analis_batch.catatan),
    selesai_at = case when excluded.status <> 'jalan' then now() end
$$;

create or replace function public.analis_batch_jalan() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(batch_id order by dibuat_at), '{}') from app.analis_batch where status = 'jalan' and dibuat_at > now() - interval '2 days'
$$;

-- Panggil Edge Function analis-malam dari pg_cron (token yang sama dengan push, dari Vault).
create or replace function app.panggil_analis(p_aksi text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
  if v_token is null then return; end if;
  perform net.http_post(
    url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/analis-malam',
    body := jsonb_build_object('aksi', p_aksi),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
    timeout_milliseconds := 30000);
end $$;

-- Sarapan Data: satu pemberitahuan per usaha berisi insight teratas, hanya bila ada insight hari ini.
create or replace function app.kirim_sarapan() returns int
language plpgsql security definer set search_path = '' as $$
declare v_token text; r record; k int := 0;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
  if v_token is null then return 0; end if;
  for r in
    select i.perusahaan_id, count(*) as n, (array_agg(coalesce(i.teks_model, i.teks) order by i.urutan))[1] as teratas, array_agg(i.id) as ids
      from public.insight_pagi i join public.perusahaan p on p.id = i.perusahaan_id
     where i.tanggal = app.hari_ini(i.perusahaan_id) and i.dikirim_at is null and not (p.pengaturan ? 'demo')
     group by i.perusahaan_id
  loop
    perform net.http_post(
      url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/push',
      body := jsonb_build_object('aksi', 'sarapan', 'perusahaan_id', r.perusahaan_id,
                'judul', case when r.n > 1 then 'Sarapan data: ' || r.n || ' hal berdampak rupiah' else 'Sarapan data: 1 hal berdampak rupiah' end,
                'isi', r.teratas),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
      timeout_milliseconds := 10000);
    update public.insight_pagi set dikirim_at = now() where id = any(r.ids);
    k := k + 1;
  end loop;
  return k;
end $$;

-- Riwayat belanja demo (4 minggu sebelumnya, lebih rendah dari minggu ini) supaya Sarapan Data demo punya pembanding.
create or replace function app.isi_belanja_demo() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; w int; v_n int := 0; v_dasar bigint;
begin
  for p in select id, pengaturan ->> 'demo' as jenis from public.perusahaan where pengaturan ? 'demo' loop
    if exists (select 1 from public.kejadian where perusahaan_id = p.id and jenis = 'uang.keluar' and data ? 'riwayat_demo') then continue; end if;
    v_dasar := case p.jenis when 'toko' then 12400000 else 1650000 end;
    for w in 1..4 loop
      insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
      values (p.id, date_trunc('day', now()) - (w * 7 + 2) * interval '1 day' + interval '9 hours', 'uang.keluar', 'demo',
              v_dasar + (w * 37000) % 150000,
              jsonb_build_object('pemasok', case p.jenis when 'toko' then 'PT Sumber Pangan Lestari' else 'Pasar Badung' end, 'riwayat_demo', true));
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

select app.isi_belanja_demo();
select app.susun_insight();

-- Demo publik: Sarapan Data terbaru (definisi demo_lihat sebelumnya + kunci 'sarapan').
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
                               'rekrut', app.alur_proses((select id from p), 'rekrut', 90)),
    'sarapan', (select jsonb_build_object('tanggal', max(i.tanggal), 'insight', coalesce(jsonb_agg(jsonb_build_object(
                  'kode', i.kode, 'dampak_rp', i.dampak_rp, 'teks', coalesce(i.teks_model, i.teks), 'dari_model', i.teks_model is not null)
                  order by i.urutan), '[]'::jsonb))
                  from public.insight_pagi i where i.perusahaan_id = (select id from p)
                   and i.tanggal = (select max(tanggal) from public.insight_pagi where perusahaan_id = (select id from p))))
  end
$$;

select cron.schedule('nadi-sarapan-susun', '40 17 * * *', 'select app.susun_insight()');
select cron.schedule('nadi-analis-kirim', '50 17 * * *', $$select app.panggil_analis('kirim')$$);
select cron.schedule('nadi-analis-ambil', '*/20 18-22 * * *', $$select app.panggil_analis('ambil')$$);
select cron.schedule('nadi-sarapan-push', '0 23 * * *', 'select app.kirim_sarapan()');

revoke all on function app.kandidat_insight(uuid), app.susun_insight(), app.panggil_analis(text), app.kirim_sarapan(), app.isi_belanja_demo()
  from public, anon, authenticated;
revoke all on function public.analis_bahan(), public.analis_simpan(jsonb), public.analis_batch_catat(text, int, text, text), public.analis_batch_jalan()
  from public, anon, authenticated;
grant execute on function public.analis_bahan(), public.analis_simpan(jsonb), public.analis_batch_catat(text, int, text, text), public.analis_batch_jalan()
  to service_role;
revoke all on function public.sarapan_data() from public, anon;
grant execute on function public.sarapan_data() to authenticated;
