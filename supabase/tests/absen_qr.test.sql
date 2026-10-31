-- Tes absen_qr: vektor uji RFC 6238, QR kedaluwarsa dan pemakaian ulang ditolak, cek wajah wajib, isolasi usaha, rahasia tertutup.
-- Transaksi dibatalkan di akhir lewat RAISE EXCEPTION; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  rfc bytea := convert_to('12345678901234567890', 'utf8');
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; us uuid; ka text; ks text; kb text;
  tp uuid; tb uuid; k bytea; u double precision; t bigint; kode_kini text; kode_lalu text; kode_basi text; r jsonb; n int;
  ok_wajah jsonb := '{"lulus": true, "kedip": true, "menoleh": "kiri"}';
begin
  -- Vektor uji RFC 6238 Lampiran B (SHA1, X = 30, 8 digit).
  perform pg_temp.cek('RFC 6238 t=59', app.totp(rfc, 59, 30, 8) = '94287082', app.totp(rfc, 59, 30, 8));
  perform pg_temp.cek('RFC 6238 t=1111111109', app.totp(rfc, 1111111109, 30, 8) = '07081804', app.totp(rfc, 1111111109, 30, 8));
  perform pg_temp.cek('RFC 6238 t=1111111111', app.totp(rfc, 1111111111, 30, 8) = '14050471');
  perform pg_temp.cek('RFC 6238 t=1234567890', app.totp(rfc, 1234567890, 30, 8) = '89005924');
  perform pg_temp.cek('RFC 6238 t=2000000000', app.totp(rfc, 2000000000, 30, 8) = '69279037');
  perform pg_temp.cek('RFC 6238 t=20000000000', app.totp(rfc, 20000000000, 30, 8) = '65353130');

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', kb, true);
  tb := public.tempat_absen_utama();
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  tp := public.tempat_absen_utama();
  perform pg_temp.cek('tempat utama dibuat sekali', public.tempat_absen_utama() = tp);
  r := public.kode_absen(tp);
  perform pg_temp.cek('kios mendapat kode 6 angka dan sisa detik', r ->> 'kode' ~ '^\d{6}$' and (r ->> 'sisa_detik')::int between 1 and 15, r::text);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  begin
    perform public.absen_catat(tp, r ->> 'kode', 'absen.masuk', ok_wajah);
    perform pg_temp.cek('pemilik tanpa data orang tidak bisa absen', false);
  exception when insufficient_privilege then perform pg_temp.cek('pemilik tanpa data orang tidak bisa absen', true);
  end;
  execute 'reset role';

  select rahasia into k from app.rahasia_tempat where tempat_id = tp;
  u := extract(epoch from clock_timestamp()); t := floor(u / 15)::bigint;
  kode_kini := app.totp(k, t * 15, 15, 6); kode_lalu := app.totp(k, (t - 1) * 15, 15, 6); kode_basi := app.totp(k, (t - 2) * 15, 15, 6);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform public.kode_absen(tp);
    perform pg_temp.cek('staf tidak bisa meminta kode kios', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa meminta kode kios', true);
  end;
  begin
    perform public.absen_catat(tp, kode_kini, 'absen.masuk', '{"lulus": false}');
    perform pg_temp.cek('tanpa cek wajah lolos ditolak', false);
  exception when others then perform pg_temp.cek('tanpa cek wajah lolos ditolak', sqlerrm like 'Cek wajah%', sqlerrm);
  end;
  -- Sejak Q-13 kode salah dikembalikan sebagai galat berupa data (dicatat untuk penguncian), bukan exception.
  r := public.absen_catat(tp, kode_basi, 'absen.masuk', ok_wajah);
  perform pg_temp.cek('kode dua langkah lalu (kedaluwarsa) ditolak', r ->> 'galat' like '%kedaluwarsa%', r::text);
  r := public.absen_catat(tp, '000000', 'absen.masuk', ok_wajah);
  perform pg_temp.cek('kode karangan ditolak', kode_kini = '000000' or kode_lalu = '000000' or r ->> 'galat' like '%kedaluwarsa%', r::text);
  begin
    perform public.absen_catat(tb, kode_kini, 'absen.masuk', ok_wajah);
    perform pg_temp.cek('tempat usaha lain ditolak', false);
  exception when others then perform pg_temp.cek('tempat usaha lain ditolak', sqlerrm like '%bukan untuk usahamu%', sqlerrm);
  end;
  r := public.absen_catat(tp, kode_kini, 'absen.masuk', ok_wajah);
  perform pg_temp.cek('kode sekarang diterima', r ->> 'jenis' = 'absen.masuk', r::text);
  begin
    perform public.absen_catat(tp, kode_kini, 'absen.masuk', ok_wajah);
    perform pg_temp.cek('kode yang sama tidak bisa dipakai lagi', false);
  exception when others then perform pg_temp.cek('kode yang sama tidak bisa dipakai lagi', sqlerrm like '%sudah kamu pakai%', sqlerrm);
  end;
  r := public.absen_catat(tp, kode_lalu, 'absen.pulang', ok_wajah);
  perform pg_temp.cek('kode satu langkah lalu masih diterima (keterlambatan jaringan)', r ->> 'jenis' = 'absen.pulang', r::text);
  execute 'reset role';

  select count(*) into n from public.kejadian where perusahaan_id = pa and orang_id = o1 and jenis in ('absen.masuk', 'absen.pulang') and tempat_id = tp;
  perform pg_temp.cek('dua kejadian absen tercatat dengan orang dan tempat', n = 2, n::text);
  perform pg_temp.cek('kejadian absen tanpa gambar wajah', not exists (select 1 from public.kejadian where perusahaan_id = pa and jenis like 'absen.%'
    and (data::text ~* 'base64|foto|gambar|image' or bukti is not null)));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform count(*) from app.rahasia_tempat;
    perform pg_temp.cek('rahasia tempat tidak terbaca pengguna', false);
  exception when insufficient_privilege then perform pg_temp.cek('rahasia tempat tidak terbaca pengguna', true);
  end;
  begin
    perform app.totp(rfc, 59, 30, 8);
    perform pg_temp.cek('fungsi totp tidak bisa dipanggil pengguna', false);
  exception when insufficient_privilege then perform pg_temp.cek('fungsi totp tidak bisa dipanggil pengguna', true);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
