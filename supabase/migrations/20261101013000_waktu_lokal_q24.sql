-- Q-24 lanjutan (docs/quality/review-q24.md): WITA tersembunyi lewat app.tanggal_aman(teks, jam), yang menafsirkan teks tanggal
-- dari usulan (impor absen, mutasi bank, surat sakit, nota) sebagai jam +08. Untuk usaha WIB kejadian jatuh di 23.00 hari sebelumnya.
-- 1. Pembantu app.waktu_lokal(teks, jam, zona): aturan teks sama persis dengan tanggal_aman, tetapi dibaca di zona yang diberikan.
-- 2. public.putuskan_usulan: keempat pemakaian tanggal_aman diganti waktu_lokal(..., app.zona(v_pid)) lewat replace teks persis
--    dengan jumlah kemunculan diperiksa. Isi lain tidak tersentuh. Sesudah ini tidak ada fungsi yang memakai tanggal_aman.
-- 3. app.tanggal_aman tidak dihapus (tanpa DELETE/DROP), diberi komentar usang.
-- 4. Data lama: kejadian dari putuskan_usulan (absen.harian, bank.*, izin.sakit tanpa pengajuan, aksi lain dari nota) di usaha
--    berzona lain yang waktunya persis tanggal_aman(payload) dan payload-nya ada di usulan diterima dengan sumber sama, dipindah ke
--    waktu_lokal(payload, zona usaha). Cadangan baris lama ke public.audit_log (aksi koreksi_zona_q24) sebelum update; ringkasan
--    harian jenis itu di tanggal lokal lama dan baru dihitung ulang dengan cadangan yang sama. Tanpa DELETE.

create or replace function app.waktu_lokal(p text, p_jam text, p_zona text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return (p || ' ' || coalesce(nullif(replace(p_jam, '.', ':'), ''), '00:00') || ':00')::timestamp at time zone p_zona;
exception when others then
  return null;
end $$;

revoke all on function app.waktu_lokal(text, text, text) from public, anon, authenticated;
comment on function app.waktu_lokal(text, text, text) is 'Teks tanggal YYYY-MM-DD dan jam HH:MM (atau HH.MM) dibaca sebagai waktu lokal di zona yang diberikan, biasanya app.zona(pid) (Q-24).';
comment on function app.tanggal_aman(text, text) is 'Usang (Q-24): menafsirkan teks di +08 (WITA tetap). Jangan dipakai untuk waktu kejadian atau batas hari; pakai app.waktu_lokal(teks, jam, app.zona(pid)) atau app.tanggal_teks(teks).';

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

select pg_temp.ganti_zona('public.putuskan_usulan(uuid,boolean)',
  $a$app.tanggal_aman(x ->> 'tanggal', x ->> 'masuk')$a$, $a$app.waktu_lokal(x ->> 'tanggal', x ->> 'masuk', app.zona(v_pid))$a$, '1',
  $a$app.tanggal_aman(x ->> 'tanggal')$a$, $a$app.waktu_lokal(x ->> 'tanggal', null, app.zona(v_pid))$a$, '1',
  $a$app.tanggal_aman(b ->> 'mulai')$a$, $a$app.waktu_lokal(b ->> 'mulai', null, app.zona(v_pid))$a$, '1',
  $a$app.tanggal_aman(coalesce(b ->> 'tanggal', b ->> 'periode' || '-01'))$a$,
  $a$app.waktu_lokal(coalesce(b ->> 'tanggal', b ->> 'periode' || '-01'), null, app.zona(v_pid))$a$, '1');

drop function pg_temp.ganti_zona(regprocedure, text[]);

-- Data lama.
do $$
declare n_cadang int; n_ubah int; n_ringkas_cadang int; n_ringkas int;
begin
  create temp table q24_usulan on commit drop as
  select k.id, k.perusahaan_id, k.terjadi_at as lama, k.baru
    from (
      select e.id, e.perusahaan_id, e.terjadi_at,
             case when e.jenis = 'absen.harian' then app.tanggal_aman(e.data ->> 'tanggal', e.data ->> 'masuk')
                  when e.jenis in ('bank.masuk', 'bank.keluar') then app.tanggal_aman(e.data ->> 'tanggal')
                  when e.jenis = 'izin.sakit' then app.tanggal_aman(e.data ->> 'mulai')
                  else app.tanggal_aman(coalesce(e.data ->> 'tanggal', e.data ->> 'periode' || '-01')) end as pola,
             case when e.jenis = 'absen.harian' then app.waktu_lokal(e.data ->> 'tanggal', e.data ->> 'masuk', app.zona(e.perusahaan_id))
                  when e.jenis in ('bank.masuk', 'bank.keluar') then app.waktu_lokal(e.data ->> 'tanggal', null, app.zona(e.perusahaan_id))
                  when e.jenis = 'izin.sakit' then app.waktu_lokal(e.data ->> 'mulai', null, app.zona(e.perusahaan_id))
                  else app.waktu_lokal(coalesce(e.data ->> 'tanggal', e.data ->> 'periode' || '-01'), null, app.zona(e.perusahaan_id)) end as baru
        from public.kejadian e
       where app.zona(e.perusahaan_id) <> 'Asia/Makassar' and e.data is not null and not (e.data ? 'pengajuan_id')
         and exists (select 1 from public.usulan u
                      where u.perusahaan_id = e.perusahaan_id and u.status = 'diterima' and u.sumber = e.sumber
                        and (u.payload -> 'bidang' = e.data or coalesce(u.payload -> 'bidang' -> 'baris', '[]') @> jsonb_build_array(e.data)))
    ) k
   where k.terjadi_at = k.pola and k.baru is not null and k.baru <> k.terjadi_at;

  insert into public.audit_log (perusahaan_id, tabel, baris_id, aksi, sebelum, sesudah)
  select e.perusahaan_id, 'kejadian', e.id, 'koreksi_zona_q24', to_jsonb(e), jsonb_build_object('terjadi_at', q.baru)
    from public.kejadian e join q24_usulan q on q.id = e.id and q.lama = e.terjadi_at;
  get diagnostics n_cadang = row_count;

  update public.kejadian e set terjadi_at = q.baru
    from q24_usulan q where q.id = e.id and q.lama = e.terjadi_at;
  get diagnostics n_ubah = row_count;
  if n_cadang <> n_ubah or n_ubah <> (select count(*) from q24_usulan) then
    raise exception 'Q-24: cadangan % baris, dikoreksi % baris, sasaran % baris', n_cadang, n_ubah, (select count(*) from q24_usulan);
  end if;

  create temp table q24_ringkas2 on commit drop as
  select r.perusahaan_id, r.tanggal, r.jenis, r.orang_id, b.jumlah, b.total
    from public.ringkasan_harian r
   cross join lateral (
     select count(*)::int as jumlah, sum(k.nilai) as total from public.kejadian k
      where k.perusahaan_id = r.perusahaan_id and k.jenis = r.jenis and k.orang_id is not distinct from r.orang_id
        and k.terjadi_at >= r.tanggal::timestamptz - interval '1 day' and k.terjadi_at < r.tanggal::timestamptz + interval '2 days'
        and (k.terjadi_at at time zone app.zona(r.perusahaan_id))::date = r.tanggal) b
   where (r.perusahaan_id, r.tanggal, r.jenis) in (
       select e.perusahaan_id, (q.lama at time zone app.zona(q.perusahaan_id))::date, e.jenis from q24_usulan q join public.kejadian e on e.id = q.id
       union select e.perusahaan_id, (q.baru at time zone app.zona(q.perusahaan_id))::date, e.jenis from q24_usulan q join public.kejadian e on e.id = q.id)
     and (r.jumlah <> b.jumlah or r.total_nilai is distinct from b.total);

  insert into public.audit_log (perusahaan_id, tabel, aksi, sebelum, sesudah)
  select r.perusahaan_id, 'ringkasan_harian', 'koreksi_zona_q24', to_jsonb(r), jsonb_build_object('jumlah', q.jumlah, 'total_nilai', q.total)
    from public.ringkasan_harian r join q24_ringkas2 q
      on q.perusahaan_id = r.perusahaan_id and q.tanggal = r.tanggal and q.jenis = r.jenis and q.orang_id is not distinct from r.orang_id;
  get diagnostics n_ringkas_cadang = row_count;

  update public.ringkasan_harian r set jumlah = q.jumlah, total_nilai = q.total, diperbarui_at = now()
    from q24_ringkas2 q
   where q.perusahaan_id = r.perusahaan_id and q.tanggal = r.tanggal and q.jenis = r.jenis and q.orang_id is not distinct from r.orang_id;
  get diagnostics n_ringkas = row_count;
  if n_ringkas_cadang <> n_ringkas then
    raise exception 'Q-24: cadangan ringkasan % baris, dikoreksi % baris', n_ringkas_cadang, n_ringkas;
  end if;
  raise notice 'Q-24: % kejadian dari usulan dan % baris ringkasan harian dikoreksi', n_ubah, n_ringkas;
end $$;
