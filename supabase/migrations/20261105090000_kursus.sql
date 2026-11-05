-- M-13B LMS: kursus (ditulis pemilik atau diambil dari langkah Rekam ilmu F3-07C), kuis pilihan ganda yang dinilai server (kolom kunci
-- tidak diberi hak baca ke klien sama sekali), percobaan maksimal 5 per hari, lulus >= ambang memberi sertifikat bernomor SERT dengan kode
-- verifikasi acak untuk halaman publik /sertifikat/<kode> (cetak/simpan PDF dari peramban). Progres per orang hanya untuk dirinya,
-- atasan langsungnya, dan pemilik/admin (app.boleh_kinerja M-13).

create table public.course (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 120),
  ringkasan text check (ringkasan is null or length(ringkasan) <= 1000),
  materi jsonb not null default '[]' check (jsonb_typeof(materi) = 'array' and jsonb_array_length(materi) <= 40),
  sumber_butir_id uuid references public.serah_butir(id) on delete set null,
  ambang integer not null default 70 check (ambang between 50 and 100),
  aktif boolean not null default true,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);

create table public.course_question (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  course_id uuid not null references public.course(id) on delete cascade,
  urutan integer not null default 0,
  pertanyaan text not null check (length(btrim(pertanyaan)) between 3 and 300),
  pilihan text[] not null check (array_length(pilihan, 1) between 2 and 6),
  kunci integer not null check (kunci >= 0)
);

create table public.course_attempt (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  course_id uuid not null references public.course(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  skor integer not null check (skor between 0 and 100),
  lulus boolean not null,
  at timestamptz not null default now()
);
create index course_attempt_orang on public.course_attempt (course_id, orang_id, at desc);

create table public.certificate (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  course_id uuid not null references public.course(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  nomor text not null,
  kode text not null unique default upper(encode(extensions.gen_random_bytes(6), 'hex')),
  skor integer not null,
  terbit_at timestamptz not null default now(),
  unique (course_id, orang_id)
);

alter table public.course enable row level security;
alter table public.course_question enable row level security;
alter table public.course_attempt enable row level security;
alter table public.certificate enable row level security;
create policy course_baca on public.course for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
create policy course_question_baca on public.course_question for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
create policy course_attempt_baca on public.course_attempt for select to authenticated using (perusahaan_id = (select app.pid()) and app.boleh_kinerja(orang_id));
create policy certificate_baca on public.certificate for select to authenticated using (perusahaan_id = (select app.pid()) and app.boleh_kinerja(orang_id));
grant select on public.course, public.course_attempt, public.certificate to authenticated;
-- Kunci jawaban tidak pernah bisa dibaca klien.
grant select (id, perusahaan_id, course_id, urutan, pertanyaan, pilihan) on public.course_question to authenticated;

create or replace function public.save_course(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_materi jsonb := coalesce(p -> 'materi', '[]'); v_butir uuid := nullif(p ->> 'butir', '')::uuid; sb public.serah_butir;
begin
  if v_butir is not null then
    select * into sb from public.serah_butir where id = v_butir and perusahaan_id = v_pid and jenis = 'ilmu';
    if not found or sb.langkah is null then raise exception 'Butir Rekam ilmu belum punya langkah kerja' using errcode = 'P0002'; end if;
    v_materi := sb.langkah;
  end if;
  if jsonb_typeof(v_materi) <> 'array' or exists (select 1 from jsonb_array_elements(v_materi) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 600) then
    raise exception 'Materi berupa daftar paragraf, masing-masing 1 sampai 600 huruf' using errcode = '22023';
  end if;
  insert into public.course (perusahaan_id, judul, ringkasan, materi, sumber_butir_id, ambang, dibuat_oleh)
  values (v_pid, btrim(coalesce(nullif(p ->> 'judul', ''), sb.judul)), nullif(left(btrim(coalesce(p ->> 'ringkasan', '')), 1000), ''), v_materi, v_butir,
          coalesce(nullif(p ->> 'ambang', '')::int, 70), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_course_question(p_course uuid, p_pertanyaan text, p_pilihan text[], p_kunci integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_pil text[];
begin
  if not exists (select 1 from public.course where id = p_course and perusahaan_id = v_pid) then raise exception 'Kursus tidak ditemukan' using errcode = 'P0002'; end if;
  select array_agg(btrim(x)) into v_pil from unnest(p_pilihan) x where btrim(x) <> '';
  if coalesce(array_length(v_pil, 1), 0) < 2 or array_length(v_pil, 1) > 6 then raise exception 'Isi 2 sampai 6 pilihan jawaban' using errcode = '22023'; end if;
  if p_kunci is null or p_kunci < 0 or p_kunci >= array_length(v_pil, 1) then raise exception 'Pilih jawaban yang benar' using errcode = '22023'; end if;
  insert into public.course_question (perusahaan_id, course_id, urutan, pertanyaan, pilihan, kunci)
  values (v_pid, p_course, (select coalesce(max(urutan), 0) + 1 from public.course_question where course_id = p_course), btrim(p_pertanyaan), v_pil, p_kunci)
  returning id into v_id;
  return v_id;
end $$;

-- Jawaban {id_soal: indeks pilihan}; dinilai di server. Lulus pertama kali menerbitkan sertifikat (sekali per kursus per orang).
create or replace function public.submit_quiz(p_course uuid, p_jawaban jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); c public.course; v_total int; v_benar int; v_skor int; v_lulus boolean; r jsonb; s public.certificate;
begin
  if v_pid is null or v_orang is null then raise exception 'Akunmu belum terhubung ke data orang' using errcode = '42501'; end if;
  select * into c from public.course where id = p_course and perusahaan_id = v_pid and aktif;
  if not found then raise exception 'Kursus tidak ditemukan' using errcode = 'P0002'; end if;
  if (select count(*) from public.course_attempt where course_id = c.id and orang_id = v_orang and at > now() - interval '1 day') >= 5 then
    raise exception 'Sudah 5 kali mencoba hari ini. Pelajari materinya lagi, lalu coba besok.' using errcode = '22023';
  end if;
  select count(*), count(*) filter (where (p_jawaban ->> q.id::text) ~ '^\d+$' and (p_jawaban ->> q.id::text)::int = q.kunci) into v_total, v_benar
    from public.course_question q where q.course_id = c.id;
  if v_total = 0 then raise exception 'Kursus ini belum punya soal' using errcode = '22023'; end if;
  v_skor := round(100.0 * v_benar / v_total);
  v_lulus := v_skor >= c.ambang;
  insert into public.course_attempt (perusahaan_id, course_id, orang_id, skor, lulus) values (v_pid, c.id, v_orang, v_skor, v_lulus);
  if v_lulus then
    select * into s from public.certificate where course_id = c.id and orang_id = v_orang;
    if not found then
      insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'SERT', 'Sertifikat kursus', '{no:3}/SERT/{bulan_romawi}/{tahun}')
      on conflict (perusahaan_id, jenis) do nothing;
      r := app.terbit_nomor(v_pid, 'SERT', 'sertifikat ' || c.id || ' ' || v_orang, auth.uid());
      insert into public.certificate (perusahaan_id, course_id, orang_id, nomor, skor) values (v_pid, c.id, v_orang, r ->> 'nomor', v_skor) returning * into s;
    end if;
  end if;
  return jsonb_build_object('skor', v_skor, 'benar', v_benar, 'total', v_total, 'lulus', v_lulus, 'ambang', c.ambang, 'sertifikat', s.kode, 'nomor', s.nomor);
end $$;

-- Progres kursus: skor terbaik, jumlah percobaan, sertifikat; baris hanya untuk orang yang boleh dilihat (diri, bawahan, semua bagi pengelola).
create or replace function public.course_progress(p_course uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('orang', x.orang_id, 'nama', o.nama, 'terbaik', x.terbaik, 'coba', x.coba, 'sertifikat', ce.kode) order by o.nama), '[]')
    from (select orang_id, max(skor) terbaik, count(*) coba from public.course_attempt where course_id = p_course and perusahaan_id = app.pid() group by orang_id) x
    join public.orang o on o.id = x.orang_id left join public.certificate ce on ce.course_id = p_course and ce.orang_id = x.orang_id
   where app.boleh_kinerja(x.orang_id)
$$;

create or replace function public.verify_certificate(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'nama', o.nama, 'kursus', c.judul, 'nomor', s.nomor, 'skor', s.skor, 'terbit', s.terbit_at, 'zona', p.zona_waktu)
    from public.certificate s join public.course c on c.id = s.course_id join public.orang o on o.id = s.orang_id join public.perusahaan p on p.id = s.perusahaan_id
   where s.kode = upper(btrim(coalesce(p_kode, '')))
$$;

revoke all on function public.save_course(jsonb), public.save_course_question(uuid, text, text[], integer), public.submit_quiz(uuid, jsonb),
  public.course_progress(uuid), public.verify_certificate(text) from public;
grant execute on function public.save_course(jsonb), public.save_course_question(uuid, text, text[], integer), public.submit_quiz(uuid, jsonb),
  public.course_progress(uuid) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
