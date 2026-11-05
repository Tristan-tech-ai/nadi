-- M-15 CRM (docs/research/mekari/rencana.md; menutup QO-06..QO-09, TA-18 sebagian; tes supabase/tests/crm.test.sql):
--   - customer: pelanggan orang atau perusahaan (kontak orang bisa menempel ke perusahaannya), segmen isian;
--   - deal: peluang bertahap prospek > kualifikasi > penawaran > negosiasi > menang/kalah, dipegang satu sales (orang);
--     deal_to_quote membuat penawaran M-03 (public.buat_dokumen_jual) dari deal; saat penawaran itu dijadikan pesanan, deal menang sendiri;
--   - deal_activity: catatan, tugas berjatuh tempo, kunjungan lapangan. Lokasi kunjungan hanya disimpan bila sales sendiri mengizinkan di
--     perangkatnya (UU 27/2022 Pasal 20 ayat (2) huruf a: persetujuan); tujuan dicatat, tidak ada pelacakan terus-menerus;
--   - sales_target per orang per bulan; sales_report (corong per tahap, menang, tingkat menang, target, kunjungan);
--   - customer_segments: segmen otomatis dari invoice 365 hari (baru, setia, besar, tidur) dicocokkan dengan nama pelanggan.
-- Pengelola (pemilik/admin) mengatur semuanya; staf yang menjadi sales hanya melihat dan menambah aktivitas pada deal miliknya.

create table public.customer (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null default 'perusahaan' check (jenis in ('orang', 'perusahaan')),
  nama text not null check (length(btrim(nama)) between 2 and 100),
  induk_id uuid,
  hp text check (hp is null or hp ~ '^62[0-9]{8,13}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kota text check (kota is null or length(kota) <= 60),
  segmen text check (segmen is null or length(segmen) <= 40),
  catatan text check (catatan is null or length(catatan) <= 300),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, induk_id) references public.customer (perusahaan_id, id)
);
create unique index customer_nama_unik on public.customer (perusahaan_id, lower(btrim(nama)));

create table public.deal (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  customer_id uuid not null,
  judul text not null check (length(btrim(judul)) between 3 and 120),
  nilai bigint not null default 0 check (nilai between 0 and 1000000000000),
  tahap text not null default 'prospek' check (tahap in ('prospek', 'kualifikasi', 'penawaran', 'negosiasi', 'menang', 'kalah')),
  sales_id uuid references public.orang(id),
  perkiraan_tutup date,
  dokumen_jual_id uuid,
  alasan_kalah text check (alasan_kalah is null or length(alasan_kalah) <= 300),
  ditutup_at date,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, customer_id) references public.customer (perusahaan_id, id),
  foreign key (perusahaan_id, dokumen_jual_id) references public.dokumen_jual (perusahaan_id, id),
  check ((tahap = 'kalah') = (alasan_kalah is not null)),
  check ((tahap in ('menang', 'kalah')) = (ditutup_at is not null))
);
create index on public.deal (perusahaan_id, tahap);
create index on public.deal (sales_id);
create index on public.deal (dokumen_jual_id);

create table public.deal_activity (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  deal_id uuid not null,
  jenis text not null check (jenis in ('catatan', 'tugas', 'kunjungan')),
  isi text not null check (length(btrim(isi)) between 2 and 500),
  jatuh_tempo date,
  selesai boolean not null default false,
  orang_id uuid references public.orang(id),
  lokasi jsonb check (lokasi is null or (jsonb_typeof(lokasi) = 'object' and lokasi ?& array['lat', 'lng'])),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  foreign key (perusahaan_id, deal_id) references public.deal (perusahaan_id, id),
  check (jenis = 'tugas' or jatuh_tempo is null),
  check (jenis = 'kunjungan' or lokasi is null)
);
create index on public.deal_activity (deal_id, dibuat_at desc);

create table public.sales_target (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id),
  bulan date not null check (extract(day from bulan) = 1),
  nominal bigint not null check (nominal between 0 and 1000000000000),
  diubah_at timestamptz not null default now(),
  primary key (perusahaan_id, orang_id, bulan)
);

alter table public.customer enable row level security;
alter table public.deal enable row level security;
alter table public.deal_activity enable row level security;
alter table public.sales_target enable row level security;
-- Pengelola melihat semua; sales (staf) melihat deal miliknya, pelanggan deal itu, dan aktivitasnya.
create policy customer_baca on public.customer for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan')
         or exists (select 1 from public.deal d where d.customer_id = customer.id and d.sales_id = (select app.orang_saya()))));
create policy deal_baca on public.deal for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or sales_id = (select app.orang_saya())));
create policy deal_activity_baca on public.deal_activity for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan')
         or exists (select 1 from public.deal d where d.id = deal_activity.deal_id and d.sales_id = (select app.orang_saya()))));
create policy sales_target_baca on public.sales_target for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));
grant select on public.customer, public.deal, public.deal_activity, public.sales_target to authenticated;
create trigger audit_deal after insert or update or delete on public.deal for each row execute function app.catat_audit();

create or replace function app.wajib_crm() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengatur pelanggan dan deal' using errcode = '42501';
  end if;
  return v_pid;
end $$;

create or replace function public.save_customer(p_id uuid, p_nama text, p_jenis text, p_induk uuid, p_hp text, p_email text, p_kota text, p_segmen text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm(); v_id uuid; v_hp text := nullif(regexp_replace(coalesce(p_hp, ''), '[^0-9]', '', 'g'), '');
begin
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 100 then raise exception 'Nama pelanggan 2 sampai 100 huruf' using errcode = '22023'; end if;
  if coalesce(p_jenis, 'perusahaan') not in ('orang', 'perusahaan') then raise exception 'Jenis: orang atau perusahaan' using errcode = '22023'; end if;
  if v_hp ~ '^0' then v_hp := '62' || substr(v_hp, 2); end if;
  if v_hp is not null and v_hp !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp belum benar, mis. 0812-3456-7890' using errcode = '22023'; end if;
  if p_induk is not null and not exists (select 1 from public.customer where id = p_induk and perusahaan_id = v_pid and jenis = 'perusahaan') then
    raise exception 'Perusahaan induk tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_id is null then
    insert into public.customer (perusahaan_id, jenis, nama, induk_id, hp, email, kota, segmen)
    values (v_pid, coalesce(p_jenis, 'perusahaan'), btrim(p_nama), p_induk, v_hp, nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_kota, '')), ''),
            nullif(btrim(coalesce(p_segmen, '')), ''))
    on conflict (perusahaan_id, lower(btrim(nama))) do update set hp = coalesce(excluded.hp, public.customer.hp), aktif = true
    returning id into v_id;
  else
    update public.customer set nama = btrim(p_nama), jenis = coalesce(p_jenis, jenis), induk_id = p_induk, hp = v_hp, email = nullif(btrim(coalesce(p_email, '')), ''),
           kota = nullif(btrim(coalesce(p_kota, '')), ''), segmen = nullif(btrim(coalesce(p_segmen, '')), '')
     where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Pelanggan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.save_deal(p_id uuid, p_customer uuid, p_judul text, p_nilai bigint, p_sales uuid, p_tutup date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm(); v_id uuid;
begin
  if not exists (select 1 from public.customer where id = p_customer and perusahaan_id = v_pid) then raise exception 'Pelanggan tidak ditemukan' using errcode = 'P0002'; end if;
  if length(btrim(coalesce(p_judul, ''))) not between 3 and 120 then raise exception 'Judul deal 3 sampai 120 huruf' using errcode = '22023'; end if;
  if p_nilai is null or p_nilai < 0 or p_nilai > 1000000000000 then raise exception 'Isi perkiraan nilai deal dalam rupiah' using errcode = '22023'; end if;
  if p_sales is not null and not exists (select 1 from public.orang where id = p_sales and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Sales tidak ditemukan di daftar orang aktif' using errcode = 'P0002';
  end if;
  if p_id is null then
    insert into public.deal (perusahaan_id, customer_id, judul, nilai, sales_id, perkiraan_tutup, dibuat_oleh)
    values (v_pid, p_customer, btrim(p_judul), p_nilai, p_sales, p_tutup, auth.uid()) returning id into v_id;
  else
    update public.deal set customer_id = p_customer, judul = btrim(p_judul), nilai = p_nilai, sales_id = p_sales, perkiraan_tutup = p_tutup, diubah_at = now()
     where id = p_id and perusahaan_id = v_pid and tahap not in ('menang', 'kalah') returning id into v_id;
    if v_id is null then raise exception 'Deal tidak ditemukan atau sudah ditutup' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- Pindah tahap. Kalah wajib beralasan; menang/kalah menutup deal; deal tertutup bisa dibuka lagi ke tahap aktif.
create or replace function public.move_deal(p_deal uuid, p_tahap text, p_alasan text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm();
begin
  if p_tahap not in ('prospek', 'kualifikasi', 'penawaran', 'negosiasi', 'menang', 'kalah') then raise exception 'Tahap tidak dikenal' using errcode = '22023'; end if;
  if p_tahap = 'kalah' and length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan deal kalah' using errcode = '22023'; end if;
  update public.deal set tahap = p_tahap, alasan_kalah = case when p_tahap = 'kalah' then left(btrim(p_alasan), 300) end,
         ditutup_at = case when p_tahap in ('menang', 'kalah') then app.hari_ini(v_pid) end, diubah_at = now()
   where id = p_deal and perusahaan_id = v_pid;
  if not found then raise exception 'Deal tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Penawaran (dokumen M-03) dari deal: pelanggan dan WhatsApp dari data pelanggan, baris dari isian, nilai deal ikut total penawaran.
create or replace function public.deal_to_quote(p_deal uuid, p_baris jsonb, p_berlaku date, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm(); d public.deal; c public.customer; r jsonb;
begin
  select * into d from public.deal where id = p_deal and perusahaan_id = v_pid for update;
  if not found then raise exception 'Deal tidak ditemukan' using errcode = 'P0002'; end if;
  if d.tahap in ('menang', 'kalah') then raise exception 'Deal sudah ditutup' using errcode = '22023'; end if;
  if d.dokumen_jual_id is not null and exists (select 1 from public.dokumen_jual where id = d.dokumen_jual_id and status <> 'batal') then
    select jsonb_build_object('id', id, 'nomor', nomor, 'total', total, 'sudah', true) into r from public.dokumen_jual where id = d.dokumen_jual_id;
    return r;
  end if;
  select * into c from public.customer where id = d.customer_id;
  r := public.buat_dokumen_jual('penawaran', null, c.nama, c.hp, p_baris, p_berlaku, left('Dari deal: ' || d.judul, 300), p_kunci);
  update public.deal set dokumen_jual_id = (r ->> 'id')::uuid, nilai = (r ->> 'total')::bigint,
         tahap = case when tahap in ('prospek', 'kualifikasi') then 'penawaran' else tahap end, diubah_at = now()
   where id = d.id;
  return r;
end $$;

-- Penawaran diterima (dijadikan pesanan, M-03): deal yang memakainya menang. Penawaran dibatalkan: deal kembali ke negosiasi.
create or replace function app.deal_dari_dokumen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.jenis = 'penawaran' and new.status is distinct from old.status then
    if new.status = 'diterima' then
      update public.deal set tahap = 'menang', alasan_kalah = null, ditutup_at = app.hari_ini(new.perusahaan_id), diubah_at = now()
       where dokumen_jual_id = new.id and tahap not in ('menang', 'kalah');
    elsif new.status = 'batal' then
      update public.deal set tahap = 'negosiasi', diubah_at = now() where dokumen_jual_id = new.id and tahap not in ('menang', 'kalah');
    end if;
  end if;
  return null;
end $$;
create trigger deal_dari_dokumen after update of status on public.dokumen_jual for each row execute function app.deal_dari_dokumen();

-- Aktivitas: pengelola untuk semua deal; staf hanya pada deal miliknya. Kunjungan dengan lokasi (lat/lng/akurasi) hanya bila
-- p_izin_lokasi benar (sales menyetujui di perangkatnya); tanpa izin, kunjungan tetap tercatat tanpa lokasi.
create or replace function public.add_deal_activity(p_deal uuid, p_jenis text, p_isi text, p_jatuh_tempo date default null, p_lokasi jsonb default null,
  p_izin_lokasi boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), ''); d public.deal; v_id uuid; v_lok jsonb;
begin
  select * into d from public.deal where id = p_deal and perusahaan_id = v_pid;
  if not found then raise exception 'Deal tidak ditemukan' using errcode = 'P0002'; end if;
  if not (v_peran in ('pemilik', 'admin') or (d.sales_id is not null and d.sales_id = app.orang_saya())) then
    raise exception 'Hanya pengelola atau sales deal ini yang mencatat aktivitas' using errcode = '42501';
  end if;
  if p_jenis not in ('catatan', 'tugas', 'kunjungan') then raise exception 'Jenis: catatan, tugas, atau kunjungan' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_isi, ''))) not between 2 and 500 then raise exception 'Tulis isinya 2 sampai 500 huruf' using errcode = '22023'; end if;
  if p_jenis = 'tugas' and p_jatuh_tempo is null then raise exception 'Tugas butuh tanggal jatuh tempo' using errcode = '22023'; end if;
  if p_jenis = 'kunjungan' and p_izin_lokasi and p_lokasi is not null then
    begin
      v_lok := jsonb_build_object('lat', round((p_lokasi ->> 'lat')::numeric, 5), 'lng', round((p_lokasi ->> 'lng')::numeric, 5),
                                  'akurasi', round(coalesce((p_lokasi ->> 'akurasi')::numeric, 0)), 'tujuan', 'bukti kunjungan pelanggan');
    exception when others then raise exception 'Lokasi tidak terbaca' using errcode = '22023';
    end;
    if (v_lok ->> 'lat')::numeric not between -90 and 90 or (v_lok ->> 'lng')::numeric not between -180 and 180 then
      raise exception 'Lokasi di luar jangkauan' using errcode = '22023';
    end if;
  end if;
  insert into public.deal_activity (perusahaan_id, deal_id, jenis, isi, jatuh_tempo, orang_id, lokasi, dibuat_oleh)
  values (v_pid, d.id, p_jenis, btrim(p_isi), case when p_jenis = 'tugas' then p_jatuh_tempo end, app.orang_saya(), v_lok, auth.uid())
  returning id into v_id;
  update public.deal set diubah_at = now() where id = d.id;
  return v_id;
end $$;

create or replace function public.complete_deal_task(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  update public.deal_activity a set selesai = true
    from public.deal d
   where a.id = p_id and a.perusahaan_id = v_pid and a.jenis = 'tugas' and d.id = a.deal_id
     and (v_peran in ('pemilik', 'admin') or d.sales_id = app.orang_saya());
  if not found then raise exception 'Tugas tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

create or replace function public.set_sales_target(p_orang uuid, p_bulan date, p_nominal bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm();
begin
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if p_nominal is null or p_nominal < 0 or p_nominal > 1000000000000 then raise exception 'Isi target dalam rupiah' using errcode = '22023'; end if;
  insert into public.sales_target (perusahaan_id, orang_id, bulan, nominal) values (v_pid, p_orang, date_trunc('month', p_bulan)::date, p_nominal)
  on conflict (perusahaan_id, orang_id, bulan) do update set nominal = excluded.nominal, diubah_at = now();
end $$;

-- Laporan sales dalam rentang: corong per tahap (deal aktif: semua; menang/kalah: yang ditutup di rentang), per sales menang + target +
-- kunjungan, tingkat menang = menang / (menang + kalah) dalam rentang.
create or replace function public.sales_report(p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm(); v_corong jsonb; v_sales jsonb; m int; k int;
begin
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then raise exception 'Rentang tanggal tidak sah' using errcode = '22023'; end if;
  select jsonb_object_agg(t.tahap, jsonb_build_object('jumlah', coalesce(x.n, 0), 'nilai', coalesce(x.v, 0))) into v_corong
    from unnest(array['prospek', 'kualifikasi', 'penawaran', 'negosiasi', 'menang', 'kalah']) t(tahap)
    left join (select tahap, count(*) n, sum(nilai) v from public.deal
                where perusahaan_id = v_pid and (tahap not in ('menang', 'kalah') or ditutup_at between p_dari and p_sampai) group by tahap) x on x.tahap = t.tahap;
  select count(*) filter (where tahap = 'menang'), count(*) filter (where tahap = 'kalah') into m, k
    from public.deal where perusahaan_id = v_pid and ditutup_at between p_dari and p_sampai;
  select coalesce(jsonb_agg(s order by (s ->> 'menang_nilai')::bigint desc, s ->> 'nama'), '[]') into v_sales from (
    select jsonb_build_object('orang', o.id, 'nama', o.nama,
      'menang', count(d.id) filter (where d.tahap = 'menang' and d.ditutup_at between p_dari and p_sampai),
      'menang_nilai', coalesce(sum(d.nilai) filter (where d.tahap = 'menang' and d.ditutup_at between p_dari and p_sampai), 0),
      'terbuka_nilai', coalesce(sum(d.nilai) filter (where d.tahap not in ('menang', 'kalah')), 0),
      'target', coalesce((select sum(t.nominal) from public.sales_target t where t.perusahaan_id = v_pid and t.orang_id = o.id
                           and t.bulan between date_trunc('month', p_dari)::date and p_sampai), 0),
      'kunjungan', (select count(*) from public.deal_activity a where a.perusahaan_id = v_pid and a.orang_id = o.id and a.jenis = 'kunjungan'
                     and (a.dibuat_at at time zone 'UTC')::date between p_dari and p_sampai)) s
      from public.orang o left join public.deal d on d.sales_id = o.id and d.perusahaan_id = v_pid
     where o.perusahaan_id = v_pid and (exists (select 1 from public.deal x where x.sales_id = o.id) or exists (select 1 from public.sales_target t where t.orang_id = o.id))
     group by o.id, o.nama) q(s);
  return jsonb_build_object('dari', p_dari, 'sampai', p_sampai, 'corong', v_corong, 'menang', m, 'kalah', k,
    'tingkat_menang', case when m + k > 0 then round(m * 100.0 / (m + k)) end, 'sales', v_sales);
end $$;

-- Segmen otomatis dari invoice 365 hari terakhir (nama pelanggan dicocokkan tanpa beda huruf besar): besar = 20% teratas nilai,
-- setia = minimal 3 invoice, baru = invoice pertama dalam 30 hari, tidur = invoice terakhir lebih dari 90 hari lalu.
create or replace function public.customer_segments() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_crm(); v_hari date := app.hari_ini(v_pid); v jsonb;
begin
  with i as (
    select lower(btrim(pelanggan)) as kunci, min(btrim(pelanggan)) as nama, count(*) n, sum(total)::bigint nilai, min(tanggal) pertama, max(tanggal) terakhir
      from public.invoice where perusahaan_id = v_pid and status <> 'batal' and tanggal > v_hari - 365 group by lower(btrim(pelanggan))
  ), r as (select i.*, percent_rank() over (order by nilai) pr from i)
  select coalesce(jsonb_agg(jsonb_build_object('nama', coalesce(c.nama, r.nama), 'pelanggan', c.id, 'invoice', r.n, 'nilai', r.nilai, 'terakhir', r.terakhir,
           'segmen', array_remove(array[case when r.pr >= 0.8 and r.n > 0 then 'besar' end, case when r.n >= 3 then 'setia' end,
                                        case when r.pertama > v_hari - 30 then 'baru' end, case when r.terakhir < v_hari - 90 then 'tidur' end], null),
           'segmen_isian', c.segmen) order by r.nilai desc), '[]')
    into v from r left join public.customer c on c.perusahaan_id = v_pid and lower(btrim(c.nama)) = r.kunci;
  return v;
end $$;

revoke all on function app.wajib_crm(), app.deal_dari_dokumen() from public, anon, authenticated;
revoke all on function public.save_customer(uuid, text, text, uuid, text, text, text, text), public.save_deal(uuid, uuid, text, bigint, uuid, date),
  public.move_deal(uuid, text, text), public.deal_to_quote(uuid, jsonb, date, uuid), public.add_deal_activity(uuid, text, text, date, jsonb, boolean),
  public.complete_deal_task(uuid), public.set_sales_target(uuid, date, bigint), public.sales_report(date, date), public.customer_segments() from public, anon;
grant execute on function public.save_customer(uuid, text, text, uuid, text, text, text, text), public.save_deal(uuid, uuid, text, bigint, uuid, date),
  public.move_deal(uuid, text, text), public.deal_to_quote(uuid, jsonb, date, uuid), public.add_deal_activity(uuid, text, text, date, jsonb, boolean),
  public.complete_deal_task(uuid), public.set_sales_target(uuid, date, bigint), public.sales_report(date, date), public.customer_segments() to authenticated;
