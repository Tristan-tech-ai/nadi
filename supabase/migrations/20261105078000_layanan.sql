-- M-16 layanan pelanggan (docs/research/mekari/rencana.md; menutup QO-02, QO-04, QO-05, QO-03 sebagian, QO-17 sebagian;
-- tes supabase/tests/layanan.test.sql):
--   - support_setting: kunci obrolan publik acak (bukan kode usaha), jam layanan, SLA balasan pertama, pesan di luar jam;
--   - support_article: basis pengetahuan pelanggan;
--   - conversation + conversation_message: obrolan web dari halaman publik /bantuan/<kunci>; pengunjung memegang token acak
--     (yang disimpan hanya hash-nya); tiket = percakapan dengan status, agen, tenggat SLA, waktu balasan pertama, CSAT 1-5;
--   - bot tanpa model: kata pertanyaan dicocokkan dengan judul dan isi artikel; bila cocok, isi artikel dikutip apa adanya dengan
--     judulnya; bila tidak, percakapan diserahkan ke manusia. Bot tidak pernah menulis kalimat sendiri, jadi jawabannya hanya
--     bisa berasal dari basis pengetahuan (instruksi di pesan pengunjung tidak berpengaruh);
--   - service_report: jumlah tiket, tepat SLA, rata-rata menit balasan pertama, CSAT rata-rata, dijawab bot, per agen.
-- Batas penyalahgunaan: 20 percakapan baru per usaha per jam, 40 pesan pengunjung per percakapan, pesan 1-1000 huruf.
-- Telegram, email masuk, dan WhatsApp API butuh akun pihak ketiga (docs/research/mekari/pihak-ketiga.md), tidak dibuat di sini.

create table public.support_setting (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  kunci text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  aktif boolean not null default true,
  jam_mulai time not null default '08:00',
  jam_selesai time not null default '17:00',
  sla_menit int not null default 60 check (sla_menit between 5 and 2880),
  pesan_sambutan text not null default 'Halo, ada yang bisa kami bantu?' check (length(pesan_sambutan) between 3 and 300),
  pesan_luar_jam text not null default 'Terima kasih. Tim kami sedang di luar jam layanan dan akan membalas di jam kerja berikutnya.' check (length(pesan_luar_jam) between 3 and 300),
  diubah_at timestamptz not null default now()
);

create table public.support_article (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 120),
  isi text not null check (length(btrim(isi)) between 10 and 2000),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, id)
);

create table public.conversation (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kanal text not null default 'web' check (kanal in ('web')),
  token_hash text not null unique,
  pengunjung text not null check (length(btrim(pengunjung)) between 2 and 80),
  kontak text check (kontak is null or length(kontak) <= 120),
  status text not null default 'terbuka' check (status in ('terbuka', 'ditangani', 'selesai')),
  agen_id uuid references public.orang(id),
  tenggat timestamptz not null,
  dijawab_at timestamptz,
  ditutup_at timestamptz,
  csat int check (csat between 1 and 5),
  csat_catatan text check (csat_catatan is null or length(csat_catatan) <= 300),
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, id),
  check ((status = 'selesai') = (ditutup_at is not null))
);
create index on public.conversation (perusahaan_id, status, diubah_at desc);

create table public.conversation_message (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  conversation_id uuid not null,
  dari text not null check (dari in ('pengunjung', 'agen', 'bot', 'sistem')),
  isi text not null check (length(btrim(isi)) between 1 and 2000),
  artikel_id uuid,
  agen_id uuid references public.orang(id),
  dibuat_at timestamptz not null default now(),
  foreign key (perusahaan_id, conversation_id) references public.conversation (perusahaan_id, id),
  foreign key (perusahaan_id, artikel_id) references public.support_article (perusahaan_id, id)
);
create index on public.conversation_message (conversation_id, dibuat_at);

alter table public.support_setting enable row level security;
alter table public.support_article enable row level security;
alter table public.conversation enable row level security;
alter table public.conversation_message enable row level security;
create policy support_setting_baca on public.support_setting for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy support_article_baca on public.support_article for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'staf'));
-- Pengelola melihat semua percakapan; staf hanya yang ditugaskan kepadanya.
create policy conversation_baca on public.conversation for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or agen_id = (select app.orang_saya())));
create policy conversation_message_baca on public.conversation_message for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin')
         or exists (select 1 from public.conversation c where c.id = conversation_message.conversation_id and c.agen_id = (select app.orang_saya()))));
grant select on public.support_setting, public.support_article, public.conversation, public.conversation_message to authenticated;

-- ---------- pengaturan dan basis pengetahuan (pemilik/admin) ----------
create or replace function public.save_support_setting(p_aktif boolean, p_mulai time, p_selesai time, p_sla int, p_sambutan text, p_luar_jam text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_kunci text;
begin
  if p_mulai is null or p_selesai is null or p_mulai >= p_selesai then raise exception 'Jam mulai harus sebelum jam selesai' using errcode = '22023'; end if;
  if p_sla is null or p_sla not between 5 and 2880 then raise exception 'SLA balasan pertama 5 sampai 2880 menit' using errcode = '22023'; end if;
  insert into public.support_setting (perusahaan_id, aktif, jam_mulai, jam_selesai, sla_menit, pesan_sambutan, pesan_luar_jam)
  values (v_pid, coalesce(p_aktif, true), p_mulai, p_selesai, p_sla, coalesce(nullif(btrim(p_sambutan), ''), 'Halo, ada yang bisa kami bantu?'),
          coalesce(nullif(btrim(p_luar_jam), ''), 'Terima kasih. Tim kami sedang di luar jam layanan dan akan membalas di jam kerja berikutnya.'))
  on conflict (perusahaan_id) do update set aktif = excluded.aktif, jam_mulai = excluded.jam_mulai, jam_selesai = excluded.jam_selesai,
    sla_menit = excluded.sla_menit, pesan_sambutan = excluded.pesan_sambutan, pesan_luar_jam = excluded.pesan_luar_jam, diubah_at = now()
  returning kunci into v_kunci;
  return v_kunci;
end $$;

create or replace function public.save_support_article(p_id uuid, p_judul text, p_isi text, p_aktif boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid;
begin
  if length(btrim(coalesce(p_judul, ''))) not between 3 and 120 then raise exception 'Judul artikel 3 sampai 120 huruf' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_isi, ''))) not between 10 and 2000 then raise exception 'Isi artikel 10 sampai 2000 huruf' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.support_article (perusahaan_id, judul, isi, aktif) values (v_pid, btrim(p_judul), btrim(p_isi), coalesce(p_aktif, true)) returning id into v_id;
  else
    update public.support_article set judul = btrim(p_judul), isi = btrim(p_isi), aktif = coalesce(p_aktif, aktif), diubah_at = now()
     where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Artikel tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- ---------- bot pencocok kata ----------
-- Kata bermakna: huruf/angka >= 3, tanpa kata sambung umum. Artikel cocok bila minimal 2 kata pertanyaan (atau 1 bila pertanyaan
-- hanya punya 1 kata bermakna) ada di judul atau isi dan rasio cocok >= 0,5. Seri: judul yang cocok lebih banyak menang.
create or replace function app.support_words(p text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(lower(coalesce(p, '')), '[^a-z0-9]+') w
   where length(w) >= 3 and w not in ('yang', 'dan', 'atau', 'apa', 'apakah', 'bagaimana', 'gimana', 'kapan', 'berapa', 'untuk', 'dengan', 'dari', 'ini',
     'itu', 'saya', 'aku', 'kak', 'min', 'admin', 'bisa', 'boleh', 'mau', 'ingin', 'tolong', 'mohon', 'ada', 'tidak', 'nggak', 'gak', 'sudah', 'belum',
     'kalau', 'kok', 'dong', 'nya', 'the', 'and', 'what', 'how', 'can', 'you', 'please')
$$;

create or replace function app.support_match(p_pid uuid, p_tanya text) returns table (artikel_id uuid, judul text, isi text, skor numeric)
language sql stable security definer set search_path = '' as $$
  with q as (select app.support_words(p_tanya) k),
  a as (
    select s.id, s.judul, s.isi,
           (select count(*) from unnest(q.k) w where w = any(app.support_words(s.judul || ' ' || s.isi))) as cocok,
           (select count(*) from unnest(q.k) w where w = any(app.support_words(s.judul))) as cocok_judul,
           cardinality(q.k) as n
      from public.support_article s, q
     where s.perusahaan_id = p_pid and s.aktif and cardinality(q.k) > 0
  )
  select id, judul, isi, round(cocok::numeric / n, 2) from a
   where cocok >= least(2, n) and cocok::numeric / n >= 0.5
   order by cocok desc, cocok_judul desc, id limit 1
$$;

-- ---------- sisi pengunjung (anon) ----------
create or replace function app.dalam_jam(p_pid uuid, s public.support_setting) returns boolean
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select zona_waktu from public.perusahaan where id = p_pid), 'Asia/Jakarta'))::time between s.jam_mulai and s.jam_selesai
$$;

-- Pesan pengunjung masuk: dicatat, lalu bot mencoba menjawab dari artikel; bila tidak ada yang cocok dan percakapan belum
-- ditangani, pesan sistem memberi tahu bahwa tim akan membalas (di luar jam: pesan luar jam).
create or replace function app.support_incoming(c public.conversation, p_isi text) returns void
language plpgsql security definer set search_path = '' as $$
declare m record; s public.support_setting;
begin
  insert into public.conversation_message (perusahaan_id, conversation_id, dari, isi) values (c.perusahaan_id, c.id, 'pengunjung', btrim(p_isi));
  update public.conversation set diubah_at = now() where id = c.id;
  if c.status = 'ditangani' then return; end if;
  select * into m from app.support_match(c.perusahaan_id, p_isi);
  if m.artikel_id is not null then
    insert into public.conversation_message (perusahaan_id, conversation_id, dari, isi, artikel_id)
    values (c.perusahaan_id, c.id, 'bot', left(m.isi, 1800) || E'\n\n(Dari artikel: ' || m.judul || ')', m.artikel_id);
  elsif not exists (select 1 from public.conversation_message x where x.conversation_id = c.id and x.dari = 'sistem') then
    select * into s from public.support_setting where perusahaan_id = c.perusahaan_id;
    insert into public.conversation_message (perusahaan_id, conversation_id, dari, isi)
    values (c.perusahaan_id, c.id, 'sistem', case when app.dalam_jam(c.perusahaan_id, s) then 'Pesanmu sudah kami terima. Tim kami akan membalas di sini.' else s.pesan_luar_jam end);
  end if;
end $$;

create or replace function public.start_web_chat(p_kunci text, p_nama text, p_kontak text, p_pesan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.support_setting; v_token text := encode(extensions.gen_random_bytes(24), 'hex'); c public.conversation;
begin
  select * into s from public.support_setting where kunci = p_kunci and aktif;
  if not found then raise exception 'Obrolan ini tidak aktif' using errcode = 'P0002'; end if;
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 80 then raise exception 'Tulis namamu 2 sampai 80 huruf' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_pesan, ''))) not between 1 and 1000 then raise exception 'Tulis pesan 1 sampai 1000 huruf' using errcode = '22023'; end if;
  if (select count(*) from public.conversation where perusahaan_id = s.perusahaan_id and dibuat_at > now() - interval '1 hour') >= 20 then
    raise exception 'Sedang banyak obrolan baru. Coba lagi beberapa menit lagi.' using errcode = '53400';
  end if;
  insert into public.conversation (perusahaan_id, token_hash, pengunjung, kontak, tenggat)
  values (s.perusahaan_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), btrim(p_nama), nullif(left(btrim(coalesce(p_kontak, '')), 120), ''),
          now() + make_interval(mins => s.sla_menit))
  returning * into c;
  perform app.support_incoming(c, p_pesan);
  return jsonb_build_object('token', v_token);
end $$;

create or replace function app.conversation_by_token(p_token text) returns public.conversation
language sql stable security definer set search_path = '' as $$
  select * from public.conversation where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.send_visitor_message(p_token text, p_isi text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversation := app.conversation_by_token(p_token);
begin
  if c.id is null then raise exception 'Obrolan tidak ditemukan' using errcode = 'P0002'; end if;
  if c.status = 'selesai' then raise exception 'Obrolan ini sudah selesai. Mulai obrolan baru bila perlu.' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_isi, ''))) not between 1 and 1000 then raise exception 'Tulis pesan 1 sampai 1000 huruf' using errcode = '22023'; end if;
  if (select count(*) from public.conversation_message where conversation_id = c.id and dari = 'pengunjung') >= 40 then
    raise exception 'Obrolan ini sudah terlalu panjang. Tunggu balasan tim.' using errcode = '53400';
  end if;
  perform app.support_incoming(c, p_isi);
end $$;

-- Pengunjung membaca percakapannya sendiri (nama agen ditampilkan, data agen lain tidak).
create or replace function public.visitor_conversation(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.conversation := app.conversation_by_token(p_token);
begin
  if c.id is null then raise exception 'Obrolan tidak ditemukan' using errcode = 'P0002'; end if;
  return jsonb_build_object('status', c.status, 'csat', c.csat, 'usaha', (select nama from public.perusahaan where id = c.perusahaan_id),
    'pesan', coalesce((select jsonb_agg(jsonb_build_object('dari', m.dari, 'isi', m.isi, 'agen', o.nama, 'waktu', m.dibuat_at) order by m.dibuat_at, m.id)
      from public.conversation_message m left join public.orang o on o.id = m.agen_id where m.conversation_id = c.id), '[]'));
end $$;

create or replace function public.rate_conversation(p_token text, p_nilai int, p_catatan text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversation := app.conversation_by_token(p_token);
begin
  if c.id is null then raise exception 'Obrolan tidak ditemukan' using errcode = 'P0002'; end if;
  if c.status <> 'selesai' then raise exception 'Nilai obrolan setelah selesai' using errcode = '22023'; end if;
  if p_nilai is null or p_nilai not between 1 and 5 then raise exception 'Nilai 1 sampai 5' using errcode = '22023'; end if;
  update public.conversation set csat = p_nilai, csat_catatan = nullif(left(btrim(coalesce(p_catatan, '')), 300), '') where id = c.id;
end $$;

-- Halaman publik: nama usaha dan sambutan dari kunci (tanpa data lain).
create or replace function public.web_chat_info(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'sambutan', s.pesan_sambutan, 'buka', app.dalam_jam(p.id, s))
    from public.support_setting s join public.perusahaan p on p.id = s.perusahaan_id where s.kunci = p_kunci and s.aktif
$$;

-- ---------- sisi agen ----------
create or replace function public.assign_conversation(p_id uuid, p_agen uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  if p_agen is not null and not exists (select 1 from public.orang where id = p_agen and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Agen tidak ditemukan' using errcode = 'P0002';
  end if;
  update public.conversation set agen_id = p_agen, diubah_at = now() where id = p_id and perusahaan_id = v_pid;
  if not found then raise exception 'Percakapan tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Balasan agen: pengelola, atau staf yang ditugaskan. Balasan pertama mengisi dijawab_at (SLA); percakapan menjadi "ditangani"
-- sehingga bot berhenti menjawab.
create or replace function public.reply_conversation(p_id uuid, p_isi text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), ''); c public.conversation; v_orang uuid := app.orang_saya();
begin
  select * into c from public.conversation where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Percakapan tidak ditemukan' using errcode = 'P0002'; end if;
  if not (v_peran in ('pemilik', 'admin') or (c.agen_id is not null and c.agen_id = v_orang)) then
    raise exception 'Hanya pengelola atau agen percakapan ini yang membalas' using errcode = '42501';
  end if;
  if c.status = 'selesai' then raise exception 'Percakapan sudah selesai' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_isi, ''))) not between 1 and 2000 then raise exception 'Tulis balasan 1 sampai 2000 huruf' using errcode = '22023'; end if;
  insert into public.conversation_message (perusahaan_id, conversation_id, dari, isi, agen_id) values (v_pid, c.id, 'agen', btrim(p_isi), v_orang);
  update public.conversation set status = 'ditangani', dijawab_at = coalesce(dijawab_at, now()), agen_id = coalesce(agen_id, v_orang), diubah_at = now() where id = c.id;
end $$;

create or replace function public.close_conversation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  update public.conversation set status = 'selesai', ditutup_at = now(), diubah_at = now()
   where id = p_id and perusahaan_id = v_pid and status <> 'selesai' and (v_peran in ('pemilik', 'admin') or agen_id = app.orang_saya());
  if not found then raise exception 'Percakapan tidak ditemukan atau sudah selesai' using errcode = 'P0002'; end if;
  insert into public.conversation_message (perusahaan_id, conversation_id, dari, isi) values (v_pid, p_id, 'sistem', 'Obrolan ditutup. Beri nilai layanan kami di bawah, ya.');
end $$;

create or replace function public.service_report(p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v jsonb; v_agen jsonb;
begin
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then raise exception 'Rentang tanggal tidak sah' using errcode = '22023'; end if;
  with c as (select * from public.conversation where perusahaan_id = v_pid and (dibuat_at at time zone 'UTC')::date between p_dari and p_sampai)
  select jsonb_build_object('tiket', count(*), 'selesai', count(*) filter (where status = 'selesai'),
           'tepat_sla', count(*) filter (where dijawab_at is not null and dijawab_at <= tenggat),
           'lewat_sla', count(*) filter (where coalesce(dijawab_at, now()) > tenggat),
           'menit_balas', round(avg(extract(epoch from dijawab_at - dibuat_at) / 60) filter (where dijawab_at is not null)),
           'csat', round(avg(csat), 1), 'dinilai', count(csat),
           'dijawab_bot', count(*) filter (where exists (select 1 from public.conversation_message m where m.conversation_id = c.id and m.dari = 'bot')))
    into v from c;
  select coalesce(jsonb_agg(jsonb_build_object('nama', o.nama, 'tiket', x.n, 'csat', x.cs) order by x.n desc), '[]') into v_agen
    from (select agen_id, count(*) n, round(avg(csat), 1) cs from public.conversation
           where perusahaan_id = v_pid and agen_id is not null and (dibuat_at at time zone 'UTC')::date between p_dari and p_sampai group by agen_id) x
    join public.orang o on o.id = x.agen_id;
  return v || jsonb_build_object('agen', v_agen);
end $$;

revoke all on function app.support_words(text), app.support_match(uuid, text), app.dalam_jam(uuid, public.support_setting),
  app.support_incoming(public.conversation, text), app.conversation_by_token(text) from public, anon, authenticated;
revoke all on function public.save_support_setting(boolean, time, time, int, text, text), public.save_support_article(uuid, text, text, boolean),
  public.assign_conversation(uuid, uuid), public.reply_conversation(uuid, text), public.close_conversation(uuid), public.service_report(date, date),
  public.start_web_chat(text, text, text, text), public.send_visitor_message(text, text), public.visitor_conversation(text),
  public.rate_conversation(text, int, text), public.web_chat_info(text) from public;
grant execute on function public.save_support_setting(boolean, time, time, int, text, text), public.save_support_article(uuid, text, text, boolean),
  public.assign_conversation(uuid, uuid), public.reply_conversation(uuid, text), public.close_conversation(uuid), public.service_report(date, date) to authenticated;
-- Sisi pengunjung tanpa akun: hanya lewat kunci obrolan atau token percakapan.
grant execute on function public.start_web_chat(text, text, text, text), public.send_visitor_message(text, text), public.visitor_conversation(text),
  public.rate_conversation(text, int, text), public.web_chat_info(text) to anon, authenticated;
