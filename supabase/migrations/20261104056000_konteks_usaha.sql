-- W-03 Konteks usaha saat daftar (docs/research/rencana-luas-nadi.md W-03; tes supabase/tests/konteks_usaha.test.sql).
-- Kolom baru di perusahaan:
--   - skala orang dan jumlah cabang;
--   - kota;
--   - negara (ISO 3166-1 alfa-2);
--   - mata uang (ISO 4217).
-- Mata uang dan zona waktu bawaan diambil dari public.negara. Kode ISO adalah fakta umum, bukan angka aturan.
-- Aturan gaji, pajak, dan BPJS di Nadi hanya untuk Indonesia: layar memakai perusahaan.negara untuk mengunci modul itu di negara
-- lain sampai ada paket aturan negaranya yang dibaca dari teks resmi.

create table public.negara (
  kode text primary key check (kode ~ '^[A-Z]{2}$'),
  nama_id text not null,
  nama_en text not null,
  mata_uang text not null check (mata_uang ~ '^[A-Z]{3}$'),
  zona text not null,
  urut int not null default 100
);
alter table public.negara enable row level security;
create policy negara_baca on public.negara for select to anon, authenticated using (true);
grant select on public.negara to anon, authenticated;
insert into public.negara (kode, nama_id, nama_en, mata_uang, zona, urut) values
  ('ID', 'Indonesia', 'Indonesia', 'IDR', 'Asia/Jakarta', 1),
  ('MY', 'Malaysia', 'Malaysia', 'MYR', 'Asia/Kuala_Lumpur', 10),
  ('SG', 'Singapura', 'Singapore', 'SGD', 'Asia/Singapore', 11),
  ('BN', 'Brunei Darussalam', 'Brunei Darussalam', 'BND', 'Asia/Brunei', 12),
  ('TL', 'Timor-Leste', 'Timor-Leste', 'USD', 'Asia/Dili', 13),
  ('PH', 'Filipina', 'Philippines', 'PHP', 'Asia/Manila', 14),
  ('TH', 'Thailand', 'Thailand', 'THB', 'Asia/Bangkok', 15),
  ('VN', 'Vietnam', 'Vietnam', 'VND', 'Asia/Ho_Chi_Minh', 16),
  ('AU', 'Australia', 'Australia', 'AUD', 'Australia/Sydney', 20),
  ('JP', 'Jepang', 'Japan', 'JPY', 'Asia/Tokyo', 21),
  ('KR', 'Korea Selatan', 'South Korea', 'KRW', 'Asia/Seoul', 22),
  ('HK', 'Hong Kong', 'Hong Kong', 'HKD', 'Asia/Hong_Kong', 23),
  ('TW', 'Taiwan', 'Taiwan', 'TWD', 'Asia/Taipei', 24),
  ('SA', 'Arab Saudi', 'Saudi Arabia', 'SAR', 'Asia/Riyadh', 30),
  ('AE', 'Uni Emirat Arab', 'United Arab Emirates', 'AED', 'Asia/Dubai', 31),
  ('NL', 'Belanda', 'Netherlands', 'EUR', 'Europe/Amsterdam', 40),
  ('US', 'Amerika Serikat', 'United States', 'USD', 'America/New_York', 50)
on conflict (kode) do nothing;

alter table public.perusahaan
  add column skala text check (skala is null or skala in ('1', '2-5', '6-15', '16-50', '50+')),
  add column cabang int check (cabang is null or cabang between 1 and 1000),
  add column kota text check (kota is null or length(btrim(kota)) between 1 and 80),
  add column negara text not null default 'ID' references public.negara (kode),
  add column mata_uang text not null default 'IDR' check (mata_uang ~ '^[A-Z]{3}$');

-- Zona yang boleh dipilih: zona bawaan negara, ditambah tiga zona lain untuk Indonesia (WIB barat, WITA, WIT).
create or replace function app.zona_sah(p_negara text, p_zona text) returns boolean
language sql immutable set search_path = '' as $$
  select p_zona = (select n.zona from public.negara n where n.kode = p_negara)
      or (p_negara = 'ID' and p_zona in ('Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'))
$$;

create or replace function public.atur_konteks_usaha(p_skala text, p_cabang int, p_kota text, p_negara text, p_zona text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); n public.negara; v_zona text;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengatur konteks usaha' using errcode = '42501';
  end if;
  select * into n from public.negara where kode = upper(btrim(coalesce(p_negara, '')));
  if not found then
    raise exception 'Negara belum ada di daftar Nadi' using errcode = '22023';
  end if;
  if p_skala is not null and p_skala not in ('1', '2-5', '6-15', '16-50', '50+') then
    raise exception 'Pilih jumlah orang dari daftar' using errcode = '22023';
  end if;
  if p_cabang is not null and p_cabang not between 1 and 1000 then
    raise exception 'Jumlah cabang 1 sampai 1000' using errcode = '22023';
  end if;
  v_zona := coalesce(nullif(btrim(coalesce(p_zona, '')), ''), n.zona);
  if not app.zona_sah(n.kode, v_zona) then
    raise exception 'Zona waktu % tidak cocok dengan negara %', v_zona, n.kode using errcode = '22023';
  end if;
  update public.perusahaan set skala = p_skala, cabang = p_cabang, kota = nullif(left(btrim(coalesce(p_kota, '')), 80), ''),
         negara = n.kode, mata_uang = n.mata_uang, zona_waktu = v_zona
   where id = v_pid;
  return jsonb_build_object('negara', n.kode, 'mata_uang', n.mata_uang, 'zona', v_zona, 'aturan_indonesia', n.kode = 'ID');
end $$;

revoke all on function public.atur_konteks_usaha(text, int, text, text, text) from public, anon;
grant execute on function public.atur_konteks_usaha(text, int, text, text, text) to authenticated;
revoke all on function app.zona_sah(text, text) from public, anon, authenticated;
