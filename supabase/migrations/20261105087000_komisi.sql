-- W-07C komisi per layanan/penjualan (docs/research/kebutuhan-usaha.md urut 3): salon, bengkel, sales grosir. Aturan per produk/jasa
-- (atau satu aturan bawaan untuk semua) berupa persen dari nilai baris dan/atau rupiah per satuan. Komisi dihitung saat dibaca dari
-- sumber yang sudah tercatat (tanpa saldo tersimpan yang bisa melenceng, pola poin M-16B): penjualan kasir milik orang yang membuka
-- shift, dan invoice lunas milik orang yang menerbitkannya, menurut tanggal bayar. Slip gaji memasukkannya sebagai komponen pendapatan
-- "komisi" lewat susunSlip (ikut bruto PPh 21 seperti insentif, tidak menambah dasar BPJS; perlakuan BPJS belum terverifikasi).

create table public.commission_rule (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  produk_id uuid references public.produk(id) on delete cascade,
  persen numeric(5,2) not null default 0 check (persen between 0 and 100),
  nominal bigint not null default 0 check (nominal >= 0),
  aktif boolean not null default true,
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  check (persen > 0 or nominal > 0)
);
create unique index commission_rule_satu on public.commission_rule (perusahaan_id, coalesce(produk_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.commission_rule enable row level security;
create policy commission_rule_baca on public.commission_rule for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.commission_rule to authenticated;
create trigger audit_commission_rule after insert or update or delete on public.commission_rule for each row execute function app.catat_audit();

-- p_produk null = aturan bawaan untuk semua produk/jasa tanpa aturan sendiri. persen dan nominal 0 = aturan dimatikan.
create or replace function public.save_commission_rule(p_produk uuid, p_persen numeric, p_nominal bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengatur komisi' using errcode = '42501';
  end if;
  if p_produk is not null and not exists (select 1 from public.produk where id = p_produk and perusahaan_id = v_pid) then
    raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
  end if;
  if coalesce(p_persen, 0) < 0 or coalesce(p_persen, 0) > 100 or coalesce(p_nominal, 0) < 0 then
    raise exception 'Komisi 0 sampai 100 persen dan rupiah tidak negatif' using errcode = '22023';
  end if;
  select id into v_id from public.commission_rule where perusahaan_id = v_pid and produk_id is not distinct from p_produk;
  if coalesce(p_persen, 0) = 0 and coalesce(p_nominal, 0) = 0 then
    update public.commission_rule set aktif = false, diubah_oleh = auth.uid(), diubah_at = now() where id = v_id;
    return v_id;
  end if;
  if v_id is null then
    insert into public.commission_rule (perusahaan_id, produk_id, persen, nominal, diubah_oleh) values (v_pid, p_produk, coalesce(p_persen, 0), coalesce(p_nominal, 0), auth.uid())
    returning id into v_id;
  else
    update public.commission_rule set persen = coalesce(p_persen, 0), nominal = coalesce(p_nominal, 0), aktif = true, diubah_oleh = auth.uid(), diubah_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

-- Rekap komisi per orang untuk rentang tanggal (zona usaha). Baris tanpa produk (jasa ketik bebas di invoice) memakai aturan bawaan.
create or replace function app.commission_lines(p_pid uuid, p_mulai date, p_sampai date)
returns table (orang_id uuid, sumber text, sumber_id uuid, produk_id uuid, nilai numeric, jumlah numeric, komisi bigint)
language sql stable security definer set search_path = '' as $$
  with zona as (select coalesce(zona_waktu, 'Asia/Jakarta') z from public.perusahaan where id = p_pid),
  baris as (
    select coalesce(sh.orang_id, a.orang_id) orang_id, 'kasir'::text sumber, ps.id sumber_id, nullif(e ->> 'produk', '')::uuid produk_id,
           (e ->> 'harga')::numeric * (e ->> 'jumlah')::numeric nilai, (e ->> 'jumlah')::numeric jumlah
      from public.pos_sale ps join public.pos_shift sh on sh.id = ps.shift_id
      left join public.anggota a on a.perusahaan_id = p_pid and a.user_id = sh.user_id
      cross join lateral jsonb_array_elements(ps.baris) e, zona
     where ps.perusahaan_id = p_pid and (ps.waktu at time zone zona.z)::date between p_mulai and p_sampai
    union all
    select a.orang_id, 'invoice', i.id, nullif(e ->> 'produk', '')::uuid, (e ->> 'harga')::numeric * (e ->> 'jumlah')::numeric, (e ->> 'jumlah')::numeric
      from public.invoice i join public.anggota a on a.perusahaan_id = p_pid and a.user_id = i.dibuat_oleh
      cross join lateral jsonb_array_elements(i.baris) e
     where i.perusahaan_id = p_pid and i.status = 'lunas' and i.lunas_tanggal between p_mulai and p_sampai)
  select b.orang_id, b.sumber, b.sumber_id, b.produk_id, b.nilai, b.jumlah,
         round(b.nilai * r.persen / 100 + r.nominal * b.jumlah)::bigint
    from baris b
    join lateral (select r.persen, r.nominal from public.commission_rule r
                   where r.perusahaan_id = p_pid and r.aktif and (r.produk_id = b.produk_id or r.produk_id is null)
                   order by (r.produk_id is null) limit 1) r on true
   where b.orang_id is not null
$$;

create or replace function public.commission_summary(p_mulai date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat komisi' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('orang', x.orang_id, 'nama', o.nama, 'penjualan', x.nilai, 'komisi', x.komisi, 'transaksi', x.n) order by x.komisi desc)
    from (select orang_id, round(sum(nilai))::bigint nilai, sum(komisi)::bigint komisi, count(distinct sumber_id) n
            from app.commission_lines(v_pid, p_mulai, p_sampai) group by orang_id having sum(komisi) > 0) x
    join public.orang o on o.id = x.orang_id), '[]');
end $$;

revoke all on function app.commission_lines(uuid, date, date) from public, anon, authenticated;
revoke all on function public.save_commission_rule(uuid, numeric, bigint), public.commission_summary(date, date) from public, anon;
grant execute on function public.save_commission_rule(uuid, numeric, bigint), public.commission_summary(date, date) to authenticated;
