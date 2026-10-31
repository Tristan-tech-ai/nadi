-- Q-16 (docs/research/idempotensi-aksi.md, docs/quality/review-f3-01.md): experimental.useOffline mengulang Server Action yang
-- jawabannya hilang saat sinyal putus. Lowongan dan rencana magang baru membawa kunci dari browser (uuid, unik per usaha);
-- kiriman ulang berkunci sama tidak membuat baris kembar. Kunci null (pemanggil lama, impor) tetap boleh berulang karena NULL
-- tidak dianggap sama oleh constraint unik.

alter table public.lowongan add column kunci_klien uuid;
alter table public.lowongan add constraint lowongan_kunci_klien_unik unique (perusahaan_id, kunci_klien);
alter table public.rencana_magang add column kunci_klien uuid;
alter table public.rencana_magang add constraint rencana_magang_kunci_klien_unik unique (perusahaan_id, kunci_klien);

drop function public.simpan_rencana_magang(uuid, uuid, uuid, uuid, date, date, jsonb, text, jsonb, text, text, integer);
create function public.simpan_rencana_magang(
  p_id uuid, p_orang uuid, p_mentor uuid, p_topi uuid, p_mulai date, p_selesai date, p_uang_saku jsonb, p_tujuan text,
  p_minggu jsonb, p_uji_akhir text, p_status text default 'rencana', p_nilai_akhir integer default null, p_kunci uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_id uuid; v_topi_mentor uuid; v_saku jsonb := coalesce(p_uang_saku, '{}'::jsonb);
  v_minggu jsonb := coalesce(p_minggu, '[]'::jsonb); v_tujuan text := btrim(coalesce(p_tujuan, ''));
  v_uji text := nullif(btrim(coalesce(p_uji_akhir, '')), ''); v_status text := coalesce(p_status, 'rencana');
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa menulis rencana magang.' using errcode = '42501';
  end if;
  if p_id is null and p_kunci is not null then
    select id into v_id from public.rencana_magang where perusahaan_id = v_pid and kunci_klien = p_kunci;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'peringatan', app.peringatan_rencana(v_id), 'sudah', true);
    end if;
  end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then
    raise exception 'Peserta tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mentor is null or not exists (select 1 from public.orang where id = p_mentor and perusahaan_id = v_pid) then
    raise exception 'Mentor tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mentor = p_orang then raise exception 'Mentor dan peserta harus orang yang berbeda.' using errcode = '22023'; end if;
  if p_topi is not null and not exists (select 1 from public.topi where id = p_topi and perusahaan_id = v_pid) then
    raise exception 'Topi tujuan tidak ditemukan di usahamu.' using errcode = 'P0002';
  end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai then
    raise exception 'Isi tanggal mulai dan selesai; tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = '22023';
  end if;
  if char_length(v_tujuan) not between 3 and 500 then
    raise exception 'Tulis tujuan magang 3 sampai 500 huruf.' using errcode = '22023';
  end if;
  if char_length(v_uji) > 500 then raise exception 'Uji akhir paling panjang 500 huruf.' using errcode = '22023'; end if;
  if v_status not in ('rencana', 'jalan', 'selesai', 'batal') then raise exception 'Status rencana tidak dikenal.' using errcode = '22023'; end if;
  if p_nilai_akhir is not null and p_nilai_akhir not between 0 and 100 then
    raise exception 'Nilai akhir 0 sampai 100.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_saku) <> 'object' or exists (
       select 1 from jsonb_each(v_saku) e
        where e.key not in ('transport', 'makan', 'insentif')
           or (jsonb_typeof(e.value) <> 'null' and (jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[0-9]{1,10}$'))) then
    raise exception 'Uang saku diisi rupiah bulat (transport, makan, insentif), boleh kosong.' using errcode = '22023';
  end if;
  v_saku := jsonb_build_object('transport', coalesce((v_saku ->> 'transport')::bigint, 0), 'makan', coalesce((v_saku ->> 'makan')::bigint, 0),
                               'insentif', coalesce((v_saku ->> 'insentif')::bigint, 0));
  if jsonb_typeof(v_minggu) <> 'array' or jsonb_array_length(v_minggu) > 52 then
    raise exception 'Rencana mingguan paling banyak 52 baris.' using errcode = '22023';
  end if;
  if exists (
       select 1 from jsonb_array_elements(v_minggu) e
        where coalesce(jsonb_typeof(e), '') <> 'object'
           or coalesce(jsonb_typeof(e -> 'minggu'), '') <> 'number' or coalesce(e ->> 'minggu', '') !~ '^[1-9][0-9]{0,2}$'
           or coalesce(jsonb_typeof(e -> 'keahlian'), '') <> 'string' or char_length(btrim(e ->> 'keahlian')) not between 1 and 120
           or coalesce(jsonb_typeof(e -> 'target'), 'null') not in ('string', 'null') or char_length(coalesce(e ->> 'target', '')) > 300) then
    raise exception 'Setiap baris mingguan butuh nomor minggu dan keahlian (paling panjang 120 huruf); target paling panjang 300 huruf.'
      using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('minggu', (e ->> 'minggu')::integer, 'keahlian', btrim(e ->> 'keahlian'),
                                               'target', nullif(btrim(coalesce(e ->> 'target', '')), '')) order by i), '[]'::jsonb)
    into v_minggu from jsonb_array_elements(v_minggu) with ordinality as x(e, i);

  if p_id is null then
    begin
      insert into public.rencana_magang (perusahaan_id, orang_id, mentor_id, topi_id, mulai, selesai, uang_saku, tujuan, minggu, uji_akhir, status, nilai_akhir, kunci_klien)
      values (v_pid, p_orang, p_mentor, p_topi, p_mulai, p_selesai, v_saku, v_tujuan, v_minggu, v_uji, v_status, p_nilai_akhir, p_kunci)
      returning id into v_id;
    exception when unique_violation then
      -- Dua kiriman berkunci sama bersamaan: yang kalah mengembalikan rencana milik yang menang.
      select id into v_id from public.rencana_magang where perusahaan_id = v_pid and kunci_klien = p_kunci;
      return jsonb_build_object('id', v_id, 'peringatan', app.peringatan_rencana(v_id), 'sudah', true);
    end;
  else
    update public.rencana_magang
       set orang_id = p_orang, mentor_id = p_mentor, topi_id = p_topi, mulai = p_mulai, selesai = p_selesai, uang_saku = v_saku,
           tujuan = v_tujuan, minggu = v_minggu, uji_akhir = v_uji, status = v_status, nilai_akhir = p_nilai_akhir
     where id = p_id and perusahaan_id = v_pid
    returning id into v_id;
    if v_id is null then raise exception 'Rencana magang tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  end if;

  insert into public.topi (perusahaan_id, kode, nama, deskripsi, tanggung_jawab)
  values (v_pid, 'mentor', 'Mentor', 'Membimbing peserta magang sesuai rencana tertulis. Dibuat otomatis oleh Jalur Magang.',
          '[{"tugas": "Membimbing peserta magang sesuai rencana mingguan", "raci": "R"}, {"tugas": "Menilai uji akhir magang", "raci": "R"}]'::jsonb)
  on conflict (perusahaan_id, kode) do update set aktif = true
  returning id into v_topi_mentor;
  if not exists (select 1 from public.pakai_topi where orang_id = p_mentor and topi_id = v_topi_mentor and (selesai is null or selesai >= current_date)) then
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai) values (v_pid, p_mentor, v_topi_mentor, 10, current_date);
  end if;
  if p_topi is not null and v_status in ('rencana', 'jalan')
     and not exists (select 1 from public.pakai_topi where orang_id = p_orang and topi_id = p_topi and (selesai is null or selesai >= current_date)) then
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, porsi, mulai, selesai) values (v_pid, p_orang, p_topi, 100, p_mulai, p_selesai);
  end if;
  update public.orang set jenis = jenis || array['magang'] where id = p_orang and not ('magang' = any (jenis));
  return jsonb_build_object('id', v_id, 'peringatan', app.peringatan_rencana(v_id), 'sudah', false);
end $$;

revoke all on function public.simpan_rencana_magang(uuid, uuid, uuid, uuid, date, date, jsonb, text, jsonb, text, text, integer, uuid) from public, anon;
grant execute on function public.simpan_rencana_magang(uuid, uuid, uuid, uuid, date, date, jsonb, text, jsonb, text, text, integer, uuid) to authenticated;
