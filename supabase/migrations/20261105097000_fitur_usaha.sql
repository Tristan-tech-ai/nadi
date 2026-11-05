-- U-06 fitur per jenis usaha: pemilik/admin menyalakan atau mematikan modul menu. Pilihan disimpan di perusahaan.pengaturan.fitur
-- ({kode: true|false}); bawaan per paket dihitung aplikasi (src/lib/fitur-usaha.ts). Modul hanya mengatur yang tampil di menu,
-- bukan hak akses: halaman tetap memeriksa izinnya sendiri. Daftar kode modul sama dengan MODUL di aplikasi (dicocokkan tes SQL).

create or replace function app.feature_modules() returns text[]
language sql immutable set search_path = '' as $$
  select array['kasir', 'stok', 'produksi', 'dagang_luar', 'servis', 'janji', 'proyek', 'mata', 'crm', 'layanan']::text[];
$$;

create or replace function public.set_feature_module(p_module text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_fitur jsonb;
begin
  if p_module is null or not (p_module = any (app.feature_modules())) then
    raise exception 'Modul tidak dikenal' using errcode = '22023';
  end if;
  update public.perusahaan
     set pengaturan = jsonb_set(coalesce(pengaturan, '{}'::jsonb), '{fitur}',
                                coalesce(pengaturan -> 'fitur', '{}'::jsonb) || jsonb_build_object(p_module, coalesce(p_on, false)))
   where id = v_pid
  returning pengaturan -> 'fitur' into v_fitur;
  return v_fitur;
end $$;
revoke all on function public.set_feature_module(text, boolean) from public, anon;
grant execute on function public.set_feature_module(text, boolean) to authenticated;
