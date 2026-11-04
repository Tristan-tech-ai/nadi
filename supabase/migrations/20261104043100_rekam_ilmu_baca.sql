-- F3-07C: kebijakan baca butir ilmu sendiri memakai fungsi security definer, karena staf tidak bisa membaca tabel berhenti
-- (subquery di kebijakan ikut RLS berhenti; tes SQL rekam_ilmu: orang itu melihat 0 butir).
alter policy serah_butir_baca_ilmu_sendiri on public.serah_butir
  using (jenis = 'ilmu' and perusahaan_id = (select app.pid()) and (app.butir_ilmu_saya(id)).id is not null);
