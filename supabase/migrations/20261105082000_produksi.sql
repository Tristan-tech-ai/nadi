-- M-07 produksi: BoM bertingkat, perintah kerja (PK), ambil bahan ke barang dalam proses (1-320), hasil multiproduk, biaya standar
-- sebagai pembanding, rakit dan bongkar. Dasar penilaian IAS 2 (IFRS Foundation, dibaca 6 Nov 2026): biaya persediaan hasil = bahan +
-- biaya konversi (par. 12); produk bersama dialokasikan menurut nilai jual relatif, produk sampingan dinilai pada nilai realisasi neto
-- lalu dikurangkan dari biaya produk utama (par. 14); biaya standar boleh dipakai bila hasilnya mendekati biaya (par. 21), jadi Nadi
-- menilai hasil pada biaya aktual dan menampilkan selisih terhadap standar, tanpa memindahkan selisih ke akun lain.
-- Jurnal: ambil bahan D 1-320 / K 1-300; konversi dibebankan D 1-320 / K 5-310; hasil masuk D 1-300 / K 1-320 (saldo PK kembali 0).

create table public.bom (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  product_id uuid not null references public.produk(id) on delete cascade,
  output_qty numeric not null check (output_qty > 0 and output_qty <= 100000000),
  conversion_cost bigint not null default 0 check (conversion_cost >= 0),
  materials jsonb not null check (jsonb_typeof(materials) = 'array' and jsonb_array_length(materials) between 1 and 100),
  other_outputs jsonb not null default '[]' check (jsonb_typeof(other_outputs) = 'array' and jsonb_array_length(other_outputs) <= 20),
  note text check (note is null or length(note) <= 300),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, product_id)
);

create table public.work_order (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kind text not null default 'produce' check (kind in ('produce', 'assemble', 'disassemble')),
  nomor text not null,
  nomor_terbit_id uuid,
  bom_id uuid references public.bom(id) on delete set null,
  product_id uuid not null references public.produk(id),
  planned_qty numeric not null check (planned_qty > 0),
  factor numeric not null check (factor > 0),
  status text not null default 'planned' check (status in ('planned', 'running', 'done', 'cancelled')),
  gudang_id uuid not null references public.gudang(id),
  standard_unit_cost bigint not null default 0,
  material_cost bigint not null default 0,
  conversion_cost bigint not null default 0,
  issued jsonb not null default '[]',
  outputs jsonb not null default '[]',
  variance bigint,
  tanggal date not null,
  selesai_at timestamptz,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, nomor)
);
create index work_order_status on public.work_order (perusahaan_id, status, dibuat_at desc);

alter table public.bom enable row level security;
alter table public.work_order enable row level security;
create policy bom_baca on public.bom for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy work_order_baca on public.work_order for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.bom, public.work_order to authenticated;

create or replace function app.production_accounts(p_pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.pasang_akun_stok(p_pid);
  perform app.akun_pastikan(p_pid, '1-320', 'Barang dalam proses produksi', 'aset', 'debit');
  perform app.akun_pastikan(p_pid, '5-310', 'Biaya konversi dibebankan ke produksi', 'beban', 'debit');
end $$;

-- Biaya rata-rata sekarang per satuan (semua gudang); 0 bila belum ada stok.
create or replace function app.avg_unit_cost(p_pid uuid, p_produk uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when coalesce(sum(jumlah), 0) > 0 then sum(nilai)::numeric / sum(jumlah) else 0 end from public.stok where perusahaan_id = p_pid and produk_id = p_produk
$$;

-- Biaya standar per satuan hasil utama: bahan x biaya rata-rata (bahan berBoM tanpa stok memakai standarnya sendiri) + konversi.
create or replace function app.standard_unit_cost(p_pid uuid, p_produk uuid, p_depth int default 0) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare b public.bom; e jsonb; v numeric := 0; c numeric;
begin
  if p_depth > 10 then raise exception 'BoM bertingkat lebih dari 10 lapis' using errcode = '22023'; end if;
  select * into b from public.bom where perusahaan_id = p_pid and product_id = p_produk;
  if not found then return app.avg_unit_cost(p_pid, p_produk); end if;
  for e in select * from jsonb_array_elements(b.materials) loop
    c := app.avg_unit_cost(p_pid, (e ->> 'produk')::uuid);
    if c = 0 and exists (select 1 from public.bom where perusahaan_id = p_pid and product_id = (e ->> 'produk')::uuid) then
      c := app.standard_unit_cost(p_pid, (e ->> 'produk')::uuid, p_depth + 1);
    end if;
    v := v + c * (e ->> 'jumlah')::numeric;
  end loop;
  return (v + b.conversion_cost) / b.output_qty;
end $$;

-- Simpan BoM (satu per produk hasil): {produk, jumlah_hasil, biaya_konversi, bahan:[{produk, jumlah}], hasil_lain:[{produk, jumlah, jenis bersama|sampingan}], catatan}.
create or replace function public.save_bom(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_out uuid := (p ->> 'produk')::uuid; e jsonb; v_bahan jsonb := '[]'; v_lain jsonb := '[]'; pr public.produk; v_id uuid;
  v_seen uuid[] := '{}'; v_j numeric;
begin
  select * into pr from public.produk where id = v_out and perusahaan_id = v_pid;
  if not found or pr.jenis <> 'barang' then raise exception 'Pilih produk hasil berjenis barang' using errcode = '22023'; end if;
  v_seen := array[v_out];
  for e in select * from jsonb_array_elements(coalesce(p -> 'bahan', '[]')) loop
    v_j := (e ->> 'jumlah')::numeric;
    if v_j is null or v_j <= 0 then raise exception 'Jumlah bahan harus lebih dari 0' using errcode = '22023'; end if;
    select * into pr from public.produk where id = (e ->> 'produk')::uuid and perusahaan_id = v_pid;
    if not found or pr.jenis <> 'barang' then raise exception 'Bahan harus produk berjenis barang' using errcode = '22023'; end if;
    if pr.id = any (v_seen) then raise exception 'Bahan % tertulis dua kali atau sama dengan hasil', pr.nama using errcode = '22023'; end if;
    v_seen := v_seen || pr.id;
    v_bahan := v_bahan || jsonb_build_object('produk', pr.id, 'jumlah', v_j);
  end loop;
  if jsonb_array_length(v_bahan) = 0 then raise exception 'BoM butuh minimal satu bahan' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(coalesce(p -> 'hasil_lain', '[]')) loop
    v_j := (e ->> 'jumlah')::numeric;
    if v_j is null or v_j <= 0 then raise exception 'Jumlah hasil lain harus lebih dari 0' using errcode = '22023'; end if;
    if coalesce(e ->> 'jenis', '') not in ('bersama', 'sampingan') then raise exception 'Hasil lain berjenis bersama atau sampingan' using errcode = '22023'; end if;
    select * into pr from public.produk where id = (e ->> 'produk')::uuid and perusahaan_id = v_pid;
    if not found or pr.jenis <> 'barang' then raise exception 'Hasil lain harus produk berjenis barang' using errcode = '22023'; end if;
    if pr.id = any (v_seen) then raise exception 'Produk % sudah dipakai di BoM ini', pr.nama using errcode = '22023'; end if;
    v_seen := v_seen || pr.id;
    v_lain := v_lain || jsonb_build_object('produk', pr.id, 'jumlah', v_j, 'jenis', e ->> 'jenis');
  end loop;
  -- Bertingkat tanpa lingkaran: hasil tidak boleh muncul sebagai bahan di BoM bahan-bahannya (berapa pun lapisnya).
  if exists (
    with recursive t(produk, d) as (
      select (x ->> 'produk')::uuid, 1 from jsonb_array_elements(v_bahan) x
      union all
      select (m ->> 'produk')::uuid, t.d + 1 from t join public.bom b on b.perusahaan_id = v_pid and b.product_id = t.produk
        cross join lateral jsonb_array_elements(b.materials) m where t.d < 12)
    select 1 from t where produk = v_out) then
    raise exception 'BoM melingkar: hasil dipakai lagi sebagai bahan di lapis bawahnya' using errcode = '22023';
  end if;
  insert into public.bom (perusahaan_id, product_id, output_qty, conversion_cost, materials, other_outputs, note, dibuat_oleh)
  values (v_pid, v_out, (p ->> 'jumlah_hasil')::numeric, coalesce((p ->> 'biaya_konversi')::bigint, 0), v_bahan, v_lain,
          nullif(left(btrim(coalesce(p ->> 'catatan', '')), 300), ''), auth.uid())
  on conflict (perusahaan_id, product_id) do update set output_qty = excluded.output_qty, conversion_cost = excluded.conversion_cost,
    materials = excluded.materials, other_outputs = excluded.other_outputs, note = excluded.note, diubah_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Kebutuhan bahan mentah untuk p_jumlah hasil: bahan yang punya BoM sendiri diurai sampai bahan tanpa BoM.
create or replace function public.explode_bom(p_produk uuid, p_jumlah numeric) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan' using errcode = '42501';
  end if;
  return coalesce((
    with recursive t(produk, jumlah, d) as (
      select (m ->> 'produk')::uuid, (m ->> 'jumlah')::numeric * p_jumlah / b.output_qty, 1
        from public.bom b cross join lateral jsonb_array_elements(b.materials) m where b.perusahaan_id = v_pid and b.product_id = p_produk
      union all
      select (m ->> 'produk')::uuid, (m ->> 'jumlah')::numeric * t.jumlah / b.output_qty, t.d + 1
        from t join public.bom b on b.perusahaan_id = v_pid and b.product_id = t.produk cross join lateral jsonb_array_elements(b.materials) m where t.d < 11)
    select jsonb_agg(jsonb_build_object('produk', x.produk, 'kode', pr.kode, 'nama', pr.nama, 'satuan', pr.satuan, 'jumlah', round(x.j, 4),
             'stok', coalesce((select sum(s.jumlah) from public.stok s where s.produk_id = x.produk), 0)) order by pr.nama)
      from (select produk, sum(jumlah) j from t where not exists (select 1 from public.bom b where b.perusahaan_id = v_pid and b.product_id = t.produk)
            group by produk) x join public.produk pr on pr.id = x.produk), '[]');
end $$;

create or replace function public.create_work_order(p_produk uuid, p_jumlah numeric, p_kunci uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); b public.bom; w public.work_order; r jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into w from public.work_order where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return w.id; end if;
  select * into b from public.bom where perusahaan_id = v_pid and product_id = p_produk;
  if not found then raise exception 'Produk ini belum punya BoM' using errcode = 'P0002'; end if;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > 100000000 then raise exception 'Jumlah hasil harus lebih dari 0' using errcode = '22023'; end if;
  perform app.production_accounts(v_pid);
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'PK', 'Perintah kerja', '{no:3}/PK/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, 'PK', 'perintah kerja ' || p_kunci, auth.uid());
  insert into public.work_order (perusahaan_id, nomor, nomor_terbit_id, bom_id, product_id, planned_qty, factor, gudang_id, standard_unit_cost, tanggal, kunci_klien, dibuat_oleh)
  values (v_pid, r ->> 'nomor', (r ->> 'id')::uuid, b.id, p_produk, p_jumlah, p_jumlah / b.output_qty, app.gudang_utama(v_pid),
          round(app.standard_unit_cost(v_pid, p_produk))::bigint, app.hari_ini(v_pid), p_kunci, auth.uid())
  returning * into w;
  return w.id;
end $$;

-- Ambil bahan: bawaan BoM x faktor, atau jumlah sebenarnya p_aktual [{produk, jumlah}] untuk bahan BoM.
create or replace function public.issue_work_order(p_wo uuid, p_aktual jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); w public.work_order; b public.bom; e jsonb; v_j numeric; r jsonb; v_tot bigint := 0; v_out jsonb := '[]'; i int := 0;
begin
  select * into w from public.work_order where id = p_wo and perusahaan_id = v_pid for update;
  if not found then raise exception 'Perintah kerja tidak ditemukan' using errcode = 'P0002'; end if;
  if w.status <> 'planned' then return jsonb_build_object('nomor', w.nomor, 'biaya_bahan', w.material_cost, 'baru', false); end if;
  select * into b from public.bom where id = w.bom_id;
  if not found then raise exception 'BoM perintah kerja ini sudah dihapus' using errcode = 'P0002'; end if;
  for e in select * from jsonb_array_elements(b.materials) loop
    i := i + 1;
    v_j := coalesce((select (a ->> 'jumlah')::numeric from jsonb_array_elements(coalesce(p_aktual, '[]')) a where a ->> 'produk' = e ->> 'produk' limit 1),
                    round((e ->> 'jumlah')::numeric * w.factor, 4));
    if v_j < 0 then raise exception 'Jumlah bahan tidak boleh negatif' using errcode = '22023'; end if;
    continue when v_j = 0;
    r := app.gerak_stok(v_pid, (e ->> 'produk')::uuid, w.gudang_id, -v_j, null, 'keluar', w.tanggal, 'Bahan ' || w.nomor, 'produksi', w.id::text, 'pk:' || w.id || ':ambil:' || i);
    v_tot := v_tot - (r ->> 'nilai')::bigint;
    v_out := v_out || jsonb_build_object('produk', e ->> 'produk', 'jumlah', v_j, 'nilai', -(r ->> 'nilai')::bigint);
  end loop;
  if v_tot > 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', w.tanggal, 'keterangan', left('Ambil bahan ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
      'kunci_idempoten', 'pk:' || w.id || ':ambil'), jsonb_build_array(jsonb_build_object('akun', '1-320', 'debit', v_tot), jsonb_build_object('akun', '1-300', 'kredit', v_tot)), auth.uid());
  end if;
  update public.work_order set status = 'running', material_cost = v_tot, issued = v_out where id = w.id;
  return jsonb_build_object('nomor', w.nomor, 'biaya_bahan', v_tot, 'baru', true);
end $$;

-- Selesai: konversi dibebankan, hasil masuk gudang pada biaya aktual. p_hasil = jumlah hasil utama sebenarnya (bawaan rencana);
-- p_lain [{produk, jumlah}] menimpa jumlah hasil lain dari BoM x faktor.
create or replace function app.finish_work_order(p_pid uuid, p_wo uuid, p_hasil numeric, p_lain jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w public.work_order; b public.bom; e jsonb; v_konv bigint; v_tot bigint; v_sisa bigint; v_samping bigint := 0; v_lines jsonb := '[]';
  v_bobot numeric := 0; v_n int; i int := 0; v_nilai bigint; v_alok bigint := 0; x jsonb; v_hasil numeric; v_harga numeric; v_var bigint;
begin
  select * into w from public.work_order where id = p_wo and perusahaan_id = p_pid for update;
  if w.status <> 'running' then raise exception 'Ambil bahan dulu sebelum menyelesaikan perintah kerja' using errcode = '22023'; end if;
  select * into b from public.bom where id = w.bom_id;
  v_hasil := coalesce(p_hasil, w.planned_qty);
  if v_hasil <= 0 then raise exception 'Jumlah hasil harus lebih dari 0' using errcode = '22023'; end if;
  v_konv := round(b.conversion_cost * w.factor)::bigint;
  v_tot := w.material_cost + v_konv;
  -- Baris hasil: utama dulu, lalu hasil lain.
  v_lines := jsonb_build_array(jsonb_build_object('produk', w.product_id, 'jumlah', v_hasil, 'jenis', 'utama'));
  for e in select * from jsonb_array_elements(b.other_outputs) loop
    v_lines := v_lines || jsonb_build_object('produk', e ->> 'produk', 'jenis', e ->> 'jenis',
      'jumlah', coalesce((select (a ->> 'jumlah')::numeric from jsonb_array_elements(coalesce(p_lain, '[]')) a where a ->> 'produk' = e ->> 'produk' limit 1),
                         round((e ->> 'jumlah')::numeric * w.factor, 4)));
  end loop;
  -- Sampingan pada nilai realisasi neto (harga jual x jumlah), dikurangkan dari biaya; sisanya dibagi utama + bersama menurut nilai jual relatif.
  for x in select * from jsonb_array_elements(v_lines) loop
    select harga_jual into v_harga from public.produk where id = (x ->> 'produk')::uuid;
    if x ->> 'jenis' = 'sampingan' then v_samping := v_samping + round(coalesce(v_harga, 0) * (x ->> 'jumlah')::numeric)::bigint;
    elsif (x ->> 'jumlah')::numeric > 0 then v_bobot := v_bobot + coalesce(v_harga, 0) * (x ->> 'jumlah')::numeric; end if;
  end loop;
  v_samping := least(v_samping, v_tot);
  v_sisa := v_tot - v_samping;
  select count(*) into v_n from jsonb_array_elements(v_lines) x where x ->> 'jenis' <> 'sampingan' and (x ->> 'jumlah')::numeric > 0;
  if v_konv > 0 then
    perform app.posting_jurnal(p_pid, jsonb_build_object('tanggal', w.tanggal, 'keterangan', left('Biaya konversi ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
      'kunci_idempoten', 'pk:' || w.id || ':konversi'), jsonb_build_array(jsonb_build_object('akun', '1-320', 'debit', v_konv), jsonb_build_object('akun', '5-310', 'kredit', v_konv)), auth.uid());
  end if;
  x := '[]';
  for e in select * from jsonb_array_elements(v_lines) loop
    i := i + 1;
    continue when (e ->> 'jumlah')::numeric <= 0;
    select harga_jual into v_harga from public.produk where id = (e ->> 'produk')::uuid;
    if e ->> 'jenis' = 'sampingan' then
      v_nilai := least(round(coalesce(v_harga, 0) * (e ->> 'jumlah')::numeric)::bigint, v_samping);
      v_samping := v_samping - v_nilai;
    else
      v_n := v_n - 1;
      v_nilai := case when v_n = 0 then v_sisa - v_alok
                      when v_bobot > 0 then round(v_sisa * coalesce(v_harga, 0) * (e ->> 'jumlah')::numeric / v_bobot)::bigint
                      else 0 end;
      v_alok := v_alok + v_nilai;
    end if;
    perform app.gerak_stok(p_pid, (e ->> 'produk')::uuid, w.gudang_id, (e ->> 'jumlah')::numeric, v_nilai, 'masuk', w.tanggal, 'Hasil ' || w.nomor, 'produksi', w.id::text,
      'pk:' || w.id || ':hasil:' || i);
    x := x || (e || jsonb_build_object('nilai', v_nilai));
  end loop;
  if v_tot > 0 then
    perform app.posting_jurnal(p_pid, jsonb_build_object('tanggal', w.tanggal, 'keterangan', left('Hasil produksi ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
      'kunci_idempoten', 'pk:' || w.id || ':hasil'), jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_tot), jsonb_build_object('akun', '1-320', 'kredit', v_tot)), auth.uid());
  end if;
  v_var := v_tot - round(w.standard_unit_cost * v_hasil)::bigint;
  update public.work_order set status = 'done', conversion_cost = v_konv, outputs = x, variance = v_var, selesai_at = now() where id = w.id;
  return jsonb_build_object('nomor', w.nomor, 'biaya_total', v_tot, 'biaya_satuan', round(v_tot::numeric / v_hasil), 'standar', w.standard_unit_cost, 'selisih', v_var, 'hasil', x);
end $$;

create or replace function public.complete_work_order(p_wo uuid, p_hasil numeric default null, p_lain jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); w public.work_order;
begin
  select * into w from public.work_order where id = p_wo and perusahaan_id = v_pid;
  if not found then raise exception 'Perintah kerja tidak ditemukan' using errcode = 'P0002'; end if;
  if w.status = 'done' then return jsonb_build_object('nomor', w.nomor, 'selisih', w.variance, 'hasil', w.outputs, 'baru', false); end if;
  return app.finish_work_order(v_pid, p_wo, p_hasil, p_lain);
end $$;

-- Batal: rencana langsung batal; yang sudah mengambil bahan mengembalikan bahan senilai saat diambil dan membalik jurnalnya.
create or replace function public.cancel_work_order(p_wo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); w public.work_order; e jsonb; i int := 0;
begin
  select * into w from public.work_order where id = p_wo and perusahaan_id = v_pid for update;
  if not found then raise exception 'Perintah kerja tidak ditemukan' using errcode = 'P0002'; end if;
  if w.status in ('done', 'cancelled') then raise exception 'Perintah kerja yang sudah selesai atau batal tidak bisa dibatalkan' using errcode = '22023'; end if;
  if w.status = 'running' then
    for e in select * from jsonb_array_elements(w.issued) loop
      i := i + 1;
      perform app.gerak_stok(v_pid, (e ->> 'produk')::uuid, w.gudang_id, (e ->> 'jumlah')::numeric, (e ->> 'nilai')::bigint, 'balik', app.hari_ini(v_pid),
        'Batal ' || w.nomor, 'produksi', w.id::text, 'pk:' || w.id || ':balik:' || i);
    end loop;
    if w.material_cost > 0 then
      perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', app.hari_ini(v_pid), 'keterangan', left('Batal ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
        'kunci_idempoten', 'pk:' || w.id || ':batal'), jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', w.material_cost), jsonb_build_object('akun', '1-320', 'kredit', w.material_cost)), auth.uid());
    end if;
  end if;
  update public.work_order set status = 'cancelled', selesai_at = now() where id = w.id;
end $$;

-- Rakit: perintah kerja satu langkah (ambil bahan dan selesai sekaligus).
create or replace function public.assemble_product(p_produk uuid, p_jumlah numeric, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_wo uuid; w public.work_order;
begin
  v_wo := public.create_work_order(p_produk, p_jumlah, p_kunci);
  select * into w from public.work_order where id = v_wo;
  if w.status = 'done' then return jsonb_build_object('nomor', w.nomor, 'hasil', w.outputs, 'baru', false); end if;
  update public.work_order set kind = 'assemble' where id = v_wo;
  perform public.issue_work_order(v_wo, null);
  return app.finish_work_order(v_pid, v_wo, p_jumlah, null);
end $$;

-- Bongkar: barang jadi keluar senilai rata-rata, bahan BoM masuk kembali; nilai dibagi menurut biaya standar bahan (tanpa jurnal:
-- nilai pindah di dalam 1-300 Persediaan).
create or replace function public.disassemble_product(p_produk uuid, p_jumlah numeric, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); b public.bom; w public.work_order; r jsonb; r2 jsonb; v_nilai bigint; e jsonb; v_bobot numeric := 0; v_c numeric;
  v_n int; i int := 0; v_alok bigint := 0; v_v bigint; v_out jsonb := '[]'; v_g uuid;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into w from public.work_order where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('nomor', w.nomor, 'hasil', w.outputs, 'baru', false); end if;
  select * into b from public.bom where perusahaan_id = v_pid and product_id = p_produk;
  if not found then raise exception 'Produk ini belum punya BoM' using errcode = 'P0002'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah bongkar harus lebih dari 0' using errcode = '22023'; end if;
  v_g := app.gudang_utama(v_pid);
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'PK', 'Perintah kerja', '{no:3}/PK/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, 'PK', 'bongkar ' || p_kunci, auth.uid());
  insert into public.work_order (perusahaan_id, kind, nomor, nomor_terbit_id, bom_id, product_id, planned_qty, factor, status, gudang_id, tanggal, kunci_klien, dibuat_oleh)
  values (v_pid, 'disassemble', r ->> 'nomor', (r ->> 'id')::uuid, b.id, p_produk, p_jumlah, p_jumlah / b.output_qty, 'running', v_g, app.hari_ini(v_pid), p_kunci, auth.uid())
  returning * into w;
  r2 := app.gerak_stok(v_pid, p_produk, v_g, -p_jumlah, null, 'keluar', w.tanggal, 'Bongkar ' || w.nomor, 'produksi', w.id::text, 'pk:' || w.id || ':bongkar');
  v_nilai := -(r2 ->> 'nilai')::bigint;
  for e in select * from jsonb_array_elements(b.materials) loop
    v_bobot := v_bobot + app.standard_unit_cost(v_pid, (e ->> 'produk')::uuid) * (e ->> 'jumlah')::numeric;
  end loop;
  v_n := jsonb_array_length(b.materials);
  for e in select * from jsonb_array_elements(b.materials) loop
    i := i + 1;
    v_c := app.standard_unit_cost(v_pid, (e ->> 'produk')::uuid) * (e ->> 'jumlah')::numeric;
    v_v := case when i = v_n then v_nilai - v_alok
                when v_bobot > 0 then round(v_nilai * v_c / v_bobot)::bigint
                else round(v_nilai::numeric / v_n)::bigint end;
    v_alok := v_alok + v_v;
    perform app.gerak_stok(v_pid, (e ->> 'produk')::uuid, v_g, round((e ->> 'jumlah')::numeric * w.factor, 4), v_v, 'masuk', w.tanggal, 'Bongkar ' || w.nomor,
      'produksi', w.id::text, 'pk:' || w.id || ':bahan:' || i);
    v_out := v_out || jsonb_build_object('produk', e ->> 'produk', 'jumlah', round((e ->> 'jumlah')::numeric * w.factor, 4), 'nilai', v_v);
  end loop;
  update public.work_order set status = 'done', material_cost = v_nilai, outputs = v_out, selesai_at = now() where id = w.id;
  return jsonb_build_object('nomor', w.nomor, 'nilai', v_nilai, 'hasil', v_out, 'baru', true);
end $$;

revoke all on function app.production_accounts(uuid), app.avg_unit_cost(uuid, uuid), app.standard_unit_cost(uuid, uuid, int),
  app.finish_work_order(uuid, uuid, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.save_bom(jsonb), public.explode_bom(uuid, numeric), public.create_work_order(uuid, numeric, uuid),
  public.issue_work_order(uuid, jsonb), public.complete_work_order(uuid, numeric, jsonb), public.cancel_work_order(uuid),
  public.assemble_product(uuid, numeric, uuid), public.disassemble_product(uuid, numeric, uuid) from public, anon;
grant execute on function public.save_bom(jsonb), public.explode_bom(uuid, numeric), public.create_work_order(uuid, numeric, uuid),
  public.issue_work_order(uuid, jsonb), public.complete_work_order(uuid, numeric, jsonb), public.cancel_work_order(uuid),
  public.assemble_product(uuid, numeric, uuid), public.disassemble_product(uuid, numeric, uuid) to authenticated;
