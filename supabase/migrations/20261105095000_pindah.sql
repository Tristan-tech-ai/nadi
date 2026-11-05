-- M-24 pindah dari aplikasi lain (menutup sebagian JU-26). Berkas ekspor/template aplikasi lain (kolom Jurnal dari pusat bantuan
-- resminya: Akun/COA dengan Category Number 1-17, Kontak dengan Type customer/vendor/employee/others; daftar karyawan dan produk
-- umum) diurai di server aplikasi (src/lib/pindah/format.ts) lalu menjadi SATU usulan untuk pemilik; baru berlaku setelah disetujui.
-- Baris disimpan di payload.baris (bukan payload.bidang, yang disalin putuskan_usulan ke kejadian.data dengan batas 8 KB).
-- Akun: kode lama TIDAK dipakai (Nadi menghitung kas dari kode 1-1%, sedangkan kode Jurnal untuk piutang/persediaan juga diawali
-- 1-1); akun pertama tiap kategori yang punya padanan bawaan digabung ke akun bawaan, sisanya diberi kode Nadi di blok kategorinya;
-- pemetaan disimpan di pindah_akun; saldo awal dibukukan lewat atur_saldo_awal bila belum ada saldo awal. Kontak: pelanggan masuk
-- daftar pelanggan (customer), pemasok/karyawan/lainnya dihitung dan dilewati. Produk: lewat simpan_produk, stok awal lewat opname.
-- Karyawan memakai aksi orang.impor yang sudah ada.

create table public.pindah_akun (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  usulan_id uuid,
  kode_asal text,
  nama_asal text not null,
  akun_kode text not null,
  digabung boolean not null,
  dibuat_at timestamptz not null default now()
);
alter table public.pindah_akun enable row level security;
create policy pindah_akun_baca on public.pindah_akun for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()));
grant select on public.pindah_akun to authenticated;

-- Category Number Jurnal -> golongan, saldo normal, akun bawaan untuk akun pertama, blok kode baru.
create or replace function app.kategori_jurnal(p int) returns jsonb
language sql immutable set search_path = '' as $$
  select (case p
    when 1 then '{"g":"aset","n":"debit","bawaan":"1-200","awal":201,"akhir":299,"induk":"1"}'
    when 2 then '{"g":"aset","n":"debit","awal":420,"akhir":499,"induk":"1"}'
    when 3 then '{"g":"aset","n":"debit","awal":120,"akhir":199,"induk":"1"}'
    when 4 then '{"g":"aset","n":"debit","bawaan":"1-300","awal":301,"akhir":399,"induk":"1"}'
    when 5 then '{"g":"aset","n":"debit","awal":510,"akhir":589,"induk":"1"}'
    when 6 then '{"g":"aset","n":"debit","awal":600,"akhir":699,"induk":"1"}'
    when 7 then '{"g":"aset","n":"kredit","awal":590,"akhir":599,"induk":"1"}'
    when 8 then '{"g":"kewajiban","n":"kredit","bawaan":"2-100","awal":101,"akhir":199,"induk":"2"}'
    when 9 then '{"g":"kewajiban","n":"kredit","awal":400,"akhir":449,"induk":"2"}'
    when 10 then '{"g":"kewajiban","n":"kredit","awal":450,"akhir":499,"induk":"2"}'
    when 11 then '{"g":"kewajiban","n":"kredit","awal":500,"akhir":599,"induk":"2"}'
    when 12 then '{"g":"modal","n":"kredit","bawaan":"3-100","awal":101,"akhir":199,"induk":"3"}'
    when 13 then '{"g":"pendapatan","n":"kredit","bawaan":"4-100","awal":101,"akhir":199,"induk":"4"}'
    when 14 then '{"g":"pendapatan","n":"kredit","bawaan":"4-900","awal":901,"akhir":999,"induk":"4"}'
    when 15 then '{"g":"beban","n":"debit","bawaan":"5-100","awal":101,"akhir":199,"induk":"5"}'
    when 16 then '{"g":"beban","n":"debit","awal":400,"akhir":899,"induk":"6"}'
    when 17 then '{"g":"beban","n":"debit","bawaan":"6-900","awal":901,"akhir":999,"induk":"6"}'
  end)::jsonb
$$;

create or replace function public.propose_migration(p_format text, p_berkas text, p_baris jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; n int; v_aksi text; v_judul text; v_berkas text := left(btrim(coalesce(p_berkas, 'berkas')), 120);
begin
  if p_format not in ('akun', 'kontak', 'produk', 'karyawan') then raise exception 'Format belum didukung' using errcode = '22023'; end if;
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) not between 1 and 2000 then raise exception 'Isi 1 sampai 2.000 baris' using errcode = '22023'; end if;
  if pg_column_size(p_baris) > 2000000 then raise exception 'Berkas terlalu besar' using errcode = '22023'; end if;
  n := jsonb_array_length(p_baris);
  v_aksi := case p_format when 'karyawan' then 'orang.impor' else 'pindah.' || p_format end;
  v_judul := left(case p_format when 'akun' then 'Pindahkan ' || n || ' akun dan saldo awal dari ' when 'kontak' then 'Pindahkan ' || n || ' kontak dari '
                  when 'produk' then 'Pindahkan ' || n || ' produk dari ' else 'Tambah ' || n || ' orang dari ' end || v_berkas, 140);
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
  values (v_pid, 'pindah', v_aksi, v_judul, left('Dari berkas ' || v_berkas || '. Data yang sudah ada di Nadi dilewati, tidak ditimpa.', 300),
    case when p_format = 'karyawan' then jsonb_build_object('bidang', jsonb_build_object('baris', p_baris), 'berkas', v_berkas)
         else jsonb_build_object('bidang', jsonb_build_object('format', p_format, 'jumlah', n, 'berkas', v_berkas), 'baris', p_baris) end,
    array['pemilik', 'admin'], md5('pindah:' || v_pid || ':' || p_format || ':' || md5(p_baris::text))::uuid)
  on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing
  returning id into v_id;
  if v_id is null then raise exception 'Berkas yang sama sudah diajukan. Lihat usulannya di Feed.' using errcode = '23505'; end if;
  return v_id;
end $$;

create or replace function app.kode_bebas(p_pid uuid, p_induk text, p_awal int, p_akhir int) returns text
language sql stable set search_path = '' as $$
  select p_induk || '-' || g from generate_series(p_awal, p_akhir) g
   where not exists (select 1 from public.akun a where a.perusahaan_id = p_pid and a.kode = p_induk || '-' || g) order by g limit 1
$$;

create or replace function app.pindah_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := new.perusahaan_id; e jsonb; k jsonb; v_kode text; v_nama text; v_kat int; n int := 0; lewat int := 0; v_saldo jsonb := '{}';
  v_baris jsonb := '[]'; v_hp text; v_email text; v_tipe text[]; v_produk uuid; v_stok jsonb := '[]'; v_catatan text; v_gabung boolean; v_bawaan text; v_s numeric;
begin
  if new.aksi = 'pindah.akun' then
    if not exists (select 1 from public.akun where perusahaan_id = v_pid) then perform app.pasang_bagan_bawaan(v_pid); end if;
    for e in select * from jsonb_array_elements(coalesce(new.payload -> 'baris', '[]')) limit 500 loop
      v_nama := left(btrim(coalesce(e ->> 'nama', '')), 100);
      v_kat := case when (e ->> 'kategori') ~ '^\d{1,2}$' then (e ->> 'kategori')::int end;
      k := app.kategori_jurnal(v_kat);
      if length(v_nama) < 2 or k is null then lewat := lewat + 1; continue; end if;
      v_gabung := false; v_kode := null;
      -- Nama sama dengan akun yang sudah ada: dipakai, tidak digandakan.
      select a.kode into v_kode from public.akun a where a.perusahaan_id = v_pid and lower(a.nama) = lower(v_nama) and a.golongan = k ->> 'g' limit 1;
      if v_kode is not null then v_gabung := true; end if;
      if v_kode is null then
        v_bawaan := case when v_kat = 3 and v_nama ~* '(kas|tunai|cash|laci)' then '1-100' when v_kat = 3 then '1-110' else k ->> 'bawaan' end;
        if v_bawaan is not null and exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = v_bawaan)
           and not exists (select 1 from public.pindah_akun m where m.perusahaan_id = v_pid and m.akun_kode = v_bawaan) then
          v_kode := v_bawaan; v_gabung := true;
        end if;
      end if;
      if v_kode is null then
        v_kode := app.kode_bebas(v_pid, k ->> 'induk', (k ->> 'awal')::int, (k ->> 'akhir')::int);
        if v_kode is null then lewat := lewat + 1; continue; end if;
        insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal) values (v_pid, v_kode, v_nama, k ->> 'g', k ->> 'n');
        n := n + 1;
      end if;
      insert into public.pindah_akun (perusahaan_id, usulan_id, kode_asal, nama_asal, akun_kode, digabung)
      values (v_pid, new.id, nullif(left(btrim(coalesce(e ->> 'kode_asal', '')), 40), ''), v_nama, v_kode, v_gabung);
      v_s := case when (e ->> 'saldo') ~ '^-?\d+(\.\d+)?$' then round((e ->> 'saldo')::numeric) else 0 end;
      if v_s <> 0 and k ->> 'g' in ('aset', 'kewajiban', 'modal') then
        -- Saldo positif berada di sisi normal akun; negatif di sisi sebaliknya. Dijumlah per akun Nadi.
        v_saldo := jsonb_set(v_saldo, array[v_kode], to_jsonb(coalesce((v_saldo ->> v_kode)::numeric, 0) + case when k ->> 'n' = 'debit' then v_s else -v_s end));
      end if;
    end loop;
    if v_saldo <> '{}'::jsonb then
      if exists (select 1 from public.jurnal j where j.perusahaan_id = v_pid and j.sumber = 'saldo_awal' and j.dibalik_oleh is null) then
        v_catatan := 'Saldo awal tidak dibukukan karena usaha ini sudah punya saldo awal.';
      else
        select jsonb_agg(case when x.value::numeric > 0 then jsonb_build_object('akun', x.key, 'debit', x.value::numeric)
                              else jsonb_build_object('akun', x.key, 'kredit', -x.value::numeric) end)
          into v_baris from jsonb_each_text(v_saldo) x where x.value::numeric <> 0;
        if v_baris is not null then perform public.atur_saldo_awal(app.hari_ini(v_pid), v_baris); end if;
      end if;
    end if;
  elsif new.aksi = 'pindah.kontak' then
    for e in select * from jsonb_array_elements(coalesce(new.payload -> 'baris', '[]')) limit 2000 loop
      v_nama := left(btrim(coalesce(e ->> 'nama', '')), 100);
      select coalesce(array_agg(lower(btrim(t))), '{}') into v_tipe from jsonb_array_elements_text(coalesce(e -> 'tipe', '[]')) t;
      if length(v_nama) < 2 or not ('customer' = any(v_tipe)) or exists (select 1 from public.customer c where c.perusahaan_id = v_pid and lower(c.nama) = lower(v_nama)) then
        lewat := lewat + 1; continue;
      end if;
      v_hp := regexp_replace(coalesce(e ->> 'hp', ''), '[^0-9]', '', 'g');
      v_hp := case when v_hp ~ '^0[0-9]{8,13}$' then '62' || substr(v_hp, 2) when v_hp ~ '^62[0-9]{8,13}$' then v_hp end;
      v_email := case when btrim(coalesce(e ->> 'email', '')) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(e ->> 'email')) end;
      insert into public.customer (perusahaan_id, jenis, nama, hp, email, kota)
      values (v_pid, case when length(btrim(coalesce(e ->> 'perusahaan', ''))) > 1 then 'perusahaan' else 'orang' end, v_nama, v_hp, v_email,
              nullif(left(btrim(coalesce(e ->> 'kota', '')), 60), ''));
      n := n + 1;
    end loop;
  elsif new.aksi = 'pindah.produk' then
    for e in select * from jsonb_array_elements(coalesce(new.payload -> 'baris', '[]')) limit 2000 loop
      continue when length(btrim(coalesce(e ->> 'nama', ''))) < 2;
      v_kode := upper(left(coalesce(nullif(btrim(e ->> 'kode'), ''), regexp_replace(e ->> 'nama', '[^A-Za-z0-9]', '', 'g')), 30));
      if exists (select 1 from public.produk p where p.perusahaan_id = v_pid and (upper(p.kode) = v_kode or lower(p.nama) = lower(btrim(e ->> 'nama')))) then
        lewat := lewat + 1; continue;
      end if;
      begin
        perform public.simpan_produk(jsonb_build_object('kode', v_kode, 'nama', left(btrim(e ->> 'nama'), 120), 'satuan', nullif(btrim(coalesce(e ->> 'satuan', '')), ''),
          'harga_jual', greatest(0, round(coalesce(nullif(e ->> 'harga_jual', '')::numeric, 0)))));
        n := n + 1;
        select p.id into v_produk from public.produk p where p.perusahaan_id = v_pid and upper(p.kode) = v_kode;
        if (e ->> 'stok') ~ '^\d+(\.\d+)?$' and (e ->> 'stok')::numeric > 0 and v_produk is not null then
          v_stok := v_stok || jsonb_build_array(jsonb_build_object('produk', v_produk, 'fisik', (e ->> 'stok')::numeric));
        end if;
      exception when others then
        lewat := lewat + 1;
      end;
    end loop;
    if jsonb_array_length(v_stok) > 0 then perform public.opname_stok(app.gudang_utama(v_pid), v_stok, md5('pindah-opname:' || new.id)::uuid); end if;
  end if;
  insert into public.kejadian (perusahaan_id, jenis, sumber, data)
  values (v_pid, new.aksi || '.diterapkan', 'pwa', jsonb_strip_nulls(jsonb_build_object('usulan_id', new.id, 'dibuat', n, 'dilewati', lewat, 'catatan', v_catatan)));
  return new;
end $$;

create trigger pindah_dari_usulan after update of status on public.usulan for each row
  when (new.aksi in ('pindah.akun', 'pindah.kontak', 'pindah.produk') and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.pindah_dari_usulan();

revoke all on function public.propose_migration(text, text, jsonb) from public, anon;
grant execute on function public.propose_migration(text, text, jsonb) to authenticated;
revoke all on function app.pindah_dari_usulan(), app.kode_bebas(uuid, text, int, int), app.kategori_jurnal(int) from public, anon, authenticated;
