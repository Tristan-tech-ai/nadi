-- Slip gaji (F1-05, docs/research/slip-gaji.md). Aturan PPh 21 TER, PTKP, Pasal 17, lembur, dan BPJS dimuat dari
-- docs/research/gaji-aturan.json (teks resmi, docs/research/gaji.md). Hitungan komponen dilakukan modul murni
-- apps/web/src/lib/gaji (diuji dengan contoh resmi); database menyimpan komponen, menghitung ulang total, menahan orang yang
-- tertangkap Gerbang Gaji, mengunci periode yang disetujui, dan membuka slip lewat tautan aman.

-- ===== Aturan bertanggal =====
update public.aturan_bertanggal set nilai = '{"A":[[0,5400000,0],[5400000,5650000,0.25],[5650000,5950000,0.5],[5950000,6300000,0.75],[6300000,6750000,1],[6750000,7500000,1.25],[7500000,8550000,1.5],[8550000,9650000,1.75],[9650000,10050000,2],[10050000,10350000,2.25],[10350000,10700000,2.5],[10700000,11050000,3],[11050000,11600000,3.5],[11600000,12500000,4],[12500000,13750000,5],[13750000,15100000,6],[15100000,16950000,7],[16950000,19750000,8],[19750000,24150000,9],[24150000,26450000,10],[26450000,28000000,11],[28000000,30050000,12],[30050000,32400000,13],[32400000,35400000,14],[35400000,39100000,15],[39100000,43850000,16],[43850000,47800000,17],[47800000,51400000,18],[51400000,56300000,19],[56300000,62200000,20],[62200000,68600000,21],[68600000,77500000,22],[77500000,89000000,23],[89000000,103000000,24],[103000000,125000000,25],[125000000,157000000,26],[157000000,206000000,27],[206000000,337000000,28],[337000000,454000000,29],[454000000,550000000,30],[550000000,695000000,31],[695000000,910000000,32],[910000000,1400000000,33],[1400000000,null,34]],"B":[[0,6200000,0],[6200000,6500000,0.25],[6500000,6850000,0.5],[6850000,7300000,0.75],[7300000,9200000,1],[9200000,10750000,1.5],[10750000,11250000,2],[11250000,11600000,2.5],[11600000,12600000,3],[12600000,13600000,4],[13600000,14950000,5],[14950000,16400000,6],[16400000,18450000,7],[18450000,21850000,8],[21850000,26000000,9],[26000000,27700000,10],[27700000,29350000,11],[29350000,31450000,12],[31450000,33950000,13],[33950000,37100000,14],[37100000,41100000,15],[41100000,45800000,16],[45800000,49500000,17],[49500000,53800000,18],[53800000,58500000,19],[58500000,64000000,20],[64000000,71000000,21],[71000000,80000000,22],[80000000,93000000,23],[93000000,109000000,24],[109000000,129000000,25],[129000000,163000000,26],[163000000,211000000,27],[211000000,374000000,28],[374000000,459000000,29],[459000000,555000000,30],[555000000,704000000,31],[704000000,957000000,32],[957000000,1405000000,33],[1405000000,null,34]],"C":[[0,6600000,0],[6600000,6950000,0.25],[6950000,7350000,0.5],[7350000,7800000,0.75],[7800000,8850000,1],[8850000,9800000,1.25],[9800000,10950000,1.5],[10950000,11200000,1.75],[11200000,12050000,2],[12050000,12950000,3],[12950000,14150000,4],[14150000,15550000,5],[15550000,17050000,6],[17050000,19500000,7],[19500000,22700000,8],[22700000,26600000,9],[26600000,28100000,10],[28100000,30100000,11],[30100000,32600000,12],[32600000,35400000,13],[35400000,38900000,14],[38900000,43000000,15],[43000000,47400000,16],[47400000,51200000,17],[51200000,55800000,18],[55800000,60400000,19],[60400000,66700000,20],[66700000,74500000,21],[74500000,83200000,22],[83200000,95600000,23],[95600000,110000000,24],[110000000,134000000,25],[134000000,169000000,26],[169000000,221000000,27],[221000000,390000000,28],[390000000,463000000,29],[463000000,561000000,30],[561000000,709000000,31],[709000000,965000000,32],[965000000,1419000000,33],[1419000000,null,34]]}'::jsonb, terverifikasi = true,
  sumber = 'Lampiran PP 58/2023 (jdih.kemenkeu.go.id/api/download/e47c3fc4-a912-4bf1-bcad-335fee3f71f8/2023pp058.pdf) via PMK 168/2023; dibaca 31 Okt 2026',
  catatan = 'baris [batas bawah, batas atas atau null, tarif persen]; A 44, B 40, C 41 baris; dicek silang dengan 20 contoh resmi'
 where kunci = 'pph21.ter';
update public.aturan_bertanggal set nilai = '{"pemberi_kerja":0.04,"pekerja":0.01,"batas_upah":12000000}', terverifikasi = true,
  sumber = 'Perpres 82/2018 Pasal 30 jo. Perpres 64/2020, Pasal 32 jo. Perpres 59/2024 (peraturan.bpk.go.id); dibaca 31 Okt 2026',
  catatan = 'dasar: upah pokok + tunjangan tetap; batas bawah UMK/UMP tidak berlaku untuk usaha mikro dan kecil (angka penggantinya belum ditetapkan)'
 where kunci = 'bpjs.kesehatan';
update public.aturan_bertanggal set nilai = '{"pemberi_kerja":0.02,"pekerja":0.01,"batas_upah":null}', terverifikasi = false,
  catatan = 'batas upah JP 2026 belum terverifikasi: situs resmi BPJS TK menulis Rp10.547.400 dan Rp10.547.000; JP tidak dihitung otomatis sampai pasti'
 where kunci = 'bpjs.jp';
insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan) values
  ('pph21.kategori', '{"TK/0":"A","TK/1":"A","K/0":"A","TK/2":"B","TK/3":"B","K/1":"B","K/2":"B","K/3":"C"}', '2024-01-01', 'PP 58/2023 Pasal 2 ayat (2); dibaca 31 Okt 2026', true, null),
  ('pph21.ptkp', '{"diri":54000000,"kawin":4500000,"per_tanggungan":4500000,"maks_tanggungan":3}', '2016-01-01', 'UU PPh Pasal 7 ayat (1) sebagaimana diubah UU 7/2021; PMK 101/PMK.010/2016 Pasal 1; dibaca 31 Okt 2026', true, null),
  ('pph21.pasal17', '[[60000000,5],[250000000,15],[500000000,25],[5000000000,30],[null,35]]', '2022-01-01', 'UU PPh Pasal 17 ayat (1) huruf a sebagaimana diubah UU 7/2021; dibaca 31 Okt 2026', true, 'lapisan [batas atas PKP kumulatif atau null, tarif persen]'),
  ('pph21.ter_harian', '[[0,450000,0],[450000,2500000,0.5]]', '2024-01-01', 'Lampiran PP 58/2023; dibaca 31 Okt 2026', true, null),
  ('pph21.biaya_jabatan', '{"persen":5,"maks_sebulan":500000,"maks_setahun":6000000}', '2024-01-01', 'PMK 168/2023 Pasal 10 ayat (2); dibaca 31 Okt 2026', true, null),
  ('lembur.pp35', '{"upah_sejam_pembagi":173,"hari_kerja":[[1,1,1.5],[2,null,2]],"libur_pola_6_hari":[[1,7,2],[8,8,3],[9,11,4]],"libur_pola_6_hari_jatuh_hari_kerja_terpendek":[[1,5,2],[6,6,3],[7,9,4]],"libur_pola_5_hari":[[1,8,2],[9,9,3],[10,12,4]]}', '2021-02-02', 'PP 35/2021 Pasal 31 (peraturan.bpk.go.id); dibaca 31 Okt 2026', true, 'pembulatan upah lembur tidak diatur; Nadi membulatkan ke rupiah terdekat (asumsi)');

-- ===== Periode dan slip =====
create table public.periode_gaji (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  status text not null default 'draf' check (status in ('draf', 'disetujui')),
  disetujui_oleh uuid,
  disetujui_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, bulan)
);

create table public.slip_gaji (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  periode_id uuid not null references public.periode_gaji(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  komponen jsonb not null default '[]'::jsonb check (jsonb_typeof(komponen) = 'array' and pg_column_size(komponen) < 16384),
  bruto bigint not null default 0,
  potongan bigint not null default 0,
  neto bigint not null default 0,
  peringatan text[] not null default '{}',
  ditahan boolean not null default false,
  alasan_tahan text,
  dilepas_oleh uuid,
  diubah_at timestamptz not null default now(),
  unique (periode_id, orang_id)
);
create index on public.slip_gaji (perusahaan_id, orang_id);
create index on public.slip_gaji (orang_id);

alter table public.periode_gaji enable row level security;
alter table public.slip_gaji enable row level security;
create policy periode_gaji_baca on public.periode_gaji for select to authenticated using (perusahaan_id = (select app.pid()));
-- Pengelola melihat semua slip; staf hanya slipnya sendiri yang sudah disetujui dan tidak ditahan.
create policy slip_gaji_baca on public.slip_gaji for select to authenticated using (
  perusahaan_id = (select app.pid()) and ((select app.pengelola())
    or (orang_id = (select app.orang_saya()) and not ditahan
        and exists (select 1 from public.periode_gaji p where p.id = periode_id and p.status = 'disetujui'))));
grant select on public.periode_gaji, public.slip_gaji to authenticated;

create table app.token_slip (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  slip_id uuid not null references public.slip_gaji(id) on delete cascade,
  hash text not null unique,
  kedaluwarsa_at timestamptz not null,
  dicabut_at timestamptz,
  dibuat_oleh uuid not null,
  dibuat_at timestamptz not null default now()
);
create index on app.token_slip (slip_id);
create index on app.token_slip (perusahaan_id);
revoke all on app.token_slip from public, anon, authenticated;

create trigger audit_slip_gaji after insert or update or delete on public.slip_gaji for each row execute function app.catat_audit();

-- Buka (atau ambil) periode draf untuk bulan itu.
create or replace function public.mulai_periode_gaji(p_bulan date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid; v_bulan date := date_trunc('month', p_bulan)::date;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  insert into public.periode_gaji (perusahaan_id, bulan) values (v_pid, v_bulan)
  on conflict (perusahaan_id, bulan) do update set bulan = excluded.bulan returning id into v_id;
  return v_id;
end $$;

-- Simpan komponen satu slip draf. Total dihitung ulang di sini; orang bertemuan Gerbang Gaji ditahan.
create or replace function public.simpan_slip(p_periode uuid, p_orang uuid, p_komponen jsonb, p_peringatan text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); per public.periode_gaji; b bigint; pt bigint; tahan text; s public.slip_gaji;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  select * into per from public.periode_gaji where id = p_periode and perusahaan_id = v_pid;
  if per.id is null then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if per.status <> 'draf' then raise exception 'Periode ini sudah disetujui dan terkunci. Buat koreksi di periode berikutnya.' using errcode = '55000'; end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_komponen) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_komponen) k
        where coalesce(k ->> 'jenis', '') not in ('pendapatan', 'potongan', 'pemberi_kerja')
           or coalesce(k ->> 'kode', '') = '' or coalesce(k ->> 'label', '') = ''
           or jsonb_typeof(k -> 'nilai') <> 'number' or (k ->> 'nilai')::numeric < 0 or (k ->> 'nilai')::numeric <> trunc((k ->> 'nilai')::numeric)) then
    raise exception 'Komponen gaji tidak sah: setiap baris butuh kode, label, jenis, dan nilai rupiah bulat tidak negatif.' using errcode = '22023';
  end if;
  select coalesce(sum((k ->> 'nilai')::bigint) filter (where k ->> 'jenis' = 'pendapatan'), 0),
         coalesce(sum((k ->> 'nilai')::bigint) filter (where k ->> 'jenis' = 'potongan'), 0)
    into b, pt from jsonb_array_elements(p_komponen) k;
  select string_agg(g.alasan, ' ' order by g.kode) into tahan
    from public.gerbang_gaji((per.bulan + interval '1 month - 1 day')::date) g where g.orang_id = p_orang;
  insert into public.slip_gaji as s0 (perusahaan_id, periode_id, orang_id, komponen, bruto, potongan, neto, peringatan, ditahan, alasan_tahan)
  values (v_pid, p_periode, p_orang, p_komponen, b, pt, b - pt, coalesce(p_peringatan, '{}'), tahan is not null, tahan)
  on conflict (periode_id, orang_id) do update set komponen = excluded.komponen, bruto = excluded.bruto, potongan = excluded.potongan,
    neto = excluded.neto, peringatan = excluded.peringatan,
    ditahan = case when s0.dilepas_oleh is not null then false else excluded.ditahan end,
    alasan_tahan = case when s0.dilepas_oleh is not null then s0.alasan_tahan else excluded.alasan_tahan end,
    diubah_at = now()
  returning * into s;
  return jsonb_build_object('id', s.id, 'bruto', s.bruto, 'potongan', s.potongan, 'neto', s.neto, 'ditahan', s.ditahan, 'alasan_tahan', s.alasan_tahan);
end $$;

-- Pemilik melepas tahanan setelah memeriksa, dengan alasan tertulis.
create or replace function public.lepas_tahan_slip(p_slip uuid, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik']) then raise exception 'Hanya pemilik yang bisa melepas gaji yang ditahan' using errcode = '42501'; end if;
  if coalesce(btrim(p_alasan), '') = '' then raise exception 'Tulis alasan melepas, misalnya hasil pemeriksaanmu.' using errcode = '22023'; end if;
  update public.slip_gaji set ditahan = false, dilepas_oleh = (select auth.uid()),
         alasan_tahan = coalesce(alasan_tahan, '') || ' Dilepas: ' || btrim(p_alasan), diubah_at = now()
   where id = p_slip and perusahaan_id = app.pid() and ditahan;
  if not found then raise exception 'Slip tidak ditemukan atau tidak sedang ditahan' using errcode = 'P0002'; end if;
end $$;

-- Setujui periode: dikunci. Slip yang masih ditahan tidak bisa dibuka staf atau lewat tautan sampai dilepas pemilik.
create or replace function public.setujui_periode_gaji(p_periode uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); n int; t int;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  update public.periode_gaji set status = 'disetujui', disetujui_oleh = (select auth.uid()), disetujui_at = now()
   where id = p_periode and perusahaan_id = v_pid and status = 'draf';
  if not found then raise exception 'Periode tidak ditemukan atau sudah disetujui' using errcode = 'P0002'; end if;
  select count(*), count(*) filter (where ditahan) into n, t from public.slip_gaji where periode_id = p_periode;
  return jsonb_build_object('slip', n, 'ditahan', t);
end $$;

-- Tautan slip (token nms_, hanya hash disimpan, 30 hari). Slip harus sudah disetujui dan tidak ditahan.
create or replace function public.buat_tautan_slip(p_slip uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_token text := app.token_baru('nms_');
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  if not exists (select 1 from public.slip_gaji s join public.periode_gaji p on p.id = s.periode_id
                  where s.id = p_slip and s.perusahaan_id = v_pid and p.status = 'disetujui' and not s.ditahan) then
    raise exception 'Slip belum bisa dibagikan: periode belum disetujui atau gajinya sedang ditahan.' using errcode = '55000';
  end if;
  insert into app.token_slip (perusahaan_id, slip_id, hash, kedaluwarsa_at, dibuat_oleh)
  values (v_pid, p_slip, app.hash_token(v_token), now() + interval '30 days', (select auth.uid()));
  return v_token;
end $$;

create or replace function public.cabut_tautan_slip(p_slip uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  update app.token_slip set dicabut_at = now() where slip_id = p_slip and perusahaan_id = app.pid() and dicabut_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Dibuka tanpa akun lewat tautan. Galat sama untuk token salah, dicabut, kedaluwarsa, atau slip yang ditahan.
create or replace function public.buka_slip(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('usaha', pr.nama, 'nama', o.nama, 'id_staf', o.id_staf, 'bulan', p.bulan, 'komponen', s.komponen,
           'bruto', s.bruto, 'potongan', s.potongan, 'neto', s.neto, 'peringatan', to_jsonb(s.peringatan), 'kedaluwarsa_at', t.kedaluwarsa_at)
    into r
    from app.token_slip t join public.slip_gaji s on s.id = t.slip_id join public.periode_gaji p on p.id = s.periode_id
    join public.orang o on o.id = s.orang_id join public.perusahaan pr on pr.id = s.perusahaan_id
   where t.hash = app.hash_token(coalesce(p_token, '')) and t.dicabut_at is null and t.kedaluwarsa_at > now()
     and p.status = 'disetujui' and not s.ditahan;
  if r is null then raise exception 'Tautan slip ini tidak berlaku lagi. Minta slip baru ke pemilik usaha.' using errcode = '28000'; end if;
  return r;
end $$;

revoke all on function public.mulai_periode_gaji(date), public.simpan_slip(uuid, uuid, jsonb, text[]), public.lepas_tahan_slip(uuid, text),
  public.setujui_periode_gaji(uuid), public.buat_tautan_slip(uuid), public.cabut_tautan_slip(uuid), public.buka_slip(text) from public, anon;
grant execute on function public.mulai_periode_gaji(date), public.simpan_slip(uuid, uuid, jsonb, text[]), public.lepas_tahan_slip(uuid, text),
  public.setujui_periode_gaji(uuid), public.buat_tautan_slip(uuid), public.cabut_tautan_slip(uuid), public.buka_slip(text) to authenticated;
grant execute on function public.buka_slip(text) to anon;
