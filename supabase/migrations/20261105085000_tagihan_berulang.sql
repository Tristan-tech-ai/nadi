-- W-07A tagihan berulang (docs/research/kebutuhan-usaha.md urut 1): sewa kos, SPP kursus, langganan jasa. Jadwal per pelanggan
-- menerbitkan invoice biasa (nomor, QRIS, halaman /i, jurnal piutang, pengingat WA) lewat public.buat_invoice yang sudah ada, atas nama
-- pembuat jadwal (harus tetap pemilik/admin/akuntan aktif), dengan kunci invoice md5(jadwal, tanggal periode) sehingga job harian dan
-- tombol manual tidak pernah membuat invoice ganda. Tanggal periode = mulai + n x tiap bulan (Postgres memotong ke akhir bulan:
-- 31 Jan > 28 Feb > 31 Mar), dihitung dari tanggal mulai, bukan dari periode sebelumnya. Dijeda = tidak terbit; dilanjutkan = periode
-- yang terlewat selama jeda tidak ditagih.

create table public.recurring_invoice (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  pelanggan text not null check (length(btrim(pelanggan)) between 1 and 100),
  pelanggan_hp text check (pelanggan_hp is null or pelanggan_hp ~ '^62[0-9]{8,13}$'),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 30),
  every_months integer not null check (every_months in (1, 3, 6, 12)),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  due_days integer not null default 7 check (due_days between 0 and 60),
  note text check (note is null or length(note) <= 200),
  status text not null default 'aktif' check (status in ('aktif', 'jeda', 'selesai')),
  runs integer not null default 0 check (runs >= 0),
  next_date date not null,
  last_invoice_id uuid,
  galat text check (galat is null or length(galat) <= 300),
  dibuat_oleh uuid not null,
  kunci_klien uuid not null,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien)
);
create index recurring_invoice_jatuh on public.recurring_invoice (next_date) where status = 'aktif';
alter table public.recurring_invoice enable row level security;
create policy recurring_invoice_baca on public.recurring_invoice for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.recurring_invoice to authenticated;
create trigger audit_recurring_invoice after insert or update or delete on public.recurring_invoice for each row execute function app.catat_audit();

create or replace function app.recurring_period(p_mulai date, p_tiap integer, p_n integer) returns date
language sql immutable set search_path = '' as $$ select (p_mulai + make_interval(months => p_tiap * p_n))::date $$;

create or replace function public.save_recurring_invoice(p jsonb, p_kunci uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); v_id uuid; v_mulai date := (p ->> 'mulai')::date; v_hp text := nullif(btrim(coalesce(p ->> 'hp', '')), '');
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select id into v_id from public.recurring_invoice where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return v_id; end if;
  if v_mulai is null or v_mulai < app.hari_ini(v_pid) - 92 or v_mulai > app.hari_ini(v_pid) + 366 then
    raise exception 'Tanggal mulai paling lama 3 bulan lalu dan paling jauh setahun lagi' using errcode = '22023';
  end if;
  if coalesce((p ->> 'tiap')::int, 0) not in (1, 3, 6, 12) then raise exception 'Ulangi tiap 1, 3, 6, atau 12 bulan' using errcode = '22023'; end if;
  if v_hp is not null and v_hp !~ '^62[0-9]{8,13}$' then raise exception 'Nomor HP pelanggan diawali 62, misalnya 6281234567890' using errcode = '22023'; end if;
  insert into public.recurring_invoice (perusahaan_id, pelanggan, pelanggan_hp, baris, every_months, start_date, end_date, due_days, note, next_date, dibuat_oleh, kunci_klien)
  values (v_pid, btrim(p ->> 'pelanggan'), v_hp, p -> 'baris', (p ->> 'tiap')::int, v_mulai, nullif(p ->> 'sampai', '')::date,
          coalesce((p ->> 'tempo')::int, 7), nullif(left(btrim(coalesce(p ->> 'catatan', '')), 200), ''), v_mulai, auth.uid(), p_kunci)
  returning id into v_id;
  return v_id;
end $$;

-- Terbitkan semua periode jatuh tempo sampai p_sampai (paling banyak 12 per jadwal per panggilan). Galat satu jadwal dicatat di jadwal
-- itu, jadwal lain tetap jalan.
create or replace function app.issue_recurring_invoices(p_pid uuid, p_sampai date) returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.recurring_invoice; n int := 0; i int; v_tgl date; v_hari date := app.hari_ini(p_pid); x jsonb; v_lama text; v_last uuid;
begin
  for r in select * from public.recurring_invoice where perusahaan_id = p_pid and status = 'aktif' and next_date <= p_sampai for update skip locked loop
    i := 0; v_tgl := r.next_date; v_last := r.last_invoice_id;
    v_lama := current_setting('request.jwt.claims', true);
    begin
      -- Terbit atas nama pembuat jadwal: buat_invoice memeriksa perannya di tabel anggota seperti biasa.
      perform set_config('request.jwt.claims', json_build_object('sub', r.dibuat_oleh, 'role', 'authenticated', 'aal', 'aal2',
        'app_metadata', json_build_object('pid', p_pid))::text, true);
      while v_tgl <= p_sampai and (r.end_date is null or v_tgl <= r.end_date) and i < 12 loop
        x := public.buat_invoice(r.pelanggan, r.pelanggan_hp, r.baris, least(greatest(v_tgl + r.due_days, v_hari), v_hari + 365),
               concat_ws(' ', r.note, 'Tagihan periode ' || to_char(v_tgl, 'DD-MM-YYYY') || '.'), md5('tagihan-berulang:' || r.id || ':' || v_tgl)::uuid);
        if not (x ->> 'sudah')::boolean then n := n + 1; end if;
        v_last := (x ->> 'id')::uuid;
        i := i + 1;
        v_tgl := app.recurring_period(r.start_date, r.every_months, r.runs + i);
      end loop;
      perform set_config('request.jwt.claims', coalesce(v_lama, ''), true);
      update public.recurring_invoice set runs = runs + i, next_date = v_tgl, last_invoice_id = v_last, galat = null,
             status = case when end_date is not null and v_tgl > end_date then 'selesai' else status end
       where id = r.id;
    exception when others then
      perform set_config('request.jwt.claims', coalesce(v_lama, ''), true);
      update public.recurring_invoice set galat = left(sqlerrm, 300) where id = r.id;
    end;
  end loop;
  return n;
end $$;

create or replace function public.run_recurring_invoices() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih();
begin
  return app.issue_recurring_invoices(v_pid, app.hari_ini(v_pid));
end $$;

-- Jeda atau lanjutkan. Saat dilanjutkan, periode yang lewat selama jeda dilompati (tidak ditagih belakangan).
create or replace function public.set_recurring_invoice_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); r public.recurring_invoice; v_hari date; k int;
begin
  if p_status not in ('aktif', 'jeda') then raise exception 'Status aktif atau jeda' using errcode = '22023'; end if;
  select * into r from public.recurring_invoice where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Tagihan berulang tidak ditemukan' using errcode = 'P0002'; end if;
  if r.status = 'selesai' then raise exception 'Tagihan berulang ini sudah selesai' using errcode = '22023'; end if;
  if p_status = 'aktif' and r.status = 'jeda' then
    v_hari := app.hari_ini(v_pid); k := r.runs;
    while app.recurring_period(r.start_date, r.every_months, k) < v_hari loop k := k + 1; end loop;
    update public.recurring_invoice set status = 'aktif', runs = k, next_date = app.recurring_period(r.start_date, r.every_months, k), galat = null where id = r.id;
  else
    update public.recurring_invoice set status = p_status where id = r.id;
  end if;
end $$;

create or replace function app.issue_recurring_invoices_all() returns integer
language plpgsql security definer set search_path = '' as $$
declare p uuid; n int := 0;
begin
  for p in select distinct perusahaan_id from public.recurring_invoice where status = 'aktif' and next_date <= current_date + 1 loop
    n := n + app.issue_recurring_invoices(p, app.hari_ini(p));
  end loop;
  return n;
end $$;
select cron.schedule('nadi-tagihan-berulang', '30 23 * * *', 'select app.issue_recurring_invoices_all()');

revoke all on function app.recurring_period(date, integer, integer), app.issue_recurring_invoices(uuid, date), app.issue_recurring_invoices_all() from public, anon, authenticated;
revoke all on function public.save_recurring_invoice(jsonb, uuid), public.run_recurring_invoices(), public.set_recurring_invoice_status(uuid, text) from public, anon;
grant execute on function public.save_recurring_invoice(jsonb, uuid), public.run_recurring_invoices(), public.set_recurring_invoice_status(uuid, text) to authenticated;
