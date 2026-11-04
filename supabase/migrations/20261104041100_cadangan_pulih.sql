-- Q-03B: uji pulih bisa dipanggil berkali-kali dalam satu transaksi (nama tabel sementara unik per panggilan; tes SQL pertama
-- gagal 42P07 "relation pulih_uji already exists" pada panggilan kedua).
create or replace function public.cadangan_uji_pulih(p_tabel text, p_isi jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n bigint; u bigint; ada_id boolean; nama text := 'pulih_' || replace(gen_random_uuid()::text, '-', '');
begin
  if not (p_tabel = any(public.cadangan_daftar())) then
    raise exception 'Tabel % tidak termasuk cadangan', p_tabel using errcode = '22023';
  end if;
  if jsonb_typeof(p_isi) <> 'array' then raise exception 'Isi cadangan harus larik' using errcode = '22023'; end if;
  execute format('create temp table %I on commit drop as select * from jsonb_populate_recordset(null::public.%I, $1)', nama, p_tabel) using p_isi;
  select exists (select 1 from pg_attribute where attrelid = format('pg_temp.%I', nama)::regclass and attname = 'id' and not attisdropped) into ada_id;
  execute format('select count(*) from pg_temp.%I', nama) into n;
  if ada_id then execute format('select count(distinct id) from pg_temp.%I', nama) into u; else u := n; end if;
  return jsonb_build_object('tabel', p_tabel, 'baris', n, 'unik', u, 'cocok', n = jsonb_array_length(p_isi) and u = n);
end $$;
revoke all on function public.cadangan_uji_pulih(text, jsonb) from public, anon, authenticated;
grant execute on function public.cadangan_uji_pulih(text, jsonb) to service_role;
