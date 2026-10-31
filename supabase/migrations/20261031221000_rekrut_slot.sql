-- Perbaikan rekrut: kebijakan Storage untuk anon tidak boleh membaca public.berkas langsung (anon tidak punya SELECT; tertangkap
-- tes SQL rekrut). Pemeriksaan slot lamar dipindah ke fungsi security definer yang hanya menjawab ya/tidak untuk satu jalur.
create or replace function app.slot_lamar(p_jalur text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.berkas b
                  where b.jalur = p_jalur and split_part(p_jalur, '/', 2) = 'lamar'
                    and b.status = 'unggah' and b.diunggah_oleh is null and b.dibuat_at > now() - interval '10 minutes')
$$;
revoke all on function app.slot_lamar(text) from public;
grant execute on function app.slot_lamar(text) to anon;

alter policy berkas_unggah_lamar on storage.objects
  with check (bucket_id = 'berkas' and (storage.foldername(name))[2] = 'lamar' and app.slot_lamar(name));
