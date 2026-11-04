-- M-05 kas dan bank (docs/research/mekari/rencana.md; JU-14, JU-15, JU-16).
-- Rekening kas/bank = akun aset di bagan (Kas 1-100 dan Bank 1-110 bawaan, rekening tambahan 1-101..1-109 dan 1-111..1-119).
-- Transfer antarrekening dan terima/kirim uang manual menjurnal langsung. Mutasi bank (CSV atau e-statement lewat Lempar)
-- disimpan per rekening tanpa ganda, lalu direkonsiliasi satu per satu ke: invoice terbuka (lunas), tagihan pemasok terbuka
-- (bayar), jurnal kas yang sudah tercatat (tanpa jurnal baru), atau akun lawan (jurnal baru, biasanya dari aturan pengguna).
-- Usulan pencocokan dihitung di aplikasi (src/lib/kas/rekon.ts); database hanya menjalankan pilihan pemilik/admin.

create or replace function app.wajib_kas(p_tulis boolean default false) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  if v_pid is null or v_peran not in ('pemilik', 'admin', 'akuntan') or (p_tulis and v_peran not in ('pemilik', 'admin')) then
    raise exception '%', case when p_tulis then 'Hanya pemilik atau admin yang mencatat kas dan bank' else 'Kas dan bank hanya untuk pemilik, admin, atau akuntan' end
      using errcode = '42501';
  end if;
  return v_pid;
end $$;

create table public.rekening_kas (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 1 and 60),
  jenis text not null check (jenis in ('kas', 'bank', 'dompet')),
  akun_kode text not null,
  nomor_akhir text check (nomor_akhir is null or nomor_akhir ~ '^[0-9]{4}$'),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, akun_kode),
  unique (perusahaan_id, id)
);

create table public.mutasi_bank (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  rekening_id uuid not null,
  tanggal date not null,
  keterangan text not null check (length(keterangan) <= 300),
  jumlah bigint not null check (jumlah > 0),
  arah text not null check (arah in ('CR', 'DB')),
  sidik text not null,
  status text not null default 'belum' check (status in ('belum', 'cocok', 'abaikan')),
  cocok_jenis text check (cocok_jenis in ('invoice', 'tagihan_beli', 'jurnal', 'akun')),
  cocok_id text,
  alasan text check (alasan is null or length(alasan) <= 200),
  jurnal_id uuid,
  jurnal_terkait uuid[] not null default '{}',
  usulan_id uuid,
  diputuskan_oleh uuid,
  diputuskan_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (rekening_id, sidik),
  foreign key (perusahaan_id, rekening_id) references public.rekening_kas (perusahaan_id, id)
);
create index on public.mutasi_bank (perusahaan_id, rekening_id, status, tanggal);
-- Satu jurnal atau invoice hanya untuk satu mutasi; tagihan pemasok boleh beberapa (bayar sebagian).
create unique index mutasi_bank_target_sekali on public.mutasi_bank (perusahaan_id, cocok_jenis, cocok_id) where status = 'cocok' and cocok_jenis in ('jurnal', 'invoice');

create table public.aturan_rekon (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kata text not null check (length(btrim(kata)) between 2 and 60),
  arah text check (arah is null or arah in ('CR', 'DB')),
  akun_kode text not null,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now()
);
create index on public.aturan_rekon (perusahaan_id);

alter table public.rekening_kas enable row level security;
alter table public.mutasi_bank enable row level security;
alter table public.aturan_rekon enable row level security;
create policy rekening_kas_baca on public.rekening_kas for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy mutasi_bank_baca on public.mutasi_bank for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy aturan_rekon_baca on public.aturan_rekon for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.rekening_kas, public.mutasi_bank, public.aturan_rekon to authenticated;
create trigger audit_rekening_kas after insert or update or delete on public.rekening_kas for each row execute function app.catat_audit();
create trigger audit_mutasi_bank after update on public.mutasi_bank for each row execute function app.catat_audit();
create trigger audit_aturan_rekon after insert or update or delete on public.aturan_rekon for each row execute function app.catat_audit();

-- Kas dan Bank bawaan untuk setiap usaha yang membuka layar Kas.
create or replace function app.rekening_bawaan(p_pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.pasang_bagan_bawaan(p_pid);
  insert into public.rekening_kas (perusahaan_id, nama, jenis, akun_kode) values (p_pid, 'Kas', 'kas', '1-100'), (p_pid, 'Bank', 'bank', '1-110')
  on conflict (perusahaan_id, akun_kode) do nothing;
end $$;

-- Gabungkan baris jurnal per akun (debit dan kredit saling mengurangi), buang yang nol.
create or replace function app.jurnal_bersih(p_baris jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case when n > 0 then jsonb_build_object('akun', akun, 'debit', n) else jsonb_build_object('akun', akun, 'kredit', -n) end), '[]')
    from (select e ->> 'akun' as akun, sum(coalesce((e ->> 'debit')::bigint, 0) - coalesce((e ->> 'kredit')::bigint, 0)) as n
            from jsonb_array_elements(p_baris) e group by 1) s where n <> 0
$$;

create or replace function public.simpan_rekening(p_nama text, p_jenis text, p_nomor_akhir text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); v_awal text; v_kode text; r public.rekening_kas;
begin
  if p_jenis not in ('kas', 'bank', 'dompet') then raise exception 'Pilih kas, bank, atau dompet digital' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_nama, ''))) not between 1 and 60 then raise exception 'Tulis nama rekening, misalnya BCA usaha' using errcode = '22023'; end if;
  if p_nomor_akhir is not null and p_nomor_akhir <> '' and p_nomor_akhir !~ '^[0-9]{4}$' then raise exception 'Nomor rekening: tulis 4 angka terakhir saja' using errcode = '22023'; end if;
  perform app.rekening_bawaan(v_pid);
  v_awal := case when p_jenis = 'kas' then '1-10' else '1-11' end;
  select v_awal || g into v_kode from generate_series(1, 9) g
   where not exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = v_awal || g) order by g limit 1;
  if v_kode is null then raise exception 'Rekening % sudah 9, nonaktifkan yang tidak dipakai', p_jenis using errcode = '22023'; end if;
  perform app.akun_pastikan(v_pid, v_kode, left(btrim(p_nama), 60), 'aset', 'debit');
  insert into public.rekening_kas (perusahaan_id, nama, jenis, akun_kode, nomor_akhir)
  values (v_pid, btrim(p_nama), p_jenis, v_kode, nullif(p_nomor_akhir, '')) returning * into r;
  return jsonb_build_object('id', r.id, 'akun', r.akun_kode);
end $$;

-- Daftar rekening dengan saldo buku dan jumlah mutasi yang belum dicocokkan.
create or replace function public.daftar_rekening() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas();
begin
  perform app.rekening_bawaan(v_pid);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nama', r.nama, 'jenis', r.jenis, 'akun', r.akun_kode, 'nomor_akhir', r.nomor_akhir,
      'saldo', coalesce((select sum(b.debit - b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id
                          where b.perusahaan_id = v_pid and a.kode = r.akun_kode), 0),
      'belum', (select count(*) from public.mutasi_bank m where m.rekening_id = r.id and m.status = 'belum')) order by r.akun_kode), '[]')
    from public.rekening_kas r where r.perusahaan_id = v_pid and r.aktif);
end $$;

create or replace function public.transfer_kas(p_dari uuid, p_ke uuid, p_jumlah bigint, p_tanggal date, p_keterangan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); a public.rekening_kas; b public.rekening_kas; v_tgl date;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into a from public.rekening_kas where id = p_dari and perusahaan_id = v_pid and aktif;
  select * into b from public.rekening_kas where id = p_ke and perusahaan_id = v_pid and aktif;
  if a.id is null or b.id is null then raise exception 'Rekening tidak ditemukan' using errcode = 'P0002'; end if;
  if a.id = b.id then raise exception 'Pilih dua rekening yang berbeda' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah transfer harus lebih dari 0' using errcode = '22023'; end if;
  v_tgl := coalesce(p_tanggal, app.hari_ini(v_pid));
  if v_tgl > app.hari_ini(v_pid) then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;
  return app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left(coalesce(nullif(btrim(p_keterangan), ''), 'Pindah dana ' || a.nama || ' ke ' || b.nama), 200),
    'sumber', 'kas', 'kunci_idempoten', 'kas:' || p_kunci),
    jsonb_build_array(jsonb_build_object('akun', b.akun_kode, 'debit', p_jumlah), jsonb_build_object('akun', a.akun_kode, 'kredit', p_jumlah)), auth.uid());
end $$;

-- Terima atau kirim uang di luar invoice/tagihan: lawan akun dipilih (pendapatan lain, beban, modal, prive, ...).
create or replace function public.catat_kas(p_rekening uuid, p_arah text, p_jumlah bigint, p_akun text, p_tanggal date, p_keterangan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); r public.rekening_kas; v_tgl date;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into r from public.rekening_kas where id = p_rekening and perusahaan_id = v_pid and aktif;
  if not found then raise exception 'Rekening tidak ditemukan' using errcode = 'P0002'; end if;
  if p_arah not in ('masuk', 'keluar') then raise exception 'Pilih uang masuk atau keluar' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah harus lebih dari 0' using errcode = '22023'; end if;
  if p_akun is null or p_akun = r.akun_kode or not exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = p_akun) then
    raise exception 'Pilih akun lawan yang ada di bagan akun' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_keterangan, ''))) < 3 then raise exception 'Tulis keterangan, misalnya setoran modal' using errcode = '22023'; end if;
  v_tgl := coalesce(p_tanggal, app.hari_ini(v_pid));
  if v_tgl > app.hari_ini(v_pid) then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;
  return app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left(btrim(p_keterangan), 200), 'sumber', 'kas', 'kunci_idempoten', 'kas:' || p_kunci),
    case when p_arah = 'masuk' then jsonb_build_array(jsonb_build_object('akun', r.akun_kode, 'debit', p_jumlah), jsonb_build_object('akun', p_akun, 'kredit', p_jumlah))
         else jsonb_build_array(jsonb_build_object('akun', p_akun, 'debit', p_jumlah), jsonb_build_object('akun', r.akun_kode, 'kredit', p_jumlah)) end, auth.uid());
end $$;

-- Simpan baris mutasi; baris yang sama (tanggal, keterangan, jumlah, arah, urutan kemunculan) tidak masuk dua kali.
create or replace function app.impor_mutasi_inti(p_pid uuid, p_rekening uuid, p_baris jsonb, p_usulan uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e jsonb; v_masuk int := 0; v_ganda int := 0; v_lewat int := 0; v_tgl date; v_jml bigint; v_arah text; v_ket text; v_kunci text; v_kali jsonb := '{}'; v_n int;
begin
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) > 2000 then raise exception 'Kirim paling banyak 2.000 baris mutasi' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    begin
      v_tgl := (e ->> 'tanggal')::date;
      v_jml := round(abs((e ->> 'jumlah')::numeric))::bigint;
    exception when others then v_lewat := v_lewat + 1; continue;
    end;
    v_arah := upper(coalesce(e ->> 'arah', ''));
    if v_tgl is null or v_jml is null or v_jml <= 0 or v_arah not in ('CR', 'DB') then v_lewat := v_lewat + 1; continue; end if;
    v_ket := left(btrim(coalesce(e ->> 'keterangan', '')), 300);
    v_kunci := v_tgl || '|' || v_ket || '|' || v_jml || '|' || v_arah;
    v_n := coalesce((v_kali ->> v_kunci)::int, 0) + 1;
    v_kali := v_kali || jsonb_build_object(v_kunci, v_n);
    insert into public.mutasi_bank (perusahaan_id, rekening_id, tanggal, keterangan, jumlah, arah, sidik, usulan_id)
    values (p_pid, p_rekening, v_tgl, v_ket, v_jml, v_arah, md5(v_kunci || '|' || v_n), p_usulan)
    on conflict (rekening_id, sidik) do nothing;
    if found then v_masuk := v_masuk + 1; else v_ganda := v_ganda + 1; end if;
  end loop;
  return jsonb_build_object('masuk', v_masuk, 'ganda', v_ganda, 'dilewati', v_lewat);
end $$;

create or replace function public.impor_mutasi(p_rekening uuid, p_baris jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true);
begin
  if not exists (select 1 from public.rekening_kas where id = p_rekening and perusahaan_id = v_pid and aktif) then
    raise exception 'Rekening tidak ditemukan' using errcode = 'P0002';
  end if;
  return app.impor_mutasi_inti(v_pid, p_rekening, p_baris, null);
end $$;

-- E-statement lewat Lempar: usulan uang.mutasi yang disetujui masuk ke rekening bank pertama.
create or replace function app.mutasi_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_rek uuid;
begin
  perform app.rekening_bawaan(new.perusahaan_id);
  select id into v_rek from public.rekening_kas where perusahaan_id = new.perusahaan_id and jenis = 'bank' and aktif order by akun_kode limit 1;
  if v_rek is not null and jsonb_typeof(new.payload #> '{bidang,baris}') = 'array' then
    perform app.impor_mutasi_inti(new.perusahaan_id, v_rek, new.payload #> '{bidang,baris}', new.id);
  end if;
  return new;
end $$;
create trigger mutasi_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'uang.mutasi' and new.status = 'diterima' and old.status is distinct from 'diterima') execute function app.mutasi_dari_usulan();

create or replace function public.simpan_aturan_rekon(p_id uuid, p_kata text, p_arah text, p_akun text, p_aktif boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); r public.aturan_rekon;
begin
  if length(btrim(coalesce(p_kata, ''))) not between 2 and 60 then raise exception 'Tulis kata kunci 2 sampai 60 huruf, misalnya PLN' using errcode = '22023'; end if;
  if p_arah is not null and p_arah not in ('CR', 'DB') then raise exception 'Arah aturan masuk atau keluar' using errcode = '22023'; end if;
  if not exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = p_akun) then raise exception 'Pilih akun yang ada di bagan akun' using errcode = '22023'; end if;
  if exists (select 1 from public.rekening_kas k where k.perusahaan_id = v_pid and k.akun_kode = p_akun) then
    raise exception 'Akun aturan tidak boleh rekening kas atau bank; pakai Pindah dana' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.aturan_rekon (perusahaan_id, kata, arah, akun_kode) values (v_pid, upper(btrim(p_kata)), p_arah, p_akun) returning * into r;
  else
    update public.aturan_rekon set kata = upper(btrim(p_kata)), arah = p_arah, akun_kode = p_akun, aktif = coalesce(p_aktif, true)
     where id = p_id and perusahaan_id = v_pid returning * into r;
    if not found then raise exception 'Aturan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', r.id);
end $$;

-- Jurnal yang menyentuh akun rekening dan belum dicocokkan ke mutasi mana pun (kandidat "sudah tercatat").
create or replace function public.jurnal_kas_terbuka(p_rekening uuid, p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(); r public.rekening_kas;
begin
  select * into r from public.rekening_kas where id = p_rekening and perusahaan_id = v_pid;
  if not found then raise exception 'Rekening tidak ditemukan' using errcode = 'P0002'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'tanggal', x.tanggal, 'keterangan', x.keterangan, 'jumlah', abs(x.n), 'arah', case when x.n > 0 then 'CR' else 'DB' end)
      order by x.tanggal), '[]')
    from (select j.id, j.tanggal, j.keterangan, sum(b.debit - b.kredit) as n
            from public.jurnal j join public.jurnal_baris b on b.jurnal_id = j.id join public.akun a on a.id = b.akun_id
           where j.perusahaan_id = v_pid and a.kode = r.akun_kode and j.tanggal between p_dari and p_sampai
             and j.dibalik_oleh is null and j.membalik is null
             and not exists (select 1 from public.mutasi_bank m where m.perusahaan_id = v_pid and m.status = 'cocok'
                               and ((m.cocok_jenis = 'jurnal' and m.cocok_id = j.id::text) or j.id = any (m.jurnal_terkait)))
           group by j.id, j.tanggal, j.keterangan having sum(b.debit - b.kredit) <> 0) x);
end $$;

-- Jalankan satu pencocokan pilihan pemilik/admin.
create or replace function public.rekonsiliasi(p_mutasi uuid, p_jenis text, p_target text, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); m public.mutasi_bank; r public.rekening_kas; inv public.invoice; t public.tagihan_beli;
  v_sisa bigint; v_baris jsonb; v_jurnal uuid; v_terkait uuid[] := '{}'; x jsonb; v_n bigint;
begin
  select * into m from public.mutasi_bank where id = p_mutasi and perusahaan_id = v_pid for update;
  if not found then raise exception 'Mutasi tidak ditemukan' using errcode = 'P0002'; end if;
  if m.status <> 'belum' then return jsonb_build_object('id', m.id, 'sudah', true); end if;
  select * into r from public.rekening_kas where id = m.rekening_id;
  if p_jenis = 'abaikan' then
    update public.mutasi_bank set status = 'abaikan', alasan = left(coalesce(p_alasan, 'diabaikan'), 200), diputuskan_oleh = auth.uid(), diputuskan_at = now() where id = m.id;
    return jsonb_build_object('id', m.id, 'sudah', false);
  elsif p_jenis = 'invoice' then
    if m.arah <> 'CR' then raise exception 'Invoice hanya dicocokkan dengan uang masuk' using errcode = '22023'; end if;
    select * into inv from public.invoice where id = p_target::uuid and perusahaan_id = v_pid for update;
    if not found or inv.status <> 'terbit' then raise exception 'Invoice tidak ada atau sudah lunas/batal' using errcode = '22023'; end if;
    v_sisa := inv.total - inv.potong_piutang;
    if m.jumlah > v_sisa or v_sisa - m.jumlah > 10000 then raise exception 'Jumlah mutasi beda lebih dari Rp10.000 dari sisa invoice' using errcode = '22023'; end if;
    perform public.lunas_dipotong(inv.id, 'transfer', m.tanggal, 0, null);
    select jurnal_lunas into v_jurnal from public.invoice where id = inv.id;
    v_terkait := array[v_jurnal];
    -- Uang masuk ke rekening ini (bukan Bank bawaan) dan potongan biaya transfer menjadi biaya bank.
    perform app.akun_pastikan(v_pid, '6-910', 'Biaya bank', 'beban', 'debit');
    v_baris := app.jurnal_bersih(jsonb_build_array(jsonb_build_object('akun', r.akun_kode, 'debit', m.jumlah),
      jsonb_build_object('akun', '6-910', 'debit', v_sisa - m.jumlah), jsonb_build_object('akun', '1-110', 'kredit', v_sisa)));
  elsif p_jenis = 'tagihan_beli' then
    if m.arah <> 'DB' then raise exception 'Tagihan pemasok hanya dicocokkan dengan uang keluar' using errcode = '22023'; end if;
    select * into t from public.tagihan_beli where id = p_target::uuid and perusahaan_id = v_pid;
    if not found or t.status <> 'terbuka' then raise exception 'Tagihan pemasok tidak ada atau sudah lunas' using errcode = '22023'; end if;
    x := public.bayar_tagihan_beli(t.id, m.jumlah, 'transfer', m.tanggal, md5('rekon:' || m.id)::uuid);
    select jurnal_id into v_jurnal from public.bayar_beli where id = (x ->> 'id')::uuid;
    v_terkait := array[v_jurnal];
    v_baris := app.jurnal_bersih(jsonb_build_array(jsonb_build_object('akun', '1-110', 'debit', m.jumlah), jsonb_build_object('akun', r.akun_kode, 'kredit', m.jumlah)));
  elsif p_jenis = 'jurnal' then
    select sum(b.debit - b.kredit) into v_n from public.jurnal j join public.jurnal_baris b on b.jurnal_id = j.id join public.akun a on a.id = b.akun_id
     where j.id = p_target::uuid and j.perusahaan_id = v_pid and a.kode = r.akun_kode and j.dibalik_oleh is null;
    if v_n is null or v_n <> (case when m.arah = 'CR' then m.jumlah else -m.jumlah end) then
      raise exception 'Jurnal itu tidak bernilai sama di rekening ini' using errcode = '22023';
    end if;
    if exists (select 1 from public.mutasi_bank o where o.perusahaan_id = v_pid and o.status = 'cocok'
                 and ((o.cocok_jenis = 'jurnal' and o.cocok_id = p_target) or p_target::uuid = any (o.jurnal_terkait))) then
      raise exception 'Jurnal itu sudah dicocokkan dengan mutasi lain' using errcode = '23505';
    end if;
    v_baris := '[]';
  elsif p_jenis = 'akun' then
    if p_target is null or p_target = r.akun_kode or not exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = p_target) then
      raise exception 'Pilih akun lawan yang ada di bagan akun' using errcode = '22023';
    end if;
    v_baris := case when m.arah = 'CR' then jsonb_build_array(jsonb_build_object('akun', r.akun_kode, 'debit', m.jumlah), jsonb_build_object('akun', p_target, 'kredit', m.jumlah))
                    else jsonb_build_array(jsonb_build_object('akun', p_target, 'debit', m.jumlah), jsonb_build_object('akun', r.akun_kode, 'kredit', m.jumlah)) end;
  else
    raise exception 'Jenis pencocokan tidak dikenal' using errcode = '22023';
  end if;
  if jsonb_array_length(v_baris) > 0 then
    x := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', m.tanggal, 'keterangan', left('Mutasi ' || r.nama || ': ' || coalesce(nullif(m.keterangan, ''), '-'), 200),
      'sumber', 'rekonsiliasi', 'sumber_id', m.id::text, 'kunci_idempoten', 'rekon:' || m.id), v_baris, auth.uid());
    v_jurnal := (x ->> 'id')::uuid;
    v_terkait := v_terkait || v_jurnal;
  elsif p_jenis <> 'jurnal' then
    v_jurnal := null;
  end if;
  update public.mutasi_bank set status = 'cocok', cocok_jenis = p_jenis, cocok_id = p_target, alasan = left(p_alasan, 200),
         jurnal_id = case when jsonb_array_length(v_baris) > 0 then v_jurnal end, jurnal_terkait = array_remove(v_terkait, null),
         diputuskan_oleh = auth.uid(), diputuskan_at = now()
   where id = m.id;
  return jsonb_build_object('id', m.id, 'sudah', false, 'jurnal', case when jsonb_array_length(v_baris) > 0 then v_jurnal end);
end $$;

-- Batalkan pencocokan (Mekari: mengembalikan rekonsiliasi). Jurnal yang dibuat rekonsiliasi dibalik; invoice lunas dan
-- pembayaran pemasok tidak dibatalkan dari sini karena punya jejak sendiri.
create or replace function public.batal_rekonsiliasi(p_mutasi uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kas(true); m public.mutasi_bank;
begin
  select * into m from public.mutasi_bank where id = p_mutasi and perusahaan_id = v_pid for update;
  if not found then raise exception 'Mutasi tidak ditemukan' using errcode = 'P0002'; end if;
  if m.status = 'belum' then return jsonb_build_object('id', m.id, 'sudah', true); end if;
  if m.cocok_jenis in ('invoice', 'tagihan_beli') then
    raise exception 'Pencocokan ke invoice atau tagihan pemasok tidak bisa dibatalkan di sini' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan pembatalan' using errcode = '22023'; end if;
  if m.jurnal_id is not null then perform public.balik_jurnal(m.jurnal_id, p_alasan); end if;
  update public.mutasi_bank set status = 'belum', cocok_jenis = null, cocok_id = null, jurnal_id = null, jurnal_terkait = '{}', alasan = null,
         diputuskan_oleh = auth.uid(), diputuskan_at = now() where id = m.id;
  return jsonb_build_object('id', m.id, 'sudah', false);
end $$;

revoke all on function app.wajib_kas(boolean), app.rekening_bawaan(uuid), app.jurnal_bersih(jsonb), app.impor_mutasi_inti(uuid, uuid, jsonb, uuid), app.mutasi_dari_usulan() from public, anon, authenticated;
revoke all on function public.simpan_rekening(text, text, text), public.daftar_rekening(), public.transfer_kas(uuid, uuid, bigint, date, text, uuid),
  public.catat_kas(uuid, text, bigint, text, date, text, uuid), public.impor_mutasi(uuid, jsonb), public.simpan_aturan_rekon(uuid, text, text, text, boolean),
  public.jurnal_kas_terbuka(uuid, date, date), public.rekonsiliasi(uuid, text, text, text), public.batal_rekonsiliasi(uuid, text) from public, anon;
grant execute on function public.simpan_rekening(text, text, text), public.daftar_rekening(), public.transfer_kas(uuid, uuid, bigint, date, text, uuid),
  public.catat_kas(uuid, text, bigint, text, date, text, uuid), public.impor_mutasi(uuid, jsonb), public.simpan_aturan_rekon(uuid, text, text, text, boolean),
  public.jurnal_kas_terbuka(uuid, date, date), public.rekonsiliasi(uuid, text, text, text), public.batal_rekonsiliasi(uuid, text) to authenticated;
