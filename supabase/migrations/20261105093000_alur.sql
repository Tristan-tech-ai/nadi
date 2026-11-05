-- M-20 pembuat alur (menutup QO-11, LA-04, LA-10, SI-05). Pemilik/admin menyusun alur: pemicu (satu jenis kejadian Nadi dari
-- katalog, atau formulir kustom yang dikirim), syarat (maks 5, semua harus cocok, pada data kejadian), dan aksi (maks 3: kartu Feed
-- untuk pemilik, kerja baru, atau webhook keluar lewat pg_net). Alur dijalankan trigger AFTER INSERT pada public.kejadian.
-- Pengaman: alur tidak memicu alur lain (penanda sesi app.dalam_alur), batas jalan per alur per jam (1..500) dan 1.000 per usaha
-- per jam (selebihnya tercatat 'dibatasi'), webhook maks 200 per usaha per jam, URL webhook wajib https ke nama host publik (bukan
-- IP, localhost, .local, .internal), tiap kiriman membawa tanda HMAC-SHA256 dari id jalan dengan rahasia per alur (rahasia tidak
-- bisa dibaca klien, tampil sekali saat dibuat). Aksi yang gagal tidak membatalkan kejadian aslinya; jalan dicatat 'gagal'.
-- Formulir kustom diisi anggota aktif mana pun (maks 60 kiriman per orang per jam) menjadi kejadian formulir.kirim.

create or replace function app.flow_triggers() returns text[]
language sql immutable set search_path = '' as $$
  select array['formulir.kirim', 'invoice.terbit', 'invoice.lunas', 'absen.masuk', 'izin.sakit', 'kerja.selesai', 'uang.penjualan', 'rekrut.masuk', 'klaim.setujui']::text[]
$$;

create table public.custom_form (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 3 and 80),
  bidang jsonb not null check (jsonb_typeof(bidang) = 'array' and jsonb_array_length(bidang) between 1 and 20),
  aktif boolean not null default true,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);

create table public.flow (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 3 and 80),
  aktif boolean not null default true,
  pemicu text not null check (pemicu = any (app.flow_triggers())),
  form_id uuid references public.custom_form(id) on delete cascade,
  syarat jsonb not null default '[]' check (jsonb_typeof(syarat) = 'array' and jsonb_array_length(syarat) <= 5),
  aksi jsonb not null check (jsonb_typeof(aksi) = 'array' and jsonb_array_length(aksi) between 1 and 3),
  batas_jam integer not null default 30 check (batas_jam between 1 and 500),
  rahasia text,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  check ((pemicu = 'formulir.kirim') = (form_id is not null))
);
create index flow_pemicu on public.flow (perusahaan_id, pemicu) where aktif;

create table public.flow_run (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  flow_id uuid not null references public.flow(id) on delete cascade,
  kejadian_id uuid,
  status text not null check (status in ('jalan', 'dibatasi', 'gagal')),
  catatan text,
  at timestamptz not null default now()
);
create index flow_run_flow on public.flow_run (flow_id, at desc);
create index flow_run_usaha on public.flow_run (perusahaan_id, at desc);

create table public.flow_webhook (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  flow_id uuid not null references public.flow(id) on delete cascade,
  run_id uuid not null references public.flow_run(id) on delete cascade,
  url text not null,
  request_id bigint,
  at timestamptz not null default now()
);
create index flow_webhook_usaha on public.flow_webhook (perusahaan_id, at desc);

alter table public.custom_form enable row level security;
alter table public.flow enable row level security;
alter table public.flow_run enable row level security;
alter table public.flow_webhook enable row level security;
create policy custom_form_baca on public.custom_form for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
create policy flow_baca on public.flow for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
create policy flow_run_baca on public.flow_run for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
create policy flow_webhook_baca on public.flow_webhook for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.custom_form, public.flow_run, public.flow_webhook to authenticated;
-- Rahasia penanda webhook tidak pernah bisa dibaca klien.
grant select (id, perusahaan_id, nama, aktif, pemicu, form_id, syarat, aksi, batas_jam, dibuat_oleh, dibuat_at) on public.flow to authenticated;

-- URL webhook: https ke nama host publik.
create or replace function app.url_webhook_sah(p text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(length(p) <= 500 and p ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{2,5})?(/[^\s]*)?$'
    and substring(lower(p) from '^https://([^/:]+)') !~ '^[0-9.]+$'
    and substring(lower(p) from '^https://([^/:]+)') !~ '(^|\.)(localhost|local|internal|localdomain|home\.arpa)$', false)
$$;

-- {kunci} di templat diganti nilai data kejadian (maks 200 huruf per nilai).
create or replace function app.isi_templat(p_t text, p_data jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := coalesce(p_t, ''); k text; v text;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_data, '{}'::jsonb)) loop
    r := replace(r, '{' || k || '}', left(coalesce(v, ''), 200));
  end loop;
  return r;
end $$;

create or replace function app.cocok_syarat(p_syarat jsonb, p_data jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare s jsonb; v text; n text; op text; ok boolean; angka text := '^-?[0-9]+([.,][0-9]+)?$';
begin
  for s in select * from jsonb_array_elements(coalesce(p_syarat, '[]'::jsonb)) loop
    v := p_data ->> (s ->> 'bidang'); n := coalesce(s ->> 'nilai', ''); op := s ->> 'op';
    if v is null then return false; end if;
    if op in ('>', '>=', '<', '<=') then
      if v !~ angka or n !~ angka then return false; end if;
      ok := case op when '>' then replace(v, ',', '.')::numeric > replace(n, ',', '.')::numeric
                    when '>=' then replace(v, ',', '.')::numeric >= replace(n, ',', '.')::numeric
                    when '<' then replace(v, ',', '.')::numeric < replace(n, ',', '.')::numeric
                    else replace(v, ',', '.')::numeric <= replace(n, ',', '.')::numeric end;
      if not ok then return false; end if;
    elsif op = '=' then if lower(btrim(v)) <> lower(btrim(n)) then return false; end if;
    elsif op = '!=' then if lower(btrim(v)) = lower(btrim(n)) then return false; end if;
    elsif op = 'berisi' then if position(lower(n) in lower(v)) = 0 then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.save_form(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; b jsonb; kunci text[] := '{}';
begin
  if jsonb_typeof(p -> 'bidang') <> 'array' or jsonb_array_length(p -> 'bidang') not between 1 and 20 then
    raise exception 'Formulir butuh 1 sampai 20 isian' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p -> 'bidang') loop
    if coalesce(b ->> 'kunci', '') !~ '^[a-z][a-z0-9_]{0,29}$' or (b ->> 'kunci') = any(kunci) or (b ->> 'kunci') in ('formulir', 'nama_formulir', 'jenis', 'nilai') then
      raise exception 'Kode isian % tidak sah atau kembar', coalesce(b ->> 'kunci', '') using errcode = '22023';
    end if;
    if length(btrim(coalesce(b ->> 'label', ''))) not between 1 and 80 then raise exception 'Label isian wajib diisi' using errcode = '22023'; end if;
    if coalesce(b ->> 'jenis', '') not in ('teks', 'angka', 'tanggal', 'pilihan') then raise exception 'Jenis isian tidak dikenal' using errcode = '22023'; end if;
    if b ->> 'jenis' = 'pilihan' and (jsonb_typeof(b -> 'pilihan') <> 'array' or jsonb_array_length(b -> 'pilihan') not between 2 and 10) then
      raise exception 'Isian pilihan butuh 2 sampai 10 pilihan' using errcode = '22023';
    end if;
    kunci := kunci || (b ->> 'kunci');
  end loop;
  insert into public.custom_form (perusahaan_id, nama, bidang, dibuat_oleh) values (v_pid, btrim(p ->> 'nama'), p -> 'bidang', auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_form(p_form uuid, p_isi jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); f public.custom_form; b jsonb; v text; v_data jsonb := '{}'; v_id uuid; v_orang uuid := app.orang_saya();
begin
  if v_pid is null or not app.anggota_aktif() then raise exception 'Kamu belum terdaftar aktif di usaha ini' using errcode = '42501'; end if;
  select * into f from public.custom_form where id = p_form and perusahaan_id = v_pid and aktif;
  if not found then raise exception 'Formulir tidak ditemukan' using errcode = 'P0002'; end if;
  if (select count(*) from public.kejadian k where k.perusahaan_id = v_pid and k.jenis = 'formulir.kirim' and k.data ->> 'oleh' = auth.uid()::text
        and k.terjadi_at > now() - interval '1 hour') >= 60 then
    raise exception 'Sudah 60 kiriman dalam satu jam. Coba lagi nanti.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(f.bidang) loop
    v := nullif(btrim(coalesce(p_isi ->> (b ->> 'kunci'), '')), '');
    if v is null then
      if coalesce((b ->> 'wajib')::boolean, false) then raise exception '% wajib diisi', b ->> 'label' using errcode = '22023'; end if;
      continue;
    end if;
    if length(v) > 300 then raise exception '% paling panjang 300 huruf', b ->> 'label' using errcode = '22023'; end if;
    if b ->> 'jenis' = 'angka' and v !~ '^-?[0-9]+([.,][0-9]+)?$' then raise exception '% harus angka', b ->> 'label' using errcode = '22023'; end if;
    if b ->> 'jenis' = 'tanggal' and v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '% harus tanggal', b ->> 'label' using errcode = '22023'; end if;
    if b ->> 'jenis' = 'pilihan' and not (b -> 'pilihan') ? v then raise exception 'Pilihan % tidak dikenal', b ->> 'label' using errcode = '22023'; end if;
    v_data := v_data || jsonb_build_object(b ->> 'kunci', v);
  end loop;
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, data)
  values (v_pid, 'formulir.kirim', 'pwa', v_orang, v_data || jsonb_build_object('formulir', f.id, 'nama_formulir', f.nama, 'oleh', auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_flow(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; a jsonb; s jsonb; v_form uuid := nullif(p ->> 'formulir', '')::uuid; v_rahasia text; v_web boolean := false;
begin
  if coalesce(p ->> 'pemicu', '') <> all (app.flow_triggers()) then raise exception 'Pemicu tidak dikenal' using errcode = '22023'; end if;
  if (p ->> 'pemicu' = 'formulir.kirim') <> (v_form is not null) then raise exception 'Pilih formulir untuk pemicu formulir terkirim' using errcode = '22023'; end if;
  if v_form is not null and not exists (select 1 from public.custom_form where id = v_form and perusahaan_id = v_pid) then
    raise exception 'Formulir tidak ditemukan' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p -> 'syarat', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'syarat', '[]')) > 5 then raise exception 'Paling banyak 5 syarat' using errcode = '22023'; end if;
  for s in select * from jsonb_array_elements(coalesce(p -> 'syarat', '[]')) loop
    if coalesce(s ->> 'bidang', '') !~ '^[a-z_][a-z0-9_]{0,29}$' or coalesce(s ->> 'op', '') not in ('=', '!=', '>', '>=', '<', '<=', 'berisi')
       or length(coalesce(s ->> 'nilai', '')) > 100 then
      raise exception 'Syarat tidak sah' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p -> 'aksi') <> 'array' or jsonb_array_length(p -> 'aksi') not between 1 and 3 then raise exception 'Alur butuh 1 sampai 3 aksi' using errcode = '22023'; end if;
  for a in select * from jsonb_array_elements(p -> 'aksi') loop
    if a ->> 'jenis' in ('kartu', 'kerja') then
      if length(btrim(coalesce(a ->> 'judul', ''))) not between 3 and 140 then raise exception 'Judul aksi 3 sampai 140 huruf' using errcode = '22023'; end if;
    elsif a ->> 'jenis' = 'webhook' then
      if not app.url_webhook_sah(a ->> 'url') then
        raise exception 'Alamat webhook harus https ke nama situs publik (bukan IP atau alamat lokal)' using errcode = '22023';
      end if;
      v_web := true;
    else raise exception 'Aksi tidak dikenal' using errcode = '22023';
    end if;
  end loop;
  if v_web then v_rahasia := encode(extensions.gen_random_bytes(24), 'hex'); end if;
  insert into public.flow (perusahaan_id, nama, pemicu, form_id, syarat, aksi, batas_jam, rahasia, dibuat_oleh)
  values (v_pid, btrim(p ->> 'nama'), p ->> 'pemicu', v_form, coalesce(p -> 'syarat', '[]'), p -> 'aksi',
          coalesce(nullif(p ->> 'batas_jam', '')::int, 30), v_rahasia, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'rahasia', v_rahasia);
end $$;

create or replace function public.set_flow_active(p_flow uuid, p_aktif boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  update public.flow set aktif = p_aktif where id = p_flow and perusahaan_id = v_pid;
  if not found then raise exception 'Alur tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Jalan terakhir per alur dengan status kiriman webhook dari net._http_response (disimpan pg_net 6 jam).
create or replace function public.flow_runs(p_flow uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'catatan', r.catatan, 'at', r.at,
      'webhook', (select jsonb_agg(jsonb_build_object('url', w.url, 'kode', h.status_code, 'galat', h.error_msg)) from public.flow_webhook w
                   left join net._http_response h on h.id = w.request_id where w.run_id = r.id)) order by r.at desc), '[]')
    from (select * from public.flow_run where flow_id = p_flow and perusahaan_id = app.pid() and app.pengelola() order by at desc limit 20) r
$$;

create or replace function app.flow_on_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.flow; a jsonb; v_data jsonb; v_run uuid; n int; i int; v_body jsonb; v_rid bigint;
begin
  if coalesce(current_setting('app.dalam_alur', true), '') = '1' then return null; end if;
  if not exists (select 1 from public.flow x where x.perusahaan_id = new.perusahaan_id and x.aktif and x.pemicu = new.jenis) then return null; end if;
  v_data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('jenis', new.jenis, 'nilai', new.nilai);
  perform set_config('app.dalam_alur', '1', true);
  for f in select * from public.flow x where x.perusahaan_id = new.perusahaan_id and x.aktif and x.pemicu = new.jenis
              and (x.form_id is null or x.form_id::text = new.data ->> 'formulir') order by x.dibuat_at limit 20 loop
    continue when not app.cocok_syarat(f.syarat, v_data);
    select count(*) into n from public.flow_run r where r.flow_id = f.id and r.status = 'jalan' and r.at > now() - interval '1 hour';
    if n >= f.batas_jam or (select count(*) from public.flow_run r where r.perusahaan_id = new.perusahaan_id and r.status = 'jalan' and r.at > now() - interval '1 hour') >= 1000 then
      insert into public.flow_run (perusahaan_id, flow_id, kejadian_id, status, catatan) values (new.perusahaan_id, f.id, new.id, 'dibatasi', 'Batas jalan per jam tercapai');
      continue;
    end if;
    insert into public.flow_run (perusahaan_id, flow_id, kejadian_id, status) values (new.perusahaan_id, f.id, new.id, 'jalan') returning id into v_run;
    begin
      i := 0;
      for a in select * from jsonb_array_elements(f.aksi) loop
        i := i + 1;
        if a ->> 'jenis' = 'kartu' then
          insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
          values (new.perusahaan_id, 'alur', 'info.alur', left(app.isi_templat(a ->> 'judul', v_data), 140), left('Dari alur ' || f.nama || '.', 300),
                  jsonb_build_object('alur', f.id, 'kejadian', new.id, 'run', v_run), array['pemilik', 'admin'], md5('alur:' || v_run || ':' || i)::uuid);
        elsif a ->> 'jenis' = 'kerja' then
          insert into public.kerja (perusahaan_id, judul, data) values (new.perusahaan_id, left(app.isi_templat(a ->> 'judul', v_data), 300),
            jsonb_build_object('alur', f.id, 'kejadian', new.id));
        elsif a ->> 'jenis' = 'webhook' then
          if (select count(*) from public.flow_webhook w where w.perusahaan_id = new.perusahaan_id and w.at > now() - interval '1 hour') >= 200 then
            raise exception 'Batas 200 webhook per jam tercapai';
          end if;
          v_body := jsonb_build_object('alur', f.nama, 'alur_id', f.id, 'jalan_id', v_run,
            'kejadian', jsonb_build_object('id', new.id, 'jenis', new.jenis, 'terjadi_at', new.terjadi_at, 'nilai', new.nilai, 'data', new.data - 'oleh'));
          v_rid := net.http_post(url := a ->> 'url', body := v_body,
            headers := jsonb_build_object('Content-Type', 'application/json', 'X-Nadi-Tanda', 'sha256=' || encode(extensions.hmac(v_run::text, f.rahasia, 'sha256'), 'hex')),
            timeout_milliseconds := 5000);
          insert into public.flow_webhook (perusahaan_id, flow_id, run_id, url, request_id) values (new.perusahaan_id, f.id, v_run, a ->> 'url', v_rid);
        end if;
      end loop;
    exception when others then
      update public.flow_run set status = 'gagal', catatan = left(sqlerrm, 300) where id = v_run;
    end;
  end loop;
  perform set_config('app.dalam_alur', '', true);
  return null;
end $$;

create trigger jalankan_alur after insert on public.kejadian for each row execute function app.flow_on_event();

revoke all on function public.save_form(jsonb), public.submit_form(uuid, jsonb), public.save_flow(jsonb), public.set_flow_active(uuid, boolean),
  public.flow_runs(uuid) from public, anon;
grant execute on function public.save_form(jsonb), public.submit_form(uuid, jsonb), public.save_flow(jsonb), public.set_flow_active(uuid, boolean),
  public.flow_runs(uuid) to authenticated;
revoke all on function app.flow_on_event(), app.url_webhook_sah(text), app.isi_templat(text, jsonb), app.cocok_syarat(jsonb, jsonb) from public, anon, authenticated;
grant execute on function app.flow_triggers() to authenticated;
