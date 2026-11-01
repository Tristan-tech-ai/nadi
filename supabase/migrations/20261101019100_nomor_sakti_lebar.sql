-- F4-01 lanjutan: lpad di PostgreSQL MEMOTONG teks yang lebih panjang dari lebar (lpad('1234', 3, '0') = '123'), sehingga nomor
-- ke-1000 pada templat {no:3} menjadi 100 dan bentrok. Ditemukan tes nomor_sakti ("susun 1234 lebih panjang dari lebar tetap utuh").
-- Nomor yang lebih panjang dari lebar kini ditulis utuh.
create or replace function app.susun_nomor(p_templat text, p_urut integer, p_kode text, p_jenis text, p_tanggal date) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := p_templat; m text[]; s text := p_urut::text;
begin
  -- {no:N}: paling sedikit N digit dengan nol di depan; nomor yang lebih panjang tidak dipotong. {no}: tanpa nol.
  loop
    m := regexp_match(v, '\{no:([1-9])\}');
    exit when m is null;
    v := regexp_replace(v, '\{no:' || m[1] || '\}', case when length(s) >= m[1]::int then s else lpad(s, m[1]::int, '0') end);
  end loop;
  v := replace(v, '{no}', s);
  v := replace(v, '{kode}', coalesce(p_kode, ''));
  v := replace(v, '{jenis}', p_jenis);
  v := replace(v, '{bulan_romawi}', app.romawi(extract(month from p_tanggal)::int));
  v := replace(v, '{bulan}', to_char(p_tanggal, 'MM'));
  v := replace(v, '{tahun2}', to_char(p_tanggal, 'YY'));
  v := replace(v, '{tahun}', to_char(p_tanggal, 'YYYY'));
  return v;
end $$;
revoke all on function app.susun_nomor(text, integer, text, text, date) from public, anon, authenticated;
