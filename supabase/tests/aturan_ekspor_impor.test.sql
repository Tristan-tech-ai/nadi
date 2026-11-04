-- Tes aturan ekspor-impor (R-EKSIM2): tiga aturan bertanggal ada, terverifikasi, angka sama dengan teks pasal yang dibaca.
do $$
declare g text := ''; a jsonb;
begin
  select nilai into a from public.aturan_bertanggal where kunci = 'pph22.impor' and terverifikasi order by berlaku_dari desc limit 1;
  if a is null or (a ->> 'dengan_api_persen')::numeric <> 2.5 or (a ->> 'tanpa_api_persen')::numeric <> 7.5 or (a ->> 'emas_batangan_persen')::numeric <> 0.25 then g := g || 'pph22.impor; '; end if;
  select nilai into a from public.aturan_bertanggal where kunci = 'ppn.impor' and terverifikasi order by berlaku_dari desc limit 1;
  if a is null or (a ->> 'tarif_persen')::numeric <> 12 or a -> 'dpp_pengali' <> '[11, 12]'::jsonb then g := g || 'ppn.impor; '; end if;
  select nilai into a from public.aturan_bertanggal where kunci = 'dhe.sda' and terverifikasi order by berlaku_dari desc limit 1;
  if a is null or (a ->> 'batas_nilai_peb_usd')::numeric <> 250000 or (a ->> 'non_migas_persen')::numeric <> 100 then g := g || 'dhe.sda; '; end if;
  if exists (select 1 from public.aturan_bertanggal where kunci in ('pph22.impor', 'ppn.impor', 'dhe.sda') and coalesce(sumber, '') = '') then g := g || 'sumber kosong; '; end if;
  raise exception 'aturan_ekspor_impor: gagal=[%]', g;
end $$;
