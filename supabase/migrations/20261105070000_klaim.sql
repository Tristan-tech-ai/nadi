-- M-18 (docs/research/klaim.md): pengeluaran karyawan. Kategori klaim dengan batas per orang per bulan dan aturan struk; klaim staf
-- lewat rantai atasan lalu pemilik/admin; disetujui = utang penggantian 2-160 (D beban kategori); dibayar lewat slip (komponen
-- penggantian, bukan upah: tidak masuk bruto PPh dan tidak menjadi dasar batas potongan Pasal 65) atau kas/bank; perjalanan dinas
-- dengan uang muka 1-160 yang diselesaikan terhadap klaim perjalanan (kurang = sisa klaim dibayar lewat slip, lebih = kasbon).
-- Tes: supabase/tests/klaim.test.sql.

create table public.kategori_klaim (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 2 and 60),
  batas_bulanan bigint check (batas_bulanan is null or batas_bulanan > 0),
  akun text not null default '6-900' check (akun ~ '^6-[0-9]{3}$'),
  butuh_struk boolean not null default true,
  aktif boolean not null default true,
  unique (perusahaan_id, nama)
);
create table public.perjalanan_dinas (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tujuan text not null check (length(btrim(tujuan)) between 2 and 120),
  keperluan text not null check (length(btrim(keperluan)) between 3 and 300),
  mulai date not null,
  selesai date not null,
  uang_muka bigint not null default 0 check (uang_muka >= 0),
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak', 'selesai')),
  uang_muka_dibayar boolean not null default false,
  usulan_id uuid references public.usulan(id) on delete set null,
  kunci_klien uuid not null,
  dibuat_at timestamptz not null default now(),
  selesai_at timestamptz,
  unique (perusahaan_id, kunci_klien),
  check (selesai >= mulai)
);
create table public.klaim (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  kategori_id uuid not null references public.kategori_klaim(id),
  perjalanan_id uuid references public.perjalanan_dinas(id) on delete set null,
  tanggal date not null,
  jumlah bigint not null check (jumlah > 0),
  terbayar bigint not null default 0 check (terbayar >= 0),
  keterangan text not null check (length(btrim(keterangan)) between 3 and 300),
  berkas_id uuid references public.berkas(id) on delete set null,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak', 'dibayar')),
  usulan_id uuid references public.usulan(id) on delete set null,
  periode_id uuid references public.periode_gaji(id) on delete set null,
  kunci_klien uuid not null,
  dibuat_at timestamptz not null default now(),
  dibayar_at timestamptz,
  unique (perusahaan_id, kunci_klien),
  check (terbayar <= jumlah)
);
create index on public.kategori_klaim (perusahaan_id);
create index on public.perjalanan_dinas (perusahaan_id, orang_id);
create index on public.perjalanan_dinas (usulan_id);
create index on public.klaim (perusahaan_id, orang_id, tanggal);
create index on public.klaim (kategori_id);
create index on public.klaim (perjalanan_id);
create index on public.klaim (berkas_id);
create index on public.klaim (usulan_id);
create index on public.klaim (periode_id);
alter table public.kategori_klaim enable row level security;
alter table public.perjalanan_dinas enable row level security;
alter table public.klaim enable row level security;
create policy kategori_klaim_baca on public.kategori_klaim for select to authenticated using (perusahaan_id = (select app.pid()));
create policy perjalanan_dinas_baca on public.perjalanan_dinas for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or orang_id = (select app.orang_saya())));
create policy klaim_baca on public.klaim for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or orang_id = (select app.orang_saya())));
grant select on public.kategori_klaim, public.perjalanan_dinas, public.klaim to authenticated;
create trigger audit_klaim after insert or update or delete on public.klaim for each row execute function app.catat_audit();
create trigger audit_perjalanan_dinas after insert or update or delete on public.perjalanan_dinas for each row execute function app.catat_audit();

create or replace function public.simpan_kategori_klaim(p_id uuid, p_nama text, p_batas bigint, p_akun text, p_butuh_struk boolean, p_aktif boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid;
begin
  if p_id is null then
    insert into public.kategori_klaim (perusahaan_id, nama, batas_bulanan, akun, butuh_struk)
    values (v_pid, btrim(p_nama), p_batas, coalesce(nullif(btrim(p_akun), ''), '6-900'), coalesce(p_butuh_struk, true)) returning id into v_id;
  else
    update public.kategori_klaim set nama = btrim(p_nama), batas_bulanan = p_batas, akun = coalesce(nullif(btrim(p_akun), ''), '6-900'),
           butuh_struk = coalesce(p_butuh_struk, true), aktif = coalesce(p_aktif, true)
     where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Kategori tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- Terpakai = klaim yang belum ditolak di bulan tanggal klaim, untuk orang dan kategori itu.
create or replace function app.terpakai_klaim(p_orang uuid, p_kategori uuid, p_tanggal date) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(jumlah), 0)::bigint from public.klaim
   where orang_id = p_orang and kategori_id = p_kategori and status <> 'ditolak'
     and date_trunc('month', tanggal) = date_trunc('month', p_tanggal)
$$;

create or replace function public.sisa_batas_klaim(p_tanggal date) returns table (kategori_id uuid, nama text, batas bigint, terpakai bigint, butuh_struk boolean)
language sql stable security definer set search_path = '' as $$
  select k.id, k.nama, k.batas_bulanan, app.terpakai_klaim(app.orang_saya(), k.id, coalesce(p_tanggal, app.hari_ini(app.pid()))), k.butuh_struk
    from public.kategori_klaim k where k.perusahaan_id = app.pid() and k.aktif and app.orang_saya() is not null order by k.nama
$$;

create or replace function public.ajukan_klaim(p_kategori uuid, p_tanggal date, p_jumlah bigint, p_keterangan text, p_berkas uuid, p_perjalanan uuid, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); k public.kategori_klaim; c public.klaim; v_nama text; v_terpakai bigint; v_usulan uuid; pd public.perjalanan_dinas;
begin
  if v_pid is null or v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini' using errcode = '42501'; end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into c from public.klaim where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if c.id is not null then return jsonb_build_object('id', c.id, 'status', c.status, 'sudah', true); end if;
  select * into k from public.kategori_klaim where id = p_kategori and perusahaan_id = v_pid and aktif;
  if k.id is null then raise exception 'Kategori tidak ditemukan' using errcode = 'P0002'; end if;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > 100000000 then raise exception 'Isi jumlah dalam rupiah, 1 sampai 100.000.000' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) or p_tanggal < app.hari_ini(v_pid) - 60 then raise exception 'Tanggal struk paling lama 60 hari lalu dan tidak di masa depan' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_keterangan, ''))) < 3 then raise exception 'Tulis untuk apa pengeluaran ini' using errcode = '22023'; end if;
  if k.butuh_struk and p_berkas is null then raise exception 'Kategori % butuh foto struk', k.nama using errcode = '22023'; end if;
  if p_berkas is not null and not exists (select 1 from public.berkas where id = p_berkas and perusahaan_id = v_pid) then raise exception 'Struk tidak ditemukan' using errcode = 'P0002'; end if;
  if p_perjalanan is not null then
    select * into pd from public.perjalanan_dinas where id = p_perjalanan and perusahaan_id = v_pid and orang_id = v_orang;
    if pd.id is null or pd.status <> 'disetujui' then raise exception 'Perjalanan dinas tidak ditemukan atau belum disetujui' using errcode = '22023'; end if;
    if p_tanggal not between pd.mulai and pd.selesai then raise exception 'Tanggal struk di luar tanggal perjalanan dinas' using errcode = '22023'; end if;
  end if;
  if k.batas_bulanan is not null then
    v_terpakai := app.terpakai_klaim(v_orang, k.id, p_tanggal);
    if v_terpakai + p_jumlah > k.batas_bulanan then
      raise exception 'Melebihi batas % bulan ini: sisa %, diajukan %', k.nama, app.rupiah(greatest(k.batas_bulanan - v_terpakai, 0)), app.rupiah(p_jumlah) using errcode = '22023';
    end if;
  end if;
  select nama into v_nama from public.orang where id = v_orang;
  insert into public.klaim (perusahaan_id, orang_id, kategori_id, perjalanan_id, tanggal, jumlah, keterangan, berkas_id, kunci_klien)
  values (v_pid, v_orang, k.id, p_perjalanan, p_tanggal, p_jumlah, btrim(p_keterangan), p_berkas, p_kunci) returning * into c;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp, berkas_id)
  values (v_pid, 'pwa', 'klaim.setujui', left('Ganti biaya ' || k.nama || ' ' || v_nama || ' ' || app.rupiah(p_jumlah), 140),
    left(btrim(p_keterangan) || ' (' || to_char(p_tanggal, 'DD-MM-YYYY') || ')' || case when p_berkas is not null then ', ada struk' else '' end
         || coalesce(', batas bulan ini ' || app.rupiah(k.batas_bulanan), '') || '.', 1000),
    jsonb_build_object('klaim_id', c.id, 'orang_id', v_orang, 'nama', v_nama, 'kategori', k.nama, 'jumlah', p_jumlah,
      'bidang', jsonb_build_object('orang_id', v_orang, 'nama', v_nama, 'kategori', k.nama, 'jumlah', p_jumlah, 'tanggal', p_tanggal)), p_jumlah, p_berkas)
  returning id into v_usulan;
  update public.klaim set usulan_id = v_usulan where id = c.id;
  return jsonb_build_object('id', c.id, 'status', 'menunggu', 'sudah', false);
end $$;

create or replace function public.ajukan_dinas(p_tujuan text, p_mulai date, p_selesai date, p_keperluan text, p_uang_muka bigint, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); d public.perjalanan_dinas; v_nama text; v_usulan uuid;
begin
  if v_pid is null or v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini' using errcode = '42501'; end if;
  select * into d from public.perjalanan_dinas where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if d.id is not null then return jsonb_build_object('id', d.id, 'sudah', true); end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai or p_selesai > p_mulai + 60 then raise exception 'Perjalanan paling lama 60 hari' using errcode = '22023'; end if;
  if coalesce(p_uang_muka, 0) < 0 or coalesce(p_uang_muka, 0) > 100000000 then raise exception 'Uang muka 0 sampai 100.000.000' using errcode = '22023'; end if;
  select nama into v_nama from public.orang where id = v_orang;
  insert into public.perjalanan_dinas (perusahaan_id, orang_id, tujuan, keperluan, mulai, selesai, uang_muka, kunci_klien)
  values (v_pid, v_orang, btrim(p_tujuan), btrim(p_keperluan), p_mulai, p_selesai, coalesce(p_uang_muka, 0), p_kunci) returning * into d;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp)
  values (v_pid, 'pwa', 'dinas.setujui', left('Setujui perjalanan dinas ' || v_nama || ' ke ' || btrim(p_tujuan), 140),
    left(btrim(p_keperluan) || ' (' || to_char(p_mulai, 'DD-MM-YYYY') || ' sampai ' || to_char(p_selesai, 'DD-MM-YYYY') || ')'
         || case when d.uang_muka > 0 then ', uang muka ' || app.rupiah(d.uang_muka) else '' end || '.', 1000),
    jsonb_build_object('dinas_id', d.id, 'orang_id', v_orang, 'nama', v_nama, 'uang_muka', d.uang_muka,
      'bidang', jsonb_build_object('orang_id', v_orang, 'nama', v_nama, 'tujuan', btrim(p_tujuan), 'tanggal', p_mulai, 'uang_muka', d.uang_muka)), d.uang_muka)
  returning id into v_usulan;
  update public.perjalanan_dinas set usulan_id = v_usulan where id = d.id;
  return jsonb_build_object('id', d.id, 'sudah', false);
end $$;

-- Rantai atasan (M-11B) kini juga untuk klaim dan perjalanan dinas.
create or replace function app.rantai_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pemohon uuid; p record;
begin
  if new.status <> 'menunggu' or new.aksi not in ('izin.setujui', 'lembur.ajukan', 'klaim.setujui', 'dinas.setujui') then return new; end if;
  v_pemohon := coalesce(new.payload ->> 'orang_id', new.payload -> 'bidang' ->> 'orang_id')::uuid;
  if v_pemohon is null then return new; end if;
  select * into p from app.penyetuju_atasan(new.perusahaan_id, v_pemohon, app.hari_ini(new.perusahaan_id));
  if p.orang_id is null then return new; end if;
  new.status := 'menunggu_atasan';
  new.payload := new.payload || jsonb_build_object('rantai', jsonb_build_object('pemohon', v_pemohon, 'penyetuju', p.orang_id, 'user', p.user_id, 'atas_nama', p.atas_nama));
  return new;
end $$;

-- Keputusan usulan klaim/dinas (oleh pemilik/admin di Feed, atau tolak oleh atasan) menulis ke klaim/perjalanan.
create or replace function app.klaim_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.klaim; k public.kategori_klaim;
begin
  if new.aksi = 'klaim.setujui' then
    select * into c from public.klaim where id = (new.payload ->> 'klaim_id')::uuid and status = 'menunggu' for update;
    if c.id is null then return new; end if;
    if new.status = 'ditolak' then
      update public.klaim set status = 'ditolak' where id = c.id;
    elsif new.status = 'diterima' then
      select * into k from public.kategori_klaim where id = c.kategori_id;
      perform app.pasang_bagan_bawaan(c.perusahaan_id);
      perform app.akun_pastikan(c.perusahaan_id, k.akun, k.nama, 'beban', 'debit');
      perform app.akun_pastikan(c.perusahaan_id, '2-160', 'Utang penggantian biaya karyawan', 'kewajiban', 'kredit');
      perform app.posting_jurnal(c.perusahaan_id, jsonb_build_object('tanggal', c.tanggal, 'keterangan', left('Klaim ' || k.nama || ': ' || c.keterangan, 200),
        'sumber', 'klaim', 'sumber_id', c.id::text, 'kunci_idempoten', 'klaim:' || c.id),
        jsonb_build_array(jsonb_build_object('akun', k.akun, 'debit', c.jumlah), jsonb_build_object('akun', '2-160', 'kredit', c.jumlah)), auth.uid());
      update public.klaim set status = 'disetujui' where id = c.id;
    end if;
  elsif new.aksi = 'dinas.setujui' then
    update public.perjalanan_dinas set status = case when new.status = 'diterima' then 'disetujui' else 'ditolak' end
     where id = (new.payload ->> 'dinas_id')::uuid and status = 'menunggu' and new.status in ('diterima', 'ditolak');
  end if;
  return new;
end $$;
create trigger klaim_dari_usulan after update of status on public.usulan for each row
  when (new.aksi in ('klaim.setujui', 'dinas.setujui') and new.status in ('diterima', 'ditolak') and old.status is distinct from new.status)
  execute function app.klaim_dari_usulan();

-- Bayar langsung dari kas/bank (pemilik): sisa klaim yang disetujui.
create or replace function public.bayar_klaim(p_klaim uuid, p_cara text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); c public.klaim; v_sisa bigint;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then raise exception 'Hanya pemilik yang membayar dari kas atau bank' using errcode = '42501'; end if;
  if p_cara not in ('kas', 'bank') then raise exception 'Cara bayar kas atau bank' using errcode = '22023'; end if;
  select * into c from public.klaim where id = p_klaim and perusahaan_id = v_pid for update;
  if c.id is null then raise exception 'Klaim tidak ditemukan' using errcode = 'P0002'; end if;
  if c.status <> 'disetujui' then raise exception 'Hanya klaim yang sudah disetujui dan belum dibayar' using errcode = '22023'; end if;
  v_sisa := c.jumlah - c.terbayar;
  perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', app.hari_ini(v_pid), 'keterangan', left('Bayar klaim: ' || c.keterangan, 200),
    'sumber', 'klaim', 'sumber_id', c.id::text, 'kunci_idempoten', 'klaim_bayar:' || c.id),
    jsonb_build_array(jsonb_build_object('akun', '2-160', 'debit', v_sisa), jsonb_build_object('akun', case when p_cara = 'kas' then '1-100' else '1-110' end, 'kredit', v_sisa)), auth.uid());
  update public.klaim set terbayar = jumlah, status = 'dibayar', dibayar_at = now() where id = c.id;
  return jsonb_build_object('id', c.id, 'dibayar', v_sisa);
end $$;

-- Uang muka perjalanan dinas dibayar pemilik: D 1-160 / K kas atau bank.
create or replace function public.bayar_uang_muka_dinas(p_dinas uuid, p_cara text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); d public.perjalanan_dinas;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then raise exception 'Hanya pemilik yang membayar uang muka' using errcode = '42501'; end if;
  select * into d from public.perjalanan_dinas where id = p_dinas and perusahaan_id = v_pid for update;
  if d.id is null then raise exception 'Perjalanan tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'disetujui' or d.uang_muka_dibayar or d.uang_muka = 0 then raise exception 'Uang muka hanya untuk perjalanan disetujui yang belum dibayar' using errcode = '22023'; end if;
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.akun_pastikan(v_pid, '1-160', 'Uang muka perjalanan dinas', 'aset', 'debit');
  perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', app.hari_ini(v_pid), 'keterangan', left('Uang muka dinas ke ' || d.tujuan, 200),
    'sumber', 'klaim', 'sumber_id', d.id::text, 'kunci_idempoten', 'dinas_um:' || d.id),
    jsonb_build_array(jsonb_build_object('akun', '1-160', 'debit', d.uang_muka), jsonb_build_object('akun', case when p_cara = 'kas' then '1-100' else '1-110' end, 'kredit', d.uang_muka)), auth.uid());
  update public.perjalanan_dinas set uang_muka_dibayar = true where id = d.id;
  return jsonb_build_object('id', d.id, 'uang_muka', d.uang_muka);
end $$;

-- Selesaikan perjalanan: klaim perjalanan yang disetujui dipotong dari uang muka (tertua dulu). Kurang = sisa klaim dibayar seperti
-- klaim biasa (slip atau kas); lebih = sisa uang muka menjadi kasbon karyawan (D 1-150 / K 1-160) yang dicicil lewat slip.
create or replace function public.selesaikan_dinas(p_dinas uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); d public.perjalanan_dinas; c record; v_sisa_um bigint; v_ambil bigint; v_offset bigint := 0; v_kasbon bigint := 0; v_jurnal jsonb;
begin
  select * into d from public.perjalanan_dinas where id = p_dinas and perusahaan_id = v_pid for update;
  if d.id is null then raise exception 'Perjalanan tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'disetujui' then raise exception 'Hanya perjalanan yang disetujui dan belum selesai' using errcode = '22023'; end if;
  if exists (select 1 from public.klaim where perjalanan_id = d.id and status = 'menunggu') then raise exception 'Masih ada klaim perjalanan yang menunggu keputusan' using errcode = '22023'; end if;
  v_sisa_um := case when d.uang_muka_dibayar then d.uang_muka else 0 end;
  for c in select id, jumlah - terbayar as sisa from public.klaim where perjalanan_id = d.id and status = 'disetujui' order by tanggal, dibuat_at for update loop
    exit when v_sisa_um <= 0;
    v_ambil := least(c.sisa, v_sisa_um);
    update public.klaim set terbayar = terbayar + v_ambil, status = case when terbayar + v_ambil = jumlah then 'dibayar' else status end,
           dibayar_at = case when terbayar + v_ambil = jumlah then now() else dibayar_at end where id = c.id;
    v_sisa_um := v_sisa_um - v_ambil; v_offset := v_offset + v_ambil;
  end loop;
  if v_offset > 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', app.hari_ini(v_pid), 'keterangan', left('Selesai dinas ' || d.tujuan || ': klaim dipotong uang muka', 200),
      'sumber', 'klaim', 'sumber_id', d.id::text, 'kunci_idempoten', 'dinas_offset:' || d.id),
      jsonb_build_array(jsonb_build_object('akun', '2-160', 'debit', v_offset), jsonb_build_object('akun', '1-160', 'kredit', v_offset)), auth.uid());
  end if;
  if v_sisa_um > 0 then
    v_kasbon := v_sisa_um;
    perform app.akun_pastikan(v_pid, '1-150', 'Piutang karyawan (kasbon)', 'aset', 'debit');
    v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', app.hari_ini(v_pid), 'keterangan', left('Sisa uang muka dinas ' || d.tujuan || ' menjadi kasbon', 200),
      'sumber', 'gaji', 'sumber_id', d.orang_id::text, 'kunci_idempoten', 'dinas_kasbon:' || d.id),
      jsonb_build_array(jsonb_build_object('akun', '1-150', 'debit', v_kasbon), jsonb_build_object('akun', '1-160', 'kredit', v_kasbon)), auth.uid());
    insert into public.kasbon (perusahaan_id, orang_id, jumlah, cicilan, sisa, tanggal, cara, alasan, jurnal_id, kunci_klien, dibuat_oleh)
    values (v_pid, d.orang_id, v_kasbon, v_kasbon, v_kasbon, app.hari_ini(v_pid), 'transfer', left('Sisa uang muka perjalanan dinas ke ' || d.tujuan, 300),
            (v_jurnal ->> 'id')::uuid, md5('dinas:' || d.id)::uuid, auth.uid());
  end if;
  update public.perjalanan_dinas set status = 'selesai', selesai_at = now() where id = d.id;
  return jsonb_build_object('id', d.id, 'dipotong', v_offset, 'kasbon', v_kasbon,
    'sisa_klaim', (select coalesce(sum(jumlah - terbayar), 0) from public.klaim where perjalanan_id = d.id and status = 'disetujui'));
end $$;

-- Slip: komponen penggantian (bukan upah) tidak masuk dasar batas potongan Pasal 65 dan tidak melebihi sisa klaim yang disetujui.
create or replace function app.jaga_potongan_upah() returns trigger
language plpgsql set search_path = '' as $$
declare v_pendapatan numeric; v_pasal63 numeric; v_kasbon numeric; v_sisa numeric; v_ganti numeric;
begin
  select coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'pendapatan' and k ->> 'kode' <> 'penggantian'), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'potongan' and k ->> 'kode' in ('kasbon', 'denda', 'ganti_rugi', 'sewa', 'utang', 'kelebihan_bayar')), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'potongan' and k ->> 'kode' = 'kasbon'), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'pendapatan' and k ->> 'kode' = 'penggantian'), 0)
    into v_pendapatan, v_pasal63, v_kasbon, v_ganti from jsonb_array_elements(new.komponen) k;
  if v_pasal63 > v_pendapatan * 0.5 then
    raise exception 'Potongan kasbon, denda, ganti rugi, sewa, utang, dan kelebihan bayar Rp% melebihi 50%% upah Rp% (PP 36/2021 Pasal 65). Kurangi cicilannya.',
      v_pasal63, v_pendapatan using errcode = '22023';
  end if;
  if v_kasbon > 0 then
    select coalesce(sum(sisa), 0) into v_sisa from public.kasbon where perusahaan_id = new.perusahaan_id and orang_id = new.orang_id;
    if v_kasbon > v_sisa then
      raise exception 'Cicilan kasbon Rp% melebihi sisa kasbon Rp%', v_kasbon, v_sisa using errcode = '22023';
    end if;
  end if;
  if v_ganti > 0 then
    select coalesce(sum(jumlah - terbayar), 0) into v_sisa from public.klaim where perusahaan_id = new.perusahaan_id and orang_id = new.orang_id and status = 'disetujui';
    if v_ganti > v_sisa then
      raise exception 'Penggantian biaya Rp% melebihi klaim disetujui yang belum dibayar Rp%', v_ganti, v_sisa using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- Periode disetujui: penggantian di slip melunasi klaim disetujui (tertua dulu), jurnal D 2-160 / K 1-110 per periode.
create or replace function app.klaim_dari_gaji() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record; c record; v_sisa bigint; v_ambil bigint; v_total bigint := 0;
begin
  for s in
    select sg.orang_id, sum((x ->> 'nilai')::bigint) as ganti from public.slip_gaji sg cross join lateral jsonb_array_elements(sg.komponen) x
     where sg.periode_id = new.id and x ->> 'jenis' = 'pendapatan' and x ->> 'kode' = 'penggantian' group by sg.orang_id having sum((x ->> 'nilai')::bigint) > 0
  loop
    v_sisa := s.ganti;
    for c in select id, jumlah - terbayar as sisa from public.klaim where perusahaan_id = new.perusahaan_id and orang_id = s.orang_id and status = 'disetujui'
              order by tanggal, dibuat_at for update loop
      exit when v_sisa <= 0;
      v_ambil := least(c.sisa, v_sisa);
      update public.klaim set terbayar = terbayar + v_ambil, periode_id = new.id,
             status = case when terbayar + v_ambil = jumlah then 'dibayar' else status end,
             dibayar_at = case when terbayar + v_ambil = jumlah then now() else dibayar_at end where id = c.id;
      v_sisa := v_sisa - v_ambil; v_total := v_total + v_ambil;
    end loop;
  end loop;
  if v_total > 0 then
    perform app.posting_jurnal(new.perusahaan_id, jsonb_build_object('tanggal', app.hari_ini(new.perusahaan_id),
      'keterangan', 'Penggantian biaya karyawan lewat gaji ' || to_char(new.bulan, 'MM-YYYY'),
      'sumber', 'klaim', 'sumber_id', new.id::text, 'kunci_idempoten', 'klaim_gaji:' || new.id),
      jsonb_build_array(jsonb_build_object('akun', '2-160', 'debit', v_total), jsonb_build_object('akun', '1-110', 'kredit', v_total)), auth.uid());
  end if;
  return new;
end $$;
create trigger klaim_dari_gaji after update of status on public.periode_gaji
  for each row when (old.status = 'draf' and new.status = 'disetujui') execute function app.klaim_dari_gaji();

revoke all on function app.terpakai_klaim(uuid, uuid, date), app.klaim_dari_usulan(), app.klaim_dari_gaji() from public, anon, authenticated;
revoke all on function public.simpan_kategori_klaim(uuid, text, bigint, text, boolean, boolean), public.sisa_batas_klaim(date),
  public.ajukan_klaim(uuid, date, bigint, text, uuid, uuid, uuid), public.ajukan_dinas(text, date, date, text, bigint, uuid),
  public.bayar_klaim(uuid, text), public.bayar_uang_muka_dinas(uuid, text), public.selesaikan_dinas(uuid) from public, anon;
grant execute on function public.simpan_kategori_klaim(uuid, text, bigint, text, boolean, boolean), public.sisa_batas_klaim(date),
  public.ajukan_klaim(uuid, date, bigint, text, uuid, uuid, uuid), public.ajukan_dinas(text, date, date, text, bigint, uuid),
  public.bayar_klaim(uuid, text), public.bayar_uang_muka_dinas(uuid, text), public.selesaikan_dinas(uuid) to authenticated;
