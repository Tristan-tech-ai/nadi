-- W-08 (docs/research/integrasi-aplikasi.md): pintu masuk data per usaha untuk aplikasi lain dan pipeline n8n/Make/Zapier.
-- Token nmi_ hanya disimpan sebagai sha256 (app.hash_token), terikat satu usaha, bisa dicabut, dan dibatasi jumlah kiriman per
-- 24 jam. Satu-satunya kemampuannya: satu kiriman penjualan, pesanan, atau mutasi menjadi SATU usulan di Feed (menunggu pemilik
-- atau admin). Tidak ada yang tercatat sebelum disetujui. Disetujui: mutasi masuk rekening bank lewat alur uang.mutasi yang sudah
-- ada (impor_mutasi_inti); penjualan menjadi jurnal per baris (kas/bank lawan 4-100); pesanan menjadi dokumen pesanan (SO) per
-- nomor pesanan. Baris lengkap disimpan di payload.baris; payload.bidang hanya ringkasan kecil karena putuskan_usulan menyalin
-- bidang ke kejadian.data (batas 8 KB).
-- Tes: supabase/tests/pintu_data.test.sql.

create table public.pintu_data (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 2 and 60),
  token_hash text not null unique,
  batas_harian int not null default 100 check (batas_harian between 1 and 1000),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  terakhir_at timestamptz,
  dicabut_at timestamptz
);
create index on public.pintu_data (perusahaan_id);
alter table public.pintu_data enable row level security;
create policy pintu_data_baca on public.pintu_data for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select (id, perusahaan_id, nama, batas_harian, dibuat_at, terakhir_at, dicabut_at) on public.pintu_data to authenticated;
create trigger audit_pintu_data after insert or update or delete on public.pintu_data for each row execute function app.catat_audit();

create or replace function public.buat_pintu_data(p_nama text, p_batas int default 100) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_token text := app.token_baru('nmi_');
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membuat pintu data.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 60 then raise exception 'Beri nama pintu, 2 sampai 60 huruf.' using errcode = '22023'; end if;
  if coalesce(p_batas, 0) not between 1 and 1000 then raise exception 'Batas kiriman per hari 1 sampai 1000.' using errcode = '22023'; end if;
  if (select count(*) from public.pintu_data where perusahaan_id = v_pid and dicabut_at is null) >= 10 then
    raise exception 'Paling banyak 10 pintu aktif. Cabut yang tidak dipakai dulu.' using errcode = '54000';
  end if;
  insert into public.pintu_data (perusahaan_id, nama, token_hash, batas_harian, dibuat_oleh)
  values (v_pid, btrim(p_nama), app.hash_token(v_token), p_batas, auth.uid());
  return v_token;
end $$;

create or replace function public.cabut_pintu_data(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencabut pintu data.' using errcode = '42501';
  end if;
  update public.pintu_data set dicabut_at = now() where id = p_id and perusahaan_id = v_pid and dicabut_at is null;
  if not found then raise exception 'Pintu data tidak ditemukan atau sudah dicabut.' using errcode = 'P0002'; end if;
end $$;

-- Rapikan baris kiriman per jenis. Galat menyebut nomor baris (mulai 1) supaya pengirim bisa memperbaiki.
create or replace function app.rapikan_baris_pintu(p_jenis text, p_baris jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare e jsonb; i int := 0; hasil jsonb := '[]'; v_tgl date; v_jml numeric; v_hrg numeric; v_teks text; v_metode text; v_arah text; v_saldo numeric;
begin
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 500 then
    raise exception 'Kirim 1 sampai 500 baris.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    i := i + 1;
    if jsonb_typeof(e) <> 'object' then raise exception 'Baris % bukan objek.', i using errcode = '22023'; end if;
    begin
      v_tgl := nullif(btrim(coalesce(e ->> 'tanggal', '')), '')::date;
      v_jml := nullif(btrim(coalesce(e ->> 'jumlah', '')), '')::numeric;
      v_hrg := nullif(btrim(coalesce(e ->> 'harga', '')), '')::numeric;
      v_saldo := nullif(btrim(coalesce(e ->> 'saldo', '')), '')::numeric;
    exception when others then
      raise exception 'Baris %: tanggal harus YYYY-MM-DD dan angka tanpa pemisah ribuan.', i using errcode = '22023';
    end;
    if p_jenis = 'penjualan' then
      v_metode := lower(btrim(coalesce(e ->> 'metode', 'transfer')));
      if v_tgl is null or v_jml is null or v_jml <= 0 or v_jml <> trunc(v_jml) or v_jml > 1000000000000 then
        raise exception 'Baris %: penjualan butuh tanggal dan jumlah rupiah bulat lebih dari 0.', i using errcode = '22023';
      end if;
      if v_metode not in ('tunai', 'transfer', 'qris', 'kartu', 'marketplace') then
        raise exception 'Baris %: metode tunai, transfer, qris, kartu, atau marketplace.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('tanggal', v_tgl, 'nomor', left(btrim(coalesce(e ->> 'nomor', '')), 60),
        'keterangan', left(btrim(coalesce(e ->> 'keterangan', '')), 120), 'jumlah', v_jml::bigint, 'metode', v_metode);
    elsif p_jenis = 'pesanan' then
      v_teks := btrim(coalesce(e ->> 'uraian', ''));
      if length(btrim(coalesce(e ->> 'nomor', ''))) not between 1 and 60 or length(btrim(coalesce(e ->> 'pelanggan', ''))) not between 1 and 100
         or length(v_teks) not between 1 and 120 or v_jml is null or v_jml <= 0 or v_jml > 100000
         or v_hrg is null or v_hrg < 0 or v_hrg <> trunc(v_hrg) or v_hrg > 1000000000000 then
        raise exception 'Baris %: pesanan butuh nomor, pelanggan, uraian, jumlah lebih dari 0, dan harga rupiah bulat.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('nomor', btrim(e ->> 'nomor'), 'tanggal', v_tgl, 'pelanggan', btrim(e ->> 'pelanggan'),
        'uraian', v_teks, 'jumlah', v_jml, 'harga', v_hrg::bigint);
    elsif p_jenis = 'mutasi' then
      v_arah := upper(btrim(coalesce(e ->> 'arah', '')));
      if v_tgl is null or v_jml is null or v_jml <= 0 or v_jml > 1000000000000 or v_arah not in ('DB', 'CR') then
        raise exception 'Baris %: mutasi butuh tanggal, jumlah lebih dari 0, dan arah DB atau CR.', i using errcode = '22023';
      end if;
      hasil := hasil || jsonb_build_object('tanggal', v_tgl, 'keterangan', left(btrim(coalesce(e ->> 'keterangan', '')), 200),
        'cabang', left(btrim(coalesce(e ->> 'cabang', '')), 60), 'jumlah', v_jml, 'arah', v_arah, 'saldo', coalesce(v_saldo, 0));
    else
      raise exception 'Jenis kiriman penjualan, pesanan, atau mutasi.' using errcode = '22023';
    end if;
  end loop;
  if p_jenis = 'pesanan' and exists (select 1 from jsonb_array_elements(hasil) x group by x ->> 'nomor' having count(*) > 30) then
    raise exception 'Satu nomor pesanan paling banyak 30 baris barang.' using errcode = '22023';
  end if;
  return hasil;
end $$;
revoke all on function app.rapikan_baris_pintu(text, jsonb) from public, anon, authenticated;

-- Terima satu kiriman: token sah dan belum dicabut, batas per 24 jam, kunci sama = usulan yang sama (aman diulang).
create or replace function public.pintu_terima(p_token text, p_jenis text, p_baris jsonb, p_kunci uuid, p_asal text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.pintu_data; u public.usulan; v_baris jsonb; v_n int; v_total numeric; v_asal text := left(btrim(coalesce(p_asal, '')), 60);
  v_aksi text; v_judul text; v_ket text; v_pesanan int;
begin
  select * into v from public.pintu_data where token_hash = app.hash_token(coalesce(p_token, '')) and dicabut_at is null;
  if v.id is null then raise exception 'Token pintu data tidak berlaku. Buat token baru di Usahamu.' using errcode = '28000'; end if;
  if p_kunci is null then raise exception 'Kunci kiriman wajib.' using errcode = '22023'; end if;
  select * into u from public.usulan where perusahaan_id = v.perusahaan_id and kunci_klien = p_kunci;
  if u.id is not null then return jsonb_build_object('usulan', u.id, 'status', u.status, 'sudah', true); end if;
  if (select count(*) from public.usulan where perusahaan_id = v.perusahaan_id and sumber = 'pintu' and payload ->> 'pintu' = v.id::text
       and dibuat_at > now() - interval '24 hours') >= v.batas_harian then
    raise exception 'Batas % kiriman per 24 jam untuk pintu ini sudah tercapai. Coba lagi besok atau naikkan batasnya.', v.batas_harian using errcode = '54000';
  end if;
  v_baris := app.rapikan_baris_pintu(p_jenis, p_baris);
  v_n := jsonb_array_length(v_baris);
  v_total := (select sum(case when p_jenis = 'pesanan' then (x ->> 'jumlah')::numeric * (x ->> 'harga')::numeric else (x ->> 'jumlah')::numeric end)
                from jsonb_array_elements(v_baris) x);
  v_ket := 'Dikirim lewat pintu data "' || v.nama || '"' || case when v_asal <> '' then ' dari ' || v_asal else '' end || '. ';
  if p_jenis = 'penjualan' then
    v_aksi := 'uang.penjualan';
    v_judul := 'Catat ' || v_n || ' penjualan ' || app.rupiah(v_total);
    v_ket := v_ket || 'Disetujui = setiap baris menjadi jurnal penjualan (tunai ke Kas, lainnya ke Bank). Periksa barisnya dulu.';
  elsif p_jenis = 'pesanan' then
    v_pesanan := (select count(distinct x ->> 'nomor') from jsonb_array_elements(v_baris) x);
    v_aksi := 'jual.pesanan';
    v_judul := 'Buat ' || v_pesanan || ' pesanan penjualan ' || app.rupiah(v_total);
    v_ket := v_ket || 'Disetujui = setiap nomor pesanan menjadi dokumen pesanan (SO) di Penjualan. Stok belum berkurang sampai surat jalan dibuat.';
  else
    v_aksi := 'uang.mutasi_pintu';
    v_judul := 'Cocokkan ' || v_n || ' transaksi rekening';
    v_ket := v_ket || 'Disetujui = mutasi masuk rekening bank pertama dan dicocokkan di Kas.';
  end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, keyakinan, dampak_rp, untuk_peran, status, kunci_klien)
  values (v.perusahaan_id, 'pintu', v_aksi, v_judul, v_ket,
          jsonb_build_object('jenis', p_jenis, 'baris', v_baris, 'bidang', jsonb_build_object('jumlah_baris', v_n, 'total', v_total),
                             'pintu', v.id, 'asal', nullif(v_asal, '')),
          1, case when p_jenis = 'mutasi' then null else v_total end, array['pemilik', 'admin'], 'menunggu', p_kunci)
  returning * into u;
  update public.pintu_data set terakhir_at = now() where id = v.id;
  return jsonb_build_object('usulan', u.id, 'status', u.status, 'sudah', false, 'baris', v_n);
end $$;
revoke all on function public.pintu_terima(text, text, jsonb, uuid, text) from public;
grant execute on function public.pintu_terima(text, text, jsonb, uuid, text) to anon, authenticated;
revoke all on function public.buat_pintu_data(text, int), public.cabut_pintu_data(uuid) from public, anon;
grant execute on function public.buat_pintu_data(text, int), public.cabut_pintu_data(uuid) to authenticated;

-- Disetujui: penjualan menjadi jurnal per baris; kunci idempoten per usulan dan baris.
create or replace function app.penjualan_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e jsonb; i int := 0; v_akun text; v_ket text;
begin
  for e in select * from jsonb_array_elements(new.payload -> 'baris') loop
    i := i + 1;
    v_akun := case when e ->> 'metode' = 'tunai' then '1-100' else '1-110' end;
    v_ket := left('Penjualan ' || coalesce(nullif(e ->> 'nomor', ''), '') || ' ' || coalesce(nullif(e ->> 'keterangan', ''), 'lewat pintu data'), 200);
    perform app.posting_jurnal(new.perusahaan_id,
      jsonb_build_object('tanggal', e ->> 'tanggal', 'keterangan', btrim(regexp_replace(v_ket, '\s+', ' ', 'g')), 'sumber', 'pintu',
        'sumber_id', new.id::text, 'kunci_idempoten', 'pintu:' || new.id || ':' || i),
      jsonb_build_array(jsonb_build_object('akun', v_akun, 'debit', (e ->> 'jumlah')::bigint),
                        jsonb_build_object('akun', '4-100', 'kredit', (e ->> 'jumlah')::bigint)),
      new.diputuskan_oleh);
  end loop;
  return new;
end $$;
create trigger penjualan_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'uang.penjualan' and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.penjualan_dari_usulan();

-- Disetujui: satu dokumen pesanan per nomor, lewat buat_dokumen_jual (penomoran SO dan aturan baris yang sama dengan layar).
create or replace function app.pesanan_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select x ->> 'nomor' as nomor, min(x ->> 'pelanggan') as pelanggan,
                  jsonb_agg(jsonb_build_object('uraian', x ->> 'uraian', 'jumlah', (x ->> 'jumlah')::numeric, 'harga', (x ->> 'harga')::bigint)) as baris
             from jsonb_array_elements(new.payload -> 'baris') x group by x ->> 'nomor' order by 1 loop
    perform public.buat_dokumen_jual('pesanan', null, r.pelanggan, null, r.baris, null,
      left('Pesanan ' || r.nomor || ' dari pintu data', 200), md5(new.id::text || ':' || r.nomor)::uuid);
  end loop;
  return new;
end $$;
create trigger pesanan_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'jual.pesanan' and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.pesanan_dari_usulan();

-- Disetujui: mutasi dari pintu data masuk rekening bank pertama, sama dengan e-statement Lempar (app.mutasi_dari_usulan).
create or replace function app.mutasi_pintu_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_rek uuid;
begin
  perform app.rekening_bawaan(new.perusahaan_id);
  select id into v_rek from public.rekening_kas where perusahaan_id = new.perusahaan_id and jenis = 'bank' and aktif order by akun_kode limit 1;
  if v_rek is not null then perform app.impor_mutasi_inti(new.perusahaan_id, v_rek, new.payload -> 'baris', new.id); end if;
  return new;
end $$;
create trigger mutasi_pintu_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'uang.mutasi_pintu' and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.mutasi_pintu_dari_usulan();
