-- M-06 (docs/research/aset-tetap.md): aset tetap dengan penyusutan fiskal Pasal 11 UU PPh (UU 7/2021 HPP): garis lurus (ayat (1)),
-- saldo menurun bukan bangunan dengan sisa sekaligus di akhir masa (ayat (2)), mulai bulan perolehan (ayat (3)), kelompok dan masa
-- manfaat (ayat (6)), pelepasan: sisa buku jadi rugi dan harga jual jadi penghasilan (ayat (8)). Rumus sama dengan
-- apps/web/src/lib/aset/susut.ts. Aset dipinjam karyawan tercatat dengan riwayat. Tes: supabase/tests/aset_tetap.test.sql.

create table public.aset_tetap (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 2 and 120),
  kelompok text not null check (kelompok in ('k1', 'k2', 'k3', 'k4', 'bangunan_permanen', 'bangunan_tidak_permanen', 'tanah')),
  metode text not null default 'garis_lurus' check (metode in ('garis_lurus', 'saldo_menurun')),
  tanggal_perolehan date not null,
  harga bigint not null check (harga > 0),
  status text not null default 'aktif' check (status in ('aktif', 'dijual', 'dilepas')),
  tanggal_lepas date,
  harga_jual bigint check (harga_jual is null or harga_jual >= 0),
  dipinjam_orang uuid references public.orang(id) on delete set null,
  jurnal_perolehan uuid,
  jurnal_lepas uuid,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  check (not (metode = 'saldo_menurun' and kelompok in ('bangunan_permanen', 'bangunan_tidak_permanen', 'tanah')))
);
create table public.penyusutan_aset (
  aset_id uuid not null references public.aset_tetap(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nilai bigint not null check (nilai >= 0),
  jurnal_id uuid,
  primary key (aset_id, bulan)
);
create table public.aset_pinjam (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  aset_id uuid not null references public.aset_tetap(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  mulai date not null,
  selesai date,
  catatan text check (catatan is null or length(catatan) <= 200)
);
create index on public.aset_tetap (perusahaan_id, status);
create index on public.aset_tetap (dipinjam_orang);
create index on public.penyusutan_aset (perusahaan_id, bulan);
create index on public.aset_pinjam (perusahaan_id, aset_id);
create index on public.aset_pinjam (orang_id);
alter table public.aset_tetap enable row level security;
alter table public.penyusutan_aset enable row level security;
alter table public.aset_pinjam enable row level security;
create policy aset_tetap_baca on public.aset_tetap for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or dipinjam_orang = (select app.orang_saya())));
create policy penyusutan_aset_baca on public.penyusutan_aset for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy aset_pinjam_baca on public.aset_pinjam for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or orang_id = (select app.orang_saya())));
grant select on public.aset_tetap, public.penyusutan_aset, public.aset_pinjam to authenticated;
create trigger audit_aset_tetap after insert or update or delete on public.aset_tetap for each row execute function app.catat_audit();

-- Penyusutan satu bulan (bulan ke-i sejak bulan perolehan). Sama dengan jadwalSusut di TypeScript.
create or replace function app.susut_bulan(p_harga bigint, p_kelompok text, p_metode text, p_mulai date, p_bulan date) returns bigint
language plpgsql immutable set search_path = '' as $$
declare n int; r numeric; i int; j int; v_sisa numeric := p_harga; v_awal numeric := p_harga; v_nilai numeric; v_bulan date; m date := date_trunc('month', p_mulai)::date;
begin
  n := case p_kelompok when 'k1' then 48 when 'k2' then 96 when 'k3' then 192 when 'k4' then 240 when 'bangunan_permanen' then 240 when 'bangunan_tidak_permanen' then 120 else 0 end;
  r := case p_kelompok when 'k1' then 0.5 when 'k2' then 0.25 when 'k3' then 0.125 when 'k4' then 0.1 end;
  i := (extract(year from age(date_trunc('month', p_bulan), m)) * 12 + extract(month from age(date_trunc('month', p_bulan), m)))::int;
  if n = 0 or p_bulan < m or i >= n then return 0; end if;
  if p_metode = 'garis_lurus' then
    if i = n - 1 then return p_harga - round(p_harga::numeric * i / n); end if;
    return round(p_harga::numeric * (i + 1) / n) - round(p_harga::numeric * i / n);
  end if;
  for j in 0 .. i loop
    v_bulan := (m + make_interval(months => j))::date;
    if extract(month from v_bulan) = 1 and j > 0 then v_awal := v_sisa; end if;
    v_nilai := least(round(v_awal * r / 12), v_sisa);
    if j = n - 1 then v_nilai := v_sisa; end if;
    if j = i then return v_nilai; end if;
    v_sisa := v_sisa - v_nilai;
  end loop;
  return 0;
end $$;

create or replace function public.catat_aset(p_nama text, p_kelompok text, p_metode text, p_tanggal date, p_harga bigint, p_cara text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_jurnal jsonb;
begin
  if p_cara not in ('kas', 'bank', 'tanpa_jurnal') then raise exception 'Cara perolehan kas, bank, atau tanpa jurnal (sudah dicatat di tempat lain)' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) then raise exception 'Tanggal perolehan tidak boleh di masa depan' using errcode = '22023'; end if;
  if p_metode = 'saldo_menurun' and p_kelompok in ('bangunan_permanen', 'bangunan_tidak_permanen', 'tanah') then
    raise exception 'Bangunan dan tanah hanya garis lurus (Pasal 11 ayat (2) UU PPh)' using errcode = '22023';
  end if;
  insert into public.aset_tetap (perusahaan_id, nama, kelompok, metode, tanggal_perolehan, harga, dibuat_oleh)
  values (v_pid, btrim(p_nama), p_kelompok, coalesce(p_metode, 'garis_lurus'), p_tanggal, p_harga, auth.uid()) returning id into v_id;
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.akun_pastikan(v_pid, '1-500', 'Aset tetap', 'aset', 'debit');
  if p_cara <> 'tanpa_jurnal' then
    v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal, 'keterangan', left('Beli aset: ' || btrim(p_nama), 200),
      'sumber', 'aset', 'sumber_id', v_id::text, 'kunci_idempoten', 'aset_beli:' || v_id),
      jsonb_build_array(jsonb_build_object('akun', '1-500', 'debit', p_harga), jsonb_build_object('akun', case when p_cara = 'kas' then '1-100' else '1-110' end, 'kredit', p_harga)), auth.uid());
    update public.aset_tetap set jurnal_perolehan = (v_jurnal ->> 'id')::uuid where id = v_id;
  end if;
  return v_id;
end $$;

-- Susutkan semua aset aktif dari bulan perolehan sampai p_sampai (menyusul bulan yang belum), satu jurnal per usaha per bulan.
-- Bulan yang periodenya terkunci dilewati dan dilaporkan.
create or replace function app.susutkan(p_pid uuid, p_sampai date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b date; v_total bigint; v_jurnal jsonb; a record; v_nilai bigint; v_bulan int := 0; v_lewat int := 0; v_awal date;
begin
  select min(date_trunc('month', tanggal_perolehan))::date into v_awal from public.aset_tetap where perusahaan_id = p_pid and status = 'aktif' and kelompok <> 'tanah';
  if v_awal is null then return jsonb_build_object('bulan', 0, 'dilewati', 0); end if;
  perform app.pasang_bagan_bawaan(p_pid);
  perform app.akun_pastikan(p_pid, '1-590', 'Akumulasi penyusutan aset tetap', 'aset', 'kredit');
  perform app.akun_pastikan(p_pid, '6-500', 'Beban penyusutan', 'beban', 'debit');
  b := v_awal;
  while b <= date_trunc('month', p_sampai)::date loop
    v_total := 0;
    begin
      for a in select * from public.aset_tetap where perusahaan_id = p_pid and status = 'aktif' and kelompok <> 'tanah'
                 and date_trunc('month', tanggal_perolehan) <= b and not exists (select 1 from public.penyusutan_aset p where p.aset_id = aset_tetap.id and p.bulan = b) loop
        v_nilai := app.susut_bulan(a.harga, a.kelompok, a.metode, a.tanggal_perolehan, b);
        insert into public.penyusutan_aset (aset_id, bulan, perusahaan_id, nilai) values (a.id, b, p_pid, v_nilai);
        v_total := v_total + v_nilai;
      end loop;
      if v_total > 0 then
        v_jurnal := app.posting_jurnal(p_pid, jsonb_build_object('tanggal', (b + interval '1 month' - interval '1 day')::date, 'keterangan', 'Penyusutan aset tetap ' || to_char(b, 'MM-YYYY'),
          'sumber', 'aset', 'sumber_id', to_char(b, 'YYYY-MM'), 'kunci_idempoten', 'susut:' || p_pid || ':' || b || ':' || v_total),
          jsonb_build_array(jsonb_build_object('akun', '6-500', 'debit', v_total), jsonb_build_object('akun', '1-590', 'kredit', v_total)), null);
        update public.penyusutan_aset set jurnal_id = (v_jurnal ->> 'id')::uuid where perusahaan_id = p_pid and bulan = b and jurnal_id is null and nilai > 0;
        v_bulan := v_bulan + 1;
      end if;
    exception when others then
      v_lewat := v_lewat + 1;  -- periode terkunci atau galat jurnal: bulan ini dilewati, baris penyusutannya ikut dibatalkan
    end;
    b := (b + interval '1 month')::date;
  end loop;
  return jsonb_build_object('bulan', v_bulan, 'dilewati', v_lewat);
end $$;

create or replace function public.jalankan_penyusutan(p_sampai date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  if p_sampai is null or p_sampai > app.hari_ini(v_pid) then raise exception 'Penyusutan hanya sampai bulan berjalan' using errcode = '22023'; end if;
  return app.susutkan(v_pid, p_sampai);
end $$;

-- Jual atau lepas: susutkan sampai bulan sebelum pelepasan, lalu D kas/bank + D akumulasi / K aset; selisih laba 4-910 atau rugi 6-990.
create or replace function public.lepas_aset(p_aset uuid, p_tanggal date, p_harga_jual bigint, p_cara text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); a public.aset_tetap; v_akum bigint; v_sisa bigint; v_jual bigint := coalesce(p_harga_jual, 0); v_baris jsonb; v_jurnal jsonb;
begin
  select * into a from public.aset_tetap where id = p_aset and perusahaan_id = v_pid for update;
  if a.id is null then raise exception 'Aset tidak ditemukan' using errcode = 'P0002'; end if;
  if a.status <> 'aktif' then raise exception 'Aset sudah dijual atau dilepas' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal < a.tanggal_perolehan or p_tanggal > app.hari_ini(v_pid) then raise exception 'Tanggal pelepasan tidak sah' using errcode = '22023'; end if;
  if v_jual > 0 and p_cara not in ('kas', 'bank') then raise exception 'Harga jual diterima lewat kas atau bank' using errcode = '22023'; end if;
  if date_trunc('month', p_tanggal) > date_trunc('month', a.tanggal_perolehan) then
    perform app.susutkan(v_pid, (date_trunc('month', p_tanggal) - interval '1 day')::date);
  end if;
  select coalesce(sum(nilai), 0) into v_akum from public.penyusutan_aset where aset_id = a.id;
  v_sisa := a.harga - v_akum;
  perform app.akun_pastikan(v_pid, '1-590', 'Akumulasi penyusutan aset tetap', 'aset', 'kredit');
  v_baris := jsonb_build_array(jsonb_build_object('akun', '1-500', 'kredit', a.harga));
  if v_akum > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-590', 'debit', v_akum)); end if;
  if v_jual > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', case when p_cara = 'kas' then '1-100' else '1-110' end, 'debit', v_jual)); end if;
  if v_jual > v_sisa then
    perform app.akun_pastikan(v_pid, '4-910', 'Laba pelepasan aset tetap', 'pendapatan', 'kredit');
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '4-910', 'kredit', v_jual - v_sisa));
  elsif v_jual < v_sisa then
    perform app.akun_pastikan(v_pid, '6-990', 'Rugi pelepasan aset tetap', 'beban', 'debit');
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '6-990', 'debit', v_sisa - v_jual));
  end if;
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal, 'keterangan', left(case when v_jual > 0 then 'Jual aset: ' else 'Lepas aset: ' end || a.nama, 200),
    'sumber', 'aset', 'sumber_id', a.id::text, 'kunci_idempoten', 'aset_lepas:' || a.id), v_baris, auth.uid());
  update public.aset_pinjam set selesai = p_tanggal where aset_id = a.id and selesai is null;
  update public.aset_tetap set status = case when v_jual > 0 then 'dijual' else 'dilepas' end, tanggal_lepas = p_tanggal, harga_jual = v_jual,
         dipinjam_orang = null, jurnal_lepas = (v_jurnal ->> 'id')::uuid where id = a.id;
  return jsonb_build_object('akumulasi', v_akum, 'nilai_buku', v_sisa, 'harga_jual', v_jual, 'laba', v_jual - v_sisa);
end $$;

-- Pinjamkan aset ke karyawan (orang null = dikembalikan). Riwayat di aset_pinjam.
create or replace function public.pinjamkan_aset(p_aset uuid, p_orang uuid, p_catatan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); a public.aset_tetap; v_hari date := app.hari_ini(v_pid);
begin
  select * into a from public.aset_tetap where id = p_aset and perusahaan_id = v_pid for update;
  if a.id is null or a.status <> 'aktif' then raise exception 'Aset aktif tidak ditemukan' using errcode = 'P0002'; end if;
  if p_orang is not null and not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Orang tidak ditemukan' using errcode = 'P0002';
  end if;
  update public.aset_pinjam set selesai = v_hari where aset_id = a.id and selesai is null;
  if p_orang is not null then
    insert into public.aset_pinjam (perusahaan_id, aset_id, orang_id, mulai, catatan) values (v_pid, a.id, p_orang, v_hari, nullif(btrim(coalesce(p_catatan, '')), ''));
  end if;
  update public.aset_tetap set dipinjam_orang = p_orang where id = a.id;
end $$;

-- Cron bulanan tanggal 1: susutkan bulan lalu untuk semua usaha yang punya aset aktif.
create or replace function app.penyusutan_bulanan() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; n int := 0;
begin
  for p in select distinct perusahaan_id from public.aset_tetap where status = 'aktif' loop
    perform app.susutkan(p.perusahaan_id, (date_trunc('month', app.hari_ini(p.perusahaan_id)) - interval '1 day')::date);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function app.susut_bulan(bigint, text, text, date, date), app.susutkan(uuid, date), app.penyusutan_bulanan() from public, anon, authenticated;
revoke all on function public.catat_aset(text, text, text, date, bigint, text), public.jalankan_penyusutan(date), public.lepas_aset(uuid, date, bigint, text),
  public.pinjamkan_aset(uuid, uuid, text) from public, anon;
grant execute on function public.catat_aset(text, text, text, date, bigint, text), public.jalankan_penyusutan(date), public.lepas_aset(uuid, date, bigint, text),
  public.pinjamkan_aset(uuid, uuid, text) to authenticated;
select cron.schedule('nadi-penyusutan', '0 18 1 * *', 'select app.penyusutan_bulanan()');
