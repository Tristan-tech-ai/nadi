-- F3-07E (docs/research/serah-terima-sql.md, docs/research/upah-harian.md): hak keuangan orang yang berhenti sebagai usulan Feed.
-- hak_berhenti(berhenti) memberi bahan hitungan kepada pemilik (gaji rahasia, pola kerja, pembagi upah sehari, jatah dan cuti
-- terpakai, uang pisah); hitungan gaji prorata dilakukan aplikasi lewat susunSlip (apps/web/src/lib/serah/hak.ts).
-- ajukan_hak_berhenti(berhenti, rincian) menyimpan uang pisah isian pemilik dan membuat (atau memperbarui selama masih menunggu)
-- satu usulan uang.hak_berhenti untuk_peran {pemilik}. Tidak ada pembayaran otomatis: menyetujui hanya mencatat kejadian
-- uang.hak_berhenti (cabang umum putuskan_usulan). Mengundurkan diri tidak mendapat pesangon (PP 35/2021 Pasal 50).
-- Tes: supabase/tests/hak_berhenti.test.sql.

insert into public.aturan_bertanggal (kunci, nilai, berlaku_dari, sumber, terverifikasi, catatan)
select 'upah.pembagi_harian', '{"pola_6_hari": 25, "pola_5_hari": 21}'::jsonb, '2021-02-02'::date,
       'PP 36/2021 Pasal 17 (peraturan.go.id/files3/pp-no-36-tahun-2021_asli.pdf); tidak diubah PP 51/2023 dan PP 49/2025; dibaca 1 Nov 2026', true,
       'Rumus upah sehari bila upah ditetapkan harian; Nadi memakainya sebagai saran nilai sisa cuti karena aturan penggantian cuti (PP 35/2021 Pasal 40 ayat (4) huruf a) tidak menyebut pembagi'
 where not exists (select 1 from public.aturan_bertanggal where kunci = 'upah.pembagi_harian');

alter table public.berhenti add column if not exists uang_pisah bigint check (uang_pisah is null or uang_pisah between 0 and 100000000000);

create or replace function app.wajib_pemilik_berhenti(p_berhenti uuid) returns public.berhenti
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); b public.berhenti;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat dan mengajukan hak keuangan orang yang berhenti.' using errcode = '42501';
  end if;
  select * into b from public.berhenti where id = p_berhenti and perusahaan_id = v_pid and status <> 'batal';
  if b.id is null then raise exception 'Paket berhenti tidak ditemukan.' using errcode = 'P0002'; end if;
  return b;
end $$;
revoke all on function app.wajib_pemilik_berhenti(uuid) from public, anon, authenticated;

create or replace function public.hak_berhenti(p_berhenti uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.berhenti := app.wajib_pemilik_berhenti(p_berhenti); v_gaji jsonb; v_pembagi jsonb; v_jatah integer; v_pakai integer; u record;
begin
  select g.gaji into v_gaji from public.orang_rahasia g where g.orang_id = b.orang_id;
  select a.nilai into v_pembagi from public.aturan_bertanggal a
   where a.kunci = 'upah.pembagi_harian' and a.terverifikasi and a.berlaku_dari <= b.tanggal_efektif order by a.berlaku_dari desc limit 1;
  select k.jatah_tahunan into v_jatah from public.kebijakan_izin k where k.perusahaan_id = b.perusahaan_id and k.jenis = 'cuti';
  select coalesce(sum(p.hari), 0) into v_pakai from public.pengajuan_izin p
   where p.orang_id = b.orang_id and p.jenis = 'cuti' and p.status = 'disetujui'
     and extract(year from p.mulai) = extract(year from b.tanggal_efektif);
  select x.id, x.status, x.dampak_rp into u from public.usulan x
   where x.perusahaan_id = b.perusahaan_id and x.aksi = 'uang.hak_berhenti' and x.payload ->> 'berhenti_id' = b.id::text
   order by x.dibuat_at desc limit 1;
  return jsonb_build_object(
    'berhenti_id', b.id, 'orang_id', b.orang_id, 'nama', (select o.nama from public.orang o where o.id = b.orang_id),
    'alasan', b.alasan, 'tanggal_efektif', b.tanggal_efektif, 'status', b.status,
    'gaji', case when v_gaji ? 'pokok' then v_gaji end, 'pola', app.pola_kerja(b.perusahaan_id), 'pembagi', v_pembagi,
    'jatah_cuti', v_jatah, 'cuti_terpakai', v_pakai, 'uang_pisah', b.uang_pisah,
    'usulan', case when u.id is not null then jsonb_build_object('id', u.id, 'status', u.status, 'total', u.dampak_rp) end);
end $$;

-- Rincian: {gaji_akhir: rupiah, cuti: rupiah|null, cuti_hari: angka|null, upah_harian: rupiah|null, uang_pisah: rupiah|null,
-- dasar_gaji: teks}. Angka dari saran layar yang boleh diubah pemilik; database memeriksa bentuk dan menjumlah.
create or replace function public.ajukan_hak_berhenti(p_berhenti uuid, p_rincian jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.berhenti := app.wajib_pemilik_berhenti(p_berhenti); v_nama text; v_gaji bigint; v_cuti bigint; v_pisah bigint; v_total bigint;
  v_hari numeric; v_upah bigint; u public.usulan; v_judul text; v_ket text[]; v_payload jsonb;
begin
  if jsonb_typeof(p_rincian) is distinct from 'object' then raise exception 'Rincian hak tidak lengkap.' using errcode = '22023'; end if;
  begin
    v_gaji := coalesce((p_rincian ->> 'gaji_akhir')::bigint, 0);
    v_cuti := (p_rincian ->> 'cuti')::bigint;
    v_pisah := (p_rincian ->> 'uang_pisah')::bigint;
    v_hari := (p_rincian ->> 'cuti_hari')::numeric;
    v_upah := (p_rincian ->> 'upah_harian')::bigint;
  exception when others then
    raise exception 'Nilai hak harus rupiah bulat.' using errcode = '22023';
  end;
  if v_gaji < 0 or coalesce(v_cuti, 0) < 0 or coalesce(v_pisah, 0) < 0
     or greatest(v_gaji, coalesce(v_cuti, 0), coalesce(v_pisah, 0)) > 100000000000 then
    raise exception 'Nilai hak tidak boleh negatif.' using errcode = '22023';
  end if;
  v_total := v_gaji + coalesce(v_cuti, 0) + coalesce(v_pisah, 0);
  if v_total <= 0 then raise exception 'Total hak masih Rp0.' using errcode = '22023'; end if;
  select o.nama into v_nama from public.orang o where o.id = b.orang_id;

  update public.berhenti set uang_pisah = v_pisah where id = b.id;
  v_judul := left('Bayar hak ' || v_nama || ' yang berhenti: ' || app.rupiah(v_total), 200);
  v_ket := array_remove(array[
    'Gaji sampai ' || to_char(b.tanggal_efektif, 'DD-MM-YYYY') || ': ' || app.rupiah(v_gaji) || coalesce(' (' || nullif(left(btrim(p_rincian ->> 'dasar_gaji'), 200), '') || ')', ''),
    case when v_cuti is not null then 'Penggantian sisa cuti' || coalesce(' ' || trim_scale(v_hari)::text || ' hari', '') || coalesce(' x ' || app.rupiah(v_upah), '')
      || ': ' || app.rupiah(v_cuti) || ' (PP 35/2021 Pasal 40 ayat (4) huruf a; upah sehari PP 36/2021 Pasal 17)' end,
    case when v_pisah is not null then 'Uang pisah: ' || app.rupiah(v_pisah) || ' (isian pemilik; besarnya diatur perjanjian kerja atau peraturan perusahaan)' end,
    case when b.alasan = 'mundur' then 'Tanpa pesangon: mengundurkan diri mendapat uang penggantian hak dan uang pisah (PP 35/2021 Pasal 50).'
      else 'Pesangon atau kompensasi untuk alasan ini belum dihitung Nadi; periksa perjanjian kerja.' end,
    'Menyetujui hanya mencatat keputusan; pembayaran tetap kamu lakukan sendiri.'], null);
  v_payload := jsonb_build_object('berhenti_id', b.id, 'orang_id', b.orang_id,
    'bidang', jsonb_strip_nulls(jsonb_build_object('tanggal', b.tanggal_efektif, 'orang_id', b.orang_id, 'berhenti_id', b.id,
      'gaji_akhir', v_gaji, 'cuti', v_cuti, 'cuti_hari', v_hari, 'upah_harian', v_upah, 'uang_pisah', v_pisah, 'total', v_total,
      'pesangon', case when b.alasan = 'mundur' then 'tidak_berlaku' else 'belum_dihitung' end)),
    'sumber_pasal', jsonb_build_array('PP 35/2021 Pasal 40 ayat (4)', 'PP 35/2021 Pasal 50', 'PP 36/2021 Pasal 17'));

  select * into u from public.usulan x
   where x.perusahaan_id = b.perusahaan_id and x.aksi = 'uang.hak_berhenti' and x.payload ->> 'berhenti_id' = b.id::text
     and x.status in ('menunggu', 'diterima', 'otomatis')
   order by x.dibuat_at desc limit 1 for update;
  if u.id is not null and u.status <> 'menunggu' then
    raise exception 'Hak keuangan orang ini sudah disetujui.' using errcode = '23505';
  end if;
  if u.id is not null then
    update public.usulan set judul = v_judul, penjelasan = array_to_string(v_ket, E'\n'), payload = v_payload, dampak_rp = v_total
     where id = u.id;
    return jsonb_build_object('usulan', u.id, 'total', v_total, 'baru', false);
  end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp, untuk_peran)
  values (b.perusahaan_id, 'aturan', 'uang.hak_berhenti', v_judul, array_to_string(v_ket, E'\n'), v_payload, v_total, '{pemilik}')
  returning * into u;
  return jsonb_build_object('usulan', u.id, 'total', v_total, 'baru', true);
end $$;

revoke all on function public.hak_berhenti(uuid), public.ajukan_hak_berhenti(uuid, jsonb) from public, anon;
grant execute on function public.hak_berhenti(uuid), public.ajukan_hak_berhenti(uuid, jsonb) to authenticated;
