-- L-03 mode coba: pengunjung /demo masuk ke UI aplikasi yang sebenarnya lewat sesi anonim Supabase (is_anonymous di JWT,
-- docs supabase.com/docs/guides/auth/auth-anonymous dibaca 6 Nov 2026) dan melihat usaha contoh sebagai pemilik, baca saja.
-- Usaha contoh TIDAK ditulis ke app_metadata sesi anonim: bila pengguna anonim menautkan email dan menjadi akun permanen,
-- klaim itu akan ikut terbawa dan memberinya hak pemilik. Karena itu usaha dan perannya diturunkan dari is_anonymous di fungsi
-- pusat (app.pid, app.peran_aktif, app.anggota_aktif, app.pengelola), yang hilang sendiri begitu akunnya bukan anonim lagi.
-- Batasan: (1) setiap permintaan Data API dari sesi anonim berjalan di transaksi baca saja lewat pre-request PostgREST
-- (docs supabase.com/docs/guides/api/securing-your-api), termasuk RPC security definer di dalamnya; (2) Storage tidak lewat
-- pre-request, jadi unggah/ubah/hapus objek ditutup kebijakan restrictive; (3) AI tidak pernah dipanggil di mode coba: RPC
-- konteks yang dipanggil Edge Function sebelum model menolak sesi anonim, dan berkas yang masih bisa diproses ulang tidak
-- terlihat oleh sesi anonim (baca-berkas memeriksa berkas atas nama pemanggil).

insert into public.konfigurasi (kunci, nilai, catatan)
values ('usaha_tamu', to_jsonb('01a1a931-28b5-7762-b90f-0a719b518da5'::text), 'L-03: usaha contoh (Toko Bu Sari, data sintetis) yang dibuka sesi coba anonim, baca saja')
on conflict (kunci) do nothing;

create or replace function app.tamu() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function app.usaha_tamu() returns uuid
language sql stable security definer set search_path = '' as $$
  select (nilai #>> '{}')::uuid from public.konfigurasi where kunci = 'usaha_tamu';
$$;

-- Sama seperti sebelumnya untuk akun biasa; sesi anonim selalu di usaha contoh.
create or replace function app.pid() returns uuid
language sql stable set search_path = '' as $$
  select case when app.tamu() then app.usaha_tamu()
              when app.mfa_ok() then nullif(auth.jwt() -> 'app_metadata' ->> 'pid', '')::uuid end;
$$;

create or replace function app.peran_aktif() returns text
language sql stable security definer set search_path = '' as $$
  select case when app.tamu() then case when app.usaha_tamu() is not null then 'pemilik' end
              else (select a.peran from public.anggota a
                     where a.perusahaan_id = app.pid() and a.user_id = (select auth.uid()) and a.aktif) end;
$$;

create or replace function app.anggota_aktif(p_peran text[] default null::text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when app.tamu() then app.usaha_tamu() is not null and (p_peran is null or 'pemilik' = any(p_peran))
              else exists (
                select 1 from public.anggota
                 where perusahaan_id = app.pid() and user_id = auth.uid() and aktif
                   and (p_peran is null or peran = any(p_peran))) end;
$$;

create or replace function app.pengelola() returns boolean
language sql stable set search_path = '' as $$
  select case when app.tamu() then app.usaha_tamu() is not null
              else coalesce(auth.jwt() -> 'app_metadata' ->> 'prn', '') in ('pemilik', 'admin') end;
$$;

-- Pre-request Data API: sesi anonim hanya membaca. Di skema public karena dipanggil untuk anon juga (anon tidak memakai app).
create or replace function public.cek_permintaan() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.tamu() then perform set_config('transaction_read_only', 'on', true); end if;
end $$;
revoke all on function public.cek_permintaan() from public;
grant execute on function public.cek_permintaan() to anon, authenticated;
alter role authenticator set pgrst.db_pre_request = 'public.cek_permintaan';
notify pgrst, 'reload config';

-- Id usaha contoh untuk aplikasi (kerangka sesi coba), tanpa data lain.
create or replace function public.usaha_tamu() returns uuid
language sql stable security definer set search_path = '' as $$ select app.usaha_tamu(); $$;
revoke all on function public.usaha_tamu() from public;
grant execute on function public.usaha_tamu() to anon, authenticated;

-- Storage tidak memakai pre-request: tutup tulis untuk sesi anonim.
create policy tamu_tanpa_unggah on storage.objects as restrictive for insert to authenticated with check (not app.tamu());
create policy tamu_tanpa_ubah on storage.objects as restrictive for update to authenticated using (not app.tamu());
create policy tamu_tanpa_hapus on storage.objects as restrictive for delete to authenticated using (not app.tamu());

-- baca-berkas memproses ulang berkas berstatus unggah/antre/gagal yang terlihat oleh pemanggil: jangan perlihatkan ke sesi anonim.
create policy berkas_tamu on public.berkas as restrictive for select to authenticated
  using (not app.tamu() or status not in ('unggah', 'antre', 'proses', 'gagal'));

create or replace function app.tolak_tamu() returns void
language plpgsql stable set search_path = '' as $$
begin
  if app.tamu() then
    raise exception 'Mode coba tidak memakai AI. Buat akun untuk mencobanya di usahamu sendiri.' using errcode = '42501';
  end if;
end $$;

create or replace function public.learn_question_context() returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := coalesce((select app.peran_aktif()), '');
begin
  perform app.tolak_tamu();
  if v_pid is null or v_peran not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Tanya data hanya untuk pemilik, admin, dan akuntan' using errcode = '42501';
  end if;
  return jsonb_build_object('perusahaan_id', v_pid, 'peran', v_peran);
end $$;

create or replace function public.learn_migration_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid;
begin
  perform app.tolak_tamu();
  v_pid := app.wajib_pengelola();
  return jsonb_build_object('perusahaan_id', v_pid);
end $$;

create or replace function public.konteks_ilmu(p_butir uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); sb public.serah_butir; n int;
begin
  perform app.tolak_tamu();
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun langkah kerja.' using errcode = '42501';
  end if;
  select * into sb from public.serah_butir where id = p_butir and perusahaan_id = v_pid and jenis = 'ilmu';
  if sb.id is null then raise exception 'Butir ilmu tidak ditemukan.' using errcode = 'P0002'; end if;
  if coalesce(trim(sb.transkrip), '') = '' then raise exception 'Buat transkrip rekamannya dulu.' using errcode = '55000'; end if;
  select count(*) into n from public.pemakaian_ai
   where perusahaan_id = v_pid and tugas = 'langkah_ilmu' and berkas_id is not distinct from sb.berkas_id and dibuat_at > now() - interval '24 hours';
  if n >= 3 then raise exception 'Langkah butir ini sudah disusun 3 kali hari ini. Edit langkahnya langsung, atau coba lagi besok.' using errcode = '54000'; end if;
  return jsonb_build_object('id', sb.id, 'judul', sb.judul, 'transkrip', sb.transkrip);
end $$;

create or replace function public.konteks_estimasi(p_kerja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kerja; v_topi jsonb; v_contoh jsonb;
begin
  perform app.tolak_tamu();
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa meminta perkiraan.' using errcode = '42501';
  end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid;
  if k.id is null then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  select jsonb_build_object('nama', t.nama, 'deskripsi', t.deskripsi, 'tanggung_jawab', t.tanggung_jawab) into v_topi
    from public.topi t where t.id = k.topi_id;
  select coalesce(jsonb_agg(jsonb_build_object('judul', c.judul, 'topi', c.topi, 'menit', c.menit)), '[]'::jsonb) into v_contoh
    from (select x.judul, t.nama as topi, round((x.data ->> 'aktual_menit')::numeric) as menit
            from public.kerja x left join public.topi t on t.id = x.topi_id
           where x.perusahaan_id = v_pid and x.status = 'selesai' and x.mulai_at is not null and x.id <> k.id
             and x.selesai_at >= now() - interval '180 days' and jsonb_typeof(x.data -> 'aktual_menit') = 'number'
           order by (x.topi_id is not distinct from k.topi_id) desc, extensions.similarity(x.judul, k.judul) desc, x.selesai_at desc
           limit 5) c;
  return jsonb_build_object('id', k.id, 'judul', k.judul, 'topi', v_topi, 'estimasi', k.data -> 'estimasi', 'contoh', v_contoh,
    'kalibrasi', app.faktor_kalibrasi(v_pid));
end $$;

grant execute on function app.tamu(), app.usaha_tamu() to anon, authenticated;
grant execute on function app.tolak_tamu() to authenticated;
