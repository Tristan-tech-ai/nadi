-- Tes keputusan: izin otopilot tercatat dengan alasan dan latensi, pembatalan membalik status dan memunculkan usulan, batal dua
-- kali ditolak; rute usulan uang besar hanya untuk pemilik (admin tidak melihat), pembatalan rute mengembalikan peran; p50 terhitung;
-- staf tidak bisa membaca/membatalkan; isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uadm uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kadm text; ks text;
  o1 uuid; us uuid; r jsonb; k uuid; u1 uuid; u2 uuid; n int; x text; iz uuid; h date := (now() at time zone 'Asia/Makassar')::date;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (uadm, 'adm@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kadm := json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uadm, 'admin');

  -- Izin otopilot.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.atur_kebijakan_izin('izin', true, 2, false, null, null);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', ks, true);
  r := public.ajukan_izin('izin', h + 2, h + 2, 'Urusan keluarga');
  iz := (r ->> 'id')::uuid;
  perform pg_temp.cek('izin disetujui otopilot', r ->> 'status' = 'disetujui', r::text);
  begin
    perform count(*) from public.keputusan;
    select count(*) into n from public.keputusan;
    perform pg_temp.cek('staf tidak melihat keputusan', n = 0, n::text);
  end;
  perform set_config('request.jwt.claims', ka, true);
  select id, alasan into k, x from public.keputusan where jenis = 'izin.otopilot' and subjek_id = iz;
  perform pg_temp.cek('keputusan izin tercatat dengan alasan dan latensi', k is not null and x like 'Disetujui otomatis: izin 1 hari%'
    and (select latensi_ms >= 0 and tingkat = 'aturan' and yakin = 1 from public.keputusan where id = k), x);
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform public.batalkan_keputusan(k, 'coba');
    perform pg_temp.cek('staf tidak bisa membatalkan', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa membatalkan', true);
  end;
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.batalkan_keputusan(k, '  ');
    perform pg_temp.cek('batal butuh alasan', false);
  exception when others then perform pg_temp.cek('batal butuh alasan', sqlerrm like 'Tulis alasan%', sqlerrm);
  end;
  r := public.batalkan_keputusan(k, 'Hari itu ada acara besar');
  perform pg_temp.cek('pembatalan izin: pengajuan menunggu dengan alasan', (select status = 'menunggu' and not oleh_otopilot
    and alasan_putusan like 'Persetujuan otomatis dibatalkan: Hari itu ada acara besar%' from public.pengajuan_izin where id = iz));
  perform pg_temp.cek('pembatalan izin: usulan muncul di Feed', exists (select 1 from public.usulan where id = (r ->> 'usulan')::uuid and aksi = 'izin.setujui' and status = 'menunggu'));
  execute 'reset role';
  perform pg_temp.cek('pembatalan izin: kejadian izin.batal membalik hari', (select sum(nilai) from public.kejadian where perusahaan_id = pa and orang_id = o1 and jenis in ('izin.izin', 'izin.batal')) = 0);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('keputusan tertanda dibatalkan', (select dibatalkan_at is not null and alasan_batal = 'Hari itu ada acara besar' and dibatalkan_oleh = ua from public.keputusan where id = k));
  begin
    perform public.batalkan_keputusan(k, 'lagi');
    perform pg_temp.cek('batal dua kali ditolak', false);
  exception when others then perform pg_temp.cek('batal dua kali ditolak', sqlerrm like 'Keputusan ini sudah dibatalkan%', sqlerrm);
  end;

  -- Rute usulan.
  execute 'reset role';
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, dampak_rp, payload) values (pa, 'lempar', 'uang.tagihan', 'Bayar tagihan pemasok', 7500000, '{}') returning id into u1;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, dampak_rp, payload) values (pa, 'lempar', 'uang.keluar', 'Beli gas', 150000, '{}') returning id into u2;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'mcp', 'catatan', 'Catatan dari asisten', '{}');
  perform pg_temp.cek('uang besar hanya untuk pemilik', (select untuk_peran = array['pemilik'] from public.usulan where id = u1));
  perform pg_temp.cek('uang kecil untuk pemilik dan admin', (select untuk_peran = array['pemilik', 'admin'] from public.usulan where id = u2));
  select alasan into x from public.keputusan where subjek_id = u1;
  perform pg_temp.cek('alasan rute menyebut nilai dan batas', x = 'Uang Rp7.500.000, di atas batas Rp5.000.000: hanya pemilik yang memutuskan.', x);
  perform pg_temp.cek('jenis tanpa aturan dicatat sebagai manusia', exists (select 1 from public.keputusan where perusahaan_id = pa and jenis = 'usulan.rute' and tingkat = 'manusia'));
  update public.perusahaan set pengaturan = pengaturan || '{"ambang_rute_pemilik": 100000}' where id = pa;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, dampak_rp, payload) values (pa, 'lempar', 'uang.keluar', 'Beli gas lagi', 150000, '{}') returning id into u2;
  perform pg_temp.cek('ambang per usaha dipakai', (select untuk_peran = array['pemilik'] from public.usulan where id = u2));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kadm, true);
  perform pg_temp.cek('admin tidak melihat usulan uang besar', not exists (select 1 from public.usulan where id = u1));
  begin
    perform public.putuskan_usulan(u1, true);
    perform pg_temp.cek('admin tidak bisa memutuskan usulan uang besar', false);
  exception when others then perform pg_temp.cek('admin tidak bisa memutuskan usulan uang besar', sqlerrm like 'Usulan tidak ditemukan%', sqlerrm);
  end;
  select id into k from public.keputusan where subjek_id = u1;
  perform public.batalkan_keputusan(k, 'Admin boleh memutuskan tagihan ini');
  perform pg_temp.cek('pembatalan rute: admin kini melihat usulan', exists (select 1 from public.usulan where id = u1));

  -- Ringkasan p50.
  select count(*) into n from public.ringkasan_keputusan(30) where p50_ms is not null and p95_ms >= p50_ms;
  perform pg_temp.cek('ringkasan p50/p95 per jenis dan tingkat', n >= 3, n::text);
  perform set_config('request.jwt.claims', ks, true);
  select count(*) into n from public.ringkasan_keputusan(30);
  perform pg_temp.cek('staf tidak mendapat ringkasan', n = 0, n::text);

  -- Usaha lain.
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.keputusan;
  perform pg_temp.cek('usaha lain tidak melihat keputusan', n = 0, n::text);
  begin
    perform public.batalkan_keputusan(k, 'x');
    perform pg_temp.cek('usaha lain tidak bisa membatalkan', false);
  exception when others then perform pg_temp.cek('usaha lain tidak bisa membatalkan', sqlerrm like 'Keputusan tidak ditemukan%', sqlerrm);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
