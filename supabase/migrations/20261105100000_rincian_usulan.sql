-- U-13 rincian usulan: sebelum disetujui, pemilik/admin bisa melihat apa yang akan DITAMBAH, DIUBAH (sebelum -> sesudah dari data
-- sekarang), dan DILEWATI karena sudah ada. Baca saja; aturan "sudah ada" sama dengan pemicu (nama orang tanpa beda huruf besar,
-- kode produk). Nomor panjang (NIK) disamarkan seperti di payload. Hanya pengelola usaha yang sama.

create or replace function public.preview_proposal(p_usulan uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); u record; b jsonb; sebelum jsonb := '{}'::jsonb; lewati jsonb := '[]'::jsonb; nama jsonb := '{}'::jsonb;
begin
  select * into u from public.usulan where id = p_usulan and perusahaan_id = v_pid;
  if u.id is null then raise exception 'Usulan tidak ditemukan' using errcode = 'P0002'; end if;
  b := coalesce(u.payload -> 'bidang', u.payload);
  if u.aksi = 'onboarding.izin' then
    select jsonb_build_object('jenis', k.jenis, 'otomatis', k.otomatis, 'maks_hari', k.maks_hari_otomatis, 'butuh_bukti', k.butuh_bukti, 'jatah_tahunan', k.jatah_tahunan)
      into sebelum from public.kebijakan_izin k where k.perusahaan_id = v_pid and k.jenis = b ->> 'jenis';
  elsif u.aksi = 'onboarding.usaha' then
    select jsonb_build_object('skala', p.skala, 'cabang', p.cabang, 'kota', p.kota, 'negara', p.negara) into sebelum from public.perusahaan p where p.id = v_pid;
  elsif u.aksi in ('orang.impor', 'orang.buat') then
    select coalesce(jsonb_agg(distinct x.n), '[]'::jsonb) into lewati
      from (select coalesce(r ->> 'nama', '') n from jsonb_array_elements(case when jsonb_typeof(b -> 'baris') = 'array' then b -> 'baris' else jsonb_build_array(b) end) r) x
     where exists (select 1 from public.orang o where o.perusahaan_id = v_pid and lower(o.nama) = lower(x.n));
  elsif u.aksi in ('pindah.produk', 'produk.impor') then
    select coalesce(jsonb_agg(distinct r ->> 'kode'), '[]'::jsonb) into lewati
      from jsonb_array_elements(coalesce(u.payload -> 'baris', b -> 'baris', '[]'::jsonb)) r
     where exists (select 1 from public.produk p where p.perusahaan_id = v_pid and p.kode = r ->> 'kode');
  elsif u.aksi = 'stok.opname' then
    select coalesce(jsonb_object_agg(r ->> 'kode', coalesce((select sum(s.jumlah) from public.stok s join public.produk p on p.id = s.produk_id
             where p.perusahaan_id = v_pid and p.kode = r ->> 'kode' and (b ->> 'gudang_id' is null or s.gudang_id::text = b ->> 'gudang_id')), 0)), '{}'::jsonb)
      into sebelum from jsonb_array_elements(coalesce(b -> 'baris', '[]'::jsonb)) r;
  elsif u.aksi = 'orang.topi' then
    select jsonb_build_object('topi', coalesce(string_agg(t.nama || ' ' || pt.porsi || '%', ', '), '-')) into sebelum
      from public.pakai_topi pt join public.topi t on t.id = pt.topi_id
     where pt.orang_id = (u.payload ->> 'orang_id')::uuid and pt.perusahaan_id = v_pid and (pt.selesai is null or pt.selesai >= current_date);
    nama := jsonb_build_object('topi_baru', (select t.nama from public.topi t where t.id = (u.payload ->> 'topi_id')::uuid and t.perusahaan_id = v_pid));
  elsif u.aksi = 'kpi.banding' then
    nama := jsonb_build_object('kerja', (select k.judul from public.kerja k where k.id = (u.payload ->> 'kerja_id')::uuid and k.perusahaan_id = v_pid));
  end if;
  -- Nama orang untuk id yang ada di payload (izin, klaim, topi, tukar shift).
  nama := nama || coalesce((select jsonb_object_agg(o.id::text, o.nama) from public.orang o
    where o.perusahaan_id = v_pid and o.id::text in (u.payload ->> 'orang_id', u.payload ->> 'dari', u.payload ->> 'ke', b ->> 'orang_id')), '{}'::jsonb);
  return jsonb_build_object('aksi', u.aksi, 'status', u.status, 'bidang', b, 'baris', u.payload -> 'baris', 'atas', u.payload - 'bidang' - 'dari' - 'baris',
    'sebelum', sebelum, 'lewati', lewati, 'nama', nama);
end $$;
revoke all on function public.preview_proposal(uuid) from public, anon;
grant execute on function public.preview_proposal(uuid) to authenticated;
