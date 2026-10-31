-- Q-24 (docs/quality/zona-fungsi.md): batas hari dan minggu memakai zona usaha (perusahaan.zona_waktu), bukan WITA tetap.
-- 1. Pembantu: app.zona(pid), app.hari_ini(pid), app.tanggal_teks(teks). Hanya dipakai fungsi security definer, jadi tidak
--    ada hak execute untuk public, anon, atau authenticated.
-- 2. Kelompok C dan D: definisi hidup setiap fungsi diambil dengan pg_get_functiondef, lalu HANYA ekspresi zona diganti lewat
--    replace teks persis dengan jumlah kemunculan yang diperiksa (gagal bila pola tidak ditemukan tepat sejumlah itu). Isi lain
--    tidak tersentuh. Pasangan app.tanggal_aman(teks) (disimpan +08) yang dibaca kembali di WITA menghasilkan tanggal di teks,
--    jadi diganti app.tanggal_teks(teks) dengan hasil sama persis (mengganti WITA dengan zona usaha di situ justru salah).
-- 3. Kelompok B tetap WITA dengan sengaja dan diberi komentar fungsi.
-- 4. Data lama: kejadian izin.* yang waktunya persis mulai 00.00 WITA di usaha berzona lain dipindah ke 00.00 zona usaha, dengan
--    cadangan baris lama di public.audit_log (aksi koreksi_zona_q24) sebelum update. Ringkasan harian izin di tanggal yang
--    tersentuh dihitung ulang dengan cadangan yang sama. Tanpa DELETE.

create or replace function app.zona(p_pid uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select p.zona_waktu from public.perusahaan p where p.id = p_pid), 'Asia/Jakarta')
$$;

create or replace function app.hari_ini(p_pid uuid) returns date
language sql stable set search_path = '' as $$
  select (now() at time zone app.zona(p_pid))::date
$$;

create or replace function app.tanggal_teks(p text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return make_date(substr(p, 1, 4)::int, substr(p, 6, 2)::int, substr(p, 9, 2)::int);
exception when others then
  return null;
end $$;

revoke all on function app.zona(uuid) from public, anon, authenticated;
revoke all on function app.hari_ini(uuid) from public, anon, authenticated;
revoke all on function app.tanggal_teks(text) from public, anon, authenticated;

comment on function app.zona(uuid) is 'Zona waktu usaha (perusahaan.zona_waktu); cadangan Asia/Jakarta sama dengan bawaan kolom (Q-24).';
comment on function app.hari_ini(uuid) is 'Tanggal hari ini di zona usaha, pengganti current_date (UTC server) dan tanggal WITA tetap (Q-24).';
comment on function app.tanggal_teks(text) is 'Tanggal YYYY-MM-DD dari teks tanpa zona; sama dengan (app.tanggal_aman(teks) dibaca di zona +08)::date (Q-24).';

create function pg_temp.ganti_zona(p_fungsi regprocedure, variadic p_pasangan text[]) returns void
language plpgsql as $$
declare d text := pg_get_functiondef(p_fungsi); lama text; baru text; n int; ada int;
begin
  for i in 1 .. array_length(p_pasangan, 1) / 3 loop
    lama := p_pasangan[3 * i - 2]; baru := p_pasangan[3 * i - 1]; n := p_pasangan[3 * i]::int;
    ada := (length(d) - length(replace(d, lama, ''))) / length(lama);
    if ada <> n then
      raise exception 'Q-24: % memuat pola % kali, bukan %: %', p_fungsi, ada, n, lama;
    end if;
    d := replace(d, lama, baru);
  end loop;
  execute d;
end $$;

-- Kelompok C.
select pg_temp.ganti_zona('app.catat_izin(public.pengajuan_izin)',
  $a$p.mulai::timestamp at time zone 'Asia/Makassar'$a$, $a$p.mulai::timestamp at time zone app.zona(p.perusahaan_id)$a$, '1');

select pg_temp.ganti_zona('public.batalkan_keputusan(uuid,text)',
  $a$iz.mulai::timestamp at time zone 'Asia/Makassar'$a$, $a$iz.mulai::timestamp at time zone app.zona(iz.perusahaan_id)$a$, '2');

select pg_temp.ganti_zona('public.ajukan_izin(text,date,date,text,uuid)',
  $a$v_hari_ini date := (now() at time zone 'Asia/Makassar')::date;$a$, $a$v_hari_ini date := app.hari_ini(v_pid);$a$, '1',
  $a$p_mulai::timestamp at time zone 'Asia/Makassar'$a$, $a$p_mulai::timestamp at time zone app.zona(v_pid)$a$, '1');

select pg_temp.ganti_zona('public.gerbang_gaji(date)',
  $a$coalesce(p_tanggal, (now() at time zone 'Asia/Makassar')::date)$a$, $a$coalesce(p_tanggal, app.hari_ini(v_pid))$a$, '1',
  $a$(app.tanggal_aman(o.data ->> 'mulai') at time zone 'Asia/Makassar')::date$a$, $a$app.tanggal_teks(o.data ->> 'mulai')$a$, '1',
  $a$(o.dibuat_at at time zone 'Asia/Makassar')::date$a$, $a$(o.dibuat_at at time zone app.zona(v_pid))::date$a$, '1',
  $a$::timestamp at time zone 'Asia/Makassar'$a$, $a$::timestamp at time zone app.zona(v_pid)$a$, '3',
  $a$(app.tanggal_aman(g.data ->> 'kontrak_selesai') at time zone 'Asia/Makassar')::date$a$, $a$app.tanggal_teks(g.data ->> 'kontrak_selesai')$a$, '1');

select pg_temp.ganti_zona('public.izin_ringkas()',
  $a$extract(year from now() at time zone 'Asia/Makassar')::int$a$, $a$extract(year from app.hari_ini(app.pid()))::int$a$, '1');

select pg_temp.ganti_zona('app.peringatan_rencana(uuid)',
  $a$(app.tanggal_aman(o.data ->> 'mulai') at time zone 'Asia/Makassar')::date$a$, $a$app.tanggal_teks(o.data ->> 'mulai')$a$, '1',
  $a$(o.dibuat_at at time zone 'Asia/Makassar')::date$a$, $a$(o.dibuat_at at time zone app.zona(o.perusahaan_id))::date$a$, '1');

select pg_temp.ganti_zona('public.putuskan_usulan(uuid,boolean)',
  $a$(app.tanggal_aman(r ->> 'mulai') at time zone 'Asia/Makassar')::date$a$, $a$app.tanggal_teks(r ->> 'mulai')$a$, '1',
  $a$pt.mulai <= current_date and (pt.selesai is null or pt.selesai >= current_date)$a$,
  $a$pt.mulai <= app.hari_ini(v_pid) and (pt.selesai is null or pt.selesai >= app.hari_ini(v_pid))$a$, '1');

select pg_temp.ganti_zona('public.catat_jam_rekrut(text,uuid,uuid,date,integer,text)',
  $a$p_tanggal > (now() at time zone 'Asia/Makassar')::date$a$, $a$p_tanggal > app.hari_ini(v_pid)$a$, '1');

-- Kelompok D: batas harian per usaha berganti di 00.00 zona usaha.
select pg_temp.ganti_zona('app.antre_rute_model()',
  $a$date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar'$a$,
  $a$app.hari_ini(new.perusahaan_id)::timestamp at time zone app.zona(new.perusahaan_id)$a$, '1');

select pg_temp.ganti_zona('public.rute_model_uji_mulai()',
  $a$date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar'$a$,
  $a$app.hari_ini(v_pid)::timestamp at time zone app.zona(v_pid)$a$, '1');

select pg_temp.ganti_zona('app.batas_berkas()',
  $a$date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar'$a$,
  $a$app.hari_ini(new.perusahaan_id)::timestamp at time zone app.zona(new.perusahaan_id)$a$, '1');

drop function pg_temp.ganti_zona(regprocedure, text[]);

comment on function app.batas_berkas() is 'Batas unggah harian per usaha, mulai 00.00 zona usaha pengunggah (Q-24). Hitungan platform memakai jendela yang sama; selisih paling banyak 2 jam antarzona Indonesia, cukup untuk rem kuota.';

-- Kelompok B: WITA sengaja.
comment on function app.isi_demo() is 'Mengisi usaha contoh. Asia/Makassar di sini sengaja: nilai kolom zona_waktu usaha demo (data), bukan perhitungan batas hari (Q-24).';
comment on function app.ukur_kuota(bigint, bigint) is 'Mengukur kuota platform harian (bukan per usaha). Tanggal memakai Asia/Makassar dengan sengaja: satu zona platform untuk semua usaha (Q-24).';

-- Data lama: izin yang tercatat 00.00 WITA di usaha berzona lain.
do $$
declare n_cadang int; n_ubah int; n_ringkas_cadang int; n_ringkas int;
begin
  create temp table q24_koreksi on commit drop as
  select e.id, e.perusahaan_id, e.terjadi_at as lama, (pi.mulai::timestamp at time zone app.zona(e.perusahaan_id)) as baru
    from public.kejadian e
    join public.pengajuan_izin pi on pi.id = (e.data ->> 'pengajuan_id')::uuid and pi.perusahaan_id = e.perusahaan_id
   where e.jenis like 'izin.%' and app.zona(e.perusahaan_id) <> 'Asia/Makassar'
     and e.terjadi_at = (pi.mulai::timestamp at time zone 'Asia/Makassar');

  insert into public.audit_log (perusahaan_id, tabel, baris_id, aksi, sebelum, sesudah)
  select e.perusahaan_id, 'kejadian', e.id, 'koreksi_zona_q24', to_jsonb(e), jsonb_build_object('terjadi_at', q.baru)
    from public.kejadian e join q24_koreksi q on q.id = e.id and q.lama = e.terjadi_at;
  get diagnostics n_cadang = row_count;

  update public.kejadian e set terjadi_at = q.baru
    from q24_koreksi q where q.id = e.id and q.lama = e.terjadi_at;
  get diagnostics n_ubah = row_count;
  if n_cadang <> n_ubah or n_ubah <> (select count(*) from q24_koreksi) then
    raise exception 'Q-24: cadangan % baris, dikoreksi % baris, sasaran % baris', n_cadang, n_ubah, (select count(*) from q24_koreksi);
  end if;

  -- Ringkasan harian izin di tanggal lokal lama dan baru dihitung ulang dari kejadian.
  create temp table q24_ringkas on commit drop as
  select r.perusahaan_id, r.tanggal, r.jenis, r.orang_id, b.jumlah, b.total
    from public.ringkasan_harian r
   cross join lateral (
     select count(*)::int as jumlah, sum(k.nilai) as total from public.kejadian k
      where k.perusahaan_id = r.perusahaan_id and k.jenis = r.jenis and k.orang_id is not distinct from r.orang_id
        and k.terjadi_at >= r.tanggal::timestamptz - interval '1 day' and k.terjadi_at < r.tanggal::timestamptz + interval '2 days'
        and (k.terjadi_at at time zone app.zona(r.perusahaan_id))::date = r.tanggal) b
   where r.jenis like 'izin.%'
     and (r.perusahaan_id, r.tanggal) in (
       select q.perusahaan_id, (q.lama at time zone app.zona(q.perusahaan_id))::date from q24_koreksi q
       union select q.perusahaan_id, (q.baru at time zone app.zona(q.perusahaan_id))::date from q24_koreksi q)
     and (r.jumlah <> b.jumlah or r.total_nilai is distinct from b.total);

  insert into public.audit_log (perusahaan_id, tabel, aksi, sebelum, sesudah)
  select r.perusahaan_id, 'ringkasan_harian', 'koreksi_zona_q24', to_jsonb(r), jsonb_build_object('jumlah', q.jumlah, 'total_nilai', q.total)
    from public.ringkasan_harian r join q24_ringkas q
      on q.perusahaan_id = r.perusahaan_id and q.tanggal = r.tanggal and q.jenis = r.jenis and q.orang_id is not distinct from r.orang_id;
  get diagnostics n_ringkas_cadang = row_count;

  update public.ringkasan_harian r set jumlah = q.jumlah, total_nilai = q.total, diperbarui_at = now()
    from q24_ringkas q
   where q.perusahaan_id = r.perusahaan_id and q.tanggal = r.tanggal and q.jenis = r.jenis and q.orang_id is not distinct from r.orang_id;
  get diagnostics n_ringkas = row_count;
  if n_ringkas_cadang <> n_ringkas then
    raise exception 'Q-24: cadangan ringkasan % baris, dikoreksi % baris', n_ringkas_cadang, n_ringkas;
  end if;
  raise notice 'Q-24: % kejadian izin dan % baris ringkasan harian dikoreksi', n_ubah, n_ringkas;
end $$;
