-- Q-18: baris antrean rute model yang macet di status 'proses' (Edge Function putuskan mati atau timeout setelah klaim) tidak
-- pernah selesai sendiri. Tiap 5 menit, baris 'proses' yang mulai lebih dari 10 menit lalu ditandai gagal dengan galatnya.
-- Rute usulan tidak disentuh: usulan tetap untuk pemilik dan admin seperti sejak awal.
create or replace function app.rute_model_kedaluwarsa() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update app.rute_model
     set status = 'gagal', galat = 'Edge Function tidak menjawab dalam 10 menit', selesai_at = clock_timestamp()
   where status = 'proses' and mulai_at < clock_timestamp() - interval '10 minutes';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.rute_model_kedaluwarsa() from public, anon, authenticated;

select cron.schedule('nadi-rute-macet', '*/5 * * * *', $$select app.rute_model_kedaluwarsa()$$);
