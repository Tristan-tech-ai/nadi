-- Tes F4-07: aturan pph.final_umkm bersumber dan terverifikasi; posisi_pajak menjumlah bruto pendapatan per bulan dari jurnal
-- (jurnal balik mengurangi, beban tidak ikut, tahun lain tidak ikut); profil pajak hanya pemilik dengan isian tervalidasi; staf,
-- anon, dan usaha lain tidak melihat.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; r jsonb; j jsonb; v_th int;
begin
  begin
    perform pg_temp.cek('aturan pph.final_umkm terverifikasi dengan sumber PP 20/2026', exists (select 1 from public.aturan_bertanggal where kunci = 'pph.final_umkm'
      and terverifikasi and berlaku_dari = date '2026-04-22' and sumber like '%PP 20/2026%' and (nilai ->> 'batas_bruto')::bigint = 4800000000
      and (nilai ->> 'tarif_persen')::numeric = 0.5 and (nilai ->> 'bebas_op')::bigint = 500000000));
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Pajak', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Pajak B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Pajak') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_s;
    v_th := extract(year from app.hari_ini(pa))::int;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- Januari: penjualan 10 jt + pendapatan lain 1 jt; Februari: penjualan 5 jt lalu dibalik; Maret: beban 2 jt (tidak ikut); tahun lalu 7 jt.
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(v_th, 1, 10), 'keterangan', 'Jual Januari'),
      '[{"akun": "1-100", "debit": 11000000}, {"akun": "4-100", "kredit": 10000000}, {"akun": "4-900", "kredit": 1000000}]');
    j := public.posting_jurnal(jsonb_build_object('tanggal', make_date(v_th, 2, 5), 'keterangan', 'Jual Februari'),
      '[{"akun": "1-100", "debit": 5000000}, {"akun": "4-100", "kredit": 5000000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(v_th, 3, 5), 'keterangan', 'Sewa'),
      '[{"akun": "6-200", "debit": 2000000}, {"akun": "1-100", "kredit": 2000000}]');
    perform public.posting_jurnal(jsonb_build_object('tanggal', make_date(v_th - 1, 12, 5), 'keterangan', 'Jual tahun lalu'),
      '[{"akun": "1-100", "debit": 7000000}, {"akun": "4-100", "kredit": 7000000}]');
    perform public.balik_jurnal((j ->> 'id')::uuid, 'salah catat');
    r := public.posisi_pajak(v_th);
    perform pg_temp.cek('bruto Januari 11 jt (penjualan + pendapatan lain)', (r -> 'bulanan' ->> 0)::numeric = 11000000, (r -> 'bulanan')::text);
    perform pg_temp.cek('jurnal balik mengurangi: Februari 0 bila dibalik di bulan yang sama, atau bulan baliknya negatif',
      (select sum(x::numeric) from jsonb_array_elements_text(r -> 'bulanan') x) = 11000000, (r -> 'bulanan')::text);
    perform pg_temp.cek('12 bulan, beban dan tahun lalu tidak ikut, aturan terlampir', jsonb_array_length(r -> 'bulanan') = 12
      and (r -> 'aturan' -> 'nilai' ->> 'batas_bruto')::bigint = 4800000000, left(r::text, 300));
    perform pg_temp.cek('tahun lalu terbaca terpisah', (select sum(x::numeric) from jsonb_array_elements_text(public.posisi_pajak(v_th - 1) -> 'bulanan') x) = 7000000);

    perform public.atur_profil_pajak('{"bentuk": "op", "bruto_lalu": 1000000000, "usaha_lain_ini": 250000000}');
    perform pg_temp.cek('profil tersimpan dan ikut di posisi pajak', public.posisi_pajak(v_th) -> 'profil' ->> 'bentuk' = 'op'
      and (public.posisi_pajak(v_th) -> 'profil' ->> 'usaha_lain_ini')::bigint = 250000000);
    begin perform public.atur_profil_pajak('{"bentuk": "pt"}'); perform pg_temp.cek('bentuk tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('bentuk tak dikenal ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_profil_pajak('{"bentuk": "op", "bruto_lalu": -5}'); perform pg_temp.cek('rupiah negatif ditolak', false);
    exception when others then perform pg_temp.cek('rupiah negatif ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_profil_pajak('{"bentuk": "op", "rahasia": 1}'); perform pg_temp.cek('isian tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('isian tak dikenal ditolak', sqlstate = '22023', sqlerrm); end;

    perform set_config('request.jwt.claims', ks, true);
    begin perform public.posisi_pajak(v_th); perform pg_temp.cek('staf tidak melihat posisi pajak', false);
    exception when others then perform pg_temp.cek('staf tidak melihat posisi pajak', sqlstate = '42501', sqlerrm); end;
    begin perform public.atur_profil_pajak('{"bentuk": "op"}'); perform pg_temp.cek('staf tidak mengatur profil pajak', false);
    exception when others then perform pg_temp.cek('staf tidak mengatur profil pajak', sqlstate = '42501', sqlerrm); end;
    perform set_config('request.jwt.claims', kb, true);
    r := public.posisi_pajak(v_th);
    perform pg_temp.cek('usaha lain: bruto 0 dan tanpa profil usaha A', (select sum(x::numeric) from jsonb_array_elements_text(r -> 'bulanan') x) = 0
      and r -> 'profil' = '{}'::jsonb, r::text);
    execute 'set local role anon';
    begin perform public.posisi_pajak(v_th); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
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
