-- F3-06C Ramalan kebutuhan tahap 0 (docs/research/solver-shift.md): pemilik/admin mengisi sendiri berapa orang bertopi apa yang
-- dibutuhkan per hari dan jam (tanpa model). Penyusun jadwal (apps/web/src/lib/jadwal/susun.ts) membaca data_usulan_jadwal lalu
-- mengusulkan; penyimpanan tetap lewat simpan_shift satu per satu. Kebutuhan dinonaktifkan, tidak dihapus.
-- Tes: supabase/tests/kebutuhan_shift.test.sql.

create table public.kebutuhan_shift (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  topi_id uuid not null references public.topi(id) on delete cascade,
  hari smallint not null check (hari between 0 and 6),
  mulai time not null,
  selesai time not null,
  istirahat_menit integer not null default 0 check (istirahat_menit between 0 and 240),
  butuh smallint not null check (butuh between 1 and 20),
  aktif boolean not null default true,
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  check (mulai <> selesai),
  unique (perusahaan_id, topi_id, hari, mulai)
);
create index on public.kebutuhan_shift (topi_id);

alter table public.kebutuhan_shift enable row level security;
create policy kebutuhan_shift_baca on public.kebutuhan_shift for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.kebutuhan_shift to authenticated;
create trigger audit_kebutuhan_shift after insert or update or delete on public.kebutuhan_shift for each row execute function app.catat_audit();

-- Atur kebutuhan untuk beberapa hari sekaligus (0 = Senin). Baris yang sama (topi, hari, jam mulai) diperbarui dan diaktifkan lagi.
create or replace function public.atur_kebutuhan(p_topi uuid, p_hari integer[], p_mulai time, p_selesai time, p_istirahat integer, p_butuh integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); n integer;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengatur kebutuhan orang' using errcode = '42501';
  end if;
  if not exists (select 1 from public.topi t where t.id = p_topi and t.perusahaan_id = v_pid and t.aktif) then
    raise exception 'Topi tidak ditemukan di usahamu' using errcode = 'P0002';
  end if;
  if p_hari is null or cardinality(p_hari) = 0 or exists (select 1 from unnest(p_hari) h where h is null or h not between 0 and 6) then
    raise exception 'Pilih minimal satu hari.' using errcode = '22023';
  end if;
  if p_mulai is null or p_selesai is null or p_mulai = p_selesai or p_butuh is null or p_butuh not between 1 and 20
     or p_istirahat is null or p_istirahat not between 0 and 240 or app.menit_shift(p_mulai, p_selesai, p_istirahat) <= 0 then
    raise exception 'Isi jam mulai dan selesai, istirahat 0 sampai 240 menit, dan butuh 1 sampai 20 orang.' using errcode = '22023';
  end if;
  insert into public.kebutuhan_shift (perusahaan_id, topi_id, hari, mulai, selesai, istirahat_menit, butuh, diubah_oleh)
  select v_pid, p_topi, h, p_mulai, p_selesai, p_istirahat, p_butuh, auth.uid() from (select distinct unnest(p_hari) h) x
  on conflict (perusahaan_id, topi_id, hari, mulai) do update
    set selesai = excluded.selesai, istirahat_menit = excluded.istirahat_menit, butuh = excluded.butuh, aktif = true,
        diubah_oleh = excluded.diubah_oleh, diubah_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.henti_kebutuhan(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengatur kebutuhan orang' using errcode = '42501';
  end if;
  update public.kebutuhan_shift set aktif = false, diubah_oleh = auth.uid(), diubah_at = now() where id = p_id and perusahaan_id = v_pid;
  if not found then raise exception 'Kebutuhan tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Bahan penyusun untuk minggu p_mulai (Senin): kebutuhan aktif, orang karyawan/magang aktif dengan topinya, jumlah shift malam
-- 4 minggu sebelumnya (malam = menyentuh 22.00-06.00, sama dengan malamKah di susun.ts), dan hari yang sudah punya shift.
create or replace function public.data_usulan_jadwal(p_mulai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_senin date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun jadwal' using errcode = '42501';
  end if;
  v_senin := date_trunc('week', coalesce(p_mulai, app.hari_ini(v_pid)))::date;
  return jsonb_build_object(
    'mulai', v_senin,
    'pola', app.pola_kerja(v_pid),
    'kebutuhan', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'topi', k.topi_id, 'topi_nama', t.nama, 'hari', k.hari,
                    'mulai', to_char(k.mulai, 'HH24:MI'), 'selesai', to_char(k.selesai, 'HH24:MI'), 'istirahat', k.istirahat_menit, 'butuh', k.butuh)
                    order by k.hari, k.mulai, t.nama)
                  from public.kebutuhan_shift k join public.topi t on t.id = k.topi_id and t.aktif
                 where k.perusahaan_id = v_pid and k.aktif), '[]'::jsonb),
    'orang', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama,
                 'topi', coalesce((select jsonb_agg(pt.topi_id) from public.pakai_topi pt
                                    where pt.orang_id = o.id and pt.perusahaan_id = v_pid and pt.mulai <= v_senin + 6
                                      and (pt.selesai is null or pt.selesai >= v_senin)), '[]'::jsonb),
                 'malam_lalu', (select count(*) from public.shift s where s.orang_id = o.id and s.status = 'aktif'
                                  and s.tanggal >= v_senin - 28 and s.tanggal < v_senin
                                  and (s.mulai < time '06:00' or s.selesai <= s.mulai or s.selesai > time '22:00')),
                 'hari_terisi', coalesce((select jsonb_agg(distinct s.tanggal - v_senin) from public.shift s
                                           where s.orang_id = o.id and s.status = 'aktif' and s.tanggal >= v_senin and s.tanggal < v_senin + 7), '[]'::jsonb))
                 order by o.nama)
               from public.orang o where o.perusahaan_id = v_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']), '[]'::jsonb));
end $$;

revoke all on function public.atur_kebutuhan(uuid, integer[], time, time, integer, integer), public.henti_kebutuhan(uuid), public.data_usulan_jadwal(date)
  from public, anon;
grant execute on function public.atur_kebutuhan(uuid, integer[], time, time, integer, integer), public.henti_kebutuhan(uuid), public.data_usulan_jadwal(date)
  to authenticated;
