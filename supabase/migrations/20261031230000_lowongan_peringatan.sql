-- F2-02: peringatan bias lowongan (SE Menaker M/6/HK.04/V/2025; UU 13/2003 Pasal 5-6; UU 8/2016).
-- Diisi server Next dari pemeriksa src/lib/rekrut/bias.ts: [{kode, kutipan, alasan, saran}].
-- Lowongan berperingatan disimpan tertutup; pemilik boleh membukanya sendiri (batas usia sah bila sifat kerja menuntut, SE butir 3a).
alter table public.lowongan
  add column peringatan jsonb not null default '[]'::jsonb
    check (jsonb_typeof(peringatan) = 'array' and jsonb_array_length(peringatan) <= 8);

comment on column public.lowongan.peringatan is 'Peringatan bias dari teks lowongan: [{kode, kutipan, alasan, saran}]';
