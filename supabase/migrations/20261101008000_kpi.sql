-- F3-03 KPI dari jejak dan cermin kinerja (rancangan docs/research/kpi-f3-03-sql.md, layar docs/design/kpi-cermin.md).
-- Per orang aktif (karyawan/magang) per minggu [mulai, mulai + 7) di zona usaha (perusahaan.zona_waktu lewat app.awal_minggu,
-- sama dengan app.beban_orang F3-02): poin kerja selesai, tepat tenggat dari kerja bertenggat, kerja lintas topi (kontribusi,
-- tidak pernah minus), hadir sesuai jadwal = null sampai jadwal shift (F3-06) ada. Setiap ukuran membawa larik id kerja yang
-- dihitung, atau teks "belum ada" bila nol, sehingga setiap angka bisa dijelaskan dari kerja nyata. Tidak ada skor gabungan.
-- Staf membaca miliknya sendiri (kpi_saya) beserta rata-rata tim tanpa id atau nama rekan, hanya bila minimal 3 orang punya
-- kerja di ukuran itu. Banding "Ada yang keliru?" menjadi usulan kpi.banding untuk pemilik (tanpa tabel baru), idempoten
-- dengan kunci dari browser (docs/research/idempotensi-aksi.md) karena experimental.useOffline bisa mengirim ulang aksi.
-- Banding hanya untuk pemilik: penilaian kerja adalah keputusan pemilik, dan himpunan {pemilik} tidak diantre ke rute model
-- (app.rute_usulan dan app.antre_rute_model hanya untuk {pemilik, admin}), jadi banding tidak memakai token.

alter table public.usulan add column kunci_klien uuid;
create unique index usulan_kunci_klien_unik on public.usulan (perusahaan_id, kunci_klien) where kunci_klien is not null;

-- KPI semua orang aktif satu usaha untuk minggu p_mulai (beserta minggu sebelumnya sebagai pembanding). Tanpa pemeriksaan hak:
-- hanya dipanggil fungsi security definer di bawah yang sudah memeriksa peran.
create or replace function app.kpi_orang(p_pid uuid, p_mulai date)
returns table (orang_id uuid, nama text, selesai_n integer, poin_selesai numeric, bertenggat integer, tepat integer,
               lintas_poin numeric, kpi jsonb)
language sql stable set search_path = '' as $$
  with w as (
    select p.zona_waktu as zona,
           ((p_mulai - 7)::timestamp at time zone p.zona_waktu) as lalu,
           (p_mulai::timestamp at time zone p.zona_waktu) as mulai,
           ((p_mulai + 7)::timestamp at time zone p.zona_waktu) as akhir
      from public.perusahaan p where p.id = p_pid
  ),
  o as (
    select o.id, o.nama from public.orang o
     where o.perusahaan_id = p_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']
  ),
  k as (
    select k.id, k.judul, k.pelaksana_id, coalesce(k.poin_beban, 0) as poin, k.tenggat, k.selesai_at, k.lintas_topi,
           k.selesai_at >= w.mulai as ini,
           case when k.tenggat is not null and k.selesai_at > k.tenggat
                then ceil(extract(epoch from k.selesai_at - k.tenggat) / 60)::integer end as lewat_menit,
           (k.selesai_at at time zone w.zona)::date as tanggal, b.status as banding
      from public.kerja k cross join w
      left join lateral (
        select u.status from public.usulan u
         where u.perusahaan_id = p_pid and u.aksi = 'kpi.banding' and u.payload ->> 'kerja_id' = k.id::text
         order by u.dibuat_at desc, u.id desc limit 1) b on true
     where k.perusahaan_id = p_pid and k.status = 'selesai' and k.pelaksana_id is not null
       and k.selesai_at >= w.lalu and k.selesai_at < w.akhir
  ),
  g as (
    select o.id, o.nama,
           (count(k.id) filter (where k.ini))::integer as selesai_n,
           coalesce(sum(k.poin) filter (where k.ini), 0) as poin,
           (count(k.id) filter (where k.ini and k.tenggat is not null))::integer as bertenggat,
           (count(k.id) filter (where k.ini and k.tenggat is not null and k.lewat_menit is null))::integer as tepat,
           coalesce(sum(k.poin) filter (where k.ini and k.lintas_topi), 0) as lintas_poin,
           (count(k.id) filter (where k.ini and k.lintas_topi))::integer as lintas_n,
           coalesce(jsonb_agg(k.id order by k.selesai_at, k.id) filter (where k.ini), '[]') as ids_selesai,
           coalesce(jsonb_agg(k.id order by k.selesai_at, k.id) filter (where k.ini and k.tenggat is not null), '[]') as ids_tenggat,
           coalesce(jsonb_agg(k.id order by k.selesai_at, k.id) filter (where k.ini and k.lintas_topi), '[]') as ids_lintas,
           coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'judul', k.judul, 'lewat_menit', k.lewat_menit, 'tanggal', k.tanggal)
                    order by k.selesai_at, k.id) filter (where k.ini and k.lewat_menit is not null), '[]') as lewat,
           coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'judul', k.judul, 'poin', k.poin, 'tanggal', k.tanggal,
                    'selesai_at', k.selesai_at, 'tenggat', k.tenggat, 'lewat_menit', k.lewat_menit, 'lintas_topi', k.lintas_topi,
                    'banding', k.banding) order by k.selesai_at, k.id) filter (where k.ini), '[]') as rincian,
           (count(k.id) filter (where not k.ini))::integer as lalu_n,
           coalesce(sum(k.poin) filter (where not k.ini), 0) as lalu_poin,
           (count(k.id) filter (where not k.ini and k.tenggat is not null))::integer as lalu_bertenggat,
           (count(k.id) filter (where not k.ini and k.tenggat is not null and k.lewat_menit is null))::integer as lalu_tepat,
           coalesce(sum(k.poin) filter (where not k.ini and k.lintas_topi), 0) as lalu_lintas
      from o left join k on k.pelaksana_id = o.id
     group by o.id, o.nama
  )
  select g.id, g.nama, g.selesai_n, g.poin, g.bertenggat, g.tepat, g.lintas_poin,
    jsonb_build_object(
      'poin_selesai', jsonb_build_object('nilai', g.poin, 'kerja', g.selesai_n, 'ids', g.ids_selesai,
        'kosong', case when g.selesai_n = 0 then 'Belum ada kerja selesai minggu ini.' end),
      'tepat', jsonb_build_object('nilai', g.tepat, 'dari', g.bertenggat, 'ids', g.ids_tenggat, 'lewat', g.lewat,
        'kosong', case when g.bertenggat = 0 then 'Belum ada kerja bertenggat yang selesai minggu ini.' end),
      'lintas', jsonb_build_object('nilai', g.lintas_poin, 'kerja', g.lintas_n, 'ids', g.ids_lintas,
        'kosong', case when g.lintas_n = 0 then 'Belum ada kerja lintas topi minggu ini.' end),
      'hadir', jsonb_build_object('nilai', null, 'alasan', 'Hadir sesuai jadwal muncul setelah jadwal shift diisi.'),
      'minggu_lalu', jsonb_build_object('poin_selesai', g.lalu_poin, 'kerja', g.lalu_n, 'tepat', g.lalu_tepat,
        'bertenggat', g.lalu_bertenggat, 'lintas_poin', g.lalu_lintas),
      'rincian', g.rincian)
    from g
$$;

-- Rata-rata tim per ukuran, hanya bila minimal 3 orang punya kerja di ukuran itu (ambang sama dengan beban_saya; dengan 2 orang
-- rata-rata membuka angka rekan). Tepat tenggat tim = jumlah tepat / jumlah bertenggat, bukan rata-rata persen per orang.
create or replace function app.kpi_rata(p_n integer, p_poin numeric, p_lintas numeric, p_n_tenggat integer, p_tepat bigint, p_bertenggat bigint)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p_n >= 3 then jsonb_build_object('n', p_n,
    'poin_selesai', round(p_poin / p_n, 1), 'lintas_poin', round(p_lintas / p_n, 1),
    'tepat_persen', case when p_n_tenggat >= 3 and p_bertenggat > 0 then round(100.0 * p_tepat / p_bertenggat) end) end
$$;

-- Siapa pun anggota aktif: KPI miliknya sendiri (orang yang terhubung ke akunnya) dan rata-rata tim tanpa id atau nama rekan.
create or replace function public.kpi_saya(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); v_mulai date; v_kpi jsonb; v_tim jsonb; v_zona text;
begin
  if v_pid is null or not app.anggota_aktif() then
    raise exception 'Masuk ke usahamu dulu.' using errcode = '42501';
  end if;
  v_mulai := app.awal_minggu(v_pid, p_mulai);
  select zona_waktu into v_zona from public.perusahaan where id = v_pid;
  select (array_agg(jsonb_build_object('id', k.orang_id, 'nama', k.nama) || k.kpi) filter (where k.orang_id = v_saya))[1],
         app.kpi_rata((count(*) filter (where k.selesai_n > 0))::integer, coalesce(sum(k.poin_selesai), 0),
                      coalesce(sum(k.lintas_poin), 0), (count(*) filter (where k.bertenggat > 0))::integer,
                      coalesce(sum(k.tepat), 0), coalesce(sum(k.bertenggat), 0))
    into v_kpi, v_tim
    from app.kpi_orang(v_pid, v_mulai) k;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'zona', v_zona, 'orang', v_kpi, 'rata_rata_tim', v_tim);
end $$;

-- Pemilik/admin (dan akuntan, baca): KPI semua orang aktif untuk tabel buku kas, urut nama (bukan peringkat).
create or replace function public.kpi_minggu(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_mulai date; v_orang jsonb; v_tim jsonb; v_selesai integer; v_zona text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin', 'akuntan']) then
    raise exception 'Hanya pemilik, admin, atau akuntan yang bisa melihat kinerja semua orang.' using errcode = '42501';
  end if;
  v_mulai := app.awal_minggu(v_pid, p_mulai);
  select zona_waktu into v_zona from public.perusahaan where id = v_pid;
  select coalesce(jsonb_agg(jsonb_build_object('id', k.orang_id, 'nama', k.nama) || k.kpi order by k.nama, k.orang_id), '[]'),
         app.kpi_rata((count(*) filter (where k.selesai_n > 0))::integer, coalesce(sum(k.poin_selesai), 0),
                      coalesce(sum(k.lintas_poin), 0), (count(*) filter (where k.bertenggat > 0))::integer,
                      coalesce(sum(k.tepat), 0), coalesce(sum(k.bertenggat), 0)),
         coalesce(sum(k.selesai_n), 0)::integer
    into v_orang, v_tim, v_selesai
    from app.kpi_orang(v_pid, v_mulai) k;
  return jsonb_build_object('mulai', v_mulai, 'akhir', v_mulai + 6, 'zona', v_zona, 'selesai_n', v_selesai,
    'orang', v_orang, 'rata_rata_tim', v_tim);
end $$;

-- Staf menandai kerjanya sendiri yang keliru dihitung. Kunci yang sama atau banding yang masih menunggu untuk kerja yang sama
-- mengembalikan usulan yang sudah ada ('sudah': true), bukan usulan kembar.
create or replace function public.banding_kpi(p_kerja uuid, p_alasan text, p_kunci uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_saya uuid := app.orang_saya(); v_alasan text := btrim(regexp_replace(coalesce(p_alasan, ''), '\s+', ' ', 'g'));
  v_nama text; k public.kerja; u public.usulan;
begin
  if v_pid is null or not app.anggota_aktif() then
    raise exception 'Masuk ke usahamu dulu.' using errcode = '42501';
  end if;
  if v_saya is null then
    raise exception 'Akunmu belum terhubung ke data orang di usaha ini. Minta pemilik menghubungkannya.' using errcode = '42501';
  end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid and pelaksana_id = v_saya;
  if k.id is null then
    raise exception 'Kerja itu tidak ada di daftar kerjamu.' using errcode = 'P0002';
  end if;
  if p_kunci is not null then
    select * into u from public.usulan
     where perusahaan_id = v_pid and kunci_klien = p_kunci and aksi = 'kpi.banding' and payload ->> 'kerja_id' = k.id::text;
    if u.id is not null then return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', true); end if;
  end if;
  if k.status <> 'selesai' then
    raise exception 'Hanya kerja selesai yang dihitung di kinerjamu.' using errcode = '22023';
  end if;
  if char_length(v_alasan) not between 3 and 500 then
    raise exception 'Tulis alasannya 3 sampai 500 huruf, misalnya Tenggatnya diundur pemilik hari Senin.' using errcode = '22023';
  end if;
  select * into u from public.usulan
   where perusahaan_id = v_pid and aksi = 'kpi.banding' and status = 'menunggu' and payload ->> 'kerja_id' = k.id::text
   order by dibuat_at desc limit 1;
  if u.id is not null then return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', true); end if;
  select nama into v_nama from public.orang where id = v_saya;
  begin
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
    values (v_pid, 'staf', 'kpi.banding', format('Tinjau hitungan kerja %s: %s', v_nama, k.judul),
            format('%s menandai kerja ini keliru dihitung di Kerjamu minggu ini. Alasannya: "%s". Setujui bila tandanya benar: '
                   'tercatat di kerja itu dan tampil di cermin %s. Angka tidak berubah otomatis.', v_nama, v_alasan, v_nama),
            jsonb_build_object('kerja_id', k.id, 'alasan', v_alasan), array['pemilik'], p_kunci)
    returning * into u;
  exception when unique_violation then
    -- Dua kiriman berkunci sama bersamaan: yang kalah mengembalikan usulan milik yang menang.
    select * into u from public.usulan where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if u.aksi is distinct from 'kpi.banding' or u.payload ->> 'kerja_id' is distinct from k.id::text then
      raise exception 'Kiriman ini bentrok dengan kiriman lain. Muat ulang halaman, lalu tandai lagi.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', true);
  end;
  return jsonb_build_object('id', u.id, 'status', u.status, 'sudah', false);
end $$;

-- putuskan_usulan: cabang kpi.banding. Tanpa cabang ini usulan jatuh ke cabang umum yang menyalin payload->'bidang' (tidak ada
-- pada banding) ke kejadian.data yang wajib terisi. Disetujui = keberatan staf diakui dan dicatat sebagai kejadian pada kerja itu;
-- angka KPI tidak diubah. Selebihnya sama persis dengan versi izin_otopilot.
create or replace function public.putuskan_usulan(p_usulan uuid, p_setuju boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usulan; iz public.pengajuan_izin; b jsonb; r jsonb; v_pid uuid := app.pid(); v_orang uuid; v_jalur text; n int := 0; lewat int := 0; v_nik text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa memutuskan usulan' using errcode = '42501';
  end if;
  select * into u from public.usulan where id = p_usulan and perusahaan_id = v_pid for update;
  if not found or not (app.prn() = any(u.untuk_peran)) then
    raise exception 'Usulan tidak ditemukan' using errcode = 'P0002';
  end if;
  if u.status <> 'menunggu' then
    return jsonb_build_object('status', u.status, 'dibuat', 0, 'sudah', true);
  end if;
  b := u.payload -> 'bidang';
  select jalur into v_jalur from public.berkas where id = u.berkas_id;
  v_nik := b ->> 'nik';

  if p_setuju then
    case u.aksi
      when 'orang.buat' then
        insert into public.orang (perusahaan_id, nama, data)
        values (v_pid, initcap(lower(b ->> 'nama')), jsonb_strip_nulls(jsonb_build_object(
          'tanggal_lahir', nullif(b ->> 'tanggal_lahir', ''), 'jenis_kelamin', nullif(b ->> 'jenis_kelamin', ''), 'sumber', case u.sumber when 'lempar' then 'ktp' else u.sumber end)))
        returning id into v_orang;
        perform app.pasang_topi_dari_jabatan(v_pid, v_orang, b ->> 'jabatan');
        if coalesce(v_nik, '') <> '' then
          insert into public.orang_rahasia (orang_id, perusahaan_id, nik_hash, nik_akhir)
          values (v_orang, v_pid, encode(extensions.digest(v_nik || v_pid::text, 'sha256'), 'hex'), right(v_nik, 4));
        end if;
        n := 1;
      when 'orang.impor' then
        for r in select * from jsonb_array_elements(coalesce(b -> 'baris', '[]')) loop
          if coalesce(r ->> 'nama', '') = '' then
            lewat := lewat + 1;
            continue;
          end if;
          select id into v_orang from public.orang where perusahaan_id = v_pid and lower(nama) = lower(r ->> 'nama') limit 1;
          if v_orang is not null then
            -- Sudah ada: tidak digandakan, tapi diberi topi dari jabatannya bila belum punya.
            if not exists (select 1 from public.pakai_topi where orang_id = v_orang) then
              perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan');
            end if;
            lewat := lewat + 1;
            continue;
          end if;
          insert into public.orang (perusahaan_id, nama, telepon, data)
          values (v_pid, r ->> 'nama', nullif(r ->> 'telepon', ''), jsonb_strip_nulls(jsonb_build_object(
            'kode', nullif(r ->> 'id', ''), 'jabatan', nullif(r ->> 'jabatan', ''), 'mulai', nullif(r ->> 'mulai', ''), 'sumber', 'excel')))
          returning id into v_orang;
          perform app.pasang_topi_dari_jabatan(v_pid, v_orang, r ->> 'jabatan', (app.tanggal_aman(r ->> 'mulai') at time zone 'Asia/Makassar')::date);
          if coalesce((r ->> 'gaji_pokok')::numeric, 0) > 0 then
            insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (v_orang, v_pid, jsonb_build_object('pokok', (r ->> 'gaji_pokok')::numeric));
          end if;
          n := n + 1;
        end loop;
      when 'rekrut.pelamar' then
        insert into public.orang (perusahaan_id, nama, jenis, status, data)
        values (v_pid, b ->> 'nama', '{kandidat}', 'kandidat_baru', jsonb_build_object(
          'posisi', b ->> 'posisi', 'pengalaman', coalesce(b -> 'pengalaman', '[]'), 'keahlian', coalesce(b -> 'keahlian', '[]'), 'sumber', 'cv'));
        n := 1;
      when 'absen.impor' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, keyakinan, bukti, data)
        select v_pid, coalesce(app.tanggal_aman(x ->> 'tanggal', x ->> 'masuk'), now()), 'absen.harian', u.sumber,
               (select o.id from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(x ->> 'nama') limit 1),
               u.keyakinan, v_jalur, x
          from jsonb_array_elements(coalesce(b -> 'baris', '[]')) x;
        get diagnostics n = row_count;
      when 'uang.mutasi' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, keyakinan, bukti, data)
        select v_pid, coalesce(app.tanggal_aman(x ->> 'tanggal'), now()),
               case when x ->> 'arah' = 'CR' then 'bank.masuk' else 'bank.keluar' end, u.sumber,
               (x ->> 'jumlah')::numeric, u.keyakinan, v_jalur, x
          from jsonb_array_elements(coalesce(b -> 'baris', '[]')) x;
        get diagnostics n = row_count;
      when 'izin.setujui' then
        -- Pengajuan izin yang tidak lolos otopilot: disetujui manusia, dicatat sebagai kejadian izin.<jenis>.
        update public.pengajuan_izin set status = 'disetujui', oleh_otopilot = false, diputuskan_at = now(),
               alasan_putusan = 'Disetujui ' || case app.prn() when 'pemilik' then 'pemilik' else 'admin' end || '.'
         where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu'
        returning * into iz;
        if iz.id is not null then
          perform app.catat_izin(iz);
          n := 1;
        end if;
      when 'izin.sakit' then
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(b ->> 'mulai'), now()), 'izin.sakit', u.sumber,
                (select o.id from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(b ->> 'nama') limit 1),
                (b ->> 'lama_hari')::numeric, u.keyakinan, v_jalur, b);
        n := 1;
      when 'kpi.banding' then
        insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
        select v_pid, 'kpi.banding', 'pwa', k.pelaksana_id, k.id, jsonb_build_object('usulan_id', u.id, 'alasan', u.payload ->> 'alasan')
          from public.kerja k where k.perusahaan_id = v_pid and k.id::text = u.payload ->> 'kerja_id';
        get diagnostics n = row_count;
      else
        -- uang.keluar, uang.tagihan, dokumen.*, berkas.tinjau: satu kejadian dengan bukti berkas.
        insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, keyakinan, bukti, data)
        values (v_pid, coalesce(app.tanggal_aman(coalesce(b ->> 'tanggal', b ->> 'periode' || '-01')), now()), u.aksi, u.sumber,
                u.dampak_rp, u.keyakinan, v_jalur, b);
        n := 1;
    end case;
  end if;

  if not p_setuju and u.aksi = 'izin.setujui' then
    update public.pengajuan_izin set status = 'ditolak', oleh_otopilot = false, diputuskan_at = now(),
           alasan_putusan = 'Belum disetujui. Bicarakan langsung dengan pemilik atau admin, atau ajukan ulang dengan tanggal lain.'
     where id = (u.payload ->> 'pengajuan_id')::uuid and perusahaan_id = v_pid and status = 'menunggu';
  end if;

  update public.usulan
     set status = case when p_setuju then 'diterima' else 'ditolak' end, diputuskan_oleh = auth.uid(), diputuskan_at = now(),
         payload = case when v_nik is null then payload else jsonb_set(payload, '{bidang,nik}', to_jsonb('****' || right(v_nik, 4))) end
   where id = u.id;
  update public.berkas
     set status = 'selesai', diubah_at = now(),
         hasil = case when v_nik is null or hasil is null then hasil else jsonb_set(hasil, '{bidang,nik}', to_jsonb('****' || right(v_nik, 4))) end
   where id = u.berkas_id;
  return jsonb_build_object('status', case when p_setuju then 'diterima' else 'ditolak' end, 'aksi', u.aksi, 'dibuat', n, 'dilewati', lewat);
end $$;

revoke all on function app.kpi_orang(uuid, date), app.kpi_rata(integer, numeric, numeric, integer, bigint, bigint) from public, anon, authenticated;
revoke all on function public.kpi_saya(date), public.kpi_minggu(date), public.banding_kpi(uuid, text, uuid) from public, anon;
grant execute on function public.kpi_saya(date), public.kpi_minggu(date), public.banding_kpi(uuid, text, uuid) to authenticated;
