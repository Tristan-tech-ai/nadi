-- Q-22 (docs/research/pola-kerja.md, docs/design/aturan-kerja.md): satu sumber pola kerja per usaha.
-- perusahaan.pengaturan->>'pola_kerja' = '6_hari' | '5_hari' (PP 35/2021 Pasal 21 ayat (2) huruf a dan b), bawaan '6_hari' bila
-- kosong; dibaca lewat app.pola_kerja(pid) supaya semua RPC (catat_lembur sekarang, F3-06 dan F3-07 nanti) membaca hal yang sama.
-- pengaturan->'jam_kerja_diatur_sendiri' (boolean, Pasal 21 ayat (4)) ikut disimpan untuk F3-06.
-- 1. Hanya pemilik aktif (app.peran_aktif() = 'pemilik', tabel anggota, bukan klaim JWT) yang mengubah lewat atur_pola_kerja;
--    perubahan tercatat di audit_log dengan nilai lama dan baru. Tulis langsung ke dua kunci itu oleh authenticated ditolak
--    (pemilik punya hak update kolom pengaturan), dan constraint menolak nilai lain dari jalur mana pun.
-- 2. aturan_kerja() untuk kartu "Aturan kerja": pola, apakah sudah pernah disimpan, hak ubah, dan jumlah lembur libur yang nyata
--    (lembar dampak). Pemilik, admin, akuntan aktif; staf dan anon ditolak.
-- 3. catat_lembur: definisi hidup diambil dengan pg_get_functiondef dan hanya disisipi pemeriksaan pola (replace teks persis,
--    jumlah kemunculan diperiksa, pola Q-23). Jenis libur yang tidak cocok dengan pola usaha ditolak dengan pesan yang menyebut
--    pola usaha; 'hari_kerja' diterima di kedua pola. Jam 0 (batal) tetap boleh untuk jenis pola lama, agar lembur yang tercatat
--    sebelum pola diganti masih bisa dibatalkan; jam 0 tidak menambah upah. Lembur lama tidak diubah.

create or replace function app.pola_kerja(p_pid uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select p.pengaturan ->> 'pola_kerja' from public.perusahaan p where p.id = p_pid), '6_hari')
$$;
revoke all on function app.pola_kerja(uuid) from public, anon, authenticated;
comment on function app.pola_kerja(uuid) is 'Pola kerja usaha: 6_hari (7 jam sehari) atau 5_hari (8 jam sehari), PP 35/2021 Pasal 21 ayat (2). Bawaan 6_hari bila belum disimpan (Q-22).';

alter table public.perusahaan add constraint perusahaan_pola_kerja check (
  (pengaturan ->> 'pola_kerja') is null or (pengaturan ->> 'pola_kerja') in ('6_hari', '5_hari'));
alter table public.perusahaan add constraint perusahaan_jam_kerja_diatur_sendiri check (
  not (pengaturan ? 'jam_kerja_diatur_sendiri') or jsonb_typeof(pengaturan -> 'jam_kerja_diatur_sendiri') = 'boolean');

create or replace function app.jaga_pola_kerja() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (new.pengaturan -> 'pola_kerja' is distinct from old.pengaturan -> 'pola_kerja'
     or new.pengaturan -> 'jam_kerja_diatur_sendiri' is distinct from old.pengaturan -> 'jam_kerja_diatur_sendiri') then
    raise exception 'Aturan kerja diubah lewat kartu Aturan kerja (atur_pola_kerja), supaya tercatat' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.jaga_pola_kerja() from public, anon, authenticated;
create trigger perusahaan_jaga_pola before update of pengaturan on public.perusahaan
  for each row execute function app.jaga_pola_kerja();

create or replace function public.atur_pola_kerja(p_pola text, p_diatur_sendiri boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_atur jsonb; v_lama jsonb; v_baru jsonb;
begin
  if v_pid is null or app.peran_aktif() is distinct from 'pemilik' then
    raise exception 'Hanya pemilik yang bisa mengubah aturan kerja' using errcode = '42501';
  end if;
  if p_pola is null or p_pola not in ('6_hari', '5_hari') then
    raise exception 'Pola kerja hanya 6_hari atau 5_hari' using errcode = '22023';
  end if;
  select p.pengaturan into v_atur from public.perusahaan p where p.id = v_pid for update;
  v_lama := jsonb_build_object('pola_kerja', coalesce(v_atur ->> 'pola_kerja', '6_hari'),
    'jam_kerja_diatur_sendiri', coalesce(v_atur -> 'jam_kerja_diatur_sendiri' = 'true'::jsonb, false),
    'bawaan', not coalesce(v_atur ? 'pola_kerja', false));
  v_baru := jsonb_build_object('pola_kerja', p_pola, 'jam_kerja_diatur_sendiri', coalesce(p_diatur_sendiri, false));
  if (v_lama - 'bawaan') is distinct from v_baru or (v_lama ->> 'bawaan')::boolean then
    update public.perusahaan set pengaturan = pengaturan || v_baru where id = v_pid;
    insert into public.audit_log (perusahaan_id, tabel, baris_id, aksi, sebelum, sesudah)
    values (v_pid, 'perusahaan', v_pid, 'atur_pola_kerja', v_lama, v_baru);
    return v_baru || jsonb_build_object('berubah', true);
  end if;
  return v_baru || jsonb_build_object('berubah', false);
end $$;
revoke all on function public.atur_pola_kerja(text, boolean) from public, anon;
grant execute on function public.atur_pola_kerja(text, boolean) to authenticated;

create or replace function public.aturan_kerja() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := app.peran_aktif(); v_atur jsonb;
begin
  if v_pid is null or coalesce(v_peran, '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang melihat aturan kerja' using errcode = '42501';
  end if;
  select p.pengaturan into v_atur from public.perusahaan p where p.id = v_pid;
  return jsonb_build_object(
    'pola_kerja', app.pola_kerja(v_pid),
    'tersimpan', coalesce(v_atur ? 'pola_kerja', false),
    'jam_kerja_diatur_sendiri', coalesce(v_atur -> 'jam_kerja_diatur_sendiri' = 'true'::jsonb, false),
    'bisa_ubah', v_peran = 'pemilik',
    'lembur_libur', (select count(*) from public.lembur l where l.perusahaan_id = v_pid and l.jenis <> 'hari_kerja' and l.jam > 0),
    'slip', (select count(*) from public.slip_gaji s where s.perusahaan_id = v_pid));
end $$;
revoke all on function public.aturan_kerja() from public, anon;
grant execute on function public.aturan_kerja() to authenticated;

create function pg_temp.ganti_teks(p_fungsi regprocedure, variadic p_pasangan text[]) returns void
language plpgsql as $$
declare d text := pg_get_functiondef(p_fungsi); lama text; baru text; n int; ada int;
begin
  for i in 1 .. array_length(p_pasangan, 1) / 3 loop
    lama := p_pasangan[3 * i - 2]; baru := p_pasangan[3 * i - 1]; n := p_pasangan[3 * i]::int;
    ada := (length(d) - length(replace(d, lama, ''))) / length(lama);
    if ada <> n then
      raise exception 'Q-22: % memuat pola % kali, bukan %: %', p_fungsi, ada, n, lama;
    end if;
    d := replace(d, lama, baru);
  end loop;
  execute d;
end $$;

select pg_temp.ganti_teks('public.catat_lembur(uuid,date,text,integer,text)',
  $a$  if v_maks is null then raise exception 'Jenis hari lembur tidak dikenal' using errcode = '22023'; end if;
$a$,
  $a$  if v_maks is null then raise exception 'Jenis hari lembur tidak dikenal' using errcode = '22023'; end if;
  -- Q-22: jenis libur mengikuti pola kerja usaha (app.pola_kerja). Jam 0 (batal) boleh untuk lembur lama berjenis pola lain.
  if p_jam > 0 and p_jenis <> 'hari_kerja'
     and (app.pola_kerja(v_pid) = '5_hari') <> (p_jenis = 'libur_pola_5_hari') then
    raise exception 'Usahamu bekerja % hari seminggu (Aturan kerja di halaman Usahamu), jadi lembur hari libur dicatat sebagai "Hari libur (kerja % hari seminggu)". Ganti jenis hari, atau ubah Aturan kerja bila polanya memang berubah.',
      left(app.pola_kerja(v_pid), 1), left(app.pola_kerja(v_pid), 1) using errcode = '22023';
  end if;
$a$, '1');

drop function pg_temp.ganti_teks(regprocedure, text[]);
