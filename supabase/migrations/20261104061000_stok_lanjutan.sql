-- M-02B stok lanjutan (docs/research/mekari/rencana.md M-02; JU-09..JU-11): lokasi rak/bin per stok, laporan stok per gudang,
-- dan usulan dari Lempar: daftar produk (produk.impor) dan hitungan stok (stok.opname) yang baru berlaku setelah disetujui.
-- Varian (induk_id + atribut) dan harga bertingkat (harga_tingkat) sudah ada di tabel produk sejak M-02; layarnya di aplikasi.

alter table public.stok add column lokasi text check (lokasi is null or length(btrim(lokasi)) between 1 and 40);

-- Lokasi rak/bin untuk satu produk di satu gudang (baris stok dibuat bila belum ada, jumlah tetap).
create or replace function public.atur_lokasi_stok(p_produk uuid, p_gudang uuid, p_lokasi text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok();
begin
  if not exists (select 1 from public.produk where id = p_produk and perusahaan_id = v_pid) or not exists (select 1 from public.gudang where id = p_gudang and perusahaan_id = v_pid) then
    raise exception 'Produk atau gudang tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_lokasi is not null and length(btrim(p_lokasi)) > 40 then raise exception 'Lokasi paling panjang 40 huruf, misalnya Rak A-3' using errcode = '22023'; end if;
  insert into public.stok (perusahaan_id, produk_id, gudang_id, lokasi) values (v_pid, p_produk, p_gudang, nullif(btrim(p_lokasi), ''))
  on conflict (produk_id, gudang_id) do update set lokasi = excluded.lokasi, diubah_at = now();
end $$;

-- Laporan stok per gudang: jumlah, nilai (rata-rata bergerak), dan lokasi tiap produk berjenis barang.
create or replace function public.laporan_stok() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('gudang_id', g.id, 'gudang', g.nama, 'utama', g.utama,
      'nilai', coalesce((select sum(s.nilai) from public.stok s where s.gudang_id = g.id), 0),
      'produk', coalesce((select jsonb_agg(jsonb_build_object('produk_id', p.id, 'kode', p.kode, 'nama', p.nama, 'satuan', p.satuan,
                    'jumlah', s.jumlah, 'nilai', s.nilai, 'lokasi', s.lokasi) order by p.nama)
                  from public.stok s join public.produk p on p.id = s.produk_id where s.gudang_id = g.id), '[]')) order by g.utama desc, g.nama), '[]')
    from public.gudang g where g.perusahaan_id = app.wajib_buku()
$$;

-- Disetujui: daftar produk dibuat (yang kodenya atau namanya sudah ada dilewati), hitungan stok menjadi opname gudang utama.
create or replace function app.stok_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e jsonb; v_pid uuid := new.perusahaan_id; v_kode text; v_produk uuid; v_baris jsonb := '[]'; n int := 0;
begin
  if new.aksi = 'produk.impor' then
    for e in select * from jsonb_array_elements(coalesce(new.payload #> '{bidang,baris}', '[]')) limit 500 loop
      continue when length(btrim(coalesce(e ->> 'nama', ''))) < 2;
      v_kode := upper(left(coalesce(nullif(btrim(e ->> 'kode'), ''), regexp_replace(e ->> 'nama', '[^A-Za-z0-9]', '', 'g')), 30));
      continue when exists (select 1 from public.produk p where p.perusahaan_id = v_pid and (upper(p.kode) = v_kode or lower(p.nama) = lower(btrim(e ->> 'nama'))));
      begin
        perform public.simpan_produk(jsonb_build_object('kode', v_kode, 'nama', left(btrim(e ->> 'nama'), 120), 'satuan', nullif(btrim(coalesce(e ->> 'satuan', '')), ''),
          'harga_jual', greatest(0, round(coalesce((e ->> 'harga_jual')::numeric, 0)))));
        n := n + 1;
      exception when others then
        raise notice 'produk.impor dilewati %: %', v_kode, sqlerrm;
      end;
    end loop;
  elsif new.aksi = 'stok.opname' then
    for e in select * from jsonb_array_elements(coalesce(new.payload #> '{bidang,baris}', '[]')) limit 500 loop
      select p.id into v_produk from public.produk p
       where p.perusahaan_id = v_pid and p.jenis = 'barang' and p.aktif
         and ((nullif(btrim(e ->> 'kode'), '') is not null and upper(p.kode) = upper(btrim(e ->> 'kode'))) or lower(p.nama) = lower(btrim(coalesce(e ->> 'nama', ''))))
       order by (upper(p.kode) = upper(btrim(coalesce(e ->> 'kode', '')))) desc limit 1;
      continue when v_produk is null or (e ->> 'jumlah') is null or (e ->> 'jumlah')::numeric < 0;
      v_baris := v_baris || jsonb_build_array(jsonb_build_object('produk', v_produk, 'fisik', (e ->> 'jumlah')::numeric));
      v_produk := null;
    end loop;
    if jsonb_array_length(v_baris) > 0 then
      perform public.opname_stok(app.gudang_utama(v_pid), v_baris, md5('opname:' || new.id)::uuid);
      n := jsonb_array_length(v_baris);
    end if;
  end if;
  insert into public.kejadian (perusahaan_id, jenis, sumber, data)
  values (v_pid, new.aksi || '.diterapkan', 'pwa', jsonb_build_object('usulan_id', new.id, 'baris', n));
  return new;
end $$;
create trigger stok_dari_usulan after update of status on public.usulan for each row
  when (new.aksi in ('produk.impor', 'stok.opname') and new.status = 'diterima' and old.status is distinct from 'diterima') execute function app.stok_dari_usulan();

revoke all on function app.stok_dari_usulan() from public, anon, authenticated;
revoke all on function public.atur_lokasi_stok(uuid, uuid, text), public.laporan_stok() from public, anon;
grant execute on function public.atur_lokasi_stok(uuid, uuid, text), public.laporan_stok() to authenticated;
