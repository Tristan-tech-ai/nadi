-- W-08 lanjutan: tanggal kiriman pintu data wajib YYYY-MM-DD. Tanpa ini '4/11/2026' diterima Postgres sebagai 11 April
-- (DateStyle MDY), terbukti di tes pintu_data. Fungsi lain di 20261105063000_pintu_data.sql tidak berubah.
create or replace function app.rapikan_baris_pintu(p_jenis text, p_baris jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare e jsonb; i int := 0; hasil jsonb := '[]'; v_tgl date; v_jml numeric; v_hrg numeric; v_teks text; v_metode text; v_arah text; v_saldo numeric;
begin
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 500 then
    raise exception 'Kirim 1 sampai 500 baris.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    i := i + 1;
    if jsonb_typeof(e) <> 'object' then raise exception 'Baris % bukan objek.', i using errcode = '22023'; end if;
    if coalesce(btrim(e ->> 'tanggal'), '') <> '' and btrim(e ->> 'tanggal') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Baris %: tanggal harus YYYY-MM-DD, mis. 2026-11-04.', i using errcode = '22023';
    end if;
    begin
      v_tgl := nullif(btrim(coalesce(e ->> 'tanggal', '')), '')::date;
      v_jml := nullif(btrim(coalesce(e ->> 'jumlah', '')), '')::numeric;
      v_hrg := nullif(btrim(coalesce(e ->> 'harga', '')), '')::numeric;
      v_saldo := nullif(btrim(coalesce(e ->> 'saldo', '')), '')::numeric;
    exception when others then
      raise exception 'Baris %: tanggal harus YYYY-MM-DD dan angka tanpa pemisah ribuan.', i using errcode = '22023';
    end;
    if p_jenis = 'penjualan' then
      v_metode := lower(btrim(coalesce(e ->> 'metode', 'transfer')));
      if v_tgl is null or v_jml is null or v_jml <= 0 or v_jml <> trunc(v_jml) or v_jml > 1000000000000 then
        raise exception 'Baris %: penjualan butuh tanggal dan jumlah rupiah bulat lebih dari 0.', i using errcode = '22023';
      end if;
      if v_metode not in ('tunai', 'transfer', 'qris', 'kartu', 'marketplace') then
        raise exception 'Baris %: metode tunai, transfer, qris, kartu, atau marketplace.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('tanggal', v_tgl, 'nomor', left(btrim(coalesce(e ->> 'nomor', '')), 60),
        'keterangan', left(btrim(coalesce(e ->> 'keterangan', '')), 120), 'jumlah', v_jml::bigint, 'metode', v_metode);
    elsif p_jenis = 'pesanan' then
      v_teks := btrim(coalesce(e ->> 'uraian', ''));
      if length(btrim(coalesce(e ->> 'nomor', ''))) not between 1 and 60 or length(btrim(coalesce(e ->> 'pelanggan', ''))) not between 1 and 100
         or length(v_teks) not between 1 and 120 or v_jml is null or v_jml <= 0 or v_jml > 100000
         or v_hrg is null or v_hrg < 0 or v_hrg <> trunc(v_hrg) or v_hrg > 1000000000000 then
        raise exception 'Baris %: pesanan butuh nomor, pelanggan, uraian, jumlah lebih dari 0, dan harga rupiah bulat.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('nomor', btrim(e ->> 'nomor'), 'tanggal', v_tgl, 'pelanggan', btrim(e ->> 'pelanggan'),
        'uraian', v_teks, 'jumlah', v_jml, 'harga', v_hrg::bigint);
    elsif p_jenis = 'mutasi' then
      v_arah := upper(btrim(coalesce(e ->> 'arah', '')));
      if v_tgl is null or v_jml is null or v_jml <= 0 or v_jml > 1000000000000 or v_arah not in ('DB', 'CR') then
        raise exception 'Baris %: mutasi butuh tanggal, jumlah lebih dari 0, dan arah DB atau CR.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('tanggal', v_tgl, 'keterangan', left(btrim(coalesce(e ->> 'keterangan', '')), 200),
        'cabang', left(btrim(coalesce(e ->> 'cabang', '')), 60), 'jumlah', v_jml, 'arah', v_arah, 'saldo', coalesce(v_saldo, 0));
    else
      raise exception 'Jenis kiriman penjualan, pesanan, atau mutasi.' using errcode = '22023';
    end if;
  end loop;
  if p_jenis = 'pesanan' and exists (select 1 from jsonb_array_elements(hasil) x group by x ->> 'nomor' having count(*) > 30) then
    raise exception 'Satu nomor pesanan paling banyak 30 baris barang.' using errcode = '22023';
  end if;
  return hasil;
end $$;
revoke all on function app.rapikan_baris_pintu(text, jsonb) from public, anon, authenticated;
