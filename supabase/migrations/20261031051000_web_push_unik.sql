-- Satu perangkat bisa berlangganan untuk tiap usaha yang dibuka penggunanya (pindah usaha tidak menimpa langganan lama).
alter table public.langganan_push drop constraint langganan_push_user_id_endpoint_key;
alter table public.langganan_push add constraint langganan_push_unik unique (perusahaan_id, user_id, endpoint);
create index on public.langganan_push (user_id);
