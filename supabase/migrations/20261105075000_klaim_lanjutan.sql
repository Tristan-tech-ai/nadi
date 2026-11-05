-- M-18B klaim lanjutan: uang harian perjalanan dinas per kota tujuan. Tarif diatur pemilik/admin per kota (atau '*' untuk kota
-- lain); saat perjalanan diajukan tarif dan jumlah hari dicatat di perjalanan; saat disetujui Nadi membuat satu klaim uang
-- harian yang langsung disetujui (jurnal D 6-930 / K 2-160), sehingga ikut dipotong uang muka saat perjalanan diselesaikan dan
-- dibayar lewat slip atau kas seperti klaim lain. Tes: supabase/tests/klaim_lanjutan.test.sql. Rancangan: docs/research/klaim.md.

create table public.uang_harian (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kota text not null check (kota = '*' or (kota = lower(btrim(kota)) and length(kota) between 2 and 60)),
  nominal bigint not null check (nominal between 1000 and 10000000),
  aktif boolean not null default true,
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, kota)
);
alter table public.uang_harian enable row level security;
create policy uang_harian_baca on public.uang_harian for select to authenticated using (perusahaan_id = (select app.pid()));
grant select on public.uang_harian to authenticated;

alter table public.perjalanan_dinas
  add column uang_harian_kota text,
  add column uang_harian_tarif bigint not null default 0 check (uang_harian_tarif >= 0),
  add column uang_harian_hari int not null default 0 check (uang_harian_hari >= 0);

-- Atur tarif: nominal null = nonaktif (tidak dihapus). Kota ditulis apa adanya, disimpan huruf kecil; '*' untuk kota lain.
create or replace function public.atur_uang_harian(p_kota text, p_nominal bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_kota text := case when btrim(coalesce(p_kota, '')) = '*' then '*' else lower(btrim(coalesce(p_kota, ''))) end; u public.uang_harian;
begin
  if v_kota <> '*' and length(v_kota) not between 2 and 60 then raise exception 'Nama kota 2 sampai 60 huruf, atau * untuk kota lain' using errcode = '22023'; end if;
  if p_nominal is not null and p_nominal not between 1000 and 10000000 then raise exception 'Uang harian Rp1.000 sampai Rp10.000.000 per hari' using errcode = '22023'; end if;
  insert into public.uang_harian as t (perusahaan_id, kota, nominal, aktif)
  values (v_pid, v_kota, coalesce(p_nominal, 1000), p_nominal is not null)
  on conflict (perusahaan_id, kota) do update set nominal = coalesce(p_nominal, t.nominal), aktif = p_nominal is not null, diubah_at = now()
  returning * into u;
  return jsonb_build_object('kota', u.kota, 'nominal', u.nominal, 'aktif', u.aktif);
end $$;

-- Tarif untuk tujuan: kota terpanjang yang namanya ada di teks tujuan, lalu '*'.
create or replace function app.tarif_uang_harian(p_pid uuid, p_tujuan text) returns public.uang_harian
language sql stable security definer set search_path = '' as $$
  select u.* from public.uang_harian u
   where u.perusahaan_id = p_pid and u.aktif and (u.kota = '*' or position(u.kota in lower(coalesce(p_tujuan, ''))) > 0)
   order by (u.kota = '*'), length(u.kota) desc limit 1
$$;

create or replace function public.ajukan_dinas(p_tujuan text, p_mulai date, p_selesai date, p_keperluan text, p_uang_muka bigint, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); d public.perjalanan_dinas; v_nama text; v_usulan uuid; t public.uang_harian; v_hari int;
begin
  if v_pid is null or v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini' using errcode = '42501'; end if;
  select * into d from public.perjalanan_dinas where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if d.id is not null then return jsonb_build_object('id', d.id, 'sudah', true); end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai or p_selesai > p_mulai + 60 then raise exception 'Perjalanan paling lama 60 hari' using errcode = '22023'; end if;
  if coalesce(p_uang_muka, 0) < 0 or coalesce(p_uang_muka, 0) > 100000000 then raise exception 'Uang muka 0 sampai 100.000.000' using errcode = '22023'; end if;
  select nama into v_nama from public.orang where id = v_orang;
  t := app.tarif_uang_harian(v_pid, p_tujuan);
  v_hari := p_selesai - p_mulai + 1;
  insert into public.perjalanan_dinas (perusahaan_id, orang_id, tujuan, keperluan, mulai, selesai, uang_muka, kunci_klien, uang_harian_kota, uang_harian_tarif, uang_harian_hari)
  values (v_pid, v_orang, btrim(p_tujuan), btrim(p_keperluan), p_mulai, p_selesai, coalesce(p_uang_muka, 0), p_kunci, t.kota, coalesce(t.nominal, 0), case when t.id is null then 0 else v_hari end)
  returning * into d;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp)
  values (v_pid, 'pwa', 'dinas.setujui', left('Setujui perjalanan dinas ' || v_nama || ' ke ' || btrim(p_tujuan), 140),
    left(btrim(p_keperluan) || ' (' || to_char(p_mulai, 'DD-MM-YYYY') || ' sampai ' || to_char(p_selesai, 'DD-MM-YYYY') || ')'
         || case when d.uang_muka > 0 then ', uang muka ' || app.rupiah(d.uang_muka) else '' end
         || case when d.uang_harian_tarif > 0 then ', uang harian ' || d.uang_harian_hari || ' hari x ' || app.rupiah(d.uang_harian_tarif) || ' = '
              || app.rupiah(d.uang_harian_hari * d.uang_harian_tarif) || case when d.uang_harian_kota = '*' then ' (tarif kota lain)' else ' (tarif ' || initcap(d.uang_harian_kota) || ')' end else '' end
         || '.', 1000),
    jsonb_build_object('dinas_id', d.id, 'orang_id', v_orang, 'nama', v_nama, 'uang_muka', d.uang_muka, 'uang_harian', d.uang_harian_hari * d.uang_harian_tarif,
      'bidang', jsonb_build_object('orang_id', v_orang, 'nama', v_nama, 'tujuan', btrim(p_tujuan), 'tanggal', p_mulai, 'uang_muka', d.uang_muka)),
    d.uang_muka + d.uang_harian_hari * d.uang_harian_tarif)
  returning id into v_usulan;
  update public.perjalanan_dinas set usulan_id = v_usulan where id = d.id;
  return jsonb_build_object('id', d.id, 'sudah', false, 'uang_harian', d.uang_harian_hari * d.uang_harian_tarif);
end $$;

-- Persetujuan perjalanan kini juga membuat klaim uang harian (sekali per perjalanan, kunci dari id perjalanan).
create or replace function app.klaim_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.klaim; k public.kategori_klaim; d public.perjalanan_dinas; v_uh bigint;
begin
  if new.aksi = 'klaim.setujui' then
    select * into c from public.klaim where id = (new.payload ->> 'klaim_id')::uuid and status = 'menunggu' for update;
    if c.id is null then return new; end if;
    if new.status = 'ditolak' then
      update public.klaim set status = 'ditolak' where id = c.id;
    elsif new.status = 'diterima' then
      select * into k from public.kategori_klaim where id = c.kategori_id;
      perform app.pasang_bagan_bawaan(c.perusahaan_id);
      perform app.akun_pastikan(c.perusahaan_id, k.akun, k.nama, 'beban', 'debit');
      perform app.akun_pastikan(c.perusahaan_id, '2-160', 'Utang penggantian biaya karyawan', 'kewajiban', 'kredit');
      perform app.posting_jurnal(c.perusahaan_id, jsonb_build_object('tanggal', c.tanggal, 'keterangan', left('Klaim ' || k.nama || ': ' || c.keterangan, 200),
        'sumber', 'klaim', 'sumber_id', c.id::text, 'kunci_idempoten', 'klaim:' || c.id),
        jsonb_build_array(jsonb_build_object('akun', k.akun, 'debit', c.jumlah), jsonb_build_object('akun', '2-160', 'kredit', c.jumlah)), auth.uid());
      update public.klaim set status = 'disetujui' where id = c.id;
    end if;
  elsif new.aksi = 'dinas.setujui' then
    update public.perjalanan_dinas set status = case when new.status = 'diterima' then 'disetujui' else 'ditolak' end
     where id = (new.payload ->> 'dinas_id')::uuid and status = 'menunggu' and new.status in ('diterima', 'ditolak')
     returning * into d;
    v_uh := coalesce(d.uang_harian_tarif, 0) * coalesce(d.uang_harian_hari, 0);
    if new.status = 'diterima' and d.id is not null and v_uh > 0 then
      insert into public.kategori_klaim (perusahaan_id, nama, akun, butuh_struk)
      values (d.perusahaan_id, 'Uang harian perjalanan dinas', '6-930', false)
      on conflict (perusahaan_id, nama) do nothing;
      select * into k from public.kategori_klaim where perusahaan_id = d.perusahaan_id and nama = 'Uang harian perjalanan dinas';
      insert into public.klaim (perusahaan_id, orang_id, kategori_id, perjalanan_id, tanggal, jumlah, keterangan, status, kunci_klien)
      values (d.perusahaan_id, d.orang_id, k.id, d.id, d.mulai, v_uh,
              left('Uang harian ' || d.tujuan || ' ' || d.uang_harian_hari || ' hari x ' || app.rupiah(d.uang_harian_tarif), 300), 'disetujui', md5('uang_harian:' || d.id)::uuid)
      on conflict (perusahaan_id, kunci_klien) do nothing
      returning * into c;
      if c.id is not null then
        perform app.pasang_bagan_bawaan(d.perusahaan_id);
        perform app.akun_pastikan(d.perusahaan_id, k.akun, 'Biaya perjalanan dinas', 'beban', 'debit');
        perform app.akun_pastikan(d.perusahaan_id, '2-160', 'Utang penggantian biaya karyawan', 'kewajiban', 'kredit');
        perform app.posting_jurnal(d.perusahaan_id, jsonb_build_object('tanggal', d.mulai, 'keterangan', left('Uang harian dinas ' || d.tujuan, 200),
          'sumber', 'klaim', 'sumber_id', c.id::text, 'kunci_idempoten', 'klaim:' || c.id),
          jsonb_build_array(jsonb_build_object('akun', k.akun, 'debit', v_uh), jsonb_build_object('akun', '2-160', 'kredit', v_uh)), auth.uid());
      end if;
    end if;
  end if;
  return new;
end $$;

revoke all on function app.tarif_uang_harian(uuid, text) from public, anon, authenticated;
revoke all on function public.atur_uang_harian(text, bigint) from public, anon;
grant execute on function public.atur_uang_harian(text, bigint) to authenticated;
