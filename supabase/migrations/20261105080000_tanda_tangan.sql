-- M-17 dokumen dan tanda tangan (menutup SI-02, SI-03, SI-04, SI-07, SI-10, sebagian SI-01/SI-06/JU-05; tes supabase/tests/tanda_tangan.test.sql).
-- Dasar: PP 71/2019 Pasal 59 ayat (3) (syarat sah tanda tangan elektronik: perubahan setelah ditandatangani dapat diketahui,
-- ada cara mengenali penanda tangan dan persetujuannya) dan Pasal 60 ayat (4) (tanda tangan elektronik tidak tersertifikasi =
-- dibuat tanpa Penyelenggara Sertifikasi Elektronik). Nadi hanya membuat yang TIDAK tersertifikasi dan menyebutnya begitu.
--   - sign_document: isi teks, sidik = sha256(isi) dibekukan saat dikirim; trigger menolak perubahan isi/sidik setelah draf;
--     kode verifikasi publik; jenis dan nilai menentukan tanda wajib meterai (UU 10/2020 Pasal 3 ayat (2) huruf a dan g, Pasal 5:
--     Rp10.000; e-Meterai dibeli lewat distributor resmi, tidak di Nadi); cap perusahaan = gambar, tidak tersertifikasi;
--     tanggal berakhir kontrak + hari pengingat; kedaluwarsa tautan.
--   - sign_signer: penanda tangan berurutan; token acak sekali pakai (hash saja yang disimpan), hanya berlaku saat gilirannya;
--     persetujuan = mengetik nama sendiri + mencentang setuju.
--   - sign_event: jejak bukti berantai hash (hash = sha256(hash sebelumnya | data)) berisi waktu, IP, dan perangkat dari header
--     permintaan; verifikasi menghitung ulang rantai.
--   - sign_template + kirim massal dari templat ({nama} diganti nama penerima).
-- Nadi tidak mengirim pesan: tautan ditampilkan sekali ke pengirim untuk dibagikan sendiri (wa.me).

create table public.sign_document (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex')),
  judul text not null check (length(btrim(judul)) between 3 and 150),
  isi text not null check (length(btrim(isi)) between 10 and 20000),
  jenis text not null default 'lain' check (jenis in ('perjanjian', 'pernyataan', 'kuitansi', 'lain')),
  nilai bigint check (nilai is null or nilai between 0 and 1000000000000),
  cap boolean not null default false,
  sidik text check (sidik is null or sidik ~ '^[0-9a-f]{64}$'),
  status text not null default 'draf' check (status in ('draf', 'dikirim', 'selesai', 'ditolak', 'batal')),
  kedaluwarsa_at timestamptz,
  berakhir date,
  pengingat_hari int not null default 30 check (pengingat_hari between 1 and 365),
  dikirim_at timestamptz,
  selesai_at timestamptz,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, id),
  check (status = 'draf' or sidik is not null)
);
create index on public.sign_document (perusahaan_id, dibuat_at desc);

create table public.sign_signer (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  document_id uuid not null,
  urutan int not null check (urutan between 1 and 10),
  nama text not null check (length(btrim(nama)) between 2 and 80),
  kontak text check (kontak is null or length(kontak) <= 120),
  token_hash text unique,
  status text not null default 'menunggu' check (status in ('menunggu', 'aktif', 'ditandatangani', 'ditolak')),
  nama_ketik text,
  alasan text check (alasan is null or length(alasan) <= 300),
  ditandatangani_at timestamptz,
  unique (document_id, urutan),
  foreign key (perusahaan_id, document_id) references public.sign_document (perusahaan_id, id)
);

create table public.sign_event (
  seq bigint generated always as identity primary key,
  perusahaan_id uuid not null,
  document_id uuid not null,
  signer_id uuid,
  jenis text not null check (jenis in ('dibuat', 'dikirim', 'dibuka', 'ditandatangani', 'ditolak', 'selesai', 'batal')),
  waktu timestamptz not null default clock_timestamp(),
  ip text,
  perangkat text,
  sidik text,
  hash text not null,
  foreign key (perusahaan_id, document_id) references public.sign_document (perusahaan_id, id)
);
create index on public.sign_event (document_id, seq);

create table public.sign_template (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 150),
  isi text not null check (length(btrim(isi)) between 10 and 20000),
  jenis text not null default 'lain' check (jenis in ('perjanjian', 'pernyataan', 'kuitansi', 'lain')),
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, judul)
);

alter table public.sign_document enable row level security;
alter table public.sign_signer enable row level security;
alter table public.sign_event enable row level security;
alter table public.sign_template enable row level security;
create policy sign_document_baca on public.sign_document for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy sign_signer_baca on public.sign_signer for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy sign_event_baca on public.sign_event for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy sign_template_baca on public.sign_template for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
-- Kolom token_hash tidak perlu terbaca di aplikasi.
grant select (id, perusahaan_id, document_id, urutan, nama, kontak, status, nama_ketik, alasan, ditandatangani_at) on public.sign_signer to authenticated;
grant select on public.sign_document, public.sign_event, public.sign_template to authenticated;

-- Isi dan sidik beku setelah dokumen dikirim.
create or replace function app.jaga_sign_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draf' and (new.isi is distinct from old.isi or new.judul is distinct from old.judul or new.sidik is distinct from old.sidik) then
    raise exception 'Dokumen yang sudah dikirim tidak bisa diubah. Batalkan, lalu buat dokumen baru.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger jaga_sign_document before update on public.sign_document for each row execute function app.jaga_sign_document();

create or replace function app.sign_sidik(p_isi text) returns text
language sql immutable set search_path = '' as $$ select encode(extensions.digest(convert_to(p_isi, 'UTF8'), 'sha256'), 'hex') $$;

-- Wajib meterai menurut UU 10/2020 Pasal 3 ayat (2): surat perjanjian dan surat pernyataan (huruf a); dokumen penerimaan uang
-- atau pelunasan utang bernilai lebih dari Rp5.000.000 (huruf g). Tarif tetap Rp10.000 (Pasal 5).
create or replace function app.sign_butuh_meterai(p_jenis text, p_nilai bigint) returns boolean
language sql immutable set search_path = '' as $$ select p_jenis in ('perjanjian', 'pernyataan') or (p_jenis = 'kuitansi' and coalesce(p_nilai, 0) > 5000000) $$;

create or replace function app.sign_catat(p_pid uuid, p_doc uuid, p_signer uuid, p_jenis text, p_sidik text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_h json := nullif(current_setting('request.headers', true), '')::json; v_ip text; v_ua text; v_prev text; v_waktu timestamptz := clock_timestamp();
begin
  v_ip := left(btrim(split_part(coalesce(v_h ->> 'x-forwarded-for', v_h ->> 'x-real-ip', ''), ',', 1)), 64);
  v_ua := left(coalesce(v_h ->> 'user-agent', ''), 200);
  perform pg_advisory_xact_lock(hashtextextended(p_doc::text, 0));
  select hash into v_prev from public.sign_event where document_id = p_doc order by seq desc limit 1;
  insert into public.sign_event (perusahaan_id, document_id, signer_id, jenis, waktu, ip, perangkat, sidik, hash)
  values (p_pid, p_doc, p_signer, p_jenis, v_waktu, nullif(v_ip, ''), nullif(v_ua, ''), p_sidik,
          encode(extensions.digest(convert_to(coalesce(v_prev, '') || '|' || p_jenis || '|' || coalesce(p_signer::text, '') || '|' || to_char(v_waktu at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
            || '|' || coalesce(nullif(v_ip, ''), '') || '|' || coalesce(nullif(v_ua, ''), '') || '|' || coalesce(p_sidik, ''), 'UTF8'), 'sha256'), 'hex'));
end $$;

-- Rantai jejak utuh bila setiap hash sama dengan hitungan ulang dari hash sebelumnya dan datanya.
create or replace function app.sign_rantai_utuh(p_doc uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare e record; v_prev text := ''; v_h text;
begin
  for e in select * from public.sign_event where document_id = p_doc order by seq loop
    v_h := encode(extensions.digest(convert_to(v_prev || '|' || e.jenis || '|' || coalesce(e.signer_id::text, '') || '|' || to_char(e.waktu at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
             || '|' || coalesce(e.ip, '') || '|' || coalesce(e.perangkat, '') || '|' || coalesce(e.sidik, ''), 'UTF8'), 'sha256'), 'hex');
    if v_h <> e.hash then return false; end if;
    v_prev := e.hash;
  end loop;
  return true;
end $$;

-- ---------- pengirim (pemilik/admin) ----------
create or replace function public.save_sign_document(p_judul text, p_isi text, p_jenis text, p_nilai bigint, p_cap boolean, p_berakhir date,
  p_pengingat int, p_kedaluwarsa_hari int, p_penanda jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; e jsonb; i int := 0;
begin
  if length(btrim(coalesce(p_judul, ''))) not between 3 and 150 then raise exception 'Judul dokumen 3 sampai 150 huruf' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_isi, ''))) not between 10 and 20000 then raise exception 'Isi dokumen 10 sampai 20.000 huruf' using errcode = '22023'; end if;
  if coalesce(p_jenis, 'lain') not in ('perjanjian', 'pernyataan', 'kuitansi', 'lain') then raise exception 'Jenis dokumen tidak dikenal' using errcode = '22023'; end if;
  if jsonb_typeof(p_penanda) is distinct from 'array' or jsonb_array_length(p_penanda) not between 1 and 10 then
    raise exception 'Isi 1 sampai 10 penanda tangan' using errcode = '22023';
  end if;
  if p_kedaluwarsa_hari is not null and p_kedaluwarsa_hari not between 1 and 90 then raise exception 'Tautan berlaku 1 sampai 90 hari' using errcode = '22023'; end if;
  insert into public.sign_document (perusahaan_id, judul, isi, jenis, nilai, cap, berakhir, pengingat_hari, kedaluwarsa_at, dibuat_oleh)
  values (v_pid, btrim(p_judul), btrim(p_isi), coalesce(p_jenis, 'lain'), p_nilai, coalesce(p_cap, false), p_berakhir, coalesce(p_pengingat, 30),
          now() + make_interval(days => coalesce(p_kedaluwarsa_hari, 14)), auth.uid())
  returning id into v_id;
  for e in select * from jsonb_array_elements(p_penanda) loop
    i := i + 1;
    if length(btrim(coalesce(e ->> 'nama', ''))) not between 2 and 80 then raise exception 'Nama penanda tangan ke-% 2 sampai 80 huruf', i using errcode = '22023'; end if;
    insert into public.sign_signer (perusahaan_id, document_id, urutan, nama, kontak)
    values (v_pid, v_id, i, btrim(e ->> 'nama'), nullif(left(btrim(coalesce(e ->> 'kontak', '')), 120), ''));
  end loop;
  perform app.sign_catat(v_pid, v_id, null, 'dibuat', null);
  return v_id;
end $$;

-- Kirim: sidik dibekukan, token dibuat untuk setiap penanda tangan (ditampilkan sekali), penanda tangan pertama aktif.
create or replace function app.sign_kirim(p_pid uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.sign_document; s record; v_token text; v_out jsonb := '[]';
begin
  select * into d from public.sign_document where id = p_id and perusahaan_id = p_pid for update;
  if not found then raise exception 'Dokumen tidak ditemukan' using errcode = 'P0002'; end if;
  if d.status <> 'draf' then raise exception 'Dokumen ini sudah dikirim' using errcode = '22023'; end if;
  update public.sign_document set sidik = app.sign_sidik(isi), status = 'dikirim', dikirim_at = now(),
         kedaluwarsa_at = coalesce(kedaluwarsa_at, now() + interval '14 days') where id = d.id;
  for s in select * from public.sign_signer where document_id = d.id order by urutan loop
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    update public.sign_signer set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), status = case when s.urutan = 1 then 'aktif' else 'menunggu' end where id = s.id;
    v_out := v_out || jsonb_build_object('urutan', s.urutan, 'nama', s.nama, 'kontak', s.kontak, 'token', v_token);
  end loop;
  perform app.sign_catat(p_pid, d.id, null, 'dikirim', app.sign_sidik(d.isi));
  return jsonb_build_object('id', d.id, 'kode', d.kode, 'sidik', app.sign_sidik(d.isi), 'penanda', v_out);
end $$;

create or replace function public.send_sign_document(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return app.sign_kirim(app.wajib_pengelola(), p_id);
end $$;

create or replace function public.cancel_sign_document(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  update public.sign_document set status = 'batal' where id = p_id and perusahaan_id = v_pid and status in ('draf', 'dikirim');
  if not found then raise exception 'Dokumen tidak ditemukan atau sudah selesai' using errcode = 'P0002'; end if;
  update public.sign_signer set token_hash = null where document_id = p_id;
  perform app.sign_catat(v_pid, p_id, null, 'batal', null);
end $$;

create or replace function public.save_sign_template(p_judul text, p_isi text, p_jenis text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v uuid;
begin
  if length(btrim(coalesce(p_judul, ''))) not between 3 and 150 or length(btrim(coalesce(p_isi, ''))) not between 10 and 20000 then
    raise exception 'Judul 3 sampai 150 huruf, isi 10 sampai 20.000 huruf' using errcode = '22023';
  end if;
  insert into public.sign_template (perusahaan_id, judul, isi, jenis) values (v_pid, btrim(p_judul), btrim(p_isi), coalesce(p_jenis, 'lain'))
  on conflict (perusahaan_id, judul) do update set isi = excluded.isi, jenis = excluded.jenis returning id into v;
  return v;
end $$;

-- Kirim massal: satu dokumen per penerima dari templat ({nama} diganti), penerima sebagai penanda tangan tunggal, langsung dikirim.
create or replace function public.send_from_template(p_template uuid, p_penerima jsonb, p_cap boolean, p_berakhir date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); t public.sign_template; e jsonb; v_id uuid; v_out jsonb := '[]'; r jsonb;
begin
  select * into t from public.sign_template where id = p_template and perusahaan_id = v_pid;
  if not found then raise exception 'Templat tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_penerima) is distinct from 'array' or jsonb_array_length(p_penerima) not between 1 and 50 then
    raise exception 'Isi 1 sampai 50 penerima' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_penerima) loop
    v_id := public.save_sign_document(replace(t.judul, '{nama}', btrim(e ->> 'nama')), replace(t.isi, '{nama}', btrim(e ->> 'nama')), t.jenis, null, p_cap, p_berakhir, 30, 14,
                                      jsonb_build_array(jsonb_build_object('nama', e ->> 'nama', 'kontak', e ->> 'kontak')));
    r := app.sign_kirim(v_pid, v_id);
    v_out := v_out || jsonb_build_object('nama', e ->> 'nama', 'kontak', e ->> 'kontak', 'kode', r ->> 'kode', 'token', r -> 'penanda' -> 0 ->> 'token');
  end loop;
  return v_out;
end $$;

-- Pengingat: penanda tangan aktif yang belum menandatangani lebih dari 2 hari, dan kontrak yang berakhir dalam pengingat_hari.
create or replace function public.sign_reminders() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_hari date := app.hari_ini(v_pid);
begin
  return jsonb_build_object(
    'tertunda', coalesce((select jsonb_agg(jsonb_build_object('dokumen', d.id, 'judul', d.judul, 'nama', s.nama, 'kontak', s.kontak, 'sejak', d.dikirim_at) order by d.dikirim_at)
      from public.sign_document d join public.sign_signer s on s.document_id = d.id and s.status = 'aktif'
     where d.perusahaan_id = v_pid and d.status = 'dikirim' and d.dikirim_at < now() - interval '2 days'), '[]'),
    'berakhir', coalesce((select jsonb_agg(jsonb_build_object('dokumen', d.id, 'judul', d.judul, 'berakhir', d.berakhir, 'sisa_hari', d.berakhir - v_hari) order by d.berakhir)
      from public.sign_document d where d.perusahaan_id = v_pid and d.status = 'selesai' and d.berakhir is not null
       and d.berakhir between v_hari and v_hari + d.pengingat_hari), '[]'));
end $$;

-- ---------- penanda tangan (tanpa akun, lewat token) ----------
create or replace function app.sign_signer_by_token(p_token text) returns public.sign_signer
language sql stable security definer set search_path = '' as $$
  select * from public.sign_signer where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.sign_view(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sign_signer := app.sign_signer_by_token(p_token); d public.sign_document;
begin
  if s.id is null then raise exception 'Tautan tidak berlaku. Minta tautan baru ke pengirim.' using errcode = 'P0002'; end if;
  select * into d from public.sign_document where id = s.document_id;
  if s.status = 'aktif' and d.status = 'dikirim' then perform app.sign_catat(d.perusahaan_id, d.id, s.id, 'dibuka', d.sidik); end if;
  return jsonb_build_object('judul', d.judul, 'isi', d.isi, 'jenis', d.jenis, 'nilai', d.nilai, 'cap', d.cap, 'sidik', d.sidik, 'kode', d.kode,
    'usaha', (select nama from public.perusahaan where id = d.perusahaan_id), 'status', d.status, 'kedaluwarsa', d.kedaluwarsa_at < now(),
    'butuh_meterai', app.sign_butuh_meterai(d.jenis, d.nilai), 'saya', s.nama, 'giliran', s.status = 'aktif' and d.status = 'dikirim' and d.kedaluwarsa_at >= now(),
    'status_saya', s.status,
    'penanda', (select jsonb_agg(jsonb_build_object('urutan', x.urutan, 'nama', x.nama, 'status', x.status, 'waktu', x.ditandatangani_at) order by x.urutan)
                  from public.sign_signer x where x.document_id = d.id));
end $$;

-- Tanda tangan: hanya saat giliran, sebelum kedaluwarsa, dengan nama yang diketik sama dengan nama penanda tangan dan centang setuju.
-- Token dihapus setelah dipakai (sekali pakai); penanda tangan berikutnya menjadi aktif; penanda tangan terakhir menyelesaikan dokumen.
create or replace function public.sign_document(p_token text, p_nama_ketik text, p_setuju boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sign_signer := app.sign_signer_by_token(p_token); d public.sign_document; v_next uuid;
begin
  if s.id is null then raise exception 'Tautan tidak berlaku. Minta tautan baru ke pengirim.' using errcode = 'P0002'; end if;
  select * into d from public.sign_document where id = s.document_id for update;
  if d.status <> 'dikirim' then raise exception 'Dokumen ini tidak menunggu tanda tangan' using errcode = '22023'; end if;
  if d.kedaluwarsa_at < now() then raise exception 'Tautan sudah kedaluwarsa. Minta pengirim membuat ulang.' using errcode = '22023'; end if;
  if s.status <> 'aktif' then raise exception 'Belum giliranmu menandatangani' using errcode = '22023'; end if;
  if not coalesce(p_setuju, false) then raise exception 'Centang persetujuan dulu' using errcode = '22023'; end if;
  if lower(regexp_replace(btrim(coalesce(p_nama_ketik, '')), '\s+', ' ', 'g')) <> lower(regexp_replace(s.nama, '\s+', ' ', 'g')) then
    raise exception 'Ketik namamu persis seperti tertulis: %', s.nama using errcode = '22023';
  end if;
  update public.sign_signer set status = 'ditandatangani', nama_ketik = btrim(p_nama_ketik), ditandatangani_at = now(), token_hash = null where id = s.id;
  perform app.sign_catat(d.perusahaan_id, d.id, s.id, 'ditandatangani', d.sidik);
  select id into v_next from public.sign_signer where document_id = d.id and status = 'menunggu' order by urutan limit 1;
  if v_next is not null then
    update public.sign_signer set status = 'aktif' where id = v_next;
  else
    update public.sign_document set status = 'selesai', selesai_at = now() where id = d.id;
    perform app.sign_catat(d.perusahaan_id, d.id, null, 'selesai', d.sidik);
  end if;
  return jsonb_build_object('kode', d.kode, 'selesai', v_next is null);
end $$;

create or replace function public.decline_sign(p_token text, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sign_signer := app.sign_signer_by_token(p_token); d public.sign_document;
begin
  if s.id is null then raise exception 'Tautan tidak berlaku' using errcode = 'P0002'; end if;
  select * into d from public.sign_document where id = s.document_id for update;
  if d.status <> 'dikirim' or s.status <> 'aktif' then raise exception 'Belum giliranmu' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_alasan, ''))) not between 3 and 300 then raise exception 'Tulis alasan menolak' using errcode = '22023'; end if;
  update public.sign_signer set status = 'ditolak', alasan = btrim(p_alasan), token_hash = null where id = s.id;
  update public.sign_document set status = 'ditolak' where id = d.id;
  update public.sign_signer set token_hash = null where document_id = d.id;
  perform app.sign_catat(d.perusahaan_id, d.id, s.id, 'ditolak', d.sidik);
end $$;

-- Verifikasi publik dari kode: status, penanda tangan dan waktunya, isi masih sama dengan sidik, rantai jejak utuh,
-- dan bila p_sidik diberikan (sha256 salinan yang dipegang penanya) apakah salinan itu sama dengan dokumen yang ditandatangani.
create or replace function public.verify_sign(p_kode text, p_sidik text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.sign_document;
begin
  select * into d from public.sign_document where kode = upper(btrim(coalesce(p_kode, ''))) and status <> 'draf';
  if not found then return null; end if;
  return jsonb_build_object('judul', d.judul, 'usaha', (select nama from public.perusahaan where id = d.perusahaan_id), 'status', d.status,
    'jenis_tanda_tangan', 'tidak_tersertifikasi', 'sidik', d.sidik, 'isi_utuh', app.sign_sidik(d.isi) = d.sidik,
    'rantai_utuh', app.sign_rantai_utuh(d.id), 'cap', d.cap, 'butuh_meterai', app.sign_butuh_meterai(d.jenis, d.nilai),
    'salinan_cocok', case when p_sidik is null then null else lower(btrim(p_sidik)) = d.sidik end,
    'penanda', (select jsonb_agg(jsonb_build_object('urutan', s.urutan, 'nama', s.nama, 'status', s.status, 'waktu', s.ditandatangani_at) order by s.urutan)
                  from public.sign_signer s where s.document_id = d.id),
    'jejak', (select jsonb_agg(jsonb_build_object('jenis', e.jenis, 'waktu', e.waktu) order by e.seq) from public.sign_event e where e.document_id = d.id));
end $$;

revoke all on function app.jaga_sign_document(), app.sign_sidik(text), app.sign_butuh_meterai(text, bigint), app.sign_catat(uuid, uuid, uuid, text, text),
  app.sign_rantai_utuh(uuid), app.sign_kirim(uuid, uuid), app.sign_signer_by_token(text) from public, anon, authenticated;
revoke all on function public.save_sign_document(text, text, text, bigint, boolean, date, int, int, jsonb), public.send_sign_document(uuid),
  public.cancel_sign_document(uuid), public.save_sign_template(text, text, text), public.send_from_template(uuid, jsonb, boolean, date), public.sign_reminders(),
  public.sign_view(text), public.sign_document(text, text, boolean), public.decline_sign(text, text), public.verify_sign(text, text) from public;
grant execute on function public.save_sign_document(text, text, text, bigint, boolean, date, int, int, jsonb), public.send_sign_document(uuid),
  public.cancel_sign_document(uuid), public.save_sign_template(text, text, text), public.send_from_template(uuid, jsonb, boolean, date), public.sign_reminders() to authenticated;
grant execute on function public.sign_view(text), public.sign_document(text, text, boolean), public.decline_sign(text, text), public.verify_sign(text, text) to anon, authenticated;
