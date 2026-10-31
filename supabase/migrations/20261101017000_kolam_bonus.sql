-- F3-05 Kolam Bonus Beban (rancangan docs/design/kolam-bonus-beban.md, rencana uji docs/quality/rencana-uji-f3-05.md).
-- Pemilik menetapkan kolam rupiah untuk satu bulan; Nadi membaginya menurut poin kerja selesai (kerja.poin_beban, sama dengan
-- KPI F3-03 dan beban F3-02) di bulan itu menurut zona usaha (app.zona, Q-24). Pembulatan sisa terbesar: setiap orang mendapat
-- bagian bulat ke bawah, lalu sisa rupiah dibagikan satu per satu ke sisa pecahan terbesar, seri diputus urut id orang, sehingga
-- jumlah bagian = kolam persis. Hitungan memakai div/mod numeric (pasti, tanpa pembulatan pecahan).
-- Dasar aturan: PP 36/2021 Pasal 8 ayat (2) dan Pasal 10 (insentif, pendapatan non-upah, ditetapkan sesuai kebijakan
-- perusahaan). Komponen slip berlabel "Insentif beban kerja", bukan bonus Pasal 11 (atas keuntungan, diatur PK/PP/PKB).
-- Hak: pratinjau pemilik/admin; simpan, setujui, batal hanya pemilik; semua lewat app.peran_aktif() (tabel anggota yang aktif),
-- bukan klaim prn di JWT (Q-21/Q-23). Staf membaca bagiannya sendiri lewat kolam_saya, tanpa jumlah kolam atau angka rekan.
-- Ambang: kurang dari 5 kerja berpoin selesai (setelah pengecualian) menolak pembagian. Kerja batal dan di luar bulan tidak
-- dihitung; kerja dengan banding kpi.banding menunggu tetap dihitung dan ditandai. Kerja selesai tanpa poin dicatat terpisah.
-- Slip: setelah disetujui (atau dibatalkan) komponen insentif_beban disisipkan ke (atau dicabut dari) slip draf bulan itu dengan
-- peringatan bahwa PPh 21 perlu disusun ulang; susunSlip (apps/web/src/lib/gaji/susun.ts) memasukkannya ke bruto PPh 21 dan
-- tidak ke dasar iuran BPJS. Bulan yang periode gajinya sudah disetujui terkunci: kolam baru, persetujuan, dan pembatalan ditolak.
-- Persetujuan manusia ini tidak dicatat di public.keputusan (tabel itu untuk keputusan otomatis, dan ringkasannya menghitung
-- tingkat 'manusia' sebagai usulan yang diserahkan ke manusia); jejaknya ada di kolom kolam_bonus dan audit_log.

create table public.kolam_bonus (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  jumlah bigint not null check (jumlah > 0 and jumlah <= 10000000000),
  status text not null default 'draf' check (status in ('draf', 'disetujui', 'batal')),
  dikecualikan jsonb not null default '[]'::jsonb check (jsonb_typeof(dikecualikan) = 'array' and pg_column_size(dikecualikan) < 32768),
  total_poin numeric not null,
  kerja_n integer not null,
  dibuat_oleh uuid not null,
  dibuat_at timestamptz not null default now(),
  disetujui_oleh uuid,
  disetujui_at timestamptz,
  dibatalkan_oleh uuid,
  dibatalkan_at timestamptz,
  alasan_batal text,
  kunci_klien uuid
);
create unique index kolam_bonus_kunci_unik on public.kolam_bonus (perusahaan_id, kunci_klien) where kunci_klien is not null;
create unique index kolam_bonus_satu_disetujui on public.kolam_bonus (perusahaan_id, bulan) where status = 'disetujui';
create index on public.kolam_bonus (perusahaan_id, bulan);

create table public.kolam_bagian (
  kolam_id uuid not null references public.kolam_bonus(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  poin numeric not null check (poin > 0),
  kerja_n integer not null check (kerja_n > 0),
  persen numeric not null,
  rupiah bigint not null check (rupiah >= 0),
  kerja_ids uuid[] not null,
  dibanding_ids uuid[] not null default '{}',
  alasan text not null,
  primary key (kolam_id, orang_id)
);
create index on public.kolam_bagian (perusahaan_id, orang_id);
create index on public.kolam_bagian (orang_id);

alter table public.kolam_bonus enable row level security;
alter table public.kolam_bagian enable row level security;
-- Pemilik dan admin membaca (admin: pratinjau tanpa menyetujui). Staf tidak membaca tabel; bagiannya lewat kolam_saya.
create policy kolam_bonus_baca on public.kolam_bonus for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy kolam_bagian_baca on public.kolam_bagian for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.kolam_bonus, public.kolam_bagian to authenticated;

create trigger audit_kolam_bonus after insert or update or delete on public.kolam_bonus for each row execute function app.catat_audit();

-- "September 2026" untuk pesan dan judul.
create or replace function app.nama_bulan(p date) returns text
language sql immutable set search_path = '' as $$
  select (array['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
                'Desember'])[extract(month from p)::int] || ' ' || extract(year from p)::int
$$;

-- 1,5 dan 42 (koma desimal, tanpa nol di belakang) untuk kalimat alasan.
create or replace function app.angka_id(p numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(trim_scale(round(p, 1))::text, '.', ',')
$$;

-- Poin kerja selesai per orang aktif (karyawan/magang) di [p_mulai, p_akhir). Kerja tanpa poin dihitung terpisah (tanpa_poin_n).
-- alasan_kecuali terisi bila orang itu ada di daftar pengecualian. Tanpa pemeriksaan hak: hanya dipanggil fungsi di bawah.
create or replace function app.kolam_poin(p_pid uuid, p_mulai timestamptz, p_akhir timestamptz, p_kecuali jsonb)
returns table (orang_id uuid, nama text, id_staf text, alasan_kecuali text, poin numeric, kerja_n integer, tanpa_poin_n integer,
               kerja_ids uuid[], dibanding_ids uuid[])
language sql stable set search_path = '' as $$
  with o as (
    select o.id, o.nama, o.id_staf,
           (select btrim(e ->> 'alasan') from jsonb_array_elements(coalesce(p_kecuali, '[]'::jsonb)) e
             where e ->> 'orang_id' = o.id::text limit 1) as alasan_kecuali
      from public.orang o
     where o.perusahaan_id = p_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']
  ),
  k as (
    select k.id, k.pelaksana_id, coalesce(k.poin_beban, 0) as poin, k.selesai_at,
           exists (select 1 from public.usulan u
                    where u.perusahaan_id = p_pid and u.aksi = 'kpi.banding' and u.status = 'menunggu'
                      and u.payload ->> 'kerja_id' = k.id::text) as dibanding
      from public.kerja k
     where k.perusahaan_id = p_pid and k.status = 'selesai' and k.pelaksana_id is not null
       and k.selesai_at >= p_mulai and k.selesai_at < p_akhir
  )
  select o.id, o.nama, o.id_staf, o.alasan_kecuali,
         coalesce(sum(k.poin) filter (where k.poin > 0), 0),
         (count(k.id) filter (where k.poin > 0))::integer,
         (count(k.id) filter (where k.poin <= 0))::integer,
         coalesce(array_agg(k.id order by k.selesai_at, k.id) filter (where k.poin > 0), '{}'),
         coalesce(array_agg(k.id order by k.selesai_at, k.id) filter (where k.poin > 0 and k.dibanding), '{}')
    from o join k on k.pelaksana_id = o.id
   group by o.id, o.nama, o.id_staf, o.alasan_kecuali
$$;

-- Pratinjau pembagian satu bulan, tanpa menulis. Pengecualian: [{orang_id, alasan}] dengan alasan tertulis 3 sampai 300 huruf.
create or replace function app.kolam_hitung(p_pid uuid, p_bulan date, p_jumlah bigint, p_kecuali jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_bulan date := date_trunc('month', p_bulan)::date; v_zona text := app.zona(p_pid); v_kecuali jsonb := coalesce(p_kecuali, '[]'::jsonb);
  v_mulai timestamptz; v_akhir timestamptz; v_total numeric; v_n integer; v_cukup boolean; v_pesan text;
  v_bagian jsonb; v_keluar jsonb; v_tanpa jsonb; v_peringatan jsonb;
begin
  if p_bulan is null then raise exception 'Pilih bulan kolam.' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > 10000000000 then
    raise exception 'Isi jumlah kolam dalam rupiah, misalnya 1000000 (paling banyak Rp10.000.000.000).' using errcode = '22023';
  end if;
  if jsonb_typeof(v_kecuali) <> 'array' or jsonb_array_length(v_kecuali) > 500 or exists (
       select 1 from jsonb_array_elements(v_kecuali) e
        where jsonb_typeof(e) <> 'object' or coalesce(e ->> 'orang_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or char_length(btrim(coalesce(e ->> 'alasan', ''))) not between 3 and 300) then
    raise exception 'Setiap orang yang dikecualikan butuh alasan tertulis 3 sampai 300 huruf, misalnya Cuti melahirkan sepanjang bulan.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_kecuali) e
              where not exists (select 1 from public.orang o where o.id = (e ->> 'orang_id')::uuid and o.perusahaan_id = p_pid)) then
    raise exception 'Orang yang dikecualikan tidak ada di usaha ini. Muat ulang halaman, lalu pilih lagi.' using errcode = '22023';
  end if;
  v_mulai := v_bulan::timestamp at time zone v_zona;
  v_akhir := (v_bulan + interval '1 month')::timestamp at time zone v_zona;

  select coalesce(sum(g.poin), 0), coalesce(sum(g.kerja_n), 0)::integer into v_total, v_n
    from app.kolam_poin(p_pid, v_mulai, v_akhir, v_kecuali) g where g.alasan_kecuali is null and g.poin > 0;
  v_cukup := v_n >= 5 and v_total > 0;
  if not v_cukup then
    v_pesan := format('Belum cukup kerja tercatat untuk membagi kolam dengan adil: baru %s kerja berpoin selesai di %s. '
                      'Kolam bisa dibagi setelah minimal 5 kerja selesai.', v_n, app.nama_bulan(v_bulan));
  else
    with p as (
      select g.* from app.kolam_poin(p_pid, v_mulai, v_akhir, v_kecuali) g where g.alasan_kecuali is null and g.poin > 0
    ),
    b as (
      select p.*, div(p_jumlah * p.poin, v_total)::bigint as dasar, mod(p_jumlah * p.poin, v_total) as pecahan from p
    ),
    s as (select p_jumlah - sum(b.dasar)::bigint as sisa from b),
    r as (
      select b.*, round(100 * b.poin / v_total, 1) as persen, row_number() over (order by b.pecahan desc, b.orang_id) as urut from b
    )
    select jsonb_agg(jsonb_build_object(
             'orang_id', r.orang_id, 'nama', r.nama, 'id_staf', r.id_staf, 'poin', r.poin, 'kerja_n', r.kerja_n,
             'persen', r.persen, 'rupiah', r.dasar + case when r.urut <= s.sisa then 1 else 0 end,
             'kerja_ids', to_jsonb(r.kerja_ids), 'dibanding_ids', to_jsonb(r.dibanding_ids),
             'alasan', format('%s: %s poin dari %s kerja, %s%% kolam', r.nama, app.angka_id(r.poin), r.kerja_n, app.angka_id(r.persen))
                       || case when cardinality(r.dibanding_ids) > 0
                               then format(' (%s kerja sedang dibanding)', cardinality(r.dibanding_ids)) else '' end)
           order by r.nama, r.orang_id),
           coalesce(jsonb_agg(to_jsonb(format('%s memikul separuh kerja bulan ini; pertimbangkan beban di Pembagi kerja adil.', r.nama))
                    order by r.nama, r.orang_id) filter (where r.persen > 50), '[]'::jsonb)
      into v_bagian, v_peringatan
      from r cross join s;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('orang_id', o.id, 'nama', o.nama, 'alasan', btrim(e ->> 'alasan'),
                                               'poin', coalesce(g.poin, 0), 'kerja_n', coalesce(g.kerja_n, 0)) order by o.nama, o.id), '[]'::jsonb)
    into v_keluar
    from jsonb_array_elements(v_kecuali) e
    join public.orang o on o.id = (e ->> 'orang_id')::uuid and o.perusahaan_id = p_pid
    left join app.kolam_poin(p_pid, v_mulai, v_akhir, v_kecuali) g on g.orang_id = o.id;
  select coalesce(jsonb_agg(jsonb_build_object('nama', g.nama, 'kerja_n', g.tanpa_poin_n) order by g.nama, g.orang_id), '[]'::jsonb)
    into v_tanpa
    from app.kolam_poin(p_pid, v_mulai, v_akhir, v_kecuali) g where g.alasan_kecuali is null and g.tanpa_poin_n > 0;

  return jsonb_build_object(
    'bulan', v_bulan, 'nama_bulan', app.nama_bulan(v_bulan), 'zona', v_zona, 'jumlah', p_jumlah,
    'total_poin', v_total, 'kerja_n', v_n, 'cukup', v_cukup, 'pesan', v_pesan,
    'bagian', coalesce(v_bagian, '[]'::jsonb), 'peringatan', coalesce(v_peringatan, '[]'::jsonb),
    'dikecualikan', v_keluar, 'tanpa_poin', v_tanpa,
    'slip_terkunci', exists (select 1 from public.periode_gaji pg where pg.perusahaan_id = p_pid and pg.bulan = v_bulan and pg.status = 'disetujui'),
    'disetujui', (select jsonb_build_object('id', kb.id, 'jumlah', kb.jumlah, 'disetujui_at', kb.disetujui_at)
                    from public.kolam_bonus kb where kb.perusahaan_id = p_pid and kb.bulan = v_bulan and kb.status = 'disetujui'));
end $$;

-- Sisipkan (atau cabut) komponen insentif_beban di slip draf bulan itu menurut kolam yang disetujui. Hanya slip yang nilainya
-- berubah yang ditulis; total dihitung ulang seperti simpan_slip, dan diberi peringatan bahwa PPh 21 perlu disusun ulang.
create or replace function app.kolam_ke_slip(p_pid uuid, p_bulan date) returns integer
language plpgsql set search_path = '' as $$
declare n integer; c constant text := 'Insentif beban kerja berubah setelah slip disusun; PPh 21 belum dihitung ulang. Siapkan ulang gaji bulan ini.';
begin
  with bg as (
    select b.orang_id, b.rupiah from public.kolam_bagian b join public.kolam_bonus k on k.id = b.kolam_id
     where k.perusahaan_id = p_pid and k.bulan = p_bulan and k.status = 'disetujui'
  ),
  baru as (
    select s.id,
           coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(s.komponen) with ordinality t(e, i)
                      where e ->> 'kode' is distinct from 'insentif_beban'), '[]'::jsonb)
           || case when coalesce(bg.rupiah, 0) > 0
                   then jsonb_build_array(jsonb_build_object('kode', 'insentif_beban', 'label', 'Insentif beban kerja', 'jenis', 'pendapatan',
                                                             'nilai', bg.rupiah, 'sumber', 'PP 36/2021 Pasal 8 dan 10'))
                   else '[]'::jsonb end as komponen
      from public.slip_gaji s
      join public.periode_gaji pg on pg.id = s.periode_id and pg.perusahaan_id = p_pid and pg.bulan = p_bulan and pg.status = 'draf'
      left join bg on bg.orang_id = s.orang_id
     where coalesce((select sum((e ->> 'nilai')::bigint) from jsonb_array_elements(s.komponen) e where e ->> 'kode' = 'insentif_beban'), 0)
           <> coalesce(bg.rupiah, 0)
  ),
  t as (
    select b.id, b.komponen,
           (select coalesce(sum((e ->> 'nilai')::bigint) filter (where e ->> 'jenis' = 'pendapatan'), 0) from jsonb_array_elements(b.komponen) e) as br,
           (select coalesce(sum((e ->> 'nilai')::bigint) filter (where e ->> 'jenis' = 'potongan'), 0) from jsonb_array_elements(b.komponen) e) as pt
      from baru b
  )
  update public.slip_gaji s
     set komponen = t.komponen, bruto = t.br, potongan = t.pt, neto = t.br - t.pt,
         peringatan = array_append(array_remove(s.peringatan, c), c), diubah_at = now()
    from t where s.id = t.id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function app.kolam_terkunci(p_pid uuid, p_bulan date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if exists (select 1 from public.periode_gaji where perusahaan_id = p_pid and bulan = p_bulan and status = 'disetujui') then
    raise exception 'Gaji % sudah disetujui dan terkunci; slipnya tidak diubah. Bagi kolam ini di bulan berikutnya.', app.nama_bulan(p_bulan)
      using errcode = '55000';
  end if;
end $$;

-- Pemilik dan admin: pratinjau.
create or replace function public.hitung_kolam(p_bulan date, p_jumlah bigint, p_dikecualikan jsonb default '[]'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce(app.peran_aktif(), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang bisa melihat pratinjau kolam bonus.' using errcode = '42501';
  end if;
  return app.kolam_hitung(v_pid, p_bulan, p_jumlah, p_dikecualikan);
end $$;

-- Pemilik: simpan draf dari pratinjau. Kunci yang sama mengembalikan draf yang sudah ada ('sudah': true).
create or replace function public.simpan_kolam(p_bulan date, p_jumlah bigint, p_dikecualikan jsonb default '[]'::jsonb, p_kunci uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_bulan date := date_trunc('month', p_bulan)::date; h jsonb; k public.kolam_bonus;
begin
  if v_pid is null or app.peran_aktif() is distinct from 'pemilik' then
    raise exception 'Hanya pemilik yang bisa menyimpan dan menyetujui kolam bonus.' using errcode = '42501';
  end if;
  if p_kunci is not null then
    select * into k from public.kolam_bonus where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if k.id is not null then return jsonb_build_object('id', k.id, 'status', k.status, 'sudah', true); end if;
  end if;
  if p_bulan is null then raise exception 'Pilih bulan kolam.' using errcode = '22023'; end if;
  perform app.kolam_terkunci(v_pid, v_bulan);
  select * into k from public.kolam_bonus where perusahaan_id = v_pid and bulan = v_bulan and status = 'disetujui';
  if k.id is not null then
    raise exception 'Kolam % sudah disetujui (%). Batalkan dulu bila ingin menggantinya.', app.nama_bulan(v_bulan), app.rupiah(k.jumlah)
      using errcode = '55000';
  end if;
  h := app.kolam_hitung(v_pid, v_bulan, p_jumlah, p_dikecualikan);
  if not (h ->> 'cukup')::boolean then raise exception '%', h ->> 'pesan' using errcode = '22023'; end if;
  begin
    insert into public.kolam_bonus (perusahaan_id, bulan, jumlah, dikecualikan, total_poin, kerja_n, dibuat_oleh, kunci_klien)
    values (v_pid, v_bulan, p_jumlah,
            coalesce((select jsonb_agg(jsonb_build_object('orang_id', e ->> 'orang_id', 'alasan', btrim(e ->> 'alasan')))
                        from jsonb_array_elements(coalesce(p_dikecualikan, '[]'::jsonb)) e), '[]'::jsonb),
            (h ->> 'total_poin')::numeric, (h ->> 'kerja_n')::integer, (select auth.uid()), p_kunci)
    returning * into k;
  exception when unique_violation then
    select * into k from public.kolam_bonus where perusahaan_id = v_pid and kunci_klien = p_kunci;
    return jsonb_build_object('id', k.id, 'status', k.status, 'sudah', true);
  end;
  insert into public.kolam_bagian (kolam_id, perusahaan_id, orang_id, poin, kerja_n, persen, rupiah, kerja_ids, dibanding_ids, alasan)
  select k.id, v_pid, (b ->> 'orang_id')::uuid, (b ->> 'poin')::numeric, (b ->> 'kerja_n')::integer, (b ->> 'persen')::numeric,
         (b ->> 'rupiah')::bigint, array(select jsonb_array_elements_text(b -> 'kerja_ids')::uuid),
         array(select jsonb_array_elements_text(b -> 'dibanding_ids')::uuid), b ->> 'alasan'
    from jsonb_array_elements(h -> 'bagian') b;
  return jsonb_build_object('id', k.id, 'status', k.status, 'sudah', false, 'jumlah', k.jumlah, 'bagian', jsonb_array_length(h -> 'bagian'));
end $$;

-- Pemilik: setujui draf. Hitungan diulang; bila kerja bulan itu berubah sejak draf disimpan, persetujuan ditolak supaya yang
-- disetujui selalu sama dengan yang dilihat. Lalu komponen slip draf diperbarui.
create or replace function public.setujui_kolam(p_kolam uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kolam_bonus; h jsonb; n integer;
begin
  if v_pid is null or app.peran_aktif() is distinct from 'pemilik' then
    raise exception 'Hanya pemilik yang bisa menyetujui pembagian kolam bonus.' using errcode = '42501';
  end if;
  select * into k from public.kolam_bonus where id = p_kolam and perusahaan_id = v_pid for update;
  if k.id is null then raise exception 'Kolam tidak ditemukan.' using errcode = 'P0002'; end if;
  if k.status = 'disetujui' then return jsonb_build_object('id', k.id, 'status', k.status, 'sudah', true, 'slip', 0); end if;
  if k.status = 'batal' then
    raise exception 'Kolam ini sudah dibatalkan. Hitung ulang dan simpan kolam baru.' using errcode = '55000';
  end if;
  perform app.kolam_terkunci(v_pid, k.bulan);
  if exists (select 1 from public.kolam_bonus where perusahaan_id = v_pid and bulan = k.bulan and status = 'disetujui') then
    raise exception 'Kolam % lain sudah disetujui. Batalkan dulu bila ingin menggantinya.', app.nama_bulan(k.bulan) using errcode = '55000';
  end if;
  h := app.kolam_hitung(v_pid, k.bulan, k.jumlah, k.dikecualikan);
  if not (h ->> 'cukup')::boolean
     or (select coalesce(jsonb_agg(jsonb_build_object('o', b ->> 'orang_id', 'r', (b ->> 'rupiah')::bigint, 'p', (b ->> 'poin')::numeric)
                                   order by b ->> 'orang_id'), '[]'::jsonb) from jsonb_array_elements(h -> 'bagian') b)
        is distinct from
        (select coalesce(jsonb_agg(jsonb_build_object('o', g.orang_id::text, 'r', g.rupiah, 'p', g.poin) order by g.orang_id::text), '[]'::jsonb)
           from public.kolam_bagian g where g.kolam_id = k.id) then
    raise exception 'Kerja bulan ini berubah sejak pratinjau disimpan. Lihat pratinjau baru, lalu setujui lagi.' using errcode = '55000';
  end if;
  update public.kolam_bonus set status = 'disetujui', disetujui_oleh = (select auth.uid()), disetujui_at = now() where id = k.id;
  n := app.kolam_ke_slip(v_pid, k.bulan);
  return jsonb_build_object('id', k.id, 'status', 'disetujui', 'sudah', false, 'slip', n);
end $$;

-- Pemilik: batalkan selama gaji bulan itu belum disetujui. Komponen insentif dicabut dari slip draf.
create or replace function public.batal_kolam(p_kolam uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kolam_bonus; v_alasan text := btrim(regexp_replace(coalesce(p_alasan, ''), '\s+', ' ', 'g')); n integer;
begin
  if v_pid is null or app.peran_aktif() is distinct from 'pemilik' then
    raise exception 'Hanya pemilik yang bisa membatalkan kolam bonus.' using errcode = '42501';
  end if;
  if char_length(v_alasan) not between 3 and 300 then
    raise exception 'Tulis alasan membatalkan 3 sampai 300 huruf, misalnya Jumlah kolam salah ketik.' using errcode = '22023';
  end if;
  select * into k from public.kolam_bonus where id = p_kolam and perusahaan_id = v_pid for update;
  if k.id is null then raise exception 'Kolam tidak ditemukan.' using errcode = 'P0002'; end if;
  if k.status = 'batal' then raise exception 'Kolam ini sudah dibatalkan.' using errcode = '55000'; end if;
  perform app.kolam_terkunci(v_pid, k.bulan);
  update public.kolam_bonus set status = 'batal', dibatalkan_oleh = (select auth.uid()), dibatalkan_at = now(), alasan_batal = v_alasan
   where id = k.id;
  n := app.kolam_ke_slip(v_pid, k.bulan);
  return jsonb_build_object('id', k.id, 'status', 'batal', 'slip', n);
end $$;

-- Siapa pun anggota aktif: bagiannya sendiri di kolam yang disetujui (bulan itu, atau yang terbaru bila null). Tanpa jumlah
-- kolam, persen, nama, atau angka rekan.
create or replace function public.kolam_saya(p_bulan date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid; r jsonb;
begin
  if v_pid is null or not app.anggota_aktif() then raise exception 'Masuk ke usahamu dulu.' using errcode = '42501'; end if;
  v_saya := app.orang_saya();
  if v_saya is null then return null; end if;
  select jsonb_build_object('bulan', k.bulan, 'nama_bulan', app.nama_bulan(k.bulan), 'rupiah', b.rupiah, 'poin', b.poin,
                            'kerja_n', b.kerja_n, 'disetujui_at', k.disetujui_at)
    into r
    from public.kolam_bagian b join public.kolam_bonus k on k.id = b.kolam_id
   where k.perusahaan_id = v_pid and b.orang_id = v_saya and k.status = 'disetujui'
     and (p_bulan is null or k.bulan = date_trunc('month', p_bulan)::date)
   order by k.bulan desc limit 1;
  return r;
end $$;

revoke all on function app.nama_bulan(date), app.angka_id(numeric), app.kolam_poin(uuid, timestamptz, timestamptz, jsonb),
  app.kolam_hitung(uuid, date, bigint, jsonb), app.kolam_ke_slip(uuid, date), app.kolam_terkunci(uuid, date) from public, anon, authenticated;
revoke all on function public.hitung_kolam(date, bigint, jsonb), public.simpan_kolam(date, bigint, jsonb, uuid), public.setujui_kolam(uuid),
  public.batal_kolam(uuid, text), public.kolam_saya(date) from public, anon;
grant execute on function public.hitung_kolam(date, bigint, jsonb), public.simpan_kolam(date, bigint, jsonb, uuid), public.setujui_kolam(uuid),
  public.batal_kolam(uuid, text), public.kolam_saya(date) to authenticated;
