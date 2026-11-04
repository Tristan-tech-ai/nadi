-- W-04 perbaikan: pemeriksaan kunci uang/NIK hanya untuk KUNCI JSON ("gaji": ...), bukan nilai. Sebelumnya nilai "gaji"
-- di daftar fitur (FITUR: Gaji) ikut tertolak (tes onboarding_ai merah di butir fitur).
create or replace function app.sisip_onboarding(p_pid uuid, p_butir jsonb, p_sumber text, p_kunci text, p_dari jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e jsonb; b jsonb; i int := 0; v_baru int := 0; v_aksi text; v_peran text[]; v_id uuid;
begin
  if jsonb_typeof(p_butir) <> 'array' or jsonb_array_length(p_butir) not between 1 and 80 then
    raise exception 'Kirim 1 sampai 80 butir cetak biru' using errcode = '22023';
  end if;
  if (select count(*) from public.usulan u where u.perusahaan_id = p_pid and u.sumber in ('ai_milikmu', 'mcp') and u.dibuat_at > now() - interval '1 day')
     + jsonb_array_length(p_butir) > 300 then
    raise exception 'Batas 300 usulan per hari dari AI milikmu tercapai' using errcode = 'P0429';
  end if;
  for e in select * from jsonb_array_elements(p_butir) loop
    i := i + 1;
    v_aksi := e ->> 'aksi';
    b := e -> 'bidang';
    if v_aksi is null or v_aksi not in ('orang.impor', 'onboarding.usaha', 'onboarding.fitur', 'onboarding.izin') then
      raise exception 'Butir %: aksi tidak diizinkan', i using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(e ->> 'judul', ''))) not between 3 and 140 then raise exception 'Butir %: judul 3 sampai 140 huruf', i using errcode = '22023'; end if;
    if b is null or jsonb_typeof(b) <> 'object' or octet_length(b::text) > 4000 then raise exception 'Butir %: bidang wajib objek kecil', i using errcode = '22023'; end if;
    if b::text ~ '\d{12,}' or b::text ~* '"(nik|gaji|gaji_pokok|upah|rekening|nominal)"\s*:' or e::text ~ '\d{12,}' then
      raise exception 'Butir %: NIK, nomor panjang, atau angka uang tidak diterima dari AI', i using errcode = '22023';
    end if;
    v_peran := '{pemilik,admin}';
    if v_aksi = 'orang.impor' then
      if jsonb_typeof(b -> 'baris') <> 'array' or jsonb_array_length(b -> 'baris') <> 1 or coalesce(b #>> '{baris,0,nama}', '') !~ '^[[:alpha:]][[:alpha:] .''-]{1,79}$' then
        raise exception 'Butir %: satu orang dengan nama huruf', i using errcode = '22023';
      end if;
      if coalesce(b #>> '{baris,0,mulai}', '') <> '' and (b #>> '{baris,0,mulai}') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Butir %: tanggal mulai YYYY-MM-DD', i using errcode = '22023';
      end if;
      b := jsonb_build_object('baris', jsonb_build_array(jsonb_build_object('id', '', 'nama', b #>> '{baris,0,nama}', 'jabatan', left(coalesce(b #>> '{baris,0,jabatan}', ''), 200),
             'telepon', '', 'mulai', coalesce(b #>> '{baris,0,mulai}', ''))));
    elsif v_aksi = 'onboarding.usaha' then
      if not exists (select 1 from public.negara n where n.kode = b ->> 'negara') then raise exception 'Butir %: negara belum ada di daftar Nadi', i using errcode = '22023'; end if;
      if b ->> 'skala' is not null and b ->> 'skala' not in ('1', '2-5', '6-15', '16-50', '50+') then raise exception 'Butir %: skala tidak dikenal', i using errcode = '22023'; end if;
      if b ->> 'cabang' is not null and (b ->> 'cabang') !~ '^\d{1,3}$' then raise exception 'Butir %: cabang angka 1 sampai 500', i using errcode = '22023'; end if;
      b := jsonb_build_object('negara', b ->> 'negara', 'kota', left(b ->> 'kota', 80), 'skala', b ->> 'skala', 'cabang', (b ->> 'cabang')::int, 'jenis', left(b ->> 'jenis', 80));
      v_peran := '{pemilik}';
    elsif v_aksi = 'onboarding.fitur' then
      if jsonb_typeof(b -> 'fitur') <> 'array' or jsonb_array_length(b -> 'fitur') not between 1 and 25
         or exists (select 1 from jsonb_array_elements_text(b -> 'fitur') f where f not in ('lempar', 'feed', 'absen', 'izin', 'gaji', 'jadwal', 'kerja', 'invoice', 'jual',
           'beli', 'barang', 'kas', 'buku', 'pajak', 'surat', 'mata', 'peta', 'rekrut', 'magang')) then
        raise exception 'Butir %: fitur tidak dikenal', i using errcode = '22023';
      end if;
      b := jsonb_build_object('fitur', b -> 'fitur');
    else
      if b ->> 'jenis' not in ('sakit', 'izin', 'cuti') or coalesce((b ->> 'maks_hari')::int, -1) not between 0 and 30
         or (b ->> 'jatah_tahunan' is not null and (b ->> 'jatah_tahunan')::int not between 0 and 60) then
        raise exception 'Butir %: aturan izin di luar batas', i using errcode = '22023';
      end if;
      b := jsonb_build_object('jenis', b ->> 'jenis', 'otomatis', coalesce((b ->> 'otomatis')::boolean, false), 'maks_hari', (b ->> 'maks_hari')::int,
             'butuh_bukti', coalesce((b ->> 'butuh_bukti')::boolean, false), 'jatah_tahunan', (b ->> 'jatah_tahunan')::int);
    end if;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
    values (p_pid, p_sumber, v_aksi, btrim(e ->> 'judul'),
            'Dari AI milikmu (cetak biru onboarding). Periksa dulu; Nadi tidak mencatat apa pun sebelum kamu setujui.',
            jsonb_build_object('jenis', 'onboarding', 'bidang', b, 'dari', p_dari), v_peran, md5(p_kunci || ':' || i)::uuid)
    on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing
    returning id into v_id;
    if v_id is not null then v_baru := v_baru + 1; end if;
    v_id := null;
  end loop;
  return jsonb_build_object('dibuat', v_baru, 'sudah', i - v_baru);
end $$;
