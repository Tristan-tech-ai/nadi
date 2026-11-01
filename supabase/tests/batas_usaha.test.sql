-- Tes Q-32: batas 20 usaha per akun dihitung dari usaha yang keanggotaannya masih aktif; usaha yang keanggotaannya sudah
-- dinonaktifkan (arsip, tanpa hapus data) tidak menghabiskan batas; plafon 50 usaha pernah dibuat tetap berlaku.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare u uuid := gen_random_uuid(); i int; p uuid; pertama uuid;
begin
  begin
    insert into auth.users (id, email) values (u, 'batas@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    for i in 1..20 loop
      p := public.buat_perusahaan('Batas ' || i, 'fnb');
      if i = 1 then pertama := p; end if;
    end loop;
    begin perform public.buat_perusahaan('Batas 21', 'fnb'); perform pg_temp.cek('usaha ke-21 ditolak saat 20 aktif', false);
    exception when others then perform pg_temp.cek('usaha ke-21 ditolak saat 20 aktif', sqlstate = '54000', sqlerrm); end;
    execute 'reset role';
    update public.anggota set aktif = false where perusahaan_id = pertama and user_id = u;
    execute 'set local role authenticated';
    begin perform public.buat_perusahaan('Batas 21', 'fnb'); perform pg_temp.cek('usaha arsip tidak dihitung: ke-21 boleh', true);
    exception when others then perform pg_temp.cek('usaha arsip tidak dihitung: ke-21 boleh', false, sqlstate || ' ' || sqlerrm); end;
    execute 'reset role';
    perform pg_temp.cek('usaha arsip tetap ada (tidak dihapus)', (select count(*) from public.perusahaan where dibuat_oleh = u) = 21);
    update public.anggota set aktif = false where user_id = u;
    execute 'set local role authenticated';
    for i in 22..50 loop
      p := public.buat_perusahaan('Batas ' || i, 'fnb');
      execute 'reset role';
      update public.anggota set aktif = false where perusahaan_id = p and user_id = u;
      execute 'set local role authenticated';
    end loop;
    begin perform public.buat_perusahaan('Batas 51', 'fnb'); perform pg_temp.cek('plafon 50 usaha pernah dibuat', false);
    exception when others then perform pg_temp.cek('plafon 50 usaha pernah dibuat', sqlstate = '54000', sqlerrm); end;
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
