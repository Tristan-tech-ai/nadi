-- Perbaikan M-25: usaha contoh menandai dirinya dengan pengaturan.demo = 'toko' atau 'fnb' (bukan 'true'), jadi saringan
-- coalesce(demo, 'false') <> 'true' tidak pernah menyaring dan pengingat kepatuhan muncul di Feed demo (ditemukan e2e asap 6 Nov 2026,
-- Feed demo berisi 5 kartu, bukan 4). Usaha contoh kini dikenali dari adanya kunci demo. Kartu yang sudah terlanjur dibuat ditandai
-- kedaluwarsa (tidak dihapus).

create or replace function app.pengingat_kepatuhan(p_hari date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare p record; t record; n int := 0; v_hari date;
begin
  for p in select pr.id from public.perusahaan pr where pr.pengaturan ->> 'demo' is null loop
    v_hari := coalesce(p_hari, app.hari_ini(p.id));
    for t in
      select * from app.tenggat_kepatuhan(p.id, v_hari, v_hari + 7) where jenis <> 'izin'
      union all
      select k.* from app.tenggat_kepatuhan(p.id, v_hari, v_hari + 365) k join public.izin_usaha i on k.ref = 'izin:' || i.id
       where k.jenis = 'izin' and k.tanggal <= v_hari + i.pengingat_hari
    loop
      insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
      values (p.id, 'nadi', 'info.kepatuhan', left(t.judul || ', ' || to_char(t.tanggal, 'DD-MM-YYYY'), 140),
        'Tenggat ' || to_char(t.tanggal, 'DD-MM-YYYY') || '. Dasar: ' || t.dasar || '.',
        jsonb_build_object('jenis', t.jenis, 'tanggal', t.tanggal, 'ref', t.ref), array['pemilik'], md5('kepatuhan:' || p.id || ':' || t.ref)::uuid)
      on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function app.pengingat_kepatuhan(date) from public, anon, authenticated;

update public.usulan u set status = 'kedaluwarsa'
  from public.perusahaan p
 where p.id = u.perusahaan_id and p.pengaturan ->> 'demo' is not null and u.aksi = 'info.kepatuhan' and u.status = 'menunggu';
